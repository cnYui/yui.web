// Shop 前端基础工具，供 Auth、Account、Admin 与图表模块共享。
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

    function formatUsdMicros(usdMicros) {
        return `$${(Number(usdMicros || 0) / 1000000).toFixed(2)}`;
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

    function runWhenDomReady(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn, { once: true });
            return;
        }
        fn();
    }

    function initCollapsibleSections(root = document) {
        const sections = Array.from(root.querySelectorAll('[data-collapsible-section]'));
        sections.forEach((section) => {
            const toggle = section.querySelector('[data-collapsible-toggle]');
            const content = section.querySelector('[data-collapsible-content]');
            if (!toggle || !content) return;

            let open = section.dataset.collapsibleDefault !== 'closed';
            const render = () => {
                toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
                toggle.textContent = open ? '收起' : '展开';
                content.hidden = !open;
            };

            toggle.addEventListener('click', () => {
                open = !open;
                render();
            });
            render();
        });
    }

    window.YuiShopCore = {
        bindPhoneInput,
        escapeHtml,
        formatCents,
        formatCompactNumber,
        formatDate,
        formatNanos,
        formatNumber,
        formatPrice,
        formatUsdMicros,
        isPhone,
        isStrongPassword,
        initCollapsibleSections,
        readCookie,
        requestJson,
        runWhenDomReady
    };
})();
