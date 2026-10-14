import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { JobRepository } from "../utils/jobRepository";
import { enqueueSubtitleJob } from "../queue/subtitleQueue";
import { config } from "../config/config";
import { generateAssFile, executeVideoBurn, parseSrtFile } from "../services/burnService";
import { parseSrtContent, toSRT, toVTT, toPlainText } from "../utils/subtitleFormat";
import { validateLocalWhisperModelRequest } from "../utils/localWhisperModel";

// ─── POST /api/upload ─────────────────────────────────────────────────────────
export const uploadVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded. Please attach a video file." });
      return;
    }

    const fileId = path.basename(req.file.filename, path.extname(req.file.filename));
    const sourceLanguage = (req.body.sourceLanguage as string) || "auto";
    const targetLanguage = (req.body.targetLanguage as string) || "en";
    const whisperModel = (req.body.whisperModel as string) || config.whisperModel;
    const localWhisperModelResult = validateLocalWhisperModelRequest(req.body);
    if (!localWhisperModelResult.valid) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (cleanupError) {
        console.error(`[Upload] Failed to remove rejected upload ${fileId}:`, cleanupError);
      }
      res.status(400).json({ error: "localWhisperModel must be one of: tiny, base, small, medium" });
      return;
    }
    const localWhisperModel = localWhisperModelResult.model;

    // Step 1: Save job record via resilient JobRepository
    try {
      await JobRepository.create({
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
    } catch (dbErr: any) {
      console.error("JobRepository save error:", dbErr.message);
      res.status(500).json({ error: "Failed to persist job record", detail: dbErr.message });
      return;
    }

    // Step 2: Enqueue job (dispatches to BullMQ when Redis is up, or in-process queue otherwise)
    try {
      await enqueueSubtitleJob({
        fileId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        sourceLanguage,
        targetLanguage,
        whisperModel,
        localWhisperModel,
      });
    } catch (queueErr: any) {
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
  } catch (error: any) {
    console.error("Upload handler error:", error);
    res.status(500).json({ error: "Upload failed", detail: error.message });
  }
};

// ─── GET /api/upload/:fileId/status ──────────────────────────────────────────
export const getJobStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params["fileId"] as string;
    const job = await JobRepository.findOne({ fileId });
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
      links:
        job.status === "completed"
          ? {
              srt: `/api/upload/${fileId}/download/srt`,
              vtt: `/api/upload/${fileId}/download/vtt`,
              text: `/api/upload/${fileId}/text`,
              burnedVideo: `/api/upload/${fileId}/burned`,
            }
          : undefined,
    });
  } catch (error: any) {
    res.status(500).json({ error: "Could not get job status", detail: error.message });
  }
};

// ─── GET /api/upload/:fileId/download/:format ─────────────────────────────────
export const downloadSubtitle = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params["fileId"] as string;
    const format = req.params["format"] as string;
    const job = await JobRepository.findOne({ fileId });

    if (!job || job.status !== "completed") {
      res.status(404).json({ error: "Subtitles not ready" });
      return;
    }

    const filePath = format === "vtt" ? job.vttPath : job.srtPath;
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ error: "Subtitle file not found on disk" });
      return;
    }

    const ext = format === "vtt" ? "vtt" : "srt";
    const base = path.basename(job.originalName, path.extname(job.originalName));
    res.setHeader("Content-Disposition", `attachment; filename="${base}.${ext}"`);
    res.setHeader("Content-Type", format === "vtt" ? "text/vtt" : "text/plain; charset=utf-8");
    fs.createReadStream(filePath).pipe(res);
  } catch (error: any) {
    res.status(500).json({ error: "Download failed", detail: error.message });
  }
};

