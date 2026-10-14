export interface SubtitleSegment {
  start: number;
  end: number;
  text: string;
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, "0");
}

export function formatSrtTimestamp(seconds: number): string {
  const ms = Math.round((seconds % 1) * 1000);
  const total = Math.floor(seconds);
  const sec = total % 60;
  const min = Math.floor(total / 60) % 60;
  const hr = Math.floor(total / 3600);
  return `${pad(hr, 2)}:${pad(min, 2)}:${pad(sec, 2)},${pad(ms, 3)}`;
}

export function formatVttTimestamp(seconds: number): string {
  return formatSrtTimestamp(seconds).replace(",", ".");
}

export function toSRT(segments: SubtitleSegment[]): string {
  return segments
    .map((seg, i) => `${i + 1}\n${formatSrtTimestamp(seg.start)} --> ${formatSrtTimestamp(seg.end)}\n${seg.text.trim()}\n`)
    .join("\n");
}

export function toVTT(segments: SubtitleSegment[]): string {
  const lines = ["WEBVTT", ""];
  segments.forEach((seg, i) => {
    lines.push(`${i + 1}`, `${formatVttTimestamp(seg.start)} --> ${formatVttTimestamp(seg.end)}`, seg.text.trim(), "");
  });
  return lines.join("\n");
}

export function toPlainText(segments: SubtitleSegment[]): string {
  return segments
    .map((s) => s.text.trim())
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSrtContent(srt: string): SubtitleSegment[] {
  const blocks = srt.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
  const segments: SubtitleSegment[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    if (lines.length < 2) continue;

    const timeLine = lines.find((l) => l.includes("-->")) || "";
    const match = timeLine.match(
      /(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/
    );
    if (!match) continue;

    const toSec = (h: string, m: string, s: string, ms: string) =>
      parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10) + parseInt(ms, 10) / 1000;

    const start = toSec(match[1], match[2], match[3], match[4]);
    const end = toSec(match[5], match[6], match[7], match[8]);
    const textStart = lines.findIndex((l) => l.includes("-->")) + 1;
    const text = lines.slice(textStart).join(" ").trim();
    if (!text) continue;
    segments.push({ start, end, text });
  }
  return segments;
}
