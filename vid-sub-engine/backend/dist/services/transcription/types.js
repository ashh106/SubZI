"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMOJI_MAP = void 0;
exports.extractKeywordsAndDecorate = extractKeywordsAndDecorate;
exports.EMOJI_MAP = {
    money: "💸", fast: "🚀", love: "❤️", viral: "🔥", ai: "🤖",
    export: "📤", confidence: "😎", amazing: "✨", time: "⏱️",
    hack: "🤯", secret: "🤫", pro: "💪", start: "🟢", stop: "⛔",
    video: "📹", crazy: "🤪", subtitles: "💬", sound: "🔊",
    paisa: "💸", pyaar: "❤️", sach: "💡", gazab: "🔥"
};
function extractKeywordsAndDecorate(segments) {
    const foundKeywords = [];
    const processed = segments.map((seg) => {
        const words = seg.text.split(/\s+/).map((word) => {
            const clean = word.toLowerCase().replace(/[.,!?"'()\[\]]/g, "");
            if (exports.EMOJI_MAP[clean]) {
                if (!foundKeywords.includes(clean)) {
                    foundKeywords.push(clean);
                }
                return `${word} ${exports.EMOJI_MAP[clean]}`;
            }
            return word;
        });
        return {
            ...seg,
            text: words.join(" "),
        };
    });
    return { segments: processed, keywords: foundKeywords };
}
