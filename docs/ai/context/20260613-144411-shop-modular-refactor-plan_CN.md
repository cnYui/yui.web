# Shop B 级模块化重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Shop 前后端从胖文件拆成中等粒度模块，并使用独立端口和独立数据库验证，不影响当前公网映射实例。

**Architecture:** 后端只先抽纯函数和低耦合服务，`server.js` 保留路由、SQL statement 和事务边界。前端保留 `/shop/shop.js` 作为入口，新增 `shop/js/*` 全局模块，由入口加载并按页面路径初始化。测试先锁住金额、价格、收银统计、模型总览和前端入口兼容性，再执行拆分。

**Tech Stack:** Node.js、Express、better-sqlite3、原生浏览器脚本、node:test、Tailwind CSS。

---

## 文件结构

- Create: `lib/shop-money.js`
  - 金额与整数工具：`nonNegativeInteger`、`parsePositiveCnyToCents`、`centsToCny`、`centsToNanos`、`signedCentsToNanos`、`nanosToCny`、`nanosToBalanceCents`。
- Modify: `lib/shop-pricing.js`
  - 继续提供当前模型价格，新增 `priceForVersion(version)`，统一历史价格回放。
- Create: `lib/shop-billing-summary.js`
  - 提供 `buildBillingSummary(chargeRows, ranges, options)`、`buildWeeklySpending(chargeRows, now)`。
- Create: `lib/shop-model-overview.js`
  - 提供 `normalizeModelList(body)`、`modelPriceOverview(modelId, available)`、`pricingFallbackModelOverview()`。
- Modify: `server.js`
  - 从新模块导入纯函数；删除本地重复金额、价格回放、收银统计、模型 DTO 函数。
- Modify: `lib/shop-usage-reconcile.js`
  - 复用 `lib/shop-money.js`。
- Create: `shop/js/core.js`
  - 提供 `window.YuiShopCore`。
- Create: `shop/js/charts.js`
  - 提供 `window.YuiShopCharts`。
- Create: `shop/js/auth.js`
  - 提供 `window.YuiShopAuth`。
- Create: `shop/js/account.js`
  - 提供 `window.YuiShopAccount`。
- Create: `shop/js/admin.js`
  - 提供 `window.YuiShopAdmin`。
- Create: `shop/js/legacy-redirects.js`
  - 提供 `window.YuiShopLegacyRedirects`。
- Modify: `shop/shop.js`
  - 入口脚本：加载模块、暴露 `window.YuiShopReady` 和兼容的 `window.YuiShop`。
- Modify: `test/shop-flow.test.js`
  - 保留后端集成测试，更新前端脚本加载 helper。
- Create: `test/shop-frontend.test.js`
  - 承接前端 VM 和静态 HTML 结构测试。
- Create: `lib/shop-money.test.js`
  - 金额工具单元测试。
- Create: `lib/shop-billing-summary.test.js`
  - 收银与周消费纯函数测试。
- Create: `lib/shop-model-overview.test.js`
  - 模型总览纯函数测试。
- Modify: `AGENTS.md`
  - 记录 B 级重构边界、开发隔离要求和不能共用生产库。

---

### Task 0: 隔离工作区与基线

**Files:**
- No code changes in current public-mapped workspace.
- Worktree target: `/Users/wujianxiang/CodeSpace/yui.web/.worktrees/shop-modular-refactor-20260613`

- [ ] **Step 1: 确认当前目录不是 linked worktree**

Run:

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" && pwd -P)
printf '%s\n%s\n' "$GIT_DIR" "$GIT_COMMON"
git rev-parse --show-superproject-working-tree 2>/dev/null || true
```

Expected: `GIT_DIR` 与 `GIT_COMMON` 相同，且不是 submodule。

- [ ] **Step 2: 创建隔离 worktree**

Run:

```bash
git worktree add .worktrees/shop-modular-refactor-20260613 -b codex/shop-modular-refactor-20260613
cd .worktrees/shop-modular-refactor-20260613
```

Expected: 创建并进入新分支 `codex/shop-modular-refactor-20260613`。

- [ ] **Step 3: 安装依赖并跑基线**

Run:

```bash
npm install
npm test
```

Expected: `npm test` 通过，测试数不少于当前基线 142。

---

### Task 1: 抽出金额与历史价格回放

**Files:**
- Create: `lib/shop-money.js`
- Create: `lib/shop-money.test.js`
- Modify: `lib/shop-pricing.js`
- Modify: `lib/shop-pricing.test.js`
- Modify: `lib/shop-usage-reconcile.js`
- Modify: `server.js`

- [ ] **Step 1: 写失败测试**

Add `lib/shop-money.test.js`:

```javascript
const assert = require('node:assert/strict');
const test = require('node:test');

