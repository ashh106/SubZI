import express from "express";
import cors from "cors";
import fs from "fs";
import { config } from "./config/config";
import { connectDB, isDbConnected } from "./utils/db";
import { startSubtitleWorker } from "./workers/subtitleWorker";
import { isRedisConfigured } from "./utils/redisConnection";
import { transcriptionService } from "./services/transcription";
import { startUploadCleanupScheduler } from "./utils/fileCleanup";
import uploadRoutes from "./routes/uploadRoutes";
import contextRoutes from "./routes/contextRoutes";

const app = express();

// Ensure uploads folder exists
if (!fs.existsSync(config.uploadsDir)) {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
}

// ─── Flexible CORS Configuration ──────────────────────────────────────────────
const allowedOrigins = [
  "https://sub-zi.vercel.app",
  "https://subzi.vercel.app",
  "http://localhost:5173",
  "http://localhost:8080",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8080",
  ...config.corsOrigin.split(",").map((s) => s.trim()),
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin) return callback(null, true);
      if (
        config.corsOrigin === "*" ||
        allowedOrigins.includes(origin) ||
        origin.endsWith(".vercel.app")
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive for public API / frontend demos
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/upload", uploadRoutes);
app.use("/api/context", contextRoutes);

// Health check handler
const handleHealth = (_req: express.Request, res: express.Response) => {
  res.json({
    status: "ok",
    message: "SubZI Video Subtitle Engine is operational",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
    services: {
      database: isDbConnected() ? "MongoDB Atlas (Connected)" : "In-Memory Store (Active)",
      queue: isRedisConfigured() ? "BullMQ / Redis (Configured)" : "In-Process Queue (Active)",
      transcriptionProviders: transcriptionService.getAvailableProviders(),
    },
    endpoints: {
      upload: "POST /api/upload",
      status: "GET /api/upload/:fileId/status",
      downloadSrt: "GET /api/upload/:fileId/download/srt",
      downloadVtt: "GET /api/upload/:fileId/download/vtt",
      burnVideo: "POST /api/upload/:fileId/burn",
      downloadBurned: "GET /api/upload/:fileId/burned",
      glossaryList: "GET /api/context/glossary",
      glossaryAdd: "POST /api/context/glossary",
      ragCorrect: "POST /api/context/correct/:fileId",
      ragApply: "POST /api/context/apply/:fileId",
    },
  });
};

app.get("/health", handleHealth);
app.get("/api/health", handleHealth);

// Root
app.get("/", (_req, res) => {
  res.json({
    project: "SubZI",
    tagline: "High-performance AI Subtitle & Video Translation Engine",
    docs: "/health",
    frontend: "https://sub-zi.vercel.app/",
  });
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap() {
  await connectDB();
  startUploadCleanupScheduler();
  try {
    startSubtitleWorker();
  } catch (err: any) {
    console.warn("⚠️  BullMQ worker not started:", err.message);
  }

  const server = app.listen(config.port, () => {
    console.log(`✅ SubZI Server online at http://localhost:${config.port}`);
    console.log(`   Health:  http://localhost:${config.port}/health`);
    console.log(`   Upload:  POST http://localhost:${config.port}/api/upload`);
    console.log(`   Context: GET  http://localhost:${config.port}/api/context/glossary`);
  });

  return server;
}

if (process.env.NODE_ENV !== "test") {
  bootstrap().catch((err) => {
    console.error("💥 Bootstrap failed:", err);
    process.exit(1);
  });
}

export default app;