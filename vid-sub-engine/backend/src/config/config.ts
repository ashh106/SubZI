import dotenv from "dotenv";
import path from "path";
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGO_URI || "",
  redisHost: process.env.REDIS_HOST || "127.0.0.1",
  redisPort: Number(process.env.REDIS_PORT) || 6379,
  uploadsDir: path.resolve(process.cwd(), process.env.UPLOADS_DIR || "uploads"),
  whisperModel: process.env.WHISPER_MODEL || "small",  // small is min recommended for Indian langs
  openaiApiKey: process.env.OPENAI_API_KEY || "",
};