const {
    centsToCny,
    centsToNanos,
    nanosToBalanceCents,
    nanosToCny,
    nonNegativeInteger,
    parsePositiveCnyToCents,
    signedCentsToNanos
} = require('./shop-money');

test('金额工具统一处理 cents、nanos 和人民币展示', () => {
    assert.equal(nonNegativeInteger('12.9'), 12);
    assert.equal(nonNegativeInteger(-1), 0);
    assert.equal(parsePositiveCnyToCents('12.34'), 1234);
    assert.equal(centsToCny(1234), 12.34);
    assert.equal(centsToNanos(123), 1230000000);
    assert.equal(signedCentsToNanos(-123), -1230000000);
    assert.equal(nanosToCny(1500000000), 1.5);
    assert.equal(nanosToBalanceCents(19999999), 1);
    assert.equal(nanosToBalanceCents(-19999999), -2);
});
```

Extend `lib/shop-pricing.test.js`:

```javascript
test('历史价格版本由 pricing 模块统一回放', () => {
    const { priceForVersion } = require('./shop-pricing');
    assert.equal(priceForVersion('deepseek-v4-pro-rmb-20260424').cacheHitInputNanosPerToken, 25);
    assert.equal(priceForVersion('deepseek-v4-pro-rmb-20260612-cache-hit-10x').outputNanosPerToken, 6000);
    assert.equal(priceForVersion('deepseek-v4-pro-rmb-20260612-output-20rmb').outputNanosPerToken, 20000);
    assert.equal(priceForVersion('gpt-5.4-rmb-20260613').cacheMissInputNanosPerToken, 2500);
    assert.equal(priceForVersion('gpt-5.5-rmb-20260613').outputNanosPerToken, 30000);
    assert.equal(priceForVersion('unknown-version').model, 'gpt-5.4');
});
```

- [ ] **Step 2: 验证测试失败**

Run:

```bash
node --test lib/shop-money.test.js lib/shop-pricing.test.js
```

Expected: `Cannot find module './shop-money'` 或 `priceForVersion is not a function`。

- [ ] **Step 3: 实现最小模块**

Create `lib/shop-money.js` with exported functions copied from existing semantics in `server.js` and `lib/shop-usage-reconcile.js`.

Modify `lib/shop-pricing.js`:

```javascript
function priceForVersion(version) {
    if (version === 'deepseek-v4-pro-rmb-20260424') {
        return {
            model: 'deepseek-v4-pro',
            version,
            cacheHitInputNanosPerToken: 25,
            cacheMissInputNanosPerToken: 3000,
            outputNanosPerToken: 6000
        };
    }
    if (version === 'deepseek-v4-pro-rmb-20260612-cache-hit-10x') {
        return {
            model: 'deepseek-v4-pro',
            version,
            cacheHitInputNanosPerToken: 250,
            cacheMissInputNanosPerToken: 3000,
            outputNanosPerToken: 6000
        };
    }
    if (version === 'deepseek-v4-pro-rmb-20260612-output-20rmb') {
        return {
            model: 'deepseek-v4-pro',
            version,
            cacheHitInputNanosPerToken: 250,
            cacheMissInputNanosPerToken: 3000,
            outputNanosPerToken: 20000
        };
    }
    return Object.values(gptModelRmbPrices).find((price) => price.version === version) || currentDefaultRmbPrice;
}
```

Then replace local duplicate imports in `server.js` and `lib/shop-usage-reconcile.js`.

- [ ] **Step 4: 验证通过**

Run:

```bash
node --test lib/shop-money.test.js lib/shop-pricing.test.js test/shop-usage-reconcile.test.js
```

Expected: all pass.

---

### Task 2: 抽出收银统计和周消费

**Files:**
- Create: `lib/shop-billing-summary.js`
- Create: `lib/shop-billing-summary.test.js`
- Modify: `server.js`

- [ ] **Step 1: 写失败测试**

Create `lib/shop-billing-summary.test.js`:

```javascript
const assert = require('node:assert/strict');
const test = require('node:test');

