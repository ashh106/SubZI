#!/usr/bin/env node
/**
 * Standalone worker entry point.
 * Run with: npx ts-node src/workerEntry.ts
 * or:       node dist/workerEntry.js
 *
 * This process ONLY runs BullMQ workers — it does NOT start the HTTP server.
 * It should NOT be launched with nodemon (it handles its own restarts).
 */
import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "./utils/db";
import { startSubtitleWorker } from "./workers/subtitleWorker";

async function main() {
  console.log("=== SubZI Subtitle Worker ===");
  console.log("Redis:", process.env.REDIS_URL || `${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || 6379}`);
  console.log("Whisper model:", process.env.WHISPER_MODEL || "medium");
  console.log("Demucs:", process.env.DEMUCS_ENABLED === "true" ? "enabled" : "disabled");
  console.log("WhisperX:", process.env.WHISPERX_ENABLED === "true" ? "enabled" : "disabled");

  // Connect to MongoDB (needed to update job records)
  try {
    await connectDB();
    console.log("✅ MongoDB connected");
  } catch (err: any) {
    console.error("❌ MongoDB failed:", err.message);
    process.exit(1);
  }

  // Start the BullMQ worker
  const worker = startSubtitleWorker();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n[Worker] ${signal} received — shutting down gracefully...`);
    await worker.close();
    console.log("[Worker] Worker closed. Bye.");
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
  process.on("uncaughtException", (err) => {
    console.error("[Worker] Uncaught exception:", err);
    // Let the process crash & let the process manager (PM2/Docker) restart it
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[Worker] Unhandled rejection:", reason);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error("Worker startup failed:", err);
  process.exit(1);
});
