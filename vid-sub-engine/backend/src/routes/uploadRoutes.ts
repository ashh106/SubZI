import { Router } from "express";
import { upload } from "../services/uploadService";
import {
  uploadVideo,
  getJobStatus,
  downloadSubtitle,
  getTranscriptText,
  serveSRT,
  serveVTT,
  burnSubtitles,
  downloadBurned,
  saveEditedSubtitles,
  retryJob,
  getFileInfo,
} from "../controllers/uploadController";

const router = Router();

function handleMulter(req: any, res: any, next: any) {
  upload.single("video")(req, res, (err: any) => {
    if (err) {
      const message = err.code === "LIMIT_FILE_SIZE" ? "File exceeds the configured size limit" : err.message;
      res.status(400).json({ error: message });
      return;
    }
    next();
  });
}

// ── Upload ────────────────────────────────────────────────────────────────────
// POST /api/upload
// Form fields: video (file), sourceLanguage? (default: auto), targetLanguage? (default: en)
router.post("/", handleMulter, uploadVideo);

// ── Job status ────────────────────────────────────────────────────────────────
// GET /api/upload/:fileId/status
router.get("/:fileId/status", getJobStatus);

// ── Download subtitle files (as attachment) ───────────────────────────────────
// GET /api/upload/:fileId/download/srt
// GET /api/upload/:fileId/download/vtt
router.get("/:fileId/download/:format", downloadSubtitle);

// ── Inline serving (for frontend player / <track> element) ───────────────────
// GET /api/upload/:fileId/subtitles.srt
// GET /api/upload/:fileId/subtitles.vtt
router.get("/:fileId/subtitles.srt", serveSRT);
router.get("/:fileId/subtitles.vtt", serveVTT);

// ── Plain text transcript ─────────────────────────────────────────────────────
// GET /api/upload/:fileId/text
router.get("/:fileId/text", getTranscriptText);

// ── Burn subtitles into video ─────────────────────────────────────────────────
// POST /api/upload/:fileId/burn   → starts background burn
// GET  /api/upload/:fileId/burned → download burned video
router.post("/:fileId/burn", burnSubtitles);
router.get("/:fileId/burned", downloadBurned);
router.post("/:fileId/subtitles", saveEditedSubtitles);
router.post("/:fileId/retry", retryJob);

// ── Legacy raw file info ──────────────────────────────────────────────────────
// GET /api/upload/:filename
router.get("/:filename", getFileInfo);

export default router;