const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function readFile(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

// 取出 `const translations = { ... }` 的对象字面量源码，并记下它在文件里的起始行号。
function extractTranslationsSource(source) {
    const markerIndex = source.indexOf('const translations = ');
    assert.notEqual(markerIndex, -1, 'js/lang.js 缺少 translations 对象');

    const start = source.indexOf('{', markerIndex);
    assert.notEqual(start, -1, 'translations 对象缺少 `{`');

    let depth = 0;
    for (let index = start; index < source.length; index += 1) {
        const char = source[index];
        if (char === '{') depth += 1;
        else if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return {
                    text: source.slice(start, index + 1),
                    startLine: source.slice(0, start).split(/\r?\n/).length
                };
            }
        }
    }

    throw new Error('translations 对象括号不闭合');
}

// 逐行扫描对象字面量，找出「同一层对象里重复声明的 key」。
// JS 对象字面量里后写的 key 会覆盖先写的，重复 section 会让前一份变成永远读不到的死代码。
function findDuplicateKeys({ text, startLine }) {
    const lines = text.split(/\r?\n/);
    const frames = [];
    const duplicates = [];
    const currentPath = () => frames.map((frame) => frame.name).join('.');

    lines.forEach((rawLine, index) => {
        const line = rawLine.trim();
        const fileLine = startLine + index;
        if (line === '' || line.startsWith('//')) return;

        if (line === '{') {
            frames.push({ name: 'translations', keys: new Map() });
            return;
        }

        if (/^\},?$/.test(line)) {
            frames.pop();
            return;
        }

        const match = line.match(/^([A-Za-z_$][\w$]*)\s*:/);
        // 解析不了就直接失败，避免格式变化后这个检查静默失效。
        assert.ok(match, `js/lang.js:${fileLine} 无法解析为 translations 的 key: ${line}`);
        assert.ok(frames.length > 0, `js/lang.js:${fileLine} 不在任何对象内`);

        const key = match[1];
        const frame = frames[frames.length - 1];
        if (frame.keys.has(key)) {
            duplicates.push(`${currentPath()}.${key} 重复声明：js/lang.js:${frame.keys.get(key)} 和 js/lang.js:${fileLine}`);
        } else {
            frame.keys.set(key, fileLine);
        }

        if (line.endsWith('{')) frames.push({ name: key, keys: new Map() });
    });

    assert.equal(frames.length, 0, 'translations 对象解析未闭合，重复 key 检测结果不可信');
    return duplicates;
}

test('js/lang.js 的翻译表里没有重复声明的 key', () => {
    const duplicates = findDuplicateKeys(extractTranslationsSource(readFile('js/lang.js')));

    // 重复的 section 名不会报错，只会让先写的那份永远读不到（后写的覆盖先写的）。
    assert.deepEqual(duplicates, []);
});

test('skill 与 404 页面的 data-i18n key 在中英日三种语言里都有翻译', () => {
    const { text } = extractTranslationsSource(readFile('js/lang.js'));
    // 用真正求值后的对象来断言，这样命中的就是运行时实际生效的那一份翻译。
    const translations = new Function(`return ${text};`)();

    const pages = [
        { section: 'skill', html: 'skill/index.html' },
        { section: 'notfound', html: '404.html' }
    ];

    for (const { section, html } of pages) {
        const markup = readFile(html);
        const keys = [...new Set([...markup.matchAll(/data-i18n="([^"]+)"/g)].map((match) => match[1]))];
        assert.ok(keys.length > 0, `${html} 没有 data-i18n 属性`);

        for (const lang of ['zh', 'en', 'ja']) {
            const block = translations[section] && translations[section][lang];
            assert.ok(block, `缺少 ${section}.${lang} 翻译块`);
            for (const key of keys) {
                assert.ok(
                    Object.prototype.hasOwnProperty.call(block, key),
                    `${section}.${lang} 缺少 ${html} 用到的 key: ${key}`
                );
            }
        }
    }
});

test('所有页面引用的 /js/lang.js 版本号一致', () => {
    const ignoredDirs = new Set(['.git', '.github', '.claude', '.kiro', '.worktrees', 'node_modules', 'data', 'public-dist']);
    const projectRoot = path.join(__dirname, '..');
    const listHtmlFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true })
        .flatMap((entry) => {
            if (ignoredDirs.has(entry.name)) return [];
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) return listHtmlFiles(fullPath);
            return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
        });

    const references = listHtmlFiles(projectRoot).flatMap((filePath) => {
        const relativePath = path.relative(projectRoot, filePath).split(path.sep).join('/');
        const html = fs.readFileSync(filePath, 'utf8');
        return [...html.matchAll(/src="\/js\/lang\.js([^"]*)"/g)]
            .map((match) => ({ relativePath, query: match[1] }));
    });

    assert.ok(references.length > 0, '没有页面引用 /js/lang.js');

    // .js 响应缓存 7 天，漏掉任何一页都会让旧的 lang.js 配上新的 HTML。
    const missingVersion = references.filter((reference) => !/^\?v=.+$/.test(reference.query));
    assert.deepEqual(
        missingVersion.map((reference) => reference.relativePath),
        [],
        '这些页面引用 /js/lang.js 时缺少 ?v= 版本号'
    );

    const versions = [...new Set(references.map((reference) => reference.query))].sort();
    assert.equal(
        versions.length,
        1,
        '/js/lang.js 版本号不一致：' + JSON.stringify(versions) + '，改动 lang.js 时要把每一页都抬到同一个新版本'
    );
});
