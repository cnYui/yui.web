# Shop Auth Entry and Flow Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 统一 Shop 的登录、注册、重置密码、兑换和账户页信息层级，让当前按量计费账户模型在页面和接口上保持一致。

**Architecture:** 采用 3 个独立 Auth 页面：`/shop/login/`、`/shop/register/`、`/shop/reset-password/`，共用 `styles/tailwind.css` 中的 `.shop-auth-*` 外壳样式。兑换主路径改为登录态接口 `POST /api/account/invites/redeem`，手机号只来自当前 session；旧兑换接口继续保留兼容。旧购买、支付、31 天语义只做前台清理，不触碰更重的 usage 自动同步、历史补账、API key 静态加密设计。

**Tech Stack:** Node.js、Express 5、better-sqlite3、原生静态 HTML、Tailwind CSS 3、原生浏览器 JS、`node:test`。

---

## 范围边界

本计划实施 `docs/ai/context/20260611-190009-shop-auth-entry-and-flow-unification-design_CN.md` 的前台账户入口与流程统一。

本轮包含：

- 登录、注册、重置密码拆成 3 个独立页面。
- 三个 Auth 页面统一使用已确认的左侧贴底人物背景中途版。
- `/shop/redeem/` 改成登录态兑换，只输入邀请码。
- 新增登录态兑换 API，旧匿名兑换 API 继续保留。
- 清理旧购买、支付、31 天有效期文案。
- Account 页降低信息密度，保留既有 DOM id，避免破坏现有 JS。

本轮不包含：

- usage event 自动同步。
- 历史漏扣补账。
- API key 静态加密。
- Admin 兑换码管理重做。
- 数据库生产迁移操作。

## 文件结构

- `styles/tailwind.css`：新增 `.shop-auth-main`、`.shop-auth-background-figure`、`.shop-auth-content`、`.shop-auth-panel` 组件样式，作为三页 Auth 外壳的唯一来源。
- `styles/site.css`：运行 `npm run build:css` 生成，不手写。
- `shop/login/index.html`：只保留登录表单；移除内嵌重置密码表单；使用 `.shop-auth-*` 外壳。
- `shop/register/index.html`：改为与登录页同款 Auth 外壳；保留注册表单 id。
- `shop/reset-password/index.html`：新增独立重置密码页；承载原 `passwordResetForm`。
- `shop/redeem/index.html`：移除手机号输入；显示当前登录手机号；只输入邀请码。
- `shop/key/index.html`：保留兑换结果兼容页；删除 31 天、重新购买文案。
- `shop/order/index.html`、`shop/pay/index.html`、`shop/result/index.html`、`shop/content/index.html`：清理旧购买/支付/交付内容文案，静态重定向到当前账户入口。
- `shop/account/index.html`：保持现有元素 id；将使用说明和扣费流水默认收起，减少第一屏压力。
- `shop/shop.js`：拆分 `initResetPasswordPage()`；登录页不再初始化隐藏重置表单；兑换页改调用登录态接口；路由表增加 `/shop/reset-password/`。
- `server.js`：把 `/shop/reset-password/` 加入公开页面白名单；新增 `POST /api/account/invites/redeem`。
- `test/shop-flow.test.js`：覆盖静态页面结构、Auth 样式、登录态兑换 API、旧文案清理、Account 折叠默认值。
- `AGENTS.md`：记录本计划路径和关键执行约束。

## Task 1: 抽出共用 Auth 外壳并迁移登录页

**Files:**

- Modify: `test/shop-flow.test.js`
- Modify: `styles/tailwind.css`
- Modify: `styles/site.css`
- Modify: `shop/login/index.html`

- [ ] **Step 1: 写失败测试**

在 `test/shop-flow.test.js` 中，把现有 `登录页透明背景人物图固定在左下并放大显示` 测试替换为：

```js
test('Auth 外壳样式由 Tailwind 输入文件统一维护，登录页使用中途版人物背景', () => {
    const loginHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/login/index.html'), 'utf8');
    const tailwindCss = fs.readFileSync(path.join(__dirname, '..', 'styles/tailwind.css'), 'utf8');
    const siteCss = fs.readFileSync(path.join(__dirname, '..', 'styles/site.css'), 'utf8');
    const assetPath = path.join(__dirname, '..', 'shop/assets/login/yui-login-bg.png');
    const png = fs.readFileSync(assetPath);

    assert.match(loginHtml, /class="shop-auth-main[^"]*"/);
    assert.match(loginHtml, /class="shop-auth-background-figure"/);
    assert.match(loginHtml, /class="shop-auth-content[^"]*"/);
    assert.match(loginHtml, /class="shop-auth-panel[^"]*"/);
    assert.match(loginHtml, /src="\/shop\/assets\/login\/yui-login-bg\.png"/);
    assert.doesNotMatch(loginHtml, /\.login-main/);
    assert.doesNotMatch(loginHtml, /\.login-background-figure/);
    assert.doesNotMatch(loginHtml, /\.login-content/);
    assert.doesNotMatch(loginHtml, /\.login-panel/);

    assert.match(tailwindCss, /\.shop-auth-background-figure/);
    assert.match(tailwindCss, /left:\s*clamp\(-380px,\s*-22vw,\s*-260px\)/);
    assert.match(tailwindCss, /bottom:\s*0/);
    assert.match(tailwindCss, /width:\s*min\(86vw,\s*1120px\)/);
    assert.match(tailwindCss, /opacity:\s*0\.42/);
    assert.match(siteCss, /\.shop-auth-background-figure/);

    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png[25], 6);
});
```

