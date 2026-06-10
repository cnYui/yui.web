# Shop Account Usage Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除公开手机号查询，把订单/API key/个人 token 用量统一收敛到登录后的 `/shop/account/`。

**Architecture:** 后端以 `user_sessions.phone` 作为唯一授权根，不再接受前端传入手机号决定数据归属。前端保留静态 HTML + 原生 JS 的实现方式，Account 页通过 `/api/account/me` 和 `/api/account/usage-summary` 拉取当前用户自己的订单、完整 API key 和聚合用量。MVP 图表使用原生 HTML/CSS 渲染，完整版本保留 Chart.js 或原生 SVG 的演进方向。

**Tech Stack:** Node.js、Express 5、better-sqlite3、node:test、Tailwind CSS、静态 HTML、原生浏览器 API。

---

## 边界

- 公开页面只保留 `/shop/login/`、`/shop/login/index.html`、`/shop/register/`、`/shop/register/index.html`。
- 其他 `/shop/*` 页面未登录全部 302 到 `/shop/login/`。
- `/shop/query/` 不再展示手机号输入框；未登录跳登录，已登录跳 `/shop/account/`。
- `/shop/` 未登录跳登录，已登录跳 `/shop/account/`。
- 首页静态内容仍要删除“手机号查询”按钮，避免绕过路由或静态托管时出现旧入口。
- `/api/orders?phone=...` 不再公开返回订单；MVP 中保留接口但必须登录，并且只返回当前 session 手机号下的订单。
- `/api/account/me` 返回当前登录用户自己的完整 API key。
- `/api/account/usage-summary` 只统计当前登录用户手机号关联的 key。
- 登录信息不存 localStorage/sessionStorage。浏览器只保存 `HttpOnly` cookie `yui_shop_account_session`；服务端 `user_sessions` 只保存 token hash；过期时间沿用现有 `durationDays = 31`。

## 文件结构

- Modify: `test/shop-flow.test.js`
  - 调整旧的公开查询测试。
  - 增加 Shop 页面登录保护测试。
  - 增加 Account 完整 API key 和个人用量汇总测试。
- Modify: `server.js`
  - 收敛 `/api/orders`。
  - 扩展 `/api/account/me`。
  - 新增 `/api/account/usage-summary`。
  - 增加 Shop 页面路由保护和 query 跳转。
- Modify: `shop/index.html`
  - 删除“手机号查询”按钮。
  - 调整按钮布局，避免按钮文字生硬换行。
- Modify: `shop/query/index.html`
  - 删除手机号查询表单。
  - 只保留跳转说明作为静态兜底。
- Modify: `shop/account/index.html`
  - 增加 API key/订单区标题。
  - 增加用量概览、token 拆分、小时图、月度图容器。
- Modify: `shop/shop.js`
  - `initAccountPage()` 展示完整 key 并绑定复制。
  - 新增个人用量渲染函数。
  - `initQueryPage()` 改为跳转 `/shop/account/` 的兜底逻辑。
- Modify: `styles/site.css`
  - 由 `npm run build:css` 生成，不手工编辑。

## 数据与接口约定

### 会话保存

当前结构可直接复用：

```js
const durationDays = 31;
const accountCookieName = 'yui_shop_account_session';
const accountSessionMaxAgeMs = durationDays * 24 * 60 * 60 * 1000;

function accountCookieOptions(req) {
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: req.secure || req.header('x-forwarded-proto') === 'https',
        maxAge: accountSessionMaxAgeMs,
        path: '/'
    };
}
```

服务端继续在 `user_sessions` 保存 `token_hash`、`phone`、`created_at`、`expires_at`、`revoked_at`。用户退出时写 `revoked_at` 并清 cookie。前端不读取 session 内容。

### `/api/account/me`

返回当前登录手机号自己的订单和完整 API key：

```json
{
  "user": {
    "phone": "13800138601",
    "isAdmin": false
  },
  "orders": [
    {
      "id": "ORDER123",
      "phone": "13800138601",
      "productName": "Codex 按量计费",
      "amount": 30,
      "apiKey": "sk-account-a",
      "apiKeyPreview": "sk-account-a...ount-a",
      "status": "active",
      "redeemedAt": "2026-06-10T10:00:00+08:00",
      "expiresAt": "2026-07-11T10:00:00+08:00"
    }
  ]
}
```

### `/api/account/usage-summary`

MVP 返回固定结构，不要求实时推送：

```json
{
  "generatedAt": "2026-06-10T10:00:00+08:00",
  "dataFreshness": {
    "mode": "delayed",
    "maxDelayMinutes": 60,
    "lastEventAt": "2026-06-10T09:05:00+08:00"
  },
  "summary": {
    "today": {
      "inputTokens": 10,
      "outputTokens": 20,
      "reasoningTokens": 3,
      "cachedTokens": 4,
      "totalTokens": 33,
      "requests": 1,
      "failedRequests": 0
    },
    "week": {
      "inputTokens": 10,
      "outputTokens": 20,
      "reasoningTokens": 3,
      "cachedTokens": 4,
      "totalTokens": 33,
      "requests": 1,
      "failedRequests": 0
    },
    "month": {
      "inputTokens": 10,
      "outputTokens": 20,
      "reasoningTokens": 3,
      "cachedTokens": 4,
      "totalTokens": 33,
      "requests": 1,
      "failedRequests": 0
    }
  },
  "hourly": [
    {
      "bucket": "2026-06-10T09:00:00+08:00",
      "inputTokens": 10,
      "outputTokens": 20,
      "reasoningTokens": 3,
      "cachedTokens": 4,
      "totalTokens": 33,
      "requests": 1,
      "failedRequests": 0
    }
  ],
  "daily": [
    {
      "bucket": "2026-06-10",
      "inputTokens": 10,
      "outputTokens": 20,
      "reasoningTokens": 3,
      "cachedTokens": 4,
      "totalTokens": 33,
      "requests": 1,
      "failedRequests": 0
    }
  ],
  "byModel": [
    {
      "model": "gpt-5.4",
      "totalTokens": 33,
      "requests": 1
    }
  ],
  "byApiKey": [
    {
      "apiKeyPreview": "sk-account-a...ount-a",
      "totalTokens": 33,
      "requests": 1
    }
  ]
}
```

