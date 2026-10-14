"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUBTITLE_QUEUE = void 0;
exports.enqueueSubtitleJob = enqueueSubtitleJob;
const bullmq_1 = require("bullmq");
const redisConnection_1 = require("../utils/redisConnection");
const subtitleWorker_1 = require("../workers/subtitleWorker");
exports.SUBTITLE_QUEUE = "subtitle-generation";
let bullQueue = null;
if ((0, redisConnection_1.isRedisConfigured)()) {
    try {
        bullQueue = new bullmq_1.Queue(exports.SUBTITLE_QUEUE, {
            connection: (0, redisConnection_1.getRedisConnection)(),
            defaultJobOptions: {
                attempts: 3,
                backoff: { type: "exponential", delay: 5000 },
                removeOnComplete: 50,
                removeOnFail: 20,
            },
        });
    }
    catch (err) {
        console.warn("⚠️  BullMQ initialization skipped, using in-process queue:", err.message);
    }
}
// In-process fallback queue to run jobs sequentially without Redis
const inProcessQueue = [];
let isProcessingInProcess = false;
async function pumpInProcessQueue() {
    if (isProcessingInProcess || inProcessQueue.length === 0)
        return;
    isProcessingInProcess = true;
    while (inProcessQueue.length > 0) {
        const jobData = inProcessQueue.shift();
        if (!jobData)
            break;
        try {
            console.log(`[InProcessQueue] Processing job ${jobData.fileId}...`);
            await (0, subtitleWorker_1.processSubtitleJob)(jobData);
        }
        catch (err) {
            console.error(`[InProcessQueue] Job ${jobData.fileId} failed:`, err.message);
        }
    }
    isProcessingInProcess = false;
}
/** Enqueue a new subtitle generation job */
async function enqueueSubtitleJob(data) {
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
        }
        catch (err) {
            console.warn("⚠️  BullMQ enqueue failed, falling back to in-process queue:", err.message);
        }
    }
    // In-process fallback
    inProcessQueue.push(data);
    setImmediate(pumpInProcessQueue);
    return data.fileId;
}