const { buildBillingSummary, buildWeeklySpending } = require('./shop-billing-summary');

test('收银统计按 price_version 拆分今日和本月构成', () => {
    const rows = [
        {
            phone: '13800138001',
            status: 'charged',
            created_at: '2026-06-13T10:00:00+08:00',
            charge_nanos: 17750000000,
            cache_hit_input_tokens: 1000000,
            cache_miss_input_tokens: 1000000,
            output_tokens: 1000000,
            price_version: 'gpt-5.4-rmb-20260613'
        },
        {
            phone: '13800138002',
            status: 'charged',
            created_at: '2026-06-12T10:00:00+08:00',
            charge_nanos: 6025000000,
            cache_hit_input_tokens: 1000000,
            cache_miss_input_tokens: 1000000,
            output_tokens: 1000000,
            price_version: 'deepseek-v4-pro-rmb-20260424'
        }
    ];
    const summary = buildBillingSummary(rows, {
        todayStart: new Date('2026-06-13T00:00:00+08:00'),
        monthStart: new Date('2026-06-01T00:00:00+08:00')
    });
    assert.equal(summary.todayChargeNanos, 17750000000);
    assert.equal(summary.monthChargeNanos, 23775000000);
    assert.equal(summary.todayRevenueParts.find((part) => part.key === 'output').chargeNanos, 15000000000);
    assert.equal(summary.monthRevenueParts.find((part) => part.key === 'cache_hit_input').chargeNanos, 275000000);
    assert.equal(summary.customerSpendingRankings.month[0].phone, '13800138001');
});

test('周消费统计按中国周一到周日生成 7 天桶', () => {
    const weekly = buildWeeklySpending([
        {
            status: 'charged',
            created_at: '2026-06-10T10:00:00+08:00',
            charge_nanos: 15000000000,
            cache_hit_input_tokens: 0,
            cache_miss_input_tokens: 0,
            output_tokens: 1000000,
            price_version: 'gpt-5.4-rmb-20260613'
        }
    ], new Date('2026-06-13T12:00:00+08:00'));
    const current = weekly.weeks[weekly.currentWeekStart];
    assert.equal(current.days.length, 7);
    assert.equal(current.days.some((day) => day.chargeNanos === 15000000000), true);
});
```

- [ ] **Step 2: 验证测试失败**

Run:

```bash
node --test lib/shop-billing-summary.test.js
```

Expected: `Cannot find module './shop-billing-summary'`。

- [ ] **Step 3: 实现模块并替换 server.js 内部重复函数**

Move these pure functions from `server.js` to `lib/shop-billing-summary.js`:

- `emptyBillingStats`
- `emptyCustomerSpending`
- `addCustomerSpending`
- `addBillingStats`
- `revenueParts`
- `chinaDateKeyToDayStart`
- `chinaDateLabel`
- `addSpendingPartCharges`
- `emptyDailySpending`
- `publicDailySpending`
- `createWeeklySpendingBucket`
- `publicWeeklySpendingBucket`
- `buildWeeklySpending`
- `customerSpendingParts`
- `customerSpendingRanking`
- `billingStatsToPublic`
- `buildBillingSummary`

Import in `server.js`:

```javascript
const { buildBillingSummary, buildWeeklySpending } = require('./lib/shop-billing-summary');
```

Keep `startOfChinaDay` and `startOfChinaMonth` in `server.js` for request ranges.

- [ ] **Step 4: 验证后端收银相关行为**

Run:

```bash
node --test lib/shop-billing-summary.test.js test/shop-flow.test.js --test-name-pattern "usage summary|收银构成|用户消费排行|周扣费"
```

Expected: all pass.

---

### Task 3: 抽出模型总览纯逻辑

**Files:**
- Create: `lib/shop-model-overview.js`
- Create: `lib/shop-model-overview.test.js`
- Modify: `server.js`

- [ ] **Step 1: 写失败测试**

Create `lib/shop-model-overview.test.js`:

```javascript
const assert = require('node:assert/strict');
const test = require('node:test');

