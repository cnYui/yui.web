// 按来源计失败次数：窗口内失败满 maxFailures 次就拒绝，窗口过了自动恢复（/travel/now 的口令校验在用）。
function createAttemptLimiter(options = {}) {
    const maxFailures = Number(options.maxFailures) > 0 ? Number(options.maxFailures) : 8;
    const windowMs = Number(options.windowMs) > 0 ? Number(options.windowMs) : 10 * 60 * 1000;
    const maxEntries = Number(options.maxEntries) > 0 ? Number(options.maxEntries) : 5000;
    const entries = new Map();

    function prune(now) {
        for (const [key, entry] of entries) {
            if (now - entry.first >= windowMs) entries.delete(key);
        }
        // 兜底：极端情况下（大量不同来源）也不让这张表无限增长。
        if (entries.size > maxEntries) {
            const overflow = entries.size - maxEntries;
            let removed = 0;
            for (const key of entries.keys()) {
                entries.delete(key);
                removed += 1;
                if (removed >= overflow) break;
            }
        }
    }

    return {
        check(key, now = Date.now()) {
            const entry = entries.get(key);
            if (!entry) return { allowed: true, remaining: maxFailures };
            if (now - entry.first >= windowMs) {
                entries.delete(key);
                return { allowed: true, remaining: maxFailures };
            }
            if (entry.count >= maxFailures) {
                return { allowed: false, retryAfterMs: windowMs - (now - entry.first) };
            }
            return { allowed: true, remaining: maxFailures - entry.count };
        },
        recordFailure(key, now = Date.now()) {
            const entry = entries.get(key);
            if (!entry || now - entry.first >= windowMs) {
                entries.set(key, { first: now, count: 1 });
            } else {
                entry.count += 1;
            }
            prune(now);
            return entries.get(key).count;
        },
        reset(key) {
            entries.delete(key);
        },
        size() {
            return entries.size;
        }
    };
}

module.exports = {
    createAttemptLimiter,
};
