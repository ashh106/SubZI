"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRedisConfigured = isRedisConfigured;
exports.getRedisConnection = getRedisConnection;
const config_1 = require("../config/config");
function isRedisConfigured() {
    // Only enable Redis when an explicit URL or host is provided.
    if (config_1.config.redisUrl && config_1.config.redisUrl.trim().length > 0)
        return true;
    if (process.env.REDIS_HOST?.trim())
        return true;
    return false;
}
/**
 * Returns a BullMQ-compatible Redis connection config.
 * Supports:
 *   - Upstash (or any TLS Redis): REDIS_URL + REDIS_TLS=true
 *   - Local/custom Redis: REDIS_HOST + REDIS_PORT
 */
function getRedisConnection() {
    if (config_1.config.redisUrl) {
        const url = new URL(config_1.config.redisUrl);
        const tls = url.protocol === "rediss:" || config_1.config.redisTls;
        return {
            host: url.hostname,
            port: Number(url.port) || (tls ? 6380 : 6379),
            username: url.username || undefined,
            password: url.password ? decodeURIComponent(url.password) : undefined,
            tls: tls ? {} : undefined,
            maxRetriesPerRequest: null,
        };
    }
    return {
        host: config_1.config.redisHost,
        port: config_1.config.redisPort,
        tls: config_1.config.redisTls ? {} : undefined,
        maxRetriesPerRequest: null,
    };
}
