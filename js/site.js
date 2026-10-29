// 全站共用（侘寂版）：每个页面 <head> 里第一个同步 <script src>，在首屏绘制前定下语言。
// 站点 CSP 是 script-src 'self'，不能写内联脚本，所以单独成文件。
//
// 语言：访客点过切换器后存下的选择（yui-portfolio-lang，全站共用）→ 浏览器语言
// （zh* 中文 / ja* 日语，其余英语）。检测结果不写回存储，只有点击切换器才会存。
// 三种语言的文案都写在页面里（[data-l]），styles/wabi.css 按 <html lang> 只显示一种；
// 换语言不改 DOM、没有闪烁，脚本加载失败时停在页面默认的中文。
// 由脚本渲染的内容（随笔列表、行旅、文章译文）监听 languageChanged 事件自己重排。
//
// 节气：按太阳视黄经推算（Meeus 简化式，误差约一刻钟），以北京时间当天结束时刻判定，
// 每 15° 一个节气、每 5° 一候。页面里 [data-season] 的元素由这里填字，随日期自动变。
(function () {
    var KEY = 'yui-portfolio-lang';
    var HTML_LANG = { zh: 'zh-CN', ja: 'ja', en: 'en' };
    // 旧线索墙的分享链接（#projects、#blog……）只在首页转到对应子页面。
    var LEGACY_HASH = {
        projects: '/projects/',
        blog: '/blog/',
        resume: '/resume/',
        travel: '/travel/',
        photos: '/travel/',
        shop: '/shop/'
    };

    // 二十四节气与七十二候，都从春分（黄经 0°）起排。
    var TERMS = {
        zh: '春分 清明 谷雨 立夏 小满 芒种 夏至 小暑 大暑 立秋 处暑 白露 秋分 寒露 霜降 立冬 小雪 大雪 冬至 小寒 大寒 立春 雨水 惊蛰'.split(' '),
        ja: '春分 清明 穀雨 立夏 小満 芒種 夏至 小暑 大暑 立秋 処暑 白露 秋分 寒露 霜降 立冬 小雪 大雪 冬至 小寒 大寒 立春 雨水 啓蟄'.split(' '),
        en: ['Spring Equinox', 'Clear and Bright', 'Grain Rain', 'Start of Summer', 'Grain Buds', 'Grain in Ear',
            'Summer Solstice', 'Minor Heat', 'Major Heat', 'Start of Autumn', 'End of Heat', 'White Dew',
            'Autumn Equinox', 'Cold Dew', "Frost's Descent", 'Start of Winter', 'Minor Snow', 'Major Snow',
            'Winter Solstice', 'Minor Cold', 'Major Cold', 'Start of Spring', 'Rain Water', 'Awakening of Insects']
    };
    // 中文用《逸周书》系的七十二候；日文用本朝七十二候（略本暦）。
    // 「螻蟈鸣」「鶡旦不鸣」写繁体，是因为霞鹜文楷 TC 缺简体的「蝼蝈」「鹖鴠」。
    var PENTADS = {
        zh: ('玄鸟至 雷乃发声 始电 桐始华 田鼠化为鴽 虹始见 萍始生 鸣鸠拂其羽 戴胜降于桑 螻蟈鸣 蚯蚓出 王瓜生 ' +
            '苦菜秀 靡草死 麦秋至 螳螂生 鵙始鸣 反舌无声 鹿角解 蜩始鸣 半夏生 温风至 蟋蟀居宇 鹰始挚 ' +
            '腐草为萤 土润溽暑 大雨时行 凉风至 白露降 寒蝉鸣 鹰乃祭鸟 天地始肃 禾乃登 鸿雁来 玄鸟归 群鸟养羞 ' +
            '雷始收声 蛰虫坯户 水始涸 鸿雁来宾 雀入大水为蛤 菊有黄华 豺乃祭兽 草木黄落 蛰虫咸俯 水始冰 地始冻 雉入大水为蜃 ' +
            '虹藏不见 天气上升地气下降 闭塞而成冬 鶡旦不鸣 虎始交 荔挺出 蚯蚓结 麋角解 水泉动 雁北乡 鹊始巢 雉始雊 ' +
            '鸡始乳 征鸟厉疾 水泽腹坚 东风解冻 蛰虫始振 鱼陟负冰 獭祭鱼 候雁北 草木萌动 桃始华 仓庚鸣 鹰化为鸠').split(' '),
        ja: ('雀始巣 桜始開 雷乃発声 玄鳥至 鴻雁北 虹始見 葭始生 霜止出苗 牡丹華 蛙始鳴 蚯蚓出 竹笋生 ' +
            '蚕起食桑 紅花栄 麦秋至 蟷螂生 腐草為螢 梅子黄 乃東枯 菖蒲華 半夏生 温風至 蓮始開 鷹乃学習 ' +
            '桐始結花 土潤溽暑 大雨時行 涼風至 寒蝉鳴 蒙霧升降 綿柎開 天地始粛 禾乃登 草露白 鶺鴒鳴 玄鳥去 ' +
            '雷乃収声 蟄虫坏戸 水始涸 鴻雁来 菊花開 蟋蟀在戸 霜始降 霎時施 楓蔦黄 山茶始開 地始凍 金盞香 ' +
            '虹蔵不見 朔風払葉 橘始黄 閉塞成冬 熊蟄穴 鱖魚群 乃東生 麋角解 雪下出麦 芹乃栄 水泉動 雉始雊 ' +
            '款冬華 水沢腹堅 鶏始乳 東風解凍 黄鶯睍睆 魚上氷 土脉潤起 霞始靆 草木萌動 蟄虫啓戸 桃始笑 菜虫化蝶').split(' ')
    };
    var DIGITS = '〇一二三四五六七八九';

    function solarLongitude(time) {
        var T = (time / 86400000 - 10957.5) / 36525;
        var r = Math.PI / 180;
        var M = (357.52911 + 35999.05029 * T) * r;
        var C = (1.914602 - 0.004817 * T) * Math.sin(M) + 0.019993 * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
        var lon = 280.46646 + 36000.76983 * T + C - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * T) * r);
        return ((lon % 360) + 360) % 360;
    }

    function hanziNumber(n) {
        return String(n).split('').map(function (d) { return DIGITS[d]; }).join('');
    }

    function season(now, which) {
        var bj = new Date(now + 8 * 3600000);
        var y = bj.getUTCFullYear();
        var end = Date.UTC(y, bj.getUTCMonth(), bj.getUTCDate(), 23, 59, 59) - 8 * 3600000;
        var k = Math.floor(solarLongitude(end) / 5);
        var lang = TERMS[which] ? which : 'zh';
        return {
            year: lang === 'en' ? String(y) : hanziNumber(y) + '年',
            term: TERMS[lang][Math.floor(k / 3)],
            pentad: PENTADS[lang] ? PENTADS[lang][k] : '',
            index: k
        };
    }

    // [data-season] 的写法：year / term / pentad 单项，或 line（年份 + 节气，页脚用）、
    // mark（节气 + 候，首页落款用；英文没有候，只写节气）。
    function seasonText(kind, s, which) {
        var gap = which === 'en' ? ' · ' : '　';
        if (kind === 'line') return s.year + gap + s.term;
        if (kind === 'mark') return s.pentad ? s.term + gap + s.pentad : s.term;
        return s[kind] || '';
    }

    function redirectLegacyHash() {
        var path = location.pathname || '/';
        if (path !== '/' && path !== '/index.html') return false;
        var target = LEGACY_HASH[String(location.hash || '').replace(/^#/, '')];
        if (target) location.replace(target);
        return Boolean(target);
    }

    if (redirectLegacyHash()) return;
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

    function each(selector, fn) {
        var nodes = document.querySelectorAll(selector);
        for (var i = 0; i < nodes.length; i += 1) fn(nodes[i]);
    }

    function fillSeason() {
        var s = season(Date.now(), lang);
        each('[data-season]', function (node) {
            node.textContent = seasonText(node.getAttribute('data-season'), s, lang);
        });
    }

    function apply(next) {
        lang = next;
        root.lang = HTML_LANG[lang];
        var title = root.getAttribute('data-title-' + lang);
        if (title) document.title = title;
        each('[data-set-lang]', function (button) {
            button.setAttribute('aria-pressed', String(button.getAttribute('data-set-lang') === lang));
        });
        each('[data-aria-' + lang + ']', function (node) {
            node.setAttribute('aria-label', node.getAttribute('data-aria-' + lang));
        });
        fillSeason();
    }

    apply(lang);

    document.addEventListener('DOMContentLoaded', function () {
        apply(lang);
        document.addEventListener('click', function (event) {
            var button = event.target && event.target.closest ? event.target.closest('[data-set-lang]') : null;
            if (!button) return;
            var next = button.getAttribute('data-set-lang');
            if (!HTML_LANG[next] || next === lang) return;
            try { localStorage.setItem(KEY, next); } catch (error) { /* 存不了（无痕模式等）就只影响本页 */ }
            apply(next);
            window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: next } }));
        });
    });

    // ---------- 墨洇：滚到哪里，哪里的字一个一个洇开，像墨落在宣纸上 ----------
    // 只动 <main> 里的文字块（标题、段落、列表项、图注），页头页脚的导航始终直接可见。
    // 每个文字块进入视野时才拆字：汉字、假名、标点各一个 span，拉丁文按词；span 是 inline，
    // 换行、两端对齐、复制粘贴都和原文一样。长段落把总时长压在约 1.1 秒内，不会越洇越慢。
    // 图片、代码块、表格整块淡入。后插入的内容（随笔列表、行旅、切换语言后的文章译文）
    // 由 MutationObserver 接着处理；隐藏的另一种语言在切换显示时才洇开。
    // 系统开了「减少动态效果」或浏览器没有 IntersectionObserver 时整套不启用。
    var INK_TEXT = 'h1, h2, h3, h4, p, li, dt, dd, figcaption';
    var INK_BLOCK = 'pre, table, img';
    var INK_WHOLE = '.tcy, .upright, code, kbd, svg';
    var reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var inkOn = !reduceMotion && typeof IntersectionObserver !== 'undefined' && !!root.classList;

    function inkTokens(text) {
        return text.match(/\s+|[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{P}\p{S}]|[^\s\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{P}\p{S}]+/gu) || [];
    }

    function inkSplit(el) {
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        var texts = [];
        while (walker.nextNode()) texts.push(walker.currentNode);
        var units = [];
        texts.forEach(function (node) {
            var whole = node.parentElement && node.parentElement.closest(INK_WHOLE);
            if (whole && whole !== el && el.contains(whole)) {
                if (units.indexOf(whole) < 0) { whole.classList.add('ink-ch'); units.push(whole); }
                return;
            }
            var frag = document.createDocumentFragment();
            inkTokens(node.nodeValue).forEach(function (token) {
                if (!token.trim()) { frag.appendChild(document.createTextNode(token)); return; }
                var span = document.createElement('span');
                span.className = 'ink-ch';
                span.textContent = token;
                frag.appendChild(span);
                units.push(span);
            });
            node.parentNode.replaceChild(frag, node);
        });
        var step = Math.min(34, 1100 / Math.max(units.length, 1));
        units.forEach(function (unit, i) { unit.style.setProperty('--d', Math.round(i * step) + 'ms'); });
    }

    function setupInk() {
        var main = document.querySelector('main');
        if (!main) return;
        var batch = 0;
        var batchTimer = null;
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var el = entry.target;
                io.unobserve(el);
                // 同一刻进入视野的几块依次起笔，前后差 0.12 秒。
                el.style.setProperty('--ink-delay', Math.min(batch, 6) * 120 + 'ms');
                batch += 1;
                var block = el.getAttribute('data-ink') === 'wait-block';
                if (!block) {
                    inkSplit(el);
                    el.setAttribute('data-ink', 'ready');
                }
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () { el.setAttribute('data-ink', block ? 'in-block' : 'in'); });
                });
            });
            clearTimeout(batchTimer);
            batchTimer = setTimeout(function () { batch = 0; }, 200);
        }, { rootMargin: '0px 0px -6% 0px' });

        function scan(node) {
            if (!node || node.nodeType !== 1 || node.classList.contains('ink-ch')) return;
            var list = node.matches(INK_TEXT + ', ' + INK_BLOCK) ? [node] : [];
            Array.prototype.push.apply(list, node.querySelectorAll(INK_TEXT + ', ' + INK_BLOCK));
            list.forEach(function (el) {
                if (el.hasAttribute('data-ink') || el.closest('[data-ink-skip]')) return;
                var parent = el.parentElement;
                if (parent && parent.closest(INK_BLOCK.replace(', img', ''))) return;
                var isBlock = el.matches(INK_BLOCK);
                if (isBlock && parent && parent.closest(INK_TEXT)) return;
                if (!isBlock && el.querySelector(INK_TEXT + ', pre, table')) return;
                el.setAttribute('data-ink', isBlock ? 'wait-block' : 'wait');
                io.observe(el);
            });
        }

        scan(main);
        new MutationObserver(function (records) {
            records.forEach(function (record) {
                Array.prototype.forEach.call(record.addedNodes, scan);
            });
        }).observe(main, { childList: true, subtree: true });
    }

    if (inkOn) {
        root.classList.add('ink-on');
        // 万一后面的脚本出错，最迟 2.5 秒也把正文放出来。
        setTimeout(function () { root.classList.add('ink-ready'); }, 2500);
        document.addEventListener('DOMContentLoaded', function () {
            try { setupInk(); } finally { root.classList.add('ink-ready'); }
        });
    }

    var LABELS = { tags: { zh: '标签', ja: 'タグ', en: 'Tags' } };

    // 文章页的译文脚本（js/blog-<slug>.js）沿用旧 lang.js 的这几个接口。
    window.YuiLang = {
        getCurrentLang: function () { return lang; },
        getText: function (page, key, which) {
            var entry = LABELS[key];
            return entry ? (entry[which || lang] || entry.zh) : '';
        }
    };
    window.YuiSite = {
        key: KEY,
        htmlLang: HTML_LANG,
        legacyHash: LEGACY_HASH,
        season: season,
        seasonText: seasonText,
        hanziNumber: hanziNumber,
        inkTokens: inkTokens,
        getLang: function () { return lang; }
    };
})();
