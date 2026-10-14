"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcriptionService = exports.TranscriptionService = void 0;
const groqProvider_1 = require("./groqProvider");
const geminiProvider_1 = require("./geminiProvider");
const localWhisperProvider_1 = require("./localWhisperProvider");
function isCloudModel(model) {
    return model.includes("gemini") || model.includes("groq");
}
function localModelSize(requested) {
    if (!requested || isCloudModel(requested)) {
        return process.env.WHISPER_MODEL || "base";
    }
    return requested;
}
class TranscriptionService {
    constructor() {
        this.groq = new groqProvider_1.GroqTranscriptionProvider();
        this.gemini = new geminiProvider_1.GeminiTranscriptionProvider();
        this.local = new localWhisperProvider_1.LocalWhisperProvider();
    }
    getAvailableProviders() {
        const list = [];
        if (this.groq.isAvailable())
            list.push("groq");
        if (this.gemini.isAvailable())
            list.push("gemini");
        list.push("local-whisper");
        return list;
    }
    async transcribe(audioPath, sourceLanguage, targetLanguage, requestedModel, options) {
        const model = (requestedModel || "").trim().toLowerCase();
        const errors = [];
        const tryGroq = async () => {
            if (!this.groq.isAvailable())
                throw new Error("GROQ_API_KEY is not configured");
            console.log("[TranscriptionService] Using Groq Whisper API");
            return this.groq.transcribe(audioPath, sourceLanguage, targetLanguage, {
                modelSize: model,
                onProgress: options?.onProgress,
            });
        };
        const tryGemini = async () => {
            if (!this.gemini.isAvailable())
                throw new Error("GEMINI_API_KEY is not configured");
            console.log("[TranscriptionService] Using Gemini Flash API");
            return this.gemini.transcribe(audioPath, sourceLanguage, targetLanguage, {
                onProgress: options?.onProgress,
            });
        };
        const tryLocal = async () => {
            console.log("[TranscriptionService] Using local Python Whisper");
            return this.local.transcribe(audioPath, sourceLanguage, targetLanguage, {
                modelSize: options?.localWhisperModel || localModelSize(model),
                onProgress: options?.onProgress,
                duration: options?.duration,
            });
        };
        if (model.includes("groq") || model.includes("whisper-large-v3")) {
            try {
                return await tryGroq();
            }
            catch (err) {
                errors.push(`Groq: ${err.message}`);
                console.warn("[TranscriptionService] Groq failed:", err.message);
            }
        }
        if (model.includes("gemini")) {
            try {
                return await tryGemini();
            }
            catch (err) {
                errors.push(`Gemini: ${err.message}`);
                console.warn("[TranscriptionService] Gemini failed:", err.message);
            }
        }
        if (!isCloudModel(model) || model.includes("local")) {
            try {
                return await tryLocal();
            }
            catch (err) {
                errors.push(`Local Whisper: ${err.message}`);
                console.warn("[TranscriptionService] Local Whisper failed:", err.message);
            }
        }
        else {
            try {
                return await tryLocal();
            }
            catch (err) {
                errors.push(`Local Whisper: ${err.message}`);
                console.warn("[TranscriptionService] Local Whisper fallback failed:", err.message);
            }
        }
        if (this.groq.isAvailable() && !model.includes("groq")) {
            try {
                return await tryGroq();
            }
            catch (err) {
                errors.push(`Groq: ${err.message}`);
            }
        }
        if (this.gemini.isAvailable() && !model.includes("gemini")) {
            try {
                return await tryGemini();
            }
            catch (err) {
                errors.push(`Gemini: ${err.message}`);
            }
        }
        throw new Error(`Transcription failed. Configure GEMINI_API_KEY or GROQ_API_KEY, or install local Whisper. Details: ${errors.join(" | ")}`);
    }
}
exports.TranscriptionService = TranscriptionService;
exports.transcriptionService = new TranscriptionService();
