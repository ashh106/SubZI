"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatSrtTimestamp = formatSrtTimestamp;
exports.formatVttTimestamp = formatVttTimestamp;
exports.toSRT = toSRT;
exports.toVTT = toVTT;
exports.toPlainText = toPlainText;
exports.parseSrtContent = parseSrtContent;
function pad(n, width) {
    return n.toString().padStart(width, "0");
}
function formatSrtTimestamp(seconds) {
    const ms = Math.round((seconds % 1) * 1000);
    const total = Math.floor(seconds);
    const sec = total % 60;
    const min = Math.floor(total / 60) % 60;
    const hr = Math.floor(total / 3600);
    return `${pad(hr, 2)}:${pad(min, 2)}:${pad(sec, 2)},${pad(ms, 3)}`;
}
function formatVttTimestamp(seconds) {
    return formatSrtTimestamp(seconds).replace(",", ".");
}
function toSRT(segments) {
    return segments
        .map((seg, i) => `${i + 1}\n${formatSrtTimestamp(seg.start)} --> ${formatSrtTimestamp(seg.end)}\n${seg.text.trim()}\n`)
        .join("\n");
}
function toVTT(segments) {
    const lines = ["WEBVTT", ""];
    segments.forEach((seg, i) => {
        lines.push(`${i + 1}`, `${formatVttTimestamp(seg.start)} --> ${formatVttTimestamp(seg.end)}`, seg.text.trim(), "");
    });
    return lines.join("\n");
}
function toPlainText(segments) {
    return segments
        .map((s) => s.text.trim())
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
}
function parseSrtContent(srt) {
    const blocks = srt.replace(/\r\n/g, "\n").trim().split(/\n\s*\n/);
    const segments = [];
    for (const block of blocks) {
        const lines = block.split("\n");
        if (lines.length < 2)
            continue;
        const timeLine = lines.find((l) => l.includes("-->")) || "";
        const match = timeLine.match(/(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)/);
        if (!match)
            continue;
        const toSec = (h, m, s, ms) => parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseInt(s, 10) + parseInt(ms, 10) / 1000;
        const start = toSec(match[1], match[2], match[3], match[4]);
        const end = toSec(match[5], match[6], match[7], match[8]);
        const textStart = lines.findIndex((l) => l.includes("-->")) + 1;
        const text = lines.slice(textStart).join(" ").trim();
        if (!text)
            continue;
        segments.push({ start, end, text });
    }
    return segments;
}
