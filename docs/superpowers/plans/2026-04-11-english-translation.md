# English Translation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a complete English version of the site by translating all remaining Chinese user-facing text while preserving the existing `zh/en/ja` language toggle.

**Architecture:** Keep the current translation entry point in `js/lang.js`, then patch each page that still renders hard-coded Chinese text or language-specific runtime strings outside that shared layer. Treat article bodies, the standalone skill page, and the 404 page as direct HTML translation tasks because they are content-heavy or not fully driven by the existing translation map.

**Tech Stack:** Static HTML, vanilla JavaScript, Tailwind via CDN, existing `js/lang.js` translation system

---

## File Structure

### Existing files to modify

- `D:\CodeWorkSpace\yui.web\js\lang.js`
  Responsibility: shared translations, page-specific translations, current language helpers, and event dispatch for runtime language updates.
- `D:\CodeWorkSpace\yui.web\index.html`
  Responsibility: homepage hero, selected works, blog preview, and footer/default copy.
- `D:\CodeWorkSpace\yui.web\projects\index.html`
  Responsibility: project timeline content, category labels, quotes, and project card text.
- `D:\CodeWorkSpace\yui.web\travel\index.html`
  Responsibility: travel content, city filters, cards, and load-more/default copy.
- `D:\CodeWorkSpace\yui.web\music\index.html`
  Responsibility: music collection content, genres, cards, load-more states, and footer copy.
- `D:\CodeWorkSpace\yui.web\anime\index.html`
  Responsibility: anime collection content, genres, cards, load-more states, and footer copy.
- `D:\CodeWorkSpace\yui.web\resume\index.html`
  Responsibility: resume timeline, education, skills, awards, and footer/default copy.
- `D:\CodeWorkSpace\yui.web\blog\index.html`
  Responsibility: blog landing page article cards, filters, author panel, and load-more behavior.
- `D:\CodeWorkSpace\yui.web\blog\article.html`
  Responsibility: generic blog article shell, related articles section, tag/share labels, and share button runtime strings.
- `D:\CodeWorkSpace\yui.web\blog\ai-image-video.html`
  Responsibility: full article content, tags, share button runtime strings, metadata, and image alt/caption text.
- `D:\CodeWorkSpace\yui.web\blog\vibe-coding.html`
  Responsibility: full article content, tags, share button runtime strings, metadata, and image alt text.
- `D:\CodeWorkSpace\yui.web\skill\index.html`
  Responsibility: standalone skill landing page content that is not fully dependent on `lang.js`.
- `D:\CodeWorkSpace\yui.web\404.html`
  Responsibility: not-found page default content.

### Existing docs to reference

- `D:\CodeWorkSpace\yui.web\docs\superpowers\specs\2026-04-11-english-translation-design.md`
  Responsibility: approved scope and implementation constraints for the translation work.

## Task 1: Audit The Active Translation Surface

**Files:**
- Modify: `D:\CodeWorkSpace\yui.web\docs\superpowers\plans\2026-04-11-english-translation.md`
- Verify: `D:\CodeWorkSpace\yui.web\js\lang.js`
- Verify: `D:\CodeWorkSpace\yui.web\index.html`
- Verify: `D:\CodeWorkSpace\yui.web\projects\index.html`
- Verify: `D:\CodeWorkSpace\yui.web\travel\index.html`
- Verify: `D:\CodeWorkSpace\yui.web\music\index.html`
- Verify: `D:\CodeWorkSpace\yui.web\anime\index.html`
- Verify: `D:\CodeWorkSpace\yui.web\resume\index.html`
- Verify: `D:\CodeWorkSpace\yui.web\blog\index.html`
- Verify: `D:\CodeWorkSpace\yui.web\blog\article.html`
- Verify: `D:\CodeWorkSpace\yui.web\blog\ai-image-video.html`
- Verify: `D:\CodeWorkSpace\yui.web\blog\vibe-coding.html`
- Verify: `D:\CodeWorkSpace\yui.web\skill\index.html`
- Verify: `D:\CodeWorkSpace\yui.web\404.html`

- [ ] **Step 1: Record the page set and current risk areas**

```text
Pages in scope:
- /index.html
- /projects/index.html
- /travel/index.html
- /music/index.html
- /anime/index.html
- /resume/index.html
- /blog/index.html
- /blog/article.html
- /blog/ai-image-video.html
- /blog/vibe-coding.html
- /skill/index.html
- /404.html

Risk areas:
- hard-coded Chinese outside data-i18n
- inline scripts building English/Chinese messages manually
- article bodies in direct HTML
- skill page outside the main translation path
```

