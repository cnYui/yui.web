// 首页线索墙上那张 GitHub 贡献图：只展示，没有任何交互（点击、悬停、聚焦都不响应）。
// 数据由服务端从 GitHub 公开页面拉取并缓存（见 lib/github-contributions.js）；页面 CSP 是
// connect-src 'self'，浏览器不能直接问 GitHub。拿不到数据时卡片保持透明，墙面不受影响。
(function () {
    const card = document.getElementById('cwGithub');
    if (!card) return;

    const ENDPOINT = '/files/github-contributions';
    // 服务端每 15 分钟才刷新一次数据，页面开着不关时，半小时来取一次就够了。
    const REFRESH_MS = 30 * 60 * 1000;
    const DAY_MS = 24 * 60 * 60 * 1000;

    // 卡片上只有三样东西：GitHub 的名字（写死在页面里）、贡献总数、单位 + 年份，再加整年的方块图。
    // 月份、星期、图例、同步时间都不画：墙上缩小之后根本看不清，反而让人更难一眼认出这是什么。
    const totalEl = card.querySelector('[data-gh="total"]');
    const unitEl = card.querySelector('[data-gh="unit"]');
    const gridEl = card.querySelector('[data-gh="grid"]');

    let loading = false;
    let loadedAt = 0;
    let lastData = null;

    const pad = (value) => String(value).padStart(2, '0');
    const utc = (text) => {
        const [year, month, day] = String(text).split('-').map(Number);
        return Date.UTC(year, month - 1, day);
    };

    function cell(level) {
        const element = document.createElement('i');
        element.className = level === null ? 'cw-github-cell is-void' : 'cw-github-cell';
        if (level !== null) element.dataset.level = String(level);
        return element;
    }

    // 列 = 周（周日在最上面），和 GitHub 个人主页一致：第一列可能不满一周，前面补空位。
    function buildGrid(days) {
        const first = utc(days[0].date);
        const leading = new Date(first).getUTCDay();
        const cells = [];
        for (let i = 0; i < leading; i++) cells.push(cell(null));
        let previous = first - DAY_MS;
        for (const day of days) {
            const time = utc(day.date);
            // 日历里不该缺天；万一缺了就补空格，保证后面的列不错位。
            for (let t = previous + DAY_MS; t < time; t += DAY_MS) cells.push(cell(null));
            cells.push(cell(Math.min(4, Math.max(0, Number(day.level) || 0))));
            previous = time;
        }
        return cells;
    }

    function formatSynced(iso) {
        const date = new Date(iso);
        if (!Number.isFinite(date.getTime())) return '';
        return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    function render(data) {
        const days = Array.isArray(data && data.days) ? data.days : [];
        const total = Number(data && data.total);
        if (days.length === 0 || !Number.isFinite(total)) return false;

        const fragment = document.createDocumentFragment();
        buildGrid(days).forEach((element) => fragment.appendChild(element));
        gridEl.replaceChildren(fragment);

        // 整张卡片对读屏来说就是一张图，格子本身不用逐个念。
        card.setAttribute('role', 'img');
        lastData = data;
        updateLabels();
        card.removeAttribute('aria-hidden');
        card.classList.add('is-ready');
        return true;
    }

    // 单位 + 年份和读屏描述都跟着页面语言走（词典在 js/clue-i18n.js）；总数是数字，各语言一样。
    function updateLabels() {
        if (!lastData) return;
        const count = Number(lastData.total);
        const total = count.toLocaleString('en-US');
        const synced = formatSynced(lastData.fetchedAt);
        const i18n = typeof window !== 'undefined' ? window.YuiClueI18n : null;
        totalEl.textContent = total;
        unitEl.textContent = i18n
            ? i18n.t(count === 1 ? 'github.unit.one' : 'github.unit', { year: lastData.year })
            : `${count === 1 ? 'contribution' : 'contributions'} · ${lastData.year}`;
        const label = i18n
            ? i18n.t('github.aria', {
                login: lastData.login || '',
                year: lastData.year,
                total,
                synced: synced ? i18n.t('github.synced', { time: synced }) : ''
            })
            : `GitHub 贡献图：${lastData.login || ''} 在 ${lastData.year} 年共 ${total} 次贡献${synced ? `，更新于 ${synced}` : ''}`;
        card.setAttribute('aria-label', label);
    }

    function load() {
        if (loading) return;
        loading = true;
        fetch(ENDPOINT, { headers: { Accept: 'application/json' } })
            .then((response) => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
            .then((data) => { if (render(data)) loadedAt = Date.now(); })
            .catch(() => {})
            .finally(() => { loading = false; });
    }

    load();
    if (typeof window !== 'undefined') window.addEventListener('yui-clue-lang', updateLabels);
    setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    // 标签页在后台放了很久，切回来时不用等下一个定时点，立刻补一次。
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && Date.now() - loadedAt >= REFRESH_MS) load();
    });
})();