- [ ] **Step 2: 确认测试失败**

Run:

```bash
npm test -- --test-name-pattern="Auth 外壳样式"
```

Expected: FAIL，原因是 `shop/login/index.html` 还在使用 `.login-*`，`styles/tailwind.css` 还没有 `.shop-auth-*`。

- [ ] **Step 3: 新增 Auth 组件样式**

在 `styles/tailwind.css` 的 `@layer components` 中，放在 `.section-title` 后面：

```css
  .shop-auth-main {
    position: relative;
    overflow: hidden;
    min-height: calc(100vh - 97px);
  }

  .shop-auth-background-figure {
    position: absolute;
    left: clamp(-380px, -22vw, -260px);
    bottom: 0;
    width: min(86vw, 1120px);
    max-width: none;
    opacity: 0.42;
    pointer-events: none;
    user-select: none;
    z-index: 0;
  }

  .shop-auth-content {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    width: 100%;
    min-height: inherit;
  }

  .shop-auth-panel {
    width: min(100%, 620px);
    background: rgba(255, 255, 255, 0.88);
    backdrop-filter: blur(16px);
  }

  .dark .shop-auth-background-figure {
    opacity: 0.26;
  }

  .dark .shop-auth-panel {
    background: rgba(36, 36, 36, 0.88);
  }

  @media (max-width: 1023px) {
    .shop-auth-background-figure {
      left: -42vw;
      width: 150vw;
      opacity: 0.2;
    }

    .shop-auth-content {
      justify-content: center;
    }

    .shop-auth-panel {
      width: min(100%, 560px);
    }
  }

  @media (max-width: 767px) {
    .shop-auth-main {
      min-height: calc(100vh - 89px);
    }

    .shop-auth-background-figure {
      left: -82vw;
      width: 210vw;
      opacity: 0.14;
    }

    .dark .shop-auth-background-figure {
      opacity: 0.1;
    }
  }
```

- [ ] **Step 4: 迁移登录页外壳类名**

在 `shop/login/index.html` 中：

1. 把 `<style>` 压缩回只包含防闪烁样式：

```html
<style>html{background-color:#fff}html.dark{background-color:#0f0f0f}html[data-ui-ready="false"] body{opacity:0}html[data-ui-ready="true"] body{opacity:1;transition:opacity 120ms ease-out}</style>
```

2. 把登录页主体外壳改成：

```html
<main class="shop-auth-main flex-1 w-full max-w-[1400px] mx-auto px-6 md:px-12 flex items-stretch">
    <img class="shop-auth-background-figure" src="/shop/assets/login/yui-login-bg.png" alt="" aria-hidden="true"/>
    <div class="shop-auth-content py-12 md:py-16">
        <section class="shop-auth-panel border border-border-subtle dark:border-dark-border rounded-lg p-8 md:p-16 shadow-soft dark:shadow-soft-dark">
```

3. 保留本任务内现有登录表单和隐藏重置表单内容不变，重置密码拆分在 Task 2 处理。

- [ ] **Step 5: 生成 CSS 并验证**

Run:

