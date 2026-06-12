# Admin 用户余额面板 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `/shop/admin/` 的「业务办理」section 中新增只读用户余额面板，让管理员看到所有 Shop 用户余额、欠费和待确认充值状态。

**Architecture:** 后端新增一个管理员只读接口 `GET /api/admin/account-balances`，从 `users` / `account_balances` / `topup_requests` / `orders` / `api_keys` 聚合账户余额视图。前端在「充值审核」下方插入余额面板，复用业务办理统一刷新，并在充值审核确认或拒绝后同步刷新余额。用量监控不承载余额，继续只负责 usage、收银和扣费分析。

**Tech Stack:** Node.js `node:test`、Express 5、better-sqlite3、原生 HTML、`shop/shop.js`、Tailwind 构建后的 `styles/site.css`。

---

## 文件结构

- Modify: `server.js`
  - 新增余额聚合查询。
  - 新增 `buildAdminAccountBalances`、`publicAdminAccountBalance`、`adminAccountBalanceSummary`。
  - 新增 `GET /api/admin/account-balances`。
- Modify: `shop/admin/index.html`
  - 在 `adminBusinessSection` 的充值审核下方、邀请码记录上方插入 `adminAccountBalancesPanel`。
- Modify: `shop/shop.js`
  - 新增余额汇总卡片和表格渲染函数。
  - 新增 `initAdminAccountBalancesPage`。
  - 让 `adminBusinessRefreshButton` 和充值审核变更刷新余额面板。
- Modify: `test/shop-flow.test.js`
  - 增加管理员余额接口测试。
  - 增加 Admin 页面结构和前端脚本静态测试。
- Create: `docs/ai/context/YYYYMMDD-HHMMSS-admin-account-balance-panel-implementation_CN.md`
  - 记录实施内容、验证结果和口径。
- Modify: `AGENTS.md`
  - 追加实施记忆。

## Task 1: 后端接口失败测试

**Files:**
- Modify: `test/shop-flow.test.js`

- [ ] **Step 1: 添加管理员余额接口测试**

在 `test/shop-flow.test.js` 中靠近充值 / 余额相关测试的位置增加：

```js
test('管理员余额接口展示所有 Shop 用户余额并过滤管理员账号', async () => {
    await withServer(async ({ baseUrl, db }) => {
        seedAdminUserForTest(db);

        await createRedeemedOrder(baseUrl, '13800138821', 'sk-admin-balance-owned');
        const userCookie = await registerUserAndGetCookie(baseUrl, '13800138821');
        await submitAndApproveTopup(baseUrl, userCookie, '3');

        const debtCookie = await registerUserAndGetCookie(baseUrl, '13800138822');
        const pendingTopup = await jsonFetch(`${baseUrl}/api/account/topups`, {
            method: 'POST',
            headers: { cookie: debtCookie },
            body: JSON.stringify({ amount: '2', paymentMethod: 'wechat' })
        });
        assert.equal(pendingTopup.response.status, 201);
        db.prepare(`
UPDATE account_balances
SET balance_cents = ?, balance_nanos = ?, updated_at = ?
WHERE phone = ?
`).run(-15, -150000000, '2026-06-12T12:00:00+08:00', '13800138822');

        db.prepare(`
