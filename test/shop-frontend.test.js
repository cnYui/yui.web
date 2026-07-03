const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

function readFile(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function listFiles(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) return listFiles(fullPath);
        return entry.isFile() ? [fullPath] : [];
    });
}

test('Shop 源码只保留 Sub2API 跳转入口', () => {
    const shopRoot = path.join(__dirname, '..', 'shop');
    const files = listFiles(shopRoot)
        .map((filePath) => path.relative(shopRoot, filePath).split(path.sep).join('/'))
        .sort();

    assert.deepEqual(files, ['index.html']);

    const home = readFile('shop/index.html');
    assert.match(home, /src="\/images\/optimized\/shop\/code-transit-entry\.webp"/);
    assert.match(home, /data-sub2api-link/);
    assert.match(home, /href="\/home"[^>]*data-sub2api-link/);
    assert.match(home, /aria-label="进入 Sub2API"/);
    assert.doesNotMatch(home, /\/shop\/login/);
    assert.doesNotMatch(home, /\/shop\/account/);
    assert.doesNotMatch(home, /\/shop\/admin/);
    assert.doesNotMatch(home, /\/shop\/shop\.js/);
});

test('站内移动端菜单按钮必须绑定可展开导航', () => {
    const ignoredDirs = new Set(['.git', '.worktrees', 'node_modules', 'data', 'public-dist']);
    const projectRoot = path.join(__dirname, '..');
    const listHtmlFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true })
        .flatMap((entry) => {
            if (ignoredDirs.has(entry.name)) return [];
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) return listHtmlFiles(fullPath);
            return entry.isFile() && entry.name.endsWith('.html') ? [fullPath] : [];
        });

    const violations = listHtmlFiles(projectRoot)
        .map((filePath) => ({
            relativePath: path.relative(projectRoot, filePath),
            html: fs.readFileSync(filePath, 'utf8')
        }))
        .filter(({ html }) => /<button[^>]*md:hidden[\s\S]*?material-symbols-outlined[\s\S]*?>\s*menu\s*<\/span>/m.test(html))
        .flatMap(({ relativePath, html }) => {
            const missing = [];
            if (!/<script[^>]+src="\/js\/mobile-menu\.js"/.test(html)) {
                missing.push('缺少 /js/mobile-menu.js');
            }
            if (!/id="mobileMenuToggle"/.test(html)) missing.push('缺少 #mobileMenuToggle');
            if (!/aria-controls="mobileMenu"/.test(html)) missing.push('缺少 aria-controls="mobileMenu"');
            if (!/aria-expanded="false"/.test(html)) missing.push('缺少 aria-expanded="false"');
            if (!/<nav[^>]+id="mobileMenu"/.test(html)) missing.push('缺少 #mobileMenu 导航');
            return missing.map((message) => `${relativePath}: ${message}`);
        });

    assert.deepEqual(violations, []);
});

test('公共顶部导航支持 Shop 的中英日翻译', () => {
    const script = readFile('js/lang.js');

    assert.match(script, /shop:\s*'商店'/);
    assert.match(script, /shop:\s*'Shop'/);
    assert.match(script, /shop:\s*'ショップ'/);
    assert.match(script, /href\.includes\('\/shop'\)[\s\S]*data\.nav\.shop/);
    assert.match(script, /path === '\/shop' \|\| path\.startsWith\('\/shop\/'\)[\s\S]*return null/);
});

test('Resume 页面展示公开履历并提供原始 PDF 下载', () => {
    const resume = readFile('resume/index.html');

    assert.match(resume, /href="\/files\/WU_JIANXIANG_resume\.pdf"/);
    assert.match(resume, /download="WU_JIANXIANG_resume\.pdf"/);
    assert.match(resume, /xiaobianfuai@gmail\.com/);
    assert.match(resume, /University of Fukui/);
    assert.match(resume, /Shandong Jiaotong University/);
    assert.match(resume, /JLPT N2/);
    assert.match(resume, /TOEIC 850/);
    assert.match(resume, /TOEFL iBT 84/);
    assert.match(resume, /Multimodal RAG/);
    assert.match(resume, /Rokid AR AI/);
    assert.doesNotMatch(resume, /福井県福井市文京3丁目9番1号/);
    assert.doesNotMatch(resume, /牧島ハウス109/);
    assert.doesNotMatch(resume, /9457-8304/);
    assert.doesNotMatch(resume, /15951875192/);
});
