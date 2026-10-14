import fs from "fs";
import path from "path";
import OpenAI, { toFile } from "openai";
import { ITranscriptionProvider, TranscriptionResult, extractKeywordsAndDecorate } from "./types";

export class GroqTranscriptionProvider implements ITranscriptionProvider {
  name = "groq";

  isAvailable(): boolean {
    return Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim().length > 5);
  }

  async transcribe(
    audioPath: string,
    sourceLanguage: string,
    targetLanguage: string,
    options?: { modelSize?: string; onProgress?: (p: number) => void }
  ): Promise<TranscriptionResult> {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not configured.");
    }

    const client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });

    options?.onProgress?.(30);

    const modelName = options?.modelSize?.includes("turbo")
      ? "whisper-large-v3-turbo"
      : "whisper-large-v3";

    const audioStream = fs.createReadStream(audioPath);
    const file = await toFile(audioStream, path.basename(audioPath));

    // Groq audio transcriptions
    const isTranslate = targetLanguage === "en" && sourceLanguage !== "en" && sourceLanguage !== "auto";

    let rawResponse: any;
    if (isTranslate) {
      rawResponse = await client.audio.translations.create({
        file,
        model: modelName,
        response_format: "verbose_json",
      });
    } else {
      rawResponse = await client.audio.transcriptions.create({
        file,
        model: modelName,
        response_format: "verbose_json",
        language: sourceLanguage !== "auto" ? sourceLanguage : undefined,
      });
    }

    options?.onProgress?.(75);

    const rawSegments = (rawResponse.segments || []).map((seg: any) => ({
      start: Number(seg.start) || 0,
      end: Number(seg.end) || 0,
      text: (seg.text || "").trim(),
    }));

    const detectedLanguage = rawResponse.language || (sourceLanguage !== "auto" ? sourceLanguage : "en");
    const { segments, keywords } = extractKeywordsAndDecorate(rawSegments);

    return {
      segments,
      detectedLanguage,
      targetLanguage,
      keywords,
      providerUsed: `Groq (${modelName})`,
    };
  }
}