```bash
npm run build:css
npm test -- --test-name-pattern="Auth 外壳样式"
```

Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add styles/tailwind.css styles/site.css shop/login/index.html test/shop-flow.test.js
git commit -m "refactor: extract shop auth layout styles"
```

## Task 2: 把重置密码拆成独立页面

**Files:**

- Modify: `test/shop-flow.test.js`
- Create: `shop/reset-password/index.html`
- Modify: `shop/login/index.html`
- Modify: `shop/shop.js`
- Modify: `server.js`

- [ ] **Step 1: 写静态页面失败测试**

把 `test/shop-flow.test.js` 中 `管理员页和登录页包含密码重置入口` 测试替换为：

```js
test('管理员页和独立重置密码页包含密码重置入口，登录页只保留跳转链接', () => {
    const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/admin/index.html'), 'utf8');
    const loginHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/login/index.html'), 'utf8');
    const resetHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/reset-password/index.html'), 'utf8');
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');

    assert.match(adminHtml, /id="passwordResetCodeForm"/);
    assert.match(adminHtml, /id="passwordResetPhone"/);
    assert.match(adminHtml, /id="passwordResetCodeResult"/);

    assert.match(loginHtml, /href="\/shop\/reset-password\/"/);
    assert.doesNotMatch(loginHtml, /id="showPasswordResetButton"/);
    assert.doesNotMatch(loginHtml, /id="passwordResetForm"/);
    assert.doesNotMatch(loginHtml, /id="resetPasswordCode"/);
    assert.doesNotMatch(loginHtml, /id="resetNewPassword"/);
    assert.doesNotMatch(loginHtml, /id="resetConfirmPassword"/);

    assert.match(resetHtml, /<title>重置密码<\/title>/);
    assert.match(resetHtml, /class="shop-auth-main[^"]*"/);
    assert.match(resetHtml, /class="shop-auth-background-figure"/);
    assert.match(resetHtml, /id="passwordResetForm"/);
    assert.match(resetHtml, /id="resetPhone"/);
    assert.match(resetHtml, /id="resetPasswordCode"/);
    assert.match(resetHtml, /id="resetNewPassword"/);
    assert.match(resetHtml, /id="resetConfirmPassword"/);
    assert.match(resetHtml, /href="\/shop\/login\/"/);

    assert.match(script, /function initResetPasswordPage/);
    assert.match(script, /'\/shop\/reset-password\/': initResetPasswordPage/);
    assert.doesNotMatch(script, /function initPasswordResetForm/);
    assert.doesNotMatch(script, /initPasswordResetForm\(\)/);
    assert.match(script, /initResetPasswordPage/);
});
```

- [ ] **Step 2: 写公开页面路由失败测试**

在同一文件新增：

```js
test('重置密码页允许未登录访问，账户页仍要求登录', async () => {
    await withServer(async ({ baseUrl }) => {
        const resetPage = await fetch(`${baseUrl}/shop/reset-password/`, { redirect: 'manual' });
        assert.equal(resetPage.status, 200);
        assert.match(await resetPage.text(), /id="passwordResetForm"/);

        const accountPage = await fetch(`${baseUrl}/shop/account/`, { redirect: 'manual' });
        assert.equal(accountPage.status, 302);
        assert.equal(accountPage.headers.get('location'), '/shop/login/');
    });
});
```

- [ ] **Step 3: 确认测试失败**

Run:

```bash
npm test -- --test-name-pattern="重置密码"
```

Expected: FAIL，原因是 `shop/reset-password/index.html` 不存在，`server.js` 未把该页面列入公开白名单，`shop/shop.js` 还使用 `initPasswordResetForm()`。

- [ ] **Step 4: 创建独立重置密码页**

创建 `shop/reset-password/index.html`。文件结构沿用登录页的 `<head>`、主题初始化、字体、`/shop/shop.js` 引用和轻量 header；`<title>` 使用 `重置密码`。`<main>` 使用：

```html
<main class="shop-auth-main flex-1 w-full max-w-[1400px] mx-auto px-6 md:px-12 flex items-stretch">
    <img class="shop-auth-background-figure" src="/shop/assets/login/yui-login-bg.png" alt="" aria-hidden="true"/>
    <div class="shop-auth-content py-12 md:py-16">
        <section class="shop-auth-panel border border-border-subtle dark:border-dark-border rounded-lg p-8 md:p-16 shadow-soft dark:shadow-soft-dark">
            <form id="passwordResetForm" class="space-y-5">
                <label class="block">
                    <span class="text-sm font-medium text-primary dark:text-dark-text">手机号</span>
                    <input id="resetPhone" class="mt-2 w-full h-12 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary" type="tel" inputmode="numeric" autocomplete="tel" minlength="11" maxlength="11" pattern="^1[3-9]\d{9}$" required placeholder="请输入 11 位手机号"/>
                </label>
                <label class="block">
                    <span class="text-sm font-medium text-primary dark:text-dark-text">重置码</span>
                    <input id="resetPasswordCode" class="mt-2 w-full h-12 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary" type="text" autocomplete="one-time-code" required placeholder="RST-XXXXXX-XXXXXX"/>
                </label>
                <label class="block">
                    <span class="text-sm font-medium text-primary dark:text-dark-text">新密码</span>
                    <input id="resetNewPassword" class="mt-2 w-full h-12 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary" type="password" autocomplete="new-password" required placeholder="至少 8 位，含大小写字母和数字"/>
                </label>
                <label class="block">
                    <span class="text-sm font-medium text-primary dark:text-dark-text">再次输入新密码</span>
                    <input id="resetConfirmPassword" class="mt-2 w-full h-12 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary" type="password" autocomplete="new-password" required placeholder="请再次输入新密码"/>
                </label>
                <p id="passwordResetMessage" class="min-h-5 text-sm text-red-600"></p>
                <button class="btn-primary w-full" type="submit">重置并登录</button>
                <p class="text-sm text-text-muted dark:text-dark-text-muted">想起密码了？<a class="text-primary dark:text-dark-text underline underline-offset-4" href="/shop/login/">登录</a></p>
            </form>
        </section>
    </div>
