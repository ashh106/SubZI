import { Download, FileVideo, Subtitles } from "lucide-react";

import { type ExportFormat } from "@/lib/studio-data";
import { cn } from "@/lib/utils";

interface ExportActionsProps {
  selectedFormat: ExportFormat;
  onFormatChange: (format: ExportFormat) => void;
  onDownload: () => void;
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
          ? "MP4 export is simulated in this demo and downloads a render brief."
          : "SRT export downloads a ready-to-use subtitle file generated from your edited timeline."}
      </div>

      <button
        type="button"
        onClick={onDownload}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
      >
        <Download className="h-4 w-4" /> Download
      </button>
    </div>
  );
}
