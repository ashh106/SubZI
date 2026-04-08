import { config } from "../config/config";

/**
 * Returns a BullMQ-compatible Redis connection config.
 * Supports:
 *   - Local Redis: REDIS_HOST + REDIS_PORT
 *   - Upstash (or any TLS Redis): REDIS_URL + REDIS_TLS=true
 */
export function getRedisConnection() {
  if (config.redisUrl) {
    // Parse redis[s]://[:password@]host[:port]
    const url = new URL(config.redisUrl);
    const tls  = url.protocol === "rediss:" || config.redisTls;
    return {
      host:     url.hostname,
      port:     Number(url.port) || (tls ? 6380 : 6379),
      username: url.username || undefined,
      password: url.password ? decodeURIComponent(url.password) : undefined,
      tls:      tls ? {} : undefined,
      maxRetriesPerRequest: null as any, // BullMQ requirement
    };
  }

  return {
    host:     config.redisHost,
    port:     config.redisPort,
    tls:      config.redisTls ? {} : undefined,
    maxRetriesPerRequest: null as any,
  };
}
