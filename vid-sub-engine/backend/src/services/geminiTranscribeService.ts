import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs";
import path from "path";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface Segment {
  start: number;
  end: number;
  text: string;
}

interface GeminiTranscriptResult {
  segments: Segment[];
  detectedLanguage: string;
  keywords: string[];
}

const EMOJI_MAP: Record<string, string> = {
  money: "💸", fast: "🚀", love: "❤️", viral: "🔥", ai: "🤖",
  export: "📤", confidence: "😎", amazing: "✨", time: "⏱️",
  hack: "🤯", secret: "🤫", pro: "💪", start: "🟢", stop: "⛔",
  video: "📹", crazy: "🤪",
};

function applyEmojisAndExtract(segments: Segment[]): { segments: Segment[], keywords: string[] } {
  const found: string[] = [];
  for (const seg of segments) {
    const words = seg.text.split(" ").map(w => {
      const clean = w.toLowerCase().replace(/[.,!?"']/g, "");
      if (EMOJI_MAP[clean]) {
        if (!found.includes(clean)) found.push(clean);
        return `${w} ${EMOJI_MAP[clean]}`;
      }
      return w;
    });
    seg.text = words.join(" ");
  }
  return { segments, keywords: found };
}

export async function geminiTranscribe(
  audioPath: string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<GeminiTranscriptResult> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not set in environment variables.");
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const audioBuffer = fs.readFileSync(audioPath);
  const base64Audio = audioBuffer.toString("base64");

  const ext = path.extname(audioPath).toLowerCase();
  const mimeType = ext === ".mp3" ? "audio/mp3" : "audio/wav";

  const srcHint = sourceLanguage === "auto"
    ? "auto-detect the source language"
    : `source language is ${sourceLanguage}`;

  const tgtHint = targetLanguage === "en"
    ? "translate everything to English"
    : `translate the transcript to ${targetLanguage}`;

  const prompt = `
You are a professional subtitle generator. Transcribe the following audio and ${tgtHint}.
The ${srcHint}.

Return ONLY a valid JSON object (no markdown, no code fences) in this exact format:
{
  "detectedLanguage": "<ISO 639-1 code of the spoken language>",
  "segments": [
    { "start": 0.0, "end": 2.5, "text": "The transcribed text here" },
    { "start": 2.5, "end": 5.0, "text": "Next subtitle line" }
  ]
}

Rules:
- Each segment should be 1-2 sentences max, suitable for subtitles
- Keep segment duration between 1-5 seconds
- Avoid very long segments
- Preserve natural speech breaks
`;

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType,
        data: base64Audio,
      },
    },
  ]);

  const responseText = result.response.text().trim();

  // Strip any accidental markdown code fences
  const cleaned = responseText.replace(/^```json\s*|```$/gm, "").trim();

  let parsed: { detectedLanguage: string; segments: Segment[] };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Gemini returned invalid JSON: ${cleaned.slice(0, 300)}`);
  }

  if (!parsed.segments || !Array.isArray(parsed.segments)) {
    throw new Error("Gemini response missing segments array");
  }

  const { segments, keywords } = applyEmojisAndExtract(parsed.segments);

  return {
    segments,
    detectedLanguage: parsed.detectedLanguage ?? "unknown",
    keywords,
  };
}
