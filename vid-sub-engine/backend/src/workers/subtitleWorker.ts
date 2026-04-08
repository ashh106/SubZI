import { Worker, Job } from "bullmq";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import { config } from "../config/config";
import { SubtitleJob } from "../utils/subtitleJobModel";
import { SUBTITLE_QUEUE, SubtitleJobData, CaptionStyleConfig } from "../queue/subtitleQueue";
import { getRedisConnection } from "../utils/redisConnection";

// ─── Paths ───────────────────────────────────────────────────────────────────
const TRANSCRIBE_SCRIPT = path.join(__dirname, "transcribe.py");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract audio → mono 16kHz WAV (Whisper-optimised) */
function extractAudio(videoPath: string, audioPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("pcm_s16le")
      .audioFrequency(16000)
      .audioChannels(1)
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(new Error(`FFmpeg audio extract: ${err.message}`)))
      .save(audioPath);
  });
}

/** Spawn Python → handles entire transcription pipeline (Demucs + WhisperX/Whisper + clean) */
function runTranscriptPipeline(
  audioPath: string,
  sourceLanguage: string,
  targetLanguage: string,
  modelSize: string,
  useDemucs: boolean,
  useWhisperX: boolean,
  progressCallback: (pct: number) => void
): Promise<{ segments: Array<{ start: number; end: number; text: string }>; detectedLanguage: string }> {
  return new Promise((resolve, reject) => {
    console.log(`[Python] transcribe.py | src=${sourceLanguage} tgt=${targetLanguage} model=${modelSize} demucs=${useDemucs} whisperx=${useWhisperX}`);

    const proc = spawn(
      config.pythonBin,
      [
        TRANSCRIBE_SCRIPT,
        audioPath,
        sourceLanguage,
        targetLanguage,
        modelSize,
        useDemucs ? "1" : "0",
        useWhisperX ? "1" : "0",
      ],
      {
        env: {
          ...process.env,
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
        },
      }
    );

    let stdout = "";

    proc.stdout.setEncoding("utf8");
    proc.stderr.setEncoding("utf8");

    proc.stdout.on("data", (d: string) => (stdout += d));

    proc.stderr.on("data", (d: string) => {
      process.stderr.write(d);
      // Parse progress hints from Python stderr: "[PROGRESS] 45"
      const m = d.match(/\[PROGRESS\]\s*(\d+)/);
      if (m) progressCallback(parseInt(m[1], 10));
    });

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Python exited with code ${code}`));
      }
      try {
        // Strip any non-JSON lines before the last JSON object
        const jsonLine = stdout.trim().split("\n").filter(l => l.startsWith("{")).pop() || stdout.trim();
        const parsed = JSON.parse(jsonLine);
        if (parsed.error) return reject(new Error(parsed.error));
        resolve({ segments: parsed.segments, detectedLanguage: parsed.detectedLanguage ?? "unknown" });
      } catch {
        reject(new Error(`Bad JSON from Python: ${stdout.slice(0, 300)}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to start Python: ${err.message}`));
    });
  });
}

/** Build FFmpeg force_style string from CaptionStyleConfig */
function buildForceStyle(style: CaptionStyleConfig): string {
  const alignmentMap: Record<string, number> = {
    bottom: 2, top: 8, left: 1, right: 3,
  };
  const alignment = alignmentMap[style.position ?? "bottom"] ?? 2;

  // Convert hex color #RRGGBB → ASS &H00BBGGRR format
  const hexToAss = (hex: string): string => {
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
function toSRT(segments: Array<{ start: number; end: number; text: string }>): string {
  const fmt = (s: number) => {
    const ms  = Math.round((s % 1) * 1000).toString().padStart(3, "0");
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    const min = Math.floor((s / 60) % 60).toString().padStart(2, "0");
    const hr  = Math.floor(s / 3600).toString().padStart(2, "0");
    return `${hr}:${min}:${sec},${ms}`;
  };
  return segments
    .map((seg, i) => `${i + 1}\n${fmt(seg.start)} --> ${fmt(seg.end)}\n${seg.text.trim()}\n`)
    .join("\n");
}

/** Convert segments → WebVTT */
function toVTT(segments: Array<{ start: number; end: number; text: string }>): string {
  const fmt = (s: number) => {
    const ms  = Math.round((s % 1) * 1000).toString().padStart(3, "0");
    const sec = Math.floor(s % 60).toString().padStart(2, "0");
    const min = Math.floor((s / 60) % 60).toString().padStart(2, "0");
    const hr  = Math.floor(s / 3600).toString().padStart(2, "0");
    return `${hr}:${min}:${sec}.${ms}`;
  };
  const lines = ["WEBVTT", ""];
  segments.forEach((seg, i) => {
    lines.push(`${i + 1}`, `${fmt(seg.start)} --> ${fmt(seg.end)}`, seg.text.trim(), "");
  });
  return lines.join("\n");
}

/** Extract plain text transcript from segments */
function toPlainText(segments: Array<{ start: number; end: number; text: string }>): string {
  return segments.map(s => s.text.trim()).join(" ").replace(/\s+/g, " ").trim();
}

// ─── Worker ──────────────────────────────────────────────────────────────────

export function startSubtitleWorker(): Worker {
  const connection = getRedisConnection();

    const worker = new Worker<SubtitleJobData>(
    SUBTITLE_QUEUE,
    async (job: Job<SubtitleJobData>) => {
      const { fileId, filename, sourceLanguage, targetLanguage, whisperModel, captionStyle } = job.data;

      const updateDB = (fields: object) =>
        SubtitleJob.findOneAndUpdate({ fileId }, fields).exec();

      // Mark processing
      await updateDB({ status: "processing", startedAt: new Date(), progress: 5 });
      await job.updateProgress(5);

      const videoPath = path.join(config.uploadsDir, filename);
      const audioPath = path.join(config.uploadsDir, `${fileId}.wav`);
      const srtPath   = path.join(config.uploadsDir, `${fileId}.srt`);
      const vttPath   = path.join(config.uploadsDir, `${fileId}.vtt`);
      const textPath  = path.join(config.uploadsDir, `${fileId}.txt`);

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

        const { segments, detectedLanguage } = await runTranscriptPipeline(
          audioPath,
          sourceLanguage,
          targetLanguage,
          whisperModel || config.whisperModel,
          config.demucsEnabled,
          config.whisperxEnabled,
          async (pct) => {
            // Python reports 0-100 within the transcription step → map to 15-85 overall
            const mapped = Math.round(15 + pct * 0.70);
            await updateDB({ progress: mapped });
            await job.updateProgress(mapped);
          }
        );

        console.log(`[Worker] [${fileId}] Transcription done — ${segments.length} segments (lang: ${detectedLanguage})`);

        // ── Step 3: Write output files ────────────────────────────────────────
        await updateDB({ progress: 87 });
        await job.updateProgress(87);

        fs.writeFileSync(srtPath,  toSRT(segments),       "utf-8");
        fs.writeFileSync(vttPath,  toVTT(segments),       "utf-8");
        fs.writeFileSync(textPath, toPlainText(segments), "utf-8");

        // ── Step 4: Cleanup temp audio ────────────────────────────────────────
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

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

      } catch (err: any) {
        if (fs.existsSync(audioPath)) {
          try { fs.unlinkSync(audioPath); } catch { /* ignore */ }
        }
        await updateDB({ status: "failed", errorMessage: err.message });
        console.error(`[Worker] [${fileId}] ❌ Failed:`, err.message);
        throw err; // BullMQ will handle retry
      }
    },
    {
      connection,
      concurrency: 1, // Whisper is CPU-heavy — process one at a time
      lockDuration: 600000, // 10 minutes (prevents stall if python doesn't report progress fast enough)
      maxStalledCount: 1,
    }
  );

  worker.on("completed", (job) =>
    console.log(`[Worker] Job ${job.id} completed successfully`)
  );

  worker.on("failed", (job, err) =>
    console.error(`[Worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message)
  );

  worker.on("stalled", (jobId) =>
    console.warn(`[Worker] Job ${jobId} stalled — will be retried`)
  );

  console.log("✅ Subtitle worker started | queue:", SUBTITLE_QUEUE);
  return worker;
}
