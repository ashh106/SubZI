"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRedisConnection = getRedisConnection;
const config_1 = require("../config/config");
/**
 * Returns a BullMQ-compatible Redis connection config.
 * Supports:
 *   - Local Redis: REDIS_HOST + REDIS_PORT
 *   - Upstash (or any TLS Redis): REDIS_URL + REDIS_TLS=true
 */
function getRedisConnection() {
    if (config_1.config.redisUrl) {
        // Parse redis[s]://[:password@]host[:port]
        const url = new URL(config_1.config.redisUrl);
        const tls = url.protocol === "rediss:" || config_1.config.redisTls;
        return {
            host: url.hostname,
            port: Number(url.port) || (tls ? 6380 : 6379),
            username: url.username || undefined,
            password: url.password ? decodeURIComponent(url.password) : undefined,
            tls: tls ? {} : undefined,
            maxRetriesPerRequest: null, // BullMQ requirement
        };
    }
    return {
        host: config_1.config.redisHost,
        port: config_1.config.redisPort,
        tls: config_1.config.redisTls ? {} : undefined,
        maxRetriesPerRequest: null,
    };
}
