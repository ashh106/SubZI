import { config } from "../config/config";

export function isRedisConfigured(): boolean {
  // Only enable Redis when an explicit URL or host is provided.
  if (config.redisUrl && config.redisUrl.trim().length > 0) return true;
  if (process.env.REDIS_HOST?.trim()) return true;
  return false;
}

/**
 * Returns a BullMQ-compatible Redis connection config.
 * Supports:
 *   - Upstash (or any TLS Redis): REDIS_URL + REDIS_TLS=true
 *   - Local/custom Redis: REDIS_HOST + REDIS_PORT
 */
export function getRedisConnection() {
  if (config.redisUrl) {
    const url = new URL(config.redisUrl);
    const tls = url.protocol === "rediss:" || config.redisTls;
    return {
      host: url.hostname,
      port: Number(url.port) || (tls ? 6380 : 6379),
      username: url.username || undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      tls: tls ? {} : undefined,
      maxRetriesPerRequest: null as any,
    };
  }

  return {
    host: config.redisHost,
    port: config.redisPort,
    tls: config.redisTls ? {} : undefined,
    maxRetriesPerRequest: null as any,
  };
}
