#!/usr/bin/env node
// 从 blog/<slug>.html 的正文和 js/blog-data.js 的中文元信息，生成首页线索墙文章阅读器用的 js/blog-articles.js。
// 首页把文章当成桌上的手稿渲染，只需要结构化的块（标题 / 段落 / 图片 / 代码 / 列表 / 引用 / 表格 / 分隔线），
// 所以这里把 .prose 正文压成 blocks 数组，正文改动后重新跑一次即可，不用手抄。
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

const ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…',
    mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
    middot: '·', times: '×', rarr: '→', larr: '←', bull: '·'
};

function decodeEntities(value) {
    return value
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/&([a-z]+);/gi, (match, name) => (name.toLowerCase() in ENTITIES ? ENTITIES[name.toLowerCase()] : match));
}

// 正文里的行内标签（<strong>、<code>、<a>）在手稿上不额外渲染，取纯文本即可。
function toText(html) {
    return decodeEntities(String(html).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ''))
        .replace(/[ \t ]+/g, ' ')
        .replace(/\s*\n\s*/g, '\n')
        .trim();
}

function attr(tag, name) {
    const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
    if (!match) return '';
    return decodeEntities(match[2] !== undefined ? match[2] : match[3]).trim();
}

const VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'source', 'meta', 'link']);

// 按顶层元素切分一段 HTML：返回 [{ name, openTag, inner }]，自闭合标签 inner 为空。
function topLevelElements(html) {
    const out = [];
    const tagRe = /<(\/?)([a-z0-9]+)([^>]*?)(\/?)>/gi;
    let match;
    let depth = 0;
    let current = null;
    while ((match = tagRe.exec(html))) {
        const [full, closing, rawName, rest, selfClose] = match;
        const name = rawName.toLowerCase();
        const isVoid = VOID_TAGS.has(name) || selfClose === '/';
        if (!closing) {
            if (depth === 0) {
                if (isVoid) {
                    out.push({ name, openTag: full, inner: '' });
                    continue;
                }
                current = { name, openTag: full, start: match.index + full.length };
                depth = 1;
            } else if (!isVoid) {
                depth += 1;
            }
            continue;
        }
        if (depth === 0) continue;
        depth -= 1;
        if (depth === 0 && current && current.name === name) {
            out.push({ name, openTag: current.openTag, inner: html.slice(current.start, match.index) });
            current = null;
        }
    }
    return out;
}

function listItems(inner) {
    return topLevelElements(inner)
        .filter((el) => el.name === 'li')
        .map((el) => toText(el.inner))
        .filter(Boolean);
}

function tableRows(inner) {
    const rows = [];
    topLevelElements(inner).forEach((section) => {
        const scope = section.name === 'thead' || section.name === 'tbody' || section.name === 'tfoot' ? section.inner : null;
        const source = scope === null ? (section.name === 'tr' ? [section] : []) : topLevelElements(scope).filter((el) => el.name === 'tr');
        source.forEach((tr) => {
            const cells = topLevelElements(tr.inner)
                .filter((el) => el.name === 'th' || el.name === 'td')
                .map((el) => toText(el.inner));
            if (cells.length) rows.push(cells);
        });
    });
    return rows;
}

function imageBlock(openTag) {
    const src = attr(openTag, 'src');
    if (!src) return null;
    return { t: 'img', src, alt: attr(openTag, 'alt') };
}

