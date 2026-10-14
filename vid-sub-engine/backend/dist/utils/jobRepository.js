"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobRepository = void 0;
const subtitleJobModel_1 = require("./subtitleJobModel");
const mongoose_1 = __importDefault(require("mongoose"));
// In-memory fallback map for offline / local-development resilience
const memoryStore = new Map();
function isMongoConnected() {
    return mongoose_1.default.connection.readyState === 1;
}
exports.JobRepository = {
    async create(data) {
        const record = {
            fileId: data.fileId,
            originalName: data.originalName || "video.mp4",
            filename: data.filename || "",
            mimetype: data.mimetype || "video/mp4",
            sizeBytes: data.sizeBytes || 0,
            status: data.status || "pending",
            progress: data.progress || 0,
            sourceLanguage: data.sourceLanguage || "auto",
            detectedLanguage: data.detectedLanguage,
            targetLanguage: data.targetLanguage || "en",
            whisperModel: data.whisperModel,
            localWhisperModel: data.localWhisperModel,
            keywords: data.keywords || [],
            captionStyle: data.captionStyle || {
                fontName: "Arial",
                fontSize: 24,
                color: "#FFFFFF",
                position: "bottom",
            },
            srtPath: data.srtPath,
            vttPath: data.vttPath,
            textPath: data.textPath,
            burnedVideoPath: data.burnedVideoPath,
            burnStatus: data.burnStatus || "none",
            burnProgress: data.burnProgress || 0,
            errorMessage: data.errorMessage,
            rawSegments: data.rawSegments,
            ragApplied: false,
            ragSuggestions: [],
            uploadedAt: new Date(),
            startedAt: data.startedAt,
            completedAt: data.completedAt,
            updatedAt: new Date(),
        };
        memoryStore.set(record.fileId, { ...record });
        if (isMongoConnected()) {
            try {
                await subtitleJobModel_1.SubtitleJob.create(record);
            }
            catch (err) {
                console.warn("[JobRepository] MongoDB write error, falling back to in-memory:", err.message);
            }
        }
        return record;
    },
    async findOne(query) {
        if (isMongoConnected()) {
            try {
                const doc = await subtitleJobModel_1.SubtitleJob.findOne(query).lean();
                if (doc)
                    return doc;
            }
            catch (err) {
                console.warn("[JobRepository] MongoDB read error, checking in-memory:", err.message);
            }
        }
        return memoryStore.get(query.fileId) || null;
    },
    async findOneAndUpdate(query, update) {
        let existing = memoryStore.get(query.fileId);
        if (existing) {
            existing = { ...existing, ...update, updatedAt: new Date() };
            memoryStore.set(query.fileId, existing);
        }
        else {
            const found = await this.findOne(query);
            if (found) {
                existing = { ...found, ...update, updatedAt: new Date() };
                memoryStore.set(query.fileId, existing);
            }
        }
        if (isMongoConnected()) {
            try {
                await subtitleJobModel_1.SubtitleJob.findOneAndUpdate(query, update, { new: true });
            }
            catch (err) {
                console.warn("[JobRepository] MongoDB update error, updated in-memory:", err.message);
            }
        }
        return existing || null;
    },
    async listRecent(limit = 20) {
        if (isMongoConnected()) {
            try {
                const docs = await subtitleJobModel_1.SubtitleJob.find().sort({ uploadedAt: -1 }).limit(limit).lean();
                return docs;
            }
            catch {
                // fallback to memory
            }
        }
        return Array.from(memoryStore.values())
            .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
            .slice(0, limit);
    },
};
