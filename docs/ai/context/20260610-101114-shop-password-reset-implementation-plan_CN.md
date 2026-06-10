# Shop Password Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Shop 增加管理员生成一次性密码重置码、用户在登录页凭码重置密码并自动进入个人中心的完整流程。

**Architecture:** 继续沿用 `server.js` 内的 Express + SQLite 单文件后端模式，新增 `password_reset_codes` 表、重置码 hash 工具、管理员生成接口和公开重置接口。前端继续集中在 `shop/shop.js`，在现有 `/shop/admin/` 和 `/shop/login/` 页面追加独立表单，不拆新页面。

**Tech Stack:** Node.js、Express、better-sqlite3、原生浏览器 DOM/fetch、Node test runner。

---

## 文件结构

- Modify: `server.js`
  - 新增重置码常量、生成/归一化/hash 工具。
  - 扩展 SQLite schema 和 prepared statements。
  - 新增 `createPasswordResetCode`、`resetPasswordWithCode`。
  - 新增 `POST /api/admin/password-reset-codes` 与 `POST /api/auth/password-reset`。
- Modify: `shop/admin/index.html`
  - 新增管理员生成重置码表单。
- Modify: `shop/login/index.html`
  - 新增“忘记密码？”入口和重置密码表单。
- Modify: `shop/shop.js`
  - 新增 `normalizeResetCodeInput`、`initPasswordResetForm`、`initAdminPasswordResetPage`。
  - 在 `initLoginPage()` 和 `initAdminPage()` 中挂载新表单逻辑。
- Modify: `test/shop-flow.test.js`
  - 增加后端接口、session 失效、静态页面断言。
- Create: `docs/ai/context/20260610-101114-shop-password-reset-implementation_CN.md`
  - 完成后记录实际改动和验证结果。

## Task 1: 写后端失败测试

**Files:**
- Modify: `test/shop-flow.test.js`

- [ ] **Step 1: 增加 schema 测试**

在账号相关测试附近新增：

```js
test('Shop 数据库包含 password_reset_codes 一次性密码重置码表', async () => {
    await withServer(async ({ db }) => {
        const table = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'password_reset_codes'").get();
        assert.deepEqual(table, { name: 'password_reset_codes' });

        const columns = db.prepare('PRAGMA table_info(password_reset_codes)').all().map((column) => column.name);
        assert.deepEqual(columns, [
            'id',
            'phone',
            'code_hash',
            'created_at',
            'expires_at',
            'used_at',
            'created_by_phone'
        ]);
    });
});
```

- [ ] **Step 2: 增加管理员生成码权限和校验测试**

新增：

```js
test('只有管理员账号可以为已注册用户生成一次性密码重置码', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const userRegister = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138620', password: 'Abcdefg1', confirmPassword: 'Abcdefg1' })
        });
        assert.equal(userRegister.response.status, 201);
        const userCookie = userRegister.response.headers.get('set-cookie') || '';

        const forbidden = await jsonFetch(`${baseUrl}/api/admin/password-reset-codes`, {
            method: 'POST',
            headers: { cookie: userCookie },
            body: JSON.stringify({ phone: '13800138620' })
        });
        assert.equal(forbidden.response.status, 403);
        assert.equal(forbidden.body.code, 'ADMIN_ACCOUNT_REQUIRED');

        seedAdminUserForTest(db);
        const adminLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '15951875192', password: 'Abcdefg1' })
        });
        assert.equal(adminLogin.response.status, 200);
        const adminCookie = adminLogin.response.headers.get('set-cookie') || '';

        const invalidPhone = await jsonFetch(`${baseUrl}/api/admin/password-reset-codes`, {
            method: 'POST',
            headers: { cookie: adminCookie },
            body: JSON.stringify({ phone: '13800138abc' })
        });
        assert.equal(invalidPhone.response.status, 400);
        assert.equal(invalidPhone.body.code, 'INVALID_PHONE');

        const missingUser = await jsonFetch(`${baseUrl}/api/admin/password-reset-codes`, {
            method: 'POST',
            headers: { cookie: adminCookie },
            body: JSON.stringify({ phone: '13800138621' })
        });
        assert.equal(missingUser.response.status, 404);
        assert.equal(missingUser.body.code, 'USER_NOT_FOUND');

        const created = await jsonFetch(`${baseUrl}/api/admin/password-reset-codes`, {
            method: 'POST',
            headers: { cookie: adminCookie },
            body: JSON.stringify({ phone: '13800138620' })
        });
        assert.equal(created.response.status, 201);
        assert.equal(created.body.phone, '13800138620');
        assert.match(created.body.code, /^RST-[A-Z0-9]{6}-[A-Z0-9]{6}$/);
        assert.match(created.body.expiresAt, /^\d{4}-\d{2}-\d{2}T/);

        const row = db.prepare('SELECT phone, code_hash, used_at, created_by_phone FROM password_reset_codes WHERE phone = ?').get('13800138620');
        assert.equal(row.phone, '13800138620');
        assert.equal(row.created_by_phone, '15951875192');
        assert.equal(row.used_at, null);
        assert.doesNotMatch(row.code_hash, /RST-/);
        assert.notEqual(row.code_hash, created.body.code);
    });
});
```

