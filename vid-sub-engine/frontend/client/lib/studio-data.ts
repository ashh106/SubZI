export type StudioStatus = "idle" | "uploading" | "processing" | "completed";
export type SubtitlePresetId = "instagram" | "youtube" | "reel";
export type SubtitleFont = "sans" | "display" | "creative";
export type AspectRatio = "original" | "16:9" | "9:16" | "1:1";
export type VideoQuality = "high" | "medium" | "low";
export type ExportFormat = "mp4" | "srt";

export interface ExportSettings {
  aspectRatio: AspectRatio;
  quality: VideoQuality;
}

export interface SubtitleCue {
  id: string;
  start: number;
  end: number;
  text: string;
}

export interface SubtitleStyle {
  fontFamily: SubtitleFont;
  fontSize: number;
  color: string;
  highlightColor: string;
  align: "center" | "left";
  uppercase: boolean;
  keywords: string[];
}

export interface SubtitlePreset {
  id: SubtitlePresetId;
  label: string;
  summary: string;
  stylePatch: Partial<SubtitleStyle>;
}

export const sampleSubtitles: SubtitleCue[] = [
  {
    id: "cue-1",
    start: 0,
    end: 2.4,
    text: "Hey guys welcome back — today we're turning long videos into viral clips.",
  },
  {
    id: "cue-2",
    start: 2.4,
    end: 5.8,
    text: "This is how you go viral with AI subtitles that feel fast, premium, and creator-first.",
  },
  {
    id: "cue-3",
    start: 5.8,
    end: 8.8,
    text: "Drop in your footage, polish every line, and export a clean MP4 or SRT in minutes.",
  },
  {
    id: "cue-4",
    start: 8.8,
    end: 11.6,
    text: "Highlight the words that matter, match your platform style, and post with confidence.",
  },
];

export const defaultStyle: SubtitleStyle = {
  fontFamily: "display",
  fontSize: 34,
  color: "#F8FAFC",
  highlightColor: "#8B5CF6",
  align: "center",
  uppercase: false,
  keywords: ["viral", "AI", "export", "confidence"],
};

export const subtitlePresets: SubtitlePreset[] = [
  {
    id: "instagram",
    label: "Instagram",
    summary: "Bold captions with punchy highlights for reels.",
    stylePatch: {
      fontFamily: "display",
      fontSize: 38,
      uppercase: true,
      highlightColor: "#F97316",
      align: "center",
    },
  },
  {
    id: "youtube",
    label: "YouTube",
    summary: "Readable and balanced for long-form content.",
    stylePatch: {
      fontFamily: "sans",
      fontSize: 32,
      uppercase: false,
      highlightColor: "#38BDF8",
      align: "center",
    },
  },
  {
    id: "reel",
    label: "Reel",
    summary: "High-energy stacked type tuned for short-form hooks.",
    stylePatch: {
      fontFamily: "creative",
      fontSize: 40,
      uppercase: true,
      highlightColor: "#A855F7",
      align: "left",
    },
  },
];

export const dashboardSteps = [
  {
    title: "Upload",
    description: "Securely add MP4, MOV, or WebM footage.",
  },
  {
    title: "Process",
    description: "AI detects speech, pacing, and keyword moments.",
  },
  {
    title: "Polish",
    description: "Edit lines, apply presets, and export your final cut.",
  },
];

export function formatTimestamp(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  const milliseconds = Math.round((value % 1) * 1000);

  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}.${milliseconds.toString().padStart(3, "0")}`;
}

export function formatClock(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