## Task 1: 写失败测试，锁定新的安全边界

**Files:**
- Modify: `test/shop-flow.test.js`

- [ ] **Step 1: 增加测试 helper**

在 `seedAdminUserForTest()` 后增加 helper，后续测试复用注册 cookie：

```js
async function registerUserAndGetCookie(baseUrl, phone = '13800138690', password = 'Abcdefg1') {
    const result = await jsonFetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ phone, password, confirmPassword: password })
    });
    assert.equal(result.response.status, 201);
    const cookie = result.response.headers.get('set-cookie') || '';
    assert.match(cookie, /yui_shop_account_session=/);
    return cookie;
}
```

- [ ] **Step 2: 把首个兑换测试里的公开手机号查询断言改为未登录拒绝**

替换 `用户用手机号和邀请码兑换后...` 测试结尾的 `/api/orders?phone=13800138000` 断言：

```js
const publicQuery = await jsonFetch(`${baseUrl}/api/orders?phone=13800138000`);
assert.equal(publicQuery.response.status, 401);
assert.equal(publicQuery.body.code, 'ACCOUNT_LOGIN_REQUIRED');
```

运行：

```bash
npm test
```

Expected: FAIL，因为当前 `/api/orders` 仍公开返回 200。

- [ ] **Step 3: 替换“手机号查询会持久展示已过期订单”测试**

把测试名和断言改为登录后的 Account 能看到历史过期订单和完整 API key：

```js
test('Account 页面数据会持久展示已过期订单和完整 API key', async () => {
    await withServer(async ({ baseUrl, db }) => {
        db.prepare('INSERT INTO users (phone, created_at) VALUES (?, ?)').run('13800138200', '2000-01-01T00:00:00.000Z');
        db.prepare(`