- [ ] **Step 3: 增加用户凭码重置密码测试**

新增：

```js
test('用户凭一次性重置码设置新密码后旧 session 失效并创建新 session', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const userRegister = await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138622', password: 'Abcdefg1', confirmPassword: 'Abcdefg1' })
        });
        assert.equal(userRegister.response.status, 201);
        const oldCookie = userRegister.response.headers.get('set-cookie') || '';

        seedAdminUserForTest(db);
        const adminLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '15951875192', password: 'Abcdefg1' })
        });
        const adminCookie = adminLogin.response.headers.get('set-cookie') || '';
        const resetCodeResult = await jsonFetch(`${baseUrl}/api/admin/password-reset-codes`, {
            method: 'POST',
            headers: { cookie: adminCookie },
            body: JSON.stringify({ phone: '13800138622' })
        });
        assert.equal(resetCodeResult.response.status, 201);
        const resetCode = resetCodeResult.body.code;

        const weakPassword = await jsonFetch(`${baseUrl}/api/auth/password-reset`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138622', code: resetCode, password: 'abcdefg1', confirmPassword: 'abcdefg1' })
        });
        assert.equal(weakPassword.response.status, 400);
        assert.equal(weakPassword.body.code, 'WEAK_PASSWORD');

        const mismatch = await jsonFetch(`${baseUrl}/api/auth/password-reset`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138622', code: resetCode, password: 'Abcdefg2', confirmPassword: 'Abcdefg3' })
        });
        assert.equal(mismatch.response.status, 400);
        assert.equal(mismatch.body.code, 'PASSWORD_MISMATCH');

        const invalidCode = await jsonFetch(`${baseUrl}/api/auth/password-reset`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138622', code: 'RST-XXXXXX-XXXXXX', password: 'Abcdefg2', confirmPassword: 'Abcdefg2' })
        });
        assert.equal(invalidCode.response.status, 400);
        assert.equal(invalidCode.body.code, 'INVALID_RESET_CODE');

        const reset = await jsonFetch(`${baseUrl}/api/auth/password-reset`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138622', code: resetCode.toLowerCase(), password: 'Abcdefg2', confirmPassword: 'Abcdefg2' })
        });
        assert.equal(reset.response.status, 200);
        assert.equal(reset.body.user.phone, '13800138622');
        const newCookie = reset.response.headers.get('set-cookie') || '';
        assert.match(newCookie, /yui_shop_account_session=/);

        const oldSession = await jsonFetch(`${baseUrl}/api/account/me`, {
            headers: { cookie: oldCookie }
        });
        assert.equal(oldSession.response.status, 401);
        assert.equal(oldSession.body.code, 'ACCOUNT_LOGIN_REQUIRED');

        const newSession = await jsonFetch(`${baseUrl}/api/account/me`, {
            headers: { cookie: newCookie }
        });
        assert.equal(newSession.response.status, 200);
        assert.equal(newSession.body.user.phone, '13800138622');

        const oldPasswordLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138622', password: 'Abcdefg1' })
        });
        assert.equal(oldPasswordLogin.response.status, 401);

        const newPasswordLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138622', password: 'Abcdefg2' })
        });
        assert.equal(newPasswordLogin.response.status, 200);

        const usedAgain = await jsonFetch(`${baseUrl}/api/auth/password-reset`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138622', code: resetCode, password: 'Abcdefg3', confirmPassword: 'Abcdefg3' })
        });
        assert.equal(usedAgain.response.status, 400);
        assert.equal(usedAgain.body.code, 'INVALID_RESET_CODE');
    });
});
```

- [ ] **Step 4: 增加过期码测试**

