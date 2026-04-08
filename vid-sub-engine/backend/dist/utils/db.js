"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const config_1 = require("../config/config");
async function connectDB() {
    await mongoose_1.default.connect(config_1.config.mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log("✅ MongoDB connected:", config_1.config.mongoUri);
}
