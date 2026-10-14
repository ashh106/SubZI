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
exports.GlossaryStore = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// In-memory fallback
const memoryGlossary = new Map();
// Seed default creator terms
const defaultSeeds = [
    {
        id: "seed-1",
        term: "SubZI",
        category: "brand",
        replacement: "SubZI",
        soundsLike: ["sub zee", "subzi", "sub z", "sabzi", "sub-zi"],
        context: "AI subtitle engine product name",
        createdAt: new Date(),
    },
    {
        id: "seed-2",
        term: "IIIT Pune",
        category: "company",
        replacement: "IIIT Pune",
        soundsLike: ["triple it pune", "triple i t pune", "i i i t pune"],
        context: "Indian Institute of Information Technology Pune",
        createdAt: new Date(),
    },
    {
        id: "seed-3",
        term: "Aashutosh Bharti",
        category: "person",
        replacement: "Aashutosh Bharti",
        soundsLike: ["ashutosh bharti", "ashutosh", "aashutosh"],
        context: "Creator and lead engineer of SubZI",
        createdAt: new Date(),
    },
    {
        id: "seed-4",
        term: "BullMQ",
        category: "tech",
        replacement: "BullMQ",
        soundsLike: ["bull mq", "bull-mq", "bool mq"],
        context: "Redis-based background job queue system",
        createdAt: new Date(),
    },
];
for (const seed of defaultSeeds) {
    memoryGlossary.set(seed.id, seed);
}
// Mongoose Schema
const GlossarySchema = new mongoose_1.Schema({
    id: { type: String, required: true, unique: true },
    term: { type: String, required: true },
    category: { type: String, default: "general" },
    replacement: { type: String },
    soundsLike: [{ type: String }],
    context: { type: String },
    createdAt: { type: Date, default: Date.now },
}, { timestamps: true });
let GlossaryModel;
try {
    GlossaryModel = mongoose_1.default.model("GlossaryEntry");
}
catch {
    GlossaryModel = mongoose_1.default.model("GlossaryEntry", GlossarySchema);
}
exports.GlossaryStore = {
    async list() {
        if (mongoose_1.default.connection.readyState === 1) {
            try {
                const docs = await GlossaryModel.find().lean();
                if (docs && docs.length > 0) {
                    return docs;
                }
            }
            catch {
                // Fall back to memory
            }
        }
        return Array.from(memoryGlossary.values());
    },
    async add(entry) {
        const newEntry = {
            ...entry,
            id: "term-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
            replacement: entry.replacement || entry.term,
            soundsLike: entry.soundsLike || [],
            createdAt: new Date(),
        };
        memoryGlossary.set(newEntry.id, newEntry);
        if (mongoose_1.default.connection.readyState === 1) {
            try {
                await GlossaryModel.create(newEntry);
            }
            catch {
                // Non fatal
            }
        }
        return newEntry;
    },
    async remove(id) {
        memoryGlossary.delete(id);
        if (mongoose_1.default.connection.readyState === 1) {
            try {
                await GlossaryModel.deleteOne({ id });
            }
            catch {
                // Non fatal
            }
        }
        return true;
    },
};
