import { Queue } from "bullmq";
import { getRedisConnection } from "../utils/redisConnection";

export const SUBTITLE_QUEUE = "subtitle-generation";

export interface SubtitleJobData {
  fileId: string;
  filename: string;
  originalName: string;
  sourceLanguage: string;  // "auto" or ISO code e.g. "hi","ur","ja"
  targetLanguage: string;  // "en","hi","ur","pa","ja","fr"...
  whisperModel?: string;   // "tiny", "base", "small", "medium", "large-v3"
  captionStyle?: CaptionStyleConfig;
}

export interface CaptionStyleConfig {
  fontName?: string;    // e.g. "Arial", "Poppins"
  fontSize?: number;    // e.g. 24
  color?: string;       // hex e.g. "#FFFFFF"
  position?: "top" | "bottom" | "left" | "right"; // subtitle alignment
}

export const subtitleQueue = new Queue(SUBTITLE_QUEUE, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 3,                          // retry up to 3 times on failure
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 20,
  },
});

/** Enqueue a new subtitle generation job */
export async function enqueueSubtitleJob(data: SubtitleJobData): Promise<string> {
  const job = await subtitleQueue.add("generate-subtitles", data, {
    jobId: data.fileId,
  });
  return job.id ?? data.fileId;
}
