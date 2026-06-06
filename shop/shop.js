// 用户通过私下付款获得邀请码，网站只负责兑换和查询 Codex 月额度。
(function() {
    function isPhone(value) {
        return /^1[3-9]\d{9}$/.test(String(value || '').trim());
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

    function statusText(status) {
        return status === 'active' ? '使用中' : '已失效';
    }

    function statusClass(status) {
        return status === 'active'
            ? 'bg-background-soft dark:bg-dark-surface text-primary dark:text-dark-text'
            : 'bg-gray-100 dark:bg-dark-surface text-text-muted dark:text-dark-text-muted';
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async function requestJson(url, options = {}) {
        const response = await fetch(url, {
            headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
            credentials: 'same-origin',
            ...options
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
            : '';

        return `
            <article class="border border-border-subtle dark:border-dark-border rounded-lg bg-white dark:bg-dark-card p-5 md:p-6">
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
        const key = root.querySelector('[data-api-key]')?.textContent || '';
        if (!button || !key) return;

        button.addEventListener('click', async () => {
            await navigator.clipboard.writeText(key);
            button.textContent = '已复制';
            setTimeout(() => {
                button.textContent = '复制 API key';
            }, 1400);
        });
    }

    function initRedeemPage() {
        const form = document.getElementById('redeemForm');
        const phoneInput = document.getElementById('phoneInput');
        const codeInput = document.getElementById('inviteCodeInput');
        const message = document.getElementById('redeemMessage');
        if (!form || !phoneInput || !codeInput || !message) return;

        phoneInput.addEventListener('input', () => {
            phoneInput.value = phoneInput.value.replace(/\D/g, '').slice(0, 11);
        });

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
        const form = document.getElementById('queryForm');
        const input = document.getElementById('queryPhone');
        const result = document.getElementById('queryResult');
        if (!form || !input || !result) return;

        input.addEventListener('input', () => {
            input.value = input.value.replace(/\D/g, '').slice(0, 11);
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const phone = input.value.trim();
            if (!isPhone(phone)) {
                result.innerHTML = '<p class="text-sm text-red-600">请输入有效的中国大陆手机号。</p>';
                return;
            }

            result.innerHTML = '<p class="text-sm text-text-muted dark:text-dark-text-muted">正在查询...</p>';
            try {
                const data = await requestJson(`/api/orders?phone=${encodeURIComponent(phone)}`);
                if (!data.orders.length) {
                    result.innerHTML = '<p class="text-sm text-text-muted dark:text-dark-text-muted">没有找到该手机号对应的订单。</p>';
                    return;
                }
                result.innerHTML = `
                    <div class="mb-5 flex items-end justify-between gap-4">
                        <div>
                            <p class="text-xs uppercase tracking-[0.2em] text-text-muted dark:text-dark-text-muted">Orders</p>
                            <h2 class="mt-2 text-2xl font-display text-primary dark:text-dark-text">共 ${data.orders.length} 个订单</h2>
                        </div>
                    </div>
                    <div class="grid gap-5">
                        ${data.orders.map((order) => renderOrderCard(order, { showFullKey: true })).join('')}
                    </div>
                `;
                result.querySelectorAll('article').forEach(bindCopy);
            } catch (error) {
                result.innerHTML = `<p class="text-sm text-red-600">${error.message}</p>`;
            }
        });
    }

    function initAdminPage() {
        const form = document.getElementById('adminInviteForm');
        const tokenInput = document.getElementById('adminTokenInput');
        const countInput = document.getElementById('inviteCountInput');
        const result = document.getElementById('adminResult');
        if (!form || !tokenInput || !countInput || !result) return;

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const token = tokenInput.value.trim();
            const count = Number(countInput.value || 1);
            if (!token) {
                result.innerHTML = '<p class="text-sm text-red-600">请输入管理员 token。</p>';
                return;
            }

            result.innerHTML = '<p class="text-sm text-text-muted dark:text-dark-text-muted">正在生成...</p>';
            try {
                const data = await requestJson('/api/admin/invites', {
                    method: 'POST',
                    headers: { 'x-admin-token': token },
                    body: JSON.stringify({ count })
                });
                result.innerHTML = `
                    <div class="grid gap-4">
                        ${data.invites.map((invite) => `
                            <article class="border border-border-subtle dark:border-dark-border rounded-lg bg-white dark:bg-dark-card p-5">
                                <p class="text-xs uppercase tracking-[0.2em] text-text-muted dark:text-dark-text-muted">Invite code</p>
                                <code class="mt-2 block break-all text-sm text-primary dark:text-dark-text">${invite.code}</code>
                            </article>
                        `).join('')}
                    </div>
                `;
            } catch (error) {
                result.innerHTML = `<p class="text-sm text-red-600">${error.message}</p>`;
            }
        });
    }

    window.YuiShop = {
        initRedeemPage,
        initKeyPage,
        initQueryPage,
        initAdminPage,
        initOrderPage: () => { window.location.replace('/shop/redeem/'); },
        initPayPage: () => { window.location.replace('/shop/redeem/'); },
        initResultPage: () => { window.location.replace('/shop/key/'); },
        initContentPage: () => { window.location.replace('/shop/key/'); }
    };
})();
