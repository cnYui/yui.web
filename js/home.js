// 首页（侘寂竖排单屏）：必须是 <head> 里第一个同步 <script src>，在首屏绘制前定下语言。
// 站点 CSP 是 script-src 'self'，不能写内联脚本，所以单独成文件。
//
// 语言的取值顺序：访客在任意页面点过切换器后存下的选择（和子页面共用 yui-portfolio-lang）
// → 浏览器语言（zh* 中文 / ja* 日语，其余一律英语）。检测结果不写回存储，只有点击切换器才会存。
// 三种语言的文案都写在 index.html 里，styles/home.css 按 <html lang> 只显示一种：
// 换语言不改 DOM，没有闪烁；脚本加载失败时停在页面默认的中文。
//
// 旧线索墙的分享链接（#projects、#blog……）在这里直接转到对应的子页面；#about 就是首页本身，不转。
(function () {
    var KEY = 'yui-portfolio-lang';
    var HTML_LANG = { zh: 'zh-CN', ja: 'ja', en: 'en' };
    var LEGACY_HASH = {
        projects: '/projects/',
        blog: '/blog/',
        resume: '/resume/',
        travel: '/travel/',
        photos: '/travel/',
        shop: '/shop/'
    };

    function redirectLegacyHash() {
        var target = LEGACY_HASH[String(location.hash || '').replace(/^#/, '')];
        if (target) location.replace(target);
        return Boolean(target);
    }

    if (redirectLegacyHash()) return;
    // 停在首页时只改锚点不会重新加载页面，所以还要听 hashchange。
    window.addEventListener('hashchange', redirectLegacyHash);

    function detect() {
        var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language];
        for (var i = 0; i < list.length; i += 1) {
            var tag = String(list[i] || '').toLowerCase();
            if (tag.indexOf('zh') === 0) return 'zh';
            if (tag.indexOf('ja') === 0) return 'ja';
            if (tag.indexOf('en') === 0) return 'en';
        }
        return 'en';
    }

    var lang = null;
    try { lang = localStorage.getItem(KEY); } catch (error) { lang = null; }
    if (!HTML_LANG[lang]) lang = detect();

    var root = document.documentElement;

    function apply(next) {
        lang = next;
        root.lang = HTML_LANG[lang];
        var buttons = document.querySelectorAll('[data-set-lang]');
        for (var i = 0; i < buttons.length; i += 1) {
            buttons[i].setAttribute('aria-pressed', String(buttons[i].getAttribute('data-set-lang') === lang));
        }
        var labelled = document.querySelectorAll('[data-aria-' + lang + ']');
        for (var j = 0; j < labelled.length; j += 1) {
            labelled[j].setAttribute('aria-label', labelled[j].getAttribute('data-aria-' + lang));
        }
    }

    apply(lang);

    document.addEventListener('DOMContentLoaded', function () {
        apply(lang);
        document.addEventListener('click', function (event) {
            var button = event.target && event.target.closest ? event.target.closest('[data-set-lang]') : null;
            if (!button) return;
            var next = button.getAttribute('data-set-lang');
            if (!HTML_LANG[next]) return;
            try { localStorage.setItem(KEY, next); } catch (error) { /* 存不了（无痕模式等）就只影响本页 */ }
            apply(next);
        });
    });

    window.YuiHome = { key: KEY, htmlLang: HTML_LANG, legacyHash: LEGACY_HASH };
})();
