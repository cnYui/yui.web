const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(rootDir, 'styles/wabi.css'), 'utf8');

function cssRule(selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
    return match ? match[1] : '';
}

test('文章代码块在纸色底上用墨色字，行内代码继承颜色', () => {
    const pre = cssRule('.article-body pre');
    assert.match(pre, /background:\s*var\(--code-ground\)/);
    assert.match(pre, /color:\s*var\(--ink\)/);
    assert.match(pre, /overflow-x:\s*auto/);
    assert.match(cssRule('.article-body pre code'), /color:\s*inherit/);
    assert.match(css, /--code-ground:\s*#e7e4dc/i);
    assert.match(css, /--ink:\s*#25231f/i);
});

test('有代码块的文章页用全站样式，不再自带深浅两套代码配色', () => {
    const html = fs.readFileSync(path.join(rootDir, 'blog/back-to-vibe-coding-ai-driven-dev-before.html'), 'utf8');
    assert.match(html, /href="\/styles\/wabi\.css\?v=[^"]+"/);
    assert.doesNotMatch(html, /\.dark \.prose pre/);
});
