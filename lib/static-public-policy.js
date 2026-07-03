const path = require('node:path');

const allowedStaticPrefixes = [
    '/images/',
    '/files/',
    '/styles/',
    '/js/',
    '/blog/',
    '/music/',
    '/anime/',
    '/travel/',
    '/projects/',
    '/resume/',
    '/skill/',
    '/shop/',
];

const allowedStaticFiles = new Set([
    '/',
    '/index.html',
    '/404.html',
    '/CNAME',
    '/custom.geo.json',
]);

const blockedStaticPrefixes = [
    '/.git',
    '/.github',
    '/.kiro',
    '/data',
    '/docs',
    '/lib',
    '/node_modules',
    '/pids',
    '/scripts',
    '/superpowers',
    '/test',
    '/tmp',
];

const blockedStaticFiles = new Set([
    '/.env',
    '/AGENTS.md',
    '/README.md',
    '/SKILL.md',
    '/package.json',
    '/package-lock.json',
    '/server.js',
    '/tailwind.config.js',
]);

const retiredShopPrefixes = [
    '/shop/login',
    '/shop/register',
    '/shop/reset-password',
    '/shop/account',
    '/shop/admin',
    '/shop/redeem',
    '/shop/key',
    '/shop/query',
    '/shop/order',
    '/shop/pay',
    '/shop/result',
    '/shop/content',
    '/shop/guide',
    '/shop/js',
    '/shop/assets/login',
    '/shop/assets/pay',
];

function normalizeRequestPath(value) {
    const raw = decodeURIComponent(String(value || '/'));
    const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
    return path.posix.normalize(withSlash);
}

function hasPrefix(value, prefix) {
    return value === prefix || value.startsWith(`${prefix.replace(/\/$/, '')}/`);
}

function isRetiredShopPath(value) {
    const requestPath = normalizeRequestPath(value);
    return retiredShopPrefixes.some((prefix) => hasPrefix(requestPath, prefix));
}

function isAllowedPublicStaticPath(value) {
    const requestPath = normalizeRequestPath(value);
    if (blockedStaticFiles.has(requestPath)) return false;
    if (blockedStaticPrefixes.some((prefix) => hasPrefix(requestPath, prefix))) return false;
    if (isRetiredShopPath(requestPath)) return false;
    if (allowedStaticFiles.has(requestPath)) return true;
    return allowedStaticPrefixes.some((prefix) => requestPath.startsWith(prefix));
}

function cacheControlForStaticPath(value) {
    const requestPath = normalizeRequestPath(value);
    if (requestPath.endsWith('.html') || requestPath.endsWith('/')) return 'public, max-age=60, must-revalidate';
    if (requestPath.match(/\.(png|jpg|jpeg|webp|avif|gif|svg|css|js|json|pdf)$/i)) return 'public, max-age=604800';
    return 'public, max-age=300';
}

module.exports = {
    cacheControlForStaticPath,
    isAllowedPublicStaticPath,
    isRetiredShopPath,
    normalizeRequestPath,
};
