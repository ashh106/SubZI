"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const config_1 = require("../config/config");
if (!fs_1.default.existsSync(config_1.config.uploadsDir)) {
    fs_1.default.mkdirSync(config_1.config.uploadsDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, config_1.config.uploadsDir);
    },
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        cb(null, `${(0, uuid_1.v4)()}${ext}`);
    },
});
const ALLOWED_MIMES = ["video/mp4", "video/mov", "video/avi", "video/mkv", "video/webm", "video/quicktime"];
const ALLOWED_EXTS = [".mp4", ".mov", ".avi", ".mkv", ".webm"];
const fileFilter = (req, file, cb) => {
    const ext = path_1.default.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIMES.includes(file.mimetype) || ALLOWED_EXTS.includes(ext)) {
        cb(null, true);
    }
    else {
        cb(new Error(`Only video files are allowed. Got: ${file.mimetype} / ${ext}`), false);
    }
};
exports.upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});
