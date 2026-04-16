import { Download, FileVideo, Subtitles } from "lucide-react";

import { type ExportFormat } from "@/lib/studio-data";
import { cn } from "@/lib/utils";

interface ExportActionsProps {
  selectedFormat: ExportFormat;
  onFormatChange: (format: ExportFormat) => void;
  onDownload: () => void;
  onShare?: () => void;
  isBurning?: boolean;
}

const formats = [
  {
    id: "mp4" as const,
    label: "MP4",
    description: "Burned-in subtitles for social posting.",
    icon: FileVideo,
  },
  {
    id: "srt" as const,
    label: "SRT",
    description: "Clean subtitle file for upload workflows.",
    icon: Subtitles,
  },
];

export function ExportActions({
  selectedFormat,
  onFormatChange,
  onDownload,
  onShare,
  isBurning,
}: ExportActionsProps) {
  return (
    <div className="glass-panel rounded-[2rem] p-5 sm:p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-white/40">Export</p>
          <h2 className="mt-2 font-display text-2xl text-white">Download your final asset</h2>
        </div>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-brand">
          <Download className="h-5 w-5" />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {formats.map(({ id, label, description, icon: Icon }) => {
          const active = selectedFormat === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onFormatChange(id)}
              className={cn(
                "rounded-[1.5rem] border p-4 text-left transition",
                active
                  ? "border-brand/60 bg-brand/10 shadow-glow"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20",
              )}
            >
              <div className="flex items-center gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/8 text-white/75">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-white">{label}</p>
                  <p className="text-sm text-white/55">{description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-4 text-sm leading-6 text-white/55">
        {selectedFormat === "mp4"
          ? "MP4 export burns your edited captions natively into the video via the cloud engine."
          : "SRT export downloads a ready-to-use subtitle file generated from your edited timeline."}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onDownload}
          disabled={isBurning}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition",
            isBurning
              ? "cursor-not-allowed bg-white/50 text-slate-950/50"
              : "bg-white text-slate-950 hover:bg-white/90"
          )}
        >
          <Download className="h-4 w-4" /> {isBurning ? "Burning..." : "Download File"}
        </button>

        {onShare && (
           <button
             type="button"
             onClick={onShare}
             disabled={isBurning}
             className={cn(
               "inline-flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition border border-white/20 text-white hover:bg-white/10",
               isBurning && "cursor-not-allowed opacity-50"
             )}
           >
             <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-share">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/>
             </svg>
             Share to Socials
           </button>
        )}
      </div>
    </div>
  );
}
