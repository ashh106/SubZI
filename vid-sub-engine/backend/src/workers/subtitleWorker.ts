import { Worker, Job } from "bullmq";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import ffmpeg from "fluent-ffmpeg";
import { config } from "../config/config";
import { SubtitleJob } from "../utils/subtitleJobModel";
import { SUBTITLE_QUEUE, SubtitleJobData } from "../queue/subtitleQueue";

// Path to our Python transcription script
const TRANSCRIBE_SCRIPT = path.join(__dirname, "transcribe.py");

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract audio from video → mono 16kHz WAV (format Whisper likes best) */
function extractAudio(videoPath: string, audioPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioCodec("pcm_s16le")
      .audioFrequency(16000)
      .audioChannels(1)
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .save(audioPath);
  });
}

/** Run local Whisper via Python subprocess */
function runWhisperLocally(
  audioPath: string,
  sourceLanguage: string,
  targetLanguage: string,
  modelSize = "base"
): Promise<{ segments: Array<{ start: number; end: number; text: string }>; detectedLanguage: string }> {
  return new Promise((resolve, reject) => {
    console.log(`[Python] spawning: python transcribe.py ${path.basename(audioPath)} ${sourceLanguage} ${targetLanguage} ${modelSize}`);

    const proc = spawn(
      "python",
      [TRANSCRIBE_SCRIPT, audioPath, sourceLanguage, targetLanguage, modelSize],
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

    // Pipe Python stderr directly to Node terminal — shows Whisper progress live
    proc.stderr.on("data", (d: string) => process.stderr.write(d));

    proc.on("close", (code) => {
      if (code !== 0) {
        return reject(new Error(`Python exited with code ${code} — check terminal for details`));
      }
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed.error) return reject(new Error(parsed.error));
        resolve({
          segments: parsed.segments,
          detectedLanguage: parsed.detectedLanguage ?? "unknown",
        });
      } catch {
        reject(new Error(`Bad JSON from Whisper: ${stdout.slice(0, 200)}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to start Python: ${err.message} — is python in PATH?`));
    });
  });
}

/** Convert segments to SRT format */
function toSRT(segments: Array<{ start: number; end: number; text: string }>): string {
  return segments
    .map((seg, i) => {
      const fmt = (s: number) => {
        const ms  = Math.round((s % 1) * 1000).toString().padStart(3, "0");
        const sec = Math.floor(s % 60).toString().padStart(2, "0");
        const min = Math.floor((s / 60) % 60).toString().padStart(2, "0");
        const hr  = Math.floor(s / 3600).toString().padStart(2, "0");
        return `${hr}:${min}:${sec},${ms}`;
      };
      return `${i + 1}\n${fmt(seg.start)} --> ${fmt(seg.end)}\n${seg.text.trim()}\n`;
    })
    .join("\n");
}

/** Convert segments to WebVTT format */
function toVTT(segments: Array<{ start: number; end: number; text: string }>): string {
  const lines = ["WEBVTT", ""];
  segments.forEach((seg, i) => {
    const fmt = (s: number) => {
      const ms  = Math.round((s % 1) * 1000).toString().padStart(3, "0");
      const sec = Math.floor(s % 60).toString().padStart(2, "0");
      const min = Math.floor((s / 60) % 60).toString().padStart(2, "0");
      const hr  = Math.floor(s / 3600).toString().padStart(2, "0");
      return `${hr}:${min}:${sec}.${ms}`;
    };
    lines.push(`${i + 1}`, `${fmt(seg.start)} --> ${fmt(seg.end)}`, seg.text.trim(), "");
  });
  return lines.join("\n");
}

// ─── Worker ─────────────────────────────────────────────────────────────────

export function startSubtitleWorker(): Worker {
  const worker = new Worker<SubtitleJobData>(
    SUBTITLE_QUEUE,
    async (job: Job<SubtitleJobData>) => {
      const { fileId, filename, sourceLanguage, targetLanguage } = job.data;

      await SubtitleJob.findOneAndUpdate(
        { fileId },
        { status: "processing", startedAt: new Date() }
      );

      const videoPath = path.join(config.uploadsDir, filename);
      const audioPath = path.join(config.uploadsDir, `${fileId}.wav`);
      const srtPath   = path.join(config.uploadsDir, `${fileId}.srt`);
      const vttPath   = path.join(config.uploadsDir, `${fileId}.vtt`);

      try {
        // 1️⃣ Extract audio with FFmpeg
        console.log(`[Worker] Extracting audio for ${fileId}...`);
        await job.updateProgress(10);
        await extractAudio(videoPath, audioPath);
        console.log(`[Worker] Audio extracted -> ${audioPath}`);

        // 2️⃣ Transcribe with local Whisper (auto-detect + translate)
        console.log(`[Worker] Running Whisper (src=${sourceLanguage} -> tgt=${targetLanguage})...`);
        await job.updateProgress(30);
        const { segments, detectedLanguage } = await runWhisperLocally(
          audioPath, sourceLanguage, targetLanguage, config.whisperModel
        );
        console.log(`[Worker] Whisper done — ${segments.length} segments (detected: ${detectedLanguage})`);

        // 3️⃣ Write SRT + VTT
        await job.updateProgress(85);
        fs.writeFileSync(srtPath, toSRT(segments), "utf-8");
        fs.writeFileSync(vttPath, toVTT(segments), "utf-8");

        // 4️⃣ Cleanup temp audio
        fs.unlinkSync(audioPath);

        // 5️⃣ Mark completed in DB
        await SubtitleJob.findOneAndUpdate(
          { fileId },
          { status: "completed", srtPath, vttPath, detectedLanguage, completedAt: new Date() }
        );

        await job.updateProgress(100);
        console.log(`[Worker] Done: ${fileId} (${detectedLanguage} -> ${targetLanguage})`);

        // 5️⃣ Mark completed in DB
        await SubtitleJob.findOneAndUpdate(
          { fileId },
          { status: "completed", srtPath, vttPath, completedAt: new Date() }
        );

        await job.updateProgress(100);
        console.log(`[Worker] Done: ${fileId}`);

      } catch (err: any) {
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        await SubtitleJob.findOneAndUpdate(
          { fileId },
          { status: "failed", errorMessage: err.message }
        );
        throw err;
      }
    },
    {
      connection: { host: config.redisHost, port: config.redisPort },
      concurrency: 1,  // 1 at a time — Whisper is CPU-heavy
    }
  );

  worker.on("completed", (job) =>
    console.log(`[Worker] Job ${job.id} completed`)
  );
  worker.on("failed", (job, err) =>
    console.error(`[Worker] Job ${job?.id} failed:`, err.message)
  );

  console.log("Subtitle worker started (local Whisper mode)");
  return worker;
}
