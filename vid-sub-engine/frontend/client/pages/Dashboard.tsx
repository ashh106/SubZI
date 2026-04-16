import axios from "axios";
import { ArrowRight, CheckCircle2, LoaderCircle, Sparkles, Upload } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


import { SubtitleCanvas } from "@/components/subtitle-canvas";
import { UploadDropzone } from "@/components/upload-dropzone";
import { useSubtitleStudio } from "@/hooks/use-subtitle-studio";
import { dashboardSteps, sampleSubtitles, type SubtitleCue } from "@/lib/studio-data";

import type { UploadResponse } from "@shared/api";

function parseSrt(srtText: string): SubtitleCue[] {
  const blocks = srtText.replace(/\r\n/g, '\n').trim().split(/\n\s*\n/);
  return blocks.map((block, i) => {
    const lines = block.split('\n');
    if (lines.length < 3) return null;
    const timestamps = lines[1].split(' --> ');
    if (timestamps.length !== 2) return null;
    
    const parseTime = (timeStr: string) => {
      if (!timeStr) return 0;
      const [time, ms] = timeStr.trim().split(',');
      const parts = time.split(':');
      if (parts.length === 3) {
          const [h, m, s] = parts;
          return parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s) + (parseInt(ms) || 0) / 1000;
      }
      return 0; // fallback
    };
    
    return {
      id: `cue-${i + 1}`,
      start: parseTime(timestamps[0]),
      end: parseTime(timestamps[1]),
      text: lines.slice(2).join('\n').trim()
    };
  }).filter(Boolean) as SubtitleCue[];
}

