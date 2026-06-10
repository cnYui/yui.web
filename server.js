const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const express = require('express');
require('dotenv').config();

const durationDays = 31;
const resultCookieName = 'yui_shop_result_token';
const legacyRedeemCookieName = 'yui_shop_redeemed';
const accountCookieName = 'yui_shop_account_session';
const redeemCookieMaxAgeMs = durationDays * 24 * 60 * 60 * 1000;
const accountSessionMaxAgeMs = redeemCookieMaxAgeMs;
const passwordResetCodeMaxAgeMs = 30 * 60 * 1000;
const passwordKeyLength = 64;
const passwordScryptN = 16384;
const passwordScryptR = 8;
const passwordScryptP = 1;
const rateLimitBuckets = new Map();
const chinaOffsetMs = 8 * 60 * 60 * 1000;
const defaultAdminAccountPhone = '15951875192';
const defaultCreditLimitCents = 1000;
const supportedPaymentMethods = new Set(['alipay', 'wechat']);

function toChinaIso(date = new Date()) {
    const value = new Date(date);
    return new Date(value.getTime() + chinaOffsetMs).toISOString().replace('Z', '+08:00');
}

function nowIso(date = new Date()) {
    return toChinaIso(date);
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function isPhone(value) {
    return /^1[3-9]\d{9}$/.test(String(value || '').trim());
}

function createId(prefix) {
    return `${prefix}${Date.now().toString().slice(-8)}${crypto.randomInt(1000, 9999)}`;
}

function createInviteCode() {
    return `YUI-${crypto.randomBytes(3).toString('hex').toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function createApiKey() {
    return `codex_yui_${crypto.randomBytes(24).toString('base64url')}`;
}

function createResultToken() {
    return `rst_${crypto.randomBytes(32).toString('base64url')}`;
}

function createAccountSessionToken() {
    return `usr_${crypto.randomBytes(32).toString('base64url')}`;
}

function createPasswordResetCode() {
    const left = crypto.randomBytes(3).toString('hex').toUpperCase();
    const right = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `RST-${left}-${right}`;
}

function keyPreview(apiKey) {
    if (!apiKey) return '';
    return `${apiKey.slice(0, 12)}...${apiKey.slice(-6)}`;
}

function hashApiKey(apiKey) {
    return crypto.createHash('sha256').update(String(apiKey || '').trim()).digest('hex');
}

function hashSessionToken(token) {
    return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function normalizePasswordResetCode(code) {
    return String(code || '').trim().toUpperCase();
}

function hashPasswordResetCode(code) {
    return crypto.createHash('sha256').update(normalizePasswordResetCode(code)).digest('hex');
}

function validatePassword(password) {
    const value = String(password || '');
    if (value.length < 8) {
        return { ok: false, message: '密码至少 8 位。' };
    }
    if (!/[a-z]/.test(value)) {
        return { ok: false, message: '密码必须包含英文小写字母。' };
    }
    if (!/[A-Z]/.test(value)) {
        return { ok: false, message: '密码必须包含英文大写字母。' };
    }
    if (!/\d/.test(value)) {
        return { ok: false, message: '密码必须包含数字。' };
    }
    return { ok: true, message: '' };
}

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('base64url');
    const hash = crypto.scryptSync(String(password || ''), salt, passwordKeyLength, {
        N: passwordScryptN,
        r: passwordScryptR,
        p: passwordScryptP
    }).toString('base64url');
    return `scrypt$${passwordScryptN}$${passwordScryptR}$${passwordScryptP}$${salt}$${hash}`;
}

function verifyPassword(password, storedHash) {
    const parts = String(storedHash || '').split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const n = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = parts[4];
    const hash = Buffer.from(parts[5], 'base64url');
    if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || !salt || !hash.length) {
        return false;
    }
    try {
        const actual = crypto.scryptSync(String(password || ''), salt, hash.length, { N: n, r, p });
        if (actual.length !== hash.length) return false;
        return crypto.timingSafeEqual(actual, hash);
    } catch (error) {
        return false;
    }
}

function parseCookies(cookieHeader) {
    return String(cookieHeader || '')
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean)
        .reduce((cookies, item) => {
            const separatorIndex = item.indexOf('=');
            if (separatorIndex === -1) return cookies;
            const key = decodeURIComponent(item.slice(0, separatorIndex).trim());
            const value = decodeURIComponent(item.slice(separatorIndex + 1).trim());
            return { ...cookies, [key]: value };
        }, {});
}

function safeEqual(a, b) {
    const left = Buffer.from(String(a || ''));
    const right = Buffer.from(String(b || ''));
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
}

function nonNegativeInteger(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.floor(number);
}

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

function normalizeUsageEvent(body = {}) {
    const inputTokens = nonNegativeInteger(body.input_tokens);
    const outputTokens = nonNegativeInteger(body.output_tokens);
    const reasoningTokens = nonNegativeInteger(body.reasoning_tokens);
    const cachedTokens = nonNegativeInteger(body.cached_tokens);
    let totalTokens = nonNegativeInteger(body.total_tokens);
    if (totalTokens === 0) {
        totalTokens = inputTokens + outputTokens + reasoningTokens;
    }
    const failed = Boolean(body.failed);
    const requestedAt = String(body.requested_at || '').trim();
    return {
        requestId: String(body.request_id || '').trim(),
        apiKeyHash: String(body.api_key_hash || '').trim(),
        apiKeyPreview: String(body.api_key_preview || '').trim(),
        provider: String(body.provider || '').trim(),
        model: String(body.model || '').trim() || 'unknown',
        endpoint: String(body.endpoint || '').trim(),
        source: String(body.source || '').trim(),
        authIndex: String(body.auth_index || '').trim(),
        success: body.success === undefined ? !failed : Boolean(body.success),
        failed,
        inputTokens,
        outputTokens,
        reasoningTokens,
        cachedTokens,
        totalTokens,
        latencyMs: nonNegativeInteger(body.latency_ms),
        requestedAt: requestedAt && !Number.isNaN(new Date(requestedAt).getTime()) ? requestedAt : nowIso()
    };
}

function createRateLimiter({ windowMs, max, code, message }) {
    return (req, res, next) => {
        const now = Date.now();
        const ip = req.ip || req.socket.remoteAddress || 'unknown';
        const key = `${req.method}:${req.path}:${ip}`;
        const bucket = rateLimitBuckets.get(key);
        if (!bucket || bucket.resetAt <= now) {
            rateLimitBuckets.set(key, { count: 1, resetAt: now + windowMs });
            return next();
        }
        if (bucket.count >= max) {
            res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
            return res.status(429).json({ code, message });
        }
        bucket.count += 1;
        return next();
    };
}

function openShopDatabase(dbPath) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(`
CREATE TABLE IF NOT EXISTS users (
  phone TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invite_codes (
  code TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('unused', 'redeemed', 'disabled')),
  created_at TEXT NOT NULL,
  redeemed_at TEXT,
  redeemed_by_phone TEXT,
  order_id TEXT
);

CREATE TABLE IF NOT EXISTS api_keys (
  api_key TEXT PRIMARY KEY,
  api_key_preview TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('unused', 'used', 'disabled')),
  created_at TEXT NOT NULL,
  used_at TEXT,
  order_id TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  api_key TEXT NOT NULL UNIQUE,
  api_key_preview TEXT NOT NULL,
  product_name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  redeemed_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  FOREIGN KEY (phone) REFERENCES users(phone)
);
`);
    const userColumns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name);
    if (!userColumns.includes('password_hash')) {
        db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT;`);
    }
    if (!userColumns.includes('password_created_at')) {
        db.exec(`ALTER TABLE users ADD COLUMN password_created_at TEXT;`);
    }
    if (!userColumns.includes('updated_at')) {
        db.exec(`ALTER TABLE users ADD COLUMN updated_at TEXT;`);
    }
    db.exec(`
CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  FOREIGN KEY (phone) REFERENCES users(phone)
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_phone
ON user_sessions(phone);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expires
ON user_sessions(expires_at);

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
`);
    const inviteColumns = db.prepare('PRAGMA table_info(invite_codes)').all().map((column) => column.name);
    if (inviteColumns.includes('api_key')) {
        db.exec(`
CREATE TABLE IF NOT EXISTS invite_codes_next (
  code TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('unused', 'redeemed', 'disabled')),
  created_at TEXT NOT NULL,
  redeemed_at TEXT,
  redeemed_by_phone TEXT,
  order_id TEXT
);
INSERT OR IGNORE INTO api_keys (api_key, api_key_preview, status, created_at, used_at, order_id)
SELECT api_key, api_key_preview,
       CASE WHEN status = 'redeemed' THEN 'used' ELSE 'unused' END,
       created_at, redeemed_at, order_id
FROM invite_codes
WHERE api_key IS NOT NULL;
INSERT OR IGNORE INTO invite_codes_next (code, status, created_at, redeemed_at, redeemed_by_phone, order_id)
SELECT code, status, created_at, redeemed_at, redeemed_by_phone, order_id
FROM invite_codes;
DROP TABLE invite_codes;
ALTER TABLE invite_codes_next RENAME TO invite_codes;
`);
    }
    const apiKeyColumns = db.prepare('PRAGMA table_info(api_keys)').all().map((column) => column.name);
    if (!apiKeyColumns.includes('api_key_hash')) {
        db.exec(`ALTER TABLE api_keys ADD COLUMN api_key_hash TEXT;`);
    }
    const missingHashRows = db.prepare(`
SELECT api_key
FROM api_keys
WHERE api_key_hash IS NULL OR api_key_hash = ''
`).all();
    const updateApiKeyHash = db.prepare(`
UPDATE api_keys
SET api_key_hash = ?
WHERE api_key = ?
`);
    const backfillApiKeyHashes = db.transaction((rows) => {
        for (const row of rows) {
            updateApiKeyHash.run(hashApiKey(row.api_key), row.api_key);
        }
    });
    backfillApiKeyHashes(missingHashRows);
    db.exec(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash_unique
ON api_keys(api_key_hash)
WHERE api_key_hash IS NOT NULL;
`);
    const orderColumns = db.prepare('PRAGMA table_info(orders)').all().map((column) => column.name);
    if (!orderColumns.includes('invite_code')) {
        db.exec(`ALTER TABLE orders ADD COLUMN invite_code TEXT;`);
    }
    if (!orderColumns.includes('result_token')) {
        db.exec(`ALTER TABLE orders ADD COLUMN result_token TEXT;`);
    }
    db.exec(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_result_token_unique
ON orders(result_token)
WHERE result_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS usage_events (
  request_id TEXT PRIMARY KEY,
  api_key_hash TEXT NOT NULL,
  api_key_preview TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT 'unknown',
  endpoint TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  auth_index TEXT NOT NULL DEFAULT '',
  success INTEGER NOT NULL DEFAULT 1,
  failed INTEGER NOT NULL DEFAULT 0,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  cached_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  requested_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  price_amount_micros INTEGER,
  price_currency TEXT
);

CREATE INDEX IF NOT EXISTS idx_usage_events_key_time
ON usage_events(api_key_hash, requested_at);

CREATE INDEX IF NOT EXISTS idx_usage_events_model_time
ON usage_events(model, requested_at);

CREATE TABLE IF NOT EXISTS usage_key_profiles (
  api_key_hash TEXT PRIMARY KEY,
  api_key_preview TEXT NOT NULL DEFAULT '',
  group_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_key_profiles_group
ON usage_key_profiles(group_name);

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
`);
    return db;
}