新增：

```js
test('过期的一次性密码重置码不能用于重置密码', async () => {
    await withServer(async ({ baseUrl, db }) => {
        await jsonFetch(`${baseUrl}/api/auth/register`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138623', password: 'Abcdefg1', confirmPassword: 'Abcdefg1' })
        });

        const code = 'RST-EXPIRE-000001';
        const codeHash = crypto.createHash('sha256').update(code).digest('hex');
        db.prepare(`
            INSERT INTO password_reset_codes (id, phone, code_hash, created_at, expires_at, created_by_phone)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            'PRC_EXPIRED_TEST',
            '13800138623',
            codeHash,
            '2026-06-09T12:00:00+08:00',
            '2026-06-09T12:01:00+08:00',
            '15951875192'
        );

        const result = await jsonFetch(`${baseUrl}/api/auth/password-reset`, {
            method: 'POST',
            body: JSON.stringify({ phone: '13800138623', code, password: 'Abcdefg2', confirmPassword: 'Abcdefg2' })
        });
        assert.equal(result.response.status, 400);
        assert.equal(result.body.code, 'INVALID_RESET_CODE');
    });
});
```

- [ ] **Step 5: 运行失败测试**

Run:

```bash
npm test -- test/shop-flow.test.js
```

Expected: 新增测试因 `password_reset_codes` 表和接口不存在失败。

## Task 2: 实现后端密码重置能力

**Files:**
- Modify: `server.js`

- [ ] **Step 1: 增加常量和工具函数**

在顶部常量附近加入：

```js
const passwordResetCodeMaxAgeMs = 30 * 60 * 1000;
```

在 `createAccountSessionToken()` 附近加入：

```js
function createPasswordResetCode() {
    const left = crypto.randomBytes(3).toString('hex').toUpperCase();
    const right = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `RST-${left}-${right}`;
}

function normalizePasswordResetCode(code) {
    return String(code || '').trim().toUpperCase();
}

function hashPasswordResetCode(code) {
    return crypto.createHash('sha256').update(normalizePasswordResetCode(code)).digest('hex');
}
```

- [ ] **Step 2: 扩展 schema**

在 `user_sessions` 建表后加入：

```js
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_by_phone TEXT NOT NULL,
  FOREIGN KEY (phone) REFERENCES users(phone)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_phone
ON password_reset_codes(phone);

CREATE INDEX IF NOT EXISTS idx_password_reset_codes_expires
ON password_reset_codes(expires_at);
```

- [ ] **Step 3: 增加 prepared statements**

在账号 session statements 附近加入：

```js
const insertPasswordResetCode = db.prepare(`
INSERT INTO password_reset_codes (id, phone, code_hash, created_at, expires_at, created_by_phone)
VALUES (?, ?, ?, ?, ?, ?)
`);

const getPasswordResetCodeByHash = db.prepare(`
SELECT id, phone, code_hash, created_at, expires_at, used_at, created_by_phone
FROM password_reset_codes
WHERE code_hash = ?
`);

const markPasswordResetCodeUsed = db.prepare(`
UPDATE password_reset_codes
SET used_at = ?
WHERE id = ? AND used_at IS NULL
`);

const revokeAccountSessionsByPhone = db.prepare(`
UPDATE user_sessions
SET revoked_at = ?
WHERE phone = ? AND revoked_at IS NULL
`);
```

- [ ] **Step 4: 增加业务函数**

在 `createAccountSessionForPhone()` 附近加入：

```js
function createPasswordResetCodeForPhone({ phone, createdByPhone }) {
    const user = getUserByPhone.get(phone);
    if (!user || !user.password_hash) {
        const error = new Error('没有找到可重置密码的账号。');
        error.status = 404;
        error.code = 'USER_NOT_FOUND';
        throw error;
    }
    const createdAt = new Date();
    let code = createPasswordResetCode();
    while (getPasswordResetCodeByHash.get(hashPasswordResetCode(code))) {
        code = createPasswordResetCode();
    }
    const expiresAt = new Date(createdAt.getTime() + passwordResetCodeMaxAgeMs);
    insertPasswordResetCode.run(
        createId('PRC'),
        phone,
        hashPasswordResetCode(code),
        nowIso(createdAt),
        nowIso(expiresAt),
        createdByPhone
    );
    return { phone, code, expiresAt: nowIso(expiresAt) };
}

