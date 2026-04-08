import { Keyboard, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

import { StylePanel } from "@/components/style-panel";
import { SubtitleCanvas } from "@/components/subtitle-canvas";
import { SubtitleTimeline } from "@/components/subtitle-timeline";
import { useSubtitleStudio } from "@/hooks/use-subtitle-studio";

export default function Editor() {
  const {
    activePreset,
    applyPreset,
    patchStyle,
    selectSubtitle,
    selectedSubtitleId,
    status,
    style,
    subtitles,
    toggleKeyword,
    updateSubtitleText,
    videoAsset,
  } = useSubtitleStudio();

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-4">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/65">
            <Sparkles className="h-4 w-4 text-brand" /> Subtitle editor
          </p>
          <div className="space-y-3">
            <h1 className="font-display text-4xl text-white sm:text-5xl">
              Edit timing, typography, and highlighted hooks in one place.
            </h1>
            <p className="text-base leading-7 text-white/60 sm:text-lg">
              Built for creators who want fast subtitle edits without sacrificing polish. Click a caption block, rewrite it, and preview the result instantly.
            </p>
          </div>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/55">
          <Keyboard className="h-4 w-4 text-brand" /> Optional shortcuts: J / K, Cmd + Enter
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <SubtitleCanvas
            subtitles={subtitles}
            selectedSubtitleId={selectedSubtitleId}
            style={style}
            status={status}
            videoPreviewUrl={videoAsset?.previewUrl}
          />
          <SubtitleTimeline
            subtitles={subtitles}
            selectedSubtitleId={selectedSubtitleId}
            onSelect={selectSubtitle}
            onChange={updateSubtitleText}
          />
        </div>

        <div className="space-y-6">
          <StylePanel
            activePreset={activePreset}
            style={style}
            onPresetChange={applyPreset}
            onStyleChange={patchStyle}
            onToggleKeyword={toggleKeyword}
          />

          <div className="glass-panel rounded-[2rem] p-5 sm:p-6">
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-white/40">Workflow</p>
            <h2 className="mt-2 font-display text-2xl text-white">Ready for final export?</h2>
            <p className="mt-3 text-sm leading-6 text-white/60">
              Your current subtitle state is stored globally across the dashboard, editor, and export pages.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/export"
                className="inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
              >
                Go to export
              </Link>
              <Link
                to="/dashboard"
                className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              >
                Upload another clip
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