INSERT INTO orders (id, phone, invite_code, api_key, api_key_preview, product_name, amount, redeemed_at, expires_at, result_token)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
            'ORDER-EXPIRED-KEEP',
            '13800138200',
            'YUI-EXPIRED-KEEP',
            'sk-expired-keep-visible',
            'sk-expired...visible',
            'Codex 按量计费',
            30,
            '2000-01-01T00:00:00.000Z',
            '2000-02-01T00:00:00.000Z',
            'rst_expired_keep_visible'
        );

        const cookie = await registerUserAndGetCookie(baseUrl, '13800138200');
        const result = await jsonFetch(`${baseUrl}/api/account/me`, {
            headers: { cookie }
        });

        assert.equal(result.response.status, 200);
        assert.equal(result.body.orders.length, 1);
        assert.equal(result.body.orders[0].id, 'ORDER-EXPIRED-KEEP');
        assert.equal(result.body.orders[0].apiKey, 'sk-expired-keep-visible');
        assert.equal(result.body.orders[0].status, 'expired');
    });
});
```

运行：

```bash
npm test
```

Expected: FAIL，因为当前 `/api/account/me` 返回空 `apiKey`。

- [ ] **Step 4: 调整手机号校验测试**

把“手机号包含字母或位数不对时，兑换和查询接口都会拒绝”改为只覆盖兑换接口。新增一条登录后的 `/api/orders` 查询不接受越权手机号的测试：

```js
test('登录后的订单查询接口只返回当前 session 手机号的数据', async () => {
    await withServer(async ({ baseUrl }) => {
        await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-account-own', 'sk-account-other'] })
        });
        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 2 })
        });
        await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138691', code: inviteResult.body.invites[0].code })
        });
        await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138692', code: inviteResult.body.invites[1].code })
        });

        const cookie = await registerUserAndGetCookie(baseUrl, '13800138691');
        const result = await jsonFetch(`${baseUrl}/api/orders?phone=13800138692`, {
            headers: { cookie }
        });

        assert.equal(result.response.status, 200);
        assert.equal(result.body.orders.length, 1);
        assert.equal(result.body.orders[0].phone, '13800138691');
        assert.equal(result.body.orders[0].apiKey, 'sk-account-own');
    });
});
```

运行：

```bash
npm test
```

Expected: FAIL，因为当前接口会按 query phone 返回他人订单。

- [ ] **Step 5: 增加 Shop 页面登录保护测试**

新增测试：

```js
test('Shop 页面除登录和注册外未登录都会跳转登录页', async () => {
    await withServer(async ({ baseUrl }) => {
        const protectedPaths = [
            '/shop/',
            '/shop/redeem/',
            '/shop/query/',
            '/shop/guide/',
            '/shop/key/',
            '/shop/order/',
            '/shop/pay/',
            '/shop/result/',
            '/shop/content/',
            '/shop/account/',
            '/shop/admin/'
        ];

        for (const pathname of protectedPaths) {
            const response = await fetch(`${baseUrl}${pathname}`, { redirect: 'manual' });
            assert.equal(response.status, 302, pathname);
            assert.equal(response.headers.get('location'), '/shop/login/', pathname);
        }

        const login = await fetch(`${baseUrl}/shop/login/`, { redirect: 'manual' });
        assert.equal(login.status, 200);
        assert.match(await login.text(), /登录账户/);

        const register = await fetch(`${baseUrl}/shop/register/`, { redirect: 'manual' });
        assert.equal(register.status, 200);
        assert.match(await register.text(), /注册账户/);
    });
});
```

运行：

```bash
npm test
```

Expected: FAIL，因为当前 `/shop/`、`/shop/redeem/`、`/shop/query/`、`/shop/guide/` 等页面仍可未登录访问。

- [ ] **Step 6: 增加已登录访问 query 和 shop 首页的跳转测试**

新增测试：

```js
test('已登录普通用户访问 Shop 首页和查询页会进入 Account', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138693');

        const home = await fetch(`${baseUrl}/shop/`, {
            redirect: 'manual',
            headers: { cookie }
        });
        assert.equal(home.status, 302);
        assert.equal(home.headers.get('location'), '/shop/account/');

        const query = await fetch(`${baseUrl}/shop/query/`, {
            redirect: 'manual',
            headers: { cookie }
        });
        assert.equal(query.status, 302);
        assert.equal(query.headers.get('location'), '/shop/account/');
    });
});
```

运行：

```bash
npm test
```

Expected: FAIL，因为当前已登录访问这些页面不会统一跳 Account。

- [ ] **Step 7: 增加 Account 用量汇总接口测试**

新增测试：

```js
test('Account usage summary 只聚合当前登录手机号关联的 token 用量', async () => {
    await withServer(async ({ baseUrl }) => {
        await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-usage-own', 'sk-usage-other'] })
        });
        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 2 })
        });
        await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138694', code: inviteResult.body.invites[0].code })
        });
        await jsonFetch(`${baseUrl}/api/invites/redeem`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138695', code: inviteResult.body.invites[1].code })
        });

        const requestedAt = new Date().toISOString();
        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-account-own',
            api_key_hash: hashApiKeyForTest('sk-usage-own'),
            api_key_preview: 'sk-u...-own',
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 10,
            output_tokens: 20,
            reasoning_tokens: 3,
            cached_tokens: 4,
            total_tokens: 33,
            requested_at: requestedAt
        });
        await usageEventFetch(baseUrl, {
            version: 1,
            request_id: 'req-account-other',
            api_key_hash: hashApiKeyForTest('sk-usage-other'),
            api_key_preview: 'sk-u...ther',
            provider: 'codex',
            model: 'gpt-5.4',
            success: true,
            failed: false,
            input_tokens: 100,
            output_tokens: 200,
            total_tokens: 300,
            requested_at: requestedAt
        });

        const unauthorized = await jsonFetch(`${baseUrl}/api/account/usage-summary`);
        assert.equal(unauthorized.response.status, 401);
        assert.equal(unauthorized.body.code, 'ACCOUNT_LOGIN_REQUIRED');

        const cookie = await registerUserAndGetCookie(baseUrl, '13800138694');
        const result = await jsonFetch(`${baseUrl}/api/account/usage-summary`, {
            headers: { cookie }
        });

        assert.equal(result.response.status, 200);
        assert.equal(result.body.summary.month.totalTokens, 33);
        assert.equal(result.body.summary.month.inputTokens, 10);
        assert.equal(result.body.summary.month.outputTokens, 20);
        assert.equal(result.body.summary.month.reasoningTokens, 3);
        assert.equal(result.body.summary.month.cachedTokens, 4);
        assert.equal(result.body.byApiKey.length, 1);
        assert.equal(result.body.byApiKey[0].apiKeyPreview, 'sk-usage-own...ge-own');
        assert.ok(Array.isArray(result.body.hourly));
        assert.ok(Array.isArray(result.body.daily));
        assert.equal(result.body.dataFreshness.maxDelayMinutes, 60);
    }, { usageEventHmacSecret: 'usage-hmac-secret' });
});
```

运行：

```bash
npm test
```

Expected: FAIL，因为当前没有 `/api/account/usage-summary`。

- [ ] **Step 8: 更新静态 HTML 断言**

调整旧的首页和 query 页面测试：

```js
test('Shop 首页按量计费文案和按钮布局不再暴露手机号查询入口', () => {
    const home = fs.readFileSync(path.join(__dirname, '..', 'shop/index.html'), 'utf8');

    assert.match(home, /Codex[\s\S]*按量计费/);
    assert.match(home, /按实际 token 记录/);
    assert.match(home, /登录账户/);
    assert.match(home, /兑换 API key/);
    assert.match(home, /使用方法/);
    assert.doesNotMatch(home, /href="\/shop\/query\/"/);
    assert.doesNotMatch(home, /手机号查询/);
    assert.doesNotMatch(home, /每月 30 元人民币/);
    assert.doesNotMatch(home, /额度兑换/);
    assert.doesNotMatch(home, /31 天有效/);
});