INSERT INTO usage_key_profiles (api_key_hash, api_key_preview, group_name, phone, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?)
`).run(
            hashApiKeyForTest('sk-local-not-shop'),
            keyPreviewForTest('sk-local-not-shop'),
            'local',
            '13900000001',
            '2026-06-12T12:00:00+08:00',
            '2026-06-12T12:00:00+08:00'
        );

        const adminLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '15951875192', password: 'Abcdefg1' })
        });
        assert.equal(adminLogin.response.status, 200);
        const adminCookie = cookieHeaderFromSetCookie(adminLogin.response.headers.get('set-cookie') || '');

        const result = await jsonFetch(`${baseUrl}/api/admin/account-balances`, {
            headers: { cookie: adminCookie }
        });
        assert.equal(result.response.status, 200);
        assert.equal(result.body.summary.userCount, 2);
        assert.equal(result.body.summary.totalBalanceNanos, 2850000000);
        assert.equal(result.body.summary.totalBalanceAmount, 2.85);
        assert.equal(result.body.summary.debtUserCount, 1);
        assert.equal(result.body.summary.debtNanos, 150000000);
        assert.equal(result.body.summary.pendingTopupNanos, 2000000000);
        assert.deepEqual(result.body.items.map((item) => item.phone), ['13800138822', '13800138821']);

        const debtItem = result.body.items.find((item) => item.phone === '13800138822');
        assert.equal(debtItem.status, 'debt');
        assert.equal(debtItem.balanceNanos, -150000000);
        assert.equal(debtItem.debtNanos, 150000000);
        assert.equal(debtItem.pendingTopupNanos, 2000000000);
        assert.equal(debtItem.managedApiKeyCount, 0);

        const activeItem = result.body.items.find((item) => item.phone === '13800138821');
        assert.equal(activeItem.status, 'available');
        assert.equal(activeItem.balanceNanos, 3000000000);
        assert.equal(activeItem.managedApiKeyCount, 1);
        assert.equal(activeItem.usedApiKeyCount, 1);
        assert.equal(activeItem.unusedApiKeyCount, 0);
        assert.equal(activeItem.disabledApiKeyCount, 0);
        assert.ok(!result.body.items.some((item) => item.phone === '15951875192'));
        assert.ok(!result.body.items.some((item) => item.phone === '13900000001'));

        const filtered = await jsonFetch(`${baseUrl}/api/admin/account-balances?status=debt&q=822`, {
            headers: { cookie: adminCookie }
        });
        assert.equal(filtered.response.status, 200);
        assert.deepEqual(filtered.body.items.map((item) => item.phone), ['13800138822']);
        assert.equal(filtered.body.summary.userCount, 2);
    });
});
```

- [ ] **Step 2: 添加权限测试**

继续在 `test/shop-flow.test.js` 增加：

```js
test('管理员余额接口要求管理员登录或管理员 token', async () => {
    await withServer(async ({ baseUrl, db }) => {
        seedAdminUserForTest(db);
        const userCookie = await registerUserAndGetCookie(baseUrl, '13800138823');

        const missingAuth = await jsonFetch(`${baseUrl}/api/admin/account-balances`);
        assert.equal(missingAuth.response.status, 401);
        assert.equal(missingAuth.body.code, 'UNAUTHORIZED');

        const normalUser = await jsonFetch(`${baseUrl}/api/admin/account-balances`, {
            headers: { cookie: userCookie }
        });
        assert.equal(normalUser.response.status, 403);
        assert.equal(normalUser.body.code, 'ADMIN_ACCOUNT_REQUIRED');

        const tokenResult = await jsonFetch(`${baseUrl}/api/admin/account-balances`, {
            headers: { 'x-admin-token': 'test-token' }
        });
        assert.equal(tokenResult.response.status, 200);
        assert.deepEqual(tokenResult.body.items.map((item) => item.phone), ['13800138823']);
    });
});
```

- [ ] **Step 3: 运行失败测试**

Run:

```bash
node --test test/shop-flow.test.js
```

Expected: FAIL，错误集中在 `GET /api/admin/account-balances` 返回 404 或缺少字段。

## Task 2: 后端接口实现

**Files:**
- Modify: `server.js`
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 新增管理员余额查询**

在 `server.js` 的 `getAccountBalanceRow` 后方加入：

```js
    const listUsersForAdminBalances = db.prepare(`
SELECT phone
FROM users
WHERE phone != ?
ORDER BY created_at DESC, phone ASC
`);

    const listAccountBalancesForAdmin = db.prepare(`
