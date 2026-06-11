const assert = require('node:assert/strict');
const test = require('node:test');

const { MemoryRateLimitStore } = require('./rate-limit-store');

test('MemoryRateLimitStore 在窗口内递增并在过期后重置', async () => {
    let now = 1000;
    const store = new MemoryRateLimitStore(() => now);

    assert.deepEqual(await store.increment('auth:phone:13800138800', 1000), { count: 1, resetAt: 2000 });
    assert.deepEqual(await store.increment('auth:phone:13800138800', 1000), { count: 2, resetAt: 2000 });

    now = 2001;
    assert.deepEqual(await store.increment('auth:phone:13800138800', 1000), { count: 1, resetAt: 3001 });
});

test('MemoryRateLimitStore reset 清理指定 key', async () => {
    const store = new MemoryRateLimitStore(() => 1000);

    await store.increment('auth:phone:13800138801', 1000);
    await store.reset('auth:phone:13800138801');

    assert.deepEqual(await store.increment('auth:phone:13800138801', 1000), { count: 1, resetAt: 2000 });
});

