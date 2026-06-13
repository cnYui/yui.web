const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.join(__dirname, '..');

test('Blog 页面不依赖 CSP 会阻止的内联脚本渲染文章', () => {
    const html = fs.readFileSync(path.join(rootDir, 'blog/index.html'), 'utf8');
    const scriptTags = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    const inlineScripts = scriptTags.filter(([, attributes]) => !/\bsrc\s*=/.test(attributes));

    assert.equal(inlineScripts.length, 0);
    assert.match(html, /src="\/js\/blog-data\.js"/);
    assert.match(html, /src="\/js\/blog-index\.js"/);
});
