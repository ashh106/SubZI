"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocalWhisperProvider = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const config_1 = require("../../config/config");
const types_1 = require("./types");
class LocalWhisperProvider {
    constructor() {
        this.name = "local-whisper";
    }
    isAvailable() {
        return true; // Script is bundled with the project
    }
    async transcribe(audioPath, sourceLanguage, targetLanguage, options) {
        const possiblePaths = [
            path_1.default.resolve(process.cwd(), "src/workers/transcribe.py"),
            path_1.default.resolve(__dirname, "../../workers/transcribe.py"),
            path_1.default.resolve(__dirname, "../workers/transcribe.py"),
            path_1.default.resolve(__dirname, "../../../src/workers/transcribe.py"),
        ];
        const scriptPath = possiblePaths.find((p) => fs_1.default.existsSync(p)) || possiblePaths[0];
        const requested = (options?.modelSize || config_1.config.whisperModel || "base").toLowerCase();
        const modelSize = requested.includes("gemini") || requested.includes("groq")
            ? (config_1.config.whisperModel || "base")
            : requested;
        return new Promise((resolve, reject) => {
            const proc = (0, child_process_1.spawn)(config_1.config.pythonBin, [
                scriptPath,
                audioPath,
                sourceLanguage || "auto",
                targetLanguage || "en",
                modelSize,
                config_1.config.demucsEnabled ? "1" : "0",
                config_1.config.whisperxEnabled ? "1" : "0",
            ], {
                env: {
                    ...process.env,
                    PYTHONIOENCODING: "utf-8",
                    PYTHONUTF8: "1",
                },
            });
            let stdout = "";
            let stderr = "";
            proc.stdout.setEncoding("utf8");
            proc.stderr.setEncoding("utf8");
            proc.stdout.on("data", (d) => (stdout += d));
            proc.stderr.on("data", (d) => {
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
                    return reject(new Error(`Local Python Whisper failed (exit code ${code}): ${stderr.slice(-300).trim()}`));
                }
                try {
                    const jsonLine = stdout.trim().split("\n").filter((l) => l.startsWith("{")).pop() || stdout.trim();
                    const parsed = JSON.parse(jsonLine);
                    if (parsed.error)
                        return reject(new Error(parsed.error));
                    const { segments, keywords } = (0, types_1.extractKeywordsAndDecorate)(parsed.segments || []);
                    resolve({
                        segments,
                        detectedLanguage: parsed.detectedLanguage || "unknown",
                        targetLanguage: parsed.targetLanguage || targetLanguage,
                        keywords: parsed.keywords || keywords,
                        providerUsed: `Local OpenAI Whisper (${modelSize})`,
                    });
                }
                catch {
                    reject(new Error(`Invalid JSON response from transcribe.py: ${stdout.slice(0, 200)}`));
                }
            });
            proc.on("error", (err) => {
                reject(new Error(`Failed to spawn Python process (${config_1.config.pythonBin}): ${err.message}`));
            });
        });
    }
}
exports.LocalWhisperProvider = LocalWhisperProvider;
