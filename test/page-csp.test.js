const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { after, before, test } = require('node:test');

const { createShopApp } = require('../server');
const { isAllowedPublicStaticPath, isRetiredShopPath } = require('../lib/static-public-policy');

const rootDir = path.join(__dirname, '..');
const skippedDirs = new Set(['node_modules', 'public-dist']);
const executableScriptType = /^(?:module|importmap|speculationrules|(?:text|application)\/(?:x-)?(?:java|ecma)script|text\/javascript1\.[0-5]|text\/jscript|text\/livescript)$/i;

let server;
let baseUrl;
let db;
let usageImporter;
let dbPath;
const pages = [];

function listHtmlFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        if (entry.name.startsWith('.') || skippedDirs.has(entry.name)) return [];
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return listHtmlFiles(fullPath);
        return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
    });
}

function publicPagePaths() {
    return listHtmlFiles(rootDir)
        .map((filePath) => `/${path.relative(rootDir, filePath).split(path.sep).join('/')}`)
        .filter((pagePath) => isAllowedPublicStaticPath(pagePath) && !isRetiredShopPath(pagePath))
        .sort();
}

function attribute(attributes, name) {
    const match = attributes.match(new RegExp(`(?:^|\\s)${name}(?:\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+)))?(?=\\s|$)`, 'i'));
    if (!match) return null;
    return match[1] ?? match[2] ?? match[3] ?? '';
}

function scriptTags(html) {
    const headEnd = html.search(/<\/head\s*>/i);
    return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].map((match) => ({
        attributes: match[1],
        body: match[2],
        inHead: headEnd !== -1 && match.index < headEnd,
        src: attribute(match[1], 'src'),
        type: (attribute(match[1], 'type') || '').trim(),
    }));
}

function isExecutable(script) {
    return script.type === '' || executableScriptType.test(script.type);
}

function parseCsp(header) {
    const directives = new Map();
    for (const part of String(header || '').split(';')) {
        const [name, ...sources] = part.trim().split(/\s+/);
        if (name && !directives.has(name.toLowerCase())) directives.set(name.toLowerCase(), sources);
    }
    return directives;
}

