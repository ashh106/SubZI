"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFileInfo = exports.retryJob = exports.saveEditedSubtitles = exports.downloadBurned = exports.burnSubtitles = exports.serveVTT = exports.serveSRT = exports.getTranscriptText = exports.downloadSubtitle = exports.getJobStatus = exports.uploadVideo = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const jobRepository_1 = require("../utils/jobRepository");
const subtitleQueue_1 = require("../queue/subtitleQueue");
const config_1 = require("../config/config");
const burnService_1 = require("../services/burnService");
const subtitleFormat_1 = require("../utils/subtitleFormat");
const localWhisperModel_1 = require("../utils/localWhisperModel");
// ─── POST /api/upload ─────────────────────────────────────────────────────────
const uploadVideo = async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded. Please attach a video file." });
            return;
        }
        const fileId = path_1.default.basename(req.file.filename, path_1.default.extname(req.file.filename));
        const sourceLanguage = req.body.sourceLanguage || "auto";
        const targetLanguage = req.body.targetLanguage || "en";
        const whisperModel = req.body.whisperModel || config_1.config.whisperModel;
        const localWhisperModelResult = (0, localWhisperModel_1.validateLocalWhisperModelRequest)(req.body);
        if (!localWhisperModelResult.valid) {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch (cleanupError) {
                console.error(`[Upload] Failed to remove rejected upload ${fileId}:`, cleanupError);
            }
            res.status(400).json({ error: "localWhisperModel must be one of: tiny, base, small, medium" });
            return;
        }
        const localWhisperModel = localWhisperModelResult.model;
        // Step 1: Save job record via resilient JobRepository
        try {
            await jobRepository_1.JobRepository.create({
                fileId,
                originalName: req.file.originalname,
                filename: req.file.filename,
                mimetype: req.file.mimetype,
                sizeBytes: req.file.size,
                status: "pending",
                sourceLanguage,
                targetLanguage,
                whisperModel,
                localWhisperModel,
            });
        }
        catch (dbErr) {
            console.error("JobRepository save error:", dbErr.message);
            res.status(500).json({ error: "Failed to persist job record", detail: dbErr.message });
            return;
        }
        // Step 2: Enqueue job (dispatches to BullMQ when Redis is up, or in-process queue otherwise)
        try {
            await (0, subtitleQueue_1.enqueueSubtitleJob)({
                fileId,
                filename: req.file.filename,
                originalName: req.file.originalname,
                sourceLanguage,
                targetLanguage,
                whisperModel,
                localWhisperModel,
            });
        }
        catch (queueErr) {
            console.error("Queue enqueue error:", queueErr.message);
            res.status(500).json({ error: "Failed to schedule job", detail: queueErr.message });
            return;
        }
        console.log(`[Upload] Uploaded & scheduled: ${req.file.filename} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);
        res.status(202).json({
            success: true,
            message: "Video uploaded. Subtitle generation started.",
            fileId,
            status: "pending",
            sourceLanguage,
            targetLanguage,
            localWhisperModel,
            links: {
                status: `/api/upload/${fileId}/status`,
                srt: `/api/upload/${fileId}/download/srt`,
                vtt: `/api/upload/${fileId}/download/vtt`,
                text: `/api/upload/${fileId}/text`,
                burn: `/api/upload/${fileId}/burn`,
                burnedVideo: `/api/upload/${fileId}/burned`,
            },
        });
    }
    catch (error) {
        console.error("Upload handler error:", error);
        res.status(500).json({ error: "Upload failed", detail: error.message });
    }
};
exports.uploadVideo = uploadVideo;
// ─── GET /api/upload/:fileId/status ──────────────────────────────────────────
const getJobStatus = async (req, res) => {
    try {
        const fileId = req.params["fileId"];
        const job = await jobRepository_1.JobRepository.findOne({ fileId });
        if (!job) {
            res.status(404).json({ error: "Job not found" });
            return;
        }
        res.json({
            fileId: job.fileId,
            status: job.status,
            progress: job.progress,
            burnStatus: job.burnStatus,
            burnProgress: job.burnProgress,
            originalName: job.originalName,
            sourceLanguage: job.sourceLanguage,
            detectedLanguage: job.detectedLanguage,
            targetLanguage: job.targetLanguage,
            whisperModel: job.whisperModel,
            localWhisperModel: job.localWhisperModel,
            keywords: job.keywords || [],
            uploadedAt: job.uploadedAt,
            startedAt: job.startedAt,
            completedAt: job.completedAt,
            errorMessage: job.errorMessage,
            ragApplied: job.ragApplied || false,
            ragSuggestionsCount: job.ragSuggestions?.length || 0,
            links: job.status === "completed"
                ? {
                    srt: `/api/upload/${fileId}/download/srt`,
                    vtt: `/api/upload/${fileId}/download/vtt`,
                    text: `/api/upload/${fileId}/text`,
                    burnedVideo: `/api/upload/${fileId}/burned`,
                }
                : undefined,
        });
    }
    catch (error) {
        res.status(500).json({ error: "Could not get job status", detail: error.message });
    }
};
exports.getJobStatus = getJobStatus;
// ─── GET /api/upload/:fileId/download/:format ─────────────────────────────────
const downloadSubtitle = async (req, res) => {
    try {
        const fileId = req.params["fileId"];
        const format = req.params["format"];
        const job = await jobRepository_1.JobRepository.findOne({ fileId });
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
        res.status(500).json({ error: "Download failed", detail: error.message });
    }
};
exports.downloadSubtitle = downloadSubtitle;
// ─── GET /api/upload/:fileId/text ─────────────────────────────────────────────
const getTranscriptText = async (req, res) => {
    try {
        const fileId = req.params["fileId"];
        const job = await jobRepository_1.JobRepository.findOne({ fileId });
        if (!job || job.status !== "completed" || !job.srtPath || !fs_1.default.existsSync(job.srtPath)) {
            res.status(404).json({ error: "Subtitles not ready" });
            return;
        }
        const srtContent = fs_1.default.readFileSync(job.srtPath, "utf-8");
        const text = srtContent
            .split("\n")
            .filter((line) => line.trim() && !/^\d+$/.test(line.trim()) && !line.includes("-->"))
            .join("\n")
            .trim();
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.send(text);
    }
    catch (error) {
        res.status(500).json({ error: "Could not get transcript", detail: error.message });
    }
};
exports.getTranscriptText = getTranscriptText;
// ─── GET /api/upload/:fileId/subtitles.srt ────────────────────────────────────
const serveSRT = async (req, res) => {
    try {
        const fileId = req.params["fileId"];
        const job = await jobRepository_1.JobRepository.findOne({ fileId });
        if (!job?.srtPath || !fs_1.default.existsSync(job.srtPath)) {
            res.status(404).json({ error: "SRT not found" });
            return;
        }
        res.setHeader("Content-Type", "text/plain; charset=utf-8");
        res.setHeader("Access-Control-Allow-Origin", "*");
        fs_1.default.createReadStream(job.srtPath).pipe(res);
    }
    catch {
        res.status(500).json({ error: "Failed to serve SRT" });
    }
};
exports.serveSRT = serveSRT;
// ─── GET /api/upload/:fileId/subtitles.vtt ────────────────────────────────────
const serveVTT = async (req, res) => {
    try {
        const fileId = req.params["fileId"];
        const job = await jobRepository_1.JobRepository.findOne({ fileId });
        if (!job?.vttPath || !fs_1.default.existsSync(job.vttPath)) {
            res.status(404).json({ error: "VTT not found" });
            return;
        }
        res.setHeader("Content-Type", "text/vtt; charset=utf-8");
        res.setHeader("Access-Control-Allow-Origin", "*");
        fs_1.default.createReadStream(job.vttPath).pipe(res);
    }
    catch {
        res.status(500).json({ error: "Failed to serve VTT" });
    }
};
exports.serveVTT = serveVTT;
// ─── POST /api/upload/:fileId/burn ────────────────────────────────────────────
const burnSubtitles = async (req, res) => {
    try {
        const fileId = req.params["fileId"];
        const job = await jobRepository_1.JobRepository.findOne({ fileId });
        const srtData = req.body.srtData;
        const styleData = req.body.style || {};
        const exportSettings = req.body.exportSettings || {};
        if (!job || job.status !== "completed") {
            res.status(400).json({ error: "Subtitles must be completed before burning into video" });
            return;
        }
        // Overwrite the SRT with frontend timeline edits if provided
        if (srtData && job.srtPath) {
            fs_1.default.writeFileSync(job.srtPath, srtData, "utf-8");
        }
        else if (!job.srtPath || !fs_1.default.existsSync(job.srtPath)) {
            res.status(404).json({ error: "SRT file not found" });
            return;
        }
        const videoPath = path_1.default.join(config_1.config.uploadsDir, job.filename);
        const outputPath = path_1.default.join(config_1.config.uploadsDir, `${fileId}_burned.mp4`);
        const assPath = path_1.default.join(config_1.config.uploadsDir, `${fileId}.ass`);
        // If cached burned video exists and NO edits or styling changes, return cached path
        if (!srtData && !req.body.style && job.burnedVideoPath && fs_1.default.existsSync(job.burnedVideoPath)) {
            res.json({
                message: "Burned video already ready",
                checkUrl: `/api/upload/${fileId}/burned`,
            });
            return;
        }
        // If new render requested, delete old output if present
        if (fs_1.default.existsSync(outputPath)) {
            try {
                fs_1.default.unlinkSync(outputPath);
            }
            catch { }
        }
        // Parse segments from updated SRT
        const segments = (0, burnService_1.parseSrtFile)(job.srtPath);
        // Generate ASS subtitle file for crisp, reliable FFmpeg burning
        (0, burnService_1.generateAssFile)(segments, styleData, assPath);
        await jobRepository_1.JobRepository.findOneAndUpdate({ fileId }, {
            burnStatus: "processing",
            burnProgress: 10,
            burnedVideoPath: outputPath,
        });
        // Send immediate response so client can poll
        res.json({
            message: "Subtitle burning in progress",
            checkUrl: `/api/upload/${fileId}/burned`,
        });
        // Run burn in background
        (0, burnService_1.executeVideoBurn)(videoPath, assPath, outputPath, exportSettings, async (progress) => {
            await jobRepository_1.JobRepository.findOneAndUpdate({ fileId }, { burnProgress: progress });
        })
            .then(async () => {
            await jobRepository_1.JobRepository.findOneAndUpdate({ fileId }, { burnStatus: "completed", burnProgress: 100, burnedVideoPath: outputPath });
            console.log(`[Burn] Successfully rendered burned video: ${outputPath}`);
        })
            .catch(async (err) => {
            await jobRepository_1.JobRepository.findOneAndUpdate({ fileId }, { burnStatus: "failed", errorMessage: err.message });
            console.error(`[Burn] Failed to burn subtitles:`, err.message);
        });
    }
    catch (error) {
        console.error("[Burn] Error:", error);
        res.status(500).json({ error: "Failed to initiate video burn", detail: error.message });
    }
};
exports.burnSubtitles = burnSubtitles;
// ─── GET /api/upload/:fileId/burned ───────────────────────────────────────────
const downloadBurned = async (req, res) => {
    try {
        const fileId = req.params["fileId"];
        const job = await jobRepository_1.JobRepository.findOne({ fileId });
        if (!job?.burnedVideoPath || job.burnStatus !== "completed") {
            res.status(404).json({ error: "Burned video is not ready yet. Please wait for processing to finish." });
            return;
        }
        if (!fs_1.default.existsSync(job.burnedVideoPath)) {
            res.status(404).json({ error: "Burned video file was not found on disk" });
            return;
        }
        const base = path_1.default.basename(job.originalName, path_1.default.extname(job.originalName));
        res.setHeader("Content-Disposition", `attachment; filename="${base}_subtitled.mp4"`);
        res.setHeader("Content-Type", "video/mp4");
        fs_1.default.createReadStream(job.burnedVideoPath).pipe(res);
    }
    catch (error) {
        res.status(500).json({ error: "Download failed", detail: error.message });
    }
};
exports.downloadBurned = downloadBurned;
// ─── GET /api/upload/:filename ───────────────────────────────────────────────
const saveEditedSubtitles = async (req, res) => {
    try {
        const fileId = req.params["fileId"];
        const job = await jobRepository_1.JobRepository.findOne({ fileId });
        if (!job || job.status !== "completed") {
            res.status(400).json({ error: "Job is not ready for subtitle edits" });
            return;
        }
        const srtData = req.body.srtData;
        if (!srtData) {
            res.status(400).json({ error: "srtData is required" });
            return;
        }
        const segments = (0, subtitleFormat_1.parseSrtContent)(srtData);
        if (segments.length === 0) {
            res.status(400).json({ error: "Could not parse subtitle segments" });
            return;
        }
        const srtPath = job.srtPath || path_1.default.join(config_1.config.uploadsDir, `${fileId}.srt`);
        const vttPath = job.vttPath || path_1.default.join(config_1.config.uploadsDir, `${fileId}.vtt`);
        const textPath = job.textPath || path_1.default.join(config_1.config.uploadsDir, `${fileId}.txt`);
        fs_1.default.writeFileSync(srtPath, (0, subtitleFormat_1.toSRT)(segments), "utf-8");
        fs_1.default.writeFileSync(vttPath, (0, subtitleFormat_1.toVTT)(segments), "utf-8");
        fs_1.default.writeFileSync(textPath, (0, subtitleFormat_1.toPlainText)(segments), "utf-8");
        await jobRepository_1.JobRepository.findOneAndUpdate({ fileId }, { srtPath, vttPath, textPath, rawSegments: segments, burnStatus: "none" });
        res.json({ success: true, segmentCount: segments.length });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to save subtitles", detail: error.message });
    }
};
exports.saveEditedSubtitles = saveEditedSubtitles;
const retryJob = async (req, res) => {
    try {
        const fileId = req.params["fileId"];
        const job = await jobRepository_1.JobRepository.findOne({ fileId });
        if (!job) {
            res.status(404).json({ error: "Job not found" });
            return;
        }
        const videoPath = path_1.default.join(config_1.config.uploadsDir, job.filename);
        if (!fs_1.default.existsSync(videoPath)) {
            res.status(409).json({ error: "Source video is no longer on disk. Please upload again." });
            return;
        }
        await jobRepository_1.JobRepository.findOneAndUpdate({ fileId }, {
            status: "pending",
            progress: 0,
            errorMessage: undefined,
            burnStatus: "none",
            burnProgress: 0,
        });
        await (0, subtitleQueue_1.enqueueSubtitleJob)({
            fileId,
            filename: job.filename,
            originalName: job.originalName,
            sourceLanguage: job.sourceLanguage,
            targetLanguage: job.targetLanguage,
            whisperModel: job.whisperModel,
            localWhisperModel: job.localWhisperModel,
        });
        res.json({ success: true, fileId, status: "pending", message: "Job re-queued" });
    }
    catch (error) {
        res.status(500).json({ error: "Retry failed", detail: error.message });
    }
};
exports.retryJob = retryJob;
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
        res.status(500).json({ error: "Could not get file info", detail: error.message });
    }
};
exports.getFileInfo = getFileInfo;
