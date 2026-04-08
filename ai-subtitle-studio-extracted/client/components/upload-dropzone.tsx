import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { Film, FolderUp, LoaderCircle, UploadCloud } from "lucide-react";

import { cn } from "@/lib/utils";

interface UploadDropzoneProps {
  busy: boolean;
  onFileSelect: (file: File) => void;
}

export function UploadDropzone({ busy, onFileSelect }: UploadDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) {
      return;
    }

    onFileSelect(file);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        "glass-panel relative overflow-hidden rounded-[2rem] border border-dashed p-8 transition duration-300",
        dragging ? "border-brand bg-brand/10" : "border-white/12",
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-brand/20 to-transparent" />
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/*"
        className="hidden"
        onChange={handleInputChange}
      />
      <div className="relative flex flex-col gap-6 text-left">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-brand shadow-panel">
          {busy ? <LoaderCircle className="h-7 w-7 animate-spin" /> : <UploadCloud className="h-7 w-7" />}
        </div>
        <div className="space-y-2">
          <h2 className="font-display text-2xl text-white">Drop your next video here</h2>
          <p className="max-w-xl text-sm leading-6 text-white/60 sm:text-base">
            Upload a clip to generate AI subtitles, tune the styling, and export a polished creator-ready asset.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm text-white/50">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
            <Film className="h-4 w-4" /> MP4 / MOV / WebM
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2">
            <FolderUp className="h-4 w-4" /> Drag, drop, or browse
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? "Working on it…" : "Select video"}
          </button>
          <p className="self-center text-sm text-white/45">Average demo processing time: 6 seconds</p>
        </div>
      </div>
    </div>
  );
}
