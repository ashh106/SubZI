"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.contextRetriever = exports.ContextRetriever = void 0;
const glossaryStore_1 = require("./glossaryStore");
// Lightweight Levenshtein distance for fuzzy phonetic matching
function levenshteinDistance(a, b) {
    const an = a ? a.length : 0;
    const bn = b ? b.length : 0;
    if (an === 0)
        return bn;
    if (bn === 0)
        return an;
    const matrix = Array.from({ length: bn + 1 }, (_, i) => [i]);
    for (let j = 0; j <= an; j++)
        matrix[0][j] = j;
    for (let i = 1; i <= bn; i++) {
        for (let j = 1; j <= an; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            }
            else {
                matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, // substitution
                matrix[i][j - 1] + 1, // insertion
                matrix[i - 1][j] + 1 // deletion
                );
            }
        }
    }
    return matrix[bn][an];
}
function stringSimilarity(s1, s2) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;
    if (longer.length === 0)
        return 1.0;
    return (longer.length - levenshteinDistance(longer, shorter)) / longer.length;
}
class ContextRetriever {
    /**
     * Retrieves relevant glossary terms for a given segment text.
     * Matches against primary term, target replacement, and soundsLike phonetic aliases.
     */
    async retrieveForText(segmentText, minScore = 0.5) {
        const glossary = await glossaryStore_1.GlossaryStore.list();
        const results = [];
        const normText = segmentText.toLowerCase().replace(/[.,!?"']/g, "");
        const words = normText.split(/\s+/);
        for (const entry of glossary) {
            const candidates = [
                entry.term.toLowerCase(),
                entry.replacement?.toLowerCase() || "",
                ...(entry.soundsLike || []).map((s) => s.toLowerCase()),
            ].filter(Boolean);
            let bestScore = 0;
            let matchedCandidate = "";
            for (const candidate of candidates) {
                // Exact substring match
                if (normText.includes(candidate)) {
                    bestScore = Math.max(bestScore, 1.0);
                    matchedCandidate = candidate;
                    break;
                }
                // Token n-gram match
                const candWords = candidate.split(/\s+/);
                if (candWords.length === 1) {
                    for (const word of words) {
                        const sim = stringSimilarity(word, candidate);
                        if (sim > bestScore) {
                            bestScore = sim;
                            matchedCandidate = candidate;
                        }
                    }
                }
                else if (candWords.length <= words.length) {
                    // Slide window across words
                    for (let i = 0; i <= words.length - candWords.length; i++) {
                        const windowPhrase = words.slice(i, i + candWords.length).join(" ");
                        const sim = stringSimilarity(windowPhrase, candidate);
                        if (sim > bestScore) {
                            bestScore = sim;
                            matchedCandidate = candidate;
                        }
                    }
                }
            }
            if (bestScore >= minScore) {
                results.push({
                    entry,
                    score: Math.round(bestScore * 100) / 100,
                    matchedOn: matchedCandidate,
                });
            }
        }
        // Sort by score descending
        return results.sort((a, b) => b.score - a.score);
    }
}
exports.ContextRetriever = ContextRetriever;
exports.contextRetriever = new ContextRetriever();