test('手机号查询页只作为 Account 跳转兜底，不再渲染查询表单', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/query/index.html'), 'utf8');
    assert.match(html, /正在进入账户页/);
    assert.doesNotMatch(html, /id="queryForm"/);
    assert.doesNotMatch(html, /id="queryPhone"/);
    assert.doesNotMatch(html, /过期订单会显示为已失效/);
});
```

运行：

```bash
npm test
```

Expected: FAIL，因为当前 HTML 仍包含旧按钮和旧查询表单。

- [ ] **Step 9: 更新历史账号测试里的 API key 断言**

在 `历史兑换手机号可以补密码注册并通过 account session 只查看自己的订单` 测试中，把当前的空 key 断言：

```js
assert.equal(me.body.orders[0].apiKey, '');
assert.equal(me.body.orders[0].apiKeyPreview, 'sk-account-a...ount-a');
```

改成：

```js
assert.equal(me.body.orders[0].apiKey, 'sk-account-a');
assert.equal(me.body.orders[0].apiKeyPreview, 'sk-account-a...ount-a');
```

运行：

```bash
npm test
```

Expected: FAIL，因为当前 `/api/account/me` 仍隐藏完整 key。

- [ ] **Step 10: 更新 API no-store 和限流测试**

把 `API 响应使用 no-store 且频繁查询会触发限流` 测试改为登录后访问 `/api/orders`，保留 no-store 和 429 断言：

```js
test('API 响应使用 no-store 且频繁账户查询会触发限流', async () => {
    await withServer(async ({ baseUrl }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138696');
        const first = await jsonFetch(`${baseUrl}/api/orders?phone=13800138999`, {
            headers: { cookie }
        });
        assert.equal(first.response.status, 200);
        assert.equal(first.response.headers.get('cache-control'), 'no-store');

        let limited = null;
        for (let index = 0; index < 70; index += 1) {
            const result = await jsonFetch(`${baseUrl}/api/orders?phone=13800138999`, {
                headers: { cookie }
            });
            if (result.response.status === 429) {
                limited = result;
                break;
            }
        }

        assert.ok(limited);
        assert.equal(limited.body.code, 'QUERY_RATE_LIMITED');
    });
});
```

运行：

```bash
npm test
```

Expected: FAIL，直到 `/api/orders` 改为登录保护且仍走 `limitQueryApi`。

## Task 2: 收敛后端页面路由和 `/api/orders`

**Files:**
- Modify: `server.js`
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 让 `/api/account/me` 返回完整 API key**

修改：

```js
app.get('/api/account/me', limitQueryApi, requireAccount, (req, res) => {
    const orders = listOrdersByPhone.all(req.account.phone)
        .map(toOrder)
        .map((order) => publicOrder(order, { includeApiKey: true }));
    return res.json({
        user: publicUser(req.account.phone),
        orders
    });
});
```

运行：

```bash
npm test
```

Expected: 只有依赖完整 API key 的新测试从 FAIL 变 PASS；页面保护和 usage summary 相关测试仍 FAIL。

- [ ] **Step 2: 给 `/api/orders` 加登录保护并忽略 query phone**

修改：

```js
app.get('/api/orders', limitQueryApi, requireAccount, (req, res) => {
    const orders = listOrdersByPhone.all(req.account.phone)
        .map(toOrder)
        .map((order) => publicOrder(order, { includeApiKey: true }));

    return res.json({ orders });
});
```

原因：这个接口只为兼容旧调用保留，不再把 `phone` query 参数作为授权依据。

运行：

```bash
npm test
```

Expected: `/api/orders` 未登录拒绝和越权手机号测试通过。

- [ ] **Step 3: 增加页面路由分组 helper**

在 `requireAdminPage()` 附近增加：

```js
const shopPublicPagePaths = new Set([
    '/shop/login',
    '/shop/login/',
    '/shop/login/index.html',
    '/shop/register',
    '/shop/register/',
    '/shop/register/index.html'
]);

function isShopHtmlPagePath(requestPath) {
    if (requestPath === '/shop' || requestPath === '/shop/') return true;
    if (!requestPath.startsWith('/shop/')) return false;
    if (requestPath.endsWith('/')) return true;
    if (requestPath.endsWith('/index.html')) return true;
    return !path.posix.extname(requestPath);
}

function redirectAccountHomePage(req, res) {
    const session = getCurrentAccountSession(req);
    if (!session) {
        return res.redirect(302, '/shop/login/');
    }
    return res.redirect(302, accountDestination(session.phone));
}

function redirectQueryPage(req, res) {
    const session = getCurrentAccountSession(req);
    if (!session) {
        return res.redirect(302, '/shop/login/');
    }
    return res.redirect(302, '/shop/account/');
}

function requireShopHtmlPage(req, res, next) {
    const requestPath = path.posix.normalize(decodeURIComponent(req.path || '/'));
    if (!isShopHtmlPagePath(requestPath)) {
        return next();
    }
    if (shopPublicPagePaths.has(requestPath)) {
        return next();
    }
    return requireAccountPage(req, res, next);
}
```

运行：

```bash
npm test
```

Expected: 行为还未变化，测试仍有页面路由 FAIL。

- [ ] **Step 4: 替换 Shop 页面路由注册**

用下面的路由替换现有 `/shop/redeem`、`/shop/key`、`/shop/login`、`/shop/register`、`/shop/account`、`/shop/admin` 注册块：

```js
app.get(['/shop', '/shop/', '/shop/index.html'], redirectAccountHomePage);
app.get(['/shop/query', '/shop/query/', '/shop/query/index.html'], redirectQueryPage);

app.get(['/shop/login', '/shop/login/', '/shop/login/index.html'], (req, res, next) => next());
app.get(['/shop/register', '/shop/register/', '/shop/register/index.html'], (req, res, next) => next());

app.get(['/shop/admin', '/shop/admin/', '/shop/admin/index.html'], requireAdminPage, (req, res, next) => next());
app.get(/^\/shop(?:\/.*)?$/, requireShopHtmlPage, (req, res, next) => next());
```

注意：这个顺序必须放在 `express.static(rootDir...)` 之前。`requireShopHtmlPage()` 只拦截 HTML 页面路径，不拦截 `/shop/shop.js` 这类带文件扩展名的静态资源。

运行：

```bash
npm test
```

Expected: 页面登录保护测试和 query 跳转测试通过。旧的 key result token 页面测试会失败，因为新规则要求登录后才能访问 `/shop/key/`。

- [ ] **Step 5: 更新 key result token 测试语义**

把“API key 结果页需要有效订单 token 才能访问”改为“API key 结果页需要账户登录”，核心断言：

```js
const blocked = await fetch(`${baseUrl}/shop/key/`, { redirect: 'manual' });
assert.equal(blocked.status, 302);
assert.equal(blocked.headers.get('location'), '/shop/login/');

