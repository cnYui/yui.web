# Shop Prepaid Balance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Shop 增加预充值余额、用户充值申请、管理员人工确认入账、API 调用扣费、余额不足拦截和用户可见调用流水。

**Architecture:** 继续沿用当前 `server.js` 集中建表、事务和路由的实现方式，不在本次改动中拆后端文件。余额用 `account_balances` 做查询缓存，用 `account_ledger_entries` 做权威流水；用户提交充值只产生 `topup_requests.pending`，管理员确认后才写入余额流水。API key 状态检查负责调用前余额拦截，usage event 写入负责调用后按实际费用扣款。

**Tech Stack:** Node.js、Express 5、better-sqlite3、node:test、原生 HTML/CSS/JavaScript、Tailwind 构建产物。

---

## 设计输入

设计文档：

- `docs/ai/context/20260610-133543-shop-prepaid-balance-design_CN.md`

已确认决策：

- 新用户初始余额为 `0`。
- 用户充值金额任意，但不会自动入账。
- 管理员确认后才增加余额。
- API 调用逐步扣减账户余额。
- 每次 API 调用都需要生成用户可见记录。
- 调用前余额 `<= 0` 时拒绝。
- 调用前余额 `> 0` 时允许发起调用。
- 调用后可以因实际费用结算把余额扣成负数。
- 余额为负后下一次调用拒绝。
- 默认最大允许欠费额度为 `10 元`，即 `1000` 分。

## 文件结构

- Modify: `server.js`
  - 新增余额、充值申请、账户流水、扣费记录表。
  - 新增金额解析、余额摘要、充值申请、管理员确认、API 扣费函数。
  - 新增用户账务 API 和管理员充值审核 API。
  - 扩展 `/api/internal/api-keys/status`，余额不足时让托管 key 变成不可用。
  - 扩展 `/api/internal/usage-events`，写入 usage event 后生成扣费记录和账户流水。
- Modify: `test/shop-flow.test.js`
  - 增加余额、充值、管理员确认、余额拦截、扣费、幂等和权限测试。
- Modify: `shop/account/index.html`
  - 增加余额概览、充值申请表、充值记录、扣费记录和账户流水容器。
- Modify: `shop/admin/index.html`
  - 增加充值审核区域。
- Modify: `shop/shop.js`
  - 增加金额格式化、充值申请渲染、扣费记录渲染、管理员确认/拒绝交互。
- Optional Modify: `styles/site.css`
  - 不直接手改；如果新增 Tailwind class 已被构建流程覆盖，执行 `npm run build:css` 生成。

## 任务拆分

### Task 1: 数据库表、金额工具和余额摘要

**Files:**
- Modify: `server.js`
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 写失败测试，验证新表存在、新用户余额为 0、默认欠费上限为 1000 分**

在 `test/shop-flow.test.js` 中追加：

```js
test('Shop 数据库包含预充值余额、充值申请、账户流水和扣费记录表', async () => {
    await withServer(async ({ db }) => {
        const tableNames = db.prepare(`
SELECT name FROM sqlite_master
WHERE type = 'table'
  AND name IN ('account_balances', 'topup_requests', 'account_ledger_entries', 'api_charge_records')
ORDER BY name
`).all().map((row) => row.name);

        assert.deepEqual(tableNames, [
            'account_balances',
            'account_ledger_entries',
            'api_charge_records',
            'topup_requests'
        ]);

        const balanceColumns = db.prepare('PRAGMA table_info(account_balances)').all().map((column) => column.name);
        assert.ok(balanceColumns.includes('phone'));
        assert.ok(balanceColumns.includes('balance_cents'));
        assert.ok(balanceColumns.includes('pending_topup_cents'));
        assert.ok(balanceColumns.includes('credit_limit_cents'));
    });
});

test('新注册用户账户余额默认为 0 且默认欠费上限为 10 元', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139001');

        const result = await jsonFetch(`${baseUrl}/api/account/balance`, {
            headers: { cookie }
        });

        assert.equal(result.response.status, 200);
        assert.equal(result.body.balance.balanceCents, 0);
        assert.equal(result.body.balance.pendingTopupCents, 0);
        assert.equal(result.body.balance.debtCents, 0);
        assert.equal(result.body.balance.creditLimitCents, 1000);
        assert.equal(result.body.balance.status, 'empty');
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- --test-name-pattern='预充值余额|新注册用户账户余额'
```

Expected:

- 第一个测试失败，提示缺少表。
- 第二个测试失败，提示 `/api/account/balance` 不存在。

- [ ] **Step 3: 在 `server.js` 增加金额和信用额度常量**

在 `defaultAdminAccountPhone` 附近加入：

```js
const defaultCreditLimitCents = 1000;
const supportedPaymentMethods = new Set(['alipay', 'wechat']);
```

在 `nonNegativeInteger()` 后加入：

```js
function parsePositiveCnyToCents(value) {
    const text = String(value ?? '').trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
        const error = new Error('金额必须是大于 0 的人民币数字，最多保留两位小数。');
        error.status = 400;
        error.code = 'INVALID_AMOUNT';
        throw error;
    }
    const [yuanPart, centPart = ''] = text.split('.');
    const cents = Number(yuanPart) * 100 + Number(centPart.padEnd(2, '0'));
    if (!Number.isSafeInteger(cents) || cents <= 0) {
        const error = new Error('金额必须大于 0。');
        error.status = 400;
        error.code = 'INVALID_AMOUNT';
        throw error;
    }
    return cents;
}

function centsToCny(cents) {
    return Number(cents || 0) / 100;
}

function normalizePaymentMethod(value) {
    const method = String(value || '').trim().toLowerCase();
    if (!supportedPaymentMethods.has(method)) {
        const error = new Error('支付方式必须是支付宝或微信。');
        error.status = 400;
        error.code = 'INVALID_PAYMENT_METHOD';
        throw error;
    }
    return method;
}
```

- [ ] **Step 4: 在 `openShopDatabase()` 创建账务表**

在 `usage_key_profiles` 建表 SQL 后追加：

```js
CREATE TABLE IF NOT EXISTS account_balances (
  phone TEXT PRIMARY KEY,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  pending_topup_cents INTEGER NOT NULL DEFAULT 0,
  credit_limit_cents INTEGER NOT NULL DEFAULT 1000,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (phone) REFERENCES users(phone)
);

CREATE TABLE IF NOT EXISTS topup_requests (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  requested_amount_cents INTEGER NOT NULL,
  confirmed_amount_cents INTEGER,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('alipay', 'wechat')),
  payment_time TEXT,
  payment_note TEXT,
  screenshot_path TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  admin_note TEXT,
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  confirmed_by_phone TEXT,
  rejected_at TEXT,
  rejected_by_phone TEXT,
  FOREIGN KEY (phone) REFERENCES users(phone)
);

CREATE INDEX IF NOT EXISTS idx_topup_requests_phone_created
ON topup_requests(phone, created_at);

CREATE INDEX IF NOT EXISTS idx_topup_requests_status_created
ON topup_requests(status, created_at);

CREATE TABLE IF NOT EXISTS account_ledger_entries (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('topup_approved', 'api_charge', 'admin_adjustment', 'refund')),
  amount_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'CNY',
  related_id TEXT,
  memo TEXT,
  created_at TEXT NOT NULL,
  created_by_phone TEXT,
  FOREIGN KEY (phone) REFERENCES users(phone)
);

CREATE INDEX IF NOT EXISTS idx_account_ledger_phone_created
ON account_ledger_entries(phone, created_at);

CREATE TABLE IF NOT EXISTS api_charge_records (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  usage_event_id TEXT NOT NULL UNIQUE,
  api_key_hash TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  price_version TEXT NOT NULL,
  charge_cents INTEGER NOT NULL,
  balance_before_cents INTEGER NOT NULL,
  balance_after_cents INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('charged', 'failed_no_charge', 'unpriced_no_charge', 'adjusted')),
  created_at TEXT NOT NULL,
  FOREIGN KEY (phone) REFERENCES users(phone)
);

CREATE INDEX IF NOT EXISTS idx_api_charge_records_phone_created
ON api_charge_records(phone, created_at);
```

- [ ] **Step 5: 在 `createShopApp()` 读取默认欠费上限配置**

在 `adminAccountPhone` 后加入：

```js
    const configuredCreditLimitCents = Number(options.defaultCreditLimitCents ?? process.env.SHOP_DEFAULT_CREDIT_LIMIT_CENTS ?? defaultCreditLimitCents);
    const creditLimitCents = Number.isSafeInteger(configuredCreditLimitCents) && configuredCreditLimitCents >= 0
        ? configuredCreditLimitCents
        : defaultCreditLimitCents;
```

- [ ] **Step 6: 增加余额 SQL、余额摘要和用户余额接口**

在 prepared statements 区域加入：

```js
    const ensureAccountBalanceRow = db.prepare(`
INSERT INTO account_balances (phone, balance_cents, pending_topup_cents, credit_limit_cents, updated_at)
VALUES (?, 0, 0, ?, ?)
ON CONFLICT(phone) DO NOTHING
`);

    const getAccountBalanceRow = db.prepare(`
SELECT phone, balance_cents, pending_topup_cents, credit_limit_cents, updated_at
FROM account_balances
WHERE phone = ?
`);
```

在 `publicUser()` 后加入：