</main>
```

- [ ] **Step 5: 清理登录页重置密码 DOM**

在 `shop/login/index.html` 中：

1. 删除整个 `<form id="passwordResetForm" ...>...</form>`。
2. 把忘记密码入口改为普通链接：

```html
<p class="text-sm text-text-muted dark:text-dark-text-muted">忘记密码？<a class="text-primary dark:text-dark-text underline underline-offset-4" href="/shop/reset-password/">重置密码</a></p>
```

- [ ] **Step 6: 拆分前端初始化函数**

在 `shop/shop.js` 中：

1. 把 `function initPasswordResetForm()` 改名为 `function initResetPasswordPage()`。
2. 删除函数内部对 `loginForm`、`showPasswordResetButton`、`showLoginFormButton` 的读取和点击切换逻辑。
3. 函数起始 DOM 读取改成：

```js
    function initResetPasswordPage() {
        const resetForm = document.getElementById('passwordResetForm');
        const phoneInput = document.getElementById('resetPhone');
        const codeInput = document.getElementById('resetPasswordCode');
        const passwordInput = document.getElementById('resetNewPassword');
        const confirmInput = document.getElementById('resetConfirmPassword');
        const message = document.getElementById('passwordResetMessage');
        if (!resetForm || !phoneInput || !codeInput || !passwordInput || !confirmInput || !message) return;
```

4. 保留原 submit 校验和 `POST /api/auth/password-reset` 逻辑。
5. 从 `initLoginPage()` 中删除：

```js
        initPasswordResetForm();
```

6. 在 `pageInitializers` 增加：

```js
        '/shop/reset-password/': initResetPasswordPage,
```

7. 在 `window.YuiShop` 暴露：

```js
        initResetPasswordPage,
```

- [ ] **Step 7: 放开重置密码静态页面访问**

在 `server.js` 的 `shopPublicPagePaths` 加入：

```js
        '/shop/reset-password',
        '/shop/reset-password/',
        '/shop/reset-password/index.html',
```

- [ ] **Step 8: 验证**

Run:

```bash
npm test -- --test-name-pattern="重置密码"
```

Expected: PASS。

- [ ] **Step 9: 提交**

```bash
git add shop/reset-password/index.html shop/login/index.html shop/shop.js server.js test/shop-flow.test.js
git commit -m "refactor: split shop password reset page"
```

## Task 3: 注册页改为同款 Auth 背景

**Files:**

- Modify: `test/shop-flow.test.js`
- Modify: `shop/register/index.html`

- [ ] **Step 1: 写失败测试**

在 `test/shop-flow.test.js` 新增：

```js
test('注册页使用登录页同款 Auth 外壳并移除左侧说明区块', () => {
    const registerHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/register/index.html'), 'utf8');

    assert.match(registerHtml, /<title>注册<\/title>/);
    assert.match(registerHtml, /class="shop-auth-main[^"]*"/);
    assert.match(registerHtml, /class="shop-auth-background-figure"/);
    assert.match(registerHtml, /src="\/shop\/assets\/login\/yui-login-bg\.png"/);
    assert.match(registerHtml, /class="shop-auth-content[^"]*"/);
    assert.match(registerHtml, /class="shop-auth-panel[^"]*"/);
    assert.match(registerHtml, /id="registerForm"/);
    assert.match(registerHtml, /id="registerPhone"/);
    assert.match(registerHtml, /id="registerPassword"/);
    assert.match(registerHtml, /id="registerConfirmPassword"/);
    assert.match(registerHtml, /href="\/shop\/login\/"/);
    assert.doesNotMatch(registerHtml, /Create account/);
    assert.doesNotMatch(registerHtml, /手机号会作为你的账户身份/);
    assert.doesNotMatch(registerHtml, /历史兑换过的手机号/);
    assert.doesNotMatch(registerHtml, /grid lg:grid-cols-\[0\.9fr_1\.1fr\]/);
});
```

- [ ] **Step 2: 确认测试失败**

Run:

```bash
npm test -- --test-name-pattern="注册页使用登录页同款"
```

Expected: FAIL，原因是注册页还是左右两栏说明布局。

- [ ] **Step 3: 替换注册页标题和主体**

在 `shop/register/index.html` 中：

1. 把 `<title>Register - Shop</title>` 改为：

```html
<title>注册</title>
```

2. 把 `<main>...</main>` 替换为：

```html
<main class="shop-auth-main flex-1 w-full max-w-[1400px] mx-auto px-6 md:px-12 flex items-stretch">
    <img class="shop-auth-background-figure" src="/shop/assets/login/yui-login-bg.png" alt="" aria-hidden="true"/>
    <div class="shop-auth-content py-12 md:py-16">
        <section class="shop-auth-panel border border-border-subtle dark:border-dark-border rounded-lg p-8 md:p-16 shadow-soft dark:shadow-soft-dark">
            <form id="registerForm" class="space-y-5">
                <label class="block">
                    <span class="text-sm font-medium text-primary dark:text-dark-text">手机号</span>
                    <input id="registerPhone" class="mt-2 w-full h-12 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary" type="tel" inputmode="numeric" autocomplete="tel" minlength="11" maxlength="11" pattern="^1[3-9]\d{9}$" required placeholder="请输入 11 位手机号"/>
                </label>
                <label class="block">
                    <span class="text-sm font-medium text-primary dark:text-dark-text">密码</span>
                    <input id="registerPassword" class="mt-2 w-full h-12 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary" type="password" autocomplete="new-password" required placeholder="至少 8 位，含大小写字母和数字"/>
                </label>
                <label class="block">
                    <span class="text-sm font-medium text-primary dark:text-dark-text">再次输入密码</span>
                    <input id="registerConfirmPassword" class="mt-2 w-full h-12 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary" type="password" autocomplete="new-password" required placeholder="请再次输入密码"/>
                </label>
                <p id="registerMessage" class="min-h-5 text-sm text-red-600"></p>
                <button class="btn-primary w-full" type="submit">注册并登录</button>
                <p class="text-sm text-text-muted dark:text-dark-text-muted">已有账号？<a class="text-primary dark:text-dark-text underline underline-offset-4" href="/shop/login/">登录</a></p>
            </form>
        </section>
    </div>
</main>
```

- [ ] **Step 4: 验证**

Run:

```bash
npm test -- --test-name-pattern="注册页使用登录页同款"
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add shop/register/index.html test/shop-flow.test.js
git commit -m "refactor: align shop register auth layout"
```

## Task 4: 兑换页改为登录态兑换

**Files:**

- Modify: `test/shop-flow.test.js`
- Modify: `server.js`
- Modify: `shop/redeem/index.html`
- Modify: `shop/shop.js`

- [ ] **Step 1: 写后端 API 失败测试**

在 `test/shop-flow.test.js` 新增：

```js
test('登录态兑换邀请码只使用当前 session 手机号', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const cookie = await registerUserAndGetCookie(baseUrl, '13800138691', 'Abcdefg1');

        await jsonFetch(`${baseUrl}/api/admin/api-keys`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ apiKeys: ['sk-session-redeem'] })
        });
        const inviteResult = await jsonFetch(`${baseUrl}/api/admin/invites`, {
            method: 'POST',
            headers: { 'x-admin-token': 'test-token' },
            body: JSON.stringify({ count: 1 })
        });

        const missingSession = await jsonFetch(`${baseUrl}/api/account/invites/redeem`, {
            method: 'POST',
            skipCsrfForTest: true,
            body: JSON.stringify({ code: inviteResult.body.invites[0].code })
        });
        assert.equal(missingSession.response.status, 401);

        const redeemResult = await jsonFetch(`${baseUrl}/api/account/invites/redeem`, {
            method: 'POST',
            headers: { cookie },
            body: JSON.stringify({ phone: '13900000000', code: inviteResult.body.invites[0].code })
        });
        assert.equal(redeemResult.response.status, 201);
        assert.equal(redeemResult.body.order.phone, '13800138691');
        assert.match(redeemResult.response.headers.get('set-cookie') || '', /yui_shop_result=/);

        const row = db.prepare('SELECT phone FROM orders WHERE id = ?').get(redeemResult.body.order.id);
        assert.equal(row.phone, '13800138691');
    });
});
```

- [ ] **Step 2: 写兑换页静态和前端失败测试**

在 `test/shop-flow.test.js` 新增：

```js
test('兑换页只展示当前账号手机号并调用登录态兑换接口', () => {
    const redeemHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/redeem/index.html'), 'utf8');
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');

    assert.match(redeemHtml, /id="redeemAccountPhone"/);
    assert.match(redeemHtml, /id="inviteCodeInput"/);
    assert.doesNotMatch(redeemHtml, /id="phoneInput"/);
    assert.doesNotMatch(redeemHtml, /输入手机号和邀请码/);
    assert.doesNotMatch(redeemHtml, /手机号是唯一查询方式/);

    assert.match(script, /requestJson\('\/api\/account\/me'\)/);
    assert.match(script, /requestJson\('\/api\/account\/invites\/redeem'/);
    assert.match(script, /body: JSON\.stringify\(\{ code \}\)/);
    assert.doesNotMatch(script, /body: JSON\.stringify\(\{ phone, code \}\)/);
});
```

- [ ] **Step 3: 确认测试失败**

Run:

```bash
npm test -- --test-name-pattern="登录态兑换|兑换页只展示"
```

Expected: FAIL，原因是新接口不存在，兑换页还有手机号输入，前端还调用旧匿名接口。

- [ ] **Step 4: 新增登录态兑换 API**

在 `server.js` 的 `app.get('/api/account/me'...)` 后、`app.post('/api/account/orders/:id/reveal-api-key'...)` 前加入：

```js
    app.post('/api/account/invites/redeem', limitRedeemApi, requireSameOrigin, requireAccount, requireAccountCsrf, (req, res) => {
        const code = String(req.body.code || '').trim().toUpperCase();
        if (!code) {
            return res.status(400).json({ code: 'INVALID_INVITE_CODE', message: '请输入邀请码。' });
        }

        try {
            const order = redeemInvite({ phone: req.account.phone, code });
            res.cookie(resultCookieName, order.resultToken, cookieOptions(req));
            res.clearCookie(legacyRedeemCookieName, { path: '/shop' });
            return res.status(201).json({ order: publicOrder(order, { includeApiKey: true }) });
        } catch (error) {
            return res.status(error.status || 500).json({
                code: error.code || 'REDEEM_FAILED',
                message: error.message || '兑换失败。'
            });
        }
    });
```

保留 `POST /api/invites/redeem` 不动，兼容历史测试和外部调用。

- [ ] **Step 5: 修改兑换页 HTML**

在 `shop/redeem/index.html` 中：

1. 把说明文案改为：

```html
<p class="mt-5 text-text-muted dark:text-dark-text-muted leading-relaxed">登录后输入邀请码，系统会把 API key 绑定到当前账户。</p>
```

2. 把说明框改为：

```html
<div class="mt-8 rounded-lg border border-border-subtle dark:border-dark-border bg-background-soft dark:bg-dark-surface p-5">
    <p class="text-sm text-text-muted dark:text-dark-text-muted">当前登录账号：<span id="redeemAccountPhone" class="font-medium text-primary dark:text-dark-text">-</span></p>
</div>
```

3. 删除手机号 `<label>`，保留邀请码 `<label>` 和提交按钮。

- [ ] **Step 6: 修改兑换页 JS**

把 `shop/shop.js` 的 `initRedeemPage()` 函数替换为：

```js
    async function initRedeemPage() {
        const form = document.getElementById('redeemForm');
        const accountPhone = document.getElementById('redeemAccountPhone');
        const codeInput = document.getElementById('inviteCodeInput');
        const message = document.getElementById('redeemMessage');
        if (!form || !accountPhone || !codeInput || !message) return;

        try {
            const data = await requestJson('/api/account/me');
            accountPhone.textContent = data.user?.phone || '-';
        } catch (error) {
            window.location.replace('/shop/login/');
            return;
        }

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const code = codeInput.value.trim();
            if (!code) {
                message.textContent = '请输入邀请码。';
                codeInput.focus();
                return;
            }

            message.textContent = '正在兑换...';
            try {
                await requestJson('/api/account/invites/redeem', {
                    method: 'POST',
                    body: JSON.stringify({ code })
                });
                window.location.href = '/shop/account/';
            } catch (error) {
                message.textContent = error.message;
            }
        });
    }
