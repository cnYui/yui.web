// 行旅页「此刻」：读 /travel/now（iPhone 快捷指令推上来的城市级位置），在 OpenStreetMap 地图上点一个金点。
// 没有数据、手动收起、或者三十天没更新，整块都不显示；GitHub Pages 镜像没有这个接口，也一样不显示。
// 地图库 Leaflet 自托管在 /js/leaflet/，有位置才动态加载，平时不多下一个字节。
(function () {
    'use strict';

    const section = document.getElementById('now');
    const mapNode = document.getElementById('nowMap');
    const line = document.getElementById('nowLine');
    if (!section || !mapNode || !line || !window.fetch) return;

    const LEAFLET_VERSION = '1.9.4';
    const TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
    // 坐标已经被服务端取整到 0.1°（约十公里），放得太大会显得比实际精确，所以缩放封顶；圆圈画的就是这份模糊范围。
    const ZOOM = { start: 9, min: 4, max: 11 };
    const FUZZ_METERS = 6000;
    const STALE_MS = 30 * 24 * 60 * 60 * 1000;
    const DIGITS = '〇一二三四五六七八九';
    const TEXT = {
        zh: { lead: '此刻在', away: '途中', alt: '地图，金点是悠一此刻所在的城市', just: '刚刚', minute: '分钟前', hour: '小时前', day: '天前' },
        ja: { lead: 'いま', away: '移動中', alt: '地図。金の点が悠一のいる街', just: 'たった今', minute: '分前', hour: '時間前', day: '日前' },
        en: { lead: 'Now in', away: 'transit', alt: 'Map; the gold dot marks the city Yui is in now', just: 'just now', minute: 'min ago', hour: ['hour ago', 'hours ago'], day: ['day ago', 'days ago'] }
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
        mapNode.setAttribute('aria-label', text.alt);

        line.textContent = '';
        line.appendChild(span('now-lead', text.lead));
        line.appendChild(document.createTextNode(lang === 'zh' ? '' : ' '));
        line.appendChild(span('now-city', data.city || text.away));
        line.appendChild(document.createTextNode(lang === 'en' ? ' · ' : '　'));
        line.appendChild(span('now-ago', ago(Date.now() - Date.parse(data.updatedAt), lang)));
    }

    // 样式先于脚本就位：Leaflet 要靠 CSS 才知道各个图层怎么摆。
    function loadLeaflet() {
        if (window.L) return Promise.resolve(window.L);
        const load = (node) => new Promise((resolve, reject) => {
            node.onload = resolve;
            node.onerror = reject;
            document.head.appendChild(node);
        });
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = `/styles/leaflet.css?v=${LEAFLET_VERSION}`;
        const script = document.createElement('script');
        script.src = `/js/leaflet/leaflet.js?v=${LEAFLET_VERSION}`;
        return load(css).then(() => load(script)).then(() => window.L);
    }

    function buildMap(L) {
        const center = [data.lat, data.lon];
        const gold = getComputedStyle(document.documentElement).getPropertyValue('--gold').trim() || '#917347';
        const map = L.map(mapNode, {
            center,
            zoom: ZOOM.start,
            minZoom: ZOOM.min,
            maxZoom: ZOOM.max,
            scrollWheelZoom: false, // 滚轮留给整页滚动
            dragging: !L.Browser.mobile, // 手机上单指留给整页滚动，双指仍可缩放
            attributionControl: false
        });
        // 瓦片站点按使用规范要求带来源页；站点默认的 Referrer-Policy 是 same-origin，会让它一个都不发，所以图片上单独放宽到 origin。
        L.tileLayer(TILES, { maxZoom: ZOOM.max, referrerPolicy: 'origin', attribution: ATTRIBUTION }).addTo(map);
        L.control.attribution({ prefix: false }).addTo(map);
        L.circle(center, { radius: FUZZ_METERS, color: gold, weight: 1, dashArray: '2 4', fillColor: gold, fillOpacity: 0.1, interactive: false }).addTo(map);
        L.marker(center, {
            icon: L.divIcon({ className: 'now-pin', html: '<span class="now-dot"></span>', iconSize: [0, 0] }),
            interactive: false,
            keyboard: false
        }).addTo(map);
    }

    fetch('/travel/now', { headers: { Accept: 'application/json' } })
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
            if (!payload || payload.hidden || typeof payload.lat !== 'number' || typeof payload.lon !== 'number') return;
            const age = Date.now() - Date.parse(payload.updatedAt);
            if (!(age < STALE_MS)) return;
            data = payload;
            render();
            window.addEventListener('languageChanged', render);
            // 先把块显示出来再建地图（隐藏的容器没有尺寸）；地图库加载失败就只留下面那行字。
            section.hidden = false;
            loadLeaflet().then(buildMap).catch(() => { mapNode.hidden = true; });
        })
        .catch(() => {});
})();
