const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.join(__dirname, '..');
const articlePath = path.join(rootDir, 'blog/back-to-vibe-coding-ai-driven-dev-before.html');

function readArticleHtml() {
    return fs.readFileSync(articlePath, 'utf8');
}

function extractCssRule(html, selector) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = html.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
    return match ? match[1] : '';
}

test('back-to-vibe-coding 文章代码块在亮色和暗色模式都有可读文字颜色', () => {
    const html = readArticleHtml();
    const lightPreRule = extractCssRule(html, '.prose pre');
    const darkPreRule = extractCssRule(html, '.dark .prose pre');
    const codeRule = extractCssRule(html, '.prose pre code');

    assert.match(lightPreRule, /color:\s*#27272a\b/);
    assert.match(darkPreRule, /color:\s*#e5e5e5\b/);
    assert.match(codeRule, /color:\s*inherit\b/);
});
