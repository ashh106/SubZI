"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ragCorrectionEngine = exports.RAGCorrectionEngine = void 0;
const openai_1 = __importDefault(require("openai"));
const generative_ai_1 = require("@google/generative-ai");
const retriever_1 = require("./retriever");
class RAGCorrectionEngine {
    /**
     * Generates RAG correction suggestions for segments against user glossary.
     * Never mutates raw transcript directly.
     */
    async generateCorrections(segments) {
        const suggestions = [];
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const matches = await retriever_1.contextRetriever.retrieveForText(seg.text, 0.70);
            if (matches.length === 0)
                continue;
            const matchedTerms = matches.map((m) => m.entry.term);
            // Check if text already contains the exact intended replacement
            const needsCorrection = matches.some((m) => {
                const replacement = m.entry.replacement || m.entry.term;
                return !seg.text.includes(replacement);
            });
            if (!needsCorrection)
                continue;
            // Try LLM contextual correction if available
            let correctedText = null;
            if (process.env.GROQ_API_KEY) {
                correctedText = await this.correctWithGroq(seg.text, matches);
            }
            else if (process.env.GEMINI_API_KEY) {
                correctedText = await this.correctWithGemini(seg.text, matches);
            }
            // If no LLM or LLM failed, use deterministic term alignment
            if (!correctedText) {
                correctedText = this.deterministicAlign(seg.text, matches);
            }
            if (correctedText && correctedText.trim() !== seg.text.trim()) {
                suggestions.push({
                    segmentIndex: i,
                    originalText: seg.text,
                    suggestedText: correctedText,
                    matchedTerms,
                    status: "pending",
                });
            }
        }
        return suggestions;
    }
    deterministicAlign(text, matches) {
        let result = text;
        for (const match of matches) {
            const replacement = match.entry.replacement || match.entry.term;
            const candidates = [
                match.matchedOn,
                ...(match.entry.soundsLike || []),
            ].filter(Boolean);
            for (const cand of candidates) {
                if (!cand)
                    continue;
                const regex = new RegExp(`\\b${escapeRegExp(cand)}\\b`, "gi");
                if (regex.test(result)) {
                    result = result.replace(regex, replacement);
                }
            }
        }
        return result;
    }
    async correctWithGroq(text, matches) {
        try {
            const client = new openai_1.default({
                apiKey: process.env.GROQ_API_KEY?.trim(),
                baseURL: "https://api.groq.com/openai/v1",
            });
            const glossaryContext = matches
                .map((m) => `- Term: "${m.entry.term}", Preferred: "${m.entry.replacement || m.entry.term}" (Category: ${m.entry.category}, Context: ${m.entry.context || "none"})`)
                .join("\n");
            const response = await client.chat.completions.create({
                model: "llama-3.1-8b-instant",
                temperature: 0.1,
                messages: [
                    {
                        role: "system",
                        content: `You are a subtitle transcription editor. You are given a subtitle line and verified glossary terms.
Rules:
1. Replace misheard names, brands, tech terms, or acronyms with the exact preferred spelling.
2. DO NOT change words that are unrelated to the glossary.
3. DO NOT add extra commentary or explanations. Return ONLY the corrected subtitle sentence.`,
                    },
                    {
                        role: "user",
                        content: `Glossary:\n${glossaryContext}\n\nOriginal subtitle line: "${text}"`,
                    },
                ],
            });
            const output = response.choices[0]?.message?.content?.trim();
            return output ? output.replace(/^"|"$/g, "") : null;
        }
        catch {
            return null;
        }
    }
    async correctWithGemini(text, matches) {
        try {
            const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY.trim());
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const glossaryContext = matches
                .map((m) => `- Term: "${m.entry.term}", Preferred: "${m.entry.replacement || m.entry.term}"`)
                .join("\n");
            const prompt = `You are a subtitle editor. Correct misrecognized terms in this subtitle line using the glossary.
Glossary:
${glossaryContext}

Original line: "${text}"

Return ONLY the corrected sentence. No markdown, no quotes.`;
            const res = await model.generateContent(prompt);
            const output = res.response.text().trim();
            return output ? output.replace(/^"|"$/g, "") : null;
        }
        catch {
            return null;
        }
    }
}
exports.RAGCorrectionEngine = RAGCorrectionEngine;
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
exports.ragCorrectionEngine = new RAGCorrectionEngine();
