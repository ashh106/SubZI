import { SubtitleJob, ISubtitleJob, JobStatus, BurnStatus } from "./subtitleJobModel";
import mongoose from "mongoose";

export interface JobRecord {
  fileId: string;
  originalName: string;
  filename: string;
  mimetype: string;
  sizeBytes: number;
  status: JobStatus;
  progress: number;
  sourceLanguage: string;
  detectedLanguage?: string;
  targetLanguage: string;
  whisperModel?: string;
  localWhisperModel?: string;
  keywords?: string[];
  captionStyle?: {
    fontName: string;
    fontSize: number;
    color: string;
    position: string;
  };
  srtPath?: string;
  vttPath?: string;
  textPath?: string;
  burnedVideoPath?: string;
  burnStatus: BurnStatus;
  burnProgress: number;
  errorMessage?: string;
  rawSegments?: Array<{ start: number; end: number; text: string }>;
  ragApplied?: boolean;
  ragSuggestions?: Array<{
    segmentIndex: number;
    originalText: string;
    suggestedText: string;
    matchedTerms: string[];
    status: "pending" | "accepted" | "rejected";
  }>;
  uploadedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  updatedAt?: Date;
}

// In-memory fallback map for offline / local-development resilience
const memoryStore = new Map<string, JobRecord>();

function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export const JobRepository = {
  async create(data: Partial<JobRecord>): Promise<JobRecord> {
    const record: JobRecord = {
      fileId: data.fileId!,
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
        await SubtitleJob.create(record);
      } catch (err: any) {
        console.warn("[JobRepository] MongoDB write error, falling back to in-memory:", err.message);
      }
    }

    return record;
  },

  async findOne(query: { fileId: string }): Promise<JobRecord | null> {
    if (isMongoConnected()) {
      try {
        const doc = await SubtitleJob.findOne(query).lean();
        if (doc) return doc as unknown as JobRecord;
      } catch (err: any) {
        console.warn("[JobRepository] MongoDB read error, checking in-memory:", err.message);
      }
    }
    return memoryStore.get(query.fileId) || null;
  },

  async findOneAndUpdate(
    query: { fileId: string },
    update: Partial<JobRecord>
  ): Promise<JobRecord | null> {
    let existing = memoryStore.get(query.fileId);
    if (existing) {
      existing = { ...existing, ...update, updatedAt: new Date() };
      memoryStore.set(query.fileId, existing);
    } else {
      const found = await this.findOne(query);
      if (found) {
        existing = { ...found, ...update, updatedAt: new Date() };
        memoryStore.set(query.fileId, existing);
      }
    }

    if (isMongoConnected()) {
      try {
        await SubtitleJob.findOneAndUpdate(query, update, { new: true });
      } catch (err: any) {
        console.warn("[JobRepository] MongoDB update error, updated in-memory:", err.message);
      }
    }

    return existing || null;
  },

  async listRecent(limit = 20): Promise<JobRecord[]> {
    if (isMongoConnected()) {
      try {
        const docs = await SubtitleJob.find().sort({ uploadedAt: -1 }).limit(limit).lean();
        return docs as unknown as JobRecord[];
      } catch {
        // fallback to memory
      }
    }
    return Array.from(memoryStore.values())
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
      .slice(0, limit);
  },
};