- [ ] **Step 2: Run the Chinese-text scan to establish the baseline**

```powershell
Get-ChildItem -Recurse -File -Include *.html,*.js |
  ForEach-Object {
    $matches = Select-String -Path $_.FullName -Pattern '[\p{IsCJKUnifiedIdeographs}]' -AllMatches
    if ($matches) { "$($_.FullName): $(($matches | Measure-Object).Count) lines" }
  }
```

Expected: results should include the 12 in-scope files plus `js/lang.js`, confirming what still needs translation work.

- [ ] **Step 3: Commit the audit checkpoint**

```bash
git add docs/superpowers/plans/2026-04-11-english-translation.md
git commit -m "docs: add English translation implementation plan"
```

## Task 2: Complete Shared Translation Entries In `js/lang.js`

**Files:**
- Modify: `D:\CodeWorkSpace\yui.web\js\lang.js`

- [ ] **Step 1: Add or correct missing English strings used by `data-i18n` and `data-i18n-placeholder`**

```js
// Example target shape to preserve:
blog: {
  en: {
    backToBlog: 'Back to Blog',
    tags: 'Tags:',
    shareArticle: 'Share this article:',
    relatedArticles: 'Related Articles'
  }
}
```

- [ ] **Step 2: Ensure the special pages still resolve to the right translation group**

```js
function detectPage() {
  const path = window.location.pathname;
  if (path === '/404.html') return 'notfound';
  if (path.includes('/skill')) return 'skill';
  if (path.includes('/blog')) return 'blog';
  // keep the remaining page checks unchanged
}
```

- [ ] **Step 3: Verify the translation file still parses**

```powershell
@'
const fs = require("fs");
const vm = require("vm");
const src = fs.readFileSync("D:/CodeWorkSpace/yui.web/js/lang.js", "utf8");
vm.runInNewContext(src, { window: {}, document: { querySelectorAll(){ return []; }, documentElement: {} }, localStorage: { getItem(){ return "en"; }, setItem(){} }, CustomEvent: function(){}, console });
console.log("lang.js parsed");
'@ | node -
```

Expected: `lang.js parsed`

- [ ] **Step 4: Commit the shared translation update**

```bash
git add js/lang.js
git commit -m "feat: complete English translation entries"
```

## Task 3: Translate Core Site Pages With Hard-Coded Defaults

**Files:**
- Modify: `D:\CodeWorkSpace\yui.web\index.html`
- Modify: `D:\CodeWorkSpace\yui.web\projects\index.html`
- Modify: `D:\CodeWorkSpace\yui.web\resume\index.html`

- [ ] **Step 1: Translate the homepage default copy and preview cards**

```html
<h3 class="text-xl font-serif font-medium text-text-main dark:text-dark-text">Yukesong Google GDG - 1st Place</h3>
<p class="text-sm text-text-muted dark:text-dark-text-muted font-light line-clamp-2 leading-relaxed">Won first place in the Google GDG track at the Yukesong hackathon.</p>
```

- [ ] **Step 2: Translate the projects page timeline and category text**

```html
<button class="filter-btn ..." data-filter="Hackathon" data-i18n="hackathon">Hackathon</button>
<blockquote class="text-2xl md:text-3xl font-display italic text-text-main dark:text-dark-text leading-relaxed" data-i18n="quote">
  "Every hackathon is an opportunity to learn something new, meet amazing people, and push my limits."
</blockquote>
```

- [ ] **Step 3: Translate resume-only hard-coded entries and award labels**

```html
<h3 class="text-lg font-serif font-medium text-text-main dark:text-dark-text" data-i18n="award1Title">Outstanding Graduation Project</h3>
<p class="text-sm text-text-muted dark:text-dark-text-muted" data-i18n="award1Source">Shandong Jiaotong University • 2025</p>
```

- [ ] **Step 4: Verify no unexpected Chinese remains in the three pages**

```powershell
Select-String -Path `
  'D:\CodeWorkSpace\yui.web\index.html',`
  'D:\CodeWorkSpace\yui.web\projects\index.html',`
  'D:\CodeWorkSpace\yui.web\resume\index.html' `
  -Pattern '[\p{IsCJKUnifiedIdeographs}]'
```

