import { TranscriptionResult } from "./types";
import { GroqTranscriptionProvider } from "./groqProvider";
import { GeminiTranscriptionProvider } from "./geminiProvider";
import { LocalWhisperProvider } from "./localWhisperProvider";

function isCloudModel(model: string): boolean {
  return model.includes("gemini") || model.includes("groq");
}

function localModelSize(requested: string): string {
  if (!requested || isCloudModel(requested)) {
    return process.env.WHISPER_MODEL || "base";
  }
  return requested;
}

export class TranscriptionService {
  private groq = new GroqTranscriptionProvider();
  private gemini = new GeminiTranscriptionProvider();
  private local = new LocalWhisperProvider();

  getAvailableProviders(): string[] {
    const list: string[] = [];
    if (this.groq.isAvailable()) list.push("groq");
    if (this.gemini.isAvailable()) list.push("gemini");
    list.push("local-whisper");
    return list;
  }

  async transcribe(
    audioPath: string,
    sourceLanguage: string,
    targetLanguage: string,
    requestedModel?: string,
    options?: { onProgress?: (p: number) => void; duration?: number; localWhisperModel?: string }
  ): Promise<TranscriptionResult> {
    const model = (requestedModel || "").trim().toLowerCase();
    const errors: string[] = [];

    const tryGroq = async () => {
      if (!this.groq.isAvailable()) throw new Error("GROQ_API_KEY is not configured");
      console.log("[TranscriptionService] Using Groq Whisper API");
      return this.groq.transcribe(audioPath, sourceLanguage, targetLanguage, {
        modelSize: model,
        onProgress: options?.onProgress,
      });
    };

    const tryGemini = async () => {
      if (!this.gemini.isAvailable()) throw new Error("GEMINI_API_KEY is not configured");
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
      } catch (err: any) {
        errors.push(`Groq: ${err.message}`);
        console.warn("[TranscriptionService] Groq failed:", err.message);
      }
    }

    if (model.includes("gemini")) {
      try {
        return await tryGemini();
      } catch (err: any) {
        errors.push(`Gemini: ${err.message}`);
        console.warn("[TranscriptionService] Gemini failed:", err.message);
      }
    }

    if (!isCloudModel(model) || model.includes("local")) {
      try {
        return await tryLocal();
      } catch (err: any) {
        errors.push(`Local Whisper: ${err.message}`);
        console.warn("[TranscriptionService] Local Whisper failed:", err.message);
      }
    } else {
      try {
        return await tryLocal();
      } catch (err: any) {
        errors.push(`Local Whisper: ${err.message}`);
        console.warn("[TranscriptionService] Local Whisper fallback failed:", err.message);
      }
    }

    if (this.groq.isAvailable() && !model.includes("groq")) {
      try {
        return await tryGroq();
      } catch (err: any) {
        errors.push(`Groq: ${err.message}`);
      }
    }

    if (this.gemini.isAvailable() && !model.includes("gemini")) {
      try {
        return await tryGemini();
      } catch (err: any) {
        errors.push(`Gemini: ${err.message}`);
      }
    }

    throw new Error(
      `Transcription failed. Configure GEMINI_API_KEY or GROQ_API_KEY, or install local Whisper. Details: ${errors.join(" | ")}`
    );
  }
}

export const transcriptionService = new TranscriptionService();