```js
    function ensureAccountBalance(phone) {
        ensureUser.run(phone, nowIso());
        ensureAccountBalanceRow.run(phone, creditLimitCents, nowIso());
        return getAccountBalanceRow.get(phone);
    }

    function publicAccountBalance(row) {
        const balanceCents = Number(row?.balance_cents || 0);
        const pendingTopupCents = Number(row?.pending_topup_cents || 0);
        const creditLimit = Number(row?.credit_limit_cents || creditLimitCents);
        const debtCents = balanceCents < 0 ? Math.abs(balanceCents) : 0;
        const status = balanceCents < 0 ? 'debt' : balanceCents === 0 ? 'empty' : 'available';
        return {
            phone: row.phone,
            balanceCents,
            balanceAmount: centsToCny(balanceCents),
            pendingTopupCents,
            pendingTopupAmount: centsToCny(pendingTopupCents),
            debtCents,
            debtAmount: centsToCny(debtCents),
            creditLimitCents: creditLimit,
            creditLimitAmount: centsToCny(creditLimit),
            creditExceeded: balanceCents < -creditLimit,
            status,
            updatedAt: row.updated_at
        };
    }

    function paymentReferenceForPhone(phone) {
        const parts = chinaParts(new Date());
        const maskedPhone = `${phone.slice(0, 3)}****${phone.slice(-4)}`;
        return `YUI-${parts.year}${pad2(parts.month)}-${maskedPhone}`;
    }

    function accountPaymentConfig(phone) {
        return {
            alipayQrUrl: options.alipayQrUrl ?? process.env.SHOP_ALIPAY_QR_URL ?? '/shop/assets/pay/alipay-qr.png',
            wechatQrUrl: options.wechatQrUrl ?? process.env.SHOP_WECHAT_QR_URL ?? '/shop/assets/pay/wechat-qr.png',
            paymentReference: paymentReferenceForPhone(phone)
        };
    }
```

在 Account API 区域加入：

```js
    app.get('/api/account/balance', limitQueryApi, requireAccount, (req, res) => {
        const balance = ensureAccountBalance(req.account.phone);
        return res.json({
            balance: publicAccountBalance(balance),
            payment: accountPaymentConfig(req.account.phone)
        });
    });
```

- [ ] **Step 7: 运行测试确认通过**

Run:

```bash
npm test -- --test-name-pattern='预充值余额|新注册用户账户余额'
```

Expected:

- 两个测试通过。

- [ ] **Step 8: 提交**

```bash
git add server.js test/shop-flow.test.js
git commit -m "feat: add prepaid balance schema"
```

### Task 2: 用户提交充值申请和查看自己的充值历史

**Files:**
- Modify: `server.js`
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 写失败测试，验证充值申请不会自动入账**

在 `test/shop-flow.test.js` 中追加：

```js
test('用户提交充值申请后进入待确认且不会增加可用余额', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139002');

        const created = await jsonFetch(`${baseUrl}/api/account/topups`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({
                amount: '30',
                paymentMethod: 'alipay',
                paymentTime: '2026-06-10T13:00',
                paymentNote: 'YUI-202606-138****9002'
            })
        });

        assert.equal(created.response.status, 201);
        assert.equal(created.body.topup.status, 'pending');
        assert.equal(created.body.topup.requestedAmountCents, 3000);
        assert.equal(created.body.topup.requestedAmount, 30);

        const balance = await jsonFetch(`${baseUrl}/api/account/balance`, {
            headers: { cookie }
        });
        assert.equal(balance.body.balance.balanceCents, 0);
        assert.equal(balance.body.balance.pendingTopupCents, 3000);

        const row = db.prepare('SELECT status, requested_amount_cents FROM topup_requests WHERE phone = ?').get('13800139002');
        assert.deepEqual(row, { status: 'pending', requested_amount_cents: 3000 });
    });
});

test('用户只能查看自己的充值申请', async () => {
    await withServer(async ({ baseUrl }) => {
        const firstCookie = await registerUserAndGetCookie(baseUrl, '13800139003');
        const secondCookie = await registerUserAndGetCookie(baseUrl, '13800139004');

        await jsonFetch(`${baseUrl}/api/account/topups`, {
            method: 'POST',
            headers: { cookie: firstCookie },
            body: JSON.stringify({ amount: '10.50', paymentMethod: 'wechat', paymentNote: 'first user' })
        });

        const firstList = await jsonFetch(`${baseUrl}/api/account/topups`, {
            headers: { cookie: firstCookie }
        });
        assert.equal(firstList.response.status, 200);
        assert.equal(firstList.body.topups.length, 1);
        assert.equal(firstList.body.topups[0].requestedAmountCents, 1050);

        const secondList = await jsonFetch(`${baseUrl}/api/account/topups`, {
            headers: { cookie: secondCookie }
        });
        assert.equal(secondList.response.status, 200);
        assert.equal(secondList.body.topups.length, 0);
    });
});

test('充值申请校验金额和支付方式', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139005');

        const badAmount = await jsonFetch(`${baseUrl}/api/account/topups`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({ amount: '0', paymentMethod: 'alipay' })
        });
        assert.equal(badAmount.response.status, 400);
        assert.equal(badAmount.body.code, 'INVALID_AMOUNT');

        const badMethod = await jsonFetch(`${baseUrl}/api/account/topups`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({ amount: '1', paymentMethod: 'bank' })
        });
        assert.equal(badMethod.response.status, 400);
        assert.equal(badMethod.body.code, 'INVALID_PAYMENT_METHOD');
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- --test-name-pattern='充值申请'
```

Expected:

- `/api/account/topups` 相关测试失败，接口不存在。

- [ ] **Step 3: 增加充值申请 SQL 和公开转换函数**

在 prepared statements 区域加入：

```js
    const insertTopupRequest = db.prepare(`
INSERT INTO topup_requests (
  id, phone, requested_amount_cents, payment_method, payment_time, payment_note,
  screenshot_path, status, created_at
)
VALUES (
  @id, @phone, @requestedAmountCents, @paymentMethod, @paymentTime, @paymentNote,
  @screenshotPath, 'pending', @createdAt
)
`);

    const listTopupRequestsByPhone = db.prepare(`
SELECT id, phone, requested_amount_cents, confirmed_amount_cents, payment_method,
       payment_time, payment_note, screenshot_path, status, admin_note, created_at,
       confirmed_at, confirmed_by_phone, rejected_at, rejected_by_phone
FROM topup_requests
WHERE phone = ?
ORDER BY created_at DESC
LIMIT ?
`);

    const sumPendingTopupsByPhone = db.prepare(`
SELECT COALESCE(SUM(requested_amount_cents), 0) AS pending_topup_cents
FROM topup_requests
WHERE phone = ? AND status = 'pending'
`);

    const updatePendingTopupCents = db.prepare(`
UPDATE account_balances
SET pending_topup_cents = ?,
    updated_at = ?
WHERE phone = ?
`);
```

在公开转换函数区域加入：

```js
    function publicTopupRequest(row) {
        return {
            id: row.id,
            phone: row.phone,
            requestedAmountCents: row.requested_amount_cents,
            requestedAmount: centsToCny(row.requested_amount_cents),
            confirmedAmountCents: row.confirmed_amount_cents ?? null,
            confirmedAmount: row.confirmed_amount_cents === null || row.confirmed_amount_cents === undefined
                ? null
                : centsToCny(row.confirmed_amount_cents),
            paymentMethod: row.payment_method,
            paymentTime: row.payment_time || '',
            paymentNote: row.payment_note || '',
            screenshotPath: row.screenshot_path || '',
            status: row.status,
            adminNote: row.admin_note || '',
            createdAt: row.created_at,
            confirmedAt: row.confirmed_at || '',
            confirmedByPhone: row.confirmed_by_phone || '',
            rejectedAt: row.rejected_at || '',
            rejectedByPhone: row.rejected_by_phone || ''
        };
    }

    function refreshPendingTopupCents(phone) {
        ensureAccountBalance(phone);
        const row = sumPendingTopupsByPhone.get(phone);
        const pendingTopupCents = Number(row?.pending_topup_cents || 0);
        updatePendingTopupCents.run(pendingTopupCents, nowIso(), phone);
        return pendingTopupCents;
    }

    function normalizeTopupRequestBody(body = {}) {
        return {
            requestedAmountCents: parsePositiveCnyToCents(body.amount ?? body.requestedAmount),
            paymentMethod: normalizePaymentMethod(body.paymentMethod ?? body.payment_method),
            paymentTime: String(body.paymentTime || body.payment_time || '').trim(),
            paymentNote: String(body.paymentNote || body.payment_note || '').trim().slice(0, 500),
            screenshotPath: String(body.screenshotPath || body.screenshot_path || '').trim().slice(0, 500)
        };
    }
```

- [ ] **Step 4: 增加创建充值申请事务和用户接口**

在业务事务区域加入：

```js
    const createTopupRequest = db.transaction(({ phone, body }) => {
        ensureAccountBalance(phone);
        const normalized = normalizeTopupRequestBody(body);
        const topup = {
            id: createId('TOPUP'),
            phone,
            ...normalized,
            createdAt: nowIso()
        };
        insertTopupRequest.run(topup);
        refreshPendingTopupCents(phone);
        return topup;
    });
```

在 Account API 区域加入：

