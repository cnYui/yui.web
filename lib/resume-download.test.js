const test = require('node:test');
const assert = require('node:assert/strict');

const {
    DEFAULT_RESUME_PASSWORD,
    createAttemptLimiter,
    resolveResumePassword,
    verifyResumePassword,
} = require('./resume-download');

test('密码正确才放行，错误密码一律拒绝', () => {
    assert.equal(verifyResumePassword('141592', DEFAULT_RESUME_PASSWORD), true);
    assert.equal(verifyResumePassword('141593', DEFAULT_RESUME_PASSWORD), false);
    assert.equal(verifyResumePassword('14159', DEFAULT_RESUME_PASSWORD), false);
    assert.equal(verifyResumePassword('1415920', DEFAULT_RESUME_PASSWORD), false);
    assert.equal(verifyResumePassword(' 141592', DEFAULT_RESUME_PASSWORD), false);
    assert.equal(verifyResumePassword('', DEFAULT_RESUME_PASSWORD), false);
});

test('非字符串输入不会抛错，只会被拒绝', () => {
    for (const value of [undefined, null, 141592, {}, [], true]) {
        assert.equal(verifyResumePassword(value, DEFAULT_RESUME_PASSWORD), false);
    }
});

test('环境变量可以覆盖默认口令', () => {
    assert.equal(resolveResumePassword({}), DEFAULT_RESUME_PASSWORD);
    assert.equal(resolveResumePassword({ RESUME_DOWNLOAD_PASSWORD: '' }), DEFAULT_RESUME_PASSWORD);
    assert.equal(resolveResumePassword({ RESUME_DOWNLOAD_PASSWORD: '  ' }), DEFAULT_RESUME_PASSWORD);
    assert.equal(resolveResumePassword({ RESUME_DOWNLOAD_PASSWORD: 'let-me-in' }), 'let-me-in');

    // 覆盖之后，旧的默认口令必须失效。
    const configured = resolveResumePassword({ RESUME_DOWNLOAD_PASSWORD: 'let-me-in' });
    assert.equal(verifyResumePassword('141592', configured), false);
    assert.equal(verifyResumePassword('let-me-in', configured), true);
});

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
