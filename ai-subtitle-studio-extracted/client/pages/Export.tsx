import { Link } from "react-router-dom";

import { ExportActions } from "@/components/export-actions";
import { SubtitleCanvas } from "@/components/subtitle-canvas";
import { useSubtitleStudio } from "@/hooks/use-subtitle-studio";
import { formatTimestamp } from "@/lib/studio-data";

function downloadFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function toSrtTimestamp(value: number) {
  return formatTimestamp(value).replace(".", ",");
}

export default function Export() {
  const {
    selectedFormat,
    selectedSubtitleId,
    setSelectedFormat,
    status,
    style,
    subtitles,
    videoAsset,
  } = useSubtitleStudio();

  const handleDownload = () => {
    const safeName = (videoAsset?.fileName ?? "subtitle-demo")
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .toLowerCase();

    if (selectedFormat === "srt") {
      const content = subtitles
        .map(
          (subtitle, index) => `${index + 1}\n${toSrtTimestamp(subtitle.start)} --> ${toSrtTimestamp(subtitle.end)}\n${subtitle.text}\n`,
        )
        .join("\n");

      downloadFile(content, `${safeName}.srt`, "text/plain;charset=utf-8");
      return;
    }

    const renderBrief = JSON.stringify(
      {
        file: videoAsset?.fileName ?? "demo-video.mp4",
        status,
        notes: "This demo simulates MP4 export. Use a real rendering service in production.",
        subtitles,
      },
      null,
      2,
    );

    downloadFile(renderBrief, `${safeName}-render-brief.json`, "application/json;charset=utf-8");
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl space-y-3">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/65">
            Final delivery
          </p>
          <h1 className="font-display text-4xl text-white sm:text-5xl">
            Preview the final output and download in the format you need.
          </h1>
          <p className="text-base leading-7 text-white/60 sm:text-lg">
            Choose between a demo MP4 render brief or a real SRT subtitle file generated from your edited timeline.
          </p>
        </div>
        <Link
          to="/editor"
          className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
        >
          Back to editor
        </Link>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <SubtitleCanvas
            subtitles={subtitles}
            selectedSubtitleId={selectedSubtitleId}
            style={style}
            status={status}
            videoPreviewUrl={videoAsset?.previewUrl}
          />

          <div className="glass-panel rounded-[2rem] p-5 sm:p-6">
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-white/40">Delivery checklist</p>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm text-white/45">Subtitle segments</p>
                <p className="mt-2 font-display text-3xl text-white">{subtitles.length}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm text-white/45">Current format</p>
                <p className="mt-2 font-display text-3xl uppercase text-white">{selectedFormat}</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-sm text-white/45">Source file</p>
                <p className="mt-2 truncate text-base text-white/80">{videoAsset?.fileName ?? "demo-video.mp4"}</p>
              </div>
            </div>
          </div>
        </div>

        <ExportActions
          selectedFormat={selectedFormat}
          onFormatChange={setSelectedFormat}
          onDownload={handleDownload}
        />
      </section>
    </div>
  );
}
