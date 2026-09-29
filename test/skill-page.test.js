const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const { isAllowedPublicStaticPath } = require('../lib/static-public-policy');

const rootDir = path.resolve(__dirname, '..');
const readFile = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

const MARKED_FILE = 'js/markdown/marked.umd.js';

// /skill/ 同时依赖两样东西：自托管的 Markdown 渲染器，和能公开读到的 /SKILL.md。
// 2026-09-25 之前两样都是坏的 —— 渲染器走 CDN 被 script-src 'self' 挡掉，
// /SKILL.md 又在静态白名单的 blockedStaticFiles 里，页面只剩导航和标题。

test('/skill/ 的 Markdown 渲染器是自托管的，不走 CDN', () => {
    const html = readFile('skill/index.html');
    const externalScripts = [...html.matchAll(/<script\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/gi)]
        .map(([, src]) => src)
        .filter((src) => /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(src));

    assert.deepEqual(externalScripts, [], '站点 CSP 是 script-src \'self\'，跨域脚本会被整个挡掉');
    assert.match(html, new RegExp(`<script src="/${MARKED_FILE}"></script>`), `/skill/ 未引用 /${MARKED_FILE}`);
});

test('自托管的 marked 不能放在会被 Cloudflare 拦掉的 js/vendor/ 下', () => {
    // aaccx.pw 的 Cloudflare 会把 /js/vendor/ 下的一切拦成 403（源站本身是 200）。
    assert.equal(MARKED_FILE.startsWith('js/vendor/'), false);
    assert.equal(fs.existsSync(path.join(rootDir, MARKED_FILE)), true, `缺少自托管的 ${MARKED_FILE}`);
});

test('自托管的 marked 会挂到 window 上并提供 js/skill.js 用到的接口', () => {
    const sandbox = {};
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(readFile(MARKED_FILE), sandbox, { filename: MARKED_FILE });

    assert.ok(sandbox.window.marked, `${MARKED_FILE} 没有挂出 window.marked`);
    assert.equal(typeof sandbox.window.marked.setOptions, 'function');
    assert.equal(typeof sandbox.window.marked.parse, 'function');

    sandbox.window.marked.setOptions({ gfm: true });
    const html = sandbox.window.marked.parse('# 标题\n\n- 一\n- 二\n');
    assert.match(html, /<h1>标题<\/h1>/);
    assert.match(html, /<li>一<\/li>/);
});

test('js/skill.js fetch 的 Markdown 路径在公开静态白名单内', () => {
    const match = readFile('js/skill.js').match(/fetch\("([^"]+)"/);
    assert.ok(match, '未能在 js/skill.js 中找到 fetch 的 Markdown 路径');
    assert.equal(
        isAllowedPublicStaticPath(match[1]),
        true,
        `js/skill.js 请求 ${match[1]}，但静态白名单会让它返回 404`
    );
});

test('/skill/ 引用的 skill.js 带上了本次改动的版本号', () => {
    // .js 响应缓存 7 天，改了页面脚本必须换 ?v=，否则老浏览器拿到旧逻辑。
    const match = readFile('skill/index.html').match(/\/js\/skill\.js\?v=([0-9A-Za-z.-]+)/);
    assert.ok(match, '/skill/ 引用 skill.js 时缺少 ?v= 版本号');
});

test('js/skill.js 渲染成功后才移除状态行', () => {
    // 反过来写的话，渲染器缺失时 statusEl 已经脱离文档，错误提示无处可显示，页面只剩空白。
    const source = readFile('js/skill.js');
    const renderIndex = source.indexOf('contentEl.innerHTML');
    const removeIndex = source.indexOf('statusEl.remove()');
    assert.ok(renderIndex !== -1 && removeIndex !== -1, 'js/skill.js 缺少渲染或移除状态行的逻辑');
    assert.ok(renderIndex < removeIndex, 'statusEl.remove() 必须放在渲染之后，否则渲染失败时报错无处显示');
});