const cookie = await registerUserAndGetCookie(baseUrl, '13800138004');
const allowed = await fetch(`${baseUrl}/shop/key/`, {
    headers: { cookie }
});
assert.equal(allowed.status, 200);
assert.match(await allowed.text(), /API key 已生成/);
```

运行：

```bash
npm test
```

Expected: 除 usage summary 和静态 HTML 相关测试外，其余后端边界测试通过。

## Task 3: 新增个人 usage summary API

**Files:**
- Modify: `server.js`
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 增加 token 聚合空对象**

在 `emptyUsageStats()` 附近增加：

```js
function emptyAccountTokenStats() {
    return {
        inputTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
        cachedTokens: 0,
        totalTokens: 0,
        requests: 0,
        failedRequests: 0
    };
}
```

- [ ] **Step 2: 增加账号可见 key hash 收集函数**

在 `saveUsageKeyProfile()` 后增加：

```js
function accountUsageKeys(phone) {
    const keysByHash = new Map();
    for (const orderRow of listOrdersByPhone.all(phone)) {
        const order = toOrder(orderRow);
        const apiKeyHash = hashApiKey(order.apiKey);
        if (!apiKeyHash) continue;
        keysByHash.set(apiKeyHash, {
            apiKeyHash,
            apiKeyPreview: order.apiKeyPreview || keyPreview(order.apiKey),
            group: 'shop'
        });
    }
    for (const profile of listUsageKeyProfiles.all()) {
        if (profile.phone !== phone) continue;
        keysByHash.set(profile.api_key_hash, {
            apiKeyHash: profile.api_key_hash,
            apiKeyPreview: profile.api_key_preview || '',
            group: profile.group_name || 'local'
        });
    }
    return keysByHash;
}
```

运行：

```bash
npm test
```

Expected: 行为还未变化，usage summary 测试仍 FAIL。

- [ ] **Step 3: 增加中国时区桶工具**

在 `buildUsageSummary()` 前增加：

```js
function chinaParts(date) {
    const value = new Date(date);
    const shifted = new Date(value.getTime() + chinaOffsetMs);
    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate(),
        hour: shifted.getUTCHours()
    };
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

function chinaDateKey(date) {
    const parts = chinaParts(date);
    return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function chinaHourKey(date) {
    const parts = chinaParts(date);
    return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hour)}:00:00+08:00`;
}

function startOfChinaDay(date) {
    const parts = chinaParts(date);
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - chinaOffsetMs);
}

function startOfChinaMonth(date) {
    const parts = chinaParts(date);
    return new Date(Date.UTC(parts.year, parts.month - 1, 1) - chinaOffsetMs);
}

function startOfChinaWeek(date) {
    const dayStart = startOfChinaDay(date);
    const chinaDay = new Date(dayStart.getTime() + chinaOffsetMs).getUTCDay();
    const mondayOffset = chinaDay === 0 ? 6 : chinaDay - 1;
    return new Date(dayStart.getTime() - mondayOffset * 24 * 60 * 60 * 1000);
}
```

运行：

```bash
npm test
```

Expected: 行为还未变化，usage summary 测试仍 FAIL。

- [ ] **Step 4: 增加聚合函数**

在 `buildUsageSummary()` 前增加：

```js
function addAccountTokenStats(stats, row) {
    stats.inputTokens += nonNegativeInteger(row.input_tokens);
    stats.outputTokens += nonNegativeInteger(row.output_tokens);
    stats.reasoningTokens += nonNegativeInteger(row.reasoning_tokens);
    stats.cachedTokens += nonNegativeInteger(row.cached_tokens);
    stats.totalTokens += nonNegativeInteger(row.total_tokens);
    stats.requests += 1;
    if (row.failed) {
        stats.failedRequests += 1;
    }
}

function accountUsageSummary(phone) {
    const now = new Date();
    const todayStart = startOfChinaDay(now);
    const weekStart = startOfChinaWeek(now);
    const monthStart = startOfChinaMonth(now);
    const visibleKeys = accountUsageKeys(phone);
    const visibleHashes = new Set(visibleKeys.keys());
    const summary = {
        today: emptyAccountTokenStats(),
        week: emptyAccountTokenStats(),
        month: emptyAccountTokenStats()
    };
    const hourlyByBucket = new Map();
    const dailyByBucket = new Map();
    const byModel = new Map();
    const byApiKey = new Map();
    let lastEventAt = '';

    for (const row of listUsageEvents.all()) {
        if (!visibleHashes.has(row.api_key_hash)) continue;
        const requestedAt = new Date(row.requested_at);
        if (!Number.isFinite(requestedAt.getTime())) continue;
        if (!lastEventAt || new Date(lastEventAt) < requestedAt) {
            lastEventAt = row.requested_at;
        }
        if (requestedAt >= todayStart) addAccountTokenStats(summary.today, row);
        if (requestedAt >= weekStart) addAccountTokenStats(summary.week, row);
        if (requestedAt >= monthStart) addAccountTokenStats(summary.month, row);

        const hourKey = chinaHourKey(requestedAt);
        if (!hourlyByBucket.has(hourKey)) hourlyByBucket.set(hourKey, { bucket: hourKey, ...emptyAccountTokenStats() });
        addAccountTokenStats(hourlyByBucket.get(hourKey), row);

        const dayKey = chinaDateKey(requestedAt);
        if (!dailyByBucket.has(dayKey)) dailyByBucket.set(dayKey, { bucket: dayKey, ...emptyAccountTokenStats() });
        addAccountTokenStats(dailyByBucket.get(dayKey), row);

        const modelName = row.model || 'unknown';
        if (!byModel.has(modelName)) byModel.set(modelName, { model: modelName, totalTokens: 0, requests: 0 });
        byModel.get(modelName).totalTokens += nonNegativeInteger(row.total_tokens);
        byModel.get(modelName).requests += 1;

        const keyMeta = visibleKeys.get(row.api_key_hash) || {};
        const keyLabel = keyMeta.apiKeyPreview || row.api_key_preview || row.api_key_hash;
        if (!byApiKey.has(row.api_key_hash)) {
            byApiKey.set(row.api_key_hash, {
                apiKeyPreview: keyLabel,
                group: keyMeta.group || 'shop',
                totalTokens: 0,
                requests: 0
            });
        }
        byApiKey.get(row.api_key_hash).totalTokens += nonNegativeInteger(row.total_tokens);
        byApiKey.get(row.api_key_hash).requests += 1;
    }

    return {
        generatedAt: nowIso(now),
        dataFreshness: {
            mode: 'delayed',
            maxDelayMinutes: 60,
            lastEventAt
        },
        summary,
        hourly: Array.from(hourlyByBucket.values()).sort((left, right) => left.bucket.localeCompare(right.bucket)).slice(-24),
        daily: Array.from(dailyByBucket.values()).sort((left, right) => left.bucket.localeCompare(right.bucket)),
        byModel: Array.from(byModel.values()).sort((left, right) => right.totalTokens - left.totalTokens),
        byApiKey: Array.from(byApiKey.values()).sort((left, right) => right.totalTokens - left.totalTokens)
    };
}
```