```js
    app.post('/api/account/topups', limitQueryApi, requireAccount, (req, res) => {
        try {
            const topup = createTopupRequest({ phone: req.account.phone, body: req.body });
            return res.status(201).json({
                topup: publicTopupRequest({
                    id: topup.id,
                    phone: topup.phone,
                    requested_amount_cents: topup.requestedAmountCents,
                    confirmed_amount_cents: null,
                    payment_method: topup.paymentMethod,
                    payment_time: topup.paymentTime,
                    payment_note: topup.paymentNote,
                    screenshot_path: topup.screenshotPath,
                    status: 'pending',
                    admin_note: '',
                    created_at: topup.createdAt,
                    confirmed_at: '',
                    confirmed_by_phone: '',
                    rejected_at: '',
                    rejected_by_phone: ''
                })
            });
        } catch (error) {
            return res.status(error.status || 500).json({
                code: error.code || 'TOPUP_REQUEST_FAILED',
                message: error.message || '充值申请提交失败。'
            });
        }
    });

    app.get('/api/account/topups', limitQueryApi, requireAccount, (req, res) => {
        const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
        const topups = listTopupRequestsByPhone.all(req.account.phone, limit).map(publicTopupRequest);
        return res.json({ topups });
    });
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```bash
npm test -- --test-name-pattern='充值申请'
```

Expected:

- 用户充值申请测试全部通过。

- [ ] **Step 6: 提交**

```bash
git add server.js test/shop-flow.test.js
git commit -m "feat: add user topup requests"
```

### Task 3: 管理员确认和拒绝充值

**Files:**
- Modify: `server.js`
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 写失败测试，验证管理员确认后才入账**

在 `test/shop-flow.test.js` 中追加：

```js
test('管理员确认充值后增加余额并写入账户流水', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139006');
        const created = await jsonFetch(`${baseUrl}/api/account/topups`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({ amount: '30', paymentMethod: 'alipay', paymentNote: 'paid 30' })
        });

        const approved = await jsonFetch(`${baseUrl}/api/admin/topups/${created.body.topup.id}/approve`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ confirmedAmount: '30', adminNote: '到账' })
        });

        assert.equal(approved.response.status, 200);
        assert.equal(approved.body.topup.status, 'approved');
        assert.equal(approved.body.balance.balanceCents, 3000);
        assert.equal(approved.body.balance.pendingTopupCents, 0);

        const ledger = db.prepare(`
SELECT entry_type, amount_cents, balance_after_cents, related_id
FROM account_ledger_entries
WHERE phone = ?
`).get('13800139006');
        assert.deepEqual(ledger, {
            entry_type: 'topup_approved',
            amount_cents: 3000,
            balance_after_cents: 3000,
            related_id: created.body.topup.id
        });

        const balance = await jsonFetch(`${baseUrl}/api/account/balance`, {
            headers: { cookie }
        });
        assert.equal(balance.body.balance.balanceCents, 3000);
    });
});

test('管理员确认金额以管理员填写为准且不能重复入账', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139007');
        const created = await jsonFetch(`${baseUrl}/api/account/topups`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({ amount: '30', paymentMethod: 'wechat' })
        });

        const approved = await jsonFetch(`${baseUrl}/api/admin/topups/${created.body.topup.id}/approve`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ confirmedAmount: '20', adminNote: '实际到账 20' })
        });
        assert.equal(approved.response.status, 200);
        assert.equal(approved.body.balance.balanceCents, 2000);

        const duplicate = await jsonFetch(`${baseUrl}/api/admin/topups/${created.body.topup.id}/approve`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ confirmedAmount: '20' })
        });
        assert.equal(duplicate.response.status, 409);
        assert.equal(duplicate.body.code, 'TOPUP_NOT_PENDING');

        const balance = await jsonFetch(`${baseUrl}/api/account/balance`, {
            headers: { cookie }
        });
        assert.equal(balance.body.balance.balanceCents, 2000);
    });
});

test('管理员拒绝充值不会改变余额', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139008');
        const created = await jsonFetch(`${baseUrl}/api/account/topups`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({ amount: '50', paymentMethod: 'alipay' })
        });

        const rejected = await jsonFetch(`${baseUrl}/api/admin/topups/${created.body.topup.id}/reject`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ adminNote: '未到账' })
        });

        assert.equal(rejected.response.status, 200);
        assert.equal(rejected.body.topup.status, 'rejected');
        assert.equal(rejected.body.balance.balanceCents, 0);
        assert.equal(rejected.body.balance.pendingTopupCents, 0);
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- --test-name-pattern='管理员确认|管理员拒绝'
```

Expected:

- 管理员充值接口不存在，测试失败。

- [ ] **Step 3: 增加管理员充值 SQL**

在 prepared statements 区域加入：

```js
    const listTopupRequestsForAdmin = db.prepare(`
SELECT id, phone, requested_amount_cents, confirmed_amount_cents, payment_method,
       payment_time, payment_note, screenshot_path, status, admin_note, created_at,
       confirmed_at, confirmed_by_phone, rejected_at, rejected_by_phone
FROM topup_requests
WHERE (? = 'all' OR status = ?)
ORDER BY created_at DESC
LIMIT ?
`);

    const getTopupRequestById = db.prepare(`
SELECT id, phone, requested_amount_cents, confirmed_amount_cents, payment_method,
       payment_time, payment_note, screenshot_path, status, admin_note, created_at,
       confirmed_at, confirmed_by_phone, rejected_at, rejected_by_phone
FROM topup_requests
WHERE id = ?
`);

    const approveTopupRequestById = db.prepare(`
UPDATE topup_requests
SET status = 'approved',
    confirmed_amount_cents = ?,
    admin_note = ?,
    confirmed_at = ?,
    confirmed_by_phone = ?
WHERE id = ? AND status = 'pending'
`);

    const rejectTopupRequestById = db.prepare(`
UPDATE topup_requests
SET status = 'rejected',
    admin_note = ?,
    rejected_at = ?,
    rejected_by_phone = ?
WHERE id = ? AND status = 'pending'
`);

    const updateBalanceCents = db.prepare(`
UPDATE account_balances
SET balance_cents = ?,
    updated_at = ?
WHERE phone = ?
`);

    const insertLedgerEntry = db.prepare(`
INSERT INTO account_ledger_entries (
  id, phone, entry_type, amount_cents, balance_after_cents, currency,
  related_id, memo, created_at, created_by_phone
)
VALUES (
  @id, @phone, @entryType, @amountCents, @balanceAfterCents, 'CNY',
  @relatedId, @memo, @createdAt, @createdByPhone
)
`);
```

- [ ] **Step 4: 增加确认和拒绝事务**

在业务事务区域加入：

```js
    const approveTopupRequest = db.transaction(({ id, confirmedAmountCents, adminNote, adminPhone }) => {
        const row = getTopupRequestById.get(id);
        if (!row || row.status !== 'pending') {
            const error = new Error('充值申请不是待确认状态。');
            error.status = 409;
            error.code = 'TOPUP_NOT_PENDING';
            throw error;
        }
        const phone = row.phone;
        const balanceRow = ensureAccountBalance(phone);
        const nextBalanceCents = Number(balanceRow.balance_cents || 0) + confirmedAmountCents;
        const now = nowIso();
        const result = approveTopupRequestById.run(confirmedAmountCents, adminNote, now, adminPhone, id);
        if (result.changes !== 1) {
            const error = new Error('充值申请确认失败。');
            error.status = 409;
            error.code = 'TOPUP_NOT_PENDING';
            throw error;
        }
        updateBalanceCents.run(nextBalanceCents, now, phone);
        refreshPendingTopupCents(phone);
        insertLedgerEntry.run({
            id: createId('LEDGER'),
            phone,
            entryType: 'topup_approved',
            amountCents: confirmedAmountCents,
            balanceAfterCents: nextBalanceCents,
            relatedId: id,
            memo: adminNote,
            createdAt: now,
            createdByPhone: adminPhone
        });
        return {
            topup: getTopupRequestById.get(id),
            balance: getAccountBalanceRow.get(phone)
        };
    });

    const rejectTopupRequest = db.transaction(({ id, adminNote, adminPhone }) => {
        const row = getTopupRequestById.get(id);
        if (!row || row.status !== 'pending') {
            const error = new Error('充值申请不是待确认状态。');
            error.status = 409;
            error.code = 'TOPUP_NOT_PENDING';
            throw error;
        }
        const now = nowIso();
        const result = rejectTopupRequestById.run(adminNote, now, adminPhone, id);
        if (result.changes !== 1) {
            const error = new Error('充值申请拒绝失败。');
            error.status = 409;
            error.code = 'TOPUP_NOT_PENDING';
            throw error;
        }
        refreshPendingTopupCents(row.phone);
        return {
            topup: getTopupRequestById.get(id),
            balance: getAccountBalanceRow.get(row.phone)
        };
    });
```

- [ ] **Step 5: 增加管理员充值接口**

在 Admin API 区域加入：

```js
    app.get('/api/admin/topups', limitAdminApi, requireAdminUsageAccess, (req, res) => {
        const status = String(req.query.status || 'pending').trim();
        const normalizedStatus = ['pending', 'approved', 'rejected', 'cancelled', 'all'].includes(status) ? status : 'pending';
        const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
        const topups = listTopupRequestsForAdmin.all(normalizedStatus, normalizedStatus, limit).map(publicTopupRequest);
        return res.json({ topups });
    });

    app.post('/api/admin/topups/:id/approve', limitAdminApi, requireAdminUsageAccess, (req, res) => {
        try {
            const confirmedAmountCents = parsePositiveCnyToCents(req.body.confirmedAmount ?? req.body.confirmed_amount);
            const result = approveTopupRequest({
                id: req.params.id,
                confirmedAmountCents,
                adminNote: String(req.body.adminNote || req.body.admin_note || '').trim().slice(0, 500),
                adminPhone: req.account?.phone || defaultAdminAccountPhone
            });
            return res.json({
                topup: publicTopupRequest(result.topup),
                balance: publicAccountBalance(result.balance)
            });
        } catch (error) {
            return res.status(error.status || 500).json({
                code: error.code || 'TOPUP_APPROVE_FAILED',
                message: error.message || '充值确认失败。'
            });
        }
    });

    app.post('/api/admin/topups/:id/reject', limitAdminApi, requireAdminUsageAccess, (req, res) => {
        try {
            const result = rejectTopupRequest({
                id: req.params.id,
                adminNote: String(req.body.adminNote || req.body.admin_note || '').trim().slice(0, 500),
                adminPhone: req.account?.phone || defaultAdminAccountPhone
            });
            return res.json({
                topup: publicTopupRequest(result.topup),
                balance: publicAccountBalance(result.balance)
            });
        } catch (error) {
            return res.status(error.status || 500).json({
                code: error.code || 'TOPUP_REJECT_FAILED',
                message: error.message || '充值拒绝失败。'
            });
        }
    });
