const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const rootDir = path.join(__dirname, '..');
const outDir = path.join(rootDir, 'public-dist');

test('public-dist 只打包当前页面实际使用的图片目录', () => {
    const result = spawnSync('node', ['scripts/build-public-dist.js'], {
        cwd: rootDir,
        encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);

    assert.equal(fs.existsSync(path.join(outDir, 'images', 'optimized')), true);
    assert.equal(fs.existsSync(path.join(outDir, 'images', 'blog')), true);
    assert.equal(fs.existsSync(path.join(outDir, 'images', 'hackathon')), true);
    assert.equal(fs.existsSync(path.join(outDir, 'images', 'profile')), true);
    assert.equal(fs.existsSync(path.join(outDir, 'images', 'ai-video-comic.jpg')), true);

    assert.equal(fs.existsSync(path.join(outDir, 'images', 'animate')), false);
    assert.equal(fs.existsSync(path.join(outDir, 'images', 'music_pic')), false);
    assert.equal(fs.existsSync(path.join(outDir, 'images', 'shop')), false);
    assert.equal(fs.existsSync(path.join(outDir, 'images', 'travel')), false);
});
