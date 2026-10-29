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
    // server.js 只替换第一个带 data-sub2api-link 的标签里的 href，所以入口必须写成 href 在前。
    assert.equal((home.match(/data-sub2api-link/g) || []).length, 1);
    assert.match(home, /href="\/login"[^>]*data-sub2api-link/);
    assert.match(home, /天才程序员中转站/);
    assert.match(home, /Sub2API/);
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

test('Resume 页面展示公开履历，履历和作品集 PDF 在新标签页预览', () => {
    const resume = readFile('resume/index.html');

    // 2026-10-29 起按用户要求去掉下载口令，PDF 直接在浏览器里打开。
    // 中文界面指向中文简历 PDF，日文和英文界面仍然指向日文履歴書。
    for (const name of ['resume_zh', 'resume', 'portfolio']) {
        assert.match(resume, new RegExp(`<a href="/files/WU_JIANXIANG_${name}\\.pdf\\?v=[0-9A-Za-z.-]+"[^>]* target="_blank" rel="noopener">`));
        assert.ok(fs.existsSync(path.join(__dirname, '..', 'files', `WU_JIANXIANG_${name}.pdf`)), `缺少 ${name} PDF`);
    }
    assert.match(resume, /<a href="\/files\/WU_JIANXIANG_resume_zh\.pdf[^"]*" data-l="zh"/);
    assert.match(resume, /<a href="\/files\/WU_JIANXIANG_resume\.pdf[^"]*" data-l="ja"/);
    // 中文简历只放邮箱，不放现住所、电话和出生日期（日文履歴書是用户明确选择公开的，这份不是）。
    const zhSource = readFile('scripts/resume-zh/resume-zh.html');
    assert.doesNotMatch(zhSource, /福井县福井市|福井県福井市|牧岛|牧島|9457|910-0017|2003/);
    assert.match(zhSource, /xiaobianfuai@gmail\.com/);
    assert.doesNotMatch(resume, /resume-download/);
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

test('Resume 页面三种语言的文案成套出现，日期用汉字数字', () => {
    const resume = readFile('resume/index.html');
    const count = (lang) => (resume.match(new RegExp(`data-l="${lang}"`, 'g')) || []).length;

    assert.ok(count('zh') > 20);
    assert.equal(count('ja'), count('zh'), '日文和中文的文案数量不一致');
    assert.equal(count('en'), count('zh'), '英文和中文的文案数量不一致');
    assert.match(resume, /二〇二六年九月/);
    assert.ok(resume.includes('src="/js/site.js?v='), '履历页缺少 /js/site.js');
    assert.doesNotMatch(resume, /data-i18n=/, '侘寂版不再走 lang.js 的 data-i18n');
});