function collectBlocks(html, blocks = []) {
    topLevelElements(html).forEach((el) => {
        const { name, inner, openTag } = el;
        switch (name) {
            case 'h1':
            case 'h2':
                push(blocks, { t: 'h2', s: toText(inner) });
                break;
            case 'h3':
            case 'h4':
                push(blocks, { t: 'h3', s: toText(inner) });
                break;
            case 'p': {
                const images = inner.match(/<img\b[^>]*>/gi) || [];
                const text = toText(inner);
                if (images.length && !text) {
                    images.forEach((tag) => push(blocks, imageBlock(tag)));
                    break;
                }
                push(blocks, { t: 'p', s: text });
                break;
            }
            case 'img':
                push(blocks, imageBlock(openTag));
                break;
            case 'ul':
                push(blocks, { t: 'ul', items: listItems(inner) });
                break;
            case 'ol':
                push(blocks, { t: 'ol', items: listItems(inner) });
                break;
            case 'blockquote':
                push(blocks, { t: 'quote', s: toText(inner) });
                break;
            case 'pre':
                push(blocks, { t: 'code', s: decodeEntities(inner.replace(/<\/?code[^>]*>/gi, '').replace(/<[^>]*>/g, '')).replace(/^\n+|\s+$/g, '') });
                break;
            case 'table':
                push(blocks, { t: 'table', rows: tableRows(inner) });
                break;
            case 'hr':
                push(blocks, { t: 'hr' });
                break;
            case 'figure': {
                const img = (inner.match(/<img\b[^>]*>/i) || [])[0];
                const block = img ? imageBlock(img) : null;
                if (block) {
                    const caption = topLevelElements(inner).find((child) => child.name === 'figcaption');
                    if (caption && !block.alt) block.alt = toText(caption.inner);
                    push(blocks, block);
                }
                break;
            }
            default:
                // section / div 之类的包装层继续往里走，正文里的图片经常裹在 div 里。
                if (inner) collectBlocks(inner, blocks);
        }
    });
    return blocks;
}

function push(blocks, block) {
    if (!block) return;
    if (block.t === 'p' && !block.s) return;
    if ((block.t === 'h2' || block.t === 'h3' || block.t === 'quote') && !block.s) return;
    if ((block.t === 'ul' || block.t === 'ol') && !block.items.length) return;
    if (block.t === 'table' && !block.rows.length) return;
    if (block.t === 'code' && !block.s) return;
    if (block.t === 'hr' && blocks.length && blocks[blocks.length - 1].t === 'hr') return;
    blocks.push(block);
}

// 取某个 id 元素的内部 HTML（正文和标签区都靠 id 定位）。
function innerById(html, id) {
    const open = new RegExp(`<([a-z0-9]+)([^>]*\\sid\\s*=\\s*["']${id}["'][^>]*)>`, 'i').exec(html);
    if (!open) return '';
    const name = open[1].toLowerCase();
    const start = open.index + open[0].length;
    const tagRe = new RegExp(`<(/?)${name}\\b[^>]*?(/?)>`, 'gi');
    tagRe.lastIndex = start;
    let depth = 1;
    let match;
    while ((match = tagRe.exec(html))) {
        if (match[2] === '/') continue;
        depth += match[1] ? -1 : 1;
        if (depth === 0) return html.slice(start, match.index);
    }
    return '';
}

