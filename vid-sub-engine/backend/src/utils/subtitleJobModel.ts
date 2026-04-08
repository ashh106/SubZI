import mongoose, { Schema, Document } from "mongoose";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface ISubtitleJob extends Document {
  fileId: string;           // UUID (from filename without ext)
  originalName: string;
  filename: string;         // stored file on disk
  mimetype: string;
  sizeBytes: number;
  status: JobStatus;
  sourceLanguage: string;   // "auto" or ISO code (what user sent)
  detectedLanguage?: string;// what Whisper auto-detected
  targetLanguage: string;   // output language ("en", "hi", "ur"...)
  srtPath?: string;
  vttPath?: string;
  burnedVideoPath?: string; // path to video with burned-in subtitles
  errorMessage?: string;
  uploadedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

const SubtitleJobSchema = new Schema<ISubtitleJob>(
  {
    fileId:       { type: String, required: true, unique: true, index: true },
    originalName: { type: String, required: true },
    filename:     { type: String, required: true },
    mimetype:     { type: String, required: true },
    sizeBytes:    { type: Number, required: true },
    status:           { type: String, enum: ["pending","processing","completed","failed"], default: "pending" },
    sourceLanguage:   { type: String, default: "auto" },
    detectedLanguage: { type: String },
    targetLanguage:   { type: String, default: "en" },
    srtPath:          { type: String },
    vttPath:          { type: String },
    burnedVideoPath:  { type: String },
    errorMessage:     { type: String },
    uploadedAt:   { type: Date, default: Date.now },
    startedAt:    { type: Date },
    completedAt:  { type: Date },
  },
  { timestamps: true }
);

export const SubtitleJob = mongoose.model<ISubtitleJob>("SubtitleJob", SubtitleJobSchema);
