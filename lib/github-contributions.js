// 首页线索墙上那张 GitHub 贡献图的数据源。
//
// 页面 CSP 是 connect-src 'self'，浏览器不能直接去问 GitHub，所以由服务端拉取并缓存，
// 前端只读 GET /files/github-contributions。数据取自 GitHub 的公开页面
//   https://github.com/users/<login>/contributions?from=<year>-01-01&to=<year>-12-31
// 它不需要 token、不占 API 额度，返回的是一段 HTML，这里把每天的等级和贡献数解析出来。
//
// 公开页面只含公开仓库的贡献，和未登录的访客在个人主页上看到的一致；私有仓库的贡献只有在
// 账号的 Contribution settings 里打开 "Private contributions" 后，才会以匿名计数的形式出现。

const DEFAULT_LOGIN = 'cnYui';
const DEFAULT_TTL_MS = 15 * 60 * 1000;
// 拉取失败后的冷却时间：期间直接用旧数据（或直接报错），不再每个请求都去敲 GitHub。
const DEFAULT_RETRY_MS = 60 * 1000;
const DEFAULT_TIMEOUT_MS = 8 * 1000;
const MAX_HTML_LENGTH = 4 * 1024 * 1024;
// 一整年应有 365 / 366 天。少于这个数说明拿到的不是贡献日历（错误页、改版），宁可当失败处理。
const MIN_DAYS = 28;
const USER_AGENT = 'yui-web-github-contributions/1.0 (+https://aaccx.pw)';
const LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;

class ContributionsError extends Error {
    constructor(message, code, cause) {
        super(message, cause ? { cause } : undefined);
        this.name = 'ContributionsError';
        this.code = code;
    }
}

function resolveLogin(value, warn = console.warn) {
    const raw = String(value ?? '').trim();
    if (!raw) return DEFAULT_LOGIN;
    if (LOGIN_PATTERN.test(raw)) return raw;
    warn(`[github-contributions] 忽略无效的 GitHub 用户名 ${JSON.stringify(raw)}，改用 ${DEFAULT_LOGIN}`);
    return DEFAULT_LOGIN;
}

function contributionsUrl(login, year) {
    return `https://github.com/users/${encodeURIComponent(login)}/contributions?from=${year}-01-01&to=${year}-12-31`;
}

// ---- 解析 ----

// 属性值里可能出现 ">"（例如 data-hydro-click 里的 JSON），所以按引号成对匹配整个标签。
const TAG_BODY = '((?:[^>"\']|"[^"]*"|\'[^\']*\')*)';

