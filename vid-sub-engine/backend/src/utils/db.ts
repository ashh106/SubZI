import mongoose from "mongoose";
import { config } from "../config/config";

export async function connectDB(): Promise<void> {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  console.log("✅ MongoDB connected:", config.mongoUri);
}
