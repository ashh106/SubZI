"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroqTranscriptionProvider = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const openai_1 = __importStar(require("openai"));
const types_1 = require("./types");
class GroqTranscriptionProvider {
    constructor() {
        this.name = "groq";
    }
    isAvailable() {
        return Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 5);
    }
    async transcribe(audioPath, sourceLanguage, targetLanguage, options) {
        const apiKey = process.env.GROQ_API_KEY?.trim();
        if (!apiKey) {
            throw new Error("GROQ_API_KEY is not configured.");
        }
        const client = new openai_1.default({
            apiKey,
            baseURL: "https://api.groq.com/openai/v1",
        });
        options?.onProgress?.(30);
        const modelName = options?.modelSize?.includes("turbo")
            ? "whisper-large-v3-turbo"
            : "whisper-large-v3";
        const audioStream = fs_1.default.createReadStream(audioPath);
        const file = await (0, openai_1.toFile)(audioStream, path_1.default.basename(audioPath));
        // Groq audio transcriptions
        const isTranslate = targetLanguage === "en" && sourceLanguage !== "en" && sourceLanguage !== "auto";
        let rawResponse;
        if (isTranslate) {
            rawResponse = await client.audio.translations.create({
                file,
                model: modelName,
                response_format: "verbose_json",
            });
        }
        else {
            rawResponse = await client.audio.transcriptions.create({
                file,
                model: modelName,
                response_format: "verbose_json",
                language: sourceLanguage !== "auto" ? sourceLanguage : undefined,
            });
        }
        options?.onProgress?.(75);
        const rawSegments = (rawResponse.segments || []).map((seg) => ({
            start: Number(seg.start) || 0,
            end: Number(seg.end) || 0,
            text: (seg.text || "").trim(),
        }));
        const detectedLanguage = rawResponse.language || (sourceLanguage !== "auto" ? sourceLanguage : "en");
        const { segments, keywords } = (0, types_1.extractKeywordsAndDecorate)(rawSegments);
        return {
            segments,
            detectedLanguage,
            targetLanguage,
            keywords,
            providerUsed: `Groq (${modelName})`,
        };
    }
}
exports.GroqTranscriptionProvider = GroqTranscriptionProvider;
