const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const rootDir = path.join(__dirname, '..');
const outDir = path.join(rootDir, 'public-dist');

let built = false;

function buildPublicDist() {
    if (built) return;
    const result = spawnSync('node', ['scripts/build-public-dist.js'], {
        cwd: rootDir,
        encoding: 'utf8'
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    built = true;
}

function listFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return listFiles(fullPath);
        return entry.isFile() ? [fullPath] : [];
    });
}

test('public-dist 只打包当前页面实际使用的图片目录', () => {
    buildPublicDist();

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

test('public-dist 包含页面引用的全部站内脚本', () => {
    buildPublicDist();

    const missing = [];
    for (const htmlPath of listFiles(outDir).filter((filePath) => filePath.endsWith('.html'))) {
        const html = fs.readFileSync(htmlPath, 'utf8');
        for (const [, src] of html.matchAll(/<script\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/gi)) {
            if (/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(src)) continue;
            const cleanSrc = src.split(/[?#]/)[0];
            const target = cleanSrc.startsWith('/')
                ? path.join(outDir, cleanSrc)
                : path.resolve(path.dirname(htmlPath), cleanSrc);
            if (!fs.existsSync(target)) missing.push(`${path.relative(outDir, htmlPath)} -> ${src}`);
        }
    }

    assert.deepEqual(missing, []);
});
