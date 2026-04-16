import { create } from "zustand";

import {
  defaultStyle,
  sampleSubtitles,
  subtitlePresets,
  type ExportFormat,
  type ExportSettings,
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
  past: SubtitleCue[][];
  future: SubtitleCue[][];
  selectedSubtitleId: string;
  activePreset: SubtitlePresetId;
  style: SubtitleStyle;
  selectedFormat: ExportFormat;
  exportSettings: ExportSettings;
  startUpload: (asset: VideoAsset) => void;
  setUploadProgress: (value: number) => void;
  finishUpload: (fileName: string) => void;
  startProcessing: () => void;
  setProcessingProgress: (value: number) => void;
  completeProcessing: (subtitles: SubtitleCue[], newKeywords?: string[]) => void;
  selectSubtitle: (id: string) => void;
  updateSubtitleText: (id: string, text: string) => void;
  applyPreset: (presetId: SubtitlePresetId) => void;
  patchStyle: (stylePatch: Partial<SubtitleStyle>) => void;
  toggleKeyword: (keyword: string) => void;
  setSelectedFormat: (format: ExportFormat) => void;
  setExportSettings: (patch: Partial<ExportSettings>) => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
}

export const useSubtitleStudio = create<SubtitleStudioStore>((set) => ({
  status: "idle",
  uploadProgress: 0,
  processingProgress: 0,
  videoAsset: null,
  uploadedFile: null,
  subtitles: sampleSubtitles,
  past: [],
  future: [],
  selectedSubtitleId: sampleSubtitles[1]?.id ?? "cue-1",
  activePreset: "instagram",
  style: {
    ...defaultStyle,
    ...subtitlePresets[0].stylePatch,
  },
  selectedFormat: "mp4",
  exportSettings: {
    aspectRatio: "original",
    quality: "high",
  },
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
  completeProcessing: (subtitles, newKeywords) =>
    set((state) => ({
      status: "completed",
      processingProgress: 100,
      subtitles,
      past: [],
      future: [],
      selectedSubtitleId: subtitles[0]?.id ?? "cue-1",
      style: {
        ...state.style,
        keywords: newKeywords && newKeywords.length > 0 
           ? Array.from(new Set([...state.style.keywords, ...newKeywords]))
           : state.style.keywords
      }
    })),
  selectSubtitle: (id) => set({ selectedSubtitleId: id }),
  updateSubtitleText: (id, text) =>
    set((state) => ({
      past: [...state.past, state.subtitles],
      future: [],
      subtitles: state.subtitles.map((subtitle) =>
        subtitle.id === id ? { ...subtitle, text } : subtitle,
      ),
    })),
  undo: () => set((state) => {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    return {
      past: state.past.slice(0, state.past.length - 1),
      future: [state.subtitles, ...state.future],
      subtitles: previous
    };
  }),
  redo: () => set((state) => {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    return {
      past: [...state.past, state.subtitles],
      future: state.future.slice(1),
      subtitles: next
    };
  }),
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
  setExportSettings: (patch) =>
    set((state) => ({
      exportSettings: { ...state.exportSettings, ...patch },
    })),
  reset: () => set({
    status: "idle",
    uploadProgress: 0,
    processingProgress: 0,
    videoAsset: null,
    uploadedFile: null,
    subtitles: sampleSubtitles,
    past: [],
    future: [],
    selectedSubtitleId: sampleSubtitles[1]?.id ?? "cue-1",
  }),
}));