const {
    modelPriceOverview,
    normalizeModelList,
    pricingFallbackModelOverview
} = require('./shop-model-overview');

test('模型列表支持 OpenAI data 和通用 models 结构并去重', () => {
    assert.deepEqual(normalizeModelList({
        data: [{ id: 'gpt-5.4' }, { model: 'gpt-5.4' }, { name: 'gpt-5.5' }]
    }), ['gpt-5.4', 'gpt-5.5']);
});

test('模型价格展示未知模型沿用 gpt-5.4', () => {
    const overview = modelPriceOverview('gpt-5.4-mini', true);
    assert.equal(overview.available, true);
    assert.equal(overview.priceModel, 'gpt-5.4');
    assert.equal(overview.usesDefaultPrice, true);
    assert.equal(overview.cacheMissInputCnyPerMillion, 2.5);
});

test('价格表 fallback 至少包含 gpt-5.4 和 gpt-5.5', () => {
    const ids = pricingFallbackModelOverview().map((model) => model.id);
    assert.deepEqual(ids, ['gpt-5.4', 'gpt-5.5']);
});
```

- [ ] **Step 2: 验证测试失败**

Run:

```bash
node --test lib/shop-model-overview.test.js
```

Expected: `Cannot find module './shop-model-overview'`。

- [ ] **Step 3: 实现并替换 server.js 内部函数**

Move from `server.js`:

- `cnyPerMillionTokens`
- `modelPriceOverview`
- `pricingFallbackModelOverview`
- `normalizeModelList`

Keep `fetchModelIds` and `accountModelOverview` in `server.js`, because they depend on app options and order SQL.

- [ ] **Step 4: 验证模型总览接口**

Run:

```bash
node --test lib/shop-model-overview.test.js test/shop-flow.test.js --test-name-pattern "模型总览"
```

Expected: all pass.

---

### Task 4: 抽出前端 core 和 charts

**Files:**
- Create: `shop/js/core.js`
- Create: `shop/js/charts.js`
- Modify: `shop/shop.js`
- Modify: `test/shop-flow.test.js`
- Create: `test/shop-frontend.test.js`

- [ ] **Step 1: 写失败测试**

Create a helper in `test/shop-frontend.test.js`:

```javascript
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadShopScripts(sandbox) {
    for (const file of [
        'shop/js/core.js',
        'shop/js/charts.js',
        'shop/js/auth.js',
        'shop/js/account.js',
        'shop/js/admin.js',
        'shop/js/legacy-redirects.js',
        'shop/shop.js'
    ]) {
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), sandbox, { filename: file });
    }
}

