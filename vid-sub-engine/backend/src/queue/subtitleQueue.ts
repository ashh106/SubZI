import { Queue } from "bullmq";
import { getRedisConnection, isRedisConfigured } from "../utils/redisConnection";
import { processSubtitleJob } from "../workers/subtitleWorker";

export const SUBTITLE_QUEUE = "subtitle-generation";

export interface SubtitleJobData {
  fileId: string;
  filename: string;
  originalName: string;
  sourceLanguage: string;
  targetLanguage: string;
  whisperModel?: string;
  localWhisperModel?: string;
  captionStyle?: CaptionStyleConfig;
}

export interface CaptionStyleConfig {
  fontName?: string;
  fontSize?: number;
  color?: string;
  position?: "top" | "bottom" | "left" | "right";
}

let bullQueue: Queue | null = null;

if (isRedisConfigured()) {
  try {
    bullQueue = new Queue(SUBTITLE_QUEUE, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    });
  } catch (err: any) {
    console.warn("⚠️  BullMQ initialization skipped, using in-process queue:", err.message);
  }
}

// In-process fallback queue to run jobs sequentially without Redis
const inProcessQueue: SubtitleJobData[] = [];
let isProcessingInProcess = false;

async function pumpInProcessQueue() {
  if (isProcessingInProcess || inProcessQueue.length === 0) return;
  isProcessingInProcess = true;

  while (inProcessQueue.length > 0) {
    const jobData = inProcessQueue.shift();
    if (!jobData) break;
    try {
      console.log(`[InProcessQueue] Processing job ${jobData.fileId}...`);
      await processSubtitleJob(jobData);
    } catch (err: any) {
      console.error(`[InProcessQueue] Job ${jobData.fileId} failed:`, err.message);
    }
  }

  isProcessingInProcess = false;
}

/** Enqueue a new subtitle generation job */
export async function enqueueSubtitleJob(data: SubtitleJobData): Promise<string> {
  if (bullQueue) {
    try {
      const existing = await bullQueue.getJob(data.fileId);
      if (existing) {
        await existing.remove();
      }
      const job = await bullQueue.add("generate-subtitles", data, {
        jobId: data.fileId,
      });
      return job.id ?? data.fileId;
    } catch (err: any) {
      console.warn("⚠️  BullMQ enqueue failed, falling back to in-process queue:", err.message);
    }
  }

  // In-process fallback
  inProcessQueue.push(data);
  setImmediate(pumpInProcessQueue);
  return data.fileId;
}
