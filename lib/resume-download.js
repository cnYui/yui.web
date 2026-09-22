const crypto = require('node:crypto');

// 简历 PDF 不再走公开静态目录，只能经 POST /api/resume/download 校验密码后取回。
const RESUME_PDF_REQUEST_PATH = '/files/WU_JIANXIANG_resume.pdf';
const RESUME_PDF_FILE_NAME = 'WU_JIANXIANG_resume.pdf';

// 默认口令写在公开仓库里，本身不具备保密性，真要换成别人猜不到的值就设
// RESUME_DOWNLOAD_PASSWORD 环境变量，代码不必改。
const DEFAULT_RESUME_PASSWORD = '141592';

function resolveResumePassword(env = process.env) {
    const configured = String(env.RESUME_DOWNLOAD_PASSWORD || '').trim();
    return configured || DEFAULT_RESUME_PASSWORD;
}

// 先摘要再比对：摘要长度固定，timingSafeEqual 不会因为长度不同而抛错，
// 也不会通过耗时差异泄漏密码长度。
function digest(value) {
    return crypto.createHash('sha256').update(String(value), 'utf8').digest();
}

function verifyResumePassword(input, expected) {
    if (typeof input !== 'string' || input.length === 0) return false;
    return crypto.timingSafeEqual(digest(input), digest(expected));
}

// 6 位纯数字只有 100 万种组合，接口必须限流，否则可以直接跑字典。
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
    DEFAULT_RESUME_PASSWORD,
    RESUME_PDF_FILE_NAME,
    RESUME_PDF_REQUEST_PATH,
    createAttemptLimiter,
    resolveResumePassword,
    verifyResumePassword,
};
