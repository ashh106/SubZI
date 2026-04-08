import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { SubtitleJob } from "../utils/subtitleJobModel";
import { enqueueSubtitleJob } from "../queue/subtitleQueue";
import { config } from "../config/config";

const TRANSCRIBE_SCRIPT = path.join(__dirname, "../workers/transcribe.py");

// ─── POST /api/upload ─────────────────────────────────────────────────────────
export const uploadVideo = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const fileId        = path.basename(req.file.filename, path.extname(req.file.filename));
    const sourceLanguage = (req.body.sourceLanguage as string) || "auto";
    const targetLanguage = (req.body.targetLanguage as string) || "en";

    await SubtitleJob.create({
      fileId,
      originalName:  req.file.originalname,
      filename:      req.file.filename,
      mimetype:      req.file.mimetype,
      sizeBytes:     req.file.size,
      status:       "pending",
      sourceLanguage,
      targetLanguage,
    });

    await enqueueSubtitleJob({ fileId, filename: req.file.filename, originalName: req.file.originalname, sourceLanguage, targetLanguage });

    console.log(`✅ Uploaded & queued: ${req.file.filename} (${(req.file.size / 1024 / 1024).toFixed(2)} MB)`);

    res.status(202).json({
      success: true,
      message: "Video uploaded. Subtitle generation started.",
      fileId,
      status: "pending",
      sourceLanguage,
      targetLanguage,
      links: {
        status:   `/api/upload/${fileId}/status`,
        srt:      `/api/upload/${fileId}/download/srt`,
        vtt:      `/api/upload/${fileId}/download/vtt`,
        text:     `/api/upload/${fileId}/text`,
        burnedVideo: `/api/upload/${fileId}/burn`,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
};

// ─── GET /api/upload/:fileId/status ──────────────────────────────────────────
export const getJobStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params["fileId"] as string;
    const job = await SubtitleJob.findOne({ fileId });
    if (!job) { res.status(404).json({ error: "Job not found" }); return; }

    res.json({
      fileId:           job.fileId,
      status:           job.status,
      originalName:     job.originalName,
      sourceLanguage:   job.sourceLanguage,
      detectedLanguage: job.detectedLanguage,
      targetLanguage:   job.targetLanguage,
      uploadedAt:       job.uploadedAt,
      startedAt:        job.startedAt,
      completedAt:      job.completedAt,
      errorMessage:     job.errorMessage,
      links: job.status === "completed" ? {
        srt:         `/api/upload/${fileId}/download/srt`,
        vtt:         `/api/upload/${fileId}/download/vtt`,
        text:        `/api/upload/${fileId}/text`,
        burnedVideo: `/api/upload/${fileId}/burn`,
      } : undefined,
    });
  } catch (error) {
    res.status(500).json({ error: "Could not get job status" });
  }
};

// ─── GET /api/upload/:fileId/download/:format  (attachment) ──────────────────
export const downloadSubtitle = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId  = req.params["fileId"] as string;
    const format  = req.params["format"] as string;
    const job     = await SubtitleJob.findOne({ fileId });

    if (!job || job.status !== "completed") {
      res.status(404).json({ error: "Subtitles not ready" }); return;
    }

    const filePath = format === "vtt" ? job.vttPath : job.srtPath;
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ error: "Subtitle file not found on disk" }); return;
    }

    const ext  = format === "vtt" ? "vtt" : "srt";
    const base = path.basename(job.originalName, path.extname(job.originalName));
    res.setHeader("Content-Disposition", `attachment; filename="${base}.${ext}"`);
    res.setHeader("Content-Type", format === "vtt" ? "text/vtt" : "text/plain; charset=utf-8");
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    res.status(500).json({ error: "Download failed" });
  }
};

// ─── GET /api/upload/:fileId/text  (plain transcript) ────────────────────────
export const getTranscriptText = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params["fileId"] as string;
    const job    = await SubtitleJob.findOne({ fileId });

    if (!job || job.status !== "completed" || !job.srtPath) {
      res.status(404).json({ error: "Subtitles not ready" }); return;
    }

    const srtContent = fs.readFileSync(job.srtPath, "utf-8");
    // Strip SRT indices and timestamps → just the text lines
    const text = srtContent
      .split("\n")
      .filter(line => line.trim() && !/^\d+$/.test(line.trim()) && !line.includes("-->"))
      .join("\n")
      .trim();

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(text);
  } catch (error) {
    res.status(500).json({ error: "Could not get transcript" });
  }
};

