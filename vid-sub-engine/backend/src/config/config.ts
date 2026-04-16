import dotenv from "dotenv";
import path from "path";
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 5000,

  // MongoDB
  mongoUri: process.env.MONGO_URI || "",

  // Redis — supports both local (host/port) and Upstash (REDIS_URL with TLS)
  redisHost:     process.env.REDIS_HOST || "127.0.0.1",
  redisPort:     Number(process.env.REDIS_PORT) || 6379,
  redisUrl:      process.env.REDIS_URL || "",      // e.g. rediss://default:xxx@xxx.upstash.io:6380
  redisTls:      process.env.REDIS_TLS === "true", // set to "true" for Upstash

  // Storage
  uploadsDir: path.resolve(process.cwd(), process.env.UPLOADS_DIR || "uploads"),

  // Whisper / AI
  whisperModel:      process.env.WHISPER_MODEL          || "medium",
  whisperxEnabled:   process.env.WHISPERX_ENABLED       === "true",
  demucsEnabled:     process.env.DEMUCS_ENABLED         === "true",
  demucsModel:       process.env.DEMUCS_MODEL           || "htdemucs",
  pythonBin:         process.env.PYTHON_BIN             || "python",

  // OpenAI (optional GPT post-processing)
  openaiApiKey: process.env.OPENAI_API_KEY || "",

  // Gemini API (fast cloud transcription — replaces local Whisper)
  geminiApiKey: process.env.GEMINI_API_KEY || "",

  // Max file size in bytes (default 500 MB)
  maxFileSizeBytes: Number(process.env.MAX_FILE_SIZE_MB || 500) * 1024 * 1024,

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || "*",
};