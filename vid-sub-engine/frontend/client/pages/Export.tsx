import { useState } from "react";
import { Link } from "react-router-dom";

import { ExportActions } from "@/components/export-actions";
import { SubtitleCanvas } from "@/components/subtitle-canvas";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSubtitleStudio } from "@/hooks/use-subtitle-studio";
import { formatTimestamp } from "@/lib/studio-data";
import { API_URL } from "@shared/api";

async function downloadBlobWithPicker(blob: Blob, fileName: string, fileDescription: string, mimeType: string, extension: string) {
  try {
    if ('showSaveFilePicker' in window) {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: fileDescription,
          accept: { [mimeType]: [extension] },
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return true;
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      console.error(err);
    }
    return true; // Aborted by user, don't fallback.
  }
  
  // Fallback for Safari/Mobile
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
  return true;
}

function toSrtTimestamp(value: number) {
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = Math.floor(value % 60);
  const milliseconds = Math.round((value % 1) * 1000);
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")},${milliseconds.toString().padStart(3, "0")}`;
}

export default function Export() {
  const [isBurning, setIsBurning] = useState(false);
  const {
    selectedFormat,
    selectedSubtitleId,
    setSelectedFormat,
    status,
    style,
    subtitles,
    videoAsset,
    uploadedFile,
    exportSettings,
    setExportSettings,
  } = useSubtitleStudio();

  const handleShare = async (blob: Blob, ext: string) => {
    if (!navigator.share) {
      alert("Your browser does not support the native Share API.");
      return;
    }
    const safeName = (videoAsset?.fileName ?? "subtitle-demo")
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .toLowerCase();
    
    const file = new File([blob], `${safeName}${ext}`, { type: blob.type });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "My SubZI Video",
          text: "Check out this video generated with SubZI!",
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error(err);
      }
    } else {
      alert("Your system doesn't support sharing this file type directly.");
    }
  };

  const handleDownloadOrShare = async (action: "download" | "share") => {
    if (!uploadedFile) {
       console.error("No file to download");
       return;
    }
    const safeName = (videoAsset?.fileName ?? "subtitle-demo")
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .toLowerCase();

    // Reconstruct the edited SRT from React State Timeline
    const editedSrtData = subtitles
        .map((subtitle, index) => `${index + 1}\n${toSrtTimestamp(subtitle.start)} --> ${toSrtTimestamp(subtitle.end)}\n${subtitle.text}\n`)
        .join("\n");

    if (selectedFormat === "srt") {
      const srtBlob = new Blob([editedSrtData], { type: "text/plain;charset=utf-8" });
      if (action === "share") {
         await handleShare(srtBlob, ".srt");
      } else {
         await downloadBlobWithPicker(srtBlob, `${safeName}.srt`, "Subtitle File", "text/plain", ".srt");
      }
      return;
    }

    // For MP4, send the custom edited Text/SRT to backend for a fresh burn
    if (selectedFormat === "mp4") {
      setIsBurning(true);
      try {
         await fetch(`${API_URL}/api/upload/${uploadedFile}/burn`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ srtData: editedSrtData, style, exportSettings })
         });
         
         const checkStatus = async () => {
             try {
                 const res = await fetch(`${API_URL}/api/upload/${uploadedFile}/status`);
                 const data = await res.json();
                 if (data.burnStatus === "completed") {
                     // Fetch the actual video file as blob
                     const videoRes = await fetch(`${API_URL}/api/upload/${uploadedFile}/burned`);
                     const videoBlob = await videoRes.blob();
                     if (action === "share") {
                        await handleShare(videoBlob, "-subbed.mp4");
                     } else {
                        await downloadBlobWithPicker(videoBlob, `${safeName}-subbed.mp4`, "Video File", "video/mp4", ".mp4");
                     }
                     setIsBurning(false);
                 } else if (data.burnStatus === "failed") {
                     console.error("Burn failed");
                     alert("Failed to burn video. Please try again.");
                     setIsBurning(false);
                 } else {
                     setTimeout(checkStatus, 3000);
                 }
             } catch (err) {
                 console.error(err);
                 setIsBurning(false);
             }
         };
         checkStatus();
      } catch (err) {
         console.error(err);
         alert("Could not request video burn. Please try again.");
         setIsBurning(false);
      }
    }
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

        <div className="space-y-6">
          <ExportActions
            selectedFormat={selectedFormat}
            onFormatChange={setSelectedFormat}
            onDownload={() => handleDownloadOrShare("download")}
            onShare={() => handleDownloadOrShare("share")}
            isBurning={isBurning}
          />
          
          <div className="glass-panel rounded-[2rem] p-5 sm:p-6 mt-6">
            <p className="text-sm font-medium uppercase tracking-[0.28em] text-white/40">Advanced Video Options</p>
            <div className="mt-5 grid gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70">Aspect Ratio Crop</label>
                <Select value={exportSettings.aspectRatio} onValueChange={(v) => setExportSettings({ aspectRatio: v as any })}>
                  <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Original" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white">
                    <SelectItem value="original">Original Aspect Ratio</SelectItem>
                    <SelectItem value="16:9">16:9 (Landscape - YouTube)</SelectItem>
                    <SelectItem value="9:16">9:16 (Vertical - TikTok/Reels)</SelectItem>
                    <SelectItem value="1:1">1:1 (Square)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-white/70">Video Quality</label>
                <Select value={exportSettings.quality} onValueChange={(v) => setExportSettings({ quality: v as any })}>
                  <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="High Quality" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 border-white/10 text-white">
                    <SelectItem value="high">High Quality (Max Bitrate)</SelectItem>
                    <SelectItem value="medium">Standard Quality (Balanced)</SelectItem>
                    <SelectItem value="low">Proxy Size (Low Bitrate / Fast)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
