(function () {
    const html = document.documentElement;
    html.setAttribute('data-ui-ready', 'false');

    try {
        const theme = localStorage.getItem('yui-portfolio-theme');
        const lang = localStorage.getItem('yui-portfolio-lang');
        const langMap = { zh: 'zh-CN', en: 'en', ja: 'ja' };
        const resolvedTheme = theme === 'dark' ? 'dark' : 'light';
        html.classList.toggle('dark', resolvedTheme === 'dark');
        html.style.colorScheme = resolvedTheme;
        html.style.backgroundColor = resolvedTheme === 'dark' ? '#0f0f0f' : '#ffffff';
        html.lang = langMap[lang] || 'en';
    } catch (error) {
        html.style.colorScheme = 'light';
        html.style.backgroundColor = '#ffffff';
        html.lang = 'en';
    }
})();
