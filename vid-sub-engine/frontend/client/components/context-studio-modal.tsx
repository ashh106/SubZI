import React, { useState, useEffect } from "react";
import axios from "axios";
import { BookOpen, Plus, Trash2, Sparkles, X, Check, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "@shared/api";

export interface GlossaryEntry {
  id: string;
  term: string;
  category: string;
  replacement?: string;
  soundsLike?: string[];
  context?: string;
}

interface ContextStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTermsUpdated?: () => void;
}

export function ContextStudioModal({ isOpen, onClose, onTermsUpdated }: ContextStudioModalProps) {
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Form state
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("tech");
  const [replacement, setReplacement] = useState("");
  const [soundsLike, setSoundsLike] = useState("");
  const [context, setContext] = useState("");

  const fetchGlossary = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/api/context/glossary`);
      if (res.data?.entries) {
        setEntries(res.data.entries);
      }
    } catch (err: any) {
      console.error("Failed to load glossary:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchGlossary();
    }
  }, [isOpen]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term.trim()) return;

    try {
      await axios.post(`${API_URL}/api/context/glossary`, {
        term: term.trim(),
        category,
        replacement: replacement.trim() || term.trim(),
        soundsLike: soundsLike
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        context: context.trim(),
      });

      toast.success("Glossary term added", {
        description: `"${term}" is now active in your Context Studio.`,
      });

      setTerm("");
      setReplacement("");
      setSoundsLike("");
      setContext("");
      setIsAdding(false);
      fetchGlossary();
      onTermsUpdated?.();
    } catch (err: any) {
      toast.error("Failed to add term", {
        description: err.response?.data?.error || err.message,
      });
    }
  };

  const handleDelete = async (id: string, termName: string) => {
    try {
      await axios.delete(`${API_URL}/api/context/glossary/${id}`);
      toast.info("Term removed", { description: `Removed "${termName}"` });
      setEntries((prev) => prev.filter((item) => item.id !== id));
      onTermsUpdated?.();
    } catch (err: any) {
      toast.error("Failed to delete term", { description: err.message });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-[2rem] border border-white/10 bg-slate-950 p-6 sm:p-8 shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 border border-brand/30 text-brand">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-xl text-white sm:text-2xl">SubZI Context Studio</h2>
              <p className="text-xs text-white/50">Custom Glossary & Domain-Aware RAG Correction</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto py-5 space-y-4 pr-1">
          <div className="rounded-xl bg-white/[0.03] border border-white/8 p-4 text-xs text-white/70 leading-relaxed">
            <p className="flex items-center gap-1.5 font-semibold text-white mb-1">
              <Sparkles className="h-3.5 w-3.5 text-brand" /> How Context Studio works:
            </p>
            Add people, brand spellings, college names, tech acronyms, or phonetic aliases. The SubZI RAG pipeline scans your generated subtitles, detects phonetically misheard phrases, and replaces or suggests exact corrections without losing original timestamps.
          </div>

          {/* Add form toggle */}
          {isAdding ? (
            <form onSubmit={handleAdd} className="rounded-2xl border border-brand/30 bg-brand/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-brand">New Glossary Term</span>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-xs text-white/40 hover:text-white"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-white/60 mb-1 block">Term / Concept *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SubZI or IIIT Pune"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-brand focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-white/60 mb-1 block">Preferred Replacement</label>
                  <input
                    type="text"
                    placeholder="e.g. SubZI"
                    value={replacement}
                    onChange={(e) => setReplacement(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-white/60 mb-1 block">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white focus:border-brand focus:outline-none"
                  >
                    <option value="brand">Brand / Product</option>
                    <option value="person">Person Name</option>
                    <option value="company">Institution / Company</option>
                    <option value="tech">Tech / Acronym</option>
                    <option value="hinglish">Hinglish Preference</option>
                    <option value="general">General Term</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-white/60 mb-1 block">Sounds-like / Common mishearings (comma separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. sub zee, sabzi, sub z"
                    value={soundsLike}
                    onChange={(e) => setSoundsLike(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-brand focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-white/60 mb-1 block">Context / Domain Notes (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. College in Pune, Maharashtra"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-brand focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-brand px-4 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-brand/90 flex items-center justify-center gap-1.5"
              >
                <Check className="h-4 w-4" /> Save to Context Studio
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsAdding(true)}
              className="w-full rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-3 text-xs font-medium text-white/60 hover:border-brand/50 hover:bg-white/[0.04] hover:text-white transition flex items-center justify-center gap-2"
            >
              <Plus className="h-4 w-4 text-brand" /> Add Term to Custom Glossary
            </button>
          )}

          {/* List of active terms */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wider text-white/40">Active Glossary Terms ({entries.length})</p>
            {loading ? (
              <p className="text-xs text-white/40 py-4 text-center">Loading terms...</p>
            ) : entries.length === 0 ? (
              <p className="text-xs text-white/40 py-4 text-center">No glossary terms added yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-3 flex items-start justify-between gap-2 group hover:border-white/20 transition"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white truncate">{entry.term}</span>
                        <span className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white/50">
                          {entry.category}
                        </span>
                      </div>
                      {entry.replacement && entry.replacement !== entry.term && (
                        <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                          <ArrowRight className="h-3 w-3" /> {entry.replacement}
                        </p>
                      )}
                      {entry.soundsLike && entry.soundsLike.length > 0 && (
                        <p className="text-[10px] text-white/40 truncate">
                          Aliases: {entry.soundsLike.join(", ")}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(entry.id, entry.term)}
                      className="text-white/30 hover:text-red-400 p-1 rounded-md transition opacity-0 group-hover:opacity-100"
                      title="Remove term"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-full bg-white px-5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-white/90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
