"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFileInfo = exports.downloadBurned = exports.burnSubtitles = exports.serveVTT = exports.serveSRT = exports.getTranscriptText = exports.downloadSubtitle = exports.getJobStatus = exports.uploadVideo = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const subtitleJobModel_1 = require("../utils/subtitleJobModel");
const subtitleQueue_1 = require("../queue/subtitleQueue");
const config_1 = require("../config/config");
const TRANSCRIBE_SCRIPT = path_1.default.join(__dirname, "../workers/transcribe.py");
// ─── POST /api/upload ─────────────────────────────────────────────────────────
const uploadVideo = async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }
        const fileId = path_1.default.basename(req.file.filename, path_1.default.extname(req.file.filename));
        const sourceLanguage = req.body.sourceLanguage || "auto";
        const targetLanguage = req.body.targetLanguage || "en";
        const whisperModel = req.body.whisperModel || config_1.config.whisperModel;
        await subtitleJobModel_1.SubtitleJob.create({
            fileId,
            originalName: req.file.originalname,
            filename: req.file.filename,
            mimetype: req.file.mimetype,
            sizeBytes: req.file.size,
            status: "pending",
            sourceLanguage,
            targetLanguage,
        });
        await (0, subtitleQueue_1.enqueueSubtitleJob)({ fileId, filename: req.file.filename, originalName: req.file.originalname, sourceLanguage, targetLanguage, whisperModel });
        console.log(`✅ Uploaded & queued: ${req.file.filename} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
        res.status(202).json({
            success: true,
            message: "Video uploaded. Subtitle generation started.",
            fileId,
            status: "pending",
            sourceLanguage,
            targetLanguage,
            links: {
                status: `/api/upload/${fileId}/status`,
                srt: `/api/upload/${fileId}/download/srt`,
                vtt: `/api/upload/${fileId}/download/vtt`,
                text: `/api/upload/${fileId}/text`,
                burnedVideo: `/api/upload/${fileId}/burn`,
            },
        });
    }
    catch (error) {
        console.error("Upload error:", error);
        res.status(500).json({ error: "Upload failed" });
    }
};
exports.uploadVideo = uploadVideo;
// ─── GET /api/upload/:fileId/status ──────────────────────────────────────────
const getJobStatus = async (req, res) => {
    try {
        const fileId = req.params["fileId"];
        const job = await subtitleJobModel_1.SubtitleJob.findOne({ fileId });
        if (!job) {
            res.status(404).json({ error: "Job not found" });
            return;
        }
        res.json({
            fileId: job.fileId,
            status: job.status,
            originalName: job.originalName,
            sourceLanguage: job.sourceLanguage,
            detectedLanguage: job.detectedLanguage,
            targetLanguage: job.targetLanguage,
            uploadedAt: job.uploadedAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            errorMessage: job.errorMessage,
            links: job.status === "completed" ? {
                srt: `/api/upload/${fileId}/download/srt`,
                vtt: `/api/upload/${fileId}/download/vtt`,
                text: `/api/upload/${fileId}/text`,
                burnedVideo: `/api/upload/${fileId}/burn`,
            } : undefined,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Could not get job status" });
    }
};
exports.getJobStatus = getJobStatus;
// ─── GET /api/upload/:fileId/download/:format  (attachment) ──────────────────
const downloadSubtitle = async (req, res) => {
    try {
        const fileId = req.params["fileId"];
        const format = req.params["format"];
        const job = await subtitleJobModel_1.SubtitleJob.findOne({ fileId });
        if (!job || job.status !== "completed") {
            res.status(404).json({ error: "Subtitles not ready" });
            return;
        }
        const filePath = format === "vtt" ? job.vttPath : job.srtPath;
        if (!filePath || !fs_1.default.existsSync(filePath)) {
            res.status(404).json({ error: "Subtitle file not found on disk" });
            return;
        }
        const ext = format === "vtt" ? "vtt" : "srt";
        const base = path_1.default.basename(job.originalName, path_1.default.extname(job.originalName));
        res.setHeader("Content-Disposition", `attachment; filename="${base}.${ext}"`);
        res.setHeader("Content-Type", format === "vtt" ? "text/vtt" : "text/plain; charset=utf-8");
        fs_1.default.createReadStream(filePath).pipe(res);
    }
    catch (error) {
        res.status(500).json({ error: "Download failed" });
    }
};
exports.downloadSubtitle = downloadSubtitle;
// ─── GET /api/upload/:fileId/text  (plain transcript) ────────────────────────
const getTranscriptText = async (req, res) => {
    try {
        const fileId = req.params["fileId"];
        const job = await subtitleJobModel_1.SubtitleJob.findOne({ fileId });
        if (!job || job.status !== "completed" || !job.srtPath) {
            res.status(404).json({ error: "Subtitles not ready" });
            return;
        }
        const srtContent = fs_1.default.readFileSync(job.srtPath, "utf-8");
        // Strip SRT indices and timestamps → just the text lines
        const text = srtContent
            .split("\n")
            .filter(line => line.trim() && !/^\d+$/.test(line.trim()) && !line.includes("-->"))
            .join("\n")
            .trim();
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.send(text);
    }
    catch (error) {
        res.status(500).json({ error: "Could not get transcript" });
    }
};
exports.getTranscriptText = getTranscriptText;
// ─── GET /api/upload/:fileId/subtitles.srt  (inline, for frontend preview) ───
const serveSRT = async (req, res) => {
    try {
        const fileId = req.params["fileId"];
        const job = await subtitleJobModel_1.SubtitleJob.findOne({ fileId });
        if (!job?.srtPath || !fs_1.default.existsSync(job.srtPath)) {
            res.status(404).json({ error: "SRT not found" });
            return;
        }
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Access-Control-Allow-Origin", "*");
        fs_1.default.createReadStream(job.srtPath).pipe(res);
    }
    catch {
        res.status(500).json({ error: "Failed" });
    }
};
exports.serveSRT = serveSRT;
// ─── GET /api/upload/:fileId/subtitles.vtt  (for HTML5 <track> element) ──────
const serveVTT = async (req, res) => {
    try {
        const fileId = req.params["fileId"];
        const job = await subtitleJobModel_1.SubtitleJob.findOne({ fileId });
        if (!job?.vttPath || !fs_1.default.existsSync(job.vttPath)) {
            res.status(404).json({ error: "VTT not found" });
            return;
        }
        res.setHeader("Content-Type", "text/vtt; charset=utf-8");
        res.setHeader("Access-Control-Allow-Origin", "*");
        fs_1.default.createReadStream(job.vttPath).pipe(res);
    }
    catch {
        res.status(500).json({ error: "Failed" });
    }
};
exports.serveVTT = serveVTT;
// ─── POST /api/upload/:fileId/burn  (burn subtitles into video) ──────────────
const burnSubtitles = async (req, res) => {
    try {
        const fileId = req.params["fileId"];
        const job = await subtitleJobModel_1.SubtitleJob.findOne({ fileId });
        if (!job || job.status !== "completed") {
            res.status(400).json({ error: "Subtitles must be completed first" });
            return;
        }
        if (!job.srtPath || !fs_1.default.existsSync(job.srtPath)) {
            res.status(404).json({ error: "SRT file not found" });
            return;
        }
        // If already burned, return existing
        if (job.burnedVideoPath && fs_1.default.existsSync(job.burnedVideoPath)) {
            res.setHeader("Content-Disposition", `attachment; filename="${path_1.default.basename(job.burnedVideoPath)}"`);
            res.setHeader("Content-Type", "video/mp4");
            fs_1.default.createReadStream(job.burnedVideoPath).pipe(res);
            return;
        }
        const videoPath = path_1.default.join(config_1.config.uploadsDir, job.filename);
        const outputPath = path_1.default.join(config_1.config.uploadsDir, `${fileId}_burned.mp4`);
        // Escape Windows path for FFmpeg subtitles filter
        const srtEscaped = job.srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");
        res.json({
            message: "Burning subtitles started. This may take a few minutes.",
            checkUrl: `/api/upload/${fileId}/burned`,
        });
        // Run FFmpeg in background (don't block the response)
        const ffmpegProc = (0, child_process_1.spawn)("ffmpeg", [
            "-i", videoPath,
            "-vf", `subtitles='${srtEscaped}'`,
            "-c:a", "copy",
            "-y", outputPath,
        ]);
        ffmpegProc.on("close", async (code) => {
            if (code === 0) {
                await subtitleJobModel_1.SubtitleJob.findOneAndUpdate({ fileId }, { burnedVideoPath: outputPath });
                console.log(`[Burn] Done: ${outputPath}`);
            }
            else {
                console.error(`[Burn] FFmpeg failed with code ${code}`);
            }
        });
    }
    catch (error) {
        res.status(500).json({ error: "Burn failed" });
    }
};
exports.burnSubtitles = burnSubtitles;
// ─── GET /api/upload/:fileId/burned  (download burned video) ─────────────────
const downloadBurned = async (req, res) => {
    try {
        const fileId = req.params["fileId"];
        const job = await subtitleJobModel_1.SubtitleJob.findOne({ fileId });
        if (!job?.burnedVideoPath) {
            res.status(404).json({ error: "Burned video not ready yet — check back in a minute" });
            return;
        }
        if (!fs_1.default.existsSync(job.burnedVideoPath)) {
            res.status(404).json({ error: "Burned video file not found on disk" });
            return;
        }
        const base = path_1.default.basename(job.originalName, path_1.default.extname(job.originalName));
        res.setHeader("Content-Disposition", `attachment; filename="${base}_subtitled.mp4"`);
        res.setHeader("Content-Type", "video/mp4");
        fs_1.default.createReadStream(job.burnedVideoPath).pipe(res);
    }
    catch (error) {
        res.status(500).json({ error: "Download failed" });
    }
};
exports.downloadBurned = downloadBurned;
// ─── GET /api/upload/:filename  (legacy raw file info) ───────────────────────
const getFileInfo = async (req, res) => {
    try {
        const filename = req.params["filename"];
        const filePath = path_1.default.join(config_1.config.uploadsDir, filename);
        if (!fs_1.default.existsSync(filePath)) {
            res.status(404).json({ error: "File not found" });
            return;
        }
        const stats = fs_1.default.statSync(filePath);
        res.json({ filename, size: stats.size, createdAt: stats.birthtime });
    }
    catch (error) {
        res.status(500).json({ error: "Could not get file info" });
    }
};
exports.getFileInfo = getFileInfo;