运行：

```bash
npm test
```

Expected: 行为还未变化，usage summary 路由仍 FAIL。

- [ ] **Step 5: 注册账号用量 API**

在 `/api/account/me` 后增加：

```js
app.get('/api/account/usage-summary', limitQueryApi, requireAccount, (req, res) => {
    return res.json(accountUsageSummary(req.account.phone));
});
```

运行：

```bash
npm test
```

Expected: Account usage summary 测试通过。

## Task 4: 修改首页和 query 页面静态内容

**Files:**
- Modify: `shop/index.html`
- Modify: `shop/query/index.html`
- Modify: `test/shop-flow.test.js`

- [ ] **Step 1: 删除首页“手机号查询”按钮，改成三按钮响应式布局**

把首页按钮区改为：

```html
<div class="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-[640px]">
    <a class="btn-primary h-14 px-4 text-center justify-center whitespace-nowrap" href="/shop/login/">登录账户</a>
    <a class="btn-secondary h-14 px-4 text-center justify-center whitespace-nowrap dark:bg-dark-card dark:border-dark-border dark:text-dark-text" href="/shop/redeem/">兑换 API key</a>
    <a class="btn-secondary h-14 px-4 text-center justify-center whitespace-nowrap border-gray-200 bg-gray-100 text-primary hover:bg-gray-200 dark:border-dark-border dark:bg-dark-card dark:text-dark-text dark:hover:bg-dark-border" href="/shop/guide/">使用方法</a>
</div>
```

运行：

```bash
npm test
```

Expected: 首页静态断言通过。

- [ ] **Step 2: query 页面改成跳转兜底页**

把 `shop/query/index.html` 的 main 内容改为：

```html
<main class="flex-1 max-w-[760px] mx-auto px-6 md:px-12 py-14 md:py-20 w-full">
    <section class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-8">
        <p class="text-xs uppercase tracking-[0.28em] text-text-muted dark:text-dark-text-muted">Account</p>
        <h1 class="mt-4 font-display text-4xl md:text-5xl">正在进入账户页</h1>
        <p class="mt-5 text-text-muted dark:text-dark-text-muted leading-relaxed">手机号查询已经合并到账户页。登录后可以在账户页查看自己的订单、API key 和 token 用量。</p>
        <a class="btn-primary mt-6 inline-flex" href="/shop/account/">进入我的账户</a>
    </section>
</main>
<script>window.YuiShop.initQueryPage();</script>
```

运行：

```bash
npm test
```

Expected: query 页面静态断言通过。

- [ ] **Step 3: 修改 `initQueryPage()` 为兜底跳转**

替换 `shop/shop.js` 里的 `initQueryPage()`：

```js
function initQueryPage() {
    window.location.replace('/shop/account/');
}
```

运行：

```bash
npm test
```

Expected: 旧脚本里不再调用 `/api/orders?phone=`；如果存在相关静态断言，按新行为调整为 `doesNotMatch(script, /api\/orders\?phone/)`。

## Task 5: Account 页展示完整 API key 和基础用量图表

**Files:**
- Modify: `shop/account/index.html`
- Modify: `shop/shop.js`
- Modify: `styles/site.css` via build
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 扩展 Account HTML 容器**

把 `accountOrders` 前后结构改成：

```html
<section class="mb-10">
    <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
            <p class="text-xs uppercase tracking-[0.24em] text-text-muted dark:text-dark-text-muted">Keys</p>
            <h2 class="mt-2 font-display text-3xl text-primary dark:text-dark-text">我的 API key</h2>
        </div>
        <a class="btn-secondary dark:bg-dark-card dark:border-dark-border dark:text-dark-text" href="/shop/redeem/">兑换新的 API key</a>
    </div>
    <div id="accountOrders" class="mt-5"></div>
</section>

<section id="accountUsageSection" class="mt-12">
    <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
            <p class="text-xs uppercase tracking-[0.24em] text-text-muted dark:text-dark-text-muted">Usage</p>
            <h2 class="mt-2 font-display text-3xl text-primary dark:text-dark-text">Token 用量</h2>
        </div>
        <p id="usageFreshness" class="text-sm text-text-muted dark:text-dark-text-muted">用量统计可能最多延迟 1 小时。</p>
    </div>
    <div id="accountUsageCards" class="mt-6 grid gap-3 md:grid-cols-4"></div>
    <div id="accountTokenBreakdown" class="mt-6 grid gap-3 md:grid-cols-4"></div>
    <div class="mt-6 grid gap-5 lg:grid-cols-2">
        <section class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-5">
            <h3 class="font-display text-2xl text-primary dark:text-dark-text">最近 24 小时</h3>
            <div id="accountHourlyChart" class="mt-5"></div>
        </section>
        <section class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-5">
            <h3 class="font-display text-2xl text-primary dark:text-dark-text">本月每日</h3>
            <div id="accountDailyChart" class="mt-5"></div>
        </section>
    </div>
    <p id="accountUsageMessage" class="mt-4 min-h-5 text-sm text-text-muted dark:text-dark-text-muted"></p>
</section>
```

