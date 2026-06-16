# 订阅池长期加量包实施计划修正

## 修正范围

本文修正 `docs/ai/context/20260616-182903-subscription-pool-usd-billing-implementation-plan_CN.md` 中关于加量包和 Account / Admin 页面的内容。

旧计划里的以下口径不再采用：

- 加量包当日有效。
- 加量包按 `quota_date` 绑定某一天。
- `addonQuotaUsdMicros` 直接并入每日额度池。
- 加量包订单类型使用 `quota_addon`。

最新口径：

- 加量包长期保留。
- 续费和换套餐不清零加量包。
- usage 扣费先扣每日套餐额度，再扣加量包余额。
- 无有效订阅时，加量包余额保留但不放行 API。

## Schema 修正

原计划 Task 2 中的 schema 需要增加：

```sql
CREATE TABLE IF NOT EXISTS account_addon_balances (
  phone TEXT PRIMARY KEY,
  balance_usd_micros INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (phone) REFERENCES users(phone)
);

CREATE TABLE IF NOT EXISTS account_addon_ledger_entries (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('addon_purchase', 'api_charge', 'admin_adjustment', 'refund')),
  amount_usd_micros INTEGER NOT NULL,
  balance_after_usd_micros INTEGER NOT NULL,
  related_id TEXT,
  memo TEXT,
  created_at TEXT NOT NULL,
  created_by_phone TEXT,
  FOREIGN KEY (phone) REFERENCES users(phone)
);
```

`subscription_orders.order_type` 改为：

```sql
order_type TEXT NOT NULL CHECK (order_type IN ('subscription', 'addon'))
```

`api_usd_charge_records` 增加扣费来源字段：

```sql
daily_quota_before_usd_micros INTEGER NOT NULL DEFAULT 0,
daily_quota_deducted_usd_micros INTEGER NOT NULL DEFAULT 0,
daily_quota_after_usd_micros INTEGER NOT NULL DEFAULT 0,
addon_balance_before_usd_micros INTEGER NOT NULL DEFAULT 0,
addon_deducted_usd_micros INTEGER NOT NULL DEFAULT 0,
addon_balance_after_usd_micros INTEGER NOT NULL DEFAULT 0,
overrun_usd_micros INTEGER NOT NULL DEFAULT 0
```

## 扣费函数修正

新增纯函数建议：

```js
function splitUsdChargeByQuota({
    chargeUsdMicros,
    dailyRemainingUsdMicros,
    addonBalanceUsdMicros
}) {
    const charge = Math.max(0, Math.floor(Number(chargeUsdMicros || 0)));
    const dailyBefore = Math.max(0, Math.floor(Number(dailyRemainingUsdMicros || 0)));
    const addonBefore = Math.max(0, Math.floor(Number(addonBalanceUsdMicros || 0)));
    const dailyDeducted = Math.min(charge, dailyBefore);
    const remainingAfterDaily = charge - dailyDeducted;
    const addonDeducted = Math.min(remainingAfterDaily, addonBefore);
    const overrun = Math.max(0, remainingAfterDaily - addonDeducted);
    return {
        dailyQuotaBeforeUsdMicros: dailyBefore,
        dailyQuotaDeductedUsdMicros: dailyDeducted,
        dailyQuotaAfterUsdMicros: dailyBefore - dailyDeducted,
        addonBalanceBeforeUsdMicros: addonBefore,
        addonDeductedUsdMicros: addonDeducted,
        addonBalanceAfterUsdMicros: addonBefore - addonDeducted,
        overrunUsdMicros: overrun
    };
}
```

请求前状态检查：

```js
function accountSubscriptionQuotaStatus(phone, date) {
    const subscription = getActiveSubscriptionWithPlanByPhone.get(phone, nowIso(), nowIso());
    const addonBalance = ensureAccountAddonBalance(phone);
    if (!subscription) {
        return {
            active: false,
            code: 'subscription_required',
            addonBalanceUsdMicros: addonBalance.balance_usd_micros,
            remainingUsdMicros: 0
        };
    }
    const quotaDate = chinaDateKey(date);
    const dailyQuotaUsdMicros = Number(subscription.daily_quota_usd_micros || 0);
    const dailyUsedUsdMicros = sumDailyQuotaDeductedByPhoneAndDate.get(phone, quotaDate)?.amount || 0;
    const dailyRemainingUsdMicros = Math.max(0, dailyQuotaUsdMicros - dailyUsedUsdMicros);
    const addonBalanceUsdMicros = Number(addonBalance.balance_usd_micros || 0);
    return {
        active: dailyRemainingUsdMicros + addonBalanceUsdMicros > 0,
        code: dailyRemainingUsdMicros + addonBalanceUsdMicros > 0 ? 'active' : 'daily_quota_exhausted',
        quotaDate,
        dailyQuotaUsdMicros,
        dailyUsedUsdMicros,
        dailyRemainingUsdMicros,
        addonBalanceUsdMicros,
        remainingUsdMicros: dailyRemainingUsdMicros + addonBalanceUsdMicros
    };
}
```

## 测试修正

原计划中“用户可购买 5 元当日加量包”测试改为：