```

- [ ] **Step 6: 运行测试确认通过**

Run:

```bash
npm test -- --test-name-pattern='管理员确认|管理员拒绝'
```

Expected:

- 管理员确认、重复确认、拒绝测试全部通过。

- [ ] **Step 7: 提交**

```bash
git add server.js test/shop-flow.test.js
git commit -m "feat: approve prepaid topups"
```

### Task 4: API key 状态接口按余额拦截调用

**Files:**
- Modify: `server.js`
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 写失败测试，验证余额不足时托管 API key 不可用**

在 `test/shop-flow.test.js` 中追加：

```js
async function createRedeemedOrder(baseUrl, phone, apiKey = 'sk-balance-gated') {
    await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
        method: 'POST',
        headers: { 'x-admin-token': 'test-token' },
        body: JSON.stringify({ apiKeys: [apiKey] })
    });
    const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
        method: 'POST',
        headers: { 'x-admin-token': 'test-token' },
        body: JSON.stringify({ count: 1 })
    });
    const redeemResult = await jsonFetch(`${baseUrl}/api/invites/redeem`, {
        method: 'POST',
        body: JSON.stringify({ phone, code: inviteResult.body.invites[0].code })
    });
    assert.equal(redeemResult.response.status, 201);
    return redeemResult.body.order;
}

async function submitAndApproveTopup(baseUrl, cookie, amount, adminToken = 'test-token') {
    const created = await jsonFetch(`${baseUrl}/api/account/topups`, {
        method: 'POST',
        headers: { cookie },
        body: JSON.stringify({ amount, paymentMethod: 'alipay' })
    });
    assert.equal(created.response.status, 201);
    const approved = await jsonFetch(`${baseUrl}/api/admin/topups/${created.body.topup.id}/approve`, {
        method: 'POST',
        headers: { 'x-admin-token': adminToken },
        body: JSON.stringify({ confirmedAmount: amount })
    });
    assert.equal(approved.response.status, 200);
    return approved.body;
}

