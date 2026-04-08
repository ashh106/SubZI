"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const config_1 = require("./config/config");
const db_1 = require("./utils/db");
const subtitleWorker_1 = require("./workers/subtitleWorker");
const uploadRoutes_1 = __importDefault(require("./routes/uploadRoutes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Routes
app.use("/api/upload", uploadRoutes_1.default);
// Health check
app.get("/health", (_req, res) => {
    res.json({
        status: "ok",
        message: "Video Subtitle Engine is running",
        timestamp: new Date().toISOString(),
        endpoints: {
            upload: "POST /api/upload            (multipart/form-data: video, language?)",
            status: "GET  /api/upload/:fileId/status",
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
        await (0, db_1.connectDB)();
    }
    catch (err) {
        console.warn("⚠️  MongoDB not available — DB features disabled. Start MongoDB to enable them.");
        console.warn("   Error:", err.message);
    }
    // Start BullMQ worker (non-fatal — needs Redis)
    try {
        (0, subtitleWorker_1.startSubtitleWorker)();
    }
    catch (err) {
        console.warn("⚠️  Worker failed to start — Redis may not be running.");
        console.warn("   Error:", err.message);
    }
    app.listen(config_1.config.port, () => {
        console.log(`✅ Server running on http://localhost:${config_1.config.port}`);
        console.log(`   Health:  http://localhost:${config_1.config.port}/health`);
        console.log(`   Upload:  POST http://localhost:${config_1.config.port}/api/upload`);
    });
}
bootstrap().catch((err) => {
    console.error("💥 Startup failed:", err);
    process.exit(1);
});
exports.default = app;
