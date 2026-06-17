// Shop 前端入口，只负责加载页面模块、按路径初始化，并保留旧的 window.YuiShop API。
(function() {
    const moduleSources = [
        '/shop/js/core.js',
        '/shop/js/charts.js',
        '/shop/js/auth.js',
        '/shop/js/account.js?v=20260617-subscription-rollout',
        '/shop/js/admin.js',
        '/shop/js/legacy-redirects.js'
    ];

    function modulesReady() {
        return Boolean(
            window.YuiShopCore &&
            window.YuiShopCharts &&
            window.YuiShopAuth &&
            window.YuiShopAccount &&
            window.YuiShopAdmin &&
            window.YuiShopLegacyRedirects
        );
    }

    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.defer = true;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`加载 Shop 模块失败：${src}`));
            document.head.appendChild(script);
        });
    }

    async function ensureModules() {
        if (modulesReady()) return;
        for (const src of moduleSources) {
            await loadScript(src);
        }
    }

    function normalizeShopPath(pathname) {
        const value = String(pathname || '').trim();
        if (!value) return '';
        const path = value.startsWith('/') ? value : `/${value}`;
        return path.endsWith('/') ? path : `${path}/`;
    }

    function buildShopApi() {
        const auth = window.YuiShopAuth;
        const account = window.YuiShopAccount;
        const admin = window.YuiShopAdmin;
        const legacy = window.YuiShopLegacyRedirects;
        const pageInitializers = {
            '/shop/redeem/': account.initRedeemPage,
            '/shop/key/': account.initKeyPage,
            '/shop/query/': account.initQueryPage,
            '/shop/admin/': admin.initAdminPage,
            '/shop/login/': auth.initLoginPage,
            '/shop/register/': auth.initRegisterPage,
            '/shop/reset-password/': auth.initResetPasswordPage,
            '/shop/account/': account.initAccountPage,
            '/shop/order/': legacy.initOrderPage,
            '/shop/pay/': legacy.initPayPage,
            '/shop/result/': legacy.initResultPage,
            '/shop/content/': legacy.initContentPage
        };

        function initCurrentShopPage() {
            const initializer = pageInitializers[normalizeShopPath(window.location?.pathname)];
            if (initializer) initializer();
        }

        window.YuiShop = {
            initRedeemPage: account.initRedeemPage,
            initKeyPage: account.initKeyPage,
            initQueryPage: account.initQueryPage,
            initAdminPage: admin.initAdminPage,
            initAdminInvitePage: admin.initAdminInvitePage,
            initLoginPage: auth.initLoginPage,
            initRegisterPage: auth.initRegisterPage,
            initResetPasswordPage: auth.initResetPasswordPage,
            initAccountPage: account.initAccountPage,
            initAccountLinks: account.initAccountLinks,
            initOrderPage: pageInitializers['/shop/order/'],
            initPayPage: pageInitializers['/shop/pay/'],
            initResultPage: pageInitializers['/shop/result/'],
            initContentPage: pageInitializers['/shop/content/']
        };

        window.YuiShopCore.runWhenDomReady(initCurrentShopPage);
        return window.YuiShop;
    }

    window.YuiShopReady = ensureModules().then(buildShopApi).catch((error) => {
        if (window.console && typeof window.console.error === 'function') {
            window.console.error(error);
        }
        throw error;
    });
})();