test('托管 API key 在账户余额为 0 时返回余额不足状态', async () => {
    await withServer(async ({ baseUrl }) => {
        const order = await createRedeemedOrder(baseUrl, '13800139009', 'sk-balance-zero');

        const status = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=${encodeURIComponent(order.apiKey)}`, {
            headers: { 'x-internal-token': 'internal-test-token' }
        });

        assert.equal(status.response.status, 200);
        assert.equal(status.body.managed, true);
        assert.equal(status.body.active, false);
        assert.equal(status.body.status, 'insufficient_balance');
        assert.equal(status.body.billing.balanceCents, 0);
        assert.equal(status.body.billing.debtCents, 0);
    });
});

test('托管 API key 充值确认后恢复可用', async () => {
    await withServer(async ({ baseUrl }) => {
        const order = await createRedeemedOrder(baseUrl, '13800139010', 'sk-balance-positive');
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139010');
        await submitAndApproveTopup(baseUrl, cookie, '5');

        const status = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=${encodeURIComponent(order.apiKey)}`, {
            headers: { 'x-internal-token': 'internal-test-token' }
        });

        assert.equal(status.response.status, 200);
        assert.equal(status.body.managed, true);
        assert.equal(status.body.active, true);
        assert.equal(status.body.status, 'active');
        assert.equal(status.body.billing.balanceCents, 500);
    });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- --test-name-pattern='托管 API key'
```

Expected:

- 第一个测试失败，因为当前余额为 0 的 key 仍按订单有效期返回 `active: true`。
- 第二个测试失败，因为状态响应还没有 `billing` 字段。

- [ ] **Step 3: 增加余额拦截公开结果**

在 `publicAccountBalance()` 后加入：

```js
    function billingStatusForPhone(phone) {
        return publicAccountBalance(ensureAccountBalance(phone));
    }

    function billingBlockedStatus(phone) {
        const billing = billingStatusForPhone(phone);
        if (billing.balanceCents > 0) {
            return { blocked: false, billing };
        }
        return { blocked: true, billing };
    }
```

- [ ] **Step 4: 修改 `/api/internal/api-keys/status` 的订单有效分支**

把当前 active 订单返回逻辑改为：

```js
        const order = toOrder(orderRow);
        const active = getOrderStatus(order) === 'active';
        if (!active) {
            return res.json({
                managed: true,
                active: false,
                status: 'expired',
                expiresAt: order.expiresAt,
                billing: billingStatusForPhone(order.phone)
            });
        }

        const billingStatus = billingBlockedStatus(order.phone);
        if (billingStatus.blocked) {
            return res.json({
                managed: true,
                active: false,
                status: 'insufficient_balance',
                expiresAt: order.expiresAt,
                billing: billingStatus.billing
            });
        }

        return res.json({
            managed: true,
            active: true,
            status: 'active',
            expiresAt: order.expiresAt,
            billing: billingStatus.billing
        });
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```bash
npm test -- --test-name-pattern='托管 API key'
```

Expected:

- 余额为 0 的 key 返回 `status: insufficient_balance`。
- 充值确认后的 key 返回 `active: true`。

- [ ] **Step 6: 提交**

```bash
git add server.js test/shop-flow.test.js
git commit -m "feat: gate api keys by prepaid balance"
```

### Task 5: usage event 入库后生成扣费记录和账户流水

**Files:**
- Modify: `server.js`
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 写失败测试，验证实际费用扣款、负余额和重复 usage event 幂等**

在 `test/shop-flow.test.js` 中追加：

```js
test('usage event 写入后按 price_amount_micros 扣余额并生成用户可见扣费记录', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const order = await createRedeemedOrder(baseUrl, '13800139011', 'sk-charge-positive');
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139011');
        await submitAndApproveTopup(baseUrl, cookie, '1');

        const event = {
            version: 1,
            request_id: 'req-charge-001',
            api_key_hash: hashApiKeyForTest(order.apiKey),
            api_key_preview: keyPreviewForTest(order.apiKey),
            provider: 'codex',
            model: 'gpt-5.4',
            endpoint: '/v1/responses',
            success: true,
            failed: false,
            input_tokens: 100,
            output_tokens: 200,
            total_tokens: 300,
            price_amount_micros: 250000,
            price_currency: 'CNY',
            requested_at: '2026-06-10T12:00:00+08:00'
        };

        const inserted = await usageEventFetch(baseUrl, event);
        assert.equal(inserted.response.status, 201);

        const balance = await jsonFetch(`${baseUrl}/api/account/balance`, {
            headers: { cookie }
        });
        assert.equal(balance.body.balance.balanceCents, 75);

        const charge = db.prepare(`
SELECT phone, usage_event_id, charge_cents, balance_before_cents, balance_after_cents, status
FROM api_charge_records
WHERE usage_event_id = ?
`).get('req-charge-001');
        assert.deepEqual(charge, {
            phone: '13800139011',
            usage_event_id: 'req-charge-001',
            charge_cents: 25,
            balance_before_cents: 100,
            balance_after_cents: 75,
            status: 'charged'
        });

        const ledger = db.prepare(`
SELECT entry_type, amount_cents, balance_after_cents, related_id
FROM account_ledger_entries
WHERE related_id = ?
`).get('req-charge-001');
        assert.deepEqual(ledger, {
            entry_type: 'api_charge',
            amount_cents: -25,
            balance_after_cents: 75,
            related_id: 'req-charge-001'
        });
    }, { usageEventHmacSecret: 'usage-hmac-secret' });
});

test('余额很少时本次调用可扣成负数且下一次状态检查拒绝', async () => {
    await withServer(async ({ baseUrl }) => {
        const order = await createRedeemedOrder(baseUrl, '13800139012', 'sk-charge-negative');
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139012');
        await submitAndApproveTopup(baseUrl, cookie, '0.05');

        const inserted = await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-charge-negative',
            api_key_hash: hashApiKeyForTest(order.apiKey),
            api_key_preview: keyPreviewForTest(order.apiKey),
            provider: 'codex',
            model: 'gpt-5.4',
            endpoint: '/v1/responses',
            success: true,
            failed: false,
            input_tokens: 100,
            output_tokens: 200,
            total_tokens: 300,
            price_amount_micros: 200000,
            price_currency: 'CNY',
            requested_at: '2026-06-10T12:05:00+08:00'
        });
        assert.equal(inserted.response.status, 201);

        const balance = await jsonFetch(`${baseUrl}/api/account/balance`, {
            headers: { cookie }
        });
        assert.equal(balance.body.balance.balanceCents, -15);
        assert.equal(balance.body.balance.debtCents, 15);
        assert.equal(balance.body.balance.status, 'debt');

        const status = await jsonFetch(`${baseUrl}/api/internal/api-keys/status?apiKey=${encodeURIComponent(order.apiKey)}`, {
            headers: { 'x-internal-token': 'internal-test-token' }
        });
        assert.equal(status.body.active, false);
        assert.equal(status.body.status, 'insufficient_balance');
        assert.equal(status.body.billing.debtCents, 15);
    }, { usageEventHmacSecret: 'usage-hmac-secret' });
});

test('重复 usage event 不会重复扣费', async () => {
    await withServer(async ({ baseUrl }) => {
        const order = await createRedeemedOrder(baseUrl, '13800139013', 'sk-charge-idempotent');
        const cookie = await registerUserAndGetCookie(baseUrl, '13800139013');
        await submitAndApproveTopup(baseUrl, cookie, '1');

        const event = {
            version: 1,
            request_id: 'req-charge-idempotent',
            api_key_hash: hashApiKeyForTest(order.apiKey),
            api_key_preview: keyPreviewForTest(order.apiKey),
            provider: 'codex',
            model: 'gpt-5.4',
            endpoint: '/v1/responses',
            success: true,
            failed: false,
            input_tokens: 1,
            output_tokens: 1,
            total_tokens: 2,
            price_amount_micros: 100000,
            price_currency: 'CNY',
            requested_at: '2026-06-10T12:10:00+08:00'
        };

        const first = await usageEventFetch(baseUrl, event);
        assert.equal(first.response.status, 201);
        const duplicate = await usageEventFetch(baseUrl, event);
        assert.equal(duplicate.response.status, 200);

        const balance = await jsonFetch(`${baseUrl}/api/account/balance`, {
            headers: { cookie }
        });
        assert.equal(balance.body.balance.balanceCents, 90);
    }, { usageEventHmacSecret: 'usage-hmac-secret' });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- --test-name-pattern='usage event 写入后|余额很少|重复 usage event'
```

Expected:

- 测试失败，因为当前 usage event 不存价格字段，也不会扣余额。

- [ ] **Step 3: 扩展 usage event 价格字段入库**

在 `normalizeUsageEvent()` 返回对象中加入：

```js
        priceAmountMicros: body.price_amount_micros === undefined || body.price_amount_micros === null
            ? null
            : nonNegativeInteger(body.price_amount_micros),
        priceCurrency: String(body.price_currency || '').trim().toUpperCase()
```

修改 `insertUsageEvent`：

```js
    const insertUsageEvent = db.prepare(`
INSERT OR IGNORE INTO usage_events (
  request_id, api_key_hash, api_key_preview, provider, model, endpoint, source, auth_index,
  success, failed, input_tokens, output_tokens, reasoning_tokens, cached_tokens, total_tokens,
  latency_ms, requested_at, received_at, price_amount_micros, price_currency
)
VALUES (
  @requestId, @apiKeyHash, @apiKeyPreview, @provider, @model, @endpoint, @source, @authIndex,
  @success, @failed, @inputTokens, @outputTokens, @reasoningTokens, @cachedTokens, @totalTokens,
  @latencyMs, @requestedAt, @receivedAt, @priceAmountMicros, @priceCurrency
)
`);
```

修改 `listUsageEvents` 查询，加入：

```sql
       latency_ms, requested_at, received_at, price_amount_micros, price_currency
```

- [ ] **Step 4: 增加扣费 SQL 和归属查询**

在 prepared statements 区域加入：

```js
    const getPhoneByUsageApiKeyHash = db.prepare(`
SELECT o.phone AS phone
FROM api_keys ak
JOIN orders o ON o.api_key = ak.api_key
WHERE ak.api_key_hash = ?
UNION
SELECT phone
FROM usage_key_profiles
WHERE api_key_hash = ? AND phone != ''
LIMIT 1
`);

    const getApiChargeByUsageEventId = db.prepare(`
SELECT id, phone, usage_event_id, api_key_hash, model, input_tokens, output_tokens,
       total_tokens, price_version, charge_cents, balance_before_cents,
       balance_after_cents, status, created_at
FROM api_charge_records
WHERE usage_event_id = ?
`);

    const insertApiChargeRecord = db.prepare(`
INSERT INTO api_charge_records (
  id, phone, usage_event_id, api_key_hash, model, input_tokens, output_tokens,
  total_tokens, price_version, charge_cents, balance_before_cents,
  balance_after_cents, status, created_at
)
VALUES (
  @id, @phone, @usageEventId, @apiKeyHash, @model, @inputTokens, @outputTokens,
  @totalTokens, @priceVersion, @chargeCents, @balanceBeforeCents,
  @balanceAfterCents, @status, @createdAt
)
`);
```

- [ ] **Step 5: 增加价格换算和扣费事务**

在业务函数区域加入：

```js
    function chargeCentsFromUsageEvent(event) {
        if (event.failed) {
            return { chargeCents: 0, status: 'failed_no_charge', priceVersion: 'failed-no-charge' };
        }
        if (event.priceAmountMicros === null || event.priceAmountMicros === undefined || event.priceAmountMicros <= 0) {
            return { chargeCents: 0, status: 'unpriced_no_charge', priceVersion: 'usage-event-missing-price' };
        }
        const currency = String(event.priceCurrency || 'CNY').toUpperCase();
        if (currency !== 'CNY') {
            const error = new Error('usage event 价格币种必须是 CNY。');
            error.status = 400;
            error.code = 'UNSUPPORTED_USAGE_PRICE_CURRENCY';
            throw error;
        }
        return {
            chargeCents: Math.ceil(Number(event.priceAmountMicros) / 10000),
            status: 'charged',
            priceVersion: 'usage-event-price-micros-cny-v1'
        };
    }

    const chargeUsageEvent = db.transaction((event) => {
        if (getApiChargeByUsageEventId.get(event.requestId)) {
            return { charged: 0, skipped: 1 };
        }
        const owner = getPhoneByUsageApiKeyHash.get(event.apiKeyHash, event.apiKeyHash);
        if (!owner?.phone) {
            return { charged: 0, skipped: 1 };
        }
        const balanceRow = ensureAccountBalance(owner.phone);
        const pricing = chargeCentsFromUsageEvent(event);
        const balanceBeforeCents = Number(balanceRow.balance_cents || 0);
        const balanceAfterCents = balanceBeforeCents - pricing.chargeCents;
        const now = nowIso();

        insertApiChargeRecord.run({
            id: createId('CHARGE'),
            phone: owner.phone,
            usageEventId: event.requestId,
            apiKeyHash: event.apiKeyHash,
            model: event.model,
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
            totalTokens: event.totalTokens,
            priceVersion: pricing.priceVersion,
            chargeCents: pricing.chargeCents,
            balanceBeforeCents,
            balanceAfterCents,
            status: pricing.status,
            createdAt: now
        });

        if (pricing.chargeCents > 0) {
            updateBalanceCents.run(balanceAfterCents, now, owner.phone);
            insertLedgerEntry.run({
                id: createId('LEDGER'),
                phone: owner.phone,
                entryType: 'api_charge',
                amountCents: -pricing.chargeCents,
                balanceAfterCents,
                relatedId: event.requestId,
                memo: `${event.model || 'unknown'} API 调用扣费`,
                createdAt: now,
                createdByPhone: ''
            });
        }

        return { charged: pricing.chargeCents > 0 ? 1 : 0, skipped: 0 };
    });
```

- [ ] **Step 6: 修改 `storeUsageEvent()`，只在新插入时扣费**

把 `storeUsageEvent()` 结尾改为：

```js
        const result = insertUsageEvent.run(event);
        if (result.changes <= 0) {
            return { inserted: 0, skipped: 1 };
        }
        chargeUsageEvent(event);
        return { inserted: 1, skipped: 0 };
```

- [ ] **Step 7: 运行测试确认通过**

Run:

```bash
npm test -- --test-name-pattern='usage event 写入后|余额很少|重复 usage event'
```

Expected:

- 扣费、负余额、重复事件幂等测试全部通过。

- [ ] **Step 8: 提交**

```bash
git add server.js test/shop-flow.test.js
git commit -m "feat: charge usage events against balances"
```

### Task 6: 用户账户流水和扣费记录 API

**Files:**
- Modify: `server.js`
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 写失败测试，验证用户只能看到自己的流水和扣费**

在 `test/shop-flow.test.js` 中追加：

```js
test('用户账户页 API 返回自己的账户流水和扣费记录', async () => {
    await withServer(async ({ baseUrl }) => {
        const firstOrder = await createRedeemedOrder(baseUrl, '13800139014', 'sk-ledger-first');
        await createRedeemedOrder(baseUrl, '13800139015', 'sk-ledger-second');
        const firstCookie = await registerUserAndGetCookie(baseUrl, '13800139014');
        const secondCookie = await registerUserAndGetCookie(baseUrl, '13800139015');
        await submitAndApproveTopup(baseUrl, firstCookie, '1');

        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-ledger-first',
            api_key_hash: hashApiKeyForTest(firstOrder.apiKey),
            api_key_preview: keyPreviewForTest(firstOrder.apiKey),
            provider: 'codex',
            model: 'gpt-5.4',
            endpoint: '/v1/responses',
            success: true,
            failed: false,
            input_tokens: 10,
            output_tokens: 20,
            total_tokens: 30,
            price_amount_micros: 100000,
            price_currency: 'CNY',
            requested_at: '2026-06-10T12:15:00+08:00'
        });

        const ledger = await jsonFetch(`${baseUrl}/api/account/ledger`, {
            headers: { cookie: firstCookie }
        });
        assert.equal(ledger.response.status, 200);
        assert.equal(ledger.body.entries.length, 2);
        assert.deepEqual(ledger.body.entries.map((entry) => entry.entryType), ['api_charge', 'topup_approved']);

        const charges = await jsonFetch(`${baseUrl}/api/account/api-charges`, {
            headers: { cookie: firstCookie }
        });
        assert.equal(charges.response.status, 200);
        assert.equal(charges.body.charges.length, 1);
        assert.equal(charges.body.charges[0].usageEventId, 'req-ledger-first');
        assert.equal(charges.body.charges[0].chargeCents, 10);

        const secondLedger = await jsonFetch(`${baseUrl}/api/account/ledger`, {
            headers: { cookie: secondCookie }
        });
        assert.equal(secondLedger.body.entries.length, 0);
    }, { usageEventHmacSecret: 'usage-hmac-secret' });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- --test-name-pattern='账户页 API 返回自己的账户流水'
```

Expected:

- `/api/account/ledger` 和 `/api/account/api-charges` 不存在，测试失败。

- [ ] **Step 3: 增加列表 SQL 和公开转换函数**

在 prepared statements 区域加入：

```js
    const listLedgerEntriesByPhone = db.prepare(`
SELECT id, phone, entry_type, amount_cents, balance_after_cents, currency,
       related_id, memo, created_at, created_by_phone
FROM account_ledger_entries
WHERE phone = ?
ORDER BY created_at DESC, id DESC
LIMIT ?
`);

    const listApiChargeRecordsByPhone = db.prepare(`
SELECT id, phone, usage_event_id, api_key_hash, model, input_tokens, output_tokens,
       total_tokens, price_version, charge_cents, balance_before_cents,
       balance_after_cents, status, created_at
FROM api_charge_records
WHERE phone = ?
ORDER BY created_at DESC, id DESC
LIMIT ?
`);
```

在公开转换函数区域加入：

```js
    function publicLedgerEntry(row) {
        return {
            id: row.id,
            phone: row.phone,
            entryType: row.entry_type,
            amountCents: row.amount_cents,
            amount: centsToCny(row.amount_cents),
            balanceAfterCents: row.balance_after_cents,
            balanceAfter: centsToCny(row.balance_after_cents),
            currency: row.currency,
            relatedId: row.related_id || '',
            memo: row.memo || '',
            createdAt: row.created_at,
            createdByPhone: row.created_by_phone || ''
        };
    }

    function publicApiChargeRecord(row) {
        return {
            id: row.id,
            phone: row.phone,
            usageEventId: row.usage_event_id,
            apiKeyHash: row.api_key_hash,
            model: row.model || 'unknown',
            inputTokens: row.input_tokens,
            outputTokens: row.output_tokens,
            totalTokens: row.total_tokens,
            priceVersion: row.price_version,
            chargeCents: row.charge_cents,
            chargeAmount: centsToCny(row.charge_cents),
            balanceBeforeCents: row.balance_before_cents,
            balanceBefore: centsToCny(row.balance_before_cents),
            balanceAfterCents: row.balance_after_cents,
            balanceAfter: centsToCny(row.balance_after_cents),
            status: row.status,
            createdAt: row.created_at
        };
    }
```

- [ ] **Step 4: 增加用户流水和扣费记录接口**

在 Account API 区域加入：

```js
    app.get('/api/account/ledger', limitQueryApi, requireAccount, (req, res) => {
        const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
        const entries = listLedgerEntriesByPhone.all(req.account.phone, limit).map(publicLedgerEntry);
        return res.json({ entries });
    });

    app.get('/api/account/api-charges', limitQueryApi, requireAccount, (req, res) => {
        const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
        const charges = listApiChargeRecordsByPhone.all(req.account.phone, limit).map(publicApiChargeRecord);
        return res.json({ charges });
    });
```

- [ ] **Step 5: 运行测试确认通过**

Run:

```bash
npm test -- --test-name-pattern='账户页 API 返回自己的账户流水'
```

Expected:

- 用户账户流水和扣费记录测试通过。

- [ ] **Step 6: 提交**

```bash
git add server.js test/shop-flow.test.js
git commit -m "feat: expose account billing history"
```

### Task 7: Account 页面展示余额、充值申请、流水和扣费记录

**Files:**
- Modify: `shop/account/index.html`
- Modify: `shop/shop.js`
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 写静态失败测试，验证 Account 页面包含账务容器**

在 `test/shop-flow.test.js` 中追加：

```js
test('Account 页面包含预充值余额、充值申请和扣费流水容器', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop', 'account', 'index.html'), 'utf8');

    assert.match(html, /id="accountBalanceCards"/);
    assert.match(html, /id="topupForm"/);
    assert.match(html, /id="topupAmount"/);
    assert.match(html, /id="accountTopups"/);
    assert.match(html, /id="accountCharges"/);
    assert.match(html, /id="accountLedger"/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- --test-name-pattern='Account 页面包含预充值余额'
```

Expected:

- 测试失败，因为 HTML 还没有这些容器。

- [ ] **Step 3: 修改 `shop/account/index.html`，在 API key 区域前加入余额与充值区**

在 `accountMessage` 段落后、Keys 区域前加入：

```html
        <section id="accountBillingSection" class="mb-10">
            <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                    <p class="text-xs uppercase tracking-[0.24em] text-text-muted dark:text-dark-text-muted">Balance</p>
                    <h2 class="mt-2 font-display text-3xl text-primary dark:text-dark-text">账户余额</h2>
                </div>
                <p id="accountBillingMessage" class="text-sm text-text-muted dark:text-dark-text-muted"></p>
            </div>
            <div id="accountBalanceCards" class="mt-6 grid gap-3 md:grid-cols-4"></div>
            <div class="mt-6 grid gap-5 lg:grid-cols-[1fr_1.2fr]">
                <section class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-5">
                    <h3 class="font-display text-2xl text-primary dark:text-dark-text">充值</h3>
                    <div class="mt-5 grid gap-4 sm:grid-cols-2">
                        <figure class="rounded-md border border-border-subtle dark:border-dark-border bg-background-soft dark:bg-dark-surface p-3">
                            <img id="alipayQrImage" class="aspect-square w-full object-contain" alt="支付宝收款码"/>
                            <figcaption class="mt-2 text-center text-sm text-text-muted dark:text-dark-text-muted">支付宝</figcaption>
                        </figure>
                        <figure class="rounded-md border border-border-subtle dark:border-dark-border bg-background-soft dark:bg-dark-surface p-3">
                            <img id="wechatQrImage" class="aspect-square w-full object-contain" alt="微信收款码"/>
                            <figcaption class="mt-2 text-center text-sm text-text-muted dark:text-dark-text-muted">微信</figcaption>
                        </figure>
                    </div>
                    <p class="mt-4 text-sm text-text-muted dark:text-dark-text-muted">付款备注：<code id="paymentReference" class="text-primary dark:text-dark-text">-</code></p>
                    <form id="topupForm" class="mt-5 grid gap-3">
                        <input id="topupAmount" class="h-11 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary" type="number" inputmode="decimal" min="0.01" step="0.01" placeholder="充值金额，单位元" required/>
                        <select id="topupPaymentMethod" class="h-11 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary">
                            <option value="alipay">支付宝</option>
                            <option value="wechat">微信</option>
                        </select>
                        <input id="topupPaymentTime" class="h-11 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary" type="datetime-local"/>
                        <textarea id="topupPaymentNote" class="min-h-24 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary" placeholder="付款备注，可填写转账备注或截图链接"></textarea>
                        <button class="btn-primary" type="submit">提交充值申请</button>
                    </form>
                    <p id="topupMessage" class="mt-3 min-h-5 text-sm text-text-muted dark:text-dark-text-muted"></p>
                </section>
                <section class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-5">
                    <h3 class="font-display text-2xl text-primary dark:text-dark-text">充值记录</h3>
                    <div id="accountTopups" class="mt-5"></div>
                </section>
            </div>
        </section>
```

在 Usage 区域后加入：

```html
        <section id="accountBillingHistorySection" class="mt-12">
            <div>
                <p class="text-xs uppercase tracking-[0.24em] text-text-muted dark:text-dark-text-muted">Billing</p>
                <h2 class="mt-2 font-display text-3xl text-primary dark:text-dark-text">扣费与流水</h2>
            </div>
            <div class="mt-6 grid gap-5 lg:grid-cols-2">
                <section class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-5 overflow-x-auto">
                    <h3 class="font-display text-2xl text-primary dark:text-dark-text">API 扣费记录</h3>
                    <div id="accountCharges" class="mt-5"></div>
                </section>
                <section class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-5 overflow-x-auto">
                    <h3 class="font-display text-2xl text-primary dark:text-dark-text">账户流水</h3>
                    <div id="accountLedger" class="mt-5"></div>
                </section>
            </div>
        </section>
```

- [ ] **Step 4: 在 `shop/shop.js` 增加账务渲染函数**

在 `formatPrice()` 后加入：

```js
    function formatCents(cents) {
        return `¥${(Number(cents || 0) / 100).toFixed(2)}`;
    }

    function billingStatusText(status) {
        const map = {
            available: '可用',
            empty: '余额为 0',
            debt: '欠费'
        };
        return map[status] || status || '-';
    }

    function topupStatusText(status) {
        const map = {
            pending: '待确认',
            approved: '已入账',
            rejected: '已拒绝',
            cancelled: '已取消'
        };
        return map[status] || status || '-';
    }

    function ledgerEntryText(type) {
        const map = {
            topup_approved: '充值入账',
            api_charge: 'API 扣费',
            admin_adjustment: '管理员调整',
            refund: '退款'
        };
        return map[type] || type || '-';
    }

    function chargeStatusText(status) {
        const map = {
            charged: '已扣费',
            failed_no_charge: '失败未扣费',
            unpriced_no_charge: '未计价',
            adjusted: '已调整'
        };
        return map[status] || status || '-';
    }
```

在 usage 渲染函数附近加入：

```js
    function renderBalanceCards(balance = {}) {
        const cards = [
            ['当前余额', formatCents(balance.balanceCents), billingStatusText(balance.status)],
            ['欠费金额', formatCents(balance.debtCents), balance.debtCents > 0 ? '需补缴' : '无欠费'],
            ['待确认充值', formatCents(balance.pendingTopupCents), '确认后入账'],
            ['欠费上限', formatCents(balance.creditLimitCents), balance.creditExceeded ? '已超过' : '默认上限']
        ];
        return cards.map(([label, value, hint]) => `
            <article class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-4">
                <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">${escapeHtml(label)}</p>
                <p class="mt-2 text-2xl font-display text-primary dark:text-dark-text">${escapeHtml(value)}</p>
                <p class="mt-1 text-xs text-text-muted dark:text-dark-text-muted">${escapeHtml(hint)}</p>
            </article>
        `).join('');
    }

    function renderTopups(topups = []) {
        if (!topups.length) return '<p class="text-sm text-text-muted dark:text-dark-text-muted">暂无充值申请。</p>';
        return `
            <div class="space-y-3">
                ${topups.map((topup) => `
                    <article class="rounded-md border border-border-subtle dark:border-dark-border bg-background-soft dark:bg-dark-surface p-4">
                        <div class="flex items-start justify-between gap-3">
                            <div>
                                <p class="font-medium text-primary dark:text-dark-text">${escapeHtml(formatCents(topup.requestedAmountCents))}</p>
                                <p class="mt-1 text-sm text-text-muted dark:text-dark-text-muted">${escapeHtml(topup.paymentMethod === 'wechat' ? '微信' : '支付宝')} · ${escapeHtml(formatDate(topup.createdAt))}</p>
                            </div>
                            <span class="rounded-full border border-border-subtle dark:border-dark-border px-3 py-1 text-xs text-text-muted dark:text-dark-text-muted">${escapeHtml(topupStatusText(topup.status))}</span>
                        </div>
                        ${topup.adminNote ? `<p class="mt-2 text-sm text-text-muted dark:text-dark-text-muted">${escapeHtml(topup.adminNote)}</p>` : ''}
                    </article>
                `).join('')}
            </div>
        `;
    }

    function renderCharges(charges = []) {
        if (!charges.length) return '<p class="text-sm text-text-muted dark:text-dark-text-muted">暂无 API 扣费记录。</p>';
        return `
            <table class="min-w-full text-sm">
                <thead class="text-left text-xs uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
                    <tr><th class="py-2 pr-3">时间</th><th class="py-2 pr-3">模型</th><th class="py-2 pr-3">Token</th><th class="py-2 pr-3">费用</th><th class="py-2 pr-3">余额</th><th class="py-2">状态</th></tr>
                </thead>
                <tbody>
                    ${charges.map((charge) => `
                        <tr class="border-t border-border-subtle dark:border-dark-border">
                            <td class="py-2 pr-3">${escapeHtml(formatDate(charge.createdAt))}</td>
                            <td class="py-2 pr-3">${escapeHtml(charge.model)}</td>
                            <td class="py-2 pr-3">${escapeHtml(`${formatNumber(charge.inputTokens)} / ${formatNumber(charge.outputTokens)} / ${formatNumber(charge.totalTokens)}`)}</td>
                            <td class="py-2 pr-3">${escapeHtml(formatCents(charge.chargeCents))}</td>
                            <td class="py-2 pr-3">${escapeHtml(formatCents(charge.balanceAfterCents))}</td>
                            <td class="py-2">${escapeHtml(chargeStatusText(charge.status))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function renderLedger(entries = []) {
        if (!entries.length) return '<p class="text-sm text-text-muted dark:text-dark-text-muted">暂无账户流水。</p>';
        return `
            <table class="min-w-full text-sm">
                <thead class="text-left text-xs uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
                    <tr><th class="py-2 pr-3">时间</th><th class="py-2 pr-3">类型</th><th class="py-2 pr-3">金额</th><th class="py-2 pr-3">余额</th><th class="py-2">备注</th></tr>
                </thead>
                <tbody>
                    ${entries.map((entry) => `
                        <tr class="border-t border-border-subtle dark:border-dark-border">
                            <td class="py-2 pr-3">${escapeHtml(formatDate(entry.createdAt))}</td>
                            <td class="py-2 pr-3">${escapeHtml(ledgerEntryText(entry.entryType))}</td>
                            <td class="py-2 pr-3">${escapeHtml(formatCents(entry.amountCents))}</td>
                            <td class="py-2 pr-3">${escapeHtml(formatCents(entry.balanceAfterCents))}</td>
                            <td class="py-2">${escapeHtml(entry.memo || '-')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
```

- [ ] **Step 5: 在 `initAccountPage()` 拉取和提交账务数据**

在 `initAccountPage()` DOM 获取区域加入：

```js
        const balanceCards = document.getElementById('accountBalanceCards');
        const billingMessage = document.getElementById('accountBillingMessage');
        const topupForm = document.getElementById('topupForm');
        const topupAmount = document.getElementById('topupAmount');
        const topupPaymentMethod = document.getElementById('topupPaymentMethod');
        const topupPaymentTime = document.getElementById('topupPaymentTime');
        const topupPaymentNote = document.getElementById('topupPaymentNote');
        const topupMessage = document.getElementById('topupMessage');
        const accountTopups = document.getElementById('accountTopups');
        const accountCharges = document.getElementById('accountCharges');
        const accountLedger = document.getElementById('accountLedger');
        const alipayQrImage = document.getElementById('alipayQrImage');
        const wechatQrImage = document.getElementById('wechatQrImage');
        const paymentReference = document.getElementById('paymentReference');
```

在 `initAccountPage()` 内部、usage 拉取前加入：

```js
        async function refreshBilling() {
            if (billingMessage) billingMessage.textContent = '正在读取账务信息...';
            const [balanceData, topupData, chargeData, ledgerData] = await Promise.all([
                requestJson('/api/account/balance'),
                requestJson('/api/account/topups'),
                requestJson('/api/account/api-charges'),
                requestJson('/api/account/ledger')
            ]);
            if (balanceCards) balanceCards.innerHTML = renderBalanceCards(balanceData.balance || {});
            if (accountTopups) accountTopups.innerHTML = renderTopups(topupData.topups || []);
            if (accountCharges) accountCharges.innerHTML = renderCharges(chargeData.charges || []);
            if (accountLedger) accountLedger.innerHTML = renderLedger(ledgerData.entries || []);
            if (alipayQrImage) alipayQrImage.src = balanceData.payment?.alipayQrUrl || '';
            if (wechatQrImage) wechatQrImage.src = balanceData.payment?.wechatQrUrl || '';
            if (paymentReference) paymentReference.textContent = balanceData.payment?.paymentReference || '-';
            if (billingMessage) billingMessage.textContent = '';
        }

        try {
            await refreshBilling();
        } catch (error) {
            if (billingMessage) billingMessage.textContent = error.message;
        }

        if (topupForm && topupAmount && topupPaymentMethod && topupMessage) {
            topupForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                topupMessage.textContent = '正在提交充值申请...';
                try {
                    await requestJson('/api/account/topups', {
                        method: 'POST',
                        body: JSON.stringify({
                            amount: topupAmount.value,
                            paymentMethod: topupPaymentMethod.value,
                            paymentTime: topupPaymentTime?.value || '',
                            paymentNote: topupPaymentNote?.value || ''
                        })
                    });
                    topupForm.reset();
                    topupMessage.textContent = '充值申请已提交，管理员确认后会入账。';
                    await refreshBilling();
                } catch (error) {
                    topupMessage.textContent = error.message;
                }
            });
        }
```

- [ ] **Step 6: 运行静态测试确认通过**

Run:

```bash
npm test -- --test-name-pattern='Account 页面包含预充值余额'
```

Expected:

- Account 页面容器测试通过。

- [ ] **Step 7: 构建 CSS**

Run:

```bash
npm run build:css
```

Expected:

- Tailwind 构建完成。
- 如果只出现 caniuse-lite 过期提示，不阻塞。

- [ ] **Step 8: 提交**

```bash
git add shop/account/index.html shop/shop.js styles/site.css test/shop-flow.test.js
git commit -m "feat: show prepaid balance on account page"
```

### Task 8: Admin 页面展示和处理充值申请

**Files:**
- Modify: `shop/admin/index.html`
- Modify: `shop/shop.js`
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 写静态失败测试，验证 Admin 页面包含充值审核容器**

在 `test/shop-flow.test.js` 中追加：

```js
test('Admin 页面包含充值审核容器', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop', 'admin', 'index.html'), 'utf8');

    assert.match(html, /id="adminTopupRefreshButton"/);
    assert.match(html, /id="adminTopupStatusFilter"/);
    assert.match(html, /id="adminTopupTable"/);
    assert.match(html, /id="adminTopupMessage"/);
});
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
npm test -- --test-name-pattern='Admin 页面包含充值审核容器'
```

Expected:

- 测试失败，因为 Admin HTML 还没有充值审核区域。

- [ ] **Step 3: 修改 `shop/admin/index.html` 加入充值审核区域**

在密码重置区和 usage 区之间加入：

```html
        <section id="adminTopupSection" class="mt-10 border-t border-border-subtle dark:border-dark-border pt-10">
            <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                    <p class="text-xs uppercase tracking-[0.28em] text-text-muted dark:text-dark-text-muted">Topups</p>
                    <h2 class="mt-3 font-display text-3xl md:text-4xl">充值审核</h2>
                </div>
                <button id="adminTopupRefreshButton" class="btn-secondary dark:bg-dark-card dark:border-dark-border dark:text-dark-text" type="button">刷新</button>
            </div>
            <div class="mt-6 grid gap-3 md:grid-cols-[12rem_1fr]">
                <select id="adminTopupStatusFilter" class="h-11 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary">
                    <option value="pending">待确认</option>
                    <option value="approved">已入账</option>
                    <option value="rejected">已拒绝</option>
                    <option value="all">全部</option>
                </select>
                <p id="adminTopupMessage" class="self-center text-sm text-text-muted dark:text-dark-text-muted"></p>
            </div>
            <div id="adminTopupTable" class="mt-6 overflow-x-auto rounded-lg border border-border-subtle dark:border-dark-border"></div>
        </section>
```

- [ ] **Step 4: 在 `shop/shop.js` 增加管理员充值渲染和操作函数**

在 topup 渲染函数后加入：

```js
    function renderAdminTopups(topups = []) {
        if (!topups.length) {
            return '<div class="p-5 text-sm text-text-muted dark:text-dark-text-muted">暂无充值申请。</div>';
        }
        return `
            <table class="min-w-full divide-y divide-border-subtle dark:divide-dark-border text-sm">
                <thead class="bg-background-soft dark:bg-dark-surface text-left text-xs uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
                    <tr>
                        <th class="px-4 py-3">用户</th>
                        <th class="px-4 py-3">金额</th>
                        <th class="px-4 py-3">方式</th>
                        <th class="px-4 py-3">备注</th>
                        <th class="px-4 py-3">状态</th>
                        <th class="px-4 py-3">操作</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-border-subtle dark:divide-dark-border bg-white dark:bg-dark-card">
                    ${topups.map((topup) => `
                        <tr data-topup-id="${escapeHtml(topup.id)}">
                            <td class="px-4 py-3">${escapeHtml(topup.phone)}</td>
                            <td class="px-4 py-3">${escapeHtml(formatCents(topup.requestedAmountCents))}</td>
                            <td class="px-4 py-3">${escapeHtml(topup.paymentMethod === 'wechat' ? '微信' : '支付宝')}</td>
                            <td class="px-4 py-3">${escapeHtml(topup.paymentNote || '-')}</td>
                            <td class="px-4 py-3">${escapeHtml(topupStatusText(topup.status))}</td>
                            <td class="px-4 py-3">
                                ${topup.status === 'pending' ? `
                                    <div class="flex flex-col gap-2 min-w-40">
                                        <input class="h-9 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary" data-confirmed-amount value="${escapeHtml(String(topup.requestedAmount || ''))}" inputmode="decimal"/>
                                        <input class="h-9 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary" data-admin-note placeholder="管理员备注"/>
                                        <div class="flex gap-2">
                                            <button class="btn-primary px-3 py-2 text-xs" type="button" data-approve-topup>确认</button>
                                            <button class="btn-secondary dark:bg-dark-card dark:border-dark-border dark:text-dark-text px-3 py-2 text-xs" type="button" data-reject-topup>拒绝</button>
                                        </div>
                                    </div>
                                ` : '-'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
```

新增初始化函数：

```js
    function initAdminTopupPage() {
        const refreshButton = document.getElementById('adminTopupRefreshButton');
        const statusFilter = document.getElementById('adminTopupStatusFilter');
        const tableRoot = document.getElementById('adminTopupTable');
        const message = document.getElementById('adminTopupMessage');
        if (!refreshButton || !statusFilter || !tableRoot || !message) return;

        async function fetchTopups() {
            message.textContent = '正在刷新...';
            try {
                const data = await requestJson(`/api/admin/topups?status=${encodeURIComponent(statusFilter.value)}`);
                tableRoot.innerHTML = renderAdminTopups(data.topups || []);
                message.textContent = `共 ${(data.topups || []).length} 条。`;
            } catch (error) {
                message.textContent = error.message;
            }
        }

        tableRoot.addEventListener('click', async (event) => {
            const approveButton = event.target.closest('[data-approve-topup]');
            const rejectButton = event.target.closest('[data-reject-topup]');
            if (!approveButton && !rejectButton) return;
            const row = event.target.closest('[data-topup-id]');
            const id = row?.getAttribute('data-topup-id');
            if (!id) return;
            const adminNote = row.querySelector('[data-admin-note]')?.value || '';
            const confirmedAmount = row.querySelector('[data-confirmed-amount]')?.value || '';
            message.textContent = approveButton ? '正在确认入账...' : '正在拒绝申请...';
            try {
                if (approveButton) {
                    await requestJson(`/api/admin/topups/${encodeURIComponent(id)}/approve`, {
                        method: 'POST',
                        body: JSON.stringify({ confirmedAmount, adminNote })
                    });
                } else {
                    await requestJson(`/api/admin/topups/${encodeURIComponent(id)}/reject`, {
                        method: 'POST',
                        body: JSON.stringify({ adminNote })
                    });
                }
                await fetchTopups();
            } catch (error) {
                message.textContent = error.message;
            }
        });

        refreshButton.addEventListener('click', fetchTopups);
        statusFilter.addEventListener('change', fetchTopups);
        fetchTopups();
    }
```

在 `initAdminPage()` 开头加入：

```js
        initAdminTopupPage();
```

- [ ] **Step 5: 运行静态测试确认通过**

Run:

```bash
npm test -- --test-name-pattern='Admin 页面包含充值审核容器'
```

Expected:

- Admin 充值审核容器测试通过。

- [ ] **Step 6: 构建 CSS**

Run:

```bash
npm run build:css
```

Expected:

- Tailwind 构建完成。
- caniuse-lite 过期提示不阻塞。

- [ ] **Step 7: 提交**

```bash
git add shop/admin/index.html shop/shop.js styles/site.css test/shop-flow.test.js
git commit -m "feat: review topups in admin page"
```

### Task 9: 完整回归、文档和人工验证

**Files:**
- Create: implementation record under `docs/ai/context/` using the timestamped command in Step 7.

- [ ] **Step 1: 运行完整测试**

Run:

```bash
npm test
```

Expected:

- 所有 `node:test` 测试通过。

- [ ] **Step 2: 构建 CSS**

Run:

```bash
npm run build:css
```

Expected:

- 构建通过。
- 若只出现 caniuse-lite 数据过期提示，不阻塞。

- [ ] **Step 3: 启动本地服务**

Run:

```bash
npm start
```

Expected:

- 输出包含 `Yui web shop server listening on http://localhost:4173` 或当前配置端口。

- [ ] **Step 4: 浏览器人工验证用户流程**

打开：

```text
http://localhost:4173/shop/account/
```

验证：

- 未登录访问跳转 `/shop/login/`。
- 登录普通用户后 Account 页面显示余额卡片。
- 新用户余额显示 `¥0.00`。
- 提交 `30` 元充值申请后，待确认充值显示 `¥30.00`，当前余额仍为 `¥0.00`。
- 管理员确认前，API key 状态接口返回 `insufficient_balance`。

- [ ] **Step 5: 浏览器人工验证管理员流程**

打开：

```text
http://localhost:4173/shop/admin/
```

验证：

- 管理员能看到充值审核列表。
- 待确认充值可确认入账。
- 管理员确认 `30` 元后，用户 Account 页面当前余额变成 `¥30.00`。
- 拒绝充值不会改变当前余额。

- [ ] **Step 6: 人工验证扣费流程**

从 Account 页面复制用于人工验证的测试 API key，设置到 `TEST_API_KEY`，然后用下面的命令生成带 `price_amount_micros` 和 `price_currency: "CNY"` 的事件体：

```bash
TEST_API_KEY='codex_yui_from_account_page'
node - <<'NODE'
const crypto = require('node:crypto');
const apiKey = process.env.TEST_API_KEY;
const body = {
  version: 1,
  request_id: 'manual-charge-check',
  api_key_hash: crypto.createHash('sha256').update(apiKey).digest('hex'),
  api_key_preview: `${apiKey.slice(0, 12)}...${apiKey.slice(-6)}`,
  provider: 'codex',
  model: 'gpt-5.4',
  endpoint: '/v1/responses',
  success: true,
  failed: false,
  input_tokens: 100,
  output_tokens: 200,
  total_tokens: 300,
  price_amount_micros: 250000,
  price_currency: 'CNY',
  requested_at: '2026-06-10T13:00:00+08:00'
};
console.log(JSON.stringify(body, null, 2));
NODE
```

验证：

- Account 页面 API 扣费记录新增一条。
- 账户流水新增 `API 扣费`。
- 当前余额减少 `¥0.25`。
- 如果余额从 `¥0.05` 被扣到 `-¥0.15`，下一次 API key 状态检查返回 `insufficient_balance`。

- [ ] **Step 7: 新增实施记录文档**

新建实施记录文件：

```bash
date +%Y%m%d-%H%M%S
```

把命令输出作为文件名前缀，使用 `apply_patch` 新增 `docs/ai/context/<命令输出>-shop-prepaid-balance-implementation_CN.md`，文件内容为：

```md
# Shop 预充值余额实施记录

## 范围

- 新增预充值余额表、充值申请表、账户流水表和 API 扣费记录表。
- 新增用户充值申请、余额查询、流水查询和扣费记录查询接口。
- 新增管理员充值确认和拒绝接口。
- API key 状态接口按余额拦截调用。
- usage event 入库后按 `price_amount_micros` 扣余额。
- Account 页面展示余额、充值申请、扣费记录和账户流水。
- Admin 页面展示充值审核。

## 验证

- `npm test`：通过。
- `npm run build:css`：通过。
- 本地浏览器验证：通过。

## 重要边界

- 用户提交充值申请不自动入账。
- 管理员确认金额是最终入账金额。
- 余额小于等于 0 时 API key 状态返回 `insufficient_balance`。
- 调用后允许余额变负，负余额后下一次调用拒绝。
- 默认欠费上限为 10 元。
```

- [ ] **Step 8: 最终提交**

```bash
git add server.js test/shop-flow.test.js shop/account/index.html shop/admin/index.html shop/shop.js styles/site.css docs/ai/context/*shop-prepaid-balance-implementation_CN.md
git commit -m "feat: add prepaid balance billing"
```

## 自检清单

### 规格覆盖

- 新用户余额默认为 `0`：Task 1。
- 用户任意金额充值：Task 2。
- 用户提交后待确认，不自动入账：Task 2。
- 管理员确认后入账：Task 3。
- 管理员可拒绝充值：Task 3。
- 余额不足时拒绝新调用：Task 4。
- 调用后按实际费用扣款：Task 5。
- 调用后允许余额变负：Task 5。
- 负余额后下一次调用拒绝：Task 5。
- 默认欠费上限 `10 元`：Task 1、Task 4、Task 5。
- 每次 API 调用有用户可见记录：Task 5、Task 6、Task 7。
- Account 页面展示余额、待确认充值、充值记录、扣费和流水：Task 7。
- Admin 页面处理充值审核：Task 8。

### 不在本计划中实现

- 支付宝或微信官方回调。
- 个人免签或监听收款通知。
- 自动按用户填写金额入账。
- 文件上传式付款截图。
- 发票、税务、企业财务能力。
- 用户级信用额度配置页面。
- 月度正式账单。

### 执行注意

- 每个任务完成后先跑该任务指定测试，再提交。
- 涉及 `shop/account/index.html`、`shop/admin/index.html` 或 `shop/shop.js` 的任务需要运行 `npm run build:css`。
- `server.js` 目前已有集中式结构，本计划不拆文件，避免在账务功能落地时扩大改动面。
- 现有工作区如果有未提交改动，执行前先用 `git status --short` 确认哪些是本任务改动，不能覆盖用户改动。
