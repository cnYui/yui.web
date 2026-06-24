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
    'anime',
    'blog',
    'images',
    'js',
    'music',
    'projects',
    'resume',
    'shop/index.html',
    'skill',
    'styles',
    'travel',
];

function copyRecursive(from, to) {
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
