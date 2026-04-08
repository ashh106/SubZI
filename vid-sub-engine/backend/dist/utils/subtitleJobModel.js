"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubtitleJob = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const SubtitleJobSchema = new mongoose_1.Schema({
    fileId: { type: String, required: true, unique: true, index: true },
    originalName: { type: String, required: true },
    filename: { type: String, required: true },
    mimetype: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    status: { type: String, enum: ["pending", "queued", "processing", "completed", "failed"], default: "pending" },
    progress: { type: Number, default: 0 },
    sourceLanguage: { type: String, default: "auto" },
    detectedLanguage: { type: String },
    targetLanguage: { type: String, default: "en" },
    captionStyle: {
        fontName: { type: String, default: "Arial" },
        fontSize: { type: Number, default: 24 },
        color: { type: String, default: "#FFFFFF" },
        position: { type: String, default: "bottom" },
    },
    srtPath: { type: String },
    vttPath: { type: String },
    textPath: { type: String },
    burnedVideoPath: { type: String },
    burnStatus: { type: String, enum: ["none", "pending", "processing", "completed", "failed"], default: "none" },
    burnProgress: { type: Number, default: 0 },
    errorMessage: { type: String },
    uploadedAt: { type: Date, default: Date.now },
    startedAt: { type: Date },
    completedAt: { type: Date },
}, { timestamps: true });
exports.SubtitleJob = mongoose_1.default.model("SubtitleJob", SubtitleJobSchema);