// ─── GET /api/upload/:fileId/subtitles.srt  (inline, for frontend preview) ───
export const serveSRT = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params["fileId"] as string;
    const job    = await SubtitleJob.findOne({ fileId });
    if (!job?.srtPath || !fs.existsSync(job.srtPath)) {
      res.status(404).json({ error: "SRT not found" }); return;
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    fs.createReadStream(job.srtPath).pipe(res);
  } catch { res.status(500).json({ error: "Failed" }); }
};

// ─── GET /api/upload/:fileId/subtitles.vtt  (for HTML5 <track> element) ──────
export const serveVTT = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params["fileId"] as string;
    const job    = await SubtitleJob.findOne({ fileId });
    if (!job?.vttPath || !fs.existsSync(job.vttPath)) {
      res.status(404).json({ error: "VTT not found" }); return;
    }
    res.setHeader("Content-Type", "text/vtt; charset=utf-8");
    res.setHeader("Access-Control-Allow-Origin", "*");
    fs.createReadStream(job.vttPath).pipe(res);
  } catch { res.status(500).json({ error: "Failed" }); }
};

// ─── POST /api/upload/:fileId/burn  (burn subtitles into video) ──────────────
export const burnSubtitles = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params["fileId"] as string;
    const job    = await SubtitleJob.findOne({ fileId });

    if (!job || job.status !== "completed") {
      res.status(400).json({ error: "Subtitles must be completed first" }); return;
    }

    if (!job.srtPath || !fs.existsSync(job.srtPath)) {
      res.status(404).json({ error: "SRT file not found" }); return;
    }

    // If already burned, return existing
    if (job.burnedVideoPath && fs.existsSync(job.burnedVideoPath)) {
      res.setHeader("Content-Disposition", `attachment; filename="${path.basename(job.burnedVideoPath)}"`);
      res.setHeader("Content-Type", "video/mp4");
      fs.createReadStream(job.burnedVideoPath).pipe(res);
      return;
    }

    const videoPath  = path.join(config.uploadsDir, job.filename);
    const outputPath = path.join(config.uploadsDir, `${fileId}_burned.mp4`);
    // Escape Windows path for FFmpeg subtitles filter
    const srtEscaped = job.srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");

    res.json({
      message: "Burning subtitles started. This may take a few minutes.",
      checkUrl: `/api/upload/${fileId}/burned`,
    });

    // Run FFmpeg in background (don't block the response)
    const ffmpegProc = spawn("ffmpeg", [
      "-i", videoPath,
      "-vf", `subtitles='${srtEscaped}'`,
      "-c:a", "copy",
      "-y", outputPath,
    ]);

    ffmpegProc.on("close", async (code) => {
      if (code === 0) {
        await SubtitleJob.findOneAndUpdate({ fileId }, { burnedVideoPath: outputPath });
        console.log(`[Burn] Done: ${outputPath}`);
      } else {
        console.error(`[Burn] FFmpeg failed with code ${code}`);
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Burn failed" });
  }
};

// ─── GET /api/upload/:fileId/burned  (download burned video) ─────────────────
export const downloadBurned = async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params["fileId"] as string;
    const job    = await SubtitleJob.findOne({ fileId });

    if (!job?.burnedVideoPath) {
      res.status(404).json({ error: "Burned video not ready yet — check back in a minute" }); return;
    }
    if (!fs.existsSync(job.burnedVideoPath)) {
      res.status(404).json({ error: "Burned video file not found on disk" }); return;
    }

    const base = path.basename(job.originalName, path.extname(job.originalName));
    res.setHeader("Content-Disposition", `attachment; filename="${base}_subtitled.mp4"`);
    res.setHeader("Content-Type", "video/mp4");
    fs.createReadStream(job.burnedVideoPath).pipe(res);
  } catch (error) {
    res.status(500).json({ error: "Download failed" });
  }
};

// ─── GET /api/upload/:filename  (legacy raw file info) ───────────────────────
export const getFileInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const filename = req.params["filename"] as string;
    const filePath = path.join(config.uploadsDir, filename);
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: "File not found" }); return; }
    const stats = fs.statSync(filePath);
    res.json({ filename, size: stats.size, createdAt: stats.birthtime });
  } catch (error) {
    res.status(500).json({ error: "Could not get file info" });
  }
};