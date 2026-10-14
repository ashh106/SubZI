import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { config } from "../../config/config";
import { ITranscriptionProvider, TranscriptionResult, extractKeywordsAndDecorate } from "./types";

export class LocalWhisperProvider implements ITranscriptionProvider {
  name = "local-whisper";

  isAvailable(): boolean {
    return true; // Script is bundled with the project
  }

  async transcribe(
    audioPath: string,
    sourceLanguage: string,
    targetLanguage: string,
    options?: {
      modelSize?: string;
      onProgress?: (p: number) => void;
      duration?: number;
    }
  ): Promise<TranscriptionResult> {
    const possiblePaths = [
      path.resolve(process.cwd(), "src/workers/transcribe.py"),
      path.resolve(__dirname, "../../workers/transcribe.py"),
      path.resolve(__dirname, "../workers/transcribe.py"),
      path.resolve(__dirname, "../../../src/workers/transcribe.py"),
    ];
    const scriptPath = possiblePaths.find((p) => fs.existsSync(p)) || possiblePaths[0];
    const requested = (options?.modelSize || config.whisperModel || "base").toLowerCase();
    const modelSize = requested.includes("gemini") || requested.includes("groq")
      ? (config.whisperModel || "base")
      : requested;

    return new Promise((resolve, reject) => {
      const proc = spawn(
        config.pythonBin,
        [
          scriptPath,
          audioPath,
          sourceLanguage || "auto",
          targetLanguage || "en",
          modelSize,
          config.demucsEnabled ? "1" : "0",
          config.whisperxEnabled ? "1" : "0",
        ],
        {
          env: {
            ...process.env,
            PYTHONIOENCODING: "utf-8",
            PYTHONUTF8: "1",
          },
        }
      );

      let stdout = "";
      let stderr = "";

      proc.stdout.setEncoding("utf8");
      proc.stderr.setEncoding("utf8");

      proc.stdout.on("data", (d: string) => (stdout += d));
      proc.stderr.on("data", (d: string) => {
        stderr += d;
        if (options?.duration && options.duration > 0) {
          const tMatch = d.match(/-->\s*(?:(\d+):)?(\d+):(\d+)\.\d+\]/);
          if (tMatch) {
            const hrs = tMatch[1] ? parseInt(tMatch[1], 10) : 0;
            const mins = parseInt(tMatch[2], 10);
            const secs = parseInt(tMatch[3], 10);
            const currentSecs = hrs * 3600 + mins * 60 + secs;
            const pct = Math.min(100, Math.round((currentSecs / options.duration) * 100));
            options.onProgress?.(pct);
          }
        }
      });

      proc.on("close", (code) => {
        if (code !== 0) {
          return reject(
            new Error(`Local Python Whisper failed (exit code ${code}): ${stderr.slice(-300).trim()}`)
          );
        }

        try {
          const jsonLine = stdout.trim().split("\n").filter((l) => l.startsWith("{")).pop() || stdout.trim();
          const parsed = JSON.parse(jsonLine);
          if (parsed.error) return reject(new Error(parsed.error));

          const { segments, keywords } = extractKeywordsAndDecorate(parsed.segments || []);
          resolve({
            segments,
            detectedLanguage: parsed.detectedLanguage || "unknown",
            targetLanguage: parsed.targetLanguage || targetLanguage,
            keywords: parsed.keywords || keywords,
            providerUsed: `Local OpenAI Whisper (${modelSize})`,
          });
        } catch {
          reject(new Error(`Invalid JSON response from transcribe.py: ${stdout.slice(0, 200)}`));
        }
      });

      proc.on("error", (err) => {
        reject(new Error(`Failed to spawn Python process (${config.pythonBin}): ${err.message}`));
      });
    });
  }
}
