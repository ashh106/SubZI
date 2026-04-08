"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subtitleQueue = exports.SUBTITLE_QUEUE = void 0;
exports.enqueueSubtitleJob = enqueueSubtitleJob;
const bullmq_1 = require("bullmq");
const redisConnection_1 = require("../utils/redisConnection");
exports.SUBTITLE_QUEUE = "subtitle-generation";
exports.subtitleQueue = new bullmq_1.Queue(exports.SUBTITLE_QUEUE, {
    connection: (0, redisConnection_1.getRedisConnection)(),
    defaultJobOptions: {
        attempts: 3, // retry up to 3 times on failure
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 50,
        removeOnFail: 20,
    },
});
/** Enqueue a new subtitle generation job */
async function enqueueSubtitleJob(data) {
    const job = await exports.subtitleQueue.add("generate-subtitles", data, {
        jobId: data.fileId,
    });
    return job.id ?? data.fileId;
}
