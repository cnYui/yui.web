const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.join(__dirname, '..');
const blogPages = fs.readdirSync(path.join(rootDir, 'blog'))
    .filter((name) => name.endsWith('.html'))
    .map((name) => `blog/${name}`);

test('公开页面导航不再链接暂时下线的动漫、音乐页面', () => {
    for (const page of ['index.html', 'resume/index.html', 'projects/index.html', 'travel/index.html', ...blogPages]) {
        const html = fs.readFileSync(path.join(rootDir, page), 'utf8');
        assert.doesNotMatch(html, /href="\/(anime|music)\//, page);
    }
});
