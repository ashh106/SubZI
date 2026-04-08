import { PencilLine } from "lucide-react";

import { formatTimestamp, type SubtitleCue } from "@/lib/studio-data";
import { cn } from "@/lib/utils";

interface SubtitleTimelineProps {
  subtitles: SubtitleCue[];
  selectedSubtitleId: string;
  onSelect: (id: string) => void;
  onChange: (id: string, text: string) => void;
}

export function SubtitleTimeline({
  subtitles,
  selectedSubtitleId,
  onSelect,
  onChange,
}: SubtitleTimelineProps) {
  return (
    <div className="glass-panel rounded-[2rem] p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-white/40">Timeline</p>
          <h2 className="mt-2 font-display text-2xl text-white">Fine-tune every subtitle block</h2>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
          <PencilLine className="h-4 w-4" /> Click any row to edit
        </div>
      </div>

      <div className="space-y-3">
        {subtitles.map((subtitle) => {
          const active = subtitle.id === selectedSubtitleId;

          return (
            <button
              key={subtitle.id}
              type="button"
              onClick={() => onSelect(subtitle.id)}
              className={cn(
                "w-full rounded-[1.5rem] border p-4 text-left transition",
                active
                  ? "border-brand/60 bg-brand/10 shadow-glow"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]",
              )}
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-white/45">
                <span>{formatTimestamp(subtitle.start)}</span>
                <span>{formatTimestamp(subtitle.end)}</span>
              </div>
              <textarea
                value={subtitle.text}
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => onChange(subtitle.id, event.target.value)}
                className="min-h-[88px] w-full resize-none rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-white outline-none ring-0 transition placeholder:text-white/25 focus:border-brand/50"
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
