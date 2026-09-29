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
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const titleEl = card.querySelector('[data-gh="title"]');
    const sourceEl = card.querySelector('[data-gh="source"]');
    const monthsEl = card.querySelector('[data-gh="months"]');
    const gridEl = card.querySelector('[data-gh="grid"]');

    let loading = false;
    let loadedAt = 0;

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
        return { cells, weeks: Math.ceil(cells.length / 7), first, leading };
    }

    // GitHub 的规则：月份标在「周日落在该月 1–7 号」的那一列，全年第一个月标在第一列。
    function monthLabels(first, leading, weeks) {
        const labels = [];
        let lastMonth = -1;
        let lastCol = -10;
        for (let col = 0; col < weeks; col++) {
            const probe = new Date(col === 0 ? first : first + (col * 7 - leading) * DAY_MS);
            const month = probe.getUTCMonth();
            const isMonthStart = col === 0 || probe.getUTCDate() <= 7;
            if (!isMonthStart || month === lastMonth || col - lastCol < 3) continue;
            labels.push({ col, text: MONTHS[month] });
            lastMonth = month;
            lastCol = col;
        }
        return labels;
    }

    function formatTitle(total, year) {
        return `${total.toLocaleString('en-US')} ${total === 1 ? 'contribution' : 'contributions'} in ${year}`;
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

        const { cells, weeks, first, leading } = buildGrid(days);
        const fragment = document.createDocumentFragment();
        cells.forEach((element) => fragment.appendChild(element));
        gridEl.style.setProperty('--weeks', String(weeks));
        gridEl.replaceChildren(fragment);

        monthsEl.replaceChildren(...monthLabels(first, leading, weeks).map(({ col, text }) => {
            const label = document.createElement('span');
            label.style.setProperty('--col', String(col));
            label.textContent = text;
            return label;
        }));

        const synced = formatSynced(data.fetchedAt);
        titleEl.textContent = formatTitle(total, data.year);
        sourceEl.textContent = [data.login ? `@${data.login}` : '', synced ? `synced ${synced}` : ''].filter(Boolean).join(' · ');

        // 整张卡片对读屏来说就是一张图，格子本身不用逐个念。
        card.setAttribute('role', 'img');
        card.setAttribute('aria-label', `GitHub 贡献图：${data.login || ''} 在 ${data.year} 年共 ${total.toLocaleString('en-US')} 次贡献${synced ? `，更新于 ${synced}` : ''}`);
        card.removeAttribute('aria-hidden');
        card.classList.add('is-ready');
        return true;
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
    setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    // 标签页在后台放了很久，切回来时不用等下一个定时点，立刻补一次。
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && Date.now() - loadedAt >= REFRESH_MS) load();
    });
})();