运行：

```bash
npm test
```

Expected: 如果新增静态断言，Account HTML 容器断言通过。

- [ ] **Step 2: Account 订单卡展示完整 API key**

在 `initAccountPage()` 中把订单渲染改为：

```js
ordersRoot.innerHTML = `<div class="grid gap-5">${orders.map((order) => renderOrderCard(order, { showFullKey: true })).join('')}</div>`;
ordersRoot.querySelectorAll('article').forEach(bindCopy);
```

运行：

```bash
npm test
```

Expected: Account 完整 API key 行为与后端测试保持一致。

- [ ] **Step 3: 增加前端 token 格式化和卡片渲染函数**

在 `formatNumber()` 后增加：

```js
function formatCompactNumber(value) {
    const number = Number(value || 0);
    if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
    if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
    return number.toLocaleString('zh-CN');
}

function renderAccountUsageCards(summary) {
    const month = summary.month || {};
    const week = summary.week || {};
    const today = summary.today || {};
    const cards = [
        ['今日 token', today.totalTokens],
        ['本周 token', week.totalTokens],
        ['本月 token', month.totalTokens],
        ['失败请求', month.failedRequests]
    ];
    return cards.map(([label, value]) => `
        <article class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">${escapeHtml(label)}</p>
            <p class="mt-2 text-2xl font-display text-primary dark:text-dark-text">${escapeHtml(formatNumber(value))}</p>
        </article>
    `).join('');
}
```

运行：

```bash
npm test
```

Expected: JS 语法不报错；用量页面仍未渲染完成。

- [ ] **Step 4: 增加 token 拆分和柱状图渲染函数**

在上一步函数后增加：

