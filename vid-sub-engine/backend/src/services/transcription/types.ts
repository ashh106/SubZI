export interface TranscriptSegment {
  start: number; // in seconds, e.g. 1.25
  end: number;   // in seconds, e.g. 3.80
  text: string;
}

export interface TranscriptionResult {
  segments: TranscriptSegment[];
  detectedLanguage: string;
  targetLanguage: string;
  keywords: string[];
  providerUsed: string;
}

export interface ITranscriptionProvider {
  name: string;
  isAvailable(): boolean;
  transcribe(
    audioPath: string,
    sourceLanguage: string,
    targetLanguage: string,
    options?: {
      modelSize?: string;
      onProgress?: (progress: number) => void;
      duration?: number;
    }
  ): Promise<TranscriptionResult>;
}

export const EMOJI_MAP: Record<string, string> = {
  money: "💸", fast: "🚀", love: "❤️", viral: "🔥", ai: "🤖",
  export: "📤", confidence: "😎", amazing: "✨", time: "⏱️",
  hack: "🤯", secret: "🤫", pro: "💪", start: "🟢", stop: "⛔",
  video: "📹", crazy: "🤪", subtitles: "💬", sound: "🔊",
  paisa: "💸", pyaar: "❤️", sach: "💡", gazab: "🔥"
};

export function extractKeywordsAndDecorate(segments: TranscriptSegment[]): {
  segments: TranscriptSegment[];
  keywords: string[];
} {
  const foundKeywords: string[] = [];
  const processed = segments.map((seg) => {
    const words = seg.text.split(/\s+/).map((word) => {
      const clean = word.toLowerCase().replace(/[.,!?"'()\[\]]/g, "");
      if (EMOJI_MAP[clean]) {
        if (!foundKeywords.includes(clean)) {
          foundKeywords.push(clean);
        }
        return `${word} ${EMOJI_MAP[clean]}`;
      }
      return word;
    });
    return {
      ...seg,
      text: words.join(" "),
    };
  });

  return { segments: processed, keywords: foundKeywords };
}