SELECT
  ab.phone,
  ab.balance_cents,
  ab.balance_nanos,
  ab.pending_topup_cents,
  ab.pending_topup_nanos,
  ab.credit_limit_cents,
  ab.credit_limit_nanos,
  ab.updated_at,
  (
    SELECT COUNT(*)
    FROM orders o
    WHERE o.phone = ab.phone
  ) AS managed_order_count,
  (
    SELECT COUNT(*)
    FROM api_keys ak
    JOIN orders o ON o.id = ak.order_id OR o.api_key = ak.api_key
    WHERE o.phone = ab.phone
  ) AS managed_api_key_count,
  (
    SELECT COUNT(*)
    FROM api_keys ak
    JOIN orders o ON o.id = ak.order_id OR o.api_key = ak.api_key
    WHERE o.phone = ab.phone AND ak.status = 'used'
  ) AS used_api_key_count,
  (
    SELECT COUNT(*)
    FROM api_keys ak
    JOIN orders o ON o.id = ak.order_id OR o.api_key = ak.api_key
    WHERE o.phone = ab.phone AND ak.status = 'unused'
  ) AS unused_api_key_count,
  (
    SELECT COUNT(*)
    FROM api_keys ak
    JOIN orders o ON o.id = ak.order_id OR o.api_key = ak.api_key
    WHERE o.phone = ab.phone AND ak.status = 'disabled'
  ) AS disabled_api_key_count
FROM account_balances ab
JOIN users u ON u.phone = ab.phone
WHERE ab.phone != ?
ORDER BY
  CASE
    WHEN ab.balance_nanos < 0 THEN 0
    WHEN ab.balance_nanos = 0 THEN 1
    ELSE 2
  END,
  ab.updated_at DESC,
  ab.phone ASC
`);
```

- [ ] **Step 2: 新增公开转换和汇总函数**

在 `publicAccountBalance` 后方加入：

```js
    function publicAdminAccountBalance(row) {
        const balance = publicAccountBalance(row);
        return {
            ...balance,
            managedOrderCount: Number(row.managed_order_count || 0),
            managedApiKeyCount: Number(row.managed_api_key_count || 0),
            usedApiKeyCount: Number(row.used_api_key_count || 0),
            unusedApiKeyCount: Number(row.unused_api_key_count || 0),
            disabledApiKeyCount: Number(row.disabled_api_key_count || 0)
        };
    }

    function adminAccountBalanceSummary(items) {
        const totalBalanceNanos = items.reduce((sum, item) => sum + Number(item.balanceNanos || 0), 0);
        const debtNanos = items.reduce((sum, item) => sum + Number(item.debtNanos || 0), 0);
        const pendingTopupNanos = items.reduce((sum, item) => sum + Number(item.pendingTopupNanos || 0), 0);
        return {
            userCount: items.length,
            totalBalanceCents: nanosToBalanceCents(totalBalanceNanos),
            totalBalanceNanos,
            totalBalanceAmount: nanosToCny(totalBalanceNanos),
            debtUserCount: items.filter((item) => item.status === 'debt').length,
            debtCents: chargeNanosToCents(debtNanos),
            debtNanos,
            debtAmount: nanosToCny(debtNanos),
            pendingTopupCents: nanosToBalanceCents(pendingTopupNanos),
            pendingTopupNanos,
            pendingTopupAmount: nanosToCny(pendingTopupNanos)
        };
    }
```

- [ ] **Step 3: 新增余额列表构建函数**

在 `buildUsageSummary` 前方加入：

```js
    function buildAdminAccountBalances(filters = {}) {
        for (const user of listUsersForAdminBalances.all(adminAccountPhone)) {
            ensureAccountBalance(user.phone);
        }

        const allItems = listAccountBalancesForAdmin.all(adminAccountPhone).map(publicAdminAccountBalance);
        const q = String(filters.q || '').trim().toLowerCase();
        const status = String(filters.status || 'all').trim();
        const normalizedStatus = ['all', 'available', 'debt', 'empty'].includes(status) ? status : 'all';
        const limit = Math.min(Math.max(Number(filters.limit || 100), 1), 500);
        const filteredItems = allItems
            .filter((item) => normalizedStatus === 'all' || item.status === normalizedStatus)
            .filter((item) => {
                if (!q) return true;
                return [item.phone, item.status].some((value) => String(value || '').toLowerCase().includes(q));
            })
            .slice(0, limit);

        return {
            summary: adminAccountBalanceSummary(allItems),
            items: filteredItems
        };
    }
```

- [ ] **Step 4: 新增路由**

