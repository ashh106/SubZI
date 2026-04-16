import { Play } from "lucide-react";

import { formatClock, type StudioStatus, type SubtitleCue, type SubtitleStyle } from "@/lib/studio-data";
import { cn } from "@/lib/utils";

interface SubtitleCanvasProps {
  subtitles: SubtitleCue[];
  selectedSubtitleId: string;
  style: SubtitleStyle;
  status: StudioStatus;
  videoPreviewUrl?: string | null;
  compact?: boolean;
}

const fontFamilyClass: Record<SubtitleStyle["fontFamily"], string> = {
  sans: "font-sans",
  display: "font-display",
  creative: "font-creative",
};

function normalizeToken(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function SubtitleCanvas({
  subtitles,
  selectedSubtitleId,
  style,
  status,
  videoPreviewUrl,
  compact = false,
}: SubtitleCanvasProps) {
  const selectedSubtitle =
    subtitles.find((subtitle) => subtitle.id === selectedSubtitleId) ?? subtitles[0];

  const tokens = selectedSubtitle?.text.split(/(\s+)/) ?? [];
  const alignmentClass = style.align === "left" ? "items-start text-left" : "items-center text-center";

  return (
    <div className="glass-panel relative overflow-hidden rounded-[2rem] p-3 shadow-panel sm:p-4">
      <div className={cn("relative overflow-hidden rounded-[1.5rem] bg-slate-950", compact ? "aspect-[4/5]" : "aspect-video")}>
        {videoPreviewUrl ? (
          <video
            src={videoPreviewUrl}
            autoPlay
            loop
            muted
            playsInline
            className="h-full w-full object-cover opacity-80"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.28),_transparent_42%),linear-gradient(135deg,_rgba(8,47,73,0.85),_rgba(17,24,39,0.98)_55%,_rgba(36,0,70,0.85))]" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
        <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-medium text-white/70 backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          {status === "completed" ? "Subtitle ready" : status === "processing" ? "Generating captions" : "Demo preview"}
        </div>

        <div className="absolute inset-0 flex flex-col justify-between p-4 sm:p-6">
          <div className="flex items-center justify-between text-white/55">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/25 backdrop-blur">
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            </div>
            <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-medium backdrop-blur">
              4K creator export
            </span>
          </div>

          <div className={cn("flex gap-4", alignmentClass)}>
            <div className={cn("max-w-3xl space-y-3", alignmentClass)}>
              <div
                className={cn(
                  "rounded-[1.75rem] border border-white/10 bg-black/35 px-4 py-3 shadow-2xl backdrop-blur-xl sm:px-6 sm:py-4",
                  fontFamilyClass[style.fontFamily],
                  style.uppercase && "uppercase tracking-[0.12em]",
                )}
                style={{ color: style.color, fontSize: `${style.fontSize}px` }}
              >
                {tokens.map((token, index) => {
                  const normalized = normalizeToken(token);
                  const highlighted = normalized && style.keywords.some((keyword) => normalizeToken(keyword) === normalized);

                  return (
                    <span
                      key={`${token}-${index}`}
                      className={highlighted ? "rounded-md px-1 py-0.5" : undefined}
                      style={highlighted ? { backgroundColor: style.highlightColor, color: "#020617" } : undefined}
                    >
                      {token}
                    </span>
                  );
                })}
              </div>
              {selectedSubtitle && (
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/25 px-3 py-1 text-xs text-white/65 backdrop-blur">
                  {formatClock(selectedSubtitle.start)} → {formatClock(selectedSubtitle.end)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
