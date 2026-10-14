import mongoose from "mongoose";
import { config } from "../config/config";

let isConnected = false;

export async function connectDB(): Promise<boolean> {
  if (!config.mongoUri) {
    console.log("ℹ️  No MONGO_URI provided — using high-performance in-memory job repository.");
    return false;
  }

  try {
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 4000,
      connectTimeoutMS: 5000,
    });
    isConnected = true;
    console.log("✅ MongoDB connected successfully:", config.mongoUri.replace(/:([^:@]{3,})@/, ":***@"));
    return true;
  } catch (err: any) {
    isConnected = false;
    console.warn("⚠️  MongoDB connection failed (" + err.message + ") — seamlessly falling back to in-memory store.");
    return false;
  }
}

export function isDbConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}
