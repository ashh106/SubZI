import React, { useState } from "react";
import axios from "axios";
import { Sparkles, Check, CheckCheck, X, LoaderCircle, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "@shared/api";
import { useSubtitleStudio } from "@/hooks/use-subtitle-studio";

export interface RAGSuggestionItem {
  segmentIndex: number;
  originalText: string;
  suggestedText: string;
  matchedTerms: string[];
  status: "pending" | "accepted" | "rejected";
}

interface RAGReviewPanelProps {
  onOpenGlossary: () => void;
}

export function RAGReviewPanel({ onOpenGlossary }: RAGReviewPanelProps) {
  const { uploadedFile, subtitles, updateSubtitleText } = useSubtitleStudio();
  const [scanning, setScanning] = useState(false);
  const [suggestions, setSuggestions] = useState<RAGSuggestionItem[]>([]);
  const [hasScanned, setHasScanned] = useState(false);

  const handleScan = async () => {
    if (!uploadedFile) {
      toast.info("No active video job", {
        description: "Upload a video in the Dashboard first to run Context Studio RAG.",
      });
      return;
    }

    setScanning(true);
    try {
      const res = await axios.post(`${API_URL}/api/context/correct/${uploadedFile}`);
      const list = res.data?.suggestions || [];
      setSuggestions(list);
      setHasScanned(true);

      if (list.length === 0) {
        toast.success("RAG scan complete", {
          description: "All subtitle terms match your glossary conventions perfectly!",
        });
      } else {
        toast.info(`Found ${list.length} context suggestions`, {
          description: "Review suggested term corrections below.",
        });
      }
    } catch (err: any) {
      toast.error("RAG scan failed", {
        description: err.response?.data?.error || err.message,
      });
    } finally {
      setScanning(false);
    }
  };

  const handleAccept = (index: number) => {
    const sugg = suggestions[index];
    if (!sugg) return;

    if (subtitles[sugg.segmentIndex]) {
      updateSubtitleText(subtitles[sugg.segmentIndex].id, sugg.suggestedText);
    }

    setSuggestions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, status: "accepted" } : item))
    );
    toast.success("Correction applied", {
      description: `Replaced with "${sugg.suggestedText}"`,
    });
  };

  const handleDismiss = (index: number) => {
    setSuggestions((prev) =>
      prev.map((item, i) => (i === index ? { ...item, status: "rejected" } : item))
    );
  };

  const handleAcceptAll = () => {
    suggestions.forEach((sugg) => {
      if (sugg.status === "pending" && subtitles[sugg.segmentIndex]) {
        updateSubtitleText(subtitles[sugg.segmentIndex].id, sugg.suggestedText);
      }
    });

    setSuggestions((prev) => prev.map((item) => ({ ...item, status: "accepted" })));
    toast.success("All context corrections applied to timeline!");
  };

  const pendingCount = suggestions.filter((s) => s.status === "pending").length;

  return (
    <div className="glass-panel rounded-[2rem] p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand" />
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">
              Context Studio RAG
            </p>
          </div>
          <h2 className="mt-1 font-display text-xl text-white">Domain Term & Brand Polish</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenGlossary}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs text-white/70 hover:bg-white/10 hover:text-white transition"
          >
            <BookOpen className="h-3.5 w-3.5 text-brand" /> Glossary
          </button>
          <button
            onClick={handleScan}
            disabled={scanning || !uploadedFile}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-slate-950 transition hover:bg-brand/90 disabled:opacity-50"
          >
            {scanning ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {scanning ? "Scanning..." : "Scan with RAG"}
          </button>
        </div>
      </div>

      <p className="text-xs leading-relaxed text-white/60">
        Aligns misheard words with your organization&apos;s custom glossary. Review each suggested replacement before accepting.
      </p>

      {/* Results */}
      {hasScanned && (
        <div className="space-y-3 pt-2">
          {pendingCount > 1 && (
            <div className="flex justify-end">
              <button
                onClick={handleAcceptAll}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Accept All ({pendingCount})
              </button>
            </div>
          )}

          {suggestions.length === 0 ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center text-xs text-emerald-400">
              ✨ No misrecognized terms detected. All lines conform to your active glossary.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
              {suggestions.map((sugg, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border p-3 text-xs space-y-2 transition ${
                    sugg.status === "accepted"
                      ? "border-emerald-500/30 bg-emerald-500/10 opacity-70"
                      : sugg.status === "rejected"
                      ? "border-white/5 bg-white/[0.02] opacity-40"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-white/40 uppercase">
                      Segment #{sugg.segmentIndex + 1}
                    </span>
                    <span className="rounded-md border border-brand/20 bg-brand/10 px-1.5 py-0.5 text-[10px] text-brand">
                      Influenced by: {sugg.matchedTerms.join(", ")}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <p className="text-white/50 line-through">{sugg.originalText}</p>
                    <p className="font-medium text-white">{sugg.suggestedText}</p>
                  </div>

                  {sugg.status === "pending" ? (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => handleDismiss(idx)}
                        className="rounded-md px-2 py-1 text-[11px] text-white/40 hover:text-white"
                      >
                        Dismiss
                      </button>
                      <button
                        onClick={() => handleAccept(idx)}
                        className="inline-flex items-center gap-1 rounded-md bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-medium text-emerald-400 hover:bg-emerald-500/30 transition"
                      >
                        <Check className="h-3 w-3" /> Accept
                      </button>
                    </div>
                  ) : (
                    <p className="text-right text-[10px] uppercase font-bold tracking-wider text-white/40">
                      {sugg.status}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
