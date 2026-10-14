"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
exports.isDbConnected = isDbConnected;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("../config/config");
let isConnected = false;
async function connectDB() {
    if (!config_1.config.mongoUri) {
        console.log("ℹ️  No MONGO_URI provided — using high-performance in-memory job repository.");
        return false;
    }
    try {
        await mongoose_1.default.connect(config_1.config.mongoUri, {
            serverSelectionTimeoutMS: 4000,
            connectTimeoutMS: 5000,
        });
        isConnected = true;
        console.log("✅ MongoDB connected successfully:", config_1.config.mongoUri.replace(/:([^:@]{3,})@/, ":***@"));
        return true;
    }
    catch (err) {
        isConnected = false;
        console.warn("⚠️  MongoDB connection failed (" + err.message + ") — seamlessly falling back to in-memory store.");
        return false;
    }
}
function isDbConnected() {
    return isConnected && mongoose_1.default.connection.readyState === 1;
}
