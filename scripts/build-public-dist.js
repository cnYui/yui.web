#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'public-dist');
const entries = [
    '404.html',
    'CNAME',
    'custom.geo.json',
    'index.html',
    'blog',
    'files',
    // 页面只引用 images/optimized 下的压缩图，其余 images/ 目录是源图，不打包。
    'images/optimized',
    'js',
    'projects',
    'resume',
    'shop/index.html',
    'skill',
    'styles',
    'travel',
];
// 动漫、音乐页面暂时下线，其派生图片也不进入公开产物。
const excludedPaths = new Set([
    'images/optimized/animate',
    'images/optimized/music_pic',
].map((entry) => path.join(rootDir, entry)));

function copyRecursive(from, to) {
    if (excludedPaths.has(from)) return;
    const stat = fs.statSync(from);
    if (stat.isDirectory()) {
        fs.mkdirSync(to, { recursive: true });
        for (const entry of fs.readdirSync(from)) {
            copyRecursive(path.join(from, entry), path.join(to, entry));
        }
        return;
    }
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
}

fs.rmSync(outDir, { recursive: true, force: true });
for (const entry of entries) {
    const from = path.join(rootDir, entry);
    if (!fs.existsSync(from)) continue;
    copyRecursive(from, path.join(outDir, entry));
}

console.log(`public-dist 已生成：${outDir}`);
