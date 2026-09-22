const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const readFile = (relativePath) => fs.readFileSync(path.join(rootDir, relativePath), 'utf8');

// aaccx.pw 的 cloudflared ingress 只把下面这些前缀转发给 yui.web(4173)，
// 其余路径（含 /api/）会落到 Sub2API(8080)。接口路径放错前缀时，
// 本机自测全绿但公网必定 404 —— 2026-09-22 就这么踩过一次。
const TUNNELED_PREFIXES = [
    'files', 'styles', 'js', 'blog', 'music', 'anime',
    'travel', 'projects', 'resume', 'skill', 'shop',
];

function serverEndpoint() {
    const match = readFile('server.js').match(/app\.post\('([^']+)',\s*\(req, res\) => \{\s*\n\s*const clientKey/);
    return match && match[1];
}

function clientEndpoint() {
    const match = readFile('js/resume-download.js').match(/var ENDPOINT = '([^']+)'/);
    return match && match[1];
}

test('简历下载接口的前后端路径完全一致', () => {
    const server = serverEndpoint();
    const client = clientEndpoint();
    assert.ok(server, '未能在 server.js 中找到简历下载路由');
    assert.ok(client, '未能在 js/resume-download.js 中找到 ENDPOINT');
    assert.equal(client, server, `前端请求 ${client} 但服务端注册的是 ${server}`);
});

test('简历下载接口必须落在 cloudflared 会转发给本服务的前缀下', () => {
    const endpoint = serverEndpoint();
    const firstSegment = endpoint.split('/').filter(Boolean)[0];
    assert.ok(
        TUNNELED_PREFIXES.includes(firstSegment),
        `接口 ${endpoint} 的前缀 /${firstSegment} 不在隧道转发白名单内，公网会被路由到 Sub2API 并返回 404`
    );
});

test('两个下载入口引用的脚本版本号一致，避免其中一页加载到旧逻辑', () => {
    const pattern = /\/js\/resume-download\.js\?v=([0-9A-Za-z.-]+)/;
    const home = readFile('index.html').match(pattern);
    const resume = readFile('resume/index.html').match(pattern);
    assert.ok(home, '首页缺少 resume-download.js 引用');
    assert.ok(resume, '简历页缺少 resume-download.js 引用');
    assert.equal(home[1], resume[1], '两个页面引用的 resume-download.js 版本号不一致');
});
