import { create } from "zustand";

import {
  defaultStyle,
  sampleSubtitles,
  subtitlePresets,
  type ExportFormat,
  type StudioStatus,
  type SubtitleCue,
  type SubtitlePresetId,
  type SubtitleStyle,
} from "@/lib/studio-data";

interface VideoAsset {
  fileName: string;
  previewUrl: string;
  size: number;
  type: string;
}

interface SubtitleStudioStore {
  status: StudioStatus;
  uploadProgress: number;
  processingProgress: number;
  videoAsset: VideoAsset | null;
  uploadedFile: string | null;
  subtitles: SubtitleCue[];
  selectedSubtitleId: string;
  activePreset: SubtitlePresetId;
  style: SubtitleStyle;
  selectedFormat: ExportFormat;
  startUpload: (asset: VideoAsset) => void;
  setUploadProgress: (value: number) => void;
  finishUpload: (fileName: string) => void;
  startProcessing: () => void;
  setProcessingProgress: (value: number) => void;
  completeProcessing: (subtitles: SubtitleCue[]) => void;
  selectSubtitle: (id: string) => void;
  updateSubtitleText: (id: string, text: string) => void;
  applyPreset: (presetId: SubtitlePresetId) => void;
  patchStyle: (stylePatch: Partial<SubtitleStyle>) => void;
  toggleKeyword: (keyword: string) => void;
  setSelectedFormat: (format: ExportFormat) => void;
}

export const useSubtitleStudio = create<SubtitleStudioStore>((set) => ({
  status: "idle",
  uploadProgress: 0,
  processingProgress: 0,
  videoAsset: null,
  uploadedFile: null,
  subtitles: sampleSubtitles,
  selectedSubtitleId: sampleSubtitles[1]?.id ?? "cue-1",
  activePreset: "instagram",
  style: {
    ...defaultStyle,
    ...subtitlePresets[0].stylePatch,
  },
  selectedFormat: "mp4",
  startUpload: (asset) =>
    set({
      videoAsset: asset,
      uploadedFile: null,
      status: "uploading",
      uploadProgress: 0,
      processingProgress: 0,
      selectedFormat: "mp4",
    }),
  setUploadProgress: (value) => set({ uploadProgress: value }),
  finishUpload: (fileName) =>
    set({
      uploadedFile: fileName,
      uploadProgress: 100,
    }),
  startProcessing: () =>
    set({
      status: "processing",
      processingProgress: 0,
    }),
  setProcessingProgress: (value) => set({ processingProgress: value }),
  completeProcessing: (subtitles) =>
    set({
      status: "completed",
      processingProgress: 100,
      subtitles,
      selectedSubtitleId: subtitles[0]?.id ?? "cue-1",
    }),
  selectSubtitle: (id) => set({ selectedSubtitleId: id }),
  updateSubtitleText: (id, text) =>
    set((state) => ({
      subtitles: state.subtitles.map((subtitle) =>
        subtitle.id === id ? { ...subtitle, text } : subtitle,
      ),
    })),
  applyPreset: (presetId) =>
    set((state) => {
      const preset = subtitlePresets.find((entry) => entry.id === presetId);
      if (!preset) {
        return state;
      }

      return {
        activePreset: presetId,
        style: {
          ...state.style,
          ...preset.stylePatch,
        },
      };
    }),
  patchStyle: (stylePatch) =>
    set((state) => ({
      style: {
        ...state.style,
        ...stylePatch,
      },
    })),
  toggleKeyword: (keyword) =>
    set((state) => {
      const exists = state.style.keywords.includes(keyword);
      return {
        style: {
          ...state.style,
          keywords: exists
            ? state.style.keywords.filter((entry) => entry !== keyword)
            : [...state.style.keywords, keyword],
        },
      };
    }),
  setSelectedFormat: (format) => set({ selectedFormat: format }),
}));
