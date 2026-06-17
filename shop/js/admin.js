// Shop 管理员业务办理、用量监控和账户余额页面逻辑。
(function() {
    const {
        bindPhoneInput,
        escapeHtml,
        formatCents,
        formatDate,
        formatNanos,
        formatNumber,
        formatUsdMicros,
        isPhone,
        initCollapsibleSections,
        requestJson
    } = window.YuiShopCore;
    const { renderAdminRevenueCharts } = window.YuiShopCharts;
    const {
        billingStatusText,
        renderBillingUsageCards,
        renderCharges,
        topupStatusText
    } = window.YuiShopAccount;

function renderAdminBalanceSummary(summary = {}) {
    const cards = [
        ['用户数', formatNumber(summary.userCount || 0), 'Shop 账号'],
        ['总余额', summary.totalBalanceNanos === undefined ? formatCents(summary.totalBalanceCents) : formatNanos(summary.totalBalanceNanos), '账户当前余额合计'],
        ['欠费用户', formatNumber(summary.debtUserCount || 0), summary.debtNanos === undefined ? formatCents(summary.debtCents) : formatNanos(summary.debtNanos)],
        ['待确认充值', summary.pendingTopupNanos === undefined ? formatCents(summary.pendingTopupCents) : formatNanos(summary.pendingTopupNanos), '用户已提交待审核']
    ];
    return cards.map(([label, value, hint]) => `
        <article class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">${escapeHtml(label)}</p>
            <p class="mt-2 text-2xl font-display text-primary dark:text-dark-text">${escapeHtml(value)}</p>
            <p class="mt-1 text-xs text-text-muted dark:text-dark-text-muted">${escapeHtml(hint)}</p>
        </article>
    `).join('');
}

function renderAdminTopups(topups = []) {
    if (!topups.length) {
        return '<div class="p-5 text-sm text-text-muted dark:text-dark-text-muted">暂无充值申请。</div>';
    }
    return `
        <table class="min-w-full divide-y divide-border-subtle dark:divide-dark-border text-sm">
            <thead class="bg-background-soft dark:bg-dark-surface text-left text-xs uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
                <tr>
                    <th class="px-4 py-3">用户</th>
                    <th class="px-4 py-3">金额</th>
                    <th class="px-4 py-3">方式</th>
                    <th class="px-4 py-3">备注</th>
                    <th class="px-4 py-3">状态</th>
                    <th class="px-4 py-3">操作</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-border-subtle dark:divide-dark-border bg-white dark:bg-dark-card">
                ${topups.map((topup) => `
                    <tr data-topup-id="${escapeHtml(topup.id)}">
                        <td class="px-4 py-3">${escapeHtml(topup.phone)}</td>
                        <td class="px-4 py-3">${escapeHtml(formatCents(topup.requestedAmountCents))}</td>
                        <td class="px-4 py-3">${escapeHtml(topup.paymentMethod === 'wechat' ? '微信' : '支付宝')}</td>
                        <td class="px-4 py-3">${escapeHtml(topup.paymentNote || '-')}</td>
                        <td class="px-4 py-3">${escapeHtml(topupStatusText(topup.status))}</td>
                        <td class="px-4 py-3">
                            ${topup.status === 'pending' ? `
                                <div class="flex flex-col gap-2 min-w-40">
                                    <input class="h-9 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary" data-confirmed-amount value="${escapeHtml(String(topup.requestedAmount || ''))}" inputmode="decimal"/>
                                    <input class="h-9 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary" data-admin-note placeholder="管理员备注"/>
                                    <div class="flex gap-2">
                                        <button class="btn-primary px-3 py-2 text-xs" type="button" data-approve-topup>确认</button>
                                        <button class="btn-secondary dark:bg-dark-card dark:border-dark-border dark:text-dark-text px-3 py-2 text-xs" type="button" data-reject-topup>拒绝</button>
                                    </div>
                                </div>
                            ` : '-'}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderAdminBalanceTable(items = []) {
    if (!items.length) {
        return '<div class="p-5 text-sm text-text-muted dark:text-dark-text-muted">暂无用户余额记录。</div>';
    }
    return `
        <table class="min-w-full divide-y divide-border-subtle dark:divide-dark-border text-sm">
            <thead class="bg-background-soft dark:bg-dark-surface text-left text-xs uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
                <tr>
                    <th class="px-4 py-3">用户</th>
                    <th class="px-4 py-3">状态</th>
                    <th class="px-4 py-3">余额</th>
                    <th class="px-4 py-3">欠费</th>
                    <th class="px-4 py-3">待确认充值</th>
                    <th class="px-4 py-3">托管 key</th>
                    <th class="px-4 py-3">更新</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-border-subtle dark:divide-dark-border bg-white dark:bg-dark-card">
                ${items.map((item) => `
                    <tr>
                        <td class="px-4 py-3">${escapeHtml(item.phone || '-')}</td>
                        <td class="px-4 py-3">${escapeHtml(billingStatusText(item.status))}</td>
                        <td class="px-4 py-3">${escapeHtml(item.balanceNanos === undefined ? formatCents(item.balanceCents) : formatNanos(item.balanceNanos))}</td>
                        <td class="px-4 py-3">${escapeHtml(item.debtNanos === undefined ? formatCents(item.debtCents) : formatNanos(item.debtNanos))}</td>
                        <td class="px-4 py-3">${escapeHtml(item.pendingTopupNanos === undefined ? formatCents(item.pendingTopupCents) : formatNanos(item.pendingTopupNanos))}</td>
                        <td class="px-4 py-3">${escapeHtml(`${formatNumber(item.managedApiKeyCount || 0)} 个（已用 ${formatNumber(item.usedApiKeyCount || 0)}）`)}</td>
                        <td class="px-4 py-3">${escapeHtml(formatDate(item.updatedAt))}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function subscriptionOrderStatusText(status) {
    const map = {
        pending: '待确认',
        approved: '已确认',
        rejected: '已拒绝'
    };
    return map[status] || status || '-';
}

function renderAdminSubscriptionOrders(orders = [], orderType = 'subscription') {
    if (!orders.length) {
        return '<div class="p-5 text-sm text-text-muted dark:text-dark-text-muted">暂无订单。</div>';
    }
    return `
        <table class="min-w-full divide-y divide-border-subtle dark:divide-dark-border text-sm">
            <thead class="bg-background-soft dark:bg-dark-surface text-left text-xs uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
                <tr><th class="px-4 py-3">用户</th><th class="px-4 py-3">内容</th><th class="px-4 py-3">金额</th><th class="px-4 py-3">额度</th><th class="px-4 py-3">状态</th><th class="px-4 py-3">提交</th><th class="px-4 py-3">操作</th></tr>
            </thead>
            <tbody class="divide-y divide-border-subtle dark:divide-dark-border bg-white dark:bg-dark-card">
                ${orders.map((order) => `
                    <tr data-subscription-order-id="${escapeHtml(order.id)}" data-subscription-order-type="${escapeHtml(orderType)}">
                        <td class="px-4 py-3">${escapeHtml(order.phone || '-')}</td>
                        <td class="px-4 py-3">${escapeHtml(order.planName || (orderType === 'addon' ? '加量包' : order.planId || '-'))}</td>
                        <td class="px-4 py-3">${escapeHtml(formatCents(order.amountCents))}</td>
                        <td class="px-4 py-3">${escapeHtml(formatUsdMicros(order.quotaUsdMicros))}</td>
                        <td class="px-4 py-3">${escapeHtml(subscriptionOrderStatusText(order.status))}</td>
                        <td class="px-4 py-3">${escapeHtml(formatDate(order.createdAt))}</td>
                        <td class="px-4 py-3">
                            ${order.status === 'pending' ? `
                                <div class="flex flex-col gap-2 min-w-36">
                                    <input class="h-9 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary" data-admin-note placeholder="管理员备注"/>
                                    <div class="flex gap-2">
                                        <button class="btn-primary px-3 py-2 text-xs" type="button" data-approve-subscription-order>确认</button>
                                        <button class="btn-secondary dark:bg-dark-card dark:border-dark-border dark:text-dark-text px-3 py-2 text-xs" type="button" data-reject-subscription-order>拒绝</button>
                                    </div>
                                </div>
                            ` : '-'}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderAdminRefundRequests(refundRequests = []) {
    if (!refundRequests.length) {
        return '<div class="p-5 text-sm text-text-muted dark:text-dark-text-muted">暂无退款申请。</div>';
    }
    return `
        <table class="min-w-full divide-y divide-border-subtle dark:divide-dark-border text-sm">
            <thead class="bg-background-soft dark:bg-dark-surface text-left text-xs uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
                <tr><th class="px-4 py-3">用户</th><th class="px-4 py-3">套餐</th><th class="px-4 py-3">套餐金额</th><th class="px-4 py-3">开始 / 到期</th><th class="px-4 py-3">剩余</th><th class="px-4 py-3">退款</th><th class="px-4 py-3">申请</th><th class="px-4 py-3">状态</th><th class="px-4 py-3">操作</th></tr>
            </thead>
            <tbody class="divide-y divide-border-subtle dark:divide-dark-border bg-white dark:bg-dark-card">
                ${refundRequests.map((request) => `
                    <tr data-refund-request-id="${escapeHtml(request.id)}">
                        <td class="px-4 py-3">${escapeHtml(request.phone || '-')}</td>
                        <td class="px-4 py-3">${escapeHtml(request.planName || request.planId || '-')}</td>
                        <td class="px-4 py-3">${escapeHtml(formatCents(request.planAmountCents))}</td>
                        <td class="px-4 py-3">${escapeHtml(`${formatDate(request.startedAt)} / ${formatDate(request.expiresAt)}`)}</td>
                        <td class="px-4 py-3">${escapeHtml(`${request.remainingDays || 0} 天`)}</td>
                        <td class="px-4 py-3">${escapeHtml(formatCents(request.refundAmountCents))}</td>
                        <td class="px-4 py-3">${escapeHtml(formatDate(request.createdAt))}</td>
                        <td class="px-4 py-3">${escapeHtml(subscriptionOrderStatusText(request.status))}</td>
                        <td class="px-4 py-3">
                            ${request.status === 'pending' ? `
                                <div class="flex flex-col gap-2 min-w-36">
                                    <input class="h-9 rounded-md border-border-subtle dark:border-dark-border bg-white dark:bg-dark-bg text-primary dark:text-dark-text focus:border-primary focus:ring-primary" data-admin-note placeholder="管理员备注"/>
                                    <div class="flex gap-2">
                                        <button class="btn-primary px-3 py-2 text-xs" type="button" data-approve-refund-request>批准</button>
                                        <button class="btn-secondary dark:bg-dark-card dark:border-dark-border dark:text-dark-text px-3 py-2 text-xs" type="button" data-reject-refund-request>拒绝</button>
                                    </div>
                                </div>
                            ` : '-'}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderAdminSubscriptionUserSummary(summary = {}) {
    const cards = [
        ['用户数', formatNumber(summary.userCount || 0), 'Shop 账号'],
        ['有效订阅', formatNumber(summary.activeUserCount || 0), '当前可用'],
        ['额度用尽', formatNumber(summary.exhaustedUserCount || 0), '今日无可用额度'],
        ['加量包余额', formatUsdMicros(summary.addonBalanceUsdMicros), '长期余额合计']
    ];
    return cards.map(([label, value, hint]) => `
        <article class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">${escapeHtml(label)}</p>
            <p class="mt-2 text-2xl font-display text-primary dark:text-dark-text">${escapeHtml(value)}</p>
            <p class="mt-1 text-xs text-text-muted dark:text-dark-text-muted">${escapeHtml(hint)}</p>
        </article>
    `).join('');
}

function renderAdminSubscriptionUsers(items = []) {
    if (!items.length) {
        return '<div class="p-5 text-sm text-text-muted dark:text-dark-text-muted">暂无用户额度记录。</div>';
    }
    return `
        <table class="min-w-full divide-y divide-border-subtle dark:divide-dark-border text-sm">
            <thead class="bg-background-soft dark:bg-dark-surface text-left text-xs uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
                <tr><th class="px-4 py-3">用户</th><th class="px-4 py-3">套餐</th><th class="px-4 py-3">到期</th><th class="px-4 py-3">今日额度</th><th class="px-4 py-3">今日已用</th><th class="px-4 py-3">今日剩余</th><th class="px-4 py-3">加量包</th><th class="px-4 py-3">可用</th></tr>
            </thead>
            <tbody class="divide-y divide-border-subtle dark:divide-dark-border bg-white dark:bg-dark-card">
                ${items.map((item) => `
                    <tr>
                        <td class="px-4 py-3">${escapeHtml(item.phone || '-')}</td>
                        <td class="px-4 py-3">${escapeHtml(item.planName || '未开通')}</td>
                        <td class="px-4 py-3">${escapeHtml(formatDate(item.expiresAt))}</td>
                        <td class="px-4 py-3">${escapeHtml(formatUsdMicros(item.dailyQuotaUsdMicros))}</td>
                        <td class="px-4 py-3">${escapeHtml(formatUsdMicros(item.dailyUsedUsdMicros))}</td>
                        <td class="px-4 py-3">${escapeHtml(formatUsdMicros(item.dailyRemainingUsdMicros))}</td>
                        <td class="px-4 py-3">${escapeHtml(formatUsdMicros(item.addonBalanceUsdMicros))}</td>
                        <td class="px-4 py-3">${escapeHtml(formatUsdMicros(item.remainingUsdMicros))}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderAdminUsdCharges(charges = []) {
    if (!charges.length) {
        return '<div class="p-5 text-sm text-text-muted dark:text-dark-text-muted">暂无美元消耗日志。</div>';
    }
    return `
        <table class="min-w-full divide-y divide-border-subtle dark:divide-dark-border text-sm">
            <thead class="bg-background-soft dark:bg-dark-surface text-left text-xs uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
                <tr><th class="px-4 py-3">时间</th><th class="px-4 py-3">用户</th><th class="px-4 py-3">模型</th><th class="px-4 py-3">费用</th><th class="px-4 py-3">扣每日</th><th class="px-4 py-3">扣加量包</th><th class="px-4 py-3">版本</th></tr>
            </thead>
            <tbody class="divide-y divide-border-subtle dark:divide-dark-border bg-white dark:bg-dark-card">
                ${charges.map((charge) => `
                    <tr>
                        <td class="px-4 py-3">${escapeHtml(formatDate(charge.createdAt))}</td>
                        <td class="px-4 py-3">${escapeHtml(charge.phone || '-')}</td>
                        <td class="px-4 py-3">${escapeHtml(charge.model || '-')}</td>
                        <td class="px-4 py-3">${escapeHtml(formatUsdMicros(charge.chargeUsdMicros))}</td>
                        <td class="px-4 py-3">${escapeHtml(formatUsdMicros(charge.dailyQuotaDeductedUsdMicros))}</td>
                        <td class="px-4 py-3">${escapeHtml(formatUsdMicros(charge.addonDeductedUsdMicros))}</td>
                        <td class="px-4 py-3">${escapeHtml(charge.officialPriceVersion || '-')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderInviteConsoleSummary(summary = {}) {
    const cards = [
        ['未使用邀请码', summary.unusedInvites || 0],
        ['已兑换邀请码', summary.redeemedInvites || 0],
        ['未使用 API key', summary.unusedApiKeys || 0],
        ['已使用 API key', summary.usedApiKeys || 0],
        ['已禁用 API key', summary.disabledApiKeys || 0]
    ];
    return cards.map(([label, value]) => `
        <article class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">${escapeHtml(label)}</p>
            <p class="mt-2 text-2xl font-display text-primary dark:text-dark-text">${escapeHtml(formatNumber(value))}</p>
        </article>
    `).join('');
}

function renderAdminInviteTable(invites = []) {
    if (!invites.length) {
        return '<div class="p-5 text-sm text-text-muted dark:text-dark-text-muted">暂无邀请码。</div>';
    }
    return `
        <table class="min-w-full divide-y divide-border-subtle dark:divide-dark-border text-sm">
            <thead class="bg-background-soft dark:bg-dark-surface text-left text-xs uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
                <tr><th class="px-4 py-3">邀请码</th><th class="px-4 py-3">状态</th><th class="px-4 py-3">用户</th><th class="px-4 py-3">订单</th><th class="px-4 py-3">创建</th><th class="px-4 py-3">兑换</th></tr>
            </thead>
            <tbody class="divide-y divide-border-subtle dark:divide-dark-border bg-white dark:bg-dark-card">
                ${invites.map((invite) => `
                    <tr>
                        <td class="px-4 py-3 font-mono">${escapeHtml(invite.code)}</td>
                        <td class="px-4 py-3">${escapeHtml(invite.status === 'redeemed' ? '已兑换' : '未使用')}</td>
                        <td class="px-4 py-3">${escapeHtml(invite.phone || '-')}</td>
                        <td class="px-4 py-3">${escapeHtml(invite.orderId || '-')}</td>
                        <td class="px-4 py-3">${escapeHtml(formatDate(invite.createdAt))}</td>
                        <td class="px-4 py-3">${escapeHtml(formatDate(invite.redeemedAt))}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderAdminApiKeyPoolTable(apiKeyPool = []) {
    if (!apiKeyPool.length) {
        return '<div class="p-5 text-sm text-text-muted dark:text-dark-text-muted">暂无 API key 池记录。</div>';
    }
    return `
        <table class="min-w-full divide-y divide-border-subtle dark:divide-dark-border text-sm">
            <thead class="bg-background-soft dark:bg-dark-surface text-left text-xs uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
                <tr><th class="px-4 py-3">API key</th><th class="px-4 py-3">状态</th><th class="px-4 py-3">订单</th><th class="px-4 py-3">创建</th><th class="px-4 py-3">使用</th></tr>
            </thead>
            <tbody class="divide-y divide-border-subtle dark:divide-dark-border bg-white dark:bg-dark-card">
                ${apiKeyPool.map((apiKey) => `
                    <tr>
                        <td class="px-4 py-3 font-mono">${escapeHtml(apiKey.apiKeyPreview || '-')}</td>
                        <td class="px-4 py-3">${escapeHtml(usageStatusText(apiKey.status))}</td>
                        <td class="px-4 py-3">${escapeHtml(apiKey.orderId || '-')}</td>
                        <td class="px-4 py-3">${escapeHtml(formatDate(apiKey.createdAt))}</td>
                        <td class="px-4 py-3">${escapeHtml(formatDate(apiKey.usedAt))}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderAdminRecentCharges(charges = []) {
    if (!charges.length) {
        return '<div class="p-5 text-sm text-text-muted dark:text-dark-text-muted">暂无最近扣费记录。</div>';
    }
    return renderCharges(charges, { showPhone: true });
}

function usageStatusText(status) {
    const map = {
        active: '使用中',
        expired: '已过期',
        unused: '未使用',
        disabled: '已禁用',
        local: '本地',
        unmanaged: '未托管',
        used: '已使用'
    };
    return map[status] || status || '-';
}

function usageGroupText(group) {
    const map = {
        shop: 'Shop',
        local: 'Local',
        unmanaged: '未托管'
    };
    return map[group] || group || '-';
}

function renderUsageSummary(summary) {
    const cards = [
        ['今日 token', summary.today_tokens],
        ['本月 token', summary.month_tokens],
        ['总 token', summary.total_tokens],
        ['失败请求', summary.failed_requests]
    ];
    return cards.map(([label, value]) => `
        <article class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-4">
            <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">${escapeHtml(label)}</p>
            <p class="mt-2 text-2xl font-display text-primary dark:text-dark-text">${escapeHtml(formatNumber(value))}</p>
        </article>
    `).join('');
}

function renderUsageItems(items) {
    if (!items.length) {
        return '<div class="p-5 text-sm text-text-muted dark:text-dark-text-muted">暂无用量记录。</div>';
    }
    return `
        <table class="min-w-full divide-y divide-border-subtle dark:divide-dark-border text-sm">
            <thead class="bg-background-soft dark:bg-dark-surface text-left text-xs uppercase tracking-[0.16em] text-text-muted dark:text-dark-text-muted">
                <tr>
                    <th class="px-4 py-3">分组</th>
                    <th class="px-4 py-3">手机号</th>
                    <th class="px-4 py-3">API key</th>
                    <th class="px-4 py-3">状态</th>
                    <th class="px-4 py-3">今日</th>
                    <th class="px-4 py-3">本月</th>
                    <th class="px-4 py-3">总计</th>
                    <th class="px-4 py-3">请求</th>
                    <th class="px-4 py-3">最近</th>
                    <th class="px-4 py-3">模型</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-border-subtle dark:divide-dark-border bg-white dark:bg-dark-card">
                ${items.map((item) => `
                    <tr>
                        <td class="px-4 py-3">${escapeHtml(usageGroupText(item.group))}</td>
                        <td class="px-4 py-3">${escapeHtml(item.phone || '-')}</td>
                        <td class="px-4 py-3 font-mono">${escapeHtml(item.api_key_preview || '-')}</td>
                        <td class="px-4 py-3">${escapeHtml(usageStatusText(item.status))}</td>
                        <td class="px-4 py-3">${escapeHtml(formatNumber(item.today_tokens))}</td>
                        <td class="px-4 py-3">${escapeHtml(formatNumber(item.month_tokens))}</td>
                        <td class="px-4 py-3">${escapeHtml(formatNumber(item.total_tokens))}</td>
                        <td class="px-4 py-3">${escapeHtml(`${item.success_requests || 0}/${item.failed_requests || 0}/${item.total_requests || 0}`)}</td>
                        <td class="px-4 py-3">${escapeHtml(formatDate(item.last_seen_at))}</td>
                        <td class="px-4 py-3">${escapeHtml((item.models || []).map((model) => `${model.model}:${formatNumber(model.total_tokens)}`).join(' / ') || '-')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function initAdminUsagePage() {
    const refreshButton = document.getElementById('usageRefreshButton');
    const searchInput = document.getElementById('usageSearchInput');
    const groupFilter = document.getElementById('usageGroupFilter');
    const statusFilter = document.getElementById('usageStatusFilter');
    const summaryRoot = document.getElementById('usageSummaryCards');
    const billingRoot = document.getElementById('adminBillingUsageCards');
    const revenueChartsRoot = document.getElementById('adminRevenueCharts');
    const tableRoot = document.getElementById('usageTable');
    const recentChargesRoot = document.getElementById('adminRecentCharges');
    const message = document.getElementById('usageMessage');
    const importForm = document.getElementById('usageImportForm');
    const importMonth = document.getElementById('usageImportMonth');
    const importMessage = document.getElementById('usageImportMessage');
    const usageImportStatus = document.getElementById('usageImportStatus');
    if (!refreshButton || !summaryRoot || !tableRoot || !message) return;
    let latestBilling = {};
    let revenueRankingPeriod = 'month';

    function renderRevenueCharts() {
        if (!revenueChartsRoot) return;
        revenueChartsRoot.innerHTML = renderAdminRevenueCharts(latestBilling, revenueRankingPeriod);
    }

    async function fetchUsageImportStatus() {
        if (!usageImportStatus) return;
        try {
            const status = await requestJson('/api/admin/usage-import-status');
            usageImportStatus.innerHTML = `
                <p>自动导入：${status.enabled ? '已开启' : '未开启'}</p>
                <p class="mt-1">最近月份：${escapeHtml(status.lastMonth || '-')}，导入 ${escapeHtml(formatNumber(status.lastInserted || 0))}，跳过 ${escapeHtml(formatNumber(status.lastSkipped || 0))}，失败 ${escapeHtml(formatNumber(status.lastFailedLines || 0))}</p>
                <p class="mt-1">最近运行：${escapeHtml(formatDate(status.lastRunAt))}</p>
                ${status.lastError ? `<p class="mt-1 text-red-600">${escapeHtml(status.lastError)}</p>` : ''}
            `;
        } catch (error) {
            usageImportStatus.textContent = error.message;
        }
    }

    async function fetchUsage() {
        const params = new URLSearchParams({
            q: searchInput?.value || '',
            group: groupFilter?.value || 'all',
            status: statusFilter?.value || 'all'
        });
        message.textContent = '正在刷新...';
        try {
            const data = await requestJson(`/api/admin/usage-summary?${params.toString()}`);
            summaryRoot.innerHTML = renderUsageSummary(data.summary || {});
            latestBilling = data.billing || {};
            if (billingRoot) billingRoot.innerHTML = renderBillingUsageCards(latestBilling, { mode: 'adminRevenue' });
            renderRevenueCharts();
            tableRoot.innerHTML = renderUsageItems(data.items || []);
            if (recentChargesRoot) recentChargesRoot.innerHTML = renderAdminRecentCharges(data.billing?.recentCharges || []);
            message.textContent = `共 ${(data.items || []).length} 个用量分组，${(data.billing?.recentCharges || []).length} 条扣费日志。`;
        } catch (error) {
            message.textContent = error.message;
        } finally {
            await fetchUsageImportStatus();
        }
    }

    if (revenueChartsRoot) {
        revenueChartsRoot.addEventListener('click', (event) => {
            const button = event.target.closest('[data-revenue-ranking-period]');
            if (!button) return;
            revenueRankingPeriod = button.getAttribute('data-revenue-ranking-period') === 'today' ? 'today' : 'month';
            renderRevenueCharts();
        });
    }

    refreshButton.addEventListener('click', fetchUsage);
    [searchInput, groupFilter, statusFilter].forEach((element) => {
        if (!element) return;
        element.addEventListener('change', fetchUsage);
    });

    if (importForm && importMonth && importMessage) {
        importForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const month = importMonth.value;
            importMessage.textContent = '正在导入...';
            try {
                const result = await requestJson('/api/admin/usage-imports', {
                    method: 'POST',
                    body: JSON.stringify({ month })
                });
                importMessage.textContent = `导入 ${result.inserted}，跳过 ${result.skipped}，失败 ${result.failed_lines}。`;
                await fetchUsage();
            } catch (error) {
                importMessage.textContent = error.message;
            }
        });
    }
}

function initAdminPasswordResetPage() {
    const form = document.getElementById('passwordResetCodeForm');
    const phoneInput = document.getElementById('passwordResetPhone');
    const message = document.getElementById('passwordResetCodeMessage');
    const result = document.getElementById('passwordResetCodeResult');
    if (!form || !phoneInput || !message || !result) return;

    bindPhoneInput(phoneInput);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const phone = phoneInput.value.trim();
        if (!isPhone(phone)) {
            message.textContent = '请输入有效的中国大陆手机号。';
            phoneInput.focus();
            return;
        }
        message.textContent = '正在生成...';
        result.classList.add('hidden');
        result.innerHTML = '';
        try {
            const data = await requestJson('/api/admin/password-reset-codes', {
                method: 'POST',
                body: JSON.stringify({ phone })
            });
            message.textContent = '重置码已生成，只会显示这一次。';
            result.classList.remove('hidden');
            result.innerHTML = `
                <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">Reset code</p>
                <code class="mt-2 block break-all text-lg font-medium text-primary dark:text-dark-text">${escapeHtml(data.code)}</code>
                <p class="mt-3 text-sm text-text-muted dark:text-dark-text-muted">手机号：${escapeHtml(data.phone)}，有效期至 ${escapeHtml(formatDate(data.expiresAt))}。</p>
            `;
        } catch (error) {
            message.textContent = error.message;
        }
    });
}

function initAdminAccountBalancesPage() {
    const searchInput = document.getElementById('adminBalanceSearchInput');
    const statusFilter = document.getElementById('adminBalanceStatusFilter');
    const summaryRoot = document.getElementById('adminBalanceSummary');
    const tableRoot = document.getElementById('adminBalanceTable');
    const message = document.getElementById('adminBalanceMessage');
    if (!summaryRoot || !tableRoot || !message) return null;

    async function fetchAccountBalances() {
        const params = new URLSearchParams({
            q: searchInput?.value || '',
            status: statusFilter?.value || 'all'
        });
        message.textContent = '正在刷新余额...';
        try {
            const data = await requestJson(`/api/admin/account-balances?${params.toString()}`);
            summaryRoot.innerHTML = renderAdminBalanceSummary(data.summary || {});
            tableRoot.innerHTML = renderAdminBalanceTable(data.items || []);
            message.textContent = `共 ${(data.items || []).length} 个账号。`;
        } catch (error) {
            summaryRoot.innerHTML = '';
            tableRoot.innerHTML = '';
            message.textContent = error.message;
        }
    }

    searchInput?.addEventListener('input', fetchAccountBalances);
    statusFilter?.addEventListener('change', fetchAccountBalances);
    fetchAccountBalances();
    return fetchAccountBalances;
}

function initAdminSubscriptionOrdersPage(options = {}) {
    const subscriptionStatusFilter = document.getElementById('adminSubscriptionOrderStatusFilter');
    const addonStatusFilter = document.getElementById('adminAddonOrderStatusFilter');
    const subscriptionTable = document.getElementById('adminSubscriptionOrderTable');
    const addonTable = document.getElementById('adminAddonOrderTable');
    const message = document.getElementById('adminSubscriptionOrderMessage');
    if (!subscriptionStatusFilter || !addonStatusFilter || !subscriptionTable || !addonTable || !message) return null;

    async function fetchOrders() {
        message.textContent = '正在刷新订单...';
        try {
            const [subscriptionData, addonData] = await Promise.all([
                requestJson(`/api/admin/subscription-orders?status=${encodeURIComponent(subscriptionStatusFilter.value)}`),
                requestJson(`/api/admin/addon-orders?status=${encodeURIComponent(addonStatusFilter.value)}`)
            ]);
            subscriptionTable.innerHTML = renderAdminSubscriptionOrders(subscriptionData.orders || [], 'subscription');
            addonTable.innerHTML = renderAdminSubscriptionOrders(addonData.orders || [], 'addon');
            message.textContent = `订阅 ${(subscriptionData.orders || []).length} 条，加量包 ${(addonData.orders || []).length} 条。`;
        } catch (error) {
            message.textContent = error.message;
        }
    }

    async function handleOrderClick(event) {
        const approveButton = event.target.closest('[data-approve-subscription-order]');
        const rejectButton = event.target.closest('[data-reject-subscription-order]');
        if (!approveButton && !rejectButton) return;
        const row = event.target.closest('[data-subscription-order-id]');
        const id = row?.getAttribute('data-subscription-order-id');
        const orderType = row?.getAttribute('data-subscription-order-type') === 'addon' ? 'addon' : 'subscription';
        if (!id) return;
        const adminNote = row.querySelector('[data-admin-note]')?.value || '';
        const action = approveButton ? 'approve' : 'reject';
        const basePath = orderType === 'addon' ? '/api/admin/addon-orders' : '/api/admin/subscription-orders';
        message.textContent = approveButton ? '正在确认订单...' : '正在拒绝订单...';
        try {
            await requestJson(`${basePath}/${encodeURIComponent(id)}/${action}`, {
                method: 'POST',
                body: JSON.stringify({ adminNote })
            });
            await fetchOrders();
            await options.onChanged?.();
        } catch (error) {
            message.textContent = error.message;
        }
    }

    subscriptionTable.addEventListener('click', handleOrderClick);
    addonTable.addEventListener('click', handleOrderClick);
    subscriptionStatusFilter.addEventListener('change', fetchOrders);
    addonStatusFilter.addEventListener('change', fetchOrders);
    fetchOrders();
    return fetchOrders;
}

function initAdminRefundRequestsPage(options = {}) {
    const statusFilter = document.getElementById('adminRefundStatusFilter');
    const tableRoot = document.getElementById('adminRefundRequestTable');
    const message = document.getElementById('adminRefundRequestMessage');
    if (!statusFilter || !tableRoot || !message) return null;

    async function fetchRefundRequests() {
        message.textContent = '正在刷新退款申请...';
        try {
            const data = await requestJson(`/api/admin/subscription-refund-requests?status=${encodeURIComponent(statusFilter.value)}`);
            tableRoot.innerHTML = renderAdminRefundRequests(data.refundRequests || []);
            message.textContent = `退款申请 ${(data.refundRequests || []).length} 条。`;
        } catch (error) {
            message.textContent = error.message;
        }
    }

    tableRoot.addEventListener('click', async (event) => {
        const approveButton = event.target.closest('[data-approve-refund-request]');
        const rejectButton = event.target.closest('[data-reject-refund-request]');
        if (!approveButton && !rejectButton) return;
        const row = event.target.closest('[data-refund-request-id]');
        const id = row?.getAttribute('data-refund-request-id');
        if (!id) return;
        const adminNote = row.querySelector('[data-admin-note]')?.value || '';
        const action = approveButton ? 'approve' : 'reject';
        message.textContent = approveButton ? '正在批准退款...' : '正在拒绝退款...';
        try {
            await requestJson(`/api/admin/subscription-refund-requests/${encodeURIComponent(id)}/${action}`, {
                method: 'POST',
                body: JSON.stringify({ adminNote })
            });
            await fetchRefundRequests();
            await options.onChanged?.();
        } catch (error) {
            message.textContent = error.message;
        }
    });

    statusFilter.addEventListener('change', fetchRefundRequests);
    fetchRefundRequests();
    return fetchRefundRequests;
}

function initAdminSubscriptionUsersPage() {
    const searchInput = document.getElementById('adminSubscriptionUserSearchInput');
    const summaryRoot = document.getElementById('adminSubscriptionUserSummary');
    const tableRoot = document.getElementById('adminSubscriptionUserTable');
    const message = document.getElementById('adminSubscriptionUserMessage');
    if (!summaryRoot || !tableRoot || !message) return null;

    async function fetchUsers() {
        const params = new URLSearchParams({ q: searchInput?.value || '' });
        message.textContent = '正在刷新用户额度...';
        try {
            const data = await requestJson(`/api/admin/subscription-users?${params.toString()}`);
            summaryRoot.innerHTML = renderAdminSubscriptionUserSummary(data.summary || {});
            tableRoot.innerHTML = renderAdminSubscriptionUsers(data.items || []);
            message.textContent = `共 ${(data.items || []).length} 个账号。`;
        } catch (error) {
            message.textContent = error.message;
        }
    }

    searchInput?.addEventListener('input', fetchUsers);
    fetchUsers();
    return fetchUsers;
}

function initAdminUsdChargesPage() {
    const tableRoot = document.getElementById('adminUsdChargeTable');
    const message = document.getElementById('adminUsdChargeMessage');
    if (!tableRoot || !message) return null;

    async function fetchCharges() {
        message.textContent = '正在刷新消耗日志...';
        try {
            const data = await requestJson('/api/admin/usd-charges');
            tableRoot.innerHTML = renderAdminUsdCharges(data.charges || []);
            message.textContent = `共 ${(data.charges || []).length} 条。`;
        } catch (error) {
            message.textContent = error.message;
        }
    }

    fetchCharges();
    return fetchCharges;
}

function initAdminTopupPage(options = {}) {
    const statusFilter = document.getElementById('adminTopupStatusFilter');
    const tableRoot = document.getElementById('adminTopupTable');
    const message = document.getElementById('adminTopupMessage');
    if (!statusFilter || !tableRoot || !message) return null;

    async function fetchTopups() {
        message.textContent = '正在刷新...';
        try {
            const data = await requestJson(`/api/admin/topups?status=${encodeURIComponent(statusFilter.value)}`);
            tableRoot.innerHTML = renderAdminTopups(data.topups || []);
            message.textContent = `共 ${(data.topups || []).length} 条。`;
        } catch (error) {
            message.textContent = error.message;
        }
    }

    tableRoot.addEventListener('click', async (event) => {
        const approveButton = event.target.closest('[data-approve-topup]');
        const rejectButton = event.target.closest('[data-reject-topup]');
        if (!approveButton && !rejectButton) return;
        const row = event.target.closest('[data-topup-id]');
        const id = row?.getAttribute('data-topup-id');
        if (!id) return;
        const adminNote = row.querySelector('[data-admin-note]')?.value || '';
        const confirmedAmount = row.querySelector('[data-confirmed-amount]')?.value || '';
        message.textContent = approveButton ? '正在确认入账...' : '正在拒绝申请...';
        try {
            if (approveButton) {
                await requestJson(`/api/admin/topups/${encodeURIComponent(id)}/approve`, {
                    method: 'POST',
                    body: JSON.stringify({ confirmedAmount, adminNote })
                });
            } else {
                await requestJson(`/api/admin/topups/${encodeURIComponent(id)}/reject`, {
                    method: 'POST',
                    body: JSON.stringify({ adminNote })
                });
            }
            await fetchTopups();
            await options.onBalanceChanged?.();
        } catch (error) {
            message.textContent = error.message;
        }
    });

    statusFilter.addEventListener('change', fetchTopups);
    fetchTopups();
    return fetchTopups;
}

function initAdminInvitePage() {
    const createForm = document.getElementById('adminInviteCreateForm');
    const inviteCount = document.getElementById('adminInviteCount');
    const createMessage = document.getElementById('adminInviteCreateMessage');
    const createResult = document.getElementById('adminInviteCreateResult');
    const importForm = document.getElementById('adminApiKeyImportForm');
    const apiKeysText = document.getElementById('adminApiKeysText');
    const importMessage = document.getElementById('adminApiKeyImportMessage');
    const summaryRoot = document.getElementById('adminInviteConsoleSummary');
    const inviteTable = document.getElementById('adminInviteTable');
    const apiKeyPoolTable = document.getElementById('adminApiKeyPoolTable');
    if (!summaryRoot || !inviteTable || !apiKeyPoolTable) return null;

    async function refreshInviteConsole() {
        summaryRoot.innerHTML = '<p class="text-sm text-text-muted dark:text-dark-text-muted">正在刷新兑换码状态...</p>';
        try {
            const data = await requestJson('/api/admin/invite-console');
            summaryRoot.innerHTML = renderInviteConsoleSummary(data.summary || {});
            inviteTable.innerHTML = renderAdminInviteTable(data.invites || []);
            apiKeyPoolTable.innerHTML = renderAdminApiKeyPoolTable(data.apiKeyPool || []);
        } catch (error) {
            summaryRoot.innerHTML = '';
            inviteTable.innerHTML = `<div class="p-5 text-sm text-text-muted dark:text-dark-text-muted">${escapeHtml(error.message)}</div>`;
            apiKeyPoolTable.innerHTML = '';
        }
    }

    if (createForm && inviteCount && createMessage && createResult) {
        createForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            createMessage.textContent = '正在生成...';
            createResult.innerHTML = '';
            try {
                const data = await requestJson('/api/admin/session-invites', {
                    method: 'POST',
                    body: JSON.stringify({ count: inviteCount.value })
                });
                createMessage.textContent = `已生成 ${(data.invites || []).length} 个邀请码。`;
                createResult.innerHTML = (data.invites || []).map((invite) => `
                    <code class="block break-all rounded-md border border-border-subtle dark:border-dark-border bg-background-soft dark:bg-dark-surface px-3 py-2 text-sm text-primary dark:text-dark-text">${escapeHtml(invite.code)}</code>
                `).join('');
                await refreshInviteConsole();
            } catch (error) {
                createMessage.textContent = error.message;
            }
        });
    }

    if (importForm && apiKeysText && importMessage) {
        importForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const text = apiKeysText.value.trim();
            if (!text) {
                importMessage.textContent = '请输入 API key。';
                apiKeysText.focus();
                return;
            }
            importMessage.textContent = '正在导入...';
            try {
                const data = await requestJson('/api/admin/session-api-keys', {
                    method: 'POST',
                    body: JSON.stringify({ apiKeysText: text })
                });
                apiKeysText.value = '';
                importMessage.textContent = `已导入 ${(data.apiKeys || []).length} 个 API key。`;
                await refreshInviteConsole();
            } catch (error) {
                importMessage.textContent = error.message;
            }
        });
    }

    refreshInviteConsole();
    return refreshInviteConsole;
}

function initAdminPage() {
    initCollapsibleSections(document);

    const refreshAdminInvites = initAdminInvitePage();
    initAdminUsagePage();
    initAdminPasswordResetPage();
    const refreshSubscriptionUsers = initAdminSubscriptionUsersPage();
    const refreshUsdCharges = initAdminUsdChargesPage();
    const refreshSubscriptionOrders = initAdminSubscriptionOrdersPage({
        onChanged: async () => {
            await Promise.all([
                refreshSubscriptionUsers?.(),
                refreshUsdCharges?.()
            ].filter(Boolean));
        }
    });
    const refreshRefundRequests = initAdminRefundRequestsPage({
        onChanged: async () => {
            await Promise.all([
                refreshSubscriptionUsers?.(),
                refreshUsdCharges?.()
            ].filter(Boolean));
        }
    });
    const refreshAdminBalances = initAdminAccountBalancesPage();
    const refreshAdminTopups = initAdminTopupPage({ onBalanceChanged: refreshAdminBalances });
    const businessRefreshButton = document.getElementById('adminBusinessRefreshButton');
    const refreshAdminBusiness = async () => {
        businessRefreshButton?.setAttribute('aria-busy', 'true');
        try {
            await Promise.all([
                refreshAdminInvites?.(),
                refreshSubscriptionOrders?.(),
                refreshRefundRequests?.(),
                refreshSubscriptionUsers?.(),
                refreshUsdCharges?.(),
                refreshAdminTopups?.(),
                refreshAdminBalances?.()
            ].filter(Boolean));
        } finally {
            businessRefreshButton?.removeAttribute('aria-busy');
        }
    };
    if (businessRefreshButton) {
        businessRefreshButton.addEventListener('click', refreshAdminBusiness);
    }
    const refreshButton = document.getElementById('usageRefreshButton');
    if (refreshButton) {
        refreshButton.click();
    }
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                await requestJson('/api/auth/logout', { method: 'POST' });
            } finally {
                window.location.href = '/shop/login/';
            }
        });
    }
}

    window.YuiShopAdmin = {
        renderAdminBalanceSummary,
        renderAdminTopups,
        renderAdminBalanceTable,
        renderAdminSubscriptionOrders,
        renderAdminRefundRequests,
        renderAdminSubscriptionUserSummary,
        renderAdminSubscriptionUsers,
        renderAdminUsdCharges,
        renderInviteConsoleSummary,
        renderAdminInviteTable,
        renderAdminApiKeyPoolTable,
        renderAdminRecentCharges,
        usageStatusText,
        usageGroupText,
        renderUsageSummary,
        renderUsageItems,
        initAdminUsagePage,
        initCollapsibleSections,
        initAdminPasswordResetPage,
        initAdminAccountBalancesPage,
        initAdminSubscriptionOrdersPage,
        initAdminRefundRequestsPage,
        initAdminSubscriptionUsersPage,
        initAdminUsdChargesPage,
        initAdminTopupPage,
        initAdminInvitePage,
        initAdminPage
    };
})();