function sleep(duration: number) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("en");
  const [whisperModel, setWhisperModel] = useState("medium");
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
    reset,
  } = useSubtitleStudio();

  const [stagedFile, setStagedFile] = useState<File | null>(null);

  const handleReset = () => {
    reset();
    setStagedFile(null);
  };

  const handleFileSelect = (file: File) => {
    if (busy) return;
    
    const previousAsset = useSubtitleStudio.getState().videoAsset;
    if (previousAsset?.previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previousAsset.previewUrl);
    }

    setStagedFile(file);
    // Prepare a preview URL for the canvas but do not change `status` yet.
    useSubtitleStudio.setState({
      videoAsset: {
        fileName: file.name,
        previewUrl: URL.createObjectURL(file),
        size: file.size,
        type: file.type,
      }
    });
  };

  const handleProcessClick = async () => {
    if (!stagedFile || busy) {
      return;
    }

    setBusy(true);
    startUpload({
      fileName: stagedFile.name,
      previewUrl: URL.createObjectURL(stagedFile),
      size: stagedFile.size,
      type: stagedFile.type,
    });

    try {
      const formData = new FormData();
      formData.append("video", stagedFile);
      formData.append("sourceLanguage", sourceLanguage);
      formData.append("targetLanguage", targetLanguage);
      formData.append("whisperModel", whisperModel);

      // 1. Upload Video
      const response = await axios.post<any>("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
             const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
             setUploadProgress(percentCompleted);
          }
        }
      });

      const fileId = response.data.fileId;
      finishUpload(fileId);
      startProcessing();

      // 2. Poll Backend status
      await new Promise<void>((resolve, reject) => {
        const processingTimer = window.setInterval(async () => {
          try {
            const statusRes = await axios.get<any>(`/api/upload/${fileId}/status`);
            const { status: jobStatus, progress, errorMessage } = statusRes.data;

            if (jobStatus === "processing") {
              setProcessingProgress(progress || 0);
            }

            if (jobStatus === "completed") {
              window.clearInterval(processingTimer);
              setProcessingProgress(100);
              resolve();
            } else if (jobStatus === "failed") {
              window.clearInterval(processingTimer);
              reject(new Error(errorMessage || "Job failed"));
            }
          } catch (err) {
            console.error("Polling error", err);
          }
        }, 1500);
      });

      // 3. Status completed, fetch actual SRT subtitles
      const srtRes = await axios.get(`/api/upload/${fileId}/subtitles.srt`);
      const parsedSubtitles = parseSrt(srtRes.data);
      
      const statusResFinal = await axios.get<any>(`/api/upload/${fileId}/status`);
      const keywords = statusResFinal.data.keywords || [];

      if (parsedSubtitles.length > 0) {
        completeProcessing(parsedSubtitles, keywords);
        selectSubtitle(parsedSubtitles[0].id);
      } else {
        completeProcessing(sampleSubtitles, keywords);
        selectSubtitle(sampleSubtitles[0].id);
      }
      toast.success("AI subtitles generated", {
        description: "Your editable timeline is ready.",
      });
      // Clear staged file after successful processing
      setStagedFile(null);
    } catch (error) {
      console.error(error);
      setUploadProgress(0);
      setProcessingProgress(0);
      toast.error("Process failed", {
        description: "Please try again.",
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

          <div className="glass-panel grid gap-4 rounded-[2rem] p-5 sm:p-6 md:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Source Language</label>
              <Select value={sourceLanguage} onValueChange={setSourceLanguage}>
                <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Auto" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white">
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Target Language</label>
              <Select value={targetLanguage} onValueChange={setTargetLanguage}>
                <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="English" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white">
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="hi">Hindi</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70">Whisper Model</label>
              <Select value={whisperModel} onValueChange={setWhisperModel}>
                <SelectTrigger className="w-full bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Medium (Balanced)" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-white/10 text-white">
                  <SelectItem value="gemini-flash">⚡ Gemini Flash (Fastest — API key required)</SelectItem>
                  <SelectItem value="tiny">Tiny (Fastest local, High Error Rate)</SelectItem>
                  <SelectItem value="base">Base (Fast local, Good for clear English)</SelectItem>
                  <SelectItem value="small">Small (Better translation, Moderate speed)</SelectItem>
                  <SelectItem value="medium">Medium (Standard Balance of Speed/Accuracy)</SelectItem>
                  <SelectItem value="large-v3">Large-v3 (Slowest, Maximum Accuracy)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-white/40 mt-1">⚡ Gemini Flash is the fastest (cloud API). Local models need Python/Whisper installed.</p>
            </div>
          </div>

          {!stagedFile && status === "idle" ? (
             <UploadDropzone busy={busy} onFileSelect={handleFileSelect} />
          ) : stagedFile && status === "idle" ? (
             <div className="glass-panel text-center rounded-[2rem] p-8 border border-white/10 flex flex-col items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-4" />
                <h3 className="text-xl text-white font-medium mb-2">{stagedFile.name} loaded</h3>
                <p className="text-white/60 text-sm max-w-md mx-auto mb-6">Your video is staged. Double check your Source and Target languages above, select your preferred Whisper model, and click below to begin the analysis engine.</p>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleProcessClick}
                    disabled={busy}
                    className="bg-brand text-slate-900 px-6 py-3 rounded-full font-bold shadow-[0_0_20px_theme(colors.brand.DEFAULT)] flex items-center justify-center gap-2 hover:bg-brand/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                    {busy ? "Starting engine..." : "Process Video & Generate Subtitles"}
                  </button>
                  <button
                    onClick={handleReset}
                    className="border border-white/10 text-white/60 px-4 py-3 rounded-full text-sm hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                </div>
             </div>
          ) : status === "completed" ? (
             <div className="glass-panel text-center rounded-[2rem] p-8 border border-emerald-500/30 bg-emerald-500/5 flex flex-col items-center justify-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-4" />
                <h3 className="text-xl text-white font-medium mb-2">Subtitles ready!</h3>
                <p className="text-white/60 text-sm max-w-md mx-auto mb-6">Your video has been processed. Head to the Editor to polish your captions, or start a new video below.</p>
                <button
                  onClick={handleReset}
                  className="border border-white/20 text-white px-6 py-3 rounded-full font-medium flex items-center justify-center gap-2 hover:bg-white/8 transition-all"
                >
                  <Upload className="h-5 w-5" /> Process New Video
                </button>
             </div>
          ) : (
             <UploadDropzone busy={busy} onFileSelect={handleFileSelect} />
          )}

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
                  {status === "uploading" && "Uploading source footage to server"}
                  {status === "processing" && progressValue <= 15 ? "Extracting audio..." : ""}
                  {status === "processing" && progressValue > 15 && progressValue < 85 ? "Analyzing speech & generating SRT..." : ""}
                  {status === "processing" && progressValue >= 85 ? "Saving subtitles..." : ""}
                  {status === "completed" && "Subtitles ready for editing"}
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
