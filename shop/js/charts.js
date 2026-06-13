// Shop 前端图表渲染，集中维护收银饼图和金额堆叠柱。
(function() {
    const {
        escapeHtml,
        formatCompactNumber,
        formatNanos,
        formatNumber
    } = window.YuiShopCore;

    const partClassNames = {
        cache_hit_input: 'admin-revenue-bar-segment-hit',
        cache_miss_input: 'admin-revenue-bar-segment-miss',
        output: 'admin-revenue-bar-segment-output'
    };

    const partLabels = [
        ['cache_hit_input', '缓存命中输入'],
        ['cache_miss_input', '缓存未命中输入'],
        ['output', '输出 token']
    ];

    function normalizeChargeParts(rawParts = [], fallbackTotalNanos = 0) {
        const normalizedParts = partLabels.map(([key, label]) => {
            const part = rawParts.find((candidate) => candidate.key === key) || { chargeNanos: 0 };
            return { key, label, chargeNanos: Number(part.chargeNanos || 0) };
        });
        const partChargeTotal = normalizedParts.reduce((sum, part) => sum + Number(part.chargeNanos || 0), 0);
        if (partChargeTotal > 0 || Number(fallbackTotalNanos || 0) <= 0) return normalizedParts;
        return [
            { key: 'cache_hit_input', label: '旧格式总金额', chargeNanos: Number(fallbackTotalNanos || 0) },
            { key: 'cache_miss_input', label: '缓存未命中输入', chargeNanos: 0 },
            { key: 'output', label: '输出 token', chargeNanos: 0 }
        ];
    }

    function renderStackedChargeBars(options = {}) {
        const items = Array.isArray(options.items) ? options.items : [];
        const emptyText = options.emptyText || '暂无记录。';
        const maxBarHeightPx = Number(options.maxBarHeightPx || 140);
        const maxCharge = Math.max(...items.map((item) => Number(item.chargeNanos || 0)), 1);
        if (!items.length) {
            return `<div class="grid h-48 flex-1 place-items-center text-sm text-text-muted dark:text-dark-text-muted">${escapeHtml(emptyText)}</div>`;
        }
        return items.map((item) => {
            const chargeNanos = Number(item.chargeNanos || 0);
            const barHeightPx = chargeNanos > 0
                ? Math.max(8, Math.round((chargeNanos / maxCharge) * maxBarHeightPx))
                : 8;
            const parts = normalizeChargeParts(Array.isArray(item.parts) ? item.parts : [], chargeNanos);
            const segments = parts.map((part) => {
                const partChargeNanos = Number(part.chargeNanos || 0);
                const segmentHeightPx = partChargeNanos > 0
                    ? Math.max(2, Math.round((partChargeNanos / maxCharge) * maxBarHeightPx))
                    : 0;
                return `
                    <div class="admin-revenue-bar-segment ${partClassNames[part.key]}" style="height:${segmentHeightPx}px" title="${escapeHtml(part.label)}：${escapeHtml(formatNanos(partChargeNanos))}"></div>
                `;
            }).join('');
            return `
                <div class="admin-revenue-bar-item">
                    <span class="text-xs font-medium text-primary dark:text-dark-text">${escapeHtml(formatNanos(chargeNanos))}</span>
                    <div class="admin-revenue-bar admin-revenue-bar-stack" style="height:${barHeightPx}px">${segments}</div>
                    <span class="admin-revenue-phone-label">${escapeHtml(item.label || '-')}</span>
                </div>
            `;
        }).join('');
    }

    function renderChargePartsLegend() {
        return partLabels.map(([key, label]) => `
            <span class="inline-flex items-center gap-2">
                <span class="admin-revenue-legend-dot ${partClassNames[key]}"></span>
                <span>${escapeHtml(label)}</span>
            </span>
        `).join('');
    }

    function renderRevenuePieChart(title, parts = [], totalNanos = 0) {
        const colors = ['#111827', '#6b7280', '#d1d5db'];
        const total = Number(totalNanos || 0);
        const segmentTotal = parts.reduce((sum, part) => sum + Number(part.chargeNanos || 0), 0);
        let cursor = 0;
        const segments = segmentTotal > 0
            ? parts.map((part, index) => {
                const value = Number(part.chargeNanos || 0);
                const start = cursor;
                const end = cursor + (value / segmentTotal) * 100;
                cursor = end;
                return `${colors[index % colors.length]} ${start.toFixed(2)}% ${end.toFixed(2)}%`;
            }).join(', ')
            : '#e5e7eb 0% 100%';
        const legend = parts.map((part, index) => `
            <li class="flex items-center justify-between gap-3 text-sm">
                <span class="flex min-w-0 items-center gap-2">
                    <span class="admin-revenue-legend-dot" style="background:${colors[index % colors.length]}"></span>
                    <span class="truncate">${escapeHtml(part.label)}</span>
                </span>
                <span class="shrink-0 font-medium text-primary dark:text-dark-text">${escapeHtml(formatNanos(part.chargeNanos))}</span>
            </li>
            <li class="-mt-2 mb-1 ml-5 text-xs text-text-muted dark:text-dark-text-muted">${escapeHtml(formatNumber(part.tokens))} tokens</li>
        `).join('');
        return `
            <article class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-5">
                <div class="flex flex-col gap-5 sm:flex-row sm:items-center">
                    <div class="admin-revenue-pie" style="width:9rem;height:9rem;display:grid;place-items:center;flex-shrink:0;border-radius:9999px;background:conic-gradient(${segments})">
                        <div class="admin-revenue-pie-inner" style="width:5rem;height:5rem;display:grid;place-items:center;border-radius:9999px">
                            <span class="text-sm font-medium text-primary dark:text-dark-text">${escapeHtml(formatNanos(total))}</span>
                        </div>
                    </div>
                    <div class="min-w-0 flex-1">
                        <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">${escapeHtml(title)}</p>
                        <ul class="mt-4 space-y-2">${legend || '<li class="text-sm text-text-muted dark:text-dark-text-muted">暂无收银记录。</li>'}</ul>
                    </div>
                </div>
            </article>
        `;
    }

    function renderCustomerSpendingBars(rankings = {}, period = 'month') {
        const items = Array.isArray(rankings[period]) ? rankings[period] : [];
        const bars = renderStackedChargeBars({
            items: items.slice(0, 12).map((item) => ({
                label: item.phone || '-',
                chargeNanos: item.chargeNanos,
                parts: item.parts
            })),
            emptyText: '暂无 Shop 用户消费记录。'
        });
        return `
            <article class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-5">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">Ranking</p>
                        <h3 class="mt-2 font-display text-2xl text-primary dark:text-dark-text">Shop 用户消费排行</h3>
                    </div>
                    <div class="inline-flex w-fit rounded-md border border-border-subtle dark:border-dark-border p-1 text-sm">
                        <button class="${period === 'today' ? 'bg-primary text-white dark:bg-dark-text dark:text-dark-bg' : 'text-text-muted dark:text-dark-text-muted'} rounded px-3 py-1" type="button" data-revenue-ranking-period="today">今日</button>
                        <button class="${period === 'month' ? 'bg-primary text-white dark:bg-dark-text dark:text-dark-bg' : 'text-text-muted dark:text-dark-text-muted'} rounded px-3 py-1" type="button" data-revenue-ranking-period="month">本月</button>
                    </div>
                </div>
                <div class="admin-revenue-ranking-legend mt-4">${renderChargePartsLegend()}</div>
                <div class="mt-5 overflow-x-auto pb-8">
                    <div class="admin-revenue-bars" style="display:flex;align-items:flex-end;gap:1rem;min-width:34rem;height:14rem;padding:1rem 1rem 0;border-left:1px solid #e5e5e5;border-bottom:1px solid #e5e5e5">
                        ${bars}
                    </div>
                </div>
            </article>
        `;
    }

    function renderAccountWeeklySpendingChart(weeklySpending = {}, selectedWeekStart = '') {
        const weeks = weeklySpending.weeks || {};
        const weekStarts = Array.isArray(weeklySpending.weekStarts)
            ? weeklySpending.weekStarts.filter((weekStart) => weeks[weekStart])
            : Object.keys(weeks).sort();
        const effectiveWeekStart = weekStarts.includes(selectedWeekStart)
            ? selectedWeekStart
            : (weeklySpending.currentWeekStart && weeks[weeklySpending.currentWeekStart]
                ? weeklySpending.currentWeekStart
                : weekStarts[weekStarts.length - 1]);
        const selectedIndex = weekStarts.indexOf(effectiveWeekStart);
        const selectedWeek = weeks[effectiveWeekStart] || { days: [] };
        const days = Array.isArray(selectedWeek.days) ? selectedWeek.days : [];
        const bars = renderStackedChargeBars({
            items: days.map((day) => ({
                label: day.label || '',
                chargeNanos: day.chargeNanos,
                parts: day.parts
            })),
            emptyText: '暂无扣费记录。'
        });
        const canPrev = selectedIndex > 0;
        const canNext = selectedIndex >= 0 && selectedIndex < weekStarts.length - 1;
        const buttonClass = 'inline-flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle dark:border-dark-border text-primary dark:text-dark-text disabled:cursor-not-allowed disabled:opacity-40';
        return `
            <section class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-5">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">Weekly billing</p>
                        <h3 class="mt-2 font-display text-2xl text-primary dark:text-dark-text">每周消费</h3>
                        <p class="mt-1 text-sm text-text-muted dark:text-dark-text-muted">${escapeHtml(selectedWeek.label || '本周')}，合计 ${escapeHtml(formatNanos(selectedWeek.totalChargeNanos))}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        <button class="${buttonClass}" type="button" data-account-week-offset="-1" ${canPrev ? '' : 'disabled'} aria-label="上一周">
                            <span class="material-symbols-outlined text-base" aria-hidden="true">chevron_left</span>
                        </button>
                        <button class="${buttonClass}" type="button" data-account-week-offset="1" ${canNext ? '' : 'disabled'} aria-label="下一周">
                            <span class="material-symbols-outlined text-base" aria-hidden="true">chevron_right</span>
                        </button>
                    </div>
                </div>
                <div class="admin-revenue-ranking-legend mt-4">${renderChargePartsLegend()}</div>
                <div class="mt-5 overflow-x-auto pb-8">
                    <div class="admin-revenue-bars" style="display:flex;align-items:flex-end;gap:1rem;min-width:34rem;height:14rem;padding:1rem 1rem 0;border-left:1px solid #e5e5e5;border-bottom:1px solid #e5e5e5">
                        ${bars}
                    </div>
                </div>
            </section>
        `;
    }

    function renderAdminRevenueCharts(billing = {}, rankingPeriod = 'month') {
        return `
            <section class="rounded-lg border border-border-subtle dark:border-dark-border bg-background-soft dark:bg-dark-surface p-5">
                <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                        <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">Revenue</p>
                        <h3 class="mt-2 font-display text-2xl text-primary dark:text-dark-text">收银分析</h3>
                    </div>
                    <p class="text-sm text-text-muted dark:text-dark-text-muted">只统计 Shop 用户已消费金额，不包含 Local。</p>
                </div>
                <div class="mt-5 grid gap-4 lg:grid-cols-2">
                    ${renderRevenuePieChart('今日收银构成', billing.todayRevenueParts || [], billing.todayChargeNanos)}
                    ${renderRevenuePieChart('本月收银构成', billing.monthRevenueParts || [], billing.monthChargeNanos)}
                </div>
                <div class="mt-4">
                    ${renderCustomerSpendingBars(billing.customerSpendingRankings || {}, rankingPeriod)}
                </div>
            </section>
        `;
    }

    function renderBars(items, labelFormatter = (item) => item.bucket) {
        if (!items.length) {
            return '<p class="text-sm text-text-muted dark:text-dark-text-muted">暂无用量记录，用量统计可能最多延迟 1 小时。</p>';
        }
        const maxValue = Math.max(...items.map((item) => Number(item.totalTokens || 0)), 1);
        return `
            <div class="flex h-48 items-end gap-2">
                ${items.map((item) => {
                    const height = Math.max(4, Math.round((Number(item.totalTokens || 0) / maxValue) * 100));
                    return `
                        <div class="flex min-w-0 flex-1 flex-col items-center gap-2">
                            <div class="w-full rounded-t bg-primary dark:bg-dark-text" style="height:${height}%"></div>
                            <span class="max-w-full truncate text-[10px] text-text-muted dark:text-dark-text-muted" title="${escapeHtml(`${labelFormatter(item)} ${formatCompactNumber(item.totalTokens)} tokens`)}">${escapeHtml(labelFormatter(item))}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    window.YuiShopCharts = {
        renderAdminRevenueCharts,
        renderAccountWeeklySpendingChart,
        renderBars,
        renderCustomerSpendingBars,
        renderRevenuePieChart,
        renderStackedChargeBars
    };
})();
