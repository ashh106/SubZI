"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const fs_1 = __importDefault(require("fs"));
const glossaryStore_1 = require("../services/rag/glossaryStore");
const correctionEngine_1 = require("../services/rag/correctionEngine");
const jobRepository_1 = require("../utils/jobRepository");
const subtitleFormat_1 = require("../utils/subtitleFormat");
const router = (0, express_1.Router)();
// GET /api/context/glossary
router.get("/glossary", async (_req, res) => {
    try {
        const entries = await glossaryStore_1.GlossaryStore.list();
        res.json({ success: true, count: entries.length, entries });
    }
    catch (err) {
        res.status(500).json({ error: "Failed to list glossary", detail: err.message });
    }
});
// POST /api/context/glossary
router.post("/glossary", async (req, res) => {
    try {
        const { term, category, replacement, soundsLike, context } = req.body;
        if (!term || typeof term !== "string") {
            res.status(400).json({ error: "Term is required" });
            return;
        }
        const entry = await glossaryStore_1.GlossaryStore.add({
            term: term.trim(),
            category: category || "general",
            replacement: (replacement || term).trim(),
            soundsLike: Array.isArray(soundsLike)
                ? soundsLike.map((s) => s.trim())
                : soundsLike
                    ? [String(soundsLike).trim()]
                    : [],
            context: context?.trim(),
        });
        res.status(201).json({ success: true, entry });
    }
    catch (err) {
        res.status(500).json({ error: "Failed to add glossary entry", detail: err.message });
    }
});
// DELETE /api/context/glossary/:id
router.delete("/glossary/:id", async (req, res) => {
    try {
        const id = req.params["id"];
        await glossaryStore_1.GlossaryStore.remove(id);
        res.json({ success: true, message: "Entry deleted" });
    }
    catch (err) {
        res.status(500).json({ error: "Failed to delete entry", detail: err.message });
    }
});
// POST /api/context/correct/:fileId
// Runs RAG semantic search and produces reviewable suggestions without overwriting raw transcript
router.post("/correct/:fileId", async (req, res) => {
    try {
        const fileId = req.params["fileId"];
        const job = await jobRepository_1.JobRepository.findOne({ fileId });
        if (!job) {
            res.status(404).json({ error: "Job not found" });
            return;
        }
        let segments = job.rawSegments;
        // If rawSegments not in DB, parse from SRT
        if ((!segments || segments.length === 0) && job.srtPath && fs_1.default.existsSync(job.srtPath)) {
            const srtContent = fs_1.default.readFileSync(job.srtPath, "utf-8");
            segments = (0, subtitleFormat_1.parseSrtContent)(srtContent);
        }
        if (!segments || segments.length === 0) {
            res.status(400).json({ error: "No transcript segments found to correct" });
            return;
        }
        const suggestions = await correctionEngine_1.ragCorrectionEngine.generateCorrections(segments);
        await jobRepository_1.JobRepository.findOneAndUpdate({ fileId }, { ragSuggestions: suggestions, ragApplied: false });
        res.json({
            success: true,
            fileId,
            totalSegments: segments.length,
            suggestionsCount: suggestions.length,
            suggestions,
        });
    }
    catch (err) {
        res.status(500).json({ error: "RAG correction failed", detail: err.message });
    }
});
// POST /api/context/apply/:fileId
// Applies approved suggestions to the active subtitle track
router.post("/apply/:fileId", async (req, res) => {
    try {
        const fileId = req.params["fileId"];
        const job = await jobRepository_1.JobRepository.findOne({ fileId });
        if (!job || !job.srtPath || !fs_1.default.existsSync(job.srtPath)) {
            res.status(404).json({ error: "Job or SRT file not found" });
            return;
        }
        const { acceptedIndices } = req.body; // array of segment indices to accept, or undefined for all
        const suggestions = job.ragSuggestions || [];
        if (suggestions.length === 0) {
            res.json({ success: true, message: "No suggestions to apply" });
            return;
        }
        let segments = job.rawSegments;
        if (!segments || segments.length === 0) {
            segments = (0, subtitleFormat_1.parseSrtContent)(fs_1.default.readFileSync(job.srtPath, "utf-8"));
        }
        // Apply suggestions
        for (const sugg of suggestions) {
            if (!acceptedIndices ||
                acceptedIndices.includes(sugg.segmentIndex)) {
                if (segments[sugg.segmentIndex]) {
                    segments[sugg.segmentIndex].text = sugg.suggestedText;
                }
                sugg.status = "accepted";
            }
            else {
                sugg.status = "rejected";
            }
        }
        // Write updated SRT
        const newSrt = (0, subtitleFormat_1.toSRT)(segments);
        fs_1.default.writeFileSync(job.srtPath, newSrt, "utf-8");
        // Also update VTT if present
        if (job.vttPath && fs_1.default.existsSync(job.vttPath)) {
            fs_1.default.writeFileSync(job.vttPath, (0, subtitleFormat_1.toVTT)(segments), "utf-8");
        }
        await jobRepository_1.JobRepository.findOneAndUpdate({ fileId }, {
            rawSegments: segments,
            ragSuggestions: suggestions,
            ragApplied: true,
        });
        res.json({
            success: true,
            message: "Glossary corrections applied to subtitles",
            appliedCount: suggestions.filter((s) => s.status === "accepted").length,
        });
    }
    catch (err) {
        res.status(500).json({ error: "Failed to apply corrections", detail: err.message });
    }
});
exports.default = router;