const resetPasswordWithCode = db.transaction(({ phone, code, password }) => {
    const user = getUserByPhone.get(phone);
    const row = getPasswordResetCodeByHash.get(hashPasswordResetCode(code));
    const expiresAt = row ? new Date(row.expires_at).getTime() : NaN;
    if (!user || !user.password_hash || !row || row.phone !== phone || row.used_at || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        const error = new Error('重置码无效或已过期。');
        error.status = 400;
        error.code = 'INVALID_RESET_CODE';
        throw error;
    }
    const now = nowIso();
    setUserPassword.run(hashPassword(password), now, now, phone);
    markPasswordResetCodeUsed.run(now, row.id);
    revokeAccountSessionsByPhone.run(now, phone);
    return { phone };
});
```

- [ ] **Step 5: 增加接口**

在 auth/account/admin API 区域加入：

```js
app.post('/api/auth/password-reset', limitAuthApi, (req, res) => {
    const phone = String(req.body.phone || '').trim();
    const code = normalizePasswordResetCode(req.body.code);
    const password = String(req.body.password || '');
    const confirmPassword = String(req.body.confirmPassword || '');
    if (!isPhone(phone)) {
        return res.status(400).json({ code: 'INVALID_PHONE', message: '请输入有效的中国大陆手机号。' });
    }
    const passwordResult = validatePassword(password);
    if (!passwordResult.ok) {
        return res.status(400).json({ code: 'WEAK_PASSWORD', message: passwordResult.message });
    }
    if (password !== confirmPassword) {
        return res.status(400).json({ code: 'PASSWORD_MISMATCH', message: '两次输入的密码不一致。' });
    }

    try {
        const user = resetPasswordWithCode({ phone, code, password });
        const token = createAccountSessionForPhone(user.phone);
        res.cookie(accountCookieName, token, accountCookieOptions(req));
        return res.json({ user: publicUser(user.phone) });
    } catch (error) {
        return res.status(error.status || 500).json({
            code: error.code || 'PASSWORD_RESET_FAILED',
            message: error.message || '密码重置失败。'
        });
    }
});