```js
test('加量包审核通过后增加长期余额，次日和续费后仍保留', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const user = await registerAndLogin(baseUrl, '13800138801');
        const admin = await loginAdmin();
        await createApprovedSubscriptionForTest({
            baseUrl,
            headers: user.headers,
            adminHeaders: admin.headers,
            planId: 'sub_29_daily_19_usd'
        });
        const addon = await createApprovedAddonForTest({
            baseUrl,
            headers: user.headers,
            adminHeaders: admin.headers,
            amount: 5
        });
        assert.equal(addon.quotaUsdMicros, 5000000);
        assert.equal(db.prepare('SELECT balance_usd_micros FROM account_addon_balances WHERE phone = ?').get('13800138801').balance_usd_micros, 5000000);
        await createApprovedSubscriptionForTest({
            baseUrl,
            headers: user.headers,
            adminHeaders: admin.headers,
            planId: 'sub_39_daily_29_usd'
        });
        assert.equal(db.prepare('SELECT balance_usd_micros FROM account_addon_balances WHERE phone = ?').get('13800138801').balance_usd_micros, 5000000);
    });
});
```

新增扣费优先级测试：

```js
test('usage 先扣每日套餐额度，每日额度用完后才扣加量包', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const { apiKey, headers } = await redeemManagedApiKeyForTest(baseUrl, '13800138802');
        const admin = await loginAdmin();
        await createApprovedSubscriptionForTest({
            baseUrl,
            headers,
            adminHeaders: admin.headers,
            planId: 'sub_29_daily_19_usd'
        });
        await createApprovedAddonForTest({
            baseUrl,
            headers,
            adminHeaders: admin.headers,
            amount: 5
        });
        await insertUsdChargeForTest({
            db,
            phone: '13800138802',
            apiKeyHash: hashApiKeyForTest(apiKey),
            chargeUsdMicros: 18000000,
            dailyDeductedUsdMicros: 18000000,
            addonDeductedUsdMicros: 0,
            quotaDate: '2026-06-16'
        });
        await usageEventFetch(baseUrl, {
            request_id: 'req-addon-priority',
            api_key_hash: hashApiKeyForTest(apiKey),
            model: 'gpt-5.4',
            success: true,
            input_tokens: 400000,
            cache_miss_input_tokens: 400000,
            output_tokens: 0,
            requested_at: '2026-06-16T18:00:00+08:00'
        });
        const record = db.prepare(`
SELECT daily_quota_deducted_usd_micros, addon_deducted_usd_micros, addon_balance_after_usd_micros
FROM api_usd_charge_records
WHERE usage_event_id = 'req-addon-priority'
`).get();
        assert.deepEqual(record, {
            daily_quota_deducted_usd_micros: 1000000,
            addon_deducted_usd_micros: 0,
            addon_balance_after_usd_micros: 5000000
        });
    }, { now: () => '2026-06-16T18:00:00+08:00' });
});
```

新增无订阅测试：

```js
test('无有效订阅时加量包余额保留但 API key 不放行', async () => {
    await withServer(async ({ baseUrl, db }) => {
        const { apiKey } = await redeemManagedApiKeyForTest(baseUrl, '13800138803');
        db.prepare(`
INSERT INTO account_addon_balances (phone, balance_usd_micros, updated_at)
VALUES ('13800138803', 5000000, '2026-06-16T10:00:00+08:00')
`).run();
        const status = await jsonFetch(`${baseUrl}/api/internal/api-keys/status`, {
            method: 'POST',
            headers: internalHeaders(),
            body: JSON.stringify({ api_key_hash: hashApiKeyForTest(apiKey) })
        });
        assert.equal(status.response.status, 401);
        assert.equal(status.body.code, 'subscription_required');
        assert.equal(status.body.addonBalanceUsdMicros, 5000000);
    });
});
```

## Account 页面实施修正

`shop/account/index.html`：

- 将 `accountBillingSection` 从“账户余额”改成“订阅池”。
- 新增 `accountQuotaCards` 展示套餐、今日额度、加量包余额、当前可用额度。
- 将 `topupForm` 替换为 `subscriptionOrderForm` 和 `addonOrderForm`。
- `accountTopups` 替换为 `accountSubscriptionOrders` / `accountAddonOrders`。
- `accountCharges` 改为展示美元扣费和扣费来源。
- `accountLedger` 改为加量包流水或订阅池流水。

`shop/js/account.js`：

- 新增 `formatUsdMicros`。
- 新增 `renderAccountQuotaCards`。
- 新增 `renderSubscriptionPlans`。
- 新增 `renderAddonPackages`。
- 新增 `renderSubscriptionOrders` / `renderAddonOrders`。
- `refreshBilling` 改为请求 `/api/account/subscription-state`、`/api/account/subscription-orders`、`/api/account/addon-orders`、`/api/account/usd-charges`、`/api/account/addon-ledger`。

## Admin 页面实施修正

`shop/admin/index.html`：

- 业务办理区保留邀请码、重置码、API key 池。
- `adminTopupTable` 改为订单审核容器，或新增 `adminSubscriptionOrderTable` / `adminAddonOrderTable`。
- `adminAccountBalancesPanel` 改为 `adminAccountQuotaPanel`。
- 用量监控保留，但卡片和图表从人民币扣费改为美元消耗、订单收入、扣费来源。

`shop/js/admin.js`：

- `renderAdminTopups` 替换为 `renderAdminSubscriptionOrders` 和 `renderAdminAddonOrders`。
- `initAdminTopupPage` 替换为 `initAdminOrderReviewPage`。
- `renderAdminBalanceSummary` / `renderAdminBalanceTable` 替换为订阅池额度面板。
- 最近扣费记录展示 `dailyQuotaDeductedUsdMicros`、`addonDeductedUsdMicros`、`overrunUsdMicros`。

## 验收重点

- 加量包跨天不清零。
- 续费和换套餐不清零加量包。
- 今日套餐额度仍有剩余时，加量包余额不减少。
- 今日套餐额度用完后自动扣加量包。
- 没有有效订阅时，加量包余额保留但不放行。
- Account 页面不再以人民币余额作为主视图。
- Admin 收入按订单统计人民币，usage 按官方价格统计美元消耗。
