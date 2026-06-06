const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const express = require('express');
require('dotenv').config();

const durationDays = 31;
const resultCookieName = 'yui_shop_result_token';
const legacyRedeemCookieName = 'yui_shop_redeemed';
const redeemCookieMaxAgeMs = durationDays * 24 * 60 * 60 * 1000;
const rateLimitBuckets = new Map();
const chinaOffsetMs = 8 * 60 * 60 * 1000;

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

function keyPreview(apiKey) {
    if (!apiKey) return '';
    return `${apiKey.slice(0, 12)}...${apiKey.slice(-6)}`;
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

    function requireAdmin(req, res, next) {
        const expected = options.adminToken ?? process.env.ADMIN_TOKEN;
        const actual = req.header('x-admin-token');
        if (!expected) {
            return res.status(503).json({
                code: 'ADMIN_TOKEN_NOT_CONFIGURED',
                message: '请先在 .env 中配置 ADMIN_TOKEN，再生成邀请码。'
            });
        }
        if (actual !== expected) {
            return res.status(401).json({ code: 'UNAUTHORIZED', message: '管理员 token 无效。' });
        }
        return next();
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

    function cookieOptions(req) {
        return {
            httpOnly: true,
            sameSite: 'lax',
            secure: req.secure || req.header('x-forwarded-proto') === 'https',
            maxAge: redeemCookieMaxAgeMs,
            path: '/'
        };
    }

    function clearResultCookies(res) {
        res.clearCookie(resultCookieName, { path: '/' });
        res.clearCookie(legacyRedeemCookieName, { path: '/shop' });
    }

    function getResultToken(req) {
        const cookies = parseCookies(req.header('cookie'));
        return String(cookies[resultCookieName] || '').trim();
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
INSERT INTO api_keys (api_key, api_key_preview, status, created_at)
VALUES (?, ?, 'unused', ?)
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
            insertApiKey.run(apiKey, apiKeyPreview, nowIso());
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

    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));
    app.use(setSecurityHeaders);

    app.post('/api/admin/invites', limitAdminApi, requireAdmin, (req, res) => {
        const count = Math.min(Math.max(Number(req.body.count || 1), 1), 50);
        const invites = createInvites(count);
        return res.status(201).json({ invites });
    });

    app.post('/api/admin/api-keys', limitAdminApi, requireAdmin, (req, res) => {
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

    app.get('/api/admin/invites', limitAdminApi, requireAdmin, (req, res) => {
        const invites = listInvites.all().map((row) => publicInvite(toInvite(row)));
        return res.json({ invites });
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

    app.get('/api/orders', limitQueryApi, (req, res) => {
        const phone = String(req.query.phone || '').trim();
        if (!isPhone(phone)) {
            return res.status(400).json({ code: 'INVALID_PHONE', message: '请输入有效的中国大陆手机号。' });
        }

        const orders = listOrdersByPhone.all(phone)
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

    app.get(['/shop/redeem', '/shop/redeem/', '/shop/redeem/index.html'], (req, res, next) => {
        clearResultCookies(res);
        return next();
    });

    app.get(['/shop/key', '/shop/key/', '/shop/key/index.html'], requireResultToken, (req, res, next) => next());

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