在 `app.get('/api/admin/invite-console'...)` 和 `app.post('/api/admin/session-invites'...)` 附近加入：

```js
    app.get('/api/admin/account-balances', limitAdminApi, requireAdminUsageAccess, (req, res) => {
        return res.json(buildAdminAccountBalances(req.query));
    });
```

- [ ] **Step 5: 运行后端测试**

Run:

```bash
node --test test/shop-flow.test.js
```

Expected: PASS，至少 Task 1 新增的两个测试通过；如果其它既有测试失败，先确认是否来自进入本次前已有的 `test/shop-flow.test.js` 工作树改动。

- [ ] **Step 6: 提交后端接口**

Run:

```bash
git add server.js test/shop-flow.test.js
git commit -m "feat: add admin account balance endpoint"
```

## Task 3: Admin 页面结构失败测试

**Files:**
- Modify: `test/shop-flow.test.js`

- [ ] **Step 1: 更新业务办理栏目测试**

在 `Admin 页面把业务办理合并成一个栏目` 测试中加入：

```js
    assert.match(html, /id="adminAccountBalancesPanel"/);
    assert.match(html, /id="adminBalanceSearchInput"/);
    assert.match(html, /id="adminBalanceStatusFilter"/);
    assert.match(html, /id="adminBalanceSummary"/);
    assert.match(html, /id="adminBalanceTable"/);
    assert.match(html, /id="adminBalanceMessage"/);

    const topupIndex = html.indexOf('id="adminTopupTable"');
    const balanceIndex = html.indexOf('id="adminAccountBalancesPanel"');
    const inviteIndex = html.indexOf('id="adminInviteTable"');
    assert.ok(topupIndex > -1 && balanceIndex > -1 && inviteIndex > -1);
    assert.ok(topupIndex < balanceIndex);
    assert.ok(balanceIndex < inviteIndex);
```

- [ ] **Step 2: 更新 usage 控件测试，确保余额不进用量监控**

在 `后台页面包含 usage 监控和 JSONL 导入控件` 测试中加入：

```js
    const usageSection = html.match(/<section id="adminUsageSection"[\s\S]*?<section id="adminUsageImportSection"/)?.[0] || '';
    assert.doesNotMatch(usageSection, /adminAccountBalancesPanel/);
    assert.doesNotMatch(usageSection, /用户余额/);
```

继续保持：

```js
    assert.equal((html.match(/data-collapsible-section/g) || []).length, 3);
    assert.equal((html.match(/data-collapsible-toggle/g) || []).length, 3);
    assert.equal((html.match(/data-collapsible-content/g) || []).length, 3);
```

- [ ] **Step 3: 运行失败测试**

Run:

```bash
node --test test/shop-flow.test.js
```

Expected: FAIL，错误集中在 Admin HTML 缺少 `adminAccountBalancesPanel` 等 DOM id。

## Task 4: Admin 页面结构实现

**Files:**
- Modify: `shop/admin/index.html`
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 插入余额面板 HTML**

在 `shop/admin/index.html` 的充值审核块结束后、邀请码记录 grid 前插入：

```html
                <div id="adminAccountBalancesPanel" class="mt-8">
                    <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <h3 class="font-display text-2xl text-primary dark:text-dark-text">用户余额</h3>
                            <p class="mt-2 text-sm text-text-muted dark:text-dark-text-muted">只读查看所有 Shop 用户余额、欠费和待确认充值。</p>
                        </div>
                        <div class="grid gap-3 sm:grid-cols-[minmax(0,16rem)_10rem]">
                            <input id="adminBalanceSearchInput" class="h-11 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary" type="search" placeholder="搜索手机号"/>
                            <select id="adminBalanceStatusFilter" class="h-11 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary">
                                <option value="all">全部余额</option>
                                <option value="available">有余额</option>
                                <option value="debt">欠费</option>
                                <option value="empty">余额为 0</option>
                            </select>
                        </div>
                    </div>
                    <div id="adminBalanceSummary" class="mt-4 grid gap-3 md:grid-cols-4"></div>
                    <div id="adminBalanceTable" class="mt-4 w-full min-w-0 overflow-x-auto rounded-lg border border-border-subtle dark:border-dark-border"></div>
                    <p id="adminBalanceMessage" class="mt-3 text-sm text-text-muted dark:text-dark-text-muted"></p>
                </div>
```