app.post('/api/admin/password-reset-codes', limitAdminApi, requireAdminUsageAccess, (req, res) => {
    const phone = String(req.body.phone || '').trim();
    if (!isPhone(phone)) {
        return res.status(400).json({ code: 'INVALID_PHONE', message: '请输入有效的中国大陆手机号。' });
    }
    try {
        const result = createPasswordResetCodeForPhone({
            phone,
            createdByPhone: req.account?.phone || defaultAdminAccountPhone
        });
        return res.status(201).json(result);
    } catch (error) {
        return res.status(error.status || 500).json({
            code: error.code || 'PASSWORD_RESET_CODE_FAILED',
            message: error.message || '生成密码重置码失败。'
        });
    }
});
```

- [ ] **Step 6: 运行后端测试**

Run:

```bash
npm test -- test/shop-flow.test.js
```

Expected: 后端新增测试通过；静态页面测试仍可能因 HTML 未改而失败。

## Task 3: 写前端静态失败测试

**Files:**
- Modify: `test/shop-flow.test.js`

- [ ] **Step 1: 增加页面断言测试**

在静态页面测试附近新增：

```js
test('管理员页和登录页包含密码重置入口', async () => {
    await withServer(async ({ baseUrl, db }) => {
        seedAdminUserForTest(db);
        const adminLogin = await jsonFetch(`${baseUrl}/api/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ phone: '15951875192', password: 'Abcdefg1' })
        });
        const adminCookie = adminLogin.response.headers.get('set-cookie') || '';

        const adminPage = await fetch(`${baseUrl}/shop/admin/`, {
            headers: { cookie: adminCookie }
        });
        const adminHtml = await adminPage.text();
        assert.match(adminHtml, /id="passwordResetCodeForm"/);
        assert.match(adminHtml, /id="passwordResetPhone"/);
        assert.match(adminHtml, /id="passwordResetCodeResult"/);

        const loginPage = await fetch(`${baseUrl}/shop/login/`);
        const loginHtml = await loginPage.text();
        assert.match(loginHtml, /id="showPasswordResetButton"/);
        assert.match(loginHtml, /id="passwordResetForm"/);
        assert.match(loginHtml, /id="resetPasswordCode"/);
        assert.match(loginHtml, /id="resetNewPassword"/);
        assert.match(loginHtml, /id="resetConfirmPassword"/);
    });
});
```

- [ ] **Step 2: 运行失败测试**

Run:

```bash
npm test -- test/shop-flow.test.js
```

Expected: 静态页面断言因缺少表单元素失败。

## Task 4: 实现前端页面和脚本

**Files:**
- Modify: `shop/admin/index.html`
- Modify: `shop/login/index.html`
- Modify: `shop/shop.js`

- [ ] **Step 1: 修改管理员页**

在 `adminUsageSection` 前加入：

```html
<section class="mt-10 border-t border-border-subtle dark:border-dark-border pt-10">
    <div>
        <p class="text-xs uppercase tracking-[0.28em] text-text-muted dark:text-dark-text-muted">Password reset</p>
        <h2 class="mt-3 font-display text-3xl md:text-4xl">生成密码重置码</h2>
        <p class="mt-3 text-sm text-text-muted dark:text-dark-text-muted leading-relaxed">输入已注册用户手机号，生成 30 分钟内有效的一次性重置码。生成后通过线下渠道发给用户。</p>
    </div>
    <form id="passwordResetCodeForm" class="mt-6 grid gap-3 rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-5 md:grid-cols-[1fr_auto]">
        <input id="passwordResetPhone" class="h-11 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary" type="tel" inputmode="numeric" autocomplete="tel" minlength="11" maxlength="11" pattern="^1[3-9]\d{9}$" required placeholder="用户手机号"/>
        <button class="btn-primary" type="submit">生成重置码</button>
    </form>
    <p id="passwordResetCodeMessage" class="mt-3 text-sm text-text-muted dark:text-dark-text-muted"></p>
    <div id="passwordResetCodeResult" class="mt-4 hidden rounded-md border border-border-subtle dark:border-dark-border bg-background-soft dark:bg-dark-surface p-4"></div>
</section>
```

- [ ] **Step 2: 修改登录页**

在登录表单底部注册链接附近加入按钮，并在登录表单后加入重置表单：

```html
<p class="text-sm text-text-muted dark:text-dark-text-muted">
    忘记密码？<button id="showPasswordResetButton" class="text-primary dark:text-dark-text underline underline-offset-4" type="button">重置密码</button>
</p>
```

```html
<form id="passwordResetForm" class="hidden space-y-5">
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
    <p class="text-sm text-text-muted dark:text-dark-text-muted">
        想起密码了？<button id="showLoginFormButton" class="text-primary dark:text-dark-text underline underline-offset-4" type="button">返回登录</button>
    </p>
</form>
```

- [ ] **Step 3: 修改前端脚本**

在 `shop/shop.js` 中加入：

```js
function normalizeResetCodeInput(input) {
    if (!input) return;
    input.addEventListener('input', () => {
        input.value = input.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 18);
    });
}

function initPasswordResetForm() {
    const loginForm = document.getElementById('loginForm');
    const resetForm = document.getElementById('passwordResetForm');
    const showResetButton = document.getElementById('showPasswordResetButton');
    const showLoginButton = document.getElementById('showLoginFormButton');
    const phoneInput = document.getElementById('resetPhone');
    const codeInput = document.getElementById('resetPasswordCode');
    const passwordInput = document.getElementById('resetNewPassword');
    const confirmInput = document.getElementById('resetConfirmPassword');
    const message = document.getElementById('passwordResetMessage');
    if (!loginForm || !resetForm || !showResetButton || !showLoginButton || !phoneInput || !codeInput || !passwordInput || !confirmInput || !message) return;

    bindPhoneInput(phoneInput);
    normalizeResetCodeInput(codeInput);

    showResetButton.addEventListener('click', () => {
        loginForm.classList.add('hidden');
        resetForm.classList.remove('hidden');
        message.textContent = '';
        phoneInput.focus();
    });

    showLoginButton.addEventListener('click', () => {
        resetForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });

    resetForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const phone = phoneInput.value.trim();
        const code = codeInput.value.trim();
        const password = passwordInput.value;
        const confirmPassword = confirmInput.value;
        if (!isPhone(phone)) {
            message.textContent = '请输入有效的中国大陆手机号。';
            phoneInput.focus();
            return;
        }
        if (!code) {
            message.textContent = '请输入重置码。';
            codeInput.focus();
            return;
        }
        if (!isStrongPassword(password)) {
            message.textContent = '密码至少 8 位，并包含英文大写字母、小写字母和数字。';
            passwordInput.focus();
            return;
        }
        if (password !== confirmPassword) {
            message.textContent = '两次输入的密码不一致。';
            confirmInput.focus();
            return;
        }

        message.textContent = '正在重置密码...';
        try {
            const data = await requestJson('/api/auth/password-reset', {
                method: 'POST',
                body: JSON.stringify({ phone, code, password, confirmPassword })
            });
            window.location.href = data.user?.isAdmin ? '/shop/admin/' : '/shop/account/';
        } catch (error) {
            message.textContent = error.message;
        }
    });
}

function initAdminPasswordResetPage() {
    const form = document.getElementById('passwordResetCodeForm');
    const phoneInput = document.getElementById('passwordResetPhone');
    const message = document.getElementById('passwordResetCodeMessage');
    const result = document.getElementById('passwordResetCodeResult');
    if (!form || !phoneInput || !message || !result) return;

    bindPhoneInput(phoneInput);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const phone = phoneInput.value.trim();
        if (!isPhone(phone)) {
            message.textContent = '请输入有效的中国大陆手机号。';
            phoneInput.focus();
            return;
        }
        message.textContent = '正在生成...';
        result.classList.add('hidden');
        result.innerHTML = '';
        try {
            const data = await requestJson('/api/admin/password-reset-codes', {
                method: 'POST',
                body: JSON.stringify({ phone })
            });
            message.textContent = '重置码已生成，只会显示这一次。';
            result.classList.remove('hidden');
            result.innerHTML = `
                <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">Reset code</p>
                <code class="mt-2 block break-all text-lg font-medium text-primary dark:text-dark-text">${escapeHtml(data.code)}</code>
                <p class="mt-3 text-sm text-text-muted dark:text-dark-text-muted">手机号：${escapeHtml(data.phone)}，有效期至 ${escapeHtml(formatDate(data.expiresAt))}。</p>
            `;
        } catch (error) {
            message.textContent = error.message;
        }
    });
}
```

再修改：

```js
function initLoginPage() {
    ...
    bindPhoneInput(phoneInput);
    initPasswordResetForm();
    ...
}
```

以及：

```js
function initAdminPage() {
    initAdminUsagePage();
    initAdminPasswordResetPage();
    ...
}
```

- [ ] **Step 4: 运行前端静态测试**

Run:

```bash
npm test -- test/shop-flow.test.js
```

Expected: 所有 `shop-flow` 测试通过。

## Task 5: 最终验证和记录

**Files:**
- Create: `docs/ai/context/20260610-101114-shop-password-reset-implementation_CN.md`

- [ ] **Step 1: 运行全部测试**

Run:

```bash
npm test
```

Expected: 全部 Node tests 通过。

- [ ] **Step 2: 如修改样式类不需要重建 CSS**

本实现只使用现有 Tailwind utility class 和已构建 CSS 中已有常见类；如果测试或浏览器检查发现新 class 未生效，再运行：

```bash
npm run build:css
```

Expected: CSS 构建成功；Browserslist 过期提示不视为失败。

- [ ] **Step 3: 记录实现说明**

新建 `docs/ai/context/20260610-101114-shop-password-reset-implementation_CN.md`，包含：

```md
# Shop 忘记密码实现记录

## 实际改动

- 后端新增一次性密码重置码表、管理员生成接口和用户重置接口。
- 管理员页新增手机号生成重置码区域。
- 登录页新增忘记密码入口和重置密码表单。

## 安全边界

- 重置码只存 hash，只返回一次。
- 重置码绑定手机号，一次性使用，30 分钟过期。
- 重置成功后撤销旧 session，并创建新 session。

## 验证

- `npm test`：通过。
```

- [ ] **Step 4: 检查工作区**

Run:

```bash
git status --short
```

Expected: 只包含本次相关文件，以及进入本任务前已经存在的未提交改动；不得回滚用户已有改动。

## 自审

- 设计文档中的管理员生成码、用户登录页重置、一次性使用、30 分钟过期、旧 session 失效、新 session 创建均有任务覆盖。
- 计划没有未决项和占位符。
- 函数命名保持一致：`createPasswordResetCodeForPhone`、`resetPasswordWithCode`、`initPasswordResetForm`、`initAdminPasswordResetPage`。
- 接口错误码保持一致：`INVALID_PHONE`、`USER_NOT_FOUND`、`WEAK_PASSWORD`、`PASSWORD_MISMATCH`、`INVALID_RESET_CODE`、`ADMIN_ACCOUNT_REQUIRED`。
