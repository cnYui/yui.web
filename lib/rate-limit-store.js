class MemoryRateLimitStore {
    constructor(now = () => Date.now()) {
        this.now = now;
        this.buckets = new Map();
    }

    async increment(key, windowMs) {
        const now = this.now();
        const current = this.buckets.get(key);
        if (!current || current.resetAt <= now) {
            const next = { count: 1, resetAt: now + windowMs };
            this.buckets.set(key, next);
            return next;
        }
        current.count += 1;
        return { count: current.count, resetAt: current.resetAt };
    }

    async get(key) {
        const now = this.now();
        const current = this.buckets.get(key);
        if (!current || current.resetAt <= now) {
            this.buckets.delete(key);
            return null;
        }
        return { count: current.count, resetAt: current.resetAt };
    }

    async reset(key) {
        this.buckets.delete(key);
    }
}

function createRedisRateLimitStore(redisUrl) {
    const { createClient } = require('redis');
    const client = createClient({ url: redisUrl });
    const ready = client.connect();
    return {
        async increment(key, windowMs) {
            await ready;
            const count = await client.incr(key);
            if (count === 1) await client.pExpire(key, windowMs);
            const ttl = await client.pTTL(key);
            return { count, resetAt: Date.now() + Math.max(ttl, 0) };
        },
        async get(key) {
            await ready;
            const [value, ttl] = await Promise.all([client.get(key), client.pTTL(key)]);
            if (!value || ttl <= 0) return null;
            return { count: Number(value), resetAt: Date.now() + ttl };
        },
        async reset(key) {
            await ready;
            await client.del(key);
        },
        async close() {
            await ready;
            await client.quit();
        }
    };
}

function createRateLimitStore(options = {}) {
    const redisUrl = String(options.redisUrl || '').trim();
    if (!redisUrl) return new MemoryRateLimitStore(options.now);
    return createRedisRateLimitStore(redisUrl);
}

module.exports = { MemoryRateLimitStore, createRateLimitStore };