test('前端图表模块复用同一个堆叠柱渲染入口', () => {
    const sandbox = { window: {}, document: { readyState: 'loading', addEventListener() {} }, Intl, URL };
    sandbox.window.document = sandbox.document;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'shop/js/core.js'), 'utf8'), sandbox);
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'shop/js/charts.js'), 'utf8'), sandbox);
    assert.equal(typeof sandbox.window.YuiShopCharts.renderStackedChargeBars, 'function');
    const html = sandbox.window.YuiShopCharts.renderStackedChargeBars({
        items: [{ label: '6/13', chargeNanos: 15000000000, parts: [{ key: 'output', label: '输出 token', chargeNanos: 15000000000 }] }],
        emptyText: '暂无记录'
    });
    assert.match(html, /admin-revenue-bar-stack/);
    assert.match(html, /输出 token/);
});
```

- [ ] **Step 2: 验证测试失败**

Run:

```bash
node --test test/shop-frontend.test.js --test-name-pattern "堆叠柱"
```

Expected: `ENOENT` for `shop/js/core.js` or missing `renderStackedChargeBars`。

- [ ] **Step 3: 实现 core 和 charts**

Move these functions from `shop/shop.js` to `shop/js/core.js`:

- `isPhone`
- `bindPhoneInput`
- `isStrongPassword`
- `formatDate`
- `formatPrice`
- `formatCents`
- `formatNanos`
- `formatNumber`
- `formatCompactNumber`
- `escapeHtml`
- `readCookie`
- `requestJson`
- `runWhenDomReady`

Move chart functions to `shop/js/charts.js` and extract shared:

- `renderStackedChargeBars`
- `renderRevenuePieChart`
- `renderCustomerSpendingBars`
- `renderAccountWeeklySpendingChart`
- `renderAdminRevenueCharts`
- `renderBars`

Expose globals:

```javascript
window.YuiShopCore = {
    bindPhoneInput,
    escapeHtml,
    formatCents,
    formatCompactNumber,
    formatDate,
    formatNanos,
    formatNumber,
    formatPrice,
    isPhone,
    isStrongPassword,
    readCookie,
    requestJson,
    runWhenDomReady
};
window.YuiShopCharts = { renderStackedChargeBars, renderAdminRevenueCharts, renderAccountWeeklySpendingChart, renderBars };
```

- [ ] **Step 4: 验证前端图表测试**

Run:

```bash
node --test test/shop-frontend.test.js --test-name-pattern "堆叠柱"
```

Expected: pass.

---

### Task 5: 拆 Auth、Account、Admin 和入口

**Files:**
- Create: `shop/js/auth.js`
- Create: `shop/js/account.js`
- Create: `shop/js/admin.js`
- Create: `shop/js/legacy-redirects.js`
- Modify: `shop/shop.js`
- Modify: `test/shop-flow.test.js`
- Modify: `test/shop-frontend.test.js`

- [ ] **Step 1: 写失败测试**

Add to `test/shop-frontend.test.js`:

```javascript
test('Shop 入口加载页面模块后仍暴露兼容的 YuiShop 初始化函数', async () => {
    const elements = new Map();
    const sandbox = {
        window: { location: { pathname: '/shop/login/', replace() {} } },
        document: {
            cookie: '',
            readyState: 'complete',
            createElement: () => ({ set src(value) { this._src = value; }, get src() { return this._src; }, onload: null, onerror: null }),
            head: { appendChild(node) { node.onload?.(); } },
            querySelectorAll: () => [],
            getElementById: (id) => elements.get(id) || null,
            addEventListener() {}
        },
        fetch: async () => ({ ok: true, json: async () => ({}) }),
        Intl,
        URL
    };
    sandbox.window.document = sandbox.document;
    loadShopScripts(sandbox);
    await sandbox.window.YuiShopReady;
    assert.equal(typeof sandbox.window.YuiShop.initLoginPage, 'function');
    assert.equal(typeof sandbox.window.YuiShop.initAccountPage, 'function');
    assert.equal(typeof sandbox.window.YuiShop.initAdminPage, 'function');
    assert.equal(typeof sandbox.window.YuiShop.initOrderPage, 'function');
});
```

- [ ] **Step 2: 验证测试失败**

Run:

```bash
node --test test/shop-frontend.test.js --test-name-pattern "入口加载页面模块"
```

Expected: missing module files or missing `YuiShopReady`。

- [ ] **Step 3: 拆页面模块**

Move from `shop/shop.js`:

- Auth to `shop/js/auth.js`:
  - `normalizeResetCodeInput`
  - `initResetPasswordPage`
  - `initLoginPage`
  - `initRegisterPage`
- Account to `shop/js/account.js`:
  - `statusText`
  - `statusClass`
  - `billingStatusText`
  - `topupStatusText`
  - `ledgerEntryText`
  - `chargeStatusText`
  - `renderOrderCard`
  - `bindCopy`
  - `renderBillingUsageCards`
  - `renderBalanceCards`
  - `formatModelPrice`
  - `renderAccountModelOverview`
  - `renderTopups`
  - `renderCharges`
  - `renderLedger`
  - `initRedeemPage`
  - `initKeyPage`
  - `initQueryPage`
  - `initAccountPage`
  - `initAccountLinks`
- Admin to `shop/js/admin.js`:
  - `renderAdminBalanceSummary`
  - `renderAdminTopups`
  - `renderAdminBalanceTable`
  - `renderInviteConsoleSummary`
  - `renderAdminInviteTable`
  - `renderAdminApiKeyPoolTable`
  - `renderAdminRecentCharges`
  - `usageStatusText`
  - `usageGroupText`
  - `renderUsageSummary`
  - `renderUsageItems`
  - `initAdminUsagePage`
  - `initCollapsibleSections`
  - `initAdminPasswordResetPage`
  - `initAdminAccountBalancesPage`
  - `initAdminTopupPage`
  - `initAdminInvitePage`
  - `initAdminPage`
- Legacy to `shop/js/legacy-redirects.js`:
  - order/pay/result/content redirects.

Thin `shop/shop.js` responsibilities:

```javascript
(function() {
    const moduleSources = [
        '/shop/js/core.js',
        '/shop/js/charts.js',
        '/shop/js/auth.js',
        '/shop/js/account.js',
        '/shop/js/admin.js',
        '/shop/js/legacy-redirects.js'
    ];
    // load modules once, then build pageInitializers from window.YuiShop* globals.
})();
```

Preserve public API names currently exposed on `window.YuiShop`.

- [ ] **Step 4: 更新前端 VM helper**

In `test/shop-flow.test.js`, replace helpers that only load `shop/shop.js` with a helper that loads all module files in order.

Keep existing assertions:

- `requestJson` 自动加 CSRF。
- Account 页加载模型总览。
- Account 兑换调用登录态接口且不提交手机号。
- 栏目折叠按钮可初始化。

- [ ] **Step 5: 验证前端测试**

Run:

```bash
node --test test/shop-frontend.test.js test/shop-flow.test.js --test-name-pattern "requestJson|Account 前端|Shop 外部脚本|入口加载页面模块|堆叠柱"
```

Expected: all pass.

---

### Task 6: 拆分测试文件，控制 shop-flow 继续膨胀

**Files:**
- Modify: `test/shop-flow.test.js`
- Modify: `test/shop-frontend.test.js`

- [ ] **Step 1: 移动纯前端和静态 HTML 测试**

Move tests whose bodies only read `shop/*.html`、`shop/shop.js` 或 VM 执行前端脚本 into `test/shop-frontend.test.js`。

Keep in `test/shop-flow.test.js` tests that start Express server or inspect SQLite behavior.

- [ ] **Step 2: 验证测试文件拆分没有丢用例**

Run:

```bash
npm test
```

Expected: all pass, test count not lower than before this task.

---

### Task 7: 独立端口开发验收

**Files:**
- No code changes.

- [ ] **Step 1: 构建 CSS**

Run:

```bash
npm run build:css
```

Expected: exit 0.

- [ ] **Step 2: 启动独立开发实例**

Run from isolated worktree:

```bash
PORT=4174 node -e "const path=require('node:path'); const { createShopApp }=require('./server'); const { app, usageImporter }=createShopApp({ dbPath: path.join(process.cwd(), 'data/dev/shop-refactor.sqlite'), usageAutoImportEnabled: false, usageAutoImportStartTimer: false }); const server=app.listen(4174, '127.0.0.1', () => console.log('dev shop http://127.0.0.1:4174')); process.on('SIGINT', () => { usageImporter.stop(); server.close(() => process.exit(0)); });"
```

Expected: console prints `dev shop http://127.0.0.1:4174`。

- [ ] **Step 3: 浏览器检查**

Open `http://127.0.0.1:4174/shop/login/` in the in-app Browser.

Check:

- 登录页未空白。
- 注册页和重置密码页加载。
- 未登录访问 `/shop/account/` 跳到 `/shop/login/`。
- Admin 页面未登录跳登录。
- 浏览器 console 无模块加载错误。

- [ ] **Step 4: 停止开发实例**

Send `Ctrl-C` to the server session.

Expected: process exits and no background session remains.

---

### Task 8: 文档和最终验证

**Files:**
- Create: `docs/ai/context/YYYYMMDD-HHMMSS-shop-modular-refactor-implementation_CN.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: 写实施记录**

Document:

- 实际拆出的文件。
- 开发实例端口和数据库路径。
- 未改变的外部 API。
- 测试命令和结果。
- 如果有未完成拆分，说明原因和后续边界。

- [ ] **Step 2: 更新 AGENTS.md 项目记忆**

Append concise memory:

- Shop 前端已拆为 `shop/js/*`，`shop/shop.js` 只做入口。
- 后端金额、价格回放、收银统计、模型总览纯逻辑已进入 `lib/*`。
- 后续 Shop 开发涉及公网映射时必须使用独立 worktree、独立端口、独立 SQLite。

- [ ] **Step 3: 最终验证**

Run:

```bash
npm test
npm run build:css
```

Expected: both exit 0.
