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

function localScripts(htmlPath, html) {
    return [...html.matchAll(/<script\b[^>]*?\ssrc\s*=\s*["']([^"']+)["']/gi)]
        .map(([, src]) => src)
        .filter((src) => !/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(src))
        .map((src) => {
            const cleanSrc = src.split(/[?#]/)[0];
            const target = cleanSrc.startsWith('/')
                ? path.join(outDir, cleanSrc)
                : path.resolve(path.dirname(htmlPath), cleanSrc);
            return { src, target };
        });
}

test('public-dist 只打包压缩后的图片，不含 images/ 下的源图目录', () => {
    buildPublicDist();

    assert.deepEqual(fs.readdirSync(path.join(outDir, 'images')), ['optimized']);
});

test('public-dist 包含页面引用的全部站内脚本', () => {
    buildPublicDist();

    const missing = [];
    for (const htmlPath of listFiles(outDir).filter((filePath) => filePath.endsWith('.html'))) {
        const html = fs.readFileSync(htmlPath, 'utf8');
        for (const { src, target } of localScripts(htmlPath, html)) {
            if (!fs.existsSync(target)) missing.push(`${path.relative(outDir, htmlPath)} -> ${src}`);
        }
    }

    assert.deepEqual(missing, []);
});

test('页面及其脚本引用的图片都是 images/optimized 下的压缩图', () => {
    buildPublicDist();

    const problems = [];
    for (const htmlPath of listFiles(outDir).filter((filePath) => filePath.endsWith('.html'))) {
        const html = fs.readFileSync(htmlPath, 'utf8');
        const sources = [{ file: htmlPath, text: html }, ...localScripts(htmlPath, html)
            .filter(({ target }) => fs.existsSync(target))
            .map(({ target }) => ({ file: target, text: fs.readFileSync(target, 'utf8') }))];
        for (const { file, text } of sources) {
            for (const [image] of text.matchAll(/\/images\/[^"'`()]+?\.(?:png|jpe?g|webp|gif|svg|avif)(?=["'`)?#])/gi)) {
                const where = `${path.relative(outDir, htmlPath)} (${path.relative(outDir, file)}) -> ${image}`;
                if (!image.startsWith('/images/optimized/')) problems.push(`${where} 不是压缩图`);
                else if (!fs.existsSync(path.join(outDir, image))) problems.push(`${where} 缺失`);
            }
        }
    }

    assert.deepEqual(problems, []);
});

test('public-dist 不包含暂时下线的动漫、音乐页面及其图片', () => {
    buildPublicDist();

    assert.equal(fs.existsSync(path.join(outDir, 'anime')), false);
    assert.equal(fs.existsSync(path.join(outDir, 'music')), false);
    assert.equal(fs.existsSync(path.join(outDir, 'images', 'optimized', 'animate')), false);
    assert.equal(fs.existsSync(path.join(outDir, 'images', 'optimized', 'music_pic')), false);
    assert.equal(fs.existsSync(path.join(outDir, 'images', 'optimized', 'travel')), true);
});
