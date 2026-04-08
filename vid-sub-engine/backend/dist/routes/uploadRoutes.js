"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const uploadService_1 = require("../services/uploadService");
const uploadController_1 = require("../controllers/uploadController");
const router = (0, express_1.Router)();
// ── Upload ────────────────────────────────────────────────────────────────────
// POST /api/upload
// Form fields: video (file), sourceLanguage? (default: auto), targetLanguage? (default: en)
router.post("/", uploadService_1.upload.single("video"), uploadController_1.uploadVideo);
// ── Job status ────────────────────────────────────────────────────────────────
// GET /api/upload/:fileId/status
router.get("/:fileId/status", uploadController_1.getJobStatus);
// ── Download subtitle files (as attachment) ───────────────────────────────────
// GET /api/upload/:fileId/download/srt
// GET /api/upload/:fileId/download/vtt
router.get("/:fileId/download/:format", uploadController_1.downloadSubtitle);
// ── Inline serving (for frontend player / <track> element) ───────────────────
// GET /api/upload/:fileId/subtitles.srt
// GET /api/upload/:fileId/subtitles.vtt
router.get("/:fileId/subtitles.srt", uploadController_1.serveSRT);
router.get("/:fileId/subtitles.vtt", uploadController_1.serveVTT);
// ── Plain text transcript ─────────────────────────────────────────────────────
// GET /api/upload/:fileId/text
router.get("/:fileId/text", uploadController_1.getTranscriptText);
// ── Burn subtitles into video ─────────────────────────────────────────────────
// POST /api/upload/:fileId/burn   → starts background burn
// GET  /api/upload/:fileId/burned → download burned video
router.post("/:fileId/burn", uploadController_1.burnSubtitles);
router.get("/:fileId/burned", uploadController_1.downloadBurned);
// ── Legacy raw file info ──────────────────────────────────────────────────────
// GET /api/upload/:filename
router.get("/:filename", uploadController_1.getFileInfo);
exports.default = router;
