import axios from "axios";
import { ArrowRight, CheckCircle2, LoaderCircle, Sparkles, Upload } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { SubtitleCanvas } from "@/components/subtitle-canvas";
import { UploadDropzone } from "@/components/upload-dropzone";
import { useSubtitleStudio } from "@/hooks/use-subtitle-studio";
import { dashboardSteps, sampleSubtitles } from "@/lib/studio-data";

import type { UploadResponse } from "@shared/api";

function sleep(duration: number) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const {
    activePreset,
    processingProgress,
    selectSubtitle,
    selectedSubtitleId,
    startProcessing,
    startUpload,
    status,
    style,
    subtitles,
    uploadProgress,
    setUploadProgress,
    finishUpload,
    setProcessingProgress,
    completeProcessing,
    videoAsset,
    uploadedFile,
  } = useSubtitleStudio();

  const handleFileSelect = async (file: File) => {
    if (busy) {
      return;
    }

    const previousAsset = useSubtitleStudio.getState().videoAsset;
    if (previousAsset?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previousAsset.previewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setBusy(true);
    startUpload({
      fileName: file.name,
      previewUrl,
      size: file.size,
      type: file.type,
    });

    let uploadValue = 0;
    const uploadTimer = window.setInterval(() => {
      uploadValue = Math.min(uploadValue + Math.random() * 15 + 10, 92);
      setUploadProgress(Math.round(uploadValue));
    }, 160);

    try {
      const response = await axios.post<UploadResponse>("/api/upload", {
        filename: file.name,
        size: file.size,
        type: file.type,
      });

      await sleep(600);
      window.clearInterval(uploadTimer);
      setUploadProgress(100);
      finishUpload(response.data.file);
      startProcessing();

      await new Promise<void>((resolve) => {
        let processingValue = 0;
        const processingTimer = window.setInterval(() => {
          processingValue = Math.min(processingValue + 5, 100);
          setProcessingProgress(processingValue);

          if (processingValue >= 100) {
            window.clearInterval(processingTimer);
            resolve();
          }
        }, 320);
      });

      completeProcessing(sampleSubtitles);
      selectSubtitle(sampleSubtitles[1]?.id ?? sampleSubtitles[0].id);
      toast.success("AI subtitles generated", {
        description: "Your demo timeline is ready to edit.",
      });
    } catch (error) {
      console.error(error);
      window.clearInterval(uploadTimer);
      setUploadProgress(0);
      setProcessingProgress(0);
      toast.error("Upload failed", {
        description: "Please try a different video file.",
      });
    } finally {
      setBusy(false);
    }
  };

  const progressValue = status === "processing" ? processingProgress : uploadProgress;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/65">
              <Sparkles className="h-4 w-4 text-brand" /> AI subtitle dashboard
            </p>
            <div className="max-w-2xl space-y-3">
              <h1 className="font-display text-4xl text-white sm:text-5xl">
                Upload once. Ship polished subtitle videos everywhere.
              </h1>
              <p className="text-base leading-7 text-white/60 sm:text-lg">
                Drag in footage, watch the processing pipeline update in real time, and jump into a ready-made editing timeline.
              </p>
            </div>
          </div>

          <UploadDropzone busy={busy} onFileSelect={handleFileSelect} />

          <div className="glass-panel rounded-[2rem] p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.28em] text-white/40">Pipeline</p>
                <h2 className="mt-2 font-display text-2xl text-white">Current job status</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/60">
                {status === "completed" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                ) : status === "idle" ? (
                  <Upload className="h-4 w-4 text-brand" />
                ) : (
                  <LoaderCircle className="h-4 w-4 animate-spin text-brand" />
                )}
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </div>
            </div>

            <div className="space-y-4">
              <div className="h-3 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-brand via-brand-secondary to-cyan-400 transition-all duration-500"
                  style={{ width: `${Math.max(progressValue, status === "completed" ? 100 : 8)}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-sm text-white/55">
                <span>
                  {status === "uploading" && "Uploading source footage"}
                  {status === "processing" && "Processing speech and timing"}
                  {status === "completed" && "Ready for editing"}
                  {status === "idle" && "Waiting for your first upload"}
                </span>
                <span>{Math.round(progressValue)}%</span>
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {dashboardSteps.map((step, index) => {
                const complete =
                  (status === "uploading" && index === 0) ||
                  status === "processing" ||
                  status === "completed";

                const active =
                  (status === "uploading" && index === 0) ||
                  (status === "processing" && index === 1) ||
                  (status === "completed" && index === 2);

                return (
                  <div
                    key={step.title}
                    className={`rounded-[1.5rem] border p-4 ${
                      active
                        ? "border-brand/50 bg-brand/10"
                        : complete
                          ? "border-emerald-500/30 bg-emerald-500/10"
                          : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.24em] text-white/35">0{index + 1}</p>
                    <h3 className="mt-3 font-medium text-white">{step.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-white/55">{step.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <SubtitleCanvas
            subtitles={subtitles}
            selectedSubtitleId={selectedSubtitleId}
            style={style}
            status={status}
            videoPreviewUrl={videoAsset?.previewUrl}
          />

          <div className="glass-panel rounded-[2rem] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.28em] text-white/40">Upload details</p>
                <h2 className="mt-2 font-display text-2xl text-white">Live job metadata</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/45">
                {activePreset}
              </span>
            </div>

            <div className="mt-6 space-y-4 text-sm text-white/60">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span>Source file</span>
                <span className="max-w-[55%] truncate text-right text-white/80">
                  {videoAsset?.fileName ?? "No upload yet"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span>Server reference</span>
                <span className="max-w-[55%] truncate text-right text-white/80">
                  {uploadedFile ?? "Pending"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span>Subtitle segments</span>
                <span className="text-white/80">{subtitles.length}</span>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate("/editor")}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white/90"
              >
                Open editor <ArrowRight className="h-4 w-4" />
              </button>
              <Link
                to="/export"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/[0.05] hover:text-white"
              >
                Preview export
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
