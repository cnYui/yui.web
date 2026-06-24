#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const rootDir = path.resolve(__dirname, '..');
const jobs = [
    { from: 'images/music_pic', to: 'images/optimized/music_pic', resize: '800x800>' },
    { from: 'images/animate', to: 'images/optimized/animate', resize: '760x760>' },
    { from: 'images/travel', to: 'images/optimized/travel', resize: '1200x1200>' },
    { from: 'images/blog/back-to-vibe-coding', to: 'images/optimized/blog/back-to-vibe-coding', resize: '1400x1400>' },
    { from: 'images/blog/speakmore-note-cover-guizang.png', to: 'images/optimized/blog/speakmore-note-cover-guizang.webp', resize: '1600x1600>' },
    { from: 'images/shop/code-transit-entry.webp', to: 'images/optimized/shop/code-transit-entry.webp', resize: '1800x1800>' },
];

function listImages(source) {
    const full = path.join(rootDir, source);
    if (!fs.existsSync(full)) return [];
    if (fs.statSync(full).isFile()) return [source];
    return fs.readdirSync(full)
        .filter((name) => /\.(png|jpe?g|webp)$/i.test(name))
        .map((name) => path.join(source, name));
}

function outputPath(job, input) {
    const source = path.join(rootDir, job.from);
    const inputPath = path.join(rootDir, input);
    if (fs.existsSync(source) && fs.statSync(source).isFile()) return path.join(rootDir, job.to);
    const parsed = path.parse(path.relative(source, inputPath));
    return path.join(rootDir, job.to, `${parsed.name}.webp`);
}

for (const job of jobs) {
    for (const input of listImages(job.from)) {
        const source = path.join(rootDir, input);
        const target = outputPath(job, input);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        const result = spawnSync('magick', [source, '-auto-orient', '-resize', job.resize, '-quality', '78', target], {
            stdio: 'inherit',
        });
        if (result.status !== 0) process.exit(result.status || 1);
    }
}

console.log('图片派生资源生成完成。');