- [ ] **Step 2: 运行结构测试**

Run:

```bash
node --test test/shop-flow.test.js
```

Expected: Task 3 的 HTML 结构断言通过；后续脚本断言仍未覆盖。

- [ ] **Step 3: 提交页面结构**

Run:

```bash
git add shop/admin/index.html test/shop-flow.test.js
git commit -m "feat: place admin balance panel in business section"
```

## Task 5: 前端脚本失败测试

**Files:**
- Modify: `test/shop-flow.test.js`

- [ ] **Step 1: 更新 Admin 前端静态测试**

在 `Admin 前端兑换码管理不使用 x-admin-token` 或相邻 Admin 前端测试中加入：

```js
    assert.match(script, /function renderAdminBalanceSummary/);
    assert.match(script, /function renderAdminBalanceTable/);
    assert.match(script, /function initAdminAccountBalancesPage/);
    assert.match(script, /api\/admin\/account-balances/);
    assert.match(script, /refreshAdminBalances/);
    assert.match(script, /onBalanceChanged/);
    assert.match(script, /用户余额/);
    assert.match(script, /欠费用户/);
    assert.match(script, /待确认充值/);
```

保留现有断言：

```js
    assert.doesNotMatch(script, /x-admin-token/);
```

- [ ] **Step 2: 运行失败测试**

Run:

```bash
node --test test/shop-flow.test.js
```

Expected: FAIL，错误集中在 `shop/shop.js` 缺少余额渲染和初始化函数。

## Task 6: 前端脚本实现

**Files:**
- Modify: `shop/shop.js`
- Test: `test/shop-flow.test.js`

- [ ] **Step 1: 新增余额汇总渲染函数**

在 `renderBalanceCards` 后方加入：

```js
    function renderAdminBalanceSummary(summary = {}) {
        const cards = [
            ['用户数', formatNumber(summary.userCount || 0), 'Shop 账号'],
            ['总余额', summary.totalBalanceNanos === undefined ? formatCents(summary.totalBalanceCents) : formatNanos(summary.totalBalanceNanos), '账户当前余额合计'],
            ['欠费用户', formatNumber(summary.debtUserCount || 0), summary.debtNanos === undefined ? formatCents(summary.debtCents) : formatNanos(summary.debtNanos)],
            ['待确认充值', summary.pendingTopupNanos === undefined ? formatCents(summary.pendingTopupCents) : formatNanos(summary.pendingTopupNanos), '用户已提交待审核']
        ];
        return cards.map(([label, value, hint]) => `
            <article class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-4">
                <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">${escapeHtml(label)}</p>
                <p class="mt-2 text-2xl font-display text-primary dark:text-dark-text">${escapeHtml(value)}</p>
                <p class="mt-1 text-xs text-text-muted dark:text-dark-text-muted">${escapeHtml(hint)}</p>
            </article>
        `).join('');
    }
```

- [ ] **Step 2: 新增余额表格渲染函数**

在 `renderAdminTopups` 后方加入：

