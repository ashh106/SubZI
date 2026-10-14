import mongoose, { Schema, Document } from "mongoose";

export interface IGlossaryEntry {
  id: string;
  term: string;
  category: "person" | "company" | "tech" | "acronym" | "brand" | "hinglish" | "general";
  replacement?: string;
  soundsLike?: string[];
  context?: string;
  createdAt: Date;
}

// In-memory fallback
const memoryGlossary = new Map<string, IGlossaryEntry>();

// Seed default creator terms
const defaultSeeds: IGlossaryEntry[] = [
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
const GlossarySchema = new Schema(
  {
    id:          { type: String, required: true, unique: true },
    term:        { type: String, required: true },
    category:    { type: String, default: "general" },
    replacement: { type: String },
    soundsLike:  [{ type: String }],
    context:     { type: String },
    createdAt:   { type: Date, default: Date.now },
  },
  { timestamps: true }
);

let GlossaryModel: mongoose.Model<any>;
try {
  GlossaryModel = mongoose.model("GlossaryEntry");
} catch {
  GlossaryModel = mongoose.model("GlossaryEntry", GlossarySchema);
}

export const GlossaryStore = {
  async list(): Promise<IGlossaryEntry[]> {
    if (mongoose.connection.readyState === 1) {
      try {
        const docs = await GlossaryModel.find().lean();
        if (docs && docs.length > 0) {
          return docs as unknown as IGlossaryEntry[];
        }
      } catch {
        // Fall back to memory
      }
    }
    return Array.from(memoryGlossary.values());
  },

  async add(entry: Omit<IGlossaryEntry, "id" | "createdAt">): Promise<IGlossaryEntry> {
    const newEntry: IGlossaryEntry = {
      ...entry,
      id: "term-" + Date.now() + "-" + Math.random().toString(36).substring(2, 6),
      replacement: entry.replacement || entry.term,
      soundsLike: entry.soundsLike || [],
      createdAt: new Date(),
    };

    memoryGlossary.set(newEntry.id, newEntry);

    if (mongoose.connection.readyState === 1) {
      try {
        await GlossaryModel.create(newEntry);
      } catch {
        // Non fatal
      }
    }

    return newEntry;
  },

  async remove(id: string): Promise<boolean> {
    memoryGlossary.delete(id);
    if (mongoose.connection.readyState === 1) {
      try {
        await GlossaryModel.deleteOne({ id });
      } catch {
        // Non fatal
      }
    }
    return true;
  },
};
