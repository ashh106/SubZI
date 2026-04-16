import express from "express";
import cors from "cors";
import { config } from "./config/config";
import { connectDB } from "./utils/db";
import { startSubtitleWorker } from "./workers/subtitleWorker";
import uploadRoutes from "./routes/uploadRoutes";

const app = express();

app.use(cors({
  origin: config.corsOrigin === "*" ? "*" : config.corsOrigin.split(",").map(s => s.trim()),
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/upload", uploadRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Video Subtitle Engine is running",
    timestamp: new Date().toISOString(),
    endpoints: {
      upload:   "POST /api/upload            (multipart/form-data: video, language?)",
      status:   "GET  /api/upload/:fileId/status",
      download: "GET  /api/upload/:fileId/download/srt|vtt",
    },
  });
});

// /
app.get("/", (_req, res) => {
  res.send("🚀 Video Subtitle Engine API is running");
});

// 404
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});


// Startup
async function bootstrap() {
  // Connect MongoDB (non-fatal — server runs without it, but DB features won't work)
  try {
    await connectDB();
  } catch (err: any) {
    console.warn("⚠️  MongoDB not available — DB features disabled. Start MongoDB to enable them.");
    console.warn("   Error:", err.message);
  }

  // Start BullMQ worker (non-fatal — needs Redis)
  try {
    startSubtitleWorker();
  } catch (err: any) {
    console.warn("⚠️  Worker failed to start — Redis may not be running.");
    console.warn("   Error:", err.message);
  }

  app.listen(config.port, () => {
    console.log(`✅ Server running on http://localhost:${config.port}`);
    console.log(`   Health:  http://localhost:${config.port}/health`);
    console.log(`   Upload:  POST http://localhost:${config.port}/api/upload`);
  });
}

bootstrap().catch((err) => {
  console.error("💥 Startup failed:", err);
  process.exit(1);
});

export default app;