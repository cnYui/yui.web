const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const shopModuleScripts = [
    '/shop/js/core.js',
    '/shop/js/charts.js',
    '/shop/js/auth.js',
    '/shop/js/account.js?v=20260614-account-price-display',
    '/shop/js/admin.js',
    '/shop/js/legacy-redirects.js'
];

function readScript(relativePath) {
    return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function readShopFrontendSource() {
    return [
        'shop/js/core.js',
        'shop/js/charts.js',
        'shop/js/auth.js',
        'shop/js/account.js',
        'shop/js/admin.js',
        'shop/js/legacy-redirects.js',
        'shop/shop.js'
    ].map(readScript).join('\n');
}

function loadShopScripts(sandbox) {
    for (const file of [
        'shop/js/core.js',
        'shop/js/charts.js',
        'shop/js/auth.js',
        'shop/js/account.js',
        'shop/js/admin.js',
        'shop/js/legacy-redirects.js',
        'shop/shop.js'
    ]) {
        vm.runInNewContext(readScript(file), sandbox, { filename: file });
    }
}

test('前端图表模块复用同一个堆叠柱渲染入口', () => {
    const sandbox = {
        window: {},
        document: {
            cookie: '',
            readyState: 'loading',
            addEventListener() {}
        },
        Intl,
        URL
    };
    sandbox.window.document = sandbox.document;

    vm.runInNewContext(readScript('shop/js/core.js'), sandbox, { filename: 'shop/js/core.js' });
    vm.runInNewContext(readScript('shop/js/charts.js'), sandbox, { filename: 'shop/js/charts.js' });

    assert.equal(typeof sandbox.window.YuiShopCharts.renderStackedChargeBars, 'function');
    const html = sandbox.window.YuiShopCharts.renderStackedChargeBars({
        items: [
            {
                label: '6/13',
                chargeNanos: 15000000000,
                parts: [
                    { key: 'output', label: '输出 token', chargeNanos: 15000000000 }
                ]
            }
        ],
        emptyText: '暂无记录'
    });
    assert.match(html, /admin-revenue-bar-stack/);
    assert.match(html, /输出 token/);
});

test('Admin 余额和充值表渲染复用账户状态文案函数', () => {
    const sandbox = {
        window: {},
        document: {
            cookie: '',
            readyState: 'loading',
            addEventListener() {}
        },
        Intl,
        URL
    };
    sandbox.window.document = sandbox.document;

    for (const file of [
        'shop/js/core.js',
        'shop/js/charts.js',
        'shop/js/account.js',
        'shop/js/admin.js'
    ]) {
        vm.runInNewContext(readScript(file), sandbox, { filename: file });
    }

    const balanceHtml = sandbox.window.YuiShopAdmin.renderAdminBalanceTable([
        {
            phone: '13800138000',
            status: 'debt',
            balanceNanos: -120000000,
            debtNanos: 120000000,
            pendingTopupNanos: 0,
            managedApiKeyCount: 1,
            usedApiKeyCount: 1,
            updatedAt: '2026-06-13T09:00:00.000Z'
        }
    ]);
    const topupHtml = sandbox.window.YuiShopAdmin.renderAdminTopups([
        {
            id: 'topup-test',
            phone: '13800138000',
            requestedAmountCents: 2000,
            requestedAmount: 20,
            paymentMethod: 'alipay',
            paymentNote: '',
            status: 'pending'
        }
    ]);

    assert.match(balanceHtml, /欠费/);
    assert.match(topupHtml, /待确认/);
});

test('Shop 入口加载页面模块后仍暴露兼容的 YuiShop 初始化函数', async () => {
    const elements = new Map();
    const sandbox = {
        window: {
            location: { pathname: '/shop/login/', replace() {} }
        },
        document: {
            cookie: '',
            readyState: 'complete',
            createElement: () => ({
                set src(value) { this._src = value; },
                get src() { return this._src; },
                onload: null,
                onerror: null
            }),
            head: {
                appendChild(node) {
                    node.onload?.();
                }
            },
            querySelectorAll: () => [],
            getElementById: (id) => elements.get(id) || null,
            addEventListener() {}
        },
        fetch: async () => ({ ok: true, json: async () => ({}) }),
        Intl,
        URL
    };
    sandbox.window.document = sandbox.document;

    loadShopScripts(sandbox);
    await sandbox.window.YuiShopReady;

    assert.equal(typeof sandbox.window.YuiShop.initLoginPage, 'function');
    assert.equal(typeof sandbox.window.YuiShop.initAccountPage, 'function');
    assert.equal(typeof sandbox.window.YuiShop.initAdminPage, 'function');
    assert.equal(typeof sandbox.window.YuiShop.initOrderPage, 'function');
});

test('Shop 入口脚本会自动加载前端模块', async () => {
    const loaded = [];
    const elements = new Map();
    const sandbox = {
        window: {
            location: { pathname: '/shop/login/', replace() {} }
        },
        document: {
            cookie: '',
            readyState: 'complete',
            createElement: () => ({
                set src(value) { this._src = value; },
                get src() { return this._src; },
                defer: false,
                onload: null,
                onerror: null
            }),
            head: {
                appendChild(node) {
                    const pathname = new URL(node.src, 'http://localhost').pathname.slice(1);
                    loaded.push(pathname);
                    vm.runInNewContext(readScript(pathname), sandbox, { filename: pathname });
                    node.onload?.();
                }
            },
            querySelectorAll: () => [],
            getElementById: (id) => elements.get(id) || null,
            addEventListener() {}
        },
        fetch: async () => ({ ok: true, json: async () => ({}) }),
        Intl,
        URL,
        console
    };
    sandbox.window.document = sandbox.document;

    vm.runInNewContext(readScript('shop/shop.js'), sandbox, { filename: 'shop/shop.js' });
    await sandbox.window.YuiShopReady;

    assert.deepEqual(loaded, [
        'shop/js/core.js',
        'shop/js/charts.js',
        'shop/js/auth.js',
        'shop/js/account.js',
        'shop/js/admin.js',
        'shop/js/legacy-redirects.js'
    ]);
    assert.equal(typeof sandbox.window.YuiShop.initLoginPage, 'function');
});

test('Shop HTML 只直接加载入口脚本，不重复硬编码前端模块', () => {
    const shopDir = path.join(__dirname, '..', 'shop');
    const htmlFiles = fs.readdirSync(shopDir, { recursive: true })
        .filter((file) => file.endsWith('.html'))
        .map((file) => path.join('shop', file));

    const pagesWithEntry = htmlFiles.filter((file) => readScript(file).includes('/shop/shop.js'));
    assert.ok(pagesWithEntry.length > 0);

    for (const file of pagesWithEntry) {
        const html = readScript(file);
        for (const moduleSrc of shopModuleScripts) {
            assert.equal(html.includes(moduleSrc), false, `${file} 不应直接加载 ${moduleSrc}`);
        }
    }
});

test('Account 页提供登录态邀请码兑换表单且不再引导到独立手机号兑换页', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/account/index.html'), 'utf8');

    assert.match(html, /id="accountRedeemForm"/);
    assert.match(html, /id="accountInviteCodeInput"/);
    assert.match(html, /id="accountRedeemMessage"/);
    assert.doesNotMatch(html, /href="\/shop\/redeem\/"/);
});

