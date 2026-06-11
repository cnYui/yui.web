// 用户通过私下付款获得邀请码，网站只负责兑换和查询 Codex 月额度。
(function() {
    function isPhone(value) {
        return /^1[3-9]\d{9}$/.test(String(value || '').trim());
    }

    function bindPhoneInput(input) {
        if (!input) return;
        input.addEventListener('input', () => {
            input.value = input.value.replace(/\D/g, '').slice(0, 11);
        });
    }

    function isStrongPassword(value) {
        const password = String(value || '');
        return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
    }

    function formatDate(value) {
        if (!value) return '-';
        return new Intl.DateTimeFormat('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(value));
    }

    function formatPrice(amount) {
        return `¥${Number(amount).toFixed(2)}`;
    }

    function formatCents(cents) {
        return `¥${(Number(cents || 0) / 100).toFixed(2)}`;
    }

    function formatNanos(nanos) {
        const amount = Number(nanos || 0) / 1000000000;
        if (amount === 0) return '¥0.00';
        return `¥${Math.abs(amount) >= 1 ? amount.toFixed(2) : amount.toFixed(6)}`;
    }

    function formatNumber(value) {
        return Number(value || 0).toLocaleString('zh-CN');
    }

    function formatCompactNumber(value) {
        const number = Number(value || 0);
        if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`;
        if (number >= 1000) return `${(number / 1000).toFixed(1)}K`;
        return number.toLocaleString('zh-CN');
    }

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

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function readCookie(name) {
        return document.cookie
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith(`${name}=`))
            ?.slice(name.length + 1) || '';
    }

    async function requestJson(url, options = {}) {
        const { headers: optionHeaders, ...fetchOptions } = options;
        const method = String(fetchOptions.method || 'GET').toUpperCase();
        const headers = { 'Content-Type': 'application/json', ...(optionHeaders || {}) };
        if (method !== 'GET' && !headers['x-csrf-token']) {
            const csrfToken = readCookie('yui_shop_csrf');
            if (csrfToken) {
                headers['x-csrf-token'] = decodeURIComponent(csrfToken);
            }
        }
        const response = await fetch(url, {
            ...fetchOptions,
            headers,
            credentials: 'same-origin'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            const error = new Error(data.message || '请求失败');
            error.code = data.code || 'REQUEST_FAILED';
            error.status = response.status;
            throw error;
        }
        return data;
    }

    function renderOrderCard(order, options = {}) {
        const key = options.showFullKey ? order.apiKey : order.apiKeyPreview;
        const copyButton = options.showFullKey
            ? '<button class="btn-secondary dark:bg-dark-card dark:border-dark-border dark:text-dark-text" type="button" data-copy-key>复制 API key</button>'
            : options.revealKey
                ? '<button class="btn-secondary dark:bg-dark-card dark:border-dark-border dark:text-dark-text" type="button" data-reveal-api-key>复制完整 API key</button>'
            : '';

        return `
            <article class="border border-border-subtle dark:border-dark-border rounded-lg bg-white dark:bg-dark-card p-5 md:p-6" data-order-id="${escapeHtml(order.id)}">
                <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-5">
                    <div>
                        <p class="text-xs uppercase tracking-[0.2em] text-text-muted dark:text-dark-text-muted">${escapeHtml(order.id)}</p>
                        <h2 class="mt-2 text-2xl font-display text-primary dark:text-dark-text">${escapeHtml(order.productName)}</h2>
                        <p class="mt-2 text-sm text-text-muted dark:text-dark-text-muted">一个 API key 对应一个订单，有效期 31 天。</p>
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

    function renderAccountUsageCards(summary) {
        const month = summary.month || {};
        const week = summary.week || {};
        const today = summary.today || {};
        const cards = [
            ['今日 token', today.totalTokens],
            ['本周 token', week.totalTokens],
            ['本月 token', month.totalTokens],
            ['失败请求', month.failedRequests]
        ];
        return cards.map(([label, value]) => `
            <article class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-4">
                <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">${escapeHtml(label)}</p>
                <p class="mt-2 text-2xl font-display text-primary dark:text-dark-text">${escapeHtml(formatNumber(value))}</p>
            </article>
        `).join('');
    }

    function renderTokenBreakdown(month = {}) {
        const items = [
            ['Input', month.inputTokens],
            ['Output', month.outputTokens],
            ['Reasoning', month.reasoningTokens],
            ['Cached', month.cachedTokens]
        ];
        return items.map(([label, value]) => `
            <article class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-4">
                <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">${escapeHtml(label)}</p>
                <p class="mt-2 text-xl font-display text-primary dark:text-dark-text">${escapeHtml(formatNumber(value))}</p>
            </article>
        `).join('');
    }

    function renderBillingUsageCards(billing = {}) {
        const cards = [
            ['今日消费', formatNanos(billing.todayChargeNanos), '今日已扣费'],
            ['本月消费', formatNanos(billing.monthChargeNanos), billing.priceVersion || 'DeepSeek Pro RMB'],
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

    function renderBalanceCards(balance = {}) {
        const cards = [
            ['当前余额', balance.balanceNanos === undefined ? formatCents(balance.balanceCents) : formatNanos(balance.balanceNanos), billingStatusText(balance.status)],
            ['欠费金额', balance.debtNanos === undefined ? formatCents(balance.debtCents) : formatNanos(balance.debtNanos), balance.debtCents > 0 ? '需补缴' : '无欠费'],
            ['待确认充值', balance.pendingTopupNanos === undefined ? formatCents(balance.pendingTopupCents) : formatNanos(balance.pendingTopupNanos), '确认后入账'],
            ['欠费上限', balance.creditLimitNanos === undefined ? formatCents(balance.creditLimitCents) : formatNanos(balance.creditLimitNanos), balance.creditExceeded ? '已超过' : '默认上限']
        ];
        return cards.map(([label, value, hint]) => `
            <article class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-4">
                <p class="text-xs uppercase tracking-[0.18em] text-text-muted dark:text-dark-text-muted">${escapeHtml(label)}</p>
                <p class="mt-2 text-2xl font-display text-primary dark:text-dark-text">${escapeHtml(value)}</p>
                <p class="mt-1 text-xs text-text-muted dark:text-dark-text-muted">${escapeHtml(hint)}</p>
            </article>
        `).join('');
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

    function renderAdminRecentCharges(charges = []) {
        if (!charges.length) {
            return '<div class="p-5 text-sm text-text-muted dark:text-dark-text-muted">暂无最近扣费记录。</div>';
        }
        return renderCharges(charges, { showPhone: true });
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
        const tableRoot = document.getElementById('usageTable');
        const recentChargesRoot = document.getElementById('adminRecentCharges');
        const message = document.getElementById('usageMessage');
        const importForm = document.getElementById('usageImportForm');
        const importMonth = document.getElementById('usageImportMonth');
        const importMessage = document.getElementById('usageImportMessage');
        if (!refreshButton || !summaryRoot || !tableRoot || !message) return;

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
                if (billingRoot) billingRoot.innerHTML = renderBillingUsageCards(data.billing || {});
                tableRoot.innerHTML = renderUsageItems(data.items || []);
                if (recentChargesRoot) recentChargesRoot.innerHTML = renderAdminRecentCharges(data.billing?.recentCharges || []);
                message.textContent = `共 ${(data.items || []).length} 条。`;
            } catch (error) {
                message.textContent = error.message;
            }
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

    function initRedeemPage() {
        const form = document.getElementById('redeemForm');
        const phoneInput = document.getElementById('phoneInput');
        const codeInput = document.getElementById('inviteCodeInput');
        const message = document.getElementById('redeemMessage');
        if (!form || !phoneInput || !codeInput || !message) return;

        bindPhoneInput(phoneInput);

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const phone = phoneInput.value.trim();
            const code = codeInput.value.trim();
            if (!isPhone(phone)) {
                message.textContent = '请输入有效的中国大陆手机号。';
                phoneInput.focus();
                return;
            }
            if (!code) {
                message.textContent = '请输入邀请码。';
                codeInput.focus();
                return;
            }

            message.textContent = '正在兑换...';
            try {
                const data = await requestJson('/api/invites/redeem', {
                    method: 'POST',
                    body: JSON.stringify({ phone, code })
                });
                window.location.href = '/shop/key/';
            } catch (error) {
                message.textContent = error.message;
            }
        });
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

    function normalizeResetCodeInput(input) {
        if (!input) return;
        input.addEventListener('input', () => {
            input.value = input.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 18);
        });
    }

    function initPasswordResetForm() {
        const loginForm = document.getElementById('loginForm');
        const resetForm = document.getElementById('passwordResetForm');
        const showResetButton = document.getElementById('showPasswordResetButton');
        const showLoginButton = document.getElementById('showLoginFormButton');
        const phoneInput = document.getElementById('resetPhone');
        const codeInput = document.getElementById('resetPasswordCode');
        const passwordInput = document.getElementById('resetNewPassword');
        const confirmInput = document.getElementById('resetConfirmPassword');
        const message = document.getElementById('passwordResetMessage');
        if (!loginForm || !resetForm || !showResetButton || !showLoginButton || !phoneInput || !codeInput || !passwordInput || !confirmInput || !message) return;

        bindPhoneInput(phoneInput);
        normalizeResetCodeInput(codeInput);

        showResetButton.addEventListener('click', () => {
            loginForm.classList.add('hidden');
            resetForm.classList.remove('hidden');
            message.textContent = '';
            phoneInput.focus();
        });

        showLoginButton.addEventListener('click', () => {
            resetForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        });

        resetForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const phone = phoneInput.value.trim();
            const code = codeInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmInput.value;
            if (!isPhone(phone)) {
                message.textContent = '请输入有效的中国大陆手机号。';
                phoneInput.focus();
                return;
            }
            if (!code) {
                message.textContent = '请输入重置码。';
                codeInput.focus();
                return;
            }
            if (!isStrongPassword(password)) {
                message.textContent = '密码至少 8 位，并包含英文大写字母、小写字母和数字。';
                passwordInput.focus();
                return;
            }
            if (password !== confirmPassword) {
                message.textContent = '两次输入的密码不一致。';
                confirmInput.focus();
                return;
            }

            message.textContent = '正在重置密码...';
            try {
                const data = await requestJson('/api/auth/password-reset', {
                    method: 'POST',
                    body: JSON.stringify({ phone, code, password, confirmPassword })
                });
                window.location.href = data.user?.isAdmin ? '/shop/admin/' : '/shop/account/';
            } catch (error) {
                message.textContent = error.message;
            }
        });
    }

    function initLoginPage() {
        const form = document.getElementById('loginForm');
        const phoneInput = document.getElementById('loginPhone');
        const passwordInput = document.getElementById('loginPassword');
        const message = document.getElementById('loginMessage');
        if (!form || !phoneInput || !passwordInput || !message) return;

        bindPhoneInput(phoneInput);
        initPasswordResetForm();

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const phone = phoneInput.value.trim();
            const password = passwordInput.value;
            if (!isPhone(phone)) {
                message.textContent = '请输入有效的中国大陆手机号。';
                phoneInput.focus();
                return;
            }
            if (!password) {
                message.textContent = '请输入密码。';
                passwordInput.focus();
                return;
            }

            message.textContent = '正在登录...';
            try {
                const data = await requestJson('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ phone, password })
                });
                window.location.href = data.user?.isAdmin ? '/shop/admin/' : '/shop/account/';
            } catch (error) {
                message.textContent = error.message;
            }
        });
    }

    function initRegisterPage() {
        const form = document.getElementById('registerForm');
        const phoneInput = document.getElementById('registerPhone');
        const passwordInput = document.getElementById('registerPassword');
        const confirmInput = document.getElementById('registerConfirmPassword');
        const message = document.getElementById('registerMessage');
        if (!form || !phoneInput || !passwordInput || !confirmInput || !message) return;

        bindPhoneInput(phoneInput);

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const phone = phoneInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmInput.value;
            if (!isPhone(phone)) {
                message.textContent = '请输入有效的中国大陆手机号。';
                phoneInput.focus();
                return;
            }
            if (!isStrongPassword(password)) {
                message.textContent = '密码至少 8 位，并包含英文大写字母、小写字母和数字。';
                passwordInput.focus();
                return;
            }
            if (password !== confirmPassword) {
                message.textContent = '两次输入的密码不一致。';
                confirmInput.focus();
                return;
            }

            message.textContent = '正在注册...';
            try {
                const data = await requestJson('/api/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({ phone, password, confirmPassword })
                });
                window.location.href = data.user?.isAdmin ? '/shop/admin/' : '/shop/account/';
            } catch (error) {
                message.textContent = error.message;
            }
        });
    }

    async function initAccountPage() {
        const phoneRoot = document.getElementById('accountPhone');
        const ordersRoot = document.getElementById('accountOrders');
        const message = document.getElementById('accountMessage');
        const logoutButton = document.getElementById('logoutButton');
        const usageCards = document.getElementById('accountUsageCards');
        const billingUsageCards = document.getElementById('accountBillingUsageCards');
        const tokenBreakdown = document.getElementById('accountTokenBreakdown');
        const hourlyChart = document.getElementById('accountHourlyChart');
        const dailyChart = document.getElementById('accountDailyChart');
        const usageFreshness = document.getElementById('usageFreshness');
        const usageMessage = document.getElementById('accountUsageMessage');
        const balanceCards = document.getElementById('accountBalanceCards');
        const billingMessage = document.getElementById('accountBillingMessage');
        const topupForm = document.getElementById('topupForm');
        const topupAmount = document.getElementById('topupAmount');
        const topupPaymentMethod = document.getElementById('topupPaymentMethod');
        const topupPaymentTime = document.getElementById('topupPaymentTime');
        const topupPaymentNote = document.getElementById('topupPaymentNote');
        const topupMessage = document.getElementById('topupMessage');
        const accountTopups = document.getElementById('accountTopups');
        const accountCharges = document.getElementById('accountCharges');
        const accountLedger = document.getElementById('accountLedger');
        const alipayQrImage = document.getElementById('alipayQrImage');
        const wechatQrImage = document.getElementById('wechatQrImage');
        const paymentReference = document.getElementById('paymentReference');
        if (!phoneRoot || !ordersRoot || !message || !logoutButton) return;

        ordersRoot.innerHTML = '<p class="text-sm text-text-muted dark:text-dark-text-muted">正在读取账户信息...</p>';
        try {
            const data = await requestJson('/api/account/me');
            phoneRoot.textContent = data.user.phone;
            const orders = data.orders || [];
            if (!orders.length) {
                ordersRoot.innerHTML = `
                    <section class="rounded-lg border border-border-subtle dark:border-dark-border bg-white dark:bg-dark-card p-8 text-center">
                        <h2 class="font-display text-3xl text-primary dark:text-dark-text">暂无订单</h2>
                        <p class="mt-3 text-text-muted dark:text-dark-text-muted">使用邀请码兑换后，订单会显示在这里。</p>
                        <a class="btn-primary mt-6 inline-flex" href="/shop/redeem/">去兑换</a>
                    </section>
                `;
            } else {
                ordersRoot.innerHTML = `<div class="grid gap-5">${orders.map((order) => renderOrderCard(order, { revealKey: true })).join('')}</div>`;
                ordersRoot.querySelectorAll('article').forEach(bindCopy);
            }
            message.textContent = '';
        } catch (error) {
            window.location.replace('/shop/login/');
        }

        async function refreshBilling() {
            if (billingMessage) billingMessage.textContent = '正在读取账务信息...';
            const [balanceData, topupData, chargeData, ledgerData] = await Promise.all([
                requestJson('/api/account/balance'),
                requestJson('/api/account/topups'),
                requestJson('/api/account/api-charges'),
                requestJson('/api/account/ledger')
            ]);
            if (balanceCards) balanceCards.innerHTML = renderBalanceCards(balanceData.balance || {});
            if (accountTopups) accountTopups.innerHTML = renderTopups(topupData.topups || []);
            if (accountCharges) accountCharges.innerHTML = renderCharges(chargeData.charges || []);
            if (accountLedger) accountLedger.innerHTML = renderLedger(ledgerData.entries || []);
            if (alipayQrImage) alipayQrImage.src = balanceData.payment?.alipayQrUrl || '';
            if (wechatQrImage) wechatQrImage.src = balanceData.payment?.wechatQrUrl || '';
            if (paymentReference) paymentReference.textContent = balanceData.payment?.paymentReference || '-';
            if (billingMessage) billingMessage.textContent = '';
        }

        try {
            await refreshBilling();
        } catch (error) {
            if (billingMessage) billingMessage.textContent = error.message;
        }

        if (topupForm && topupAmount && topupPaymentMethod && topupMessage) {
            topupForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                topupMessage.textContent = '正在提交充值申请...';
                try {
                    await requestJson('/api/account/topups', {
                        method: 'POST',
                        body: JSON.stringify({
                            amount: topupAmount.value,
                            paymentMethod: topupPaymentMethod.value,
                            paymentTime: topupPaymentTime?.value || '',
                            paymentNote: topupPaymentNote?.value || ''
                        })
                    });
                    topupForm.reset();
                    topupMessage.textContent = '充值申请已提交，管理员确认后会入账。';
                    await refreshBilling();
                } catch (error) {
                    topupMessage.textContent = error.message;
                }
            });
        }

        try {
            const usage = await requestJson('/api/account/usage-summary');
            if (usageCards) usageCards.innerHTML = renderAccountUsageCards(usage.summary || {});
            if (billingUsageCards) billingUsageCards.innerHTML = renderBillingUsageCards(usage.billing || {});
            if (tokenBreakdown) tokenBreakdown.innerHTML = renderTokenBreakdown(usage.summary?.month || {});
            if (hourlyChart) hourlyChart.innerHTML = renderBars(usage.hourly || [], (item) => String(item.bucket || '').slice(11, 16));
            if (dailyChart) dailyChart.innerHTML = renderBars(usage.daily || [], (item) => String(item.bucket || '').slice(5));
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

    function initAdminTopupPage() {
        const refreshButton = document.getElementById('adminTopupRefreshButton');
        const statusFilter = document.getElementById('adminTopupStatusFilter');
        const tableRoot = document.getElementById('adminTopupTable');
        const message = document.getElementById('adminTopupMessage');
        if (!refreshButton || !statusFilter || !tableRoot || !message) return;

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
            } catch (error) {
                message.textContent = error.message;
            }
        });

        refreshButton.addEventListener('click', fetchTopups);
        statusFilter.addEventListener('change', fetchTopups);
        fetchTopups();
    }

    function initAdminPage() {
        initAdminUsagePage();
        initAdminPasswordResetPage();
        initAdminTopupPage();
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

    window.YuiShop = {
        initRedeemPage,
        initKeyPage,
        initQueryPage,
        initAdminPage,
        initLoginPage,
        initRegisterPage,
        initAccountPage,
        initAccountLinks,
        initOrderPage: () => { window.location.replace('/shop/redeem/'); },
        initPayPage: () => { window.location.replace('/shop/redeem/'); },
        initResultPage: () => { window.location.replace('/shop/key/'); },
        initContentPage: () => { window.location.replace('/shop/key/'); }
    };
})();