```js
function renderTokenBreakdown(month = {}) {
    const items = [
        ['Input', month.inputTokens],
        ['Output', month.outputTokens],
        ['Reasoning', month.reasoningTokens],
        ['Cached', month.cachedTokens]
    ];
    return items.map(([label, value]) => `
        <article class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">${escapeHtml(label)}</p>
            <p class="mt-2 text-xl font-display text-primary dark:text-dark-text">${escapeHtml(formatNumber(value))}</p>
        </article>
    `).join('');
}

function renderBars(items, labelFormatter = (item) => item.bucket) {
    if (!items.length) {
        return '<p class="text-sm text-text-muted dark:text-dark-text-muted">暂无用量记录，用量统计可能最多延迟 1 小时。</p>';
    }
    const maxValue = Math.max(...items.map((item) => Number(item.totalTokens || 0)), 1);
    return `
        <div class="flex h-48 items-end gap-2">
            ${items.map((item) => {
                const height = Math.max(4, Math.round((Number(item.totalTokens || 0) / maxValue) * 100));
                return `
                    <div class="flex min-w-0 flex-1 flex-col items-center gap-2">
                        <div class="w-full rounded-t bg-primary dark:bg-dark-text" style="height:${height}%"></div>
                        <span class="max-w-full truncate text-[10px] text-text-muted dark:text-dark-text-muted">${escapeHtml(labelFormatter(item))}</span>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}
```

运行：

```bash
npm test
```

Expected: JS 语法不报错。

- [ ] **Step 5: 在 `initAccountPage()` 拉取并渲染 usage summary**

在 `initAccountPage()` 中获取这些 DOM：

```js
const usageCards = document.getElementById('accountUsageCards');
const tokenBreakdown = document.getElementById('accountTokenBreakdown');
const hourlyChart = document.getElementById('accountHourlyChart');
const dailyChart = document.getElementById('accountDailyChart');
const usageFreshness = document.getElementById('usageFreshness');
const usageMessage = document.getElementById('accountUsageMessage');
```

在账户信息加载成功后增加：

```js
try {
    const usage = await requestJson('/api/account/usage-summary');
    if (usageCards) usageCards.innerHTML = renderAccountUsageCards(usage.summary || {});
    if (tokenBreakdown) tokenBreakdown.innerHTML = renderTokenBreakdown(usage.summary?.month || {});
    if (hourlyChart) hourlyChart.innerHTML = renderBars(usage.hourly || [], (item) => String(item.bucket || '').slice(11, 16));
    if (dailyChart) dailyChart.innerHTML = renderBars(usage.daily || [], (item) => String(item.bucket || '').slice(5));
    if (usageFreshness) {
        usageFreshness.textContent = `生成时间 ${formatDate(usage.generatedAt)}，用量统计可能最多延迟 1 小时。`;
    }
    if (usageMessage) usageMessage.textContent = '';
} catch (error) {
    if (usageMessage) usageMessage.textContent = error.message;
}
```

运行：

```bash
npm test
```

Expected: 单元测试通过，前端无语法错误。

## Task 6: 清理旧 query 入口链接和验证构建产物

**Files:**
- Modify: `shop/content/index.html`
- Modify: `shop/result/index.html`
- Modify: `test/shop-flow.test.js`
- Modify: `styles/site.css` via build

- [ ] **Step 1: 扫描 `/shop/query/` 链接**

运行：

```bash
rg -n 'href="/shop/query/|api/orders\\?phone|queryForm|queryPhone|手机号查询' shop test server.js
```

Expected: 只允许 `server.js` 中的 query 跳转路由、`shop/shop.js` 的 `initQueryPage` 函数名、测试名称或断言中出现；页面正文不再出现公开查询入口。

- [ ] **Step 2: 替换内容页和结果页里的 query 链接**

如果 `shop/content/index.html` 或 `shop/result/index.html` 仍有 `/shop/query/`，改为 `/shop/account/`，按钮文案改为 `我的账户` 或 `查看账户`。例：

```html
<a class="btn-secondary dark:bg-dark-card dark:border-dark-border dark:text-dark-text" href="/shop/account/">我的账户</a>
```

运行：

```bash
rg -n 'href="/shop/query/|手机号查询' shop
```

Expected: `shop/index.html`、`shop/content/index.html`、`shop/result/index.html` 不再出现 query 入口。

- [ ] **Step 3: 重新生成 Tailwind CSS**

运行：

```bash
npm run build:css
```

Expected: exit code 0。允许出现 caniuse-lite 过期提示，但不能有构建失败。

- [ ] **Step 4: 运行完整测试**

运行：

```bash
npm test
```

Expected: 全部测试通过。

- [ ] **Step 5: 检查空白和冲突标记**

运行：

```bash
git diff --check
rg -n '<<<<<<<|=======|>>>>>>>' .
```

Expected: `git diff --check` exit code 0；`rg` 没有输出冲突标记。

- [ ] **Step 6: 人工浏览器验证**

启动服务：

```bash
npm start
```

在浏览器验证：

- 未登录访问 `http://localhost:4173/shop/` 跳 `/shop/login/`。
- 未登录访问 `http://localhost:4173/shop/query/` 跳 `/shop/login/`。
- 未登录访问 `http://localhost:4173/shop/register/` 能看到注册页。
- 登录普通用户后访问 `/shop/query/` 跳 `/shop/account/`。
- Account 页显示完整 API key、复制按钮、今日/本周/本月 token、最近 24 小时图和本月每日图。
- 无用量数据时页面显示“暂无用量记录，用量统计可能最多延迟 1 小时。”。

## 完整版本实施方向

MVP 完成后，按下面顺序继续演进，不改变已经收敛好的授权边界。

### Phase A: 图表交互增强

- 文件：`shop/account/index.html`、`shop/shop.js`、`test/shop-flow.test.js`
- 新增日期范围控件：最近 24 小时、最近 7 天、本月、自定义。
- 新增模型筛选和 API key 筛选。
- `GET /api/account/usage-summary` 接受 `range=day|week|month|custom`、`from=YYYY-MM-DD`、`to=YYYY-MM-DD`、`bucket=hour|day|week`、`model=<name>`、`apiKeyHash=<hash>`。
- 图表仍限制为当前登录手机号自己的 key。

### Phase B: 聚合缓存

- 文件：`server.js`，如果文件变得过大，则拆出 `shop/usage-summary.js` 并由 `server.js` 引入。
- 新增 SQLite 表：

```sql
CREATE TABLE IF NOT EXISTS usage_hourly_rollups (
  api_key_hash TEXT NOT NULL,
  bucket_hour TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  requests INTEGER NOT NULL DEFAULT 0,
  failed_requests INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (api_key_hash, bucket_hour)
);

CREATE TABLE IF NOT EXISTS usage_daily_rollups (
  api_key_hash TEXT NOT NULL,
  bucket_day TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  requests INTEGER NOT NULL DEFAULT 0,
  failed_requests INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (api_key_hash, bucket_day)
);
```

- 每次导入 usage JSONL 或接收内部 usage event 后增量更新 rollup。
- Account 页读取 rollup 表，近 1 小时显示“统计中”。

### Phase C: 费用估算

- 文件：`server.js`、`shop/account/index.html`、`shop/shop.js`、`test/shop-flow.test.js`
- 新增模型价格配置，字段包括 `model`、`inputPriceMicros`、`outputPriceMicros`、`reasoningPriceMicros`、`cachedPriceMicros`、`currency`。
- Account 页展示当日、本周、本月估算费用。
- 费用只作为估算展示；实际结算仍以管理员确认账单为准。

### Phase D: 管理员和普通用户图表统一

- 文件：`shop/shop.js`，必要时拆成 `shop/usage-ui.js`。
- 抽出通用图表渲染函数：

```js
function renderUsageDashboard(root, data, options = {}) {
    const mode = options.mode || 'account';
    root.innerHTML = `
        <div>${renderAccountUsageCards(data.summary || {})}</div>
        <div>${renderTokenBreakdown(data.summary?.month || {})}</div>
        <div>${renderBars(data.hourly || [], (item) => String(item.bucket || '').slice(11, 16))}</div>
    `;
    return mode;
}
```

- 普通用户只显示自己的 key；管理员继续显示全局 key 和未托管 key。

## 自查

- 覆盖公开查询删除：Task 1、Task 2、Task 4、Task 6。
- 覆盖所有 Shop 页面未登录跳登录：Task 1、Task 2。
- 覆盖注册页允许未登录访问：Task 1、Task 2。
- 覆盖 Account 合并订单/API key 查询：Task 1、Task 2、Task 5。
- 覆盖 token 用量概览、今日/本周/本月、小时桶、日桶：Task 1、Task 3、Task 5。
- 覆盖 1 小时延迟说明：Task 3、Task 5。
- 覆盖完整图表方向：Phase A、Phase B、Phase C、Phase D。
- 文档没有未定项；每个实现任务都给出目标文件、代码形状、验证命令和预期结果。
