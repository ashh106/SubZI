"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSubtitleWorker = startSubtitleWorker;
const bullmq_1 = require("bullmq");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const config_1 = require("../config/config");
const subtitleJobModel_1 = require("../utils/subtitleJobModel");
const subtitleQueue_1 = require("../queue/subtitleQueue");
const redisConnection_1 = require("../utils/redisConnection");
// ─── Paths ───────────────────────────────────────────────────────────────────
const TRANSCRIBE_SCRIPT = path_1.default.join(__dirname, "transcribe.py");
// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Extract audio → mono 16kHz WAV (Whisper-optimised) */
function extractAudio(videoPath, audioPath) {
    return new Promise((resolve, reject) => {
        (0, fluent_ffmpeg_1.default)(videoPath)
            .noVideo()
            .audioCodec("pcm_s16le")
            .audioFrequency(16000)
            .audioChannels(1)
            .on("end", () => resolve())
            .on("error", (err) => reject(new Error(`FFmpeg audio extract: ${err.message}`)))
            .save(audioPath);
    });
}
/** Spawn Python → handles entire transcription pipeline (Demucs + WhisperX/Whisper + clean) */
function runTranscriptPipeline(audioPath, sourceLanguage, targetLanguage, modelSize, useDemucs, useWhisperX, progressCallback) {
    return new Promise((resolve, reject) => {
        console.log(`[Python] transcribe.py | src=${sourceLanguage} tgt=${targetLanguage} model=${modelSize} demucs=${useDemucs} whisperx=${useWhisperX}`);
        const proc = (0, child_process_1.spawn)(config_1.config.pythonBin, [
            TRANSCRIBE_SCRIPT,
            audioPath,
            sourceLanguage,
            targetLanguage,
            modelSize,
            useDemucs ? "1" : "0",
            useWhisperX ? "1" : "0",
        ], {
            env: {
                ...process.env,
                PYTHONIOENCODING: "utf-8",
                PYTHONUTF8: "1",
            },
        });
        let stdout = "";
        proc.stdout.setEncoding("utf8");
        proc.stderr.setEncoding("utf8");
        proc.stdout.on("data", (d) => (stdout += d));
        proc.stderr.on("data", (d) => {
            process.stderr.write(d);
            // Parse progress hints from Python stderr: "[PROGRESS] 45"
            const m = d.match(/\[PROGRESS\]\s*(\d+)/);
            if (m)
                progressCallback(parseInt(m[1], 10));
        });
        proc.on("close", (code) => {
            if (code !== 0) {
                return reject(new Error(`Python exited with code ${code}`));
            }
            try {
                // Strip any non-JSON lines before the last JSON object
                const jsonLine = stdout.trim().split("\n").filter(l => l.startsWith("{")).pop() || stdout.trim();
                const parsed = JSON.parse(jsonLine);
                if (parsed.error)
                    return reject(new Error(parsed.error));
                resolve({ segments: parsed.segments, detectedLanguage: parsed.detectedLanguage ?? "unknown" });
            }
            catch {
                reject(new Error(`Bad JSON from Python: ${stdout.slice(0, 300)}`));
            }
        });
        proc.on("error", (err) => {
            reject(new Error(`Failed to start Python: ${err.message}`));
        });
    });
}
/** Build FFmpeg force_style string from CaptionStyleConfig */
function buildForceStyle(style) {
    const alignmentMap = {
        bottom: 2, top: 8, left: 1, right: 3,
    };
    const alignment = alignmentMap[style.position ?? "bottom"] ?? 2;
    // Convert hex color #RRGGBB → ASS &H00BBGGRR format
    const hexToAss = (hex) => {
        const clean = hex.replace("#", "");
        const r = clean.slice(0, 2);
        const g = clean.slice(2, 4);
        const b = clean.slice(4, 6);
        return `&H00${b}${g}${r}`.toUpperCase();
    };
    const parts = [
        `FontName=${style.fontName ?? "Arial"}`,
        `FontSize=${style.fontSize ?? 24}`,
        `PrimaryColour=${hexToAss(style.color ?? "#FFFFFF")}`,
        `Alignment=${alignment}`,
        "Bold=0",
        "Italic=0",
        "BorderStyle=1",
        "Outline=2",
        "Shadow=1",
        "MarginV=20",
    ];
    return parts.join(",");
}
/** Convert segments → SRT */
function toSRT(segments) {
    const fmt = (s) => {
        const ms = Math.round((s % 1) * 1000).toString().padStart(3, "0");
        const sec = Math.floor(s % 60).toString().padStart(2, "0");
        const min = Math.floor((s / 60) % 60).toString().padStart(2, "0");
        const hr = Math.floor(s / 3600).toString().padStart(2, "0");
        return `${hr}:${min}:${sec},${ms}`;
    };
    return segments
        .map((seg, i) => `${i + 1}\n${fmt(seg.start)} --> ${fmt(seg.end)}\n${seg.text.trim()}\n`)
        .join("\n");
}
/** Convert segments → WebVTT */
function toVTT(segments) {
    const fmt = (s) => {
        const ms = Math.round((s % 1) * 1000).toString().padStart(3, "0");
        const sec = Math.floor(s % 60).toString().padStart(2, "0");
        const min = Math.floor((s / 60) % 60).toString().padStart(2, "0");
        const hr = Math.floor(s / 3600).toString().padStart(2, "0");
        return `${hr}:${min}:${sec}.${ms}`;
    };
    const lines = ["WEBVTT", ""];
    segments.forEach((seg, i) => {
        lines.push(`${i + 1}`, `${fmt(seg.start)} --> ${fmt(seg.end)}`, seg.text.trim(), "");
    });
    return lines.join("\n");
}
/** Extract plain text transcript from segments */
function toPlainText(segments) {
    return segments.map(s => s.text.trim()).join(" ").replace(/\s+/g, " ").trim();
}
// ─── Worker ──────────────────────────────────────────────────────────────────
function startSubtitleWorker() {
    const connection = (0, redisConnection_1.getRedisConnection)();
    const worker = new bullmq_1.Worker(subtitleQueue_1.SUBTITLE_QUEUE, async (job) => {
        const { fileId, filename, sourceLanguage, targetLanguage, whisperModel, captionStyle } = job.data;
        const updateDB = (fields) => subtitleJobModel_1.SubtitleJob.findOneAndUpdate({ fileId }, fields).exec();
        // Mark processing
        await updateDB({ status: "processing", startedAt: new Date(), progress: 5 });
        await job.updateProgress(5);
        const videoPath = path_1.default.join(config_1.config.uploadsDir, filename);
        const audioPath = path_1.default.join(config_1.config.uploadsDir, `${fileId}.wav`);
        const srtPath = path_1.default.join(config_1.config.uploadsDir, `${fileId}.srt`);
        const vttPath = path_1.default.join(config_1.config.uploadsDir, `${fileId}.vtt`);
        const textPath = path_1.default.join(config_1.config.uploadsDir, `${fileId}.txt`);
        try {
            // ── Step 1: Extract audio ─────────────────────────────────────────────
            console.log(`[Worker] [${fileId}] Step 1: Extracting audio...`);
            await updateDB({ progress: 10 });
            await job.updateProgress(10);
            await extractAudio(videoPath, audioPath);
            console.log(`[Worker] [${fileId}] Audio extracted`);
            // ── Step 2: Python pipeline (Demucs → WhisperX/Whisper → clean) ───────
            console.log(`[Worker] [${fileId}] Step 2: AI transcription pipeline...`);
            await updateDB({ progress: 15 });
            await job.updateProgress(15);
            const { segments, detectedLanguage } = await runTranscriptPipeline(audioPath, sourceLanguage, targetLanguage, whisperModel || config_1.config.whisperModel, config_1.config.demucsEnabled, config_1.config.whisperxEnabled, async (pct) => {
                // Python reports 0-100 within the transcription step → map to 15-85 overall
                const mapped = Math.round(15 + pct * 0.70);
                await updateDB({ progress: mapped });
                await job.updateProgress(mapped);
            });
            console.log(`[Worker] [${fileId}] Transcription done — ${segments.length} segments (lang: ${detectedLanguage})`);
            // ── Step 3: Write output files ────────────────────────────────────────
            await updateDB({ progress: 87 });
            await job.updateProgress(87);
            fs_1.default.writeFileSync(srtPath, toSRT(segments), "utf-8");
            fs_1.default.writeFileSync(vttPath, toVTT(segments), "utf-8");
            fs_1.default.writeFileSync(textPath, toPlainText(segments), "utf-8");
            // ── Step 4: Cleanup temp audio ────────────────────────────────────────
            if (fs_1.default.existsSync(audioPath))
                fs_1.default.unlinkSync(audioPath);
            // ── Step 5: Mark completed ────────────────────────────────────────────
            await updateDB({
                status: "completed",
                progress: 100,
                srtPath,
                vttPath,
                textPath,
                detectedLanguage,
                completedAt: new Date(),
            });
            await job.updateProgress(100);
            console.log(`[Worker] [${fileId}] ✅ Done (${detectedLanguage} → ${targetLanguage})`);
        }
        catch (err) {
            if (fs_1.default.existsSync(audioPath)) {
                try {
                    fs_1.default.unlinkSync(audioPath);
                }
                catch { /* ignore */ }
            }
            await updateDB({ status: "failed", errorMessage: err.message });
            console.error(`[Worker] [${fileId}] ❌ Failed:`, err.message);
            throw err; // BullMQ will handle retry
        }
    }, {
        connection,
        concurrency: 1, // Whisper is CPU-heavy — process one at a time
    });
    worker.on("completed", (job) => console.log(`[Worker] Job ${job.id} completed successfully`));
    worker.on("failed", (job, err) => console.error(`[Worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message));
    worker.on("stalled", (jobId) => console.warn(`[Worker] Job ${jobId} stalled — will be retried`));
    console.log("✅ Subtitle worker started | queue:", subtitleQueue_1.SUBTITLE_QUEUE);
    return worker;
}
