const statusEl = document.getElementById("status");
const contentEl = document.getElementById("content");

function removeFrontmatter(markdown) {
  return markdown.replace(/^---[\s\S]*?---\s*/, "");
}

fetch("/SKILL.md", { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.text();
  })
  .then((markdown) => {
    statusEl.remove();
    marked.setOptions({ gfm: true });
    contentEl.innerHTML = marked.parse(removeFrontmatter(markdown));
  })
  .catch((error) => {
    const lang = window.YuiLang ? window.YuiLang.getCurrentLang() : "zh";
    const prefix = window.YuiLang ? window.YuiLang.getText("skill", "loadError", lang) : "Failed to load /SKILL.md:";
    statusEl.textContent = `${prefix} ${error.message}`;
  });