test('兑换页不再要求输入手机号，只绑定当前登录账号', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/redeem/index.html'), 'utf8');

    assert.doesNotMatch(html, /id="phoneInput"/);
    assert.match(html, /id="redeemAccountPhone"/);
    assert.match(html, /id="inviteCodeInput"/);
    assert.match(html, /会绑定到当前登录账号/);
});

test('兑换页展示按量计费 API key 文案并移除固定价格和手机号语义', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/redeem/index.html'), 'utf8');

    assert.match(html, /私下付款后，你会收到一个邀请码。输入邀请码后，系统会生成 API key。/);
    assert.match(html, /<h2 class="mt-2 text-2xl font-display">codex api key<\/h2>/);
    assert.doesNotMatch(html, /Codex 月额度/);
    assert.doesNotMatch(html, /Codex 每月额度/);
    assert.doesNotMatch(html, /31 天/);
    assert.doesNotMatch(html, /¥30\.00/);
});

test('兑换页前端调用登录态兑换接口', () => {
    const script = readShopFrontendSource();

    assert.match(script, /requestJson\('\/api\/account\/me'\)/);
    assert.match(script, /redeemAccountPhone/);
    assert.match(script, /api\/account\/invites\/redeem/);
    assert.doesNotMatch(script, /api\/invites\/redeem',\s*\{/);
});

test('商店首页提供使用方法入口，公开说明页只使用占位 API key', () => {
    const home = fs.readFileSync(path.join(__dirname, '..', 'shop/index.html'), 'utf8');
    const guide = fs.readFileSync(path.join(__dirname, '..', 'shop/guide/index.html'), 'utf8');

    assert.match(home, /href="\/shop\/guide\/"[^>]*>使用方法<\/a>/);
    assert.match(home, /bg-gray-100/);
    assert.match(guide, /Codex 配置使用方法/);
    assert.match(guide, /https:\/\/api\.aaccx\.pw\/v1/);
    assert.match(guide, /OPENAI_API_KEY/);
    assert.match(guide, /Authorization: Bearer/);
    assert.match(guide, /不要使用 x-api-key/);
    assert.match(guide, /sk-xx/);
    assert.doesNotMatch(guide, /data-ui-ready','true/);
    assert.doesNotMatch(guide, /sk-dummy/);
    assert.doesNotMatch(guide, /环境变量文件/);
    assert.doesNotMatch(guide, /sk-[a-f0-9]{32}/);
});

test('Shop 首页按量计费文案和按钮布局不再暴露手机号查询入口', () => {
    const home = fs.readFileSync(path.join(__dirname, '..', 'shop/index.html'), 'utf8');

    assert.match(home, /Codex[\s\S]*按量计费/);
    assert.match(home, /按实际 token 记录/);
    assert.match(home, /登录账户/);
    assert.match(home, /兑换 API key/);
    assert.match(home, /使用方法/);
    assert.match(home, /私下开通/);
    assert.match(home, /按量记录/);
    assert.doesNotMatch(home, /href="\/shop\/query\/"/);
    assert.doesNotMatch(home, /手机号查询/);
    assert.doesNotMatch(home, /手机号和邀请码/);
    assert.doesNotMatch(home, /每月 30 元人民币/);
    assert.doesNotMatch(home, /额度兑换/);
    assert.doesNotMatch(home, /31 天有效/);
});

test('手机号查询页只作为 Account 跳转兜底，不再渲染查询表单', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/query/index.html'), 'utf8');
    assert.match(html, /正在进入账户页/);
    assert.doesNotMatch(html, /id="queryForm"/);
    assert.doesNotMatch(html, /id="queryPhone"/);
    assert.doesNotMatch(html, /过期订单会显示为已失效/);
});

