import fs from "fs";
import path from "path";
import { config } from "../config/config";

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export function cleanupExpiredUploads(ttlMs = DEFAULT_TTL_MS): number {
  const dir = config.uploadsDir;
  if (!fs.existsSync(dir)) return 0;

  const cutoff = Date.now() - ttlMs;
  let removed = 0;

  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    try {
      const stat = fs.statSync(full);
      if (!stat.isFile()) continue;
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(full);
        removed += 1;
      }
    } catch {
      // ignore locked files
    }
  }

  if (removed > 0) {
    console.log(`[Cleanup] Removed ${removed} expired upload/output file(s)`);
  }
  return removed;
}

export function startUploadCleanupScheduler(): void {
  cleanupExpiredUploads();
  setInterval(() => cleanupExpiredUploads(), 60 * 60 * 1000).unref();
}