// kind is 'elem' (<script> blocks, javascript: URLs) or 'attr' (on* handlers).
function cspAllowsInlineScript(directives, kind) {
    const sources = directives.get(`script-src-${kind}`) || directives.get('script-src') || directives.get('default-src');
    if (!sources) return true;
    const hasNonceOrHash = sources.some((source) => /^'(?:nonce-|sha(?:256|384|512)-)/i.test(source));
    return sources.includes("'unsafe-inline'") && !hasNonceOrHash;
}

before(async () => {
    dbPath = path.join(os.tmpdir(), `yui-page-csp-test-${Date.now()}-${Math.random().toString(16).slice(2)}.sqlite`);
    const created = createShopApp({
        adminToken: 'test-admin-token',
        internalToken: 'test-internal-token',
        usageEventHmacSecret: 'test-usage-hmac-secret',
        sub2apiPublicUrl: 'https://sub2api.example.com',
        dbPath,
    });
    db = created.db;
    usageImporter = created.usageImporter;
    server = http.createServer(created.app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    for (const pagePath of publicPagePaths()) {
        const response = await fetch(`${baseUrl}${pagePath}`, { redirect: 'manual' });
        pages.push({
            pagePath,
            status: response.status,
            csp: response.headers.get('content-security-policy'),
            html: await response.text(),
        });
    }
});

after(async () => {
    usageImporter?.stop?.();
    if (server) await new Promise((resolve) => server.close(resolve));
    db?.close();
    for (const suffix of ['', '-wal', '-shm']) fs.rmSync(`${dbPath}${suffix}`, { force: true });
});

test('公开 HTML 页面都能通过 server.js 访问并带 CSP', () => {
    const pagePaths = pages.map((page) => page.pagePath);
    for (const expected of ['/index.html', '/blog/index.html', '/blog/vibe-coding.html', '/projects/index.html', '/skill/index.html']) {
        assert.ok(pagePaths.includes(expected), `未发现公开页面 ${expected}`);
    }
    for (const page of pages) {
        assert.equal(page.status, 200, `${page.pagePath} 返回 ${page.status}`);
        assert.ok(page.csp, `${page.pagePath} 缺少 Content-Security-Policy`);
    }
});

test('公开页面不包含会被 CSP 拦截的内联脚本、事件属性或 javascript: 链接', () => {
    const violations = pages.flatMap(({ pagePath, csp, html }) => {
        const directives = parseCsp(csp);
        const found = [];
        if (!cspAllowsInlineScript(directives, 'elem')) {
            scriptTags(html)
                .filter((script) => script.src === null && isExecutable(script))
                .forEach((script) => found.push(`${pagePath}: 内联 <script> (${script.body.trim().slice(0, 60)}...)`));
            for (const match of html.matchAll(/\s(?:href|src|action|formaction)\s*=\s*["']?\s*javascript:/gi)) {
                found.push(`${pagePath}: javascript: 链接 ${match[0].trim()}`);
            }
        }
        if (!cspAllowsInlineScript(directives, 'attr')) {
            for (const match of html.matchAll(/<[a-zA-Z][^>]*?\s(on[a-z]+)\s*=/g)) {
                found.push(`${pagePath}: 内联事件属性 ${match[1]}`);
            }
        }
        return found;
    });

    assert.deepEqual(violations, []);
});

test('公开页面引用的站内脚本都能通过静态白名单访问', async () => {
    const scriptUrls = new Map();
    for (const { pagePath, html } of pages) {
        for (const script of scriptTags(html)) {
            if (script.src === null) continue;
            const url = new URL(script.src, `${baseUrl}${pagePath}`);
            if (url.origin !== baseUrl) continue;
            const key = `${url.pathname}${url.search}`;
            if (!scriptUrls.has(key)) scriptUrls.set(key, pagePath);
        }
    }

    assert.ok(scriptUrls.has('/js/ui-init.js'), '没有页面引用 /js/ui-init.js');
    for (const [scriptPath, pagePath] of scriptUrls) {
        const response = await fetch(`${baseUrl}${scriptPath}`, { redirect: 'manual' });
        await response.arrayBuffer();
        assert.equal(response.status, 200, `${pagePath} 引用的 ${scriptPath} 返回 ${response.status}`);
        assert.match(response.headers.get('content-type') || '', /javascript/, `${scriptPath} 不是 JavaScript`);
    }
});

test('首屏预初始化脚本在 <head> 中最先同步执行，且页面会加载 lang.js 恢复显示', () => {
    const pagesWithInit = pages.filter(({ html }) => scriptTags(html).some((script) => script.src === '/js/ui-init.js'));
    assert.ok(pagesWithInit.length >= 14, `只有 ${pagesWithInit.length} 个页面加载 /js/ui-init.js`);

    for (const { pagePath, html } of pagesWithInit) {
        const scripts = scriptTags(html);
        const init = scripts[0];
        assert.equal(init.src, '/js/ui-init.js', `${pagePath} 的第一个脚本不是 /js/ui-init.js`);
        assert.equal(init.inHead, true, `${pagePath} 的 /js/ui-init.js 不在 <head> 中`);
        assert.equal(init.type, '', `${pagePath} 的 /js/ui-init.js 不应设置 type`);
        assert.equal(attribute(init.attributes, 'async'), null, `${pagePath} 的 /js/ui-init.js 不应 async`);
        assert.equal(attribute(init.attributes, 'defer'), null, `${pagePath} 的 /js/ui-init.js 不应 defer`);
        // ui-init.js sets data-ui-ready="false"; lang.js flips it back to "true".
        assert.ok(scripts.some((script) => /^\/js\/lang\.js(?:\?|$)/.test(script.src || '')), `${pagePath} 缺少 /js/lang.js`);
    }
});
