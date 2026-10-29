// 随笔列表（侘寂版）：按 js/blog-data.js 渲染，按年分组，最新在前。
// 日期写法：中文、日文都用汉字数字（十月十日），英文用 Oct 10；切换语言时整表重排。
(function () {
    'use strict';

    var list = document.getElementById('postList');
    if (!list || !Array.isArray(window.YuiBlogData)) return;

    var MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    var DIGITS = '〇一二三四五六七八九';

    // 1–99 的汉字写法：十、十二、二十、三十一。
    function hanziCount(n) {
        if (n < 10) return DIGITS[n];
        var tens = Math.floor(n / 10);
        var ones = n % 10;
        return (tens > 1 ? DIGITS[tens] : '') + '十' + (ones ? DIGITS[ones] : '');
    }

    function hanziYear(y) {
        return String(y).split('').map(function (d) { return DIGITS[d]; }).join('');
    }

    function currentLang() {
        return window.YuiSite ? window.YuiSite.getLang() : 'zh';
    }

    function dateLabel(iso, lang) {
        var parts = iso.split('-').map(Number);
        if (lang === 'en') return MONTHS_EN[parts[1] - 1] + ' ' + parts[2];
        return hanziCount(parts[1]) + '月' + hanziCount(parts[2]) + '日';
    }

    function minutesLabel(post, lang) {
        var n = parseInt(String((post.readTime && post.readTime.zh) || ''), 10);
        if (!n) return '';
        if (lang === 'en') return n + ' min read';
        return hanziCount(n) + (lang === 'ja' ? '分' : '分钟');
    }

    function pick(field, lang) {
        if (!field) return '';
        return field[lang] || field.zh || '';
    }

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text) node.textContent = text;
        return node;
    }

    function render() {
        var lang = currentLang();
        var posts = window.YuiBlogData.slice().sort(function (a, b) {
            return String(b.publishedAt).localeCompare(String(a.publishedAt));
        });
        var years = [];
        posts.forEach(function (post) {
            var y = String(post.publishedAt).slice(0, 4);
            var group = years[years.length - 1];
            if (!group || group.year !== y) years.push(group = { year: y, posts: [] });
            group.posts.push(post);
        });

        list.textContent = '';
        years.forEach(function (group) {
            var section = el('section', 'posts-year');
            var heading = el('h2', 'block-label', lang === 'en' ? group.year : hanziYear(group.year));
            section.appendChild(heading);
            var ol = el('ol', 'posts');
            group.posts.forEach(function (post) {
                var li = el('li');
                var a = el('a');
                a.href = post.link;
                a.appendChild(el('span', 'post-date', dateLabel(post.publishedAt, lang)));
                var main = el('span', 'post-main');
                main.appendChild(el('span', 'post-title', pick(post.title, lang)));
                main.appendChild(el('span', 'post-excerpt', pick(post.excerpt, lang)));
                var minutes = minutesLabel(post, lang);
                if (minutes) main.appendChild(el('span', 'post-minutes', minutes));
                a.appendChild(main);
                li.appendChild(a);
                ol.appendChild(li);
            });
            section.appendChild(ol);
            list.appendChild(section);
        });
    }

    render();
    window.addEventListener('languageChanged', render);
})();