```js
    function renderAdminBalanceTable(items = []) {
        if (!items.length) {
            return '<div class="p-5 text-sm text-text-muted dark:text-dark-text-muted">暂无用户余额记录。</div>';
        }
        return `
            <table class="min-w-full divide-y divide-border-subtle dark:divide-dark-border text-sm">
                <thead class="bg-background-soft dark:bg-dark-surface text-left text-xs uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
                    <tr>
                        <th class="px-4 py-3">用户</th>
                        <th class="px-4 py-3">状态</th>
                        <th class="px-4 py-3">余额</th>
                        <th class="px-4 py-3">欠费</th>
                        <th class="px-4 py-3">待确认充值</th>
                        <th class="px-4 py-3">托管 key</th>
                        <th class="px-4 py-3">更新</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-border-subtle dark:divide-dark-border bg-white dark:bg-dark-card">
                    ${items.map((item) => `
                        <tr>
                            <td class="px-4 py-3">${escapeHtml(item.phone || '-')}</td>
                            <td class="px-4 py-3">${escapeHtml(billingStatusText(item.status))}</td>
                            <td class="px-4 py-3">${escapeHtml(item.balanceNanos === undefined ? formatCents(item.balanceCents) : formatNanos(item.balanceNanos))}</td>
                            <td class="px-4 py-3">${escapeHtml(item.debtNanos === undefined ? formatCents(item.debtCents) : formatNanos(item.debtNanos))}</td>
                            <td class="px-4 py-3">${escapeHtml(item.pendingTopupNanos === undefined ? formatCents(item.pendingTopupCents) : formatNanos(item.pendingTopupNanos))}</td>
                            <td class="px-4 py-3">${escapeHtml(`${formatNumber(item.managedApiKeyCount || 0)} 个（已用 ${formatNumber(item.usedApiKeyCount || 0)}）`)}</td>
                            <td class="px-4 py-3">${escapeHtml(formatDate(item.updatedAt))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }
```

- [ ] **Step 3: 新增余额初始化函数**

在 `initAdminTopupPage` 前方加入：

```js
    function initAdminAccountBalancesPage() {
        const searchInput = document.getElementById('adminBalanceSearchInput');
        const statusFilter = document.getElementById('adminBalanceStatusFilter');
        const summaryRoot = document.getElementById('adminBalanceSummary');
        const tableRoot = document.getElementById('adminBalanceTable');
        const message = document.getElementById('adminBalanceMessage');
        if (!summaryRoot || !tableRoot || !message) return null;

        async function fetchAccountBalances() {
            const params = new URLSearchParams({
                q: searchInput?.value || '',
                status: statusFilter?.value || 'all'
            });
            message.textContent = '正在刷新余额...';
            try {
                const data = await requestJson(`/api/admin/account-balances?${params.toString()}`);
                summaryRoot.innerHTML = renderAdminBalanceSummary(data.summary || {});
                tableRoot.innerHTML = renderAdminBalanceTable(data.items || []);
                message.textContent = `共 ${(data.items || []).length} 个账号。`;
            } catch (error) {
                summaryRoot.innerHTML = '';
                tableRoot.innerHTML = '';
                message.textContent = error.message;
            }
        }

        searchInput?.addEventListener('input', fetchAccountBalances);
        statusFilter?.addEventListener('change', fetchAccountBalances);
        fetchAccountBalances();
        return fetchAccountBalances;
    }
```

- [ ] **Step 4: 让充值审核变更刷新余额**

把 `initAdminTopupPage` 函数签名改为：

```js
    function initAdminTopupPage(options = {}) {
```

把确认 / 拒绝成功后的刷新改为：

```js
                await fetchTopups();
                await options.onBalanceChanged?.();
```

- [ ] **Step 5: 接入业务办理统一刷新**

在 `initAdminPage` 中调整初始化顺序：

```js
        const refreshAdminInvites = initAdminInvitePage();
        initAdminUsagePage();
        initAdminPasswordResetPage();
        const refreshAdminBalances = initAdminAccountBalancesPage();
        const refreshAdminTopups = initAdminTopupPage({ onBalanceChanged: refreshAdminBalances });
```

把 `refreshAdminBusiness` 的 `Promise.all` 改为：

```js
                await Promise.all([
                    refreshAdminInvites?.(),
                    refreshAdminTopups?.(),
                    refreshAdminBalances?.()
                ].filter(Boolean));
```

- [ ] **Step 6: 运行前端脚本测试**

Run:

```bash
node --test test/shop-flow.test.js
```

Expected: PASS，Task 5 的静态脚本断言通过。

- [ ] **Step 7: 提交前端脚本**

Run:

```bash
git add shop/shop.js test/shop-flow.test.js
git commit -m "feat: render admin account balances"
```

## Task 7: 视觉和构建验证

**Files:**
- Modify: `styles/site.css` only if Tailwind output changes.

- [ ] **Step 1: 构建 CSS**

Run:

```bash
npm run build:css
```

Expected: PASS，`styles/site.css` 成功生成。若 diff 中只有 class 顺序或压缩格式变化，保留构建产物；若没有变化，不强行修改。

- [ ] **Step 2: 运行全量测试**

Run:

```bash
npm test
```

Expected: PASS，所有测试通过。

- [ ] **Step 3: 本地打开 Admin 页面核对结构**

如当前没有服务，启动：

```bash
npm start
```

浏览器核对：

- `/shop/admin/` 未登录仍跳转 `/shop/login/`。
- 管理员登录后，「业务办理」内顺序为充值审核、用户余额、邀请码记录 / API key 池记录。
- 用户余额表格在桌面宽度不挤压；窄屏可横向滚动。
- 「业务办理」统一刷新按钮能刷新余额。

- [ ] **Step 4: 提交构建产物**

如果 `styles/site.css` 发生变化：

```bash
git add styles/site.css
git commit -m "build: update shop admin balance styles"
```

如果 `styles/site.css` 没有变化，记录“CSS 构建无 diff”即可。

## Task 8: 实施记录和项目记忆

**Files:**
- Create: `docs/ai/context/YYYYMMDD-HHMMSS-admin-account-balance-panel-implementation_CN.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: 写实施记录**

创建实施记录，内容使用：

```md
# Admin 用户余额面板实施

## 实施内容

- `/shop/admin/` 的「业务办理」section 已新增只读「用户余额」面板。
- 面板位于充值审核下方、邀请码记录 / API key 池记录上方。
- `/api/admin/account-balances` 返回全部 Shop 用户余额、欠费、待确认充值和托管 key 数量。
- 「业务办理」统一刷新会刷新余额面板。
- 充值审核确认或拒绝后会同步刷新余额面板。

## 口径

- 余额面板是账户台账视图，不计入「今日收银 / 本月收银」。
- Local / 未托管 usage key 不作为 Shop 用户余额展示。
- 第一版只读，不提供直接调余额操作。

## 验证

- `node --test test/shop-flow.test.js`：通过。
- `npm run build:css`：通过。
- `npm test`：通过。
- 浏览器验证 `/shop/admin/`：通过。
```

- [ ] **Step 2: 更新 AGENTS.md**

在 `AGENTS.md` 末尾追加：

```md
## 2026-06-12 Admin 用户余额面板实施

- `/shop/admin/` 的「业务办理」section 已新增只读「用户余额」面板，位置在充值审核下方、邀请码记录 / API key 池记录上方。
- 新接口 `/api/admin/account-balances` 返回 Shop 用户余额、欠费、待确认充值和托管 key 数量；Local / 未托管 usage key 不作为余额用户展示。
- 「业务办理」统一刷新和充值审核确认 / 拒绝后都会刷新余额面板。
- 余额面板是账户台账视图，不计入 Admin 用量监控的今日 / 本月收银。
- 第一版不提供直接调余额操作。
- 实施记录见 `docs/ai/context/YYYYMMDD-HHMMSS-admin-account-balance-panel-implementation_CN.md`。
```

- [ ] **Step 3: 最终状态检查**

Run:

```bash
git status --short
git diff --check
```

Expected:

- `git diff --check` 无空白错误。
- 工作树只包含本次余额面板相关变更和用户已有的无关改动。

- [ ] **Step 4: 提交文档**

Run:

```bash
git add AGENTS.md
git commit -m "docs: record admin balance panel implementation"
```

`docs/ai/context/` 被 `.gitignore` 忽略，实施记录会保留在本地项目上下文中，不进入 Git。

## 自检

- 设计覆盖：计划覆盖后端接口、余额汇总、Admin 页面位置、业务办理刷新、充值审核联动、权限、测试和实施记录。
- 类型一致：后端字段使用 `balanceNanos`、`debtNanos`、`pendingTopupNanos`、`managedApiKeyCount`、`usedApiKeyCount`、`unusedApiKeyCount`、`disabledApiKeyCount`；前端表格使用同名字段。
- 范围控制：第一版只读，不实现直接充值、扣减、清零，不修改用量监控收银口径。
