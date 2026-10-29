// 行旅页「此刻」：读 /travel/now（iPhone 快捷指令推上来的城市级位置），在行踪图上点一个金点。
// 没有数据、手动收起、或者三十天没更新，整块都不显示；GitHub Pages 镜像没有这个接口，也一样不显示。
(function () {
    'use strict';

    const section = document.getElementById('now');
    if (!section || !window.fetch) return;
    const map = section.querySelector('.now-map img');
    const dot = document.getElementById('nowDot');
    const line = document.getElementById('nowLine');

    // 行踪图 travel-map-v4 的源图是 2600 × 1400 的墨卡托投影。三个常数用图上重庆、冲绳、广岛、福井
    // 四个标记点拟合（残差不到 0.3 px）：x = a + b·经度（弧度），y = c − b·ln(tan(π/4 + 纬度/2))。
    const MAP = { width: 2600, height: 1400, a: -4278.56, c: 2314.18, b: 2567.15 };
    // 图上压着标题框、图例和长三角放大图，点落进去就不画，只留文字。
    const COVERED = [[52, 52, 803, 236], [52, 1212, 657, 1343], [1760, 798, 2545, 1340]];
    const STALE_MS = 30 * 24 * 60 * 60 * 1000;
    const DIGITS = '〇一二三四五六七八九';
    const TEXT = {
        zh: { lead: '此刻在', away: '途中', alt: '行踪图，金点是悠一此刻所在的城市', just: '刚刚', minute: '分钟前', hour: '小时前', day: '天前' },
        ja: { lead: 'いま', away: '移動中', alt: '旅の地図。金の点が悠一のいる街', just: 'たった今', minute: '分前', hour: '時間前', day: '日前' },
        en: { lead: 'Now in', away: 'transit', alt: 'Travel map; the gold dot marks the city Yui is in now', just: 'just now', minute: 'min ago', hour: ['hour ago', 'hours ago'], day: ['day ago', 'days ago'] }
    };

    let data = null;

    function hanziCount(n) {
        if (n < 10) return DIGITS[n];
        const tens = Math.floor(n / 10);
        const ones = n % 10;
        return (tens > 1 ? DIGITS[tens] : '') + '十' + (ones ? DIGITS[ones] : '');
    }

    function currentLang() {
        return window.YuiSite ? window.YuiSite.getLang() : 'zh';
    }

    function ago(ms, lang) {
        const text = TEXT[lang];
        const minutes = Math.floor(ms / 60000);
        if (minutes < 1) return text.just;
        const [count, unit] = minutes < 60 ? [minutes, 'minute'] : minutes < 1440 ? [Math.floor(minutes / 60), 'hour'] : [Math.floor(minutes / 1440), 'day'];
        if (lang !== 'en') return (count > 99 ? String(count) : hanziCount(count)) + text[unit];
        const label = Array.isArray(text[unit]) ? text[unit][count === 1 ? 0 : 1] : text[unit];
        return `${count} ${label}`;
    }

    function project(lat, lon) {
        const x = MAP.a + MAP.b * lon * Math.PI / 180;
        const y = MAP.c - MAP.b * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
        if (!(x >= 0 && y >= 0 && x <= MAP.width && y <= MAP.height)) return null;
        if (COVERED.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1)) return null;
        return { x: x / MAP.width * 100, y: y / MAP.height * 100 };
    }

    function span(className, text) {
        const node = document.createElement('span');
        node.className = className;
        node.textContent = text;
        return node;
    }

    function render() {
        if (!data) return;
        const lang = TEXT[currentLang()] ? currentLang() : 'zh';
        const text = TEXT[lang];
        map.alt = text.alt;

        const point = project(data.lat, data.lon);
        dot.hidden = !point;
        if (point) {
            dot.style.left = point.x + '%';
            dot.style.top = point.y + '%';
        }

        line.textContent = '';
        line.appendChild(span('now-lead', text.lead));
        line.appendChild(document.createTextNode(lang === 'zh' ? '' : ' '));
        line.appendChild(span('now-city', data.city || text.away));
        line.appendChild(document.createTextNode(lang === 'en' ? ' · ' : '　'));
        line.appendChild(span('now-ago', ago(Date.now() - Date.parse(data.updatedAt), lang)));
    }

    fetch('/travel/now', { headers: { Accept: 'application/json' } })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
            if (!payload || payload.hidden || typeof payload.lat !== 'number' || typeof payload.lon !== 'number') return;
            const age = Date.now() - Date.parse(payload.updatedAt);
            if (!(age < STALE_MS)) return;
            data = payload;
            render();
            section.hidden = false;
            window.addEventListener('languageChanged', render);
        })
        .catch(() => {});
})();
