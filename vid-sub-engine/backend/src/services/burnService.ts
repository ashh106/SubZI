import fs from "fs";
import { spawn } from "child_process";
import { parseSrtContent } from "../utils/subtitleFormat";

export interface BurnStyleOptions {
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  highlightColor?: string;
  align?: "center" | "left" | "right";
  uppercase?: boolean;
}

export interface BurnExportSettings {
  aspectRatio?: "original" | "16:9" | "9:16" | "1:1";
  quality?: "high" | "medium" | "low";
}

// Convert CSS Hex color (#RRGGBB) to ASS color format (&H00BBGGRR)
export function hexToAssColor(hex: string, alpha = "00"): string {
  const clean = (hex || "#FFFFFF").replace("#", "").trim();
  if (clean.length !== 6) return "&H00FFFFFF";
  const r = clean.slice(0, 2);
  const g = clean.slice(2, 4);
  const b = clean.slice(4, 6);
  return `&H${alpha}${b}${g}${r}`.toUpperCase();
}

function secToAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor(Math.round((seconds % 1) * 100)); // centiseconds (2 digits)
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

/**
 * Generates an Advanced SubStation Alpha (.ass) subtitle file.
 * This guarantees consistent styling, correct margins, and crisp text rendering.
 */
export function generateAssFile(
  segments: Array<{ start: number; end: number; text: string }>,
  style: BurnStyleOptions,
  outputPath: string
): void {
    const font = style.fontFamily === "creative"
    ? "Impact"
    : style.fontFamily === "display"
    ? "Arial Black"
    : "Arial";

  const fontSize = style.fontSize || 28;
  const primaryColor = hexToAssColor(style.color || "#FFFFFF");
  const outlineColor = "&H00000000"; // Black outline
  const backColor = "&H80000000";    // Semi-transparent shadow

  const alignment = style.align === "left" ? 1 : style.align === "right" ? 3 : 2; // 2 = bottom-center

  const assContent = `[Script Info]
Title: SubZI Generated Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: None
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${font},${fontSize * 2},${primaryColor},&H000000FF,${outlineColor},${backColor},-1,0,0,0,100,100,0,0,1,3,2,${alignment},60,60,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
${segments
  .map((seg) => {
    let text = seg.text.trim();
    if (style.uppercase) text = text.toUpperCase();
    // Escape special ASS chars
    text = text.replace(/\\/g, "\\\\").replace(/\{/g, "\\{").replace(/\}/g, "\\}").replace(/\n/g, "\\N");
    return `Dialogue: 0,${secToAssTime(seg.start)},${secToAssTime(seg.end)},Default,,0,0,0,,${text}`;
  })
  .join("\n")}
`;

  fs.writeFileSync(outputPath, assContent, "utf-8");
}

export function parseSrtFile(srtPath: string): Array<{ start: number; end: number; text: string }> {
  return parseSrtContent(fs.readFileSync(srtPath, "utf-8"));
}

/**
 * Burns subtitles into video using FFmpeg and returns a Promise that completes when rendering finishes.
 */
export function executeVideoBurn(
  videoPath: string,
  assPath: string,
  outputPath: string,
  exportSettings?: BurnExportSettings,
  onProgress?: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Escape Windows path for FFmpeg filter argument
    const safeAssPath = assPath.replace(/\\/g, "/").replace(/:/g, "\\:");

    let vf = `ass='${safeAssPath}'`;

    if (exportSettings?.aspectRatio === "9:16") {
      vf = `crop=ih*(9/16):ih,${vf}`;
    } else if (exportSettings?.aspectRatio === "16:9") {
      vf = `crop=iw:iw*(9/16),${vf}`;
    } else if (exportSettings?.aspectRatio === "1:1") {
      vf = `crop=in_h:in_h,${vf}`;
    }

    let bitrate = "3500k";
    if (exportSettings?.quality === "high") bitrate = "6000k";
    if (exportSettings?.quality === "low") bitrate = "1200k";

    console.log(`[BurnService] Starting FFmpeg render: ${videoPath} -> ${outputPath}`);
    console.log(`[BurnService] Video filter: ${vf}`);

    const args = [
      "-i", videoPath,
      "-vf", vf,
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-b:v", bitrate,
      "-c:a", "aac",
      "-b:a", "192k",
      "-movflags", "+faststart",
      "-y", outputPath,
    ];

    const proc = spawn("ffmpeg", args);
    let stderr = "";

    proc.stderr.on("data", (chunk: Buffer) => {
      const str = chunk.toString();
      stderr += str;
      const durationMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+)\.(\d+)/);
      const timeMatch = str.match(/time=(\d+):(\d+):(\d+)\.(\d+)/);
      if (timeMatch && onProgress) {
        const now =
          parseInt(timeMatch[1], 10) * 3600 +
          parseInt(timeMatch[2], 10) * 60 +
          parseInt(timeMatch[3], 10);
        let duration = 0;
        if (durationMatch) {
          duration =
            parseInt(durationMatch[1], 10) * 3600 +
            parseInt(durationMatch[2], 10) * 60 +
            parseInt(durationMatch[3], 10);
        }
        const pct = duration > 0 ? Math.min(99, Math.round((now / duration) * 100)) : 50;
        onProgress(pct);
      }
    });

    proc.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
        console.log(`[BurnService] ✅ Render successful: ${outputPath} (${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB)`);
        resolve();
      } else {
        const errorMsg = `FFmpeg burn failed with exit code ${code}. Error detail: ${stderr.slice(-400).trim()}`;
        console.error(`[BurnService] ❌ ${errorMsg}`);
        reject(new Error(errorMsg));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn FFmpeg: ${err.message}`));
    });
  });
}
