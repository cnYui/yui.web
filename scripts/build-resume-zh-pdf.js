// 把 scripts/resume-zh/resume-zh.html 用无头 Edge / Chrome 打印成 files/WU_JIANXIANG_resume_zh.pdf（中文简历）。
// 用法：node scripts/build-resume-zh-pdf.js；找不到浏览器时用环境变量 BROWSER_PATH 指定。
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'scripts', 'resume-zh', 'resume-zh.html');
const output = path.join(root, 'files', 'WU_JIANXIANG_resume_zh.pdf');

const candidates = [
    process.env.BROWSER_PATH,
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
].filter(Boolean);
const browser = candidates.find((candidate) => fs.existsSync(candidate));
if (!browser) {
    console.error('找不到 Edge / Chrome，请用 BROWSER_PATH 指定。');
    process.exit(1);
}

execFileSync(browser, [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${output}`,
    pathToFileURL(source).href
], { stdio: 'inherit' });
console.log(`${path.relative(root, output)} ${fs.statSync(output).size} bytes`);
