// 首页线索墙的语言预处理：必须是 <head> 里的同步 <script src>，在首屏绘制前定下语言。
// 站点 CSP 是 script-src 'self'，不能写内联脚本，所以单独成文件。
//
// 语言的取值顺序：访客在任意页面点过切换器后存下的选择（和子页面共用 yui-portfolio-lang）
// → 浏览器语言（zh* 中文 / ja* 日语，其余一律英语）。检测结果不会写回存储，只有点击切换器才会存。
// 非中文时先给 <html> 打上 data-i18n-pending，样式会把墙藏起来，等 js/clue-i18n.js 把文案换好再显示，
// 避免英文 / 日文访客先看到一闪而过的中文；样式里另有 1.5 秒兜底，脚本加载失败也不会一直黑屏。
(function () {
    var KEY = 'yui-portfolio-lang';
    var HTML_LANG = { zh: 'zh-CN', en: 'en', ja: 'ja' };

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

    var html = document.documentElement;
    html.lang = HTML_LANG[lang];
    if (lang !== 'zh') html.setAttribute('data-i18n-pending', '');

    window.YuiLangInit = { key: KEY, lang: lang, htmlLang: HTML_LANG };
})();