function createShopApp(options = {}) {
    rateLimitBuckets.clear();
    const rootDir = options.rootDir || __dirname;
    const dbPath = options.dbPath || path.join(rootDir, 'data', 'shop.sqlite');
    const db = options.db || openShopDatabase(dbPath);
    const app = express();
    app.disable('x-powered-by');
    app.set('trust proxy', 1);
    const product = {
        name: options.productName || process.env.PRODUCT_NAME || 'Codex 每月额度',
        amount: Number(options.productAmount || process.env.PRODUCT_AMOUNT_CNY || 30)
    };
    const adminAccountPhone = String(options.adminAccountPhone ?? process.env.SHOP_ADMIN_PHONE ?? defaultAdminAccountPhone).trim();
    const configuredCreditLimitCents = Number(options.defaultCreditLimitCents ?? process.env.SHOP_DEFAULT_CREDIT_LIMIT_CENTS ?? defaultCreditLimitCents);
    const creditLimitCents = Number.isSafeInteger(configuredCreditLimitCents) && configuredCreditLimitCents >= 0
        ? configuredCreditLimitCents
        : defaultCreditLimitCents;

    function toOrder(row) {
        return {
            id: row.id,
            phone: row.phone,
            productName: row.product_name,
            amount: row.amount,
            apiKey: row.api_key,
            apiKeyPreview: row.api_key_preview,
            redeemedAt: row.redeemed_at,
            expiresAt: row.expires_at,
            resultToken: row.result_token || ''
        };
    }

    function toInvite(row) {
        return {
            code: row.code,
            status: row.status,
            createdAt: row.created_at,
            redeemedAt: row.redeemed_at || '',
            phone: row.redeemed_by_phone || '',
            orderId: row.order_id || ''
        };
    }

    function getOrderStatus(order) {
        return new Date(order.expiresAt).getTime() > Date.now() ? 'active' : 'expired';
    }

    function publicOrder(order, opts = {}) {
        return {
            id: order.id,
            phone: order.phone,
            productName: order.productName,
            amount: order.amount,
            apiKey: opts.includeApiKey ? order.apiKey : '',
            apiKeyPreview: order.apiKeyPreview,
            status: getOrderStatus(order),
            redeemedAt: order.redeemedAt,
            expiresAt: order.expiresAt
        };
    }

    function publicInvite(invite) {
        return {
            code: invite.code,
            status: invite.status,
            apiKeyPreview: invite.apiKeyPreview,
            phone: invite.phone,
            orderId: invite.orderId,
            createdAt: invite.createdAt,
            redeemedAt: invite.redeemedAt
        };
    }

    function publicUsageKeyProfile(profile) {
        return {
            apiKeyHash: profile.api_key_hash,
            apiKeyPreview: profile.api_key_preview || '',
            group: profile.group_name,
            phone: profile.phone || ''
        };
    }

    function isAdminAccountPhone(phone) {
        return Boolean(adminAccountPhone && String(phone || '').trim() === adminAccountPhone);
    }

    function publicUser(phone) {
        return {
            phone,
            isAdmin: isAdminAccountPhone(phone)
        };
    }

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

    function accountDestination(phone) {
        return isAdminAccountPhone(phone) ? '/shop/admin/' : '/shop/account/';
    }

    function requireAdminToken(req, res, next) {
        const expected = options.adminToken ?? process.env.ADMIN_TOKEN;
        const actual = req.header('x-admin-token');
        if (!expected) {
            return res.status(503).json({
                code: 'ADMIN_TOKEN_NOT_CONFIGURED',
                message: '请先在 .env 中配置 ADMIN_TOKEN。'
            });
        }
        if (!actual || !safeEqual(actual, expected)) {
            return res.status(401).json({ code: 'UNAUTHORIZED', message: '管理员 token 无效。' });
        }
        return next();
    }

    function requireAdminUsageAccess(req, res, next) {
        const actual = req.header('x-admin-token');
        if (actual) {
            return requireAdminToken(req, res, next);
        }
        const session = getCurrentAccountSession(req);
        if (session && isAdminAccountPhone(session.phone)) {
            req.account = { phone: session.phone };
            return next();
        }
        if (session) {
            return res.status(403).json({
                code: 'ADMIN_ACCOUNT_REQUIRED',
                message: '当前账号没有管理员权限。'
            });
        }
        const expected = options.adminToken ?? process.env.ADMIN_TOKEN;
        if (!expected) {
            return res.status(503).json({
                code: 'ADMIN_TOKEN_NOT_CONFIGURED',
                message: '请先在 .env 中配置 ADMIN_TOKEN。'
            });
        }
        return res.status(401).json({ code: 'UNAUTHORIZED', message: '请先登录管理员账号或提供管理员 token。' });
    }

    function requireAdminAccount(req, res, next) {
        const session = getCurrentAccountSession(req);
        if (session && isAdminAccountPhone(session.phone)) {
            req.account = { phone: session.phone };
            return next();
        }
        if (session) {
            return res.status(403).json({
                code: 'ADMIN_ACCOUNT_REQUIRED',
                message: '当前账号没有管理员权限。'
            });
        }
        return res.status(401).json({ code: 'UNAUTHORIZED', message: '请先登录管理员账号。' });
    }

    function requireInternal(req, res, next) {
        const expected = options.internalToken ?? process.env.INTERNAL_TOKEN;
        const actual = req.header('x-internal-token');
        if (!expected) {
            return res.status(503).json({
                code: 'INTERNAL_TOKEN_NOT_CONFIGURED',
                message: '请先在 .env 中配置 INTERNAL_TOKEN。'
            });
        }
        if (!actual || !safeEqual(actual, expected)) {
            return res.status(401).json({ code: 'UNAUTHORIZED', message: '内部 token 无效。' });
        }
        return next();
    }

    function blockSensitiveStaticPaths(req, res, next) {
        const requestPath = decodeURIComponent(req.path || '/');
        const normalizedPath = path.posix.normalize(requestPath);
        const blockedPrefixes = [
            '/data',
            '/.env',
            '/.git',
            '/node_modules',
            '/pids',
            '/tmp',
            '/temp',
            '/docs/ai'
        ];
        if (blockedPrefixes.some((prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`))) {
            return res.status(404).sendFile(path.join(rootDir, '404.html'));
        }
        return next();
    }

    function setSecurityHeaders(req, res, next) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'same-origin');
        if (req.path.startsWith('/api/')) {
            res.setHeader('Cache-Control', 'no-store');
        }
        return next();
    }

    const limitAdminApi = createRateLimiter({
        windowMs: 10 * 60 * 1000,
        max: 30,
        code: 'ADMIN_RATE_LIMITED',
        message: '管理员接口请求过于频繁，请稍后再试。'
    });
    const limitRedeemApi = createRateLimiter({
        windowMs: 10 * 60 * 1000,
        max: 20,
        code: 'REDEEM_RATE_LIMITED',
        message: '兑换请求过于频繁，请稍后再试。'
    });
    const limitQueryApi = createRateLimiter({
        windowMs: 10 * 60 * 1000,
        max: 60,
        code: 'QUERY_RATE_LIMITED',
        message: '查询请求过于频繁，请稍后再试。'
    });
    const limitAuthApi = createRateLimiter({
        windowMs: 10 * 60 * 1000,
        max: 30,
        code: 'AUTH_RATE_LIMITED',
        message: '登录或注册请求过于频繁，请稍后再试。'
    });

    function cookieOptions(req) {
        return {
            httpOnly: true,
            sameSite: 'lax',
            secure: req.secure || req.header('x-forwarded-proto') === 'https',
            maxAge: redeemCookieMaxAgeMs,
            path: '/'
        };
    }

    function accountCookieOptions(req) {
        return {
            httpOnly: true,
            sameSite: 'lax',
            secure: req.secure || req.header('x-forwarded-proto') === 'https',
            maxAge: accountSessionMaxAgeMs,
            path: '/'
        };
    }

    function clearResultCookies(res) {
        res.clearCookie(resultCookieName, { path: '/' });
        res.clearCookie(legacyRedeemCookieName, { path: '/shop' });
    }

    function clearAccountCookie(res) {
        res.clearCookie(accountCookieName, { path: '/' });
    }

    function getResultToken(req) {
        const cookies = parseCookies(req.header('cookie'));
        return String(cookies[resultCookieName] || '').trim();
    }

    function getAccountSessionToken(req) {
        const cookies = parseCookies(req.header('cookie'));
        return String(cookies[accountCookieName] || '').trim();
    }

    function requireResultToken(req, res, next) {
        const token = getResultToken(req);
        if (token && getOrderByResultToken.get(token)) {
            return next();
        }
        return res.redirect(302, '/shop/redeem/');
    }

    const insertInvite = db.prepare(`
INSERT INTO invite_codes (code, status, created_at)
VALUES (@code, 'unused', @createdAt)
`);

    const listInvites = db.prepare(`
SELECT code, status, created_at, redeemed_at, redeemed_by_phone, order_id
FROM invite_codes
ORDER BY created_at DESC
`);

    const getInvite = db.prepare(`
SELECT code, status, created_at, redeemed_at, redeemed_by_phone, order_id
FROM invite_codes
WHERE code = ?
`);

    const insertApiKey = db.prepare(`
INSERT INTO api_keys (api_key, api_key_preview, api_key_hash, status, created_at)
VALUES (?, ?, ?, 'unused', ?)
`);

    const getApiKey = db.prepare(`
SELECT api_key, api_key_preview, status, created_at, used_at, order_id
FROM api_keys
WHERE api_key = ?
`);

    const getNextUnusedApiKey = db.prepare(`
SELECT api_key, api_key_preview, status, created_at, used_at, order_id
FROM api_keys
WHERE status = 'unused'
ORDER BY created_at ASC, api_key ASC
LIMIT 1
`);

    const markApiKeyUsed = db.prepare(`
UPDATE api_keys
SET status = 'used',
    used_at = @usedAt,
    order_id = @orderId
WHERE api_key = @apiKey AND status = 'unused'
`);

    const ensureUser = db.prepare(`
INSERT INTO users (phone, created_at)
VALUES (?, ?)
ON CONFLICT(phone) DO NOTHING
`);

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

    const getUserByPhone = db.prepare(`
SELECT phone, created_at, password_hash, password_created_at, updated_at
FROM users
WHERE phone = ?
`);

    const insertUserWithPassword = db.prepare(`
INSERT INTO users (phone, created_at, password_hash, password_created_at, updated_at)
VALUES (?, ?, ?, ?, ?)
`);

    const setUserPassword = db.prepare(`
UPDATE users
SET password_hash = ?,
    password_created_at = ?,
    updated_at = ?
WHERE phone = ?
`);

    const insertAccountSession = db.prepare(`
INSERT INTO user_sessions (token_hash, phone, created_at, expires_at)
VALUES (?, ?, ?, ?)
`);

    const getAccountSessionByHash = db.prepare(`
SELECT token_hash, phone, created_at, expires_at, revoked_at
FROM user_sessions
WHERE token_hash = ?
`);

    const revokeAccountSession = db.prepare(`
UPDATE user_sessions
SET revoked_at = ?
WHERE token_hash = ? AND revoked_at IS NULL
`);

    const revokeAccountSessionsByPhone = db.prepare(`
UPDATE user_sessions
SET revoked_at = ?
WHERE phone = ? AND revoked_at IS NULL
`);

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

    const insertOrder = db.prepare(`
INSERT INTO orders (id, phone, invite_code, api_key, api_key_preview, product_name, amount, redeemed_at, expires_at, result_token)
VALUES (@id, @phone, @inviteCode, @apiKey, @apiKeyPreview, @productName, @amount, @redeemedAt, @expiresAt, @resultToken)
`);

    const markInviteRedeemed = db.prepare(`
UPDATE invite_codes
SET status = 'redeemed',
    redeemed_at = @redeemedAt,
    redeemed_by_phone = @phone,
    order_id = @orderId
WHERE code = @code
`);

    const listOrdersByPhone = db.prepare(`
SELECT id, phone, api_key, api_key_preview, product_name, amount, redeemed_at, expires_at, result_token
FROM orders
WHERE phone = ?
ORDER BY redeemed_at DESC
`);

    const getOrderByResultToken = db.prepare(`
SELECT id, phone, api_key, api_key_preview, product_name, amount, redeemed_at, expires_at, result_token
FROM orders
WHERE result_token = ?
`);

    const getOrderByApiKey = db.prepare(`
SELECT id, phone, api_key, api_key_preview, product_name, amount, redeemed_at, expires_at, result_token
FROM orders
WHERE api_key = ?
`);

    const insertUsageEvent = db.prepare(`
INSERT OR IGNORE INTO usage_events (
  request_id, api_key_hash, api_key_preview, provider, model, endpoint, source, auth_index,
  success, failed, input_tokens, output_tokens, reasoning_tokens, cached_tokens, total_tokens,
  latency_ms, requested_at, received_at
)
VALUES (
  @requestId, @apiKeyHash, @apiKeyPreview, @provider, @model, @endpoint, @source, @authIndex,
  @success, @failed, @inputTokens, @outputTokens, @reasoningTokens, @cachedTokens, @totalTokens,
  @latencyMs, @requestedAt, @receivedAt
)
`);

    const listUsageEvents = db.prepare(`
SELECT request_id, api_key_hash, api_key_preview, provider, model, endpoint, source, auth_index,
       success, failed, input_tokens, output_tokens, reasoning_tokens, cached_tokens, total_tokens,
       latency_ms, requested_at, received_at
FROM usage_events
ORDER BY requested_at DESC
`);

    const listUsageKeyProfiles = db.prepare(`
SELECT api_key_hash, api_key_preview, group_name, phone, created_at, updated_at
FROM usage_key_profiles
`);

    const upsertUsageKeyProfile = db.prepare(`
INSERT INTO usage_key_profiles (api_key_hash, api_key_preview, group_name, phone, created_at, updated_at)
VALUES (@apiKeyHash, @apiKeyPreview, @groupName, @phone, @now, @now)
ON CONFLICT(api_key_hash) DO UPDATE SET
  api_key_preview = excluded.api_key_preview,
  group_name = excluded.group_name,
  phone = excluded.phone,
  updated_at = excluded.updated_at
`);

    const listApiKeysForUsage = db.prepare(`
SELECT ak.api_key_hash, ak.api_key_preview, ak.status AS key_status, ak.created_at, ak.used_at,
       o.phone, o.redeemed_at, o.expires_at
FROM api_keys ak
LEFT JOIN orders o ON o.api_key = ak.api_key
WHERE ak.api_key_hash IS NOT NULL AND ak.api_key_hash != ''
ORDER BY ak.created_at DESC, ak.api_key_preview ASC
`);

    const createInvites = db.transaction((count) => {
        const created = [];
        for (let index = 0; index < count; index += 1) {
            let code = createInviteCode();
            while (getInvite.get(code)) {
                code = createInviteCode();
            }
            const invite = {
                code,
                createdAt: nowIso()
            };
            insertInvite.run(invite);
            created.push({
                code: invite.code
            });
        }
        return created;
    });

    const importApiKeys = db.transaction((apiKeys) => {
        const imported = [];
        for (const apiKey of apiKeys) {
            if (getApiKey.get(apiKey)) {
                const error = new Error('API key 已存在。');
                error.status = 409;
                error.code = 'API_KEY_EXISTS';
                throw error;
            }
            const apiKeyPreview = keyPreview(apiKey);
            insertApiKey.run(apiKey, apiKeyPreview, hashApiKey(apiKey), nowIso());
            imported.push({ apiKeyPreview, status: 'unused' });
        }
        return imported;
    });

    const redeemInvite = db.transaction(({ phone, code }) => {
        const row = getInvite.get(code);
        const invite = row ? toInvite(row) : null;
        if (!invite) {
            const error = new Error('邀请码不存在。');
            error.status = 404;
            error.code = 'INVITE_NOT_FOUND';
            throw error;
        }
        if (invite.status !== 'unused') {
            const error = new Error('该邀请码已经被兑换。');
            error.status = 409;
            error.code = 'INVITE_USED';
            throw error;
        }

        const apiKeyRow = getNextUnusedApiKey.get();
        if (!apiKeyRow) {
            const error = new Error('当前没有可用的 API key。');
            error.status = 409;
            error.code = 'NO_AVAILABLE_API_KEY';
            throw error;
        }

        const redeemedAt = new Date();
        let resultToken = createResultToken();
        while (getOrderByResultToken.get(resultToken)) {
            resultToken = createResultToken();
        }
        const order = {
            id: createId('ORDER'),
            phone,
            inviteCode: invite.code,
            productName: product.name,
            amount: product.amount,
            apiKey: apiKeyRow.api_key,
            apiKeyPreview: apiKeyRow.api_key_preview,
            redeemedAt: nowIso(redeemedAt),
            expiresAt: nowIso(addDays(redeemedAt, durationDays)),
            resultToken
        };

        ensureUser.run(phone, nowIso());
        insertOrder.run(order);
        markApiKeyUsed.run({
            apiKey: order.apiKey,
            usedAt: order.redeemedAt,
            orderId: order.id
        });
        markInviteRedeemed.run({
            code,
            phone,
            orderId: order.id,
            redeemedAt: order.redeemedAt
        });

        return order;
    });

    const registerUser = db.transaction(({ phone, password }) => {
        const now = nowIso();
        const existing = getUserByPhone.get(phone);
        if (existing?.password_hash) {
            const error = new Error('该手机号已经注册。');
            error.status = 409;
            error.code = 'USER_EXISTS';
            throw error;
        }
        const passwordHash = hashPassword(password);
        if (!existing) {
            insertUserWithPassword.run(phone, now, passwordHash, now, now);
            return { phone };
        }
        setUserPassword.run(passwordHash, now, now, phone);
        return { phone };
    });

    function loginUser({ phone, password }) {
        const user = getUserByPhone.get(phone);
        if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
            const error = new Error('手机号或密码错误。');
            error.status = 401;
            error.code = 'INVALID_CREDENTIALS';
            throw error;
        }
        return { phone: user.phone };
    }

    function createAccountSessionForPhone(phone) {
        const createdAt = new Date();
        let token = createAccountSessionToken();
        while (getAccountSessionByHash.get(hashSessionToken(token))) {
            token = createAccountSessionToken();
        }
        insertAccountSession.run(
            hashSessionToken(token),
            phone,
            nowIso(createdAt),
            nowIso(addDays(createdAt, durationDays))
        );
        return token;
    }

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

    function getCurrentAccountSession(req) {
        const token = getAccountSessionToken(req);
        if (!token) return null;
        const row = getAccountSessionByHash.get(hashSessionToken(token));
        if (!row || row.revoked_at) return null;
        const expiresAt = new Date(row.expires_at).getTime();
        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
        return row;
    }

    function requireAccount(req, res, next) {
        const session = getCurrentAccountSession(req);
        if (!session) {
            return res.status(401).json({
                code: 'ACCOUNT_LOGIN_REQUIRED',
                message: '请先登录。'
            });
        }
        req.account = { phone: session.phone };
        return next();
    }

    function requireAccountPage(req, res, next) {
        const session = getCurrentAccountSession(req);
        if (!session) {
            return res.redirect(302, '/shop/login/');
        }
        req.account = { phone: session.phone };
        return next();
    }

    function redirectLoggedInAccount(req, res, next) {
        const session = getCurrentAccountSession(req);
        if (session) {
            return res.redirect(302, accountDestination(session.phone));
        }
        return next();
    }

    function requireAdminPage(req, res, next) {
        const session = getCurrentAccountSession(req);
        if (!session) {
            return res.redirect(302, '/shop/login/');
        }
        if (!isAdminAccountPhone(session.phone)) {
            return res.status(403).send('当前账号没有管理员权限。');
        }
        req.account = { phone: session.phone };
        return next();
    }

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
        if (!isShopHtmlPagePath(requestPath) || shopPublicPagePaths.has(requestPath)) {
            return next();
        }
        return requireAccountPage(req, res, next);
    }

    function verifyUsageSignature(req) {
        const secret = options.usageEventHmacSecret ?? process.env.USAGE_EVENT_HMAC_SECRET;
        if (!secret) {
            return { ok: false, status: 503, code: 'USAGE_EVENT_HMAC_NOT_CONFIGURED', message: '请先配置 USAGE_EVENT_HMAC_SECRET。' };
        }
        const timestamp = String(req.header('x-usage-timestamp') || '').trim();
        const signature = String(req.header('x-usage-signature') || '').trim();
        if (!timestamp || !signature) {
            return { ok: false, status: 401, code: 'USAGE_EVENT_SIGNATURE_REQUIRED', message: '缺少 usage event 签名。' };
        }
        const timestampSeconds = Number(timestamp);
        if (!Number.isFinite(timestampSeconds)) {
            return { ok: false, status: 401, code: 'USAGE_EVENT_TIMESTAMP_INVALID', message: 'usage event timestamp 无效。' };
        }
        const nowSeconds = Math.floor(Date.now() / 1000);
        if (Math.abs(nowSeconds - timestampSeconds) > 300) {
            return { ok: false, status: 401, code: 'USAGE_EVENT_TIMESTAMP_EXPIRED', message: 'usage event timestamp 已过期。' };
        }
        const rawBody = req.rawBody || Buffer.from('');
        const expected = crypto.createHmac('sha256', secret).update(`${timestamp}\n`).update(rawBody).digest('hex');
        if (!safeEqual(signature, expected)) {
            return { ok: false, status: 401, code: 'USAGE_EVENT_SIGNATURE_INVALID', message: 'usage event 签名无效。' };
        }
        return { ok: true };
    }

    function storeUsageEvent(body) {
        const event = normalizeUsageEvent(body);
        if (!event.requestId) {
            const error = new Error('缺少 request_id。');
            error.status = 400;
            error.code = 'INVALID_USAGE_EVENT';
            throw error;
        }
        if (!event.apiKeyHash) {
            const error = new Error('缺少 api_key_hash。');
            error.status = 400;
            error.code = 'INVALID_USAGE_EVENT';
            throw error;
        }
        event.receivedAt = nowIso();
        event.success = event.success ? 1 : 0;
        event.failed = event.failed ? 1 : 0;
        const result = insertUsageEvent.run(event);
        return result.changes > 0 ? { inserted: 1, skipped: 0 } : { inserted: 0, skipped: 1 };
    }

    function emptyUsageStats() {
        return {
            today_tokens: 0,
            month_tokens: 0,
            total_tokens: 0,
            today_requests: 0,
            month_requests: 0,
            success_requests: 0,
            failed_requests: 0,
            total_requests: 0,
            last_seen_at: '',
            modelsByName: new Map()
        };
    }

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

    function addUsageStats(stats, row, ranges) {
        const requestedAt = new Date(row.requested_at);
        const isToday = requestedAt >= ranges.todayStart;
        const isMonth = requestedAt >= ranges.monthStart;
        const totalTokens = nonNegativeInteger(row.total_tokens);
        stats.total_tokens += totalTokens;
        stats.total_requests += 1;
        if (isToday) {
            stats.today_tokens += totalTokens;
            stats.today_requests += 1;
        }
        if (isMonth) {
            stats.month_tokens += totalTokens;
            stats.month_requests += 1;
        }
        if (row.failed) {
            stats.failed_requests += 1;
        } else {
            stats.success_requests += 1;
        }
        if (!stats.last_seen_at || new Date(stats.last_seen_at) < requestedAt) {
            stats.last_seen_at = row.requested_at;
        }

        const model = row.model || 'unknown';
        const modelStats = stats.modelsByName.get(model) || {
            model,
            month_tokens: 0,
            total_tokens: 0,
            total_requests: 0
        };
        modelStats.total_tokens += totalTokens;
        modelStats.total_requests += 1;
        if (isMonth) {
            modelStats.month_tokens += totalTokens;
        }
        stats.modelsByName.set(model, modelStats);
    }

    function usageStatsToPublic(stats) {
        return {
            today_tokens: stats.today_tokens,
            month_tokens: stats.month_tokens,
            total_tokens: stats.total_tokens,
            today_requests: stats.today_requests,
            month_requests: stats.month_requests,
            success_requests: stats.success_requests,
            failed_requests: stats.failed_requests,
            total_requests: stats.total_requests,
            last_seen_at: stats.last_seen_at,
            models: Array.from(stats.modelsByName.values()).sort((left, right) => right.total_tokens - left.total_tokens)
        };
    }

    function getUsageStatus(row) {
        if (!row) return 'unmanaged';
        if (row.key_status === 'disabled') return 'disabled';
        if (!row.phone) return row.key_status || 'unused';
        return new Date(row.expires_at).getTime() > Date.now() ? 'active' : 'expired';
    }

    function normalizeUsageKeyProfile(body = {}) {
        const apiKeyHash = String(body.apiKeyHash || body.api_key_hash || '').trim().toLowerCase();
        const apiKeyPreview = String(body.apiKeyPreview || body.api_key_preview || '').trim();
        const groupName = String(body.group || body.groupName || body.group_name || '').trim().toLowerCase();
        const phone = String(body.phone || '').trim();
        if (!/^[a-f0-9]{64}$/.test(apiKeyHash)) {
            const error = new Error('API key hash 无效。');
            error.status = 400;
            error.code = 'INVALID_API_KEY_HASH';
            throw error;
        }
        if (groupName !== 'local') {
            const error = new Error('usage key 分组无效。');
            error.status = 400;
            error.code = 'INVALID_USAGE_KEY_GROUP';
            throw error;
        }
        if (!isPhone(phone)) {
            const error = new Error('请输入有效的中国大陆手机号。');
            error.status = 400;
            error.code = 'INVALID_PHONE';
            throw error;
        }
        return { apiKeyHash, apiKeyPreview, groupName, phone };
    }

    function saveUsageKeyProfile(body) {
        const profile = normalizeUsageKeyProfile(body);
        upsertUsageKeyProfile.run({ ...profile, now: nowIso() });
        return {
            api_key_hash: profile.apiKeyHash,
            api_key_preview: profile.apiKeyPreview,
            group_name: profile.groupName,
            phone: profile.phone
        };
    }

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
            if (!hourlyByBucket.has(hourKey)) {
                hourlyByBucket.set(hourKey, { bucket: hourKey, ...emptyAccountTokenStats() });
            }
            addAccountTokenStats(hourlyByBucket.get(hourKey), row);

            const dayKey = chinaDateKey(requestedAt);
            if (!dailyByBucket.has(dayKey)) {
                dailyByBucket.set(dayKey, { bucket: dayKey, ...emptyAccountTokenStats() });
            }
            addAccountTokenStats(dailyByBucket.get(dayKey), row);

            const modelName = row.model || 'unknown';
            if (!byModel.has(modelName)) {
                byModel.set(modelName, { model: modelName, totalTokens: 0, requests: 0 });
            }
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

    function buildUsageSummary(filters = {}) {
        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const ranges = { todayStart, monthStart };
        const statsByHash = new Map();
        const summaryStats = emptyUsageStats();
        const profilesByHash = new Map(listUsageKeyProfiles.all().map((profile) => [profile.api_key_hash, profile]));

        for (const row of listUsageEvents.all()) {
            const hash = row.api_key_hash;
            if (!statsByHash.has(hash)) {
                statsByHash.set(hash, emptyUsageStats());
            }
            addUsageStats(statsByHash.get(hash), row, ranges);
            addUsageStats(summaryStats, row, ranges);
        }

        const items = [];
        const seenHashes = new Set();
        for (const row of listApiKeysForUsage.all()) {
            seenHashes.add(row.api_key_hash);
            const stats = statsByHash.get(row.api_key_hash) || emptyUsageStats();
            const status = getUsageStatus(row);
            items.push({
                group: 'shop',
                phone: row.phone || '',
                api_key_preview: row.api_key_preview || '',
                status,
                redeemed_at: row.redeemed_at || '',
                expires_at: row.expires_at || '',
                ...usageStatsToPublic(stats)
            });
        }
        for (const row of listUsageEvents.all()) {
            if (seenHashes.has(row.api_key_hash)) continue;
            seenHashes.add(row.api_key_hash);
            const stats = statsByHash.get(row.api_key_hash) || emptyUsageStats();
            const profile = profilesByHash.get(row.api_key_hash);
            const groupName = profile?.group_name || 'unmanaged';
            items.push({
                group: groupName,
                phone: profile?.phone || '',
                api_key_preview: profile?.api_key_preview || row.api_key_preview || '',
                status: groupName === 'local' ? 'local' : 'unmanaged',
                redeemed_at: '',
                expires_at: '',
                ...usageStatsToPublic(stats)
            });
        }

        const group = String(filters.group || 'all');
        const status = String(filters.status || 'all');
        const q = String(filters.q || '').trim().toLowerCase();
        const filteredItems = items
            .filter((item) => group === 'all' || item.group === group)
            .filter((item) => status === 'all' || item.status === status)
            .filter((item) => {
                if (!q) return true;
                return [item.phone, item.api_key_preview, item.status, item.group].some((value) => String(value || '').toLowerCase().includes(q));
            })
            .sort((left, right) => {
                if (right.total_tokens !== left.total_tokens) return right.total_tokens - left.total_tokens;
                return String(right.last_seen_at || '').localeCompare(String(left.last_seen_at || ''));
            });

        return {
            summary: {
                today_tokens: summaryStats.today_tokens,
                month_tokens: summaryStats.month_tokens,
                total_tokens: summaryStats.total_tokens,
                today_requests: summaryStats.today_requests,
                month_requests: summaryStats.month_requests,
                total_requests: summaryStats.total_requests,
                failed_requests: summaryStats.failed_requests
            },
            items: filteredItems
        };
    }

    function importUsageEvents(month) {
        const normalizedMonth = String(month || '').trim();
        if (!/^\d{4}-\d{2}$/.test(normalizedMonth)) {
            const error = new Error('月份格式必须是 YYYY-MM。');
            error.status = 400;
            error.code = 'INVALID_USAGE_IMPORT_MONTH';
            throw error;
        }
        const configuredDir = options.cliproxyUsageLogDir ?? process.env.CLIPROXY_USAGE_LOG_DIR;
        if (!configuredDir) {
            const error = new Error('请先配置 CLIPROXY_USAGE_LOG_DIR。');
            error.status = 503;
            error.code = 'USAGE_LOG_DIR_NOT_CONFIGURED';
            throw error;
        }
        const baseDir = path.resolve(configuredDir);
        const filePath = path.resolve(baseDir, `usage-events-${normalizedMonth}.jsonl`);
        const relativePath = path.relative(baseDir, filePath);
        if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
            const error = new Error('usage log 路径无效。');
            error.status = 400;
            error.code = 'INVALID_USAGE_IMPORT_PATH';
            throw error;
        }
        if (!fs.existsSync(filePath)) {
            const error = new Error('没有找到该月份的 usage JSONL。');
            error.status = 404;
            error.code = 'USAGE_IMPORT_FILE_NOT_FOUND';
            throw error;
        }

        const result = { month: normalizedMonth, inserted: 0, skipped: 0, failed_lines: 0 };
        const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
                const parsed = JSON.parse(trimmed);
                const stored = storeUsageEvent(parsed);
                result.inserted += stored.inserted;
                result.skipped += stored.skipped;
            } catch (error) {
                result.failed_lines += 1;
            }
        }
        return result;
    }

    app.use(express.json({
        verify: (req, res, buffer) => {
            req.rawBody = Buffer.from(buffer);
        }
    }));
    app.use(express.urlencoded({ extended: false }));
    app.use(setSecurityHeaders);

    app.post('/api/auth/register', limitAuthApi, (req, res) => {
        const phone = String(req.body.phone || '').trim();
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
        if (isAdminAccountPhone(phone)) {
            return res.status(403).json({
                code: 'ADMIN_ACCOUNT_REGISTRATION_DISABLED',
                message: '管理员账号不能通过公开注册创建。'
            });
        }

        try {
            const user = registerUser({ phone, password });
            const token = createAccountSessionForPhone(user.phone);
            res.cookie(accountCookieName, token, accountCookieOptions(req));
            return res.status(201).json({ user: publicUser(user.phone) });
        } catch (error) {
            return res.status(error.status || 500).json({
                code: error.code || 'REGISTER_FAILED',
                message: error.message || '注册失败。'
            });
        }
    });

    app.post('/api/auth/login', limitAuthApi, (req, res) => {
        const phone = String(req.body.phone || '').trim();
        const password = String(req.body.password || '');
        if (!isPhone(phone)) {
            return res.status(400).json({ code: 'INVALID_PHONE', message: '请输入有效的中国大陆手机号。' });
        }

        try {
            const user = loginUser({ phone, password });
            const token = createAccountSessionForPhone(user.phone);
            res.cookie(accountCookieName, token, accountCookieOptions(req));
            return res.json({ user: publicUser(user.phone) });
        } catch (error) {
            return res.status(error.status || 500).json({
                code: error.code || 'LOGIN_FAILED',
                message: error.message || '登录失败。'
            });
        }
    });

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

    app.post('/api/auth/logout', limitAuthApi, (req, res) => {
        const token = getAccountSessionToken(req);
        if (token) {
            revokeAccountSession.run(nowIso(), hashSessionToken(token));
        }
        clearAccountCookie(res);
        return res.json({ ok: true });
    });

    app.get('/api/account/me', limitQueryApi, requireAccount, (req, res) => {
        const orders = listOrdersByPhone.all(req.account.phone)
            .map(toOrder)
            .map((order) => publicOrder(order, { includeApiKey: true }));
        return res.json({
            user: publicUser(req.account.phone),
            orders
        });
    });

    app.get('/api/account/balance', limitQueryApi, requireAccount, (req, res) => {
        const balance = ensureAccountBalance(req.account.phone);
        return res.json({
            balance: publicAccountBalance(balance),
            payment: accountPaymentConfig(req.account.phone)
        });
    });

    app.get('/api/account/usage-summary', limitQueryApi, requireAccount, (req, res) => {
        return res.json(accountUsageSummary(req.account.phone));
    });

    app.post('/api/admin/invites', limitAdminApi, requireAdminToken, (req, res) => {
        const count = Math.min(Math.max(Number(req.body.count || 1), 1), 50);
        const invites = createInvites(count);
        return res.status(201).json({ invites });
    });

    app.post('/api/admin/api-keys', limitAdminApi, requireAdminToken, (req, res) => {
        const apiKeys = Array.isArray(req.body.apiKeys)
            ? req.body.apiKeys.map((apiKey) => String(apiKey || '').trim()).filter(Boolean)
            : [];
        if (!apiKeys.length) {
            return res.status(400).json({ code: 'INVALID_API_KEYS', message: '请提供 API key 列表。' });
        }
        if (new Set(apiKeys).size !== apiKeys.length) {
            return res.status(409).json({ code: 'API_KEY_EXISTS', message: 'API key 列表存在重复。' });
        }
        try {
            const apiKeyResults = importApiKeys(apiKeys);
            return res.status(201).json({ apiKeys: apiKeyResults });
        } catch (error) {
            return res.status(error.status || 500).json({
                code: error.code || 'API_KEY_IMPORT_FAILED',
                message: error.message || 'API key 导入失败。'
            });
        }
    });

    app.get('/api/admin/invites', limitAdminApi, requireAdminToken, (req, res) => {
        const invites = listInvites.all().map((row) => publicInvite(toInvite(row)));
        return res.json({ invites });
    });

    app.get('/api/admin/usage-summary', limitAdminApi, requireAdminUsageAccess, (req, res) => {
        return res.json(buildUsageSummary(req.query));
    });

    app.post('/api/admin/usage-key-profiles', limitAdminApi, requireAdminUsageAccess, (req, res) => {
        try {
            const profile = saveUsageKeyProfile(req.body);
            return res.status(201).json({ profile: publicUsageKeyProfile(profile) });
        } catch (error) {
            return res.status(error.status || 500).json({
                code: error.code || 'USAGE_KEY_PROFILE_FAILED',
                message: error.message || 'usage key 归属设置失败。'
            });
        }
    });

    app.post('/api/admin/password-reset-codes', limitAdminApi, requireAdminAccount, (req, res) => {
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

    app.post('/api/admin/usage-imports', limitAdminApi, requireAdminUsageAccess, (req, res) => {
        try {
            return res.json(importUsageEvents(req.body.month));
        } catch (error) {
            return res.status(error.status || 500).json({
                code: error.code || 'USAGE_IMPORT_FAILED',
                message: error.message || 'usage event 导入失败。'
            });
        }
    });

    app.post('/api/invites/redeem', limitRedeemApi, (req, res) => {
        const phone = String(req.body.phone || '').trim();
        const code = String(req.body.code || '').trim().toUpperCase();
        if (!isPhone(phone)) {
            return res.status(400).json({ code: 'INVALID_PHONE', message: '请输入有效的中国大陆手机号。' });
        }
        if (!code) {
            return res.status(400).json({ code: 'INVALID_INVITE_CODE', message: '请输入邀请码。' });
        }

        try {
            const order = redeemInvite({ phone, code });
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

    app.get('/api/orders', limitQueryApi, requireAccount, (req, res) => {
        const orders = listOrdersByPhone.all(req.account.phone)
            .map(toOrder)
            .map((order) => publicOrder(order, { includeApiKey: true }));

        return res.json({ orders });
    });

    app.get('/api/orders/current', limitQueryApi, (req, res) => {
        const token = getResultToken(req);
        const row = token ? getOrderByResultToken.get(token) : null;
        if (!row) {
            return res.status(401).json({
                code: 'CURRENT_ORDER_NOT_FOUND',
                message: '请先完成邀请码兑换。'
            });
        }

        return res.json({ order: publicOrder(toOrder(row), { includeApiKey: true }) });
    });

    app.get('/api/internal/api-keys/status', requireInternal, (req, res) => {
        const apiKey = String(req.query.apiKey || '').trim();
        if (!apiKey) {
            return res.status(400).json({
                code: 'INVALID_API_KEY',
                message: '请提供 API key。'
            });
        }

        const apiKeyRow = getApiKey.get(apiKey);
        if (!apiKeyRow) {
            return res.json({
                managed: false,
                active: false,
                status: 'not_found',
                expiresAt: ''
            });
        }
        if (apiKeyRow.status === 'disabled') {
            return res.json({
                managed: true,
                active: false,
                status: 'disabled',
                expiresAt: ''
            });
        }

        const orderRow = getOrderByApiKey.get(apiKey);
        if (!orderRow) {
            return res.json({
                managed: true,
                active: false,
                status: apiKeyRow.status,
                expiresAt: ''
            });
        }

        const order = toOrder(orderRow);
        const active = getOrderStatus(order) === 'active';
        return res.json({
            managed: true,
            active,
            status: active ? 'active' : 'expired',
            expiresAt: order.expiresAt
        });
    });

    app.post('/api/internal/usage-events', requireInternal, (req, res) => {
        const signatureResult = verifyUsageSignature(req);
        if (!signatureResult.ok) {
            return res.status(signatureResult.status).json({
                code: signatureResult.code,
                message: signatureResult.message
            });
        }
        try {
            const result = storeUsageEvent(req.body);
            return res.status(result.inserted ? 201 : 200).json(result);
        } catch (error) {
            return res.status(error.status || 500).json({
                code: error.code || 'USAGE_EVENT_STORE_FAILED',
                message: error.message || 'usage event 写入失败。'
            });
        }
    });

    app.get(['/shop', '/shop/', '/shop/index.html'], redirectAccountHomePage);
    app.get(['/shop/query', '/shop/query/', '/shop/query/index.html'], redirectQueryPage);
    app.get(['/shop/login', '/shop/login/', '/shop/login/index.html'], (req, res, next) => next());
    app.get(['/shop/register', '/shop/register/', '/shop/register/index.html'], (req, res, next) => next());
    app.get(['/shop/admin', '/shop/admin/', '/shop/admin/index.html'], requireAdminPage, (req, res, next) => next());
    app.get(['/shop/redeem', '/shop/redeem/', '/shop/redeem/index.html'], requireAccountPage, (req, res, next) => {
        clearResultCookies(res);
        return next();
    });
    app.get(/^\/shop(?:\/.*)?$/, requireShopHtmlPage, (req, res, next) => next());

    app.use(blockSensitiveStaticPaths);
    app.use(express.static(rootDir, { extensions: ['html'], dotfiles: 'ignore' }));

    app.use((req, res) => {
        if (req.method === 'GET' && !req.path.includes('.') && !req.path.endsWith('/')) {
            const htmlPath = path.join(rootDir, `${req.path}.html`);
            if (htmlPath.startsWith(rootDir) && fs.existsSync(htmlPath)) {
                return res.sendFile(htmlPath);
            }
        }
        res.status(404).sendFile(path.join(rootDir, '404.html'));
    });

    return { app, db, dbPath };
}

if (require.main === module) {
    const { app } = createShopApp();
    const port = Number(process.env.PORT || 4173);
    app.listen(port, () => {
        console.log(`Yui web shop server listening on http://localhost:${port}`);
    });
}

module.exports = {
    createShopApp,
    openShopDatabase,
    isPhone,
    parseCookies
};
