import { Worker, Job } from "bullmq";
import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import { config } from "../config/config";
import { JobRepository } from "../utils/jobRepository";
import { SUBTITLE_QUEUE, SubtitleJobData } from "../queue/subtitleQueue";
import { getRedisConnection, isRedisConfigured } from "../utils/redisConnection";
import { transcriptionService } from "../services/transcription";
import { toSRT, toVTT, toPlainText } from "../utils/subtitleFormat";

export function extractAudio(videoPath: string, audioPath: string): Promise<void> {
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

export function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (!err && data?.format?.duration) resolve(data.format.duration);
      else resolve(0);
    });
  });
}

export async function processSubtitleJob(jobData: SubtitleJobData, onProgress?: (pct: number) => Promise<void> | void): Promise<void> {
  const { fileId, filename, sourceLanguage, targetLanguage, whisperModel, localWhisperModel } = jobData;

  const updateDB = async (fields: object) => {
    await JobRepository.findOneAndUpdate({ fileId }, fields as any);
    if (typeof (fields as any).progress === "number" && onProgress) {
      await onProgress((fields as any).progress);
    }
  };

  await updateDB({ status: "processing", startedAt: new Date(), progress: 5, errorMessage: undefined });

  const videoPath = path.join(config.uploadsDir, filename);
  const audioPath = path.join(config.uploadsDir, `${fileId}.wav`);
  const srtPath = path.join(config.uploadsDir, `${fileId}.srt`);
  const vttPath = path.join(config.uploadsDir, `${fileId}.vtt`);
  const textPath = path.join(config.uploadsDir, `${fileId}.txt`);

  if (!fs.existsSync(videoPath)) {
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
    const result = await transcriptionService.transcribe(
      audioPath,
      sourceLanguage,
      targetLanguage,
      whisperModel || config.whisperModel,
      {
        duration: audioDuration,
        localWhisperModel,
        onProgress: async (pct) => {
          const mapped = Math.round(15 + pct * 0.7);
          await updateDB({ progress: mapped });
        },
      }
    );

    const segments = (result.segments || []).filter((s) => s.text && s.end > s.start);
    if (segments.length === 0) {
      throw new Error("Transcription produced no speech segments. Try a clearer clip or another engine.");
    }

    console.log(
      `[Job ${fileId}] Transcription done — ${segments.length} segments via ${result.providerUsed} (lang: ${result.detectedLanguage})`
    );

    await updateDB({ progress: 87 });
    fs.writeFileSync(srtPath, toSRT(segments), "utf-8");
    fs.writeFileSync(vttPath, toVTT(segments), "utf-8");
    fs.writeFileSync(textPath, toPlainText(segments), "utf-8");

    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);

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
  } catch (err: any) {
    if (fs.existsSync(audioPath)) {
      try {
        fs.unlinkSync(audioPath);
      } catch {}
    }
    await updateDB({ status: "failed", errorMessage: err.message });
    console.error(`[Job ${fileId}] Failed:`, err.message);
    throw err;
  }
}

export function startSubtitleWorker(): Worker | null {
  if (!isRedisConfigured()) {
    console.log("ℹ️  Redis not configured — subtitle jobs will run on the in-process queue.");
    return null;
  }

  const connection = getRedisConnection();

  const worker = new Worker<SubtitleJobData>(
    SUBTITLE_QUEUE,
    async (job: Job<SubtitleJobData>) => {
      await processSubtitleJob(job.data, async (pct) => {
        await job.updateProgress(pct);
      });
    },
    {
      connection,
      concurrency: 1,
      lockDuration: 600000,
      maxStalledCount: 1,
    }
  );

  worker.on("completed", (job) => console.log(`[Worker] Job ${job.id} completed successfully`));
  worker.on("failed", (job, err) =>
    console.error(`[Worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message)
  );
  worker.on("stalled", (jobId) => console.warn(`[Worker] Job ${jobId} stalled — will be retried`));
  worker.on("error", (err) => console.error("[Worker] Redis/worker error:", err.message));

  console.log("✅ Subtitle worker started | queue:", SUBTITLE_QUEUE);
  return worker;
}
