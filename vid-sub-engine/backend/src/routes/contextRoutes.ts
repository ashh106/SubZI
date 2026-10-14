import { Router, Request, Response } from "express";
import fs from "fs";
import { GlossaryStore } from "../services/rag/glossaryStore";
import { ragCorrectionEngine } from "../services/rag/correctionEngine";
import { JobRepository } from "../utils/jobRepository";
import { parseSrtContent, toSRT, toVTT } from "../utils/subtitleFormat";

const router = Router();

// GET /api/context/glossary
router.get("/glossary", async (_req: Request, res: Response): Promise<void> => {
  try {
    const entries = await GlossaryStore.list();
    res.json({ success: true, count: entries.length, entries });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to list glossary", detail: err.message });
  }
});

// POST /api/context/glossary
router.post("/glossary", async (req: Request, res: Response): Promise<void> => {
  try {
    const { term, category, replacement, soundsLike, context } = req.body;
    if (!term || typeof term !== "string") {
      res.status(400).json({ error: "Term is required" });
      return;
    }

    const entry = await GlossaryStore.add({
      term: term.trim(),
      category: category || "general",
      replacement: (replacement || term).trim(),
      soundsLike: Array.isArray(soundsLike)
        ? soundsLike.map((s: string) => s.trim())
        : soundsLike
        ? [String(soundsLike).trim()]
        : [],
      context: context?.trim(),
    });

    res.status(201).json({ success: true, entry });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to add glossary entry", detail: err.message });
  }
});

// DELETE /api/context/glossary/:id
router.delete("/glossary/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params["id"] as string;
    await GlossaryStore.remove(id);
    res.json({ success: true, message: "Entry deleted" });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to delete entry", detail: err.message });
  }
});

// POST /api/context/correct/:fileId
// Runs RAG semantic search and produces reviewable suggestions without overwriting raw transcript
router.post("/correct/:fileId", async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params["fileId"] as string;
    const job = await JobRepository.findOne({ fileId });

    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }

    let segments = job.rawSegments;
    // If rawSegments not in DB, parse from SRT
    if ((!segments || segments.length === 0) && job.srtPath && fs.existsSync(job.srtPath)) {
      const srtContent = fs.readFileSync(job.srtPath, "utf-8");
      segments = parseSrtContent(srtContent);
    }

    if (!segments || segments.length === 0) {
      res.status(400).json({ error: "No transcript segments found to correct" });
      return;
    }

    const suggestions = await ragCorrectionEngine.generateCorrections(segments);

    await JobRepository.findOneAndUpdate(
      { fileId },
      { ragSuggestions: suggestions, ragApplied: false }
    );

    res.json({
      success: true,
      fileId,
      totalSegments: segments.length,
      suggestionsCount: suggestions.length,
      suggestions,
    });
  } catch (err: any) {
    res.status(500).json({ error: "RAG correction failed", detail: err.message });
  }
});

// POST /api/context/apply/:fileId
// Applies approved suggestions to the active subtitle track
router.post("/apply/:fileId", async (req: Request, res: Response): Promise<void> => {
  try {
    const fileId = req.params["fileId"] as string;
    const job = await JobRepository.findOne({ fileId });

    if (!job || !job.srtPath || !fs.existsSync(job.srtPath)) {
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
      segments = parseSrtContent(fs.readFileSync(job.srtPath, "utf-8"));
    }

    // Apply suggestions
    for (const sugg of suggestions) {
      if (
        !acceptedIndices ||
        acceptedIndices.includes(sugg.segmentIndex)
      ) {
        if (segments[sugg.segmentIndex]) {
          segments[sugg.segmentIndex].text = sugg.suggestedText;
        }
        sugg.status = "accepted";
      } else {
        sugg.status = "rejected";
      }
    }

    // Write updated SRT
    const newSrt = toSRT(segments);
    fs.writeFileSync(job.srtPath, newSrt, "utf-8");

    // Also update VTT if present
    if (job.vttPath && fs.existsSync(job.vttPath)) {
      fs.writeFileSync(job.vttPath, toVTT(segments), "utf-8");
    }

    await JobRepository.findOneAndUpdate(
      { fileId },
      {
        rawSegments: segments,
        ragSuggestions: suggestions,
        ragApplied: true,
      }
    );

    res.json({
      success: true,
      message: "Glossary corrections applied to subtitles",
      appliedCount: suggestions.filter((s) => s.status === "accepted").length,
    });
  } catch (err: any) {
    res.status(500).json({ error: "Failed to apply corrections", detail: err.message });
  }
});

export default router;