// 有的文章正文直接写在 HTML 里但没有 id，退而求其次找 <article> 里的 .prose 容器。
function innerByProse(html) {
    const open = /<div([^>]*\sclass\s*=\s*["'][^"']*\bprose\b[^"']*["'][^>]*)>/i.exec(html);
    if (!open) return '';
    const start = open.index + open[0].length;
    const tagRe = /<(\/?)div\b[^>]*?(\/?)>/gi;
    tagRe.lastIndex = start;
    let depth = 1;
    let match;
    while ((match = tagRe.exec(html))) {
        if (match[2] === '/') continue;
        depth += match[1] ? -1 : 1;
        if (depth === 0) return html.slice(start, match.index);
    }
    return '';
}

// 另一些文章的正文由 js/blog-<slug>.js 在运行时写入，这里把它的 articleLocales.zh 取出来。
// 源文件末尾会操作 DOM，所以整段包在 try/catch 里跑，只要拿到对象就行。
function readLocale(slug) {
    const file = path.join(rootDir, 'js', `blog-${slug}.js`);
    if (!fs.existsSync(file)) return null;
    const patched = fs.readFileSync(file, 'utf8').replace(/\bconst\s+articleLocales\s*=/, 'articleLocales =');
    const element = () => new Proxy({}, {
        get: (_, key) => (key === 'innerHTML' || key === 'textContent' ? '' : element()),
        set: () => true,
        apply: () => element()
    });
    const doc = { getElementById: element, querySelector: element, querySelectorAll: () => [], addEventListener() {}, documentElement: {} };
    const win = { addEventListener() {}, location: { href: '' }, matchMedia: () => ({ matches: false, addEventListener() {} }) };
    try {
        const locales = new Function('document', 'window', 'localStorage', 'navigator',
            `var articleLocales; try { ${patched} } catch (e) {} return articleLocales;`
        )(doc, win, { getItem: () => null, setItem() {} }, { language: 'zh-CN', clipboard: {} });
        return locales && locales.zh ? locales.zh : null;
    } catch (error) {
        return null;
    }
}

function readBlogData() {
    const source = fs.readFileSync(path.join(rootDir, 'js', 'blog-data.js'), 'utf8');
    const sandbox = { window: {} };
    new Function('window', source)(sandbox.window);
    return sandbox.window.YuiBlogData || [];
}

function zh(value) {
    if (!value) return '';
    return typeof value === 'string' ? value : value.zh || '';
}

function build() {
    const posts = readBlogData();
    const articles = {};
    const report = [];

    posts.forEach((post) => {
        const slug = String(post.link || '').replace(/\/$/, '').split('/').pop();
        const file = path.join(rootDir, 'blog', `${slug}.html`);
        if (!slug || !fs.existsSync(file)) {
            report.push(`  跳过 ${slug || post.link}（找不到 blog/${slug}.html）`);
            return;
        }
        const html = fs.readFileSync(file, 'utf8');
        const locale = readLocale(slug);
        // 正文来源按优先级：HTML 里的 #articleBody → js/blog-<slug>.js 的 zh.body → <article> 里的 .prose。
        let body = innerById(html, 'articleBody').trim();
        let source = '#articleBody';
        if (!body && locale && locale.body) {
            body = locale.body;
            source = `js/blog-${slug}.js`;
        }
        if (!body) {
            body = innerByProse(html).trim();
            source = '.prose';
        }
        if (!body) {
            report.push(`  跳过 ${slug}（找不到正文）`);
            return;
        }
        const htmlTags = topLevelElements(innerById(html, 'articleTags'))
            .filter((el) => !/\sdata-i18n\s*=\s*["']tags["']/i.test(el.openTag))
            .map((el) => toText(el.inner))
            .filter((text) => text && !/^tags\s*[:：]?$/i.test(text));
        const tags = htmlTags.length ? htmlTags : ((locale && locale.tags) || []);

        const blocks = collectBlocks(body);
        articles[slug] = {
            slug,
            title: zh(post.title),
            date: zh(post.date),
            readTime: zh(post.readTime),
            excerpt: zh(post.excerpt),
            tags,
            hero: post.image || '',
            blocks
        };
        report.push(`  ${slug}：${blocks.length} 块 · ${tags.length} 标签 · ${source}`);
    });

    const header = [
        '// 由 `node scripts/build-blog-articles.js` 从 blog/*.html 与 js/blog-data.js（中文）生成，请勿手改。',
        '// 首页线索墙点开博客卡片后，就用这里的 blocks 在桌面上渲染手稿。',
        ''
    ].join('\n');
    const body = `window.YuiArticles = ${JSON.stringify(articles, null, 0)};\nwindow.dispatchEvent(new Event('yui-articles'));\n`;
    const out = path.join(rootDir, 'js', 'blog-articles.js');
    fs.writeFileSync(out, header + body, 'utf8');

    console.log('生成 js/blog-articles.js');
    report.forEach((line) => console.log(line));
    console.log(`  共 ${Object.keys(articles).length} 篇 · ${(fs.statSync(out).size / 1024).toFixed(1)} KB`);
}

build();