test('API key 结果页只展示订单，不再渲染使用方法', () => {
    const script = readShopFrontendSource();
    assert.match(script, /api\/orders\/current/);
    assert.doesNotMatch(script, /yui-shop-latest-order/);
    assert.doesNotMatch(script, /Codex CLI 使用公网 API 配置说明/);
    assert.doesNotMatch(script, /Codex 配置使用方法/);
    assert.doesNotMatch(script, /renderUsageGuide/);
});

test('旧购买支付页面不再展示购买、支付、31 天和演示交付语义', () => {
    const files = [
        'shop/key/index.html',
        'shop/order/index.html',
        'shop/pay/index.html',
        'shop/result/index.html',
        'shop/content/index.html'
    ];
    const combined = files.map((file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8')).join('\n');
    const script = readShopFrontendSource();

    assert.doesNotMatch(combined, /31 天/);
    assert.doesNotMatch(combined, /重新购买/);
    assert.doesNotMatch(combined, /¥199\.00/);
    assert.doesNotMatch(combined, /Yui Personal Digital Pack/);
    assert.doesNotMatch(combined, /生成订单并支付/);
    assert.doesNotMatch(combined, /选择支付方式/);
    assert.doesNotMatch(combined, /等待支付确认/);
    assert.doesNotMatch(combined, /演示支付成功/);
    assert.doesNotMatch(combined, /购买内容/);
    assert.doesNotMatch(combined, /交付文件/);
    assert.doesNotMatch(combined, /去购买/);
    assert.doesNotMatch(combined, /id="orderForm"/);
    assert.doesNotMatch(combined, /id="phoneInput"/);
    assert.doesNotMatch(combined, /data-pay-method/);
    assert.doesNotMatch(combined, /id="qrBox"/);
    assert.doesNotMatch(combined, /id="paymentAction"/);
    assert.doesNotMatch(combined, /id="orderSummary"/);
    assert.doesNotMatch(combined, /id="paidContent"/);
    assert.doesNotMatch(combined, /id="contentGuard"/);

    assert.match(fs.readFileSync(path.join(__dirname, '..', 'shop/key/index.html'), 'utf8'), /API key 已激活/);
    assert.match(fs.readFileSync(path.join(__dirname, '..', 'shop/order/index.html'), 'utf8'), /url=\/shop\/account\//);
    assert.match(fs.readFileSync(path.join(__dirname, '..', 'shop/pay/index.html'), 'utf8'), /url=\/shop\/account\//);
    assert.match(fs.readFileSync(path.join(__dirname, '..', 'shop/result/index.html'), 'utf8'), /url=\/shop\/account\//);
    assert.match(fs.readFileSync(path.join(__dirname, '..', 'shop/content/index.html'), 'utf8'), /url=\/shop\/account\//);

    assert.match(script, /function redirectToAccount\(\)/);
    assert.match(script, /window\.location\.replace\('\/shop\/account\/'\)/);
    assert.match(script, /'\/shop\/order\/': legacy\.initOrderPage/);
    assert.match(script, /'\/shop\/pay\/': legacy\.initPayPage/);
    assert.match(script, /'\/shop\/result\/': legacy\.initResultPage/);
    assert.match(script, /'\/shop\/content\/': legacy\.initContentPage/);
});

test('后台页面使用管理员 session，不渲染管理员 token 输入', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/admin/index.html'), 'utf8');
    const script = readShopFrontendSource();

    assert.match(html, /管理员控制台/);
    assert.match(html, /管理员账号/);
    assert.match(html, /shop\.js\?v=20260612-admin-revenue-fallback/);
    assert.doesNotMatch(html, /管理员口令/);
    assert.doesNotMatch(html, /解锁用量监控/);
    assert.doesNotMatch(html, /id="adminAccessForm"/);
    assert.doesNotMatch(html, /id="adminTokenInput"/);
    assert.doesNotMatch(html, /id="adminInviteForm"/);
    assert.doesNotMatch(html, /id="inviteCountInput"/);
    assert.doesNotMatch(html, /id="adminResult"/);
    assert.doesNotMatch(script, /invite\.apiKey/);
    assert.doesNotMatch(script, /api\/admin\/invites/);
    assert.doesNotMatch(script, /x-admin-token/);
});

test('Admin 页面把业务办理合并成一个栏目', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/admin/index.html'), 'utf8');

    assert.match(html, /id="adminBusinessSection"/);
    assert.match(html, /业务办理/);
    assert.match(html, /id="adminBusinessRefreshButton"/);
    assert.match(html, /id="adminInviteCreateForm"/);
    assert.match(html, /id="adminApiKeyImportForm"/);
    assert.match(html, /id="passwordResetCodeForm"/);
    assert.match(html, /id="adminTopupStatusFilter"/);
    assert.match(html, /id="adminTopupTable"/);
    assert.match(html, /id="adminInviteConsoleSummary"/);
    assert.match(html, /id="adminAccountBalancesPanel"/);
    assert.match(html, /id="adminBalanceSearchInput"/);
    assert.match(html, /id="adminBalanceStatusFilter"/);
    assert.match(html, /id="adminBalanceSummary"/);
    assert.match(html, /id="adminBalanceTable"/);
    assert.match(html, /id="adminBalanceMessage"/);
    assert.match(html, /id="adminInviteTable"/);
    assert.match(html, /id="adminApiKeyPoolTable"/);
    const topupIndex = html.indexOf('id="adminTopupTable"');
    const balanceIndex = html.indexOf('id="adminAccountBalancesPanel"');
    const inviteIndex = html.indexOf('id="adminInviteTable"');
    assert.ok(topupIndex > -1 && balanceIndex > -1 && inviteIndex > -1);
    assert.ok(topupIndex < balanceIndex);
    assert.ok(balanceIndex < inviteIndex);
    assert.doesNotMatch(html, /id="adminInviteSection"/);
    assert.doesNotMatch(html, /id="adminPasswordResetSection"/);
    assert.doesNotMatch(html, /id="adminTopupSection"/);
});

test('Admin 前端兑换码管理不使用 x-admin-token', () => {
    const script = readShopFrontendSource();

    assert.match(script, /api\/admin\/invite-console/);
    assert.match(script, /api\/admin\/session-invites/);
    assert.match(script, /api\/admin\/session-api-keys/);
    assert.match(script, /function initAdminInvitePage/);
    assert.match(script, /adminBusinessRefreshButton/);
    assert.match(script, /refreshAdminBusiness/);
    assert.match(script, /function renderAdminBalanceSummary/);
    assert.match(script, /function renderAdminBalanceTable/);
    assert.match(script, /function initAdminAccountBalancesPage/);
    assert.match(script, /api\/admin\/account-balances/);
    assert.match(script, /refreshAdminBalances/);
    assert.match(script, /onBalanceChanged/);
    assert.match(script, /用户余额/);
    assert.match(script, /欠费用户/);
    assert.match(script, /待确认充值/);
    assert.doesNotMatch(script, /x-admin-token/);
});

test('后台页面包含 usage 监控和 JSONL 导入控件', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/admin/index.html'), 'utf8');
    const script = readShopFrontendSource();

    assert.match(html, /id="adminBusinessSection"/);
    assert.match(html, /id="adminUsageSection"/);
    assert.match(html, /id="adminUsageImportSection"/);
    assert.match(html, /id="usageRefreshButton"/);
    assert.match(html, /id="usageGroupFilter"/);
    assert.match(html, /<option value="local">Local<\/option>/);
    assert.match(html, /id="usageImportForm"/);
    assert.match(html, /CLIProxyAPI\/logs\/usage/);
    assert.match(html, /usage-events-YYYY-MM\.jsonl/);
    assert.match(html, /id="adminBillingUsageCards"/);
    assert.match(html, /id="adminRevenueCharts"/);
    assert.match(html, /id="adminRecentCharges"/);
    assert.match(script, /function initAdminUsagePage/);
    assert.match(script, /function renderBillingUsageCards/);
    assert.match(script, /function renderAdminRevenueCharts/);
    assert.match(script, /function renderRevenuePieChart/);
    assert.match(script, /function renderCustomerSpendingBars/);
    assert.match(script, /function renderAdminRecentCharges/);
    assert.match(script, /api\/admin\/usage-summary/);
    assert.match(script, /api\/admin\/usage-imports/);
    assert.match(script, /今日收银/);
    assert.match(script, /本月收银/);
    assert.match(script, /收银分析/);
    assert.match(script, /Shop 用户消费排行/);
    assert.match(script, /data-revenue-ranking-period="today"/);
    assert.match(script, /data-revenue-ranking-period="month"/);
    assert.match(script, /今天收银多少钱/);
    assert.match(script, /本月一共收了多少钱/);
    assert.match(script, /今日消费/);
    const usageSection = html.match(/<section id="adminUsageSection"[\s\S]*?<section id="adminUsageImportSection"/)?.[0] || '';
    assert.doesNotMatch(usageSection, /adminAccountBalancesPanel/);
    assert.doesNotMatch(usageSection, /用户余额/);
    assert.doesNotMatch(html, /完整 API key/);
    assert.equal((html.match(/data-collapsible-section/g) || []).length, 3);
    assert.equal((html.match(/data-collapsible-toggle/g) || []).length, 3);
    assert.equal((html.match(/data-collapsible-content/g) || []).length, 3);
    assert.match(html, /id="adminBusinessSection"[\s\S]*?data-collapsible-default="open"/);
    assert.match(html, /id="adminUsageSection"[\s\S]*?data-collapsible-default="open"/);
    assert.match(html, /id="adminUsageImportSection"[\s\S]*?data-collapsible-default="open"/);
});

test('Admin 收银图表关键几何样式存在于构建 CSS 中', () => {
    const script = readShopFrontendSource();
    const siteCss = fs.readFileSync(path.join(__dirname, '..', 'styles/site.css'), 'utf8');

    assert.match(script, /admin-revenue-pie/);
    assert.match(script, /admin-revenue-pie-inner/);
    assert.match(script, /admin-revenue-bars/);
    assert.match(script, /admin-revenue-bar/);
    assert.match(script, /admin-revenue-bar-stack/);
    assert.match(script, /admin-revenue-bar-segment/);
    assert.match(script, /admin-revenue-bar-segment-hit/);
    assert.match(script, /admin-revenue-bar-segment-miss/);
    assert.match(script, /admin-revenue-bar-segment-output/);
    assert.match(script, /admin-revenue-ranking-legend/);
    assert.match(script, /barHeightPx/);
    assert.match(script, /admin-revenue-bar admin-revenue-bar-stack" style="height:\$\{barHeightPx\}px/);
    assert.doesNotMatch(script, /admin-revenue-bar" style="height:\$\{height\}%/);
    assert.match(siteCss, /\.admin-revenue-pie\{/);
    assert.match(siteCss, /width:9rem/);
    assert.match(siteCss, /height:9rem/);
    assert.match(siteCss, /\.admin-revenue-bars\{/);
    assert.match(siteCss, /\.admin-revenue-bar-stack\{/);
    assert.match(siteCss, /\.admin-revenue-bar-segment-miss\{/);
    assert.match(siteCss, /box-shadow:inset 0 0 0 1px rgba\(34,34,34,\.35\)/);
    assert.match(siteCss, /height:14rem/);
}
);

test('Admin 收银排行兼容旧排行数据缺少 parts 时不渲染白色空柱', () => {
    const script = readShopFrontendSource();

    assert.match(script, /function normalizeChargeParts/);
    assert.match(script, /partChargeTotal/);
    assert.match(script, /旧格式总金额/);
    assert.match(script, /chargeNanos: Number\(fallbackTotalNanos \|\| 0\)/);
});

test('Admin 日志导入栏目展示自动导入状态容器', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/admin/index.html'), 'utf8');
    assert.match(html, /id="usageImportStatus"/);
});

test('Admin 前端读取 usage 自动导入状态接口', () => {
    const script = readShopFrontendSource();
    assert.match(script, /api\/admin\/usage-import-status/);
});

test('Account 页面包含预充值余额、充值申请和扣费流水容器', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/account/index.html'), 'utf8');

    assert.match(html, /id="accountModelOverview"/);
    assert.match(html, /id="accountBalanceCards"/);
    assert.match(html, /id="accountBillingUsageCards"/);
    assert.doesNotMatch(html, /id="accountTokenBreakdown"/);
    assert.doesNotMatch(html, /id="accountUsageCards"/);
    assert.doesNotMatch(html, /id="paymentReference"/);
    assert.doesNotMatch(html, /付款备注：/);
    assert.match(html, /id="topupPaymentNote"[^>]+placeholder="备注可填写微信号"/);
    assert.doesNotMatch(html, /id="accountHourlyChart"/);
    assert.doesNotMatch(html, /id="accountDailyChart"/);
    assert.doesNotMatch(html, /最近 24 小时/);
    assert.doesNotMatch(html, /本月每日/);
    assert.match(html, /id="topupForm"/);
    assert.match(html, /id="topupAmount"/);
    assert.match(html, /id="accountTopups"/);
    assert.match(html, /id="accountWeeklySpendingChart"/);
    assert.match(html, /id="accountCharges"/);
    assert.match(html, /id="accountLedger"/);
    assert.match(html, /id="accountGuideSection"/);
    assert.match(html, /Codex 配置使用方法/);
    assert.match(html, /https:\/\/api\.aaccx\.pw\/v1/);
    assert.match(html, /OPENAI_API_KEY/);
    assert.match(html, /Authorization: Bearer/);
    assert.match(html, /不要使用 x-api-key/);

    const script = readShopFrontendSource();
    assert.doesNotMatch(script, /renderTokenBreakdown/);
    assert.doesNotMatch(script, /\['Input', month\.inputTokens\]/);
    assert.doesNotMatch(script, /\['Output', month\.outputTokens\]/);
    assert.doesNotMatch(script, /\['Reasoning', month\.reasoningTokens\]/);
    assert.doesNotMatch(script, /\['Cached', month\.cachedTokens\]/);
    assert.match(html, /sk-xx/);
    assert.equal((html.match(/data-collapsible-section/g) || []).length, 5);
    assert.equal((html.match(/data-collapsible-toggle/g) || []).length, 5);
    assert.equal((html.match(/data-collapsible-content/g) || []).length, 5);
    assert.match(html, /id="accountGuideSection"[\s\S]*?data-collapsible-default="closed"/);

    const modelOverviewIndex = html.indexOf('id="accountModelOverview"');
    const balanceCardsIndex = html.indexOf('id="accountBalanceCards"');
    assert.ok(modelOverviewIndex >= 0);
    assert.ok(balanceCardsIndex > modelOverviewIndex);
});

test('Account 前端渲染周消费柱状图并提供上一周下一周切换', () => {
    const script = readShopFrontendSource();
    const accountChartScript = script.slice(
        script.indexOf('function renderAccountWeeklySpendingChart'),
        script.indexOf('function renderAdminRevenueCharts')
    );

    assert.match(script, /function renderAccountWeeklySpendingChart/);
    assert.match(script, /data-account-week-offset="-1"/);
    assert.match(script, /data-account-week-offset="1"/);
    assert.match(script, /admin-revenue-bar-segment-hit/);
    assert.match(script, /admin-revenue-bar-segment-miss/);
    assert.match(script, /admin-revenue-bar-segment-output/);
    assert.match(script, /admin-revenue-bar admin-revenue-bar-stack/);
    assert.match(accountChartScript, /admin-revenue-ranking-legend/);
    assert.match(accountChartScript, /renderStackedChargeBars/);
    assert.doesNotMatch(accountChartScript, /account-revenue-bar/);
    assert.match(script, /accountWeeklySpendingChart\.innerHTML = renderAccountWeeklySpendingChart/);
});

test('Account 用量卡片不展示无效 token 总览和内部价格版本名', () => {
    const script = readShopFrontendSource();

    assert.doesNotMatch(script, /function renderAccountUsageCards/);
    assert.doesNotMatch(script, /billing\.priceVersion/);
    assert.match(script, /本月已扣费/);
});

test('Account 页把余额和 API key 前置，并默认收起说明和流水', () => {
    const accountHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/account/index.html'), 'utf8');

    const billingIndex = accountHtml.indexOf('id="accountBillingSection"');
    const keysIndex = accountHtml.indexOf('id="accountKeysSection"');
    const guideIndex = accountHtml.indexOf('id="accountGuideSection"');
    const usageIndex = accountHtml.indexOf('id="accountUsageSection"');
    const historyIndex = accountHtml.indexOf('id="accountBillingHistorySection"');

    assert.ok(billingIndex >= 0);
    assert.ok(keysIndex > billingIndex);
    assert.ok(guideIndex > keysIndex);
    assert.ok(usageIndex > guideIndex);
    assert.ok(historyIndex > usageIndex);

    assert.match(accountHtml, /id="accountBillingSection"[^>]*data-collapsible-default="open"/);
    assert.match(accountHtml, /id="accountKeysSection"[^>]*data-collapsible-default="open"/);
    assert.match(accountHtml, /id="accountGuideSection"[^>]*data-collapsible-default="closed"/);
    assert.match(accountHtml, /id="accountUsageSection"[^>]*data-collapsible-default="open"/);
    assert.match(accountHtml, /id="accountBillingHistorySection"[^>]*data-collapsible-default="closed"/);
});

test('Account API key 卡片只展示 key、兑换时间和复制按钮', () => {
    const script = readShopFrontendSource();
    const compactBranch = script.slice(
        script.indexOf('if (options.compactAccountOrder)'),
        script.indexOf('\n    }\n\n    return `', script.indexOf('if (options.compactAccountOrder)'))
    );

    assert.match(script, /renderOrderCard\(order, \{ revealKey: true, compactAccountOrder: true \}\)/);
    assert.match(compactBranch, /API key/);
    assert.match(compactBranch, /兑换时间/);
    assert.match(compactBranch, /copyButton/);
    assert.doesNotMatch(compactBranch, /金额/);
    assert.doesNotMatch(compactBranch, /手机号/);
    assert.doesNotMatch(compactBranch, /失效时间/);
    assert.doesNotMatch(compactBranch, /31 天/);
    assert.doesNotMatch(compactBranch, /productName/);
    assert.doesNotMatch(compactBranch, /statusText/);
});

test('Admin 业务办理栏目包含充值审核容器', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'shop/admin/index.html'), 'utf8');
    const businessSection = html.match(/<section id="adminBusinessSection"[\s\S]*?<\/section>\s*<section id="adminUsageSection"/)?.[0] || '';

    assert.match(businessSection, /充值审核/);
    assert.match(businessSection, /id="adminTopupStatusFilter"/);
    assert.match(businessSection, /id="adminTopupTable"/);
    assert.match(businessSection, /id="adminTopupMessage"/);
});

test('管理员页和独立重置密码页包含密码重置入口，登录页只保留跳转链接', () => {
    const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/admin/index.html'), 'utf8');
    const loginHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/login/index.html'), 'utf8');
    const resetHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/reset-password/index.html'), 'utf8');
    const script = readShopFrontendSource();

    assert.match(adminHtml, /id="adminBusinessSection"/);
    assert.match(adminHtml, /id="passwordResetCodeForm"/);
    assert.match(adminHtml, /id="passwordResetPhone"/);
    assert.match(adminHtml, /id="passwordResetCodeResult"/);
    assert.doesNotMatch(adminHtml, /id="adminPasswordResetSection"/);

    assert.match(loginHtml, /href="\/shop\/reset-password\/"/);
    assert.doesNotMatch(loginHtml, /id="showPasswordResetButton"/);
    assert.doesNotMatch(loginHtml, /id="passwordResetForm"/);
    assert.doesNotMatch(loginHtml, /id="resetPasswordCode"/);
    assert.doesNotMatch(loginHtml, /id="resetNewPassword"/);
    assert.doesNotMatch(loginHtml, /id="resetConfirmPassword"/);

    assert.match(resetHtml, /<title>重置密码<\/title>/);
    assert.match(resetHtml, /class="shop-auth-main[^"]*"/);
    assert.match(resetHtml, /class="shop-auth-background-figure"/);
    assert.match(resetHtml, /id="passwordResetForm"/);
    assert.match(resetHtml, /id="resetPhone"/);
    assert.match(resetHtml, /id="resetPasswordCode"/);
    assert.match(resetHtml, /id="resetNewPassword"/);
    assert.match(resetHtml, /id="resetConfirmPassword"/);
    assert.match(resetHtml, /href="\/shop\/login\/"/);

    assert.match(script, /function initResetPasswordPage/);
    assert.match(script, /'\/shop\/reset-password\/': auth\.initResetPasswordPage/);
    assert.doesNotMatch(script, /function initPasswordResetForm/);
    assert.doesNotMatch(script, /initPasswordResetForm\(\)/);
    assert.match(script, /initResetPasswordPage/);
    assert.match(script, /function initAdminPasswordResetPage/);
});

test('重置密码页使用紧凑 Auth 表单，避免桌面首屏溢出', () => {
    const resetHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/reset-password/index.html'), 'utf8');

    assert.match(resetHtml, /class="shop-auth-panel[^"]*md:p-10/);
    assert.match(resetHtml, /id="passwordResetForm" class="space-y-4"/);
    assert.equal((resetHtml.match(/h-11 rounded-md/g) || []).length, 4);
    assert.doesNotMatch(resetHtml, /id="passwordResetForm" class="space-y-5"/);
    assert.doesNotMatch(resetHtml, /class="shop-auth-panel[^"]*md:p-16/);
});

