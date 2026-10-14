"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAudio = extractAudio;
exports.getAudioDuration = getAudioDuration;
exports.processSubtitleJob = processSubtitleJob;
exports.startSubtitleWorker = startSubtitleWorker;
const bullmq_1 = require("bullmq");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const config_1 = require("../config/config");
const jobRepository_1 = require("../utils/jobRepository");
const subtitleQueue_1 = require("../queue/subtitleQueue");
const redisConnection_1 = require("../utils/redisConnection");
const transcription_1 = require("../services/transcription");
const subtitleFormat_1 = require("../utils/subtitleFormat");
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
function getAudioDuration(filePath) {
    return new Promise((resolve) => {
        fluent_ffmpeg_1.default.ffprobe(filePath, (err, data) => {
            if (!err && data?.format?.duration)
                resolve(data.format.duration);
            else
                resolve(0);
        });
    });
}
async function processSubtitleJob(jobData, onProgress) {
    const { fileId, filename, sourceLanguage, targetLanguage, whisperModel, localWhisperModel } = jobData;
    const updateDB = async (fields) => {
        await jobRepository_1.JobRepository.findOneAndUpdate({ fileId }, fields);
        if (typeof fields.progress === "number" && onProgress) {
            await onProgress(fields.progress);
        }
    };
    await updateDB({ status: "processing", startedAt: new Date(), progress: 5, errorMessage: undefined });
    const videoPath = path_1.default.join(config_1.config.uploadsDir, filename);
    const audioPath = path_1.default.join(config_1.config.uploadsDir, `${fileId}.wav`);
    const srtPath = path_1.default.join(config_1.config.uploadsDir, `${fileId}.srt`);
    const vttPath = path_1.default.join(config_1.config.uploadsDir, `${fileId}.vtt`);
    const textPath = path_1.default.join(config_1.config.uploadsDir, `${fileId}.txt`);
    if (!fs_1.default.existsSync(videoPath)) {
        const message = `Source video not found: ${videoPath}`;
        await updateDB({ status: "failed", errorMessage: message });
        throw new Error(message);
    }
    try {
        await updateDB({ progress: 10 });
        await extractAudio(videoPath, audioPath);
        console.log(`[Job ${fileId}] Audio extracted`);
        await updateDB({ progress: 15 });
        if (localWhisperModel) {
            console.log(`[Job ${fileId}] Local Whisper fallback model selected: ${localWhisperModel}`);
        }
        const audioDuration = await getAudioDuration(videoPath);
        const result = await transcription_1.transcriptionService.transcribe(audioPath, sourceLanguage, targetLanguage, whisperModel || config_1.config.whisperModel, {
            duration: audioDuration,
            localWhisperModel,
            onProgress: async (pct) => {
                const mapped = Math.round(15 + pct * 0.7);
                await updateDB({ progress: mapped });
            },
        });
        const segments = (result.segments || []).filter((s) => s.text && s.end > s.start);
        if (segments.length === 0) {
            throw new Error("Transcription produced no speech segments. Try a clearer clip or another engine.");
        }
        console.log(`[Job ${fileId}] Transcription done — ${segments.length} segments via ${result.providerUsed} (lang: ${result.detectedLanguage})`);
        await updateDB({ progress: 87 });
        fs_1.default.writeFileSync(srtPath, (0, subtitleFormat_1.toSRT)(segments), "utf-8");
        fs_1.default.writeFileSync(vttPath, (0, subtitleFormat_1.toVTT)(segments), "utf-8");
        fs_1.default.writeFileSync(textPath, (0, subtitleFormat_1.toPlainText)(segments), "utf-8");
        if (fs_1.default.existsSync(audioPath))
            fs_1.default.unlinkSync(audioPath);
        await updateDB({
            status: "completed",
            progress: 100,
            srtPath,
            vttPath,
            textPath,
            detectedLanguage: result.detectedLanguage,
            keywords: result.keywords,
            rawSegments: segments,
            completedAt: new Date(),
        });
        console.log(`[Job ${fileId}] Done (${result.detectedLanguage} → ${targetLanguage}) via ${result.providerUsed}`);
    }
    catch (err) {
        if (fs_1.default.existsSync(audioPath)) {
            try {
                fs_1.default.unlinkSync(audioPath);
            }
            catch { }
        }
        await updateDB({ status: "failed", errorMessage: err.message });
        console.error(`[Job ${fileId}] Failed:`, err.message);
        throw err;
    }
}
function startSubtitleWorker() {
    if (!(0, redisConnection_1.isRedisConfigured)()) {
        console.log("ℹ️  Redis not configured — subtitle jobs will run on the in-process queue.");
        return null;
    }
    const connection = (0, redisConnection_1.getRedisConnection)();
    const worker = new bullmq_1.Worker(subtitleQueue_1.SUBTITLE_QUEUE, async (job) => {
        await processSubtitleJob(job.data, async (pct) => {
            await job.updateProgress(pct);
        });
    }, {
        connection,
        concurrency: 1,
        lockDuration: 600000,
        maxStalledCount: 1,
    });
    worker.on("completed", (job) => console.log(`[Worker] Job ${job.id} completed successfully`));
    worker.on("failed", (job, err) => console.error(`[Worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message));
    worker.on("stalled", (jobId) => console.warn(`[Worker] Job ${jobId} stalled — will be retried`));
    worker.on("error", (err) => console.error("[Worker] Redis/worker error:", err.message));
    console.log("✅ Subtitle worker started | queue:", subtitleQueue_1.SUBTITLE_QUEUE);
    return worker;
}
