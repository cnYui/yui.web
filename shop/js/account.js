// Shop 用户账户、兑换、充值、模型价格和扣费流水页面逻辑。
(function() {
    const {
        escapeHtml,
        formatCents,
        formatDate,
        formatNanos,
        formatNumber,
        formatPrice,
        formatUsdMicros,
        initCollapsibleSections,
        requestJson
    } = window.YuiShopCore;
    const { renderAccountWeeklySpendingChart } = window.YuiShopCharts;

function statusText(status) {
    return status === 'active' ? '使用中' : '已失效';
}

function statusClass(status) {
    return status === 'active'
        ? 'bg-background-soft dark:bg-dark-surface text-primary dark:text-dark-text'
        : 'bg-gray-100 dark:bg-dark-surface text-text-muted dark:text-dark-text-muted';
}

function billingStatusText(status) {
    const map = {
        available: '可用',
        empty: '余额为 0',
        debt: '欠费'
    };
    return map[status] || status || '-';
}

function topupStatusText(status) {
    const map = {
        pending: '待确认',
        approved: '已入账',
        rejected: '已拒绝',
        cancelled: '已取消'
    };
    return map[status] || status || '-';
}

function ledgerEntryText(type) {
    const map = {
        topup_approved: '充值入账',
        api_charge: 'API 扣费',
        addon_purchase: '加量包入账',
        admin_adjustment: '管理员调整',
        refund: '退款'
    };
    return map[type] || type || '-';
}

function chargeStatusText(status) {
    const map = {
        charged: '已扣费',
        failed_no_charge: '失败未扣费',
        unpriced_no_charge: '未计价',
        adjusted: '已调整'
    };
    return map[status] || status || '-';
}

function renderOrderCard(order, options = {}) {
    const key = options.showFullKey ? order.apiKey : order.apiKeyPreview;
    const copyButton = options.showFullKey
        ? '<button class="btn-secondary dark:bg-dark-card dark:border-dark-border dark:text-dark-text" type="button" data-copy-key>复制 API key</button>'
        : options.revealKey
            ? '<button class="btn-secondary dark:bg-dark-card dark:border-dark-border dark:text-dark-text" type="button" data-reveal-api-key>复制完整 API key</button>'
        : '';

    if (options.compactAccountOrder) {
        return `
            <article class="border border-border-subtle dark:border-dark-border rounded-lg bg-white dark:bg-dark-card p-5 md:p-6" data-order-id="${escapeHtml(order.id)}">
                <div class="rounded-md border border-border-subtle dark:border-dark-border bg-background-soft dark:bg-dark-surface p-4">
                    <p class="text-xs uppercase tracking-[0.2em] text-text-muted dark:text-dark-text-muted">API key</p>
                    <code class="mt-2 block break-all text-sm text-primary dark:text-dark-text" data-api-key>${escapeHtml(key || '-')}</code>
                </div>
                <dl class="mt-5 text-sm">
                    <div>
                        <dt class="text-text-muted dark:text-dark-text-muted">兑换时间</dt>
                        <dd class="mt-1 font-medium text-primary dark:text-dark-text">${escapeHtml(formatDate(order.redeemedAt))}</dd>
                    </div>
                </dl>
                ${copyButton ? `<div class="mt-5">${copyButton}</div>` : ''}
            </article>
        `;
    }

    return `
        <article class="border border-border-subtle dark:border-dark-border rounded-lg bg-white dark:bg-dark-card p-5 md:p-6" data-order-id="${escapeHtml(order.id)}">
            <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                <div>
                    <p class="text-xs uppercase tracking-[0.2em] text-text-muted dark:text-dark-text-muted">${escapeHtml(order.id)}</p>
                    <h2 class="mt-2 text-2xl font-display text-primary dark:text-dark-text">${escapeHtml(order.productName)}</h2>
                    <p class="mt-2 text-sm text-text-muted dark:text-dark-text-muted">API key 已绑定到账户，按实际使用量计费。</p>
                </div>
                <span class="w-fit rounded-full border border-border-subtle dark:border-dark-border px-3 py-1 text-xs ${statusClass(order.status)}">${escapeHtml(statusText(order.status))}</span>
            </div>
            <div class="mt-5 rounded-md border border-border-subtle dark:border-dark-border bg-background-soft dark:bg-dark-surface p-4">
                <p class="text-xs uppercase tracking-[0.2em] text-text-muted dark:text-dark-text-muted">API key</p>
                <code class="mt-2 block break-all text-sm text-primary dark:text-dark-text" data-api-key>${escapeHtml(key || '-')}</code>
            </div>
            <dl class="mt-5 grid gap-3 text-sm md:grid-cols-2">
                <div>
                    <dt class="text-text-muted dark:text-dark-text-muted">手机号</dt>
                    <dd class="mt-1 font-medium text-primary dark:text-dark-text">${escapeHtml(order.phone)}</dd>
                </div>
                <div>
                    <dt class="text-text-muted dark:text-dark-text-muted">金额</dt>
                    <dd class="mt-1 font-medium text-primary dark:text-dark-text">${escapeHtml(formatPrice(order.amount))}</dd>
                </div>
                <div>
                    <dt class="text-text-muted dark:text-dark-text-muted">兑换时间</dt>
                    <dd class="mt-1 font-medium text-primary dark:text-dark-text">${escapeHtml(formatDate(order.redeemedAt))}</dd>
                </div>
                <div>
                    <dt class="text-text-muted dark:text-dark-text-muted">失效时间</dt>
                    <dd class="mt-1 font-medium text-primary dark:text-dark-text">${escapeHtml(formatDate(order.expiresAt))}</dd>
                </div>
            </dl>
            ${copyButton ? `<div class="mt-5">${copyButton}</div>` : ''}
        </article>
    `;
}

function bindCopy(root) {
    const button = root.querySelector('[data-copy-key]');
    const revealButton = root.querySelector('[data-reveal-api-key]');
    const key = root.querySelector('[data-api-key]')?.textContent || '';
    if (!button && !revealButton) return;

    if (button && key) button.addEventListener('click', async () => {
        await navigator.clipboard.writeText(key);
        button.textContent = '已复制';
        setTimeout(() => {
            button.textContent = '复制 API key';
        }, 1400);
    });

    if (revealButton) revealButton.addEventListener('click', async () => {
        const orderId = root.getAttribute('data-order-id') || '';
        if (!orderId) return;
        revealButton.textContent = '正在复制...';
        try {
            const data = await requestJson(`/api/account/orders/${encodeURIComponent(orderId)}/reveal-api-key`, {
                method: 'POST',
                body: '{}'
            });
            await navigator.clipboard.writeText(data.apiKey || '');
            revealButton.textContent = '已复制';
        } catch (error) {
            revealButton.textContent = error.message || '复制失败';
        }
        setTimeout(() => {
            revealButton.textContent = '复制完整 API key';
        }, 1400);
    });
}

function renderBillingUsageCards(billing = {}, options = {}) {
    const adminRevenue = options.mode === 'adminRevenue';
    const cards = [
        [adminRevenue ? '今日收银' : '今日消费', formatNanos(billing.todayChargeNanos), adminRevenue ? '今天收银多少钱' : '今日已扣费'],
        [adminRevenue ? '本月收银' : '本月消费', formatNanos(billing.monthChargeNanos), adminRevenue ? '本月一共收了多少钱' : '本月已扣费'],
        ['缓存命中输入', formatNumber(billing.cacheHitInputTokens), '本月 token'],
        ['缓存未命中输入', formatNumber(billing.cacheMissInputTokens), '本月 token'],
        ['输出 token', formatNumber(billing.outputTokens), '本月 token']
    ];
    return cards.map(([label, value, hint]) => `
        <article class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">${escapeHtml(label)}</p>
            <p class="mt-2 text-xl font-display text-primary dark:text-dark-text">${escapeHtml(value)}</p>
            <p class="mt-1 text-xs text-text-muted dark:text-dark-text-muted">${escapeHtml(hint)}</p>
        </article>
    `).join('');
}

function renderBalanceCards(balance = {}) {
    const cards = [
        ['当前余额', balance.balanceNanos === undefined ? formatCents(balance.balanceCents) : formatNanos(balance.balanceNanos), billingStatusText(balance.status)],
        ['欠费金额', balance.debtNanos === undefined ? formatCents(balance.debtCents) : formatNanos(balance.debtNanos), balance.debtCents > 0 ? '需补缴' : '无欠费'],
        ['待确认充值', balance.pendingTopupNanos === undefined ? formatCents(balance.pendingTopupCents) : formatNanos(balance.pendingTopupNanos), '确认后入账']
    ];
    return cards.map(([label, value, hint]) => `
        <article class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">${escapeHtml(label)}</p>
            <p class="mt-2 text-2xl font-display text-primary dark:text-dark-text">${escapeHtml(value)}</p>
            <p class="mt-1 text-xs text-text-muted dark:text-dark-text-muted">${escapeHtml(hint)}</p>
        </article>
    `).join('');
}

function subscriptionOrderStatusText(status) {
    const map = {
        pending: '待确认',
        approved: '已确认',
        rejected: '已拒绝'
    };
    return map[status] || status || '-';
}

function renderQuotaCards(state = {}) {
    const subscription = state.subscription || {};
    const quota = state.quota || {};
    const cards = [
        ['当前套餐', subscription.planName || '未开通', subscription.expiresAt ? `到期 ${formatDate(subscription.expiresAt)}` : '等待购买套餐'],
        ['今日套餐额度', formatUsdMicros(quota.dailyQuotaUsdMicros), `剩余 ${formatUsdMicros(quota.dailyRemainingUsdMicros)}`],
        ['加量包余额', formatUsdMicros(quota.addonBalanceUsdMicros), '长期保留'],
        ['当前可用', formatUsdMicros(quota.remainingUsdMicros), quota.active ? 'API key 可用' : '额度不可用']
    ];
    return cards.map(([label, value, hint]) => `
        <article class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">${escapeHtml(label)}</p>
            <p class="mt-2 text-2xl font-display text-primary dark:text-dark-text">${escapeHtml(value)}</p>
            <p class="mt-1 text-xs text-text-muted dark:text-dark-text-muted">${escapeHtml(hint)}</p>
        </article>
    `).join('');
}

function renderQuotaBar(state = {}) {
    const quota = state.quota || {};
    const total = Math.max(0, Number(quota.dailyQuotaUsdMicros || 0) + Number(quota.addonBalanceUsdMicros || 0));
    const remaining = Math.max(0, Number(quota.remainingUsdMicros || 0));
    const used = Math.max(0, total - remaining);
    const usedPercent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
    return `
        <div class="h-5 w-full overflow-hidden rounded bg-background-soft dark:bg-dark-surface border border-border-subtle dark:border-dark-border" aria-label="今日额度">
            <div class="h-full bg-primary dark:bg-dark-text" style="width:${100 - usedPercent}%"></div>
        </div>
        <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-text-muted dark:text-dark-text-muted">
            <span>已用 ${escapeHtml(formatUsdMicros(used))}</span>
            <span>剩余 ${escapeHtml(formatUsdMicros(remaining))}</span>
        </div>
    `;
}

function fillSubscriptionControls(state = {}) {
    const planSelect = document.getElementById('subscriptionPlanSelect');
    const addonSelect = document.getElementById('addonAmountSelect');
    if (planSelect) {
        const plans = Array.isArray(state.plans) ? state.plans : [];
        planSelect.innerHTML = '<option value="">请选择套餐</option>' + plans.map((plan) => `
            <option value="${escapeHtml(plan.id)}">${escapeHtml(`${formatCents(plan.monthlyPriceCents)} / 30 天，每日 ${formatUsdMicros(plan.dailyQuotaUsdMicros)}`)}</option>
        `).join('');
    }
    if (addonSelect) {
        const packages = Array.isArray(state.addonPackages) ? state.addonPackages : [];
        addonSelect.innerHTML = '<option value="">请选择加量包</option>' + packages.map((item) => `
            <option value="${escapeHtml(String(item.amountCents / 100))}">${escapeHtml(`${formatCents(item.amountCents)} 增加 ${formatUsdMicros(item.quotaUsdMicros)}`)}</option>
        `).join('');
    }
}

function renderSubscriptionOrders(orders = []) {
    if (!orders.length) return '<p class="text-sm text-text-muted dark:text-dark-text-muted">暂无订单。</p>';
    return `
        <div class="space-y-3">
            ${orders.map((order) => `
                <article class="rounded-md border border-border-subtle dark:border-dark-border bg-background-soft dark:bg-dark-surface p-4">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="font-medium text-primary dark:text-dark-text">${escapeHtml(order.planName || (order.orderType === 'addon' ? '加量包' : order.planId))}</p>
                            <p class="mt-1 text-sm text-text-muted dark:text-dark-text-muted">${escapeHtml(formatCents(order.amountCents))} · ${escapeHtml(formatDate(order.createdAt))}</p>
                        </div>
                        <span class="rounded-full border border-border-subtle dark:border-dark-border px-3 py-1 text-xs text-text-muted dark:text-dark-text-muted">${escapeHtml(subscriptionOrderStatusText(order.status))}</span>
                    </div>
                    ${order.quotaUsdMicros ? `<p class="mt-2 text-sm text-text-muted dark:text-dark-text-muted">额度 ${escapeHtml(formatUsdMicros(order.quotaUsdMicros))}</p>` : ''}
                </article>
            `).join('')}
        </div>
    `;
}

function renderUsdCharges(charges = []) {
    if (!charges.length) return '<p class="text-sm text-text-muted dark:text-dark-text-muted">暂无美元扣费记录。</p>';
    return `
        <table class="min-w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
                <tr><th class="py-2 pr-3">时间</th><th class="py-2 pr-3">模型</th><th class="py-2 pr-3">费用</th><th class="py-2 pr-3">扣每日</th><th class="py-2 pr-3">扣加量包</th><th class="py-2">状态</th></tr>
            </thead>
            <tbody>
                ${charges.map((charge) => `
                    <tr class="border-t border-border-subtle dark:border-dark-border">
                        <td class="py-2 pr-3">${escapeHtml(formatDate(charge.createdAt))}</td>
                        <td class="py-2 pr-3">${escapeHtml(charge.model || '-')}</td>
                        <td class="py-2 pr-3">${escapeHtml(formatUsdMicros(charge.chargeUsdMicros))}</td>
                        <td class="py-2 pr-3">${escapeHtml(formatUsdMicros(charge.dailyQuotaDeductedUsdMicros))}</td>
                        <td class="py-2 pr-3">${escapeHtml(formatUsdMicros(charge.addonDeductedUsdMicros))}</td>
                        <td class="py-2">${escapeHtml(chargeStatusText(charge.status))}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderAddonLedger(entries = []) {
    if (!entries.length) return '<p class="text-sm text-text-muted dark:text-dark-text-muted">暂无加量包流水。</p>';
    return `
        <table class="min-w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
                <tr><th class="py-2 pr-3">时间</th><th class="py-2 pr-3">类型</th><th class="py-2 pr-3">金额</th><th class="py-2 pr-3">余额</th><th class="py-2">备注</th></tr>
            </thead>
            <tbody>
                ${entries.map((entry) => `
                    <tr class="border-t border-border-subtle dark:border-dark-border">
                        <td class="py-2 pr-3">${escapeHtml(formatDate(entry.createdAt))}</td>
                        <td class="py-2 pr-3">${escapeHtml(ledgerEntryText(entry.entryType))}</td>
                        <td class="py-2 pr-3">${escapeHtml(formatUsdMicros(entry.amountUsdMicros))}</td>
                        <td class="py-2 pr-3">${escapeHtml(formatUsdMicros(entry.balanceAfterUsdMicros))}</td>
                        <td class="py-2">${escapeHtml(entry.memo || '-')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function formatModelPrice(value) {
    const amount = Number(value || 0);
    if (!Number.isFinite(amount)) return '¥0.00';
    const cents = amount * 100;
    return `¥${Number.isInteger(cents) ? amount.toFixed(2) : amount.toFixed(3)}`;
}

function renderAccountModelOverview(data = {}) {
    const models = Array.isArray(data.models) ? data.models : [];
    if (!models.length) {
        return '<p class="text-sm text-text-muted dark:text-dark-text-muted">暂无模型价格。</p>';
    }
    return `
        <table class="min-w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-[0.14em] text-text-muted dark:text-dark-text-muted">
                <tr>
                    <th class="py-2 pr-4">模型</th>
                    <th class="py-2 pr-4">状态</th>
                    <th class="py-2 pr-4">缓存命中输入 / 1M</th>
                    <th class="py-2 pr-4">未命中输入 / 1M</th>
                    <th class="py-2 pr-4">输出 / 1M</th>
                </tr>
            </thead>
            <tbody>
                ${models.map((model) => `
                    <tr class="border-t border-border-subtle dark:border-dark-border">
                        <td class="py-3 pr-4 font-mono text-primary dark:text-dark-text">${escapeHtml(model.id || '-')}</td>
                        <td class="py-3 pr-4">${escapeHtml(model.available ? '可用' : '价格表')}</td>
                        <td class="py-3 pr-4 whitespace-nowrap">${escapeHtml(formatModelPrice(model.cacheHitInputCnyPerMillion))}</td>
                        <td class="py-3 pr-4 whitespace-nowrap">${escapeHtml(formatModelPrice(model.cacheMissInputCnyPerMillion))}</td>
                        <td class="py-3 pr-4 whitespace-nowrap">${escapeHtml(formatModelPrice(model.outputCnyPerMillion))}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderTopups(topups = []) {
    if (!topups.length) return '<p class="text-sm text-text-muted dark:text-dark-text-muted">暂无充值申请。</p>';
    return `
        <div class="space-y-3">
            ${topups.map((topup) => `
                <article class="rounded-md border border-border-subtle dark:border-dark-border bg-background-soft dark:bg-dark-surface p-4">
                    <div class="flex items-start justify-between gap-3">
                        <div>
                            <p class="font-medium text-primary dark:text-dark-text">${escapeHtml(formatCents(topup.requestedAmountCents))}</p>
                            <p class="mt-1 text-sm text-text-muted dark:text-dark-text-muted">${escapeHtml(topup.paymentMethod === 'wechat' ? '微信' : '支付宝')} · ${escapeHtml(formatDate(topup.createdAt))}</p>
                        </div>
                        <span class="rounded-full border border-border-subtle dark:border-dark-border px-3 py-1 text-xs text-text-muted dark:text-dark-text-muted">${escapeHtml(topupStatusText(topup.status))}</span>
                    </div>
                    ${topup.adminNote ? `<p class="mt-2 text-sm text-text-muted dark:text-dark-text-muted">${escapeHtml(topup.adminNote)}</p>` : ''}
                </article>
            `).join('')}
        </div>
    `;
}

function renderCharges(charges = [], options = {}) {
    if (!charges.length) return '<p class="text-sm text-text-muted dark:text-dark-text-muted">暂无 API 扣费记录。</p>';
    const phoneHeader = options.showPhone ? '<th class="py-2 pr-3">用户</th>' : '';
    return `
        <table class="min-w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
                <tr><th class="py-2 pr-3">时间</th>${phoneHeader}<th class="py-2 pr-3">模型</th><th class="py-2 pr-3">命中输入</th><th class="py-2 pr-3">未命中输入</th><th class="py-2 pr-3">输出</th><th class="py-2 pr-3">Reasoning</th><th class="py-2 pr-3">费用</th><th class="py-2 pr-3">扣后余额</th><th class="py-2">状态</th></tr>
            </thead>
            <tbody>
                ${charges.map((charge) => `
                    <tr class="border-t border-border-subtle dark:border-dark-border">
                        <td class="py-2 pr-3">${escapeHtml(formatDate(charge.createdAt))}</td>
                        ${options.showPhone ? `<td class="py-2 pr-3">${escapeHtml(charge.phone || '-')}</td>` : ''}
                        <td class="py-2 pr-3">${escapeHtml(charge.model)}</td>
                        <td class="py-2 pr-3">${escapeHtml(formatNumber(charge.cacheHitInputTokens))}</td>
                        <td class="py-2 pr-3">${escapeHtml(formatNumber(charge.cacheMissInputTokens))}</td>
                        <td class="py-2 pr-3">${escapeHtml(formatNumber(charge.outputTokens))}</td>
                        <td class="py-2 pr-3">${escapeHtml(formatNumber(charge.reasoningTokens))}</td>
                        <td class="py-2 pr-3">${escapeHtml(charge.chargeNanos === undefined ? formatCents(charge.chargeCents) : formatNanos(charge.chargeNanos))}</td>
                        <td class="py-2 pr-3">${escapeHtml(charge.balanceAfterNanos === undefined ? formatCents(charge.balanceAfterCents) : formatNanos(charge.balanceAfterNanos))}</td>
                        <td class="py-2">${escapeHtml(chargeStatusText(charge.status))}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderLedger(entries = []) {
    if (!entries.length) return '<p class="text-sm text-text-muted dark:text-dark-text-muted">暂无账户流水。</p>';
    return `
        <table class="min-w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
                <tr><th class="py-2 pr-3">时间</th><th class="py-2 pr-3">类型</th><th class="py-2 pr-3">金额</th><th class="py-2 pr-3">余额</th><th class="py-2">备注</th></tr>
            </thead>
            <tbody>
                ${entries.map((entry) => `
                    <tr class="border-t border-border-subtle dark:border-dark-border">
                        <td class="py-2 pr-3">${escapeHtml(formatDate(entry.createdAt))}</td>
                        <td class="py-2 pr-3">${escapeHtml(ledgerEntryText(entry.entryType))}</td>
                        <td class="py-2 pr-3">${escapeHtml(formatCents(entry.amountCents))}</td>
                        <td class="py-2 pr-3">${escapeHtml(formatCents(entry.balanceAfterCents))}</td>
                        <td class="py-2">${escapeHtml(entry.memo || '-')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function initRedeemPage() {
    const form = document.getElementById('redeemForm');
    const accountPhone = document.getElementById('redeemAccountPhone');
    const codeInput = document.getElementById('inviteCodeInput');
    const message = document.getElementById('redeemMessage');
    if (!form || !accountPhone || !codeInput || !message) return;

    requestJson('/api/account/me')
        .then((data) => {
            accountPhone.textContent = data.user?.phone || '-';
        })
        .catch(() => {
            window.location.replace('/shop/login/');
        });

    codeInput.addEventListener('input', () => {
        codeInput.value = normalizeInviteCode(codeInput.value);
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const code = normalizeInviteCode(codeInput.value);
        if (!code) {
            message.textContent = '请输入邀请码。';
            codeInput.focus();
            return;
        }

        message.textContent = '正在兑换...';
        try {
            await requestJson('/api/account/invites/redeem', {
                method: 'POST',
                body: JSON.stringify({ code })
            });
            window.location.href = '/shop/account/';
        } catch (error) {
            message.textContent = error.message;
        }
    });
}

function normalizeInviteCode(value) {
    return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 18);
}

async function initKeyPage() {
    const root = document.getElementById('keyResult');
    const empty = document.getElementById('emptyKey');
    if (!root) return;
    root.innerHTML = '<p class="text-sm text-text-muted dark:text-dark-text-muted">正在读取当前兑换结果...</p>';

    try {
        const data = await requestJson('/api/orders/current');
        root.classList.remove('hidden');
        if (empty) empty.classList.add('hidden');
        root.innerHTML = renderOrderCard(data.order, { showFullKey: true });
        bindCopy(root);
    } catch (error) {
        if (empty) empty.classList.remove('hidden');
        root.classList.add('hidden');
    }
}

function initQueryPage() {
    window.location.replace('/shop/account/');
}

async function initAccountPage() {
    initCollapsibleSections(document);

    const phoneRoot = document.getElementById('accountPhone');
    const ordersRoot = document.getElementById('accountOrders');
    const message = document.getElementById('accountMessage');
    const logoutButton = document.getElementById('logoutButton');
    const billingUsageCards = document.getElementById('accountBillingUsageCards');
    const accountWeeklySpendingChart = document.getElementById('accountWeeklySpendingChart');
    const usageFreshness = document.getElementById('usageFreshness');
    const usageMessage = document.getElementById('accountUsageMessage');
    const modelOverviewRoot = document.getElementById('accountModelOverview');
    const quotaCards = document.getElementById('accountQuotaCards');
    const quotaBar = document.getElementById('accountQuotaBar');
    const quotaHint = document.getElementById('accountQuotaHint');
    const billingMessage = document.getElementById('accountBillingMessage');
    const subscriptionOrderForm = document.getElementById('subscriptionOrderForm');
    const subscriptionPlanSelect = document.getElementById('subscriptionPlanSelect');
    const subscriptionPaymentMethod = document.getElementById('subscriptionPaymentMethod');
    const subscriptionPaymentNote = document.getElementById('subscriptionPaymentNote');
    const subscriptionOrderMessage = document.getElementById('subscriptionOrderMessage');
    const addonOrderForm = document.getElementById('addonOrderForm');
    const addonAmountSelect = document.getElementById('addonAmountSelect');
    const addonPaymentMethod = document.getElementById('addonPaymentMethod');
    const addonPaymentNote = document.getElementById('addonPaymentNote');
    const addonOrderMessage = document.getElementById('addonOrderMessage');
    const accountSubscriptionOrders = document.getElementById('accountSubscriptionOrders');
    const accountAddonOrders = document.getElementById('accountAddonOrders');
    const accountCharges = document.getElementById('accountCharges');
    const accountLedger = document.getElementById('accountLedger');
    const alipayQrImage = document.getElementById('alipayQrImage');
    const wechatQrImage = document.getElementById('wechatQrImage');
    const paymentReference = document.getElementById('paymentReference');
    const accountRedeemForm = document.getElementById('accountRedeemForm');
    const accountInviteCodeInput = document.getElementById('accountInviteCodeInput');
    const accountRedeemMessage = document.getElementById('accountRedeemMessage');
    let accountWeeklySpending = null;
    let selectedAccountWeekStart = '';
    if (!phoneRoot || !ordersRoot || !message || !logoutButton) return;

    ordersRoot.innerHTML = '<p class="text-sm text-text-muted dark:text-dark-text-muted">正在读取账户信息...</p>';
    try {
        const data = await requestJson('/api/account/me');
        phoneRoot.textContent = data.user.phone;
        const orders = data.orders || [];
        if (!orders.length) {
            ordersRoot.innerHTML = `
                <section class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-8 text-center">
                    <h2 class="font-display text-3xl text-primary dark:text-dark-text">暂无 API key</h2>
                    <p class="mt-3 text-text-muted dark:text-dark-text-muted">输入管理员提供的邀请码后，API key 会绑定到当前账号。</p>
                </section>
            `;
        } else {
            ordersRoot.innerHTML = `<div class="grid gap-5">${orders.map((order) => renderOrderCard(order, { revealKey: true, compactAccountOrder: true })).join('')}</div>`;
            ordersRoot.querySelectorAll('article').forEach(bindCopy);
        }
        message.textContent = '';
    } catch (error) {
        window.location.replace('/shop/login/');
    }

    async function refreshModelOverview() {
        if (!modelOverviewRoot) return;
        modelOverviewRoot.innerHTML = '<p class="text-sm text-text-muted dark:text-dark-text-muted">正在读取模型...</p>';
        try {
            const data = await requestJson('/api/account/model-overview');
            modelOverviewRoot.innerHTML = renderAccountModelOverview(data);
        } catch (error) {
            modelOverviewRoot.innerHTML = `<p class="text-sm text-text-muted dark:text-dark-text-muted">${escapeHtml(error.message)}</p>`;
        }
    }

    async function refreshBilling() {
        if (billingMessage) billingMessage.textContent = '正在读取账务信息...';
        const [stateData, subscriptionOrdersData, addonOrdersData, chargeData, ledgerData] = await Promise.all([
            requestJson('/api/account/subscription-state'),
            requestJson('/api/account/subscription-orders'),
            requestJson('/api/account/addon-orders'),
            requestJson('/api/account/usd-charges'),
            requestJson('/api/account/addon-ledger')
        ]);
        fillSubscriptionControls(stateData);
        if (quotaCards) quotaCards.innerHTML = renderQuotaCards(stateData);
        if (quotaBar) quotaBar.innerHTML = renderQuotaBar(stateData);
        if (quotaHint) {
            const quota = stateData.quota || {};
            quotaHint.textContent = quota.code === 'active' ? `刷新日期 ${quota.quotaDate}` : '需要套餐或额度';
        }
        if (accountSubscriptionOrders) accountSubscriptionOrders.innerHTML = renderSubscriptionOrders(subscriptionOrdersData.orders || []);
        if (accountAddonOrders) accountAddonOrders.innerHTML = renderSubscriptionOrders(addonOrdersData.orders || []);
        if (accountCharges) accountCharges.innerHTML = renderUsdCharges(chargeData.charges || []);
        if (accountLedger) accountLedger.innerHTML = renderAddonLedger(ledgerData.entries || []);
        if (alipayQrImage) alipayQrImage.src = stateData.payment?.alipayQrUrl || '';
        if (wechatQrImage) wechatQrImage.src = stateData.payment?.wechatQrUrl || '';
        if (paymentReference) paymentReference.textContent = stateData.payment?.paymentReference || '-';
        if (billingMessage) billingMessage.textContent = '';
    }

    await refreshModelOverview();

    try {
        await refreshBilling();
    } catch (error) {
        if (billingMessage) billingMessage.textContent = error.message;
    }

    if (subscriptionOrderForm && subscriptionPlanSelect && subscriptionPaymentMethod && subscriptionOrderMessage) {
        subscriptionOrderForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!subscriptionPlanSelect.value) {
                subscriptionOrderMessage.textContent = '请选择套餐。';
                subscriptionPlanSelect.focus();
                return;
            }
            subscriptionOrderMessage.textContent = '正在提交套餐订单...';
            try {
                await requestJson('/api/account/subscription-orders', {
                    method: 'POST',
                    body: JSON.stringify({
                        planId: subscriptionPlanSelect.value,
                        paymentMethod: subscriptionPaymentMethod.value,
                        paymentNote: subscriptionPaymentNote?.value || ''
                    })
                });
                subscriptionOrderForm.reset();
                subscriptionOrderMessage.textContent = '套餐订单已提交，管理员确认后生效。';
                await refreshBilling();
            } catch (error) {
                subscriptionOrderMessage.textContent = error.message;
            }
        });
    }

    if (addonOrderForm && addonAmountSelect && addonPaymentMethod && addonOrderMessage) {
        addonOrderForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!addonAmountSelect.value) {
                addonOrderMessage.textContent = '请选择加量包。';
                addonAmountSelect.focus();
                return;
            }
            addonOrderMessage.textContent = '正在提交加量包订单...';
            try {
                await requestJson('/api/account/addon-orders', {
                    method: 'POST',
                    body: JSON.stringify({
                        amount: addonAmountSelect.value,
                        paymentMethod: addonPaymentMethod.value,
                        paymentNote: addonPaymentNote?.value || ''
                    })
                });
                addonOrderForm.reset();
                addonOrderMessage.textContent = '加量包订单已提交，管理员确认后入账。';
                await refreshBilling();
            } catch (error) {
                addonOrderMessage.textContent = error.message;
            }
        });
    }

    if (accountRedeemForm && accountInviteCodeInput && accountRedeemMessage) {
        accountInviteCodeInput.addEventListener('input', () => {
            accountInviteCodeInput.value = normalizeInviteCode(accountInviteCodeInput.value);
        });
        accountRedeemForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const code = normalizeInviteCode(accountInviteCodeInput.value);
            if (!code) {
                accountRedeemMessage.textContent = '请输入邀请码。';
                accountInviteCodeInput.focus();
                return;
            }
            accountRedeemMessage.textContent = '正在兑换...';
            try {
                await requestJson('/api/account/invites/redeem', {
                    method: 'POST',
                    body: JSON.stringify({ code })
                });
                accountInviteCodeInput.value = '';
                accountRedeemMessage.textContent = '兑换成功，API key 已绑定到当前账号。';
                window.location.reload();
            } catch (error) {
                accountRedeemMessage.textContent = error.message;
            }
        });
    }

    if (accountWeeklySpendingChart) {
        accountWeeklySpendingChart.addEventListener('click', (event) => {
            const button = event.target.closest('[data-account-week-offset]');
            if (!button || !accountWeeklySpending) return;
            const weekStarts = Array.isArray(accountWeeklySpending.weekStarts) ? accountWeeklySpending.weekStarts : [];
            const currentIndex = weekStarts.indexOf(selectedAccountWeekStart);
            const offset = Number(button.getAttribute('data-account-week-offset') || 0);
            const nextWeekStart = weekStarts[currentIndex + offset];
            if (!nextWeekStart) return;
            selectedAccountWeekStart = nextWeekStart;
            accountWeeklySpendingChart.innerHTML = renderAccountWeeklySpendingChart(accountWeeklySpending, selectedAccountWeekStart);
        });
    }

    try {
        const usage = await requestJson('/api/account/usage-summary');
        if (billingUsageCards) billingUsageCards.innerHTML = renderBillingUsageCards(usage.billing || {});
        accountWeeklySpending = usage.billing?.weeklySpending || {};
        selectedAccountWeekStart = accountWeeklySpending.currentWeekStart || accountWeeklySpending.weekStarts?.[accountWeeklySpending.weekStarts.length - 1] || '';
        if (accountWeeklySpendingChart) accountWeeklySpendingChart.innerHTML = renderAccountWeeklySpendingChart(accountWeeklySpending, selectedAccountWeekStart);
        if (usageFreshness) {
            usageFreshness.textContent = `生成时间 ${formatDate(usage.generatedAt)}，用量统计可能最多延迟 1 小时。`;
        }
        if (usageMessage) usageMessage.textContent = '';
    } catch (error) {
        if (usageMessage) usageMessage.textContent = error.message;
    }

    logoutButton.addEventListener('click', async () => {
        message.textContent = '正在退出...';
        try {
            await requestJson('/api/auth/logout', { method: 'POST' });
            window.location.href = '/shop/login/';
        } catch (error) {
            message.textContent = error.message;
        }
    });
}

async function initAccountLinks() {
    const links = Array.from(document.querySelectorAll('[data-account-link]'));
    if (!links.length) return;
    for (const link of links) {
        link.href = '/shop/login/';
        link.textContent = '登录';
    }
}

    window.YuiShopAccount = {
        statusText,
        statusClass,
        billingStatusText,
        topupStatusText,
        ledgerEntryText,
        chargeStatusText,
        renderOrderCard,
        bindCopy,
        renderBillingUsageCards,
        renderBalanceCards,
        renderQuotaCards,
        renderQuotaBar,
        formatModelPrice,
        renderAccountModelOverview,
        renderTopups,
        renderSubscriptionOrders,
        renderCharges,
        renderUsdCharges,
        renderLedger,
        renderAddonLedger,
        initRedeemPage,
        normalizeInviteCode,
        initKeyPage,
        initQueryPage,
        initAccountPage,
        initAccountLinks
    };
})();
