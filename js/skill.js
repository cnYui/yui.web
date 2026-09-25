const statusEl = document.getElementById("status");
const contentEl = document.getElementById("content");

function removeFrontmatter(markdown) {
  return markdown.replace(/^---[\s\S]*?---\s*/, "");
}

function renderMarkdown(markdown) {
  // marked 由 /js/markdown/marked.umd.js 同步挂到 window 上；站点 CSP 是 script-src 'self'，不能回退到 CDN。
  if (!window.marked) throw new Error("marked (/js/markdown/marked.umd.js) not loaded");
  window.marked.setOptions({ gfm: true });
  return window.marked.parse(removeFrontmatter(markdown));
}

fetch("/SKILL.md", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  })
  .then((markdown) => {
    // 先渲染再移除状态行：渲染失败时还要靠它显示错误，否则页面只剩空白。
    contentEl.innerHTML = renderMarkdown(markdown);
    statusEl.remove();
  })
  .catch((error) => {
    const lang = window.YuiLang ? window.YuiLang.getCurrentLang() : "zh";
    const prefix = window.YuiLang ? window.YuiLang.getText("skill", "loadError", lang) : "Failed to load /SKILL.md:";
    statusEl.textContent = `${prefix} ${error.message}`;
  });