function readAttributes(source) {
    const attributes = {};
    for (const match of source.matchAll(/([^\s"'<>/=]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
        attributes[match[1].toLowerCase()] = match[2] ?? match[3];
    }
    return attributes;
}

function decodeEntities(text) {
    return text
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
        .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&');
}

function plainText(html) {
    return decodeEntities(String(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function countFromTooltip(text) {
    if (/^no contributions\b/i.test(text)) return 0;
    const match = /^([\d,]+)\s+contributions?\b/i.exec(text);
    return match ? Number(match[1].replace(/,/g, '')) : null;
}

// 只认 data-date + data-level 都在的 <td>：图例里的方块没有 data-date，自然被排除。
// 属性顺序、多余属性都不影响解析。逐日的贡献数取自旁边的 <tool-tip>，取不到时记为 null，
// 热力图本身只需要等级，不会因此画不出来。
function parseContributionsHtml(html) {
    const source = String(html ?? '');

    const tooltips = new Map();
    for (const match of source.matchAll(new RegExp(`<tool-tip\\b${TAG_BODY}>([\\s\\S]*?)</tool-tip>`, 'gi'))) {
        const target = readAttributes(match[1]).for;
        if (target) tooltips.set(target, plainText(match[2]));
    }

    const byDate = new Map();
    for (const match of source.matchAll(new RegExp(`<td\\b${TAG_BODY}>`, 'gi'))) {
        const attributes = readAttributes(match[1]);
        const date = attributes['data-date'];
        const level = Number(attributes['data-level']);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isInteger(level) || level < 0 || level > 4) continue;
        const tooltip = attributes.id ? tooltips.get(attributes.id) : undefined;
        byDate.set(date, { date, level, count: tooltip === undefined ? null : countFromTooltip(tooltip) });
    }

    const days = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (days.length < MIN_DAYS) {
        throw new ContributionsError(`GitHub 页面里只解析出 ${days.length} 天，不像贡献日历`, 'GITHUB_PARSE_FAILED');
    }

    // 标题 "1,227 contributions in 2026" 是 GitHub 自己算的总数；没有它就退回逐日相加。
    const heading = /<h2\b[^>]*id="js-contribution-activity-description"[^>]*>([\s\S]*?)<\/h2>/i.exec(source);
    const headline = heading ? /([\d,]+)\s+contributions?\b/i.exec(plainText(heading[1])) : null;
    const summed = days.reduce((sum, day) => sum + (day.count ?? 0), 0);
    const total = headline ? Number(headline[1].replace(/,/g, '')) : summed;

    return { from: days[0].date, to: days[days.length - 1].date, total, days };
}

// ---- 拉取 ----

async function fetchContributionsHtml({ login, year, fetchImpl, timeoutMs }) {
    if (typeof fetchImpl !== 'function') {
        throw new ContributionsError('当前运行环境没有 fetch', 'GITHUB_UNREACHABLE');
    }
    let response;
    try {
        response = await fetchImpl(contributionsUrl(login, year), {
            headers: { Accept: 'text/html', 'User-Agent': USER_AGENT },
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (error) {
        throw new ContributionsError(`无法连接 GitHub：${error && error.message ? error.message : error}`, 'GITHUB_UNREACHABLE', error);
    }
    if (!response.ok) {
        throw new ContributionsError(`GitHub 返回 HTTP ${response.status}`, 'GITHUB_BAD_STATUS');
    }
    let html;
    try {
        html = await response.text();
    } catch (error) {
        throw new ContributionsError(`读取 GitHub 响应失败：${error && error.message ? error.message : error}`, 'GITHUB_UNREACHABLE', error);
    }
    if (html.length > MAX_HTML_LENGTH) {
        throw new ContributionsError('GitHub 响应体积异常', 'GITHUB_PARSE_FAILED');
    }
    return html;
}

// ---- 缓存 ----

function positiveNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : fallback;
}

// 15 分钟内直接用内存里的结果；过期后由第一个请求去刷新（同时到达的请求共用同一次拉取）。
// GitHub 拉不到时继续给旧数据，并在冷却期内不再重试；从没成功过则报错，前端会把卡片藏起来。
function createContributionsService(options = {}) {
    const warn = typeof options.warn === 'function' ? options.warn : console.warn;
    const login = resolveLogin(options.login, warn);
    const ttlMs = positiveNumber(options.ttlMs, DEFAULT_TTL_MS);
    const retryMs = positiveNumber(options.retryMs, DEFAULT_RETRY_MS);
    const timeoutMs = positiveNumber(options.timeoutMs, DEFAULT_TIMEOUT_MS);
    const fetchImpl = options.fetchImpl || globalThis.fetch;
    const now = typeof options.now === 'function' ? options.now : () => new Date();

    let cached = null; // { year, fetchedAtMs, payload }
    let inflight = null;
    let lastFailure = null; // { atMs, error }

    function clock() {
        const date = new Date(now());
        return Number.isFinite(date.getTime()) ? date : new Date();
    }

    function snapshot(entry, stale) {
        return { ...entry.payload, stale };
    }

    async function refresh(year) {
        const html = await fetchContributionsHtml({ login, year, fetchImpl, timeoutMs });
        const parsed = parseContributionsHtml(html);
        const fetchedAt = clock();
        cached = {
            year,
            fetchedAtMs: fetchedAt.getTime(),
            payload: {
                login,
                year,
                from: parsed.from,
                to: parsed.to,
                total: parsed.total,
                fetchedAt: fetchedAt.toISOString(),
                days: parsed.days,
            },
        };
        lastFailure = null;
        return cached;
    }

    function startRefresh(year, startedAtMs) {
        const promise = (async () => {
            try {
                return await refresh(year);
            } catch (error) {
                lastFailure = { atMs: startedAtMs, error };
                warn(`[github-contributions] 刷新失败：${error && error.message ? error.message : error}`);
                throw error;
            } finally {
                inflight = null;
            }
        })();
        inflight = promise;
        return promise;
    }

    async function get() {
        const current = clock();
        const year = current.getFullYear();
        const nowMs = current.getTime();

        if (cached && cached.year === year && nowMs - cached.fetchedAtMs < ttlMs) return snapshot(cached, false);

        if (!inflight && lastFailure && nowMs - lastFailure.atMs < retryMs) {
            if (cached) return snapshot(cached, true);
            throw lastFailure.error;
        }

        const pending = inflight || startRefresh(year, nowMs);
        try {
            return snapshot(await pending, false);
        } catch (error) {
            if (cached) return snapshot(cached, true);
            throw error;
        }
    }

    return { get, login };
}

module.exports = {
    DEFAULT_LOGIN,
    DEFAULT_RETRY_MS,
    DEFAULT_TIMEOUT_MS,
    DEFAULT_TTL_MS,
    ContributionsError,
    contributionsUrl,
    createContributionsService,
    parseContributionsHtml,
    resolveLogin,
};
