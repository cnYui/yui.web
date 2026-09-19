// Pre-paint setup shared by static pages. Load it as a plain (non-deferred)
// <script src> near the top of <head> so theme, language and the data-ui-ready
// gate are applied before the first paint. A page whose language should fall
// back to something other than English sets data-default-lang on the tag.
(function () {
    const html = document.documentElement;
    html.setAttribute('data-ui-ready', 'false');

    const script = document.currentScript;
    const fallbackLang = (script && script.dataset.defaultLang) || 'en';

    try {
        const theme = localStorage.getItem('yui-portfolio-theme');
        const lang = localStorage.getItem('yui-portfolio-lang');
        const langMap = { zh: 'zh-CN', en: 'en', ja: 'ja' };
        const resolvedTheme = theme === 'dark' ? 'dark' : 'light';
        html.classList.toggle('dark', resolvedTheme === 'dark');
        html.style.colorScheme = resolvedTheme;
        html.style.backgroundColor = resolvedTheme === 'dark' ? '#0f0f0f' : '#ffffff';
        html.lang = langMap[lang] || fallbackLang;
    } catch (error) {
        html.style.colorScheme = 'light';
        html.style.backgroundColor = '#ffffff';
        html.lang = fallbackLang;
    }
})();
