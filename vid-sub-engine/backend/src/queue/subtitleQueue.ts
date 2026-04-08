import { Queue } from "bullmq";
import { config } from "../config/config";

export const SUBTITLE_QUEUE = "subtitle-generation";

export const subtitleQueue = new Queue(SUBTITLE_QUEUE, {
  connection: {
    host: config.redisHost,
    port: config.redisPort,
  },
  defaultJobOptions: {
    attempts: 1,                          // 1 attempt only — no retry on failure
    removeOnComplete: 50,
    removeOnFail: 20,
  },
});

export interface SubtitleJobData {
  fileId: string;
  filename: string;
  originalName: string;
  sourceLanguage: string;  // "auto" or ISO code e.g. "hi","ur","ja"
  targetLanguage: string;  // "en","hi","ur","pa","ja","fr"...
}

/** Enqueue a new subtitle generation job */
export async function enqueueSubtitleJob(data: SubtitleJobData): Promise<string> {
  const job = await subtitleQueue.add("generate-subtitles", data, {
    jobId: data.fileId,
  });
  return job.id ?? data.fileId;
}
