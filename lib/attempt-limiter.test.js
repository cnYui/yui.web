const test = require('node:test');
const assert = require('node:assert/strict');

const { createAttemptLimiter } = require('./attempt-limiter');

test('连续猜错会被限流，窗口结束后自动恢复', () => {
    const limiter = createAttemptLimiter({ maxFailures: 3, windowMs: 1000 });
    const ip = '203.0.113.7';
    let now = 10_000;

    assert.equal(limiter.check(ip, now).allowed, true);
    for (let i = 0; i < 3; i += 1) limiter.recordFailure(ip, now);

    const blocked = limiter.check(ip, now);
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfterMs > 0 && blocked.retryAfterMs <= 1000);

    // 窗口未结束前仍然锁着。
    now += 999;
    assert.equal(limiter.check(ip, now).allowed, false);

    // 窗口结束后恢复。
    now += 2;
    assert.equal(limiter.check(ip, now).allowed, true);
});

test('限流按来源隔离，猜对之后计数清零', () => {
    const limiter = createAttemptLimiter({ maxFailures: 2, windowMs: 60_000 });
    const now = 0;

    limiter.recordFailure('a', now);
    limiter.recordFailure('a', now);
    assert.equal(limiter.check('a', now).allowed, false);
    // 另一个来源不受影响。
    assert.equal(limiter.check('b', now).allowed, true);

    limiter.reset('a');
    assert.equal(limiter.check('a', now).allowed, true);
});

test('限流表不会无限增长', () => {
    const limiter = createAttemptLimiter({ maxFailures: 5, windowMs: 60_000, maxEntries: 10 });
    for (let i = 0; i < 50; i += 1) limiter.recordFailure(`ip-${i}`, 0);
    assert.ok(limiter.size() <= 10, `限流表应被裁剪，实际 ${limiter.size()}`);
});