// ─── GET /api/upload/:fileId/text ─────────────────────────────────────────────
export const getTranscriptText = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params["fileId"] as string;
    const job = await JobRepository.findOne({ fileId });

    if (!job || job.status !== "completed" || !job.srtPath || !fs.existsSync(job.srtPath)) {
      res.status(404).json({ error: "Subtitles not ready" });
      return;
    }

    const srtContent = fs.readFileSync(job.srtPath, "utf-8");
    const text = srtContent
      .split("\n")
      .filter((line) => line.trim() && !/^\d+$/.test(line.trim()) && !line.includes("-->"))
      .join("\n")
      .trim();

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(text);
  } catch (error: any) {
    res.status(500).json({ error: "Could not get transcript", detail: error.message });
  }
};

// ─── GET /api/upload/:fileId/subtitles.srt ────────────────────────────────────
export const serveSRT = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params["fileId"] as string;
    const job = await JobRepository.findOne({ fileId });
    if (!job?.srtPath || !fs.existsSync(job.srtPath)) {
      res.status(404).json({ error: "SRT not found" });
      return;
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    fs.createReadStream(job.srtPath).pipe(res);
  } catch {
    res.status(500).json({ error: "Failed to serve SRT" });
  }
};

// ─── GET /api/upload/:fileId/subtitles.vtt ────────────────────────────────────
export const serveVTT = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params["fileId"] as string;
    const job = await JobRepository.findOne({ fileId });
    if (!job?.vttPath || !fs.existsSync(job.vttPath)) {
      res.status(404).json({ error: "VTT not found" });
      return;
    }
    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    fs.createReadStream(job.vttPath).pipe(res);
  } catch {
    res.status(500).json({ error: "Failed to serve VTT" });
  }
};

// ─── POST /api/upload/:fileId/burn ────────────────────────────────────────────
export const burnSubtitles = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params["fileId"] as string;
    const job = await JobRepository.findOne({ fileId });

    const srtData = req.body.srtData as string | undefined;
    const styleData = req.body.style || {};
    const exportSettings = req.body.exportSettings || {};

    if (!job || job.status !== "completed") {
      res.status(400).json({ error: "Subtitles must be completed before burning into video" });
      return;
    }

    // Overwrite the SRT with frontend timeline edits if provided
    if (srtData && job.srtPath) {
      fs.writeFileSync(job.srtPath, srtData, "utf-8");
    } else if (!job.srtPath || !fs.existsSync(job.srtPath)) {
      res.status(404).json({ error: "SRT file not found" });
      return;
    }

    const videoPath = path.join(config.uploadsDir, job.filename);
    const outputPath = path.join(config.uploadsDir, `${fileId}_burned.mp4`);
    const assPath = path.join(config.uploadsDir, `${fileId}.ass`);

    // If cached burned video exists and NO edits or styling changes, return cached path
    if (!srtData && !req.body.style && job.burnedVideoPath && fs.existsSync(job.burnedVideoPath)) {
      res.json({
        message: "Burned video already ready",
        checkUrl: `/api/upload/${fileId}/burned`,
      });
      return;
    }

    // If new render requested, delete old output if present
    if (fs.existsSync(outputPath)) {
      try { fs.unlinkSync(outputPath); } catch {}
    }

    // Parse segments from updated SRT
    const segments = parseSrtFile(job.srtPath);

    // Generate ASS subtitle file for crisp, reliable FFmpeg burning
    generateAssFile(segments, styleData, assPath);

    await JobRepository.findOneAndUpdate(
      { fileId },
      {
        burnStatus: "processing",
        burnProgress: 10,
        burnedVideoPath: outputPath,
      }
    );

    // Send immediate response so client can poll
    res.json({
      message: "Subtitle burning in progress",
      checkUrl: `/api/upload/${fileId}/burned`,
    });

    // Run burn in background
    executeVideoBurn(videoPath, assPath, outputPath, exportSettings, async (progress) => {
      await JobRepository.findOneAndUpdate({ fileId }, { burnProgress: progress });
    })
      .then(async () => {
        await JobRepository.findOneAndUpdate({ fileId }, { burnStatus: "completed", burnProgress: 100, burnedVideoPath: outputPath });
        console.log(`[Burn] Successfully rendered burned video: ${outputPath}`);
      })
      .catch(async (err) => {
        await JobRepository.findOneAndUpdate({ fileId }, { burnStatus: "failed", errorMessage: err.message });
        console.error(`[Burn] Failed to burn subtitles:`, err.message);
      });
  } catch (error: any) {
    console.error("[Burn] Error:", error);
    res.status(500).json({ error: "Failed to initiate video burn", detail: error.message });
  }
};

