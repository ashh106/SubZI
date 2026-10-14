"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GeminiTranscriptionProvider = void 0;
const generative_ai_1 = require("@google/generative-ai");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const types_1 = require("./types");
class GeminiTranscriptionProvider {
    constructor() {
        this.name = "gemini";
    }
    isAvailable() {
        const key = process.env.GEMINI_API_KEY?.trim();
        return Boolean(key && key.length > 5);
    }
    async transcribe(audioPath, sourceLanguage, targetLanguage, options) {
        const apiKey = process.env.GEMINI_API_KEY?.trim();
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not configured.");
        }
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const modelNames = ["gemini-3.8-flash"];
        options?.onProgress?.(30);
        const audioBuffer = fs_1.default.readFileSync(audioPath);
        const base64Audio = audioBuffer.toString("base64");
        const ext = path_1.default.extname(audioPath).toLowerCase();
        const mimeType = ext === ".mp3" ? "audio/mp3" : "audio/wav";
        const srcHint = sourceLanguage === "auto"
            ? "auto-detect the spoken language"
            : `source language is ${sourceLanguage}`;
        const tgtHint = targetLanguage === "en"
            ? "translate everything to English"
            : targetLanguage === "hi"
                ? "translate/transcribe in Hindi"
                : targetLanguage === "hinglish"
                    ? "transcribe Hindi/English speech in Roman/Latin script (Hinglish)"
                    : `translate to ${targetLanguage}`;
        const prompt = `
You are a professional video subtitle transcription engine.
Task: Transcribe the audio, segmenting speech into natural subtitle cues, and ${tgtHint}.
${srcHint}.

CRITICAL: Return ONLY raw JSON without markdown fences, conforming strictly to this format:
{
  "detectedLanguage": "<ISO 639-1 code e.g. en, hi, es, fr>",
  "segments": [
    { "start": 0.0, "end": 2.4, "text": "Subtitled phrase here" },
    { "start": 2.4, "end": 5.1, "text": "Next spoken sentence" }
  ]
}

Rules:
- Exact chronological order
- Start/end timestamps must be numbers in seconds
- Never have end <= start
- Keep segment duration between 1.0 and 5.0 seconds
- Segments must cover all spoken words
`;
        options?.onProgress?.(50);
        let rawText = "";
        let lastError = null;
        for (const modelName of modelNames) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent([
                    prompt,
                    {
                        inlineData: {
                            mimeType,
                            data: base64Audio,
                        },
                    },
                ]);
                rawText = result.response.text().trim();
                lastError = null;
                break;
            }
            catch (err) {
                lastError = err;
                console.warn(`[Gemini] Model ${modelName} failed: ${err.message}`);
            }
        }
        if (!rawText) {
            throw lastError || new Error("Gemini returned an empty transcription response.");
        }
        options?.onProgress?.(80);
        const cleaned = rawText.replace(/^```json\s*|```$/gm, "").trim();
        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        }
        catch {
            throw new Error(`Gemini returned non-JSON output: ${cleaned.slice(0, 160)}`);
        }
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
            throw new Error("Gemini response must be a JSON object.");
        }
        const response = parsed;
        if (typeof response.detectedLanguage !== "string" || !response.detectedLanguage.trim()) {
            throw new Error("Gemini response is missing a valid detectedLanguage.");
        }
        if (!Array.isArray(response.segments) || response.segments.length === 0) {
            throw new Error("Gemini response is missing a nonempty segments array.");
        }
        let previousStart = -1;
        const rawSegments = response.segments.map((segment, index) => {
            if (typeof segment !== "object" || segment === null || Array.isArray(segment)) {
                throw new Error(`Gemini segment ${index + 1} must be an object.`);
            }
            const cue = segment;
            const { start, end, text } = cue;
            if (typeof start !== "number" ||
                !Number.isFinite(start) ||
                start < 0 ||
                typeof end !== "number" ||
                !Number.isFinite(end) ||
                end < 0 ||
                end <= start) {
                throw new Error(`Gemini segment ${index + 1} has invalid timestamps.`);
            }
            if (typeof text !== "string" || !text.trim()) {
                throw new Error(`Gemini segment ${index + 1} has empty or invalid text.`);
            }
            if (start < previousStart) {
                throw new Error(`Gemini segment ${index + 1} is out of chronological order.`);
            }
            previousStart = start;
            return { start, end, text: text.trim() };
        });
        const detectedLanguage = response.detectedLanguage;
        const { segments, keywords } = (0, types_1.extractKeywordsAndDecorate)(rawSegments);
        return {
            segments,
            detectedLanguage,
            targetLanguage,
            keywords,
            providerUsed: "Google Gemini 1.5 Flash",
        };
    }
}
exports.GeminiTranscriptionProvider = GeminiTranscriptionProvider;
