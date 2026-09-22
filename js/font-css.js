// 把 Google Fonts 的样式表从 media="print" 切回 media="all"。
//
// 页面里字体 CSS 用 <link rel="stylesheet" media="print" data-font-css> 引入：
// media 不匹配时浏览器照常下载，但不把它算进首屏渲染的关键路径。等 HTML 解析完
// 再启用，fonts.googleapis.com 慢或者不通时首屏就不会跟着一起卡住（字体本身有
// display=swap，晚到的字形照常换入）。
//
// 这个文件必须用 defer 引入：defer 脚本在文档解析结束后才执行，那时 <link> 都已
// 经在 DOM 里了。CSP 是 script-src 'self'，所以不能写成 onload 内联属性。
(function () {
    function enableFontCss() {
        document.querySelectorAll('link[data-font-css]').forEach(function (link) {
            if (link.media !== 'all') link.media = 'all';
        });
    }

    enableFontCss();

    // 正常情况下上面一次就够了；万一哪天引用处漏了 defer，这里再兜一次。
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enableFontCss);
    }
})();