test('注册页使用登录页同款 Auth 外壳并移除左侧说明区块', () => {
    const registerHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/register/index.html'), 'utf8');

    assert.match(registerHtml, /<title>注册<\/title>/);
    assert.match(registerHtml, /class="shop-auth-main[^"]*"/);
    assert.match(registerHtml, /class="shop-auth-background-figure"/);
    assert.match(registerHtml, /src="\/shop\/assets\/login\/yui-login-bg\.png"/);
    assert.match(registerHtml, /class="shop-auth-content[^"]*"/);
    assert.match(registerHtml, /class="shop-auth-panel[^"]*"/);
    assert.match(registerHtml, /id="registerForm"/);
    assert.match(registerHtml, /id="registerPhone"/);
    assert.match(registerHtml, /id="registerPassword"/);
    assert.match(registerHtml, /id="registerConfirmPassword"/);
    assert.match(registerHtml, /href="\/shop\/login\/"/);
    assert.doesNotMatch(registerHtml, /Create account/);
    assert.doesNotMatch(registerHtml, /手机号会作为你的账户身份/);
    assert.doesNotMatch(registerHtml, /历史兑换过的手机号/);
    assert.doesNotMatch(registerHtml, /grid lg:grid-cols-\[0\.9fr_1\.1fr\]/);
});

