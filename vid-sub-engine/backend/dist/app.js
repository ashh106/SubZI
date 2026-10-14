"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("./config/config");
const db_1 = require("./utils/db");
const subtitleWorker_1 = require("./workers/subtitleWorker");
const redisConnection_1 = require("./utils/redisConnection");
const transcription_1 = require("./services/transcription");
const fileCleanup_1 = require("./utils/fileCleanup");
const uploadRoutes_1 = __importDefault(require("./routes/uploadRoutes"));
const contextRoutes_1 = __importDefault(require("./routes/contextRoutes"));
const app = (0, express_1.default)();
// Ensure uploads folder exists
if (!fs_1.default.existsSync(config_1.config.uploadsDir)) {
    fs_1.default.mkdirSync(config_1.config.uploadsDir, { recursive: true });
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
    ...config_1.config.corsOrigin.split(",").map((s) => s.trim()),
].filter(Boolean);
app.use((0, cors_1.default)({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or Postman)
        if (!origin)
            return callback(null, true);
        if (config_1.config.corsOrigin === "*" ||
            allowedOrigins.includes(origin) ||
            origin.endsWith(".vercel.app")) {
            return callback(null, true);
        }
        return callback(null, true); // Permissive for public API / frontend demos
    },
    credentials: true,
}));
app.use(express_1.default.json({ limit: "15mb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "15mb" }));
// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/upload", uploadRoutes_1.default);
app.use("/api/context", contextRoutes_1.default);
// Health check handler
const handleHealth = (_req, res) => {
    res.json({
        status: "ok",
        message: "SubZI Video Subtitle Engine is operational",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
        services: {
            database: (0, db_1.isDbConnected)() ? "MongoDB Atlas (Connected)" : "In-Memory Store (Active)",
            queue: (0, redisConnection_1.isRedisConfigured)() ? "BullMQ / Redis (Configured)" : "In-Process Queue (Active)",
            transcriptionProviders: transcription_1.transcriptionService.getAvailableProviders(),
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
    await (0, db_1.connectDB)();
    (0, fileCleanup_1.startUploadCleanupScheduler)();
    try {
        (0, subtitleWorker_1.startSubtitleWorker)();
    }
    catch (err) {
        console.warn("⚠️  BullMQ worker not started:", err.message);
    }
    const server = app.listen(config_1.config.port, () => {
        console.log(`✅ SubZI Server online at http://localhost:${config_1.config.port}`);
        console.log(`   Health:  http://localhost:${config_1.config.port}/health`);
        console.log(`   Upload:  POST http://localhost:${config_1.config.port}/api/upload`);
        console.log(`   Context: GET  http://localhost:${config_1.config.port}/api/context/glossary`);
    });
    return server;
}
if (process.env.NODE_ENV !== "test") {
    bootstrap().catch((err) => {
        console.error("💥 Bootstrap failed:", err);
        process.exit(1);
    });
}
exports.default = app;
