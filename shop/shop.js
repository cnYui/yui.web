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

    function formatNumber(value) {
        return Number(value || 0).toLocaleString('zh-CN');
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

    function usageStatusText(status) {
        const map = {
            active: '使用中',
            expired: '已过期',
            unused: '未使用',
            disabled: '已禁用',
            unmanaged: '未托管',
            used: '已使用'
        };
        return map[status] || status || '-';
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
                            <td class="px-4 py-3">${escapeHtml(item.group === 'shop' ? 'Shop' : '未托管')}</td>
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

    function initAdminUsagePage(tokenInput) {
        const refreshButton = document.getElementById('usageRefreshButton');
        const searchInput = document.getElementById('usageSearchInput');
        const groupFilter = document.getElementById('usageGroupFilter');
        const statusFilter = document.getElementById('usageStatusFilter');
        const summaryRoot = document.getElementById('usageSummaryCards');
        const tableRoot = document.getElementById('usageTable');
        const message = document.getElementById('usageMessage');
        const importForm = document.getElementById('usageImportForm');
        const importMonth = document.getElementById('usageImportMonth');
        const importMessage = document.getElementById('usageImportMessage');
        if (!refreshButton || !summaryRoot || !tableRoot || !message || !tokenInput) return;

        async function fetchUsage() {
            const token = tokenInput.value.trim();
            if (!token) {
                message.textContent = '请输入管理员 token。';
                return;
            }
            const params = new URLSearchParams({
                q: searchInput?.value || '',
                group: groupFilter?.value || 'all',
                status: statusFilter?.value || 'all'
            });
            message.textContent = '正在刷新...';
            try {
                const data = await requestJson(`/api/admin/usage-summary?${params.toString()}`, {
                    headers: { 'x-admin-token': token }
                });
                summaryRoot.innerHTML = renderUsageSummary(data.summary || {});
                tableRoot.innerHTML = renderUsageItems(data.items || []);
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
                const token = tokenInput.value.trim();
                if (!token) {
                    importMessage.textContent = '请输入管理员 token。';
                    return;
                }
                const month = importMonth.value;
                importMessage.textContent = '正在导入...';
                try {
                    const result = await requestJson('/api/admin/usage-imports', {
                        method: 'POST',
                        headers: { 'x-admin-token': token },
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
        const form = document.getElementById('queryForm');
        const input = document.getElementById('queryPhone');
        const result = document.getElementById('queryResult');
        if (!form || !input || !result) return;

        bindPhoneInput(input);

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

    function initLoginPage() {
        const form = document.getElementById('loginForm');
        const phoneInput = document.getElementById('loginPhone');
        const passwordInput = document.getElementById('loginPassword');
        const message = document.getElementById('loginMessage');
        if (!form || !phoneInput || !passwordInput || !message) return;

        bindPhoneInput(phoneInput);

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
                await requestJson('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify({ phone, password })
                });
                window.location.href = '/shop/account/';
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
                await requestJson('/api/auth/register', {
                    method: 'POST',
                    body: JSON.stringify({ phone, password, confirmPassword })
                });
                window.location.href = '/shop/account/';
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
                ordersRoot.innerHTML = `<div class="grid gap-5">${orders.map((order) => renderOrderCard(order, { showFullKey: false })).join('')}</div>`;
            }
            message.textContent = '';
        } catch (error) {
            window.location.replace('/shop/login/');
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
        try {
            await requestJson('/api/account/me');
            for (const link of links) {
                link.href = '/shop/account/';
                link.textContent = '我的账户';
            }
        } catch (error) {
            for (const link of links) {
                link.href = '/shop/login/';
                link.textContent = '登录';
            }
        }
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
        initAdminUsagePage(tokenInput);
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