Expected: only intentional exceptions such as image filenames or non-user-facing values should remain.

- [ ] **Step 5: Commit the core page translation batch**

```bash
git add index.html projects/index.html resume/index.html
git commit -m "feat: translate core site pages to English"
```

## Task 4: Translate Collection Pages And Their Runtime Strings

**Files:**
- Modify: `D:\CodeWorkSpace\yui.web\travel\index.html`
- Modify: `D:\CodeWorkSpace\yui.web\music\index.html`
- Modify: `D:\CodeWorkSpace\yui.web\anime\index.html`

- [ ] **Step 1: Translate visible default text and card content in travel, music, and anime**

```html
<span class="text-sm font-medium" data-i18n="all">All</span>
<span id="showingCount" class="text-text-muted dark:text-dark-text-muted text-sm"><span data-i18n="showing">Showing</span> 8 / 31</span>
```

- [ ] **Step 2: Update inline runtime language branches for buttons and end states**

```js
const lang = window.YuiLang ? window.YuiLang.getCurrentLang() : 'zh';
const loadMoreText = lang === 'zh' ? '加载更多番剧' : 'Load More Titles';
const endTitle = lang === 'zh' ? '收藏到底了！' : "That's the collection!";
```

- [ ] **Step 3: Trigger a targeted scan for remaining Chinese in these collection pages**

```powershell
Select-String -Path `
  'D:\CodeWorkSpace\yui.web\travel\index.html',`
  'D:\CodeWorkSpace\yui.web\music\index.html',`
  'D:\CodeWorkSpace\yui.web\anime\index.html' `
  -Pattern '[\p{IsCJKUnifiedIdeographs}]'
```

Expected: results should be limited to intentional non-UI references if any remain.

- [ ] **Step 4: Commit the collection page batch**

```bash
git add travel/index.html music/index.html anime/index.html
git commit -m "feat: translate collection pages to English"
```

## Task 5: Translate Blog Listing And Shared Article Chrome

**Files:**
- Modify: `D:\CodeWorkSpace\yui.web\blog\index.html`
- Modify: `D:\CodeWorkSpace\yui.web\blog\article.html`

- [ ] **Step 1: Translate blog index cards, excerpts, and load-more defaults**

```html
<h3 class="text-xl font-serif font-medium leading-tight group-hover:text-gray-600 dark:group-hover:text-gray-400 transition-colors text-text-main dark:text-dark-text">Practical Guide to Vibe Coding</h3>
<p class="text-sm text-text-muted dark:text-dark-text-muted font-light line-clamp-2 leading-relaxed">A summary of more than a year of AI coding experience, from ideation to debugging techniques.</p>
```

- [ ] **Step 2: Translate article shell copy and share-button feedback**

```js
try {
  await navigator.clipboard.writeText(url);
  showToast('Link copied');
} catch (err) {
  console.error('Failed to copy: ', err);
  showToast('Copy failed');
}
```

- [ ] **Step 3: Verify the blog index and generic article shell no longer surface Chinese by default**

```powershell
Select-String -Path `
  'D:\CodeWorkSpace\yui.web\blog\index.html',`
  'D:\CodeWorkSpace\yui.web\blog\article.html' `
  -Pattern '[\p{IsCJKUnifiedIdeographs}]'
```

Expected: only intentional exceptions such as article file names or content references should remain.

- [ ] **Step 4: Commit the blog shell batch**

```bash
git add blog/index.html blog/article.html
git commit -m "feat: translate blog listing and article shell"
```

## Task 6: Translate Full Blog Article Bodies

**Files:**
- Modify: `D:\CodeWorkSpace\yui.web\blog\ai-image-video.html`
- Modify: `D:\CodeWorkSpace\yui.web\blog\vibe-coding.html`

- [ ] **Step 1: Translate article metadata, title, subtitle, body copy, tags, and image alt text in `ai-image-video.html`**

```html
<h1 class="text-4xl md:text-5xl font-display font-bold text-primary dark:text-dark-text leading-tight mb-6">
  My Experience And Lessons From AI Image And Video Generation
</h1>
<p class="text-xl text-text-muted dark:text-dark-text-muted font-light leading-relaxed">
  AI is just a tool. What makes us human is how we use tools.
