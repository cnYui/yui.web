#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const scanExtensions = new Set(['.html', '.js', '.css']);
const ignoredDirectories = new Set([
    '.git',
    '.github',
    '.worktrees',
    'data',
    'lib',
    'node_modules',
    'public-dist',
    'scripts',
    'superpowers',
    'test',
    'tmp'
]);
const ignoredRootFiles = new Set([
    'server.js',
    'tailwind.config.js'
]);
const checkedAssetExtensions = new Set([
    '.css',
    '.gif',
    '.html',
    '.jpeg',
    '.jpg',
    '.js',
    '.json',
    '.pdf',
    '.png',
    '.svg',
    '.webp'
]);
const assetPattern = /\b(?:src|href|poster)=["']([^"']+)["']|url\(["']?([^"')]+)["']?\)|["'](\/[^"']+\.(?:css|gif|html|jpe?g|js|json|pdf|png|svg|webp)(?:[?#][^"']*)?)["']/g;
const ignoredPrefixes = ['http://', 'https://', 'mailto:', 'tel:', 'data:', '#', 'javascript:'];

function listFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);
        const relative = path.relative(rootDir, fullPath);
        if (entry.isDirectory()) {
            if (ignoredDirectories.has(entry.name)) return [];
            return listFiles(fullPath);
        }
        if (dir === rootDir && ignoredRootFiles.has(entry.name)) return [];
        return scanExtensions.has(path.extname(entry.name)) ? [relative] : [];
    });
}

function isLocalAsset(value) {
    const clean = String(value || '').trim();
    return clean && !ignoredPrefixes.some((prefix) => clean.startsWith(prefix));
}

function resolveAsset(fromFile, rawValue) {
    const clean = rawValue.split(/[?#]/)[0];
    if (clean.includes('\\')) return null;
    const extension = path.extname(clean).toLowerCase();
    if (!extension || !checkedAssetExtensions.has(extension)) return null;
    if (!clean || clean.startsWith('/')) return path.join(rootDir, clean);
    return path.resolve(rootDir, path.dirname(fromFile), clean);
}

const missing = [];
for (const file of listFiles(rootDir)) {
    const source = fs.readFileSync(path.join(rootDir, file), 'utf8');
    for (const match of source.matchAll(assetPattern)) {
        const value = match[1] || match[2] || match[3];
        if (!isLocalAsset(value)) continue;
        const target = resolveAsset(file, value);
        if (!target) continue;
        if (!target.startsWith(rootDir) || !fs.existsSync(target)) {
            missing.push(`${file} -> ${value}`);
        }
    }
}

if (missing.length) {
    console.error('发现缺失静态资源引用：');
    for (const item of missing) console.error(`- ${item}`);
    process.exit(1);
}

console.log('静态资源引用检查通过。');
