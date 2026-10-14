"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupExpiredUploads = cleanupExpiredUploads;
exports.startUploadCleanupScheduler = startUploadCleanupScheduler;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const config_1 = require("../config/config");
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
function cleanupExpiredUploads(ttlMs = DEFAULT_TTL_MS) {
    const dir = config_1.config.uploadsDir;
    if (!fs_1.default.existsSync(dir))
        return 0;
    const cutoff = Date.now() - ttlMs;
    let removed = 0;
    for (const name of fs_1.default.readdirSync(dir)) {
        const full = path_1.default.join(dir, name);
        try {
            const stat = fs_1.default.statSync(full);
            if (!stat.isFile())
                continue;
            if (stat.mtimeMs < cutoff) {
                fs_1.default.unlinkSync(full);
                removed += 1;
            }
        }
        catch {
            // ignore locked files
        }
    }
    if (removed > 0) {
        console.log(`[Cleanup] Removed ${removed} expired upload/output file(s)`);
    }
    return removed;
}
function startUploadCleanupScheduler() {
    cleanupExpiredUploads();
    setInterval(() => cleanupExpiredUploads(), 60 * 60 * 1000).unref();
}