```

- [ ] **Step 7: 验证**

Run:

```bash
npm test -- --test-name-pattern="登录态兑换|兑换页只展示"
```

Expected: PASS。

- [ ] **Step 8: 提交**

```bash
git add server.js shop/redeem/index.html shop/shop.js test/shop-flow.test.js
git commit -m "feat: redeem invites from account session"
```

## Task 5: 清理旧购买、支付、31 天语义

**Files:**

- Modify: `test/shop-flow.test.js`
- Modify: `shop/key/index.html`
- Modify: `shop/order/index.html`
- Modify: `shop/pay/index.html`
- Modify: `shop/result/index.html`
- Modify: `shop/content/index.html`
- Modify: `shop/shop.js`

- [ ] **Step 1: 写失败测试**

在 `test/shop-flow.test.js` 新增：

```js
test('旧购买支付页面不再展示购买、支付、31 天和演示交付语义', () => {
    const files = [
        'shop/key/index.html',
        'shop/order/index.html',
        'shop/pay/index.html',
        'shop/result/index.html',
        'shop/content/index.html'
    ];
    const combined = files.map((file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')).join('\n');
    const script = fs.readFileSync(path.join(__dirname, '..', 'shop/shop.js'), 'utf8');

    assert.doesNotMatch(combined, /31 天/);
    assert.doesNotMatch(combined, /重新购买/);
    assert.doesNotMatch(combined, /¥199\.00/);
    assert.doesNotMatch(combined, /Yui Personal Digital Pack/);
    assert.doesNotMatch(combined, /生成订单并支付/);
    assert.doesNotMatch(combined, /选择支付方式/);
    assert.doesNotMatch(combined, /等待支付确认/);
    assert.doesNotMatch(combined, /演示支付成功/);
    assert.doesNotMatch(combined, /购买内容/);
    assert.doesNotMatch(combined, /交付文件/);
    assert.doesNotMatch(combined, /去购买/);

    assert.match(fs.readFileSync(path.join(__dirname, '..', 'shop/key/index.html'), 'utf8'), /API key 已激活/);
    assert.match(fs.readFileSync(path.join(__dirname, '..', 'shop/order/index.html'), 'utf8'), /url=\/shop\/account\//);
    assert.match(fs.readFileSync(path.join(__dirname, '..', 'shop/pay/index.html'), 'utf8'), /url=\/shop\/account\//);
    assert.match(fs.readFileSync(path.join(__dirname, '..', 'shop/result/index.html'), 'utf8'), /url=\/shop\/account\//);
    assert.match(fs.readFileSync(path.join(__dirname, '..', 'shop/content/index.html'), 'utf8'), /url=\/shop\/account\//);

    assert.match(script, /'\/shop\/order\/': \(\) => \{ window\.location\.replace\('\/shop\/account\/'\); \}/);
    assert.match(script, /'\/shop\/pay\/': \(\) => \{ window\.location\.replace\('\/shop\/account\/'\); \}/);
    assert.match(script, /'\/shop\/result\/': \(\) => \{ window\.location\.replace\('\/shop\/account\/'\); \}/);
    assert.match(script, /'\/shop\/content\/': \(\) => \{ window\.location\.replace\('\/shop\/account\/'\); \}/);
});
```

- [ ] **Step 2: 确认测试失败**

Run:

```bash
npm test -- --test-name-pattern="旧购买支付页面"
```

Expected: FAIL，原因是旧页面仍包含购买、支付、31 天文案，JS 跳转仍指向 redeem/key。

- [ ] **Step 3: 修改 key 页文案**

在 `shop/key/index.html` 中：

1. 把标题改为：

```html
<h1 class="mt-4 font-display text-4xl md:text-6xl">API key 已激活</h1>
```

2. 把说明改为：

```html
<p class="mt-5 text-text-muted dark:text-dark-text-muted leading-relaxed">API key 已绑定到账户。你可以在账户页查看余额、用量，并复制完整 API key。</p>
```

3. 把空状态说明改为：

```html
<p class="mt-3 text-text-muted dark:text-dark-text-muted">请登录账户后使用邀请码兑换 API key。</p>
```

- [ ] **Step 4: 把旧页面静态重定向改到账户页**

对 `shop/order/index.html`、`shop/pay/index.html`、`shop/result/index.html`、`shop/content/index.html` 执行相同原则：

1. `<meta http-equiv="refresh" content="0; url=/shop/account/"/>`
2. 主体只保留轻量提示：

```html
<main class="flex-1 max-w-[920px] mx-auto px-6 md:px-12 py-14 md:py-20 w-full">
    <section class="border border-border-subtle dark:border-dark-border rounded-lg p-8 text-center bg-white dark:bg-dark-card">
        <h1 class="font-display text-4xl text-primary dark:text-dark-text">正在前往账户页</h1>
        <p class="mt-3 text-text-muted dark:text-dark-text-muted">当前 Shop 已改为登录账户后按量使用。</p>
        <a class="btn-primary mt-6 inline-flex" href="/shop/account/">打开账户页</a>
    </section>
</main>
```

保留每个文件现有 `<head>` 主题初始化、字体链接、header 和脚本引用。

- [ ] **Step 5: 修改前端旧路由跳转**

在 `shop/shop.js` 的 `pageInitializers` 中替换为：

```js
        '/shop/order/': () => { window.location.replace('/shop/account/'); },
        '/shop/pay/': () => { window.location.replace('/shop/account/'); },
        '/shop/result/': () => { window.location.replace('/shop/account/'); },
        '/shop/content/': () => { window.location.replace('/shop/account/'); }
```

- [ ] **Step 6: 验证**

Run:

```bash
npm test -- --test-name-pattern="旧购买支付页面"
```

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add shop/key/index.html shop/order/index.html shop/pay/index.html shop/result/index.html shop/content/index.html shop/shop.js test/shop-flow.test.js
git commit -m "refactor: remove legacy shop purchase copy"
```

## Task 6: Account 页降噪但保持 DOM id

**Files:**

- Modify: `test/shop-flow.test.js`
- Modify: `shop/account/index.html`

- [ ] **Step 1: 写失败测试**

在 `test/shop-flow.test.js` 新增：

```js
test('Account 页把余额和 API key 前置，并默认收起说明和流水', () => {
    const accountHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/account/index.html'), 'utf8');

    const billingIndex = accountHtml.indexOf('id="accountBillingSection"');
    const keysIndex = accountHtml.indexOf('id="accountKeysSection"');
    const guideIndex = accountHtml.indexOf('id="accountGuideSection"');
    const usageIndex = accountHtml.indexOf('id="accountUsageSection"');
    const historyIndex = accountHtml.indexOf('id="accountBillingHistorySection"');

    assert.ok(billingIndex > -1);
    assert.ok(keysIndex > -1);
    assert.ok(guideIndex > -1);
    assert.ok(usageIndex > -1);
    assert.ok(historyIndex > -1);
    assert.ok(billingIndex < keysIndex);
    assert.ok(keysIndex < guideIndex);
    assert.ok(guideIndex < usageIndex);
    assert.ok(usageIndex < historyIndex);

    assert.match(accountHtml, /id="accountBillingSection"[^>]*data-collapsible-default="open"/);
    assert.match(accountHtml, /id="accountKeysSection"[^>]*data-collapsible-default="open"/);
    assert.match(accountHtml, /id="accountGuideSection"[^>]*data-collapsible-default="closed"/);
    assert.match(accountHtml, /id="accountBillingHistorySection"[^>]*data-collapsible-default="closed"/);

    for (const id of [
        'accountPhone',
        'accountMessage',
        'accountBalanceCards',
        'topupForm',
        'accountTopups',
        'accountOrders',
        'accountUsageCards',
        'accountBillingUsageCards',
        'accountTokenBreakdown',
        'accountHourlyChart',
        'accountDailyChart',
        'accountCharges',
        'accountLedger'
    ]) {
        assert.match(accountHtml, new RegExp(`id="${id}"`));
    }
});
```

- [ ] **Step 2: 确认测试失败**

Run:

```bash
npm test -- --test-name-pattern="Account 页把余额"
```

Expected: FAIL，原因是 `accountGuideSection` 和 `accountBillingHistorySection` 仍默认展开。

- [ ] **Step 3: 修改默认折叠状态**

在 `shop/account/index.html` 中：

1. 把：

```html
<section id="accountGuideSection" class="mt-12" data-collapsible-section data-collapsible-default="open">
```

改为：

```html
<section id="accountGuideSection" class="mt-12" data-collapsible-section data-collapsible-default="closed">
```

2. 把：

```html
<section id="accountBillingHistorySection" class="mt-12" data-collapsible-section data-collapsible-default="open">
```

改为：

```html
<section id="accountBillingHistorySection" class="mt-12" data-collapsible-section data-collapsible-default="closed">
```

3. 保持 `accountBillingSection` 和 `accountKeysSection` 默认展开。

- [ ] **Step 4: 验证**

Run:

```bash
npm test -- --test-name-pattern="Account 页把余额"
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add shop/account/index.html test/shop-flow.test.js
git commit -m "refactor: reduce shop account page density"
```

## Task 7: 全量验证和浏览器截图验收

**Files:**

- Create: `docs/ai/context/20260611-191500-shop-auth-entry-and-flow-unification-implementation_CN.md`

- [ ] **Step 1: 跑全量测试**

Run:

```bash
npm test
```

Expected: PASS，所有 `test/*.test.js` 和 `lib/*.test.js` 通过。

- [ ] **Step 2: 确认 CSS 可重复生成**

Run:

```bash
npm run build:css
git diff -- styles/site.css
```

Expected: `styles/site.css` 只有本计划新增 `.shop-auth-*` 引发的可解释差异；第二次运行 `npm run build:css` 不应继续产生额外 diff。

- [ ] **Step 3: 启动本地服务**

Run:

```bash
npm start
```

Expected: 服务输出监听端口，默认可访问 `http://127.0.0.1:3000`。如果 3000 被占用，使用当前项目已有方式指定其他端口，并在实施记录写清楚实际 URL。

- [ ] **Step 4: 用浏览器验收 Auth 页面**

使用 Browser 插件打开：

- `http://127.0.0.1:3000/shop/login/`
- `http://127.0.0.1:3000/shop/register/`
- `http://127.0.0.1:3000/shop/reset-password/`

验收标准：

- 三页左侧人物图都使用 `shop/assets/login/yui-login-bg.png`。
- 桌面端人物图贴底，位置是中途版：左侧留出人物主体，未使用更大的 1320px 版本。
- 三页表单卡片在右侧；窄屏时表单居中，人物图透明度降低，不遮挡输入框。
- 登录页不显示“这里是登录页面”。
- 登录页没有隐藏重置密码表单，只有 `/shop/reset-password/` 链接。
- 注册页没有旧左右说明区块。
- 重置密码页可以直接访问并显示 4 个输入框。

- [ ] **Step 5: 用浏览器验收兑换和 Account**

使用测试账号登录后打开：

- `http://127.0.0.1:3000/shop/redeem/`
- `http://127.0.0.1:3000/shop/account/`

验收标准：

- 未登录访问 `/shop/redeem/` 会进入登录页。
- 登录后 `/shop/redeem/` 只展示当前账号手机号和邀请码输入框。
- 兑换页没有可编辑手机号输入框。
- Account 页第一屏优先显示账户、余额和 API key 区域。
- 使用说明默认收起。
- 扣费与流水默认收起。

- [ ] **Step 6: 创建实施记录**

创建新的 `docs/ai/context/20260611-191500-shop-auth-entry-and-flow-unification-implementation_CN.md`，内容包含：

```markdown
# Shop 前台账户入口与流程统一实施记录

## 改动

- 登录、注册、重置密码拆成独立页面，并统一使用 `.shop-auth-*` 外壳。
- 兑换页改为登录态兑换，只输入邀请码。
- 新增 `POST /api/account/invites/redeem`，旧匿名兑换接口保留兼容。
- 清理旧购买、支付、31 天文案。
- Account 使用说明和扣费流水默认收起。

## 验证

- `npm test`：通过。
- `npm run build:css`：通过，`styles/site.css` 可重复生成。
- 浏览器验收：登录页、注册页、重置密码页、兑换页、Account 页通过。

## 备注

- 本轮没有实施 usage 自动同步、历史补账、API key 静态加密。
- 登录页人物背景保持中途版参数：`left: clamp(-380px, -22vw, -260px)`，`width: min(86vw, 1120px)`。
```

- [ ] **Step 7: 提交最终记录**

```bash
git add -f docs/ai/context/20260611-191500-shop-auth-entry-and-flow-unification-implementation_CN.md
git commit -m "docs: record shop auth flow implementation"
```

## 最终检查

执行者在发起 PR 前完成：

- [ ] `git status --short` 只包含本轮预期文件，或为空。
- [ ] `npm test` 通过。
- [ ] `npm run build:css` 已运行，`styles/site.css` 与 `styles/tailwind.css` 一致。
- [ ] 三个 Auth 页面都使用 `.shop-auth-*`，没有复制 `.login-*` 样式。
- [ ] `/shop/login/` 不包含 `passwordResetForm`。
- [ ] `/shop/reset-password/` 未登录可访问。
- [ ] `/shop/redeem/` 不包含 `phoneInput`。
- [ ] `POST /api/account/invites/redeem` 使用 `req.account.phone`。
- [ ] 旧匿名 `POST /api/invites/redeem` 保留。
- [ ] 旧页面没有 31 天、支付、购买和演示交付文案。
- [ ] Account 页保留现有 JS 依赖的 id。
- [ ] AGENTS 记忆已记录本计划和实施记录路径。

## 客观风险

- `styles/site.css` 是压缩生成文件，改动审查时可读性差；审查应以 `styles/tailwind.css` 为准，再确认生成文件同步。
- `test/shop-flow.test.js` 已经很大，新增测试应靠近相关旧测试，避免让文件继续失序。
- 新登录态兑换接口复用 `redeemInvite()`，会继续设置 result cookie；这有利于兼容 `/shop/key/`，但主完成页改为 `/shop/account/`。
- `requireShopHtmlPage` 会保护除公开白名单外的 Shop HTML 页面，因此 `/shop/redeem/` 登录保护可以依赖服务端页面守卫；前端仍要处理 API 未登录时跳回登录。