</p>
```

- [ ] **Step 2: Translate article metadata, title, subtitle, body copy, tags, and image alt text in `vibe-coding.html`**

```html
<h2 class="text-primary dark:text-dark-text">Introduction</h2>
<p>I have used AI coding heavily since last October across graduation projects, React + TypeScript, Flutter, WeChat mini programs, and Android development.</p>
```

- [ ] **Step 3: Update article share-button toast strings to English**

```js
showToast('Link copied');
showToast('Copy failed');
```

- [ ] **Step 4: Scan both article files for remaining Chinese**

```powershell
Select-String -Path `
  'D:\CodeWorkSpace\yui.web\blog\ai-image-video.html',`
  'D:\CodeWorkSpace\yui.web\blog\vibe-coding.html' `
  -Pattern '[\p{IsCJKUnifiedIdeographs}]'
```

Expected: only intentional exceptions such as image filenames may remain.

- [ ] **Step 5: Commit the full article translation batch**

```bash
git add blog/ai-image-video.html blog/vibe-coding.html
git commit -m "feat: translate full blog articles to English"
```

## Task 7: Translate Standalone Pages And Run Final Verification

**Files:**
- Modify: `D:\CodeWorkSpace\yui.web\skill\index.html`
- Modify: `D:\CodeWorkSpace\yui.web\404.html`
- Verify: `D:\CodeWorkSpace\yui.web\js\lang.js`
- Verify: `D:\CodeWorkSpace\yui.web\index.html`
- Verify: `D:\CodeWorkSpace\yui.web\projects\index.html`
- Verify: `D:\CodeWorkSpace\yui.web\travel\index.html`
- Verify: `D:\CodeWorkSpace\yui.web\music\index.html`
- Verify: `D:\CodeWorkSpace\yui.web\anime\index.html`
- Verify: `D:\CodeWorkSpace\yui.web\resume\index.html`
- Verify: `D:\CodeWorkSpace\yui.web\blog\index.html`
- Verify: `D:\CodeWorkSpace\yui.web\blog\article.html`
- Verify: `D:\CodeWorkSpace\yui.web\blog\ai-image-video.html`
- Verify: `D:\CodeWorkSpace\yui.web\blog\vibe-coding.html`
- Verify: `D:\CodeWorkSpace\yui.web\skill\index.html`
- Verify: `D:\CodeWorkSpace\yui.web\404.html`

- [ ] **Step 1: Translate the standalone skill page default UI**

```html
<title>Yui Intro Skill</title>
<a class="brand" href="/">Portfolio.</a>
<span class="status">Loading /SKILL.md...</span>
```

- [ ] **Step 2: Translate the 404 page default UI**

```html
<h2 class="text-2xl font-display text-gray-800 mb-4">Page Not Found</h2>
<p class="text-gray-500 mb-8">Sorry, the page you are looking for does not exist.</p>
<a href="/" class="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-md hover:bg-gray-700 transition-colors">
  Back Home
</a>
```

- [ ] **Step 3: Run the final Chinese-text scan across the full implementation surface**

```powershell
Get-ChildItem -Recurse -File -Include *.html,*.js |
  ForEach-Object {
    $matches = Select-String -Path $_.FullName -Pattern '[\p{IsCJKUnifiedIdeographs}]' -AllMatches
    if ($matches) { "$($_.FullName): $(($matches | Measure-Object).Count) lines" }
  }
```

Expected: the remaining hits should be deliberate multilingual data in `js/lang.js`, image filenames, or preserved non-English content outside the active English surface. No unintended Chinese user-facing defaults should remain in the in-scope pages.

- [ ] **Step 4: Parse-check the translation script one more time**

```powershell
@'
const fs = require("fs");
const vm = require("vm");
const src = fs.readFileSync("D:/CodeWorkSpace/yui.web/js/lang.js", "utf8");
vm.runInNewContext(src, { window: { addEventListener() {}, dispatchEvent() {} }, document: { querySelectorAll(){ return []; }, documentElement: {} }, localStorage: { getItem(){ return "en"; }, setItem(){} }, CustomEvent: function(){}, console });
console.log("lang.js parsed");
'@ | node -
```

Expected: `lang.js parsed`

- [ ] **Step 5: Commit the standalone pages and verification checkpoint**

```bash
git add skill/index.html 404.html js/lang.js index.html projects/index.html travel/index.html music/index.html anime/index.html resume/index.html blog/index.html blog/article.html blog/ai-image-video.html blog/vibe-coding.html
git commit -m "feat: complete English translation rollout"
```