test('登录页移除左侧标题并保留轻量登录入口', () => {
    const loginHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/login/index.html'), 'utf8');

    assert.doesNotMatch(loginHtml, /这里是登录页面/);
    assert.match(loginHtml, /<title>登录<\/title>/);
    assert.doesNotMatch(loginHtml, /<h1[\s\S]*?<\/h1>/);
    assert.doesNotMatch(loginHtml, /登录 Shop/);
    assert.doesNotMatch(loginHtml, /登录 悠一 的小店/);
    assert.doesNotMatch(loginHtml, /使用手机号和密码进入个人中心/);
    assert.doesNotMatch(loginHtml, /管理员账号登录后进入控制台/);
});

test('Auth 外壳样式由 Tailwind 输入文件统一维护，登录页使用中途版人物背景', () => {
    const loginHtml = fs.readFileSync(path.join(__dirname, '..', 'shop/login/index.html'), 'utf8');
    const tailwindCss = fs.readFileSync(path.join(__dirname, '..', 'styles/tailwind.css'), 'utf8');
    const siteCss = fs.readFileSync(path.join(__dirname, '..', 'styles/site.css'), 'utf8');
    const assetPath = path.join(__dirname, '..', 'shop/assets/login/yui-login-bg.png');
    const png = fs.readFileSync(assetPath);

    assert.match(loginHtml, /class="shop-auth-main[^"]*"/);
    assert.match(loginHtml, /class="shop-auth-background-figure"/);
    assert.match(loginHtml, /class="shop-auth-content[^"]*"/);
    assert.match(loginHtml, /class="shop-auth-panel[^"]*"/);
    assert.match(loginHtml, /src="\/shop\/assets\/login\/yui-login-bg\.png"/);
    assert.doesNotMatch(loginHtml, /\.login-main/);
    assert.doesNotMatch(loginHtml, /\.login-background-figure/);
    assert.doesNotMatch(loginHtml, /\.login-content/);
    assert.doesNotMatch(loginHtml, /\.login-panel/);

    assert.match(tailwindCss, /\.shop-auth-background-figure/);
    assert.match(tailwindCss, /left:\s*clamp\(-380px,\s*-22vw,\s*-260px\)/);
    assert.match(tailwindCss, /bottom:\s*0/);
    assert.match(tailwindCss, /width:\s*min\(86vw,\s*1120px\)/);
    assert.match(tailwindCss, /opacity:\s*0\.42/);
    assert.match(siteCss, /\.shop-auth-background-figure/);

    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png[25], 6);
});