// ─── GET /api/upload/:fileId/burned ───────────────────────────────────────────
export const downloadBurned = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params["fileId"] as string;
    const job = await JobRepository.findOne({ fileId });

    if (!job?.burnedVideoPath || job.burnStatus !== "completed") {
      res.status(404).json({ error: "Burned video is not ready yet. Please wait for processing to finish." });
      return;
    }

    if (!fs.existsSync(job.burnedVideoPath)) {
      res.status(404).json({ error: "Burned video file was not found on disk" });
      return;
    }

    const base = path.basename(job.originalName, path.extname(job.originalName));
    res.setHeader("Content-Disposition", `attachment; filename="${base}_subtitled.mp4"`);
    res.setHeader("Content-Type", "video/mp4");
    fs.createReadStream(job.burnedVideoPath).pipe(res);
  } catch (error: any) {
    res.status(500).json({ error: "Download failed", detail: error.message });
  }
};

// ─── GET /api/upload/:filename ───────────────────────────────────────────────
export const saveEditedSubtitles = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params["fileId"] as string;
    const job = await JobRepository.findOne({ fileId });
    if (!job || job.status !== "completed") {
      res.status(400).json({ error: "Job is not ready for subtitle edits" });
      return;
    }

    const srtData = req.body.srtData as string | undefined;
    if (!srtData) {
      res.status(400).json({ error: "srtData is required" });
      return;
    }

    const segments = parseSrtContent(srtData);
    if (segments.length === 0) {
      res.status(400).json({ error: "Could not parse subtitle segments" });
      return;
    }

    const srtPath = job.srtPath || path.join(config.uploadsDir, `${fileId}.srt`);
    const vttPath = job.vttPath || path.join(config.uploadsDir, `${fileId}.vtt`);
    const textPath = job.textPath || path.join(config.uploadsDir, `${fileId}.txt`);

    fs.writeFileSync(srtPath, toSRT(segments), "utf-8");
    fs.writeFileSync(vttPath, toVTT(segments), "utf-8");
    fs.writeFileSync(textPath, toPlainText(segments), "utf-8");

    await JobRepository.findOneAndUpdate(
      { fileId },
      { srtPath, vttPath, textPath, rawSegments: segments, burnStatus: "none" }
    );

    res.json({ success: true, segmentCount: segments.length });
  } catch (error: any) {
    res.status(500).json({ error: "Failed to save subtitles", detail: error.message });
  }
};

export const retryJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params["fileId"] as string;
    const job = await JobRepository.findOne({ fileId });
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    const videoPath = path.join(config.uploadsDir, job.filename);
    if (!fs.existsSync(videoPath)) {
      res.status(409).json({ error: "Source video is no longer on disk. Please upload again." });
      return;
    }

    await JobRepository.findOneAndUpdate(
      { fileId },
      {
        status: "pending",
        progress: 0,
        errorMessage: undefined,
        burnStatus: "none",
        burnProgress: 0,
      }
    );

    await enqueueSubtitleJob({
      fileId,
      filename: job.filename,
      originalName: job.originalName,
      sourceLanguage: job.sourceLanguage,
      targetLanguage: job.targetLanguage,
      whisperModel: job.whisperModel,
      localWhisperModel: job.localWhisperModel,
    });

    res.json({ success: true, fileId, status: "pending", message: "Job re-queued" });
  } catch (error: any) {
    res.status(500).json({ error: "Retry failed", detail: error.message });
  }
};

export const getFileInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const filename = req.params["filename"] as string;
    const filePath = path.join(config.uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    const stats = fs.statSync(filePath);
    res.json({ filename, size: stats.size, createdAt: stats.birthtime });
  } catch (error: any) {
    res.status(500).json({ error: "Could not get file info", detail: error.message });
  }
};