test('Shop 首页顶部不显示账号入口且正文只保留固定登录入口', () => {
    const home = fs.readFileSync(path.join(__dirname, '..', 'shop/index.html'), 'utf8');
    const login = fs.readFileSync(path.join(__dirname, '..', 'shop/login/index.html'), 'utf8');
    const register = fs.readFileSync(path.join(__dirname, '..', 'shop/register/index.html'), 'utf8');
    const account = fs.readFileSync(path.join(__dirname, '..', 'shop/account/index.html'), 'utf8');
    const script = readShopFrontendSource();
    const header = home.match(/<header[\s\S]*?<\/header>/)?.[0] || '';
    const accountLinkCount = (home.match(/data-account-link/g) || []).length;

    assert.match(home, /href="\/shop\/login\/"/);
    assert.equal(accountLinkCount, 0);
    assert.doesNotMatch(header, /data-account-link/);
    assert.match(home, /<main[\s\S]*href="\/shop\/login\/"[\s\S]*>登录账户<\/a>/);
    assert.doesNotMatch(home, /管理控制台/);
    assert.match(login, /id="loginForm"/);
    assert.match(login, /id="loginForm"/);
    assert.doesNotMatch(login, /这里是登录页面/);
    assert.match(register, /id="registerForm"/);
    assert.match(register, /至少 8 位/);
    assert.match(account, /id="logoutButton"/);
    assert.doesNotMatch(account, /window\.YuiShop\.initAccountPage/);
    assert.match(script, /'\/shop\/account\/': account\.initAccountPage/);
});

test('公共顶部导航支持 Shop 的中英日翻译', () => {
    const script = fs.readFileSync(path.join(__dirname, '..', 'js/lang.js'), 'utf8');

    assert.match(script, /shop:\s*'商店'/);
    assert.match(script, /shop:\s*'Shop'/);
    assert.match(script, /shop:\s*'ショップ'/);
    assert.match(script, /href\.includes\('\/shop'\)[\s\S]*data\.nav\.shop/);
    assert.match(script, /path === '\/shop' \|\| path\.startsWith\('\/shop\/'\)[\s\S]*return null/);
});

module.exports = {
    loadShopScripts
};
