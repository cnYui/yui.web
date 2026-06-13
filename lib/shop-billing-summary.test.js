const assert = require('node:assert/strict');
const test = require('node:test');

const { buildBillingSummary, buildWeeklySpending } = require('./shop-billing-summary');

test('收银统计按 price_version 拆分今日和本月构成', () => {
    const rows = [
        {
            id: 'charge-gpt',
            phone: '13800138001',
            status: 'charged',
            created_at: '2026-06-13T10:00:00+08:00',
            charge_nanos: 17750000000,
            cache_hit_input_tokens: 1000000,
            cache_miss_input_tokens: 1000000,
            output_tokens: 1000000,
            price_version: 'gpt-5.4-rmb-20260613'
        },
        {
            id: 'charge-old',
            phone: '13800138002',
            status: 'charged',
            created_at: '2026-06-12T10:00:00+08:00',
            charge_nanos: 6025000000,
            cache_hit_input_tokens: 1000000,
            cache_miss_input_tokens: 1000000,
            output_tokens: 1000000,
            price_version: 'deepseek-v4-pro-rmb-20260424'
        },
        {
            id: 'charge-failed',
            phone: '13800138003',
            status: 'failed_no_charge',
            created_at: '2026-06-13T11:00:00+08:00',
            charge_nanos: 999,
            cache_hit_input_tokens: 999,
            cache_miss_input_tokens: 999,
            output_tokens: 999,
            price_version: 'gpt-5.5-rmb-20260613'
        }
    ];

    const summary = buildBillingSummary(rows, {
        todayStart: new Date('2026-06-13T00:00:00+08:00'),
        monthStart: new Date('2026-06-01T00:00:00+08:00')
    }, {
        publicChargeRecord: (row) => ({ id: row.id, phone: row.phone })
    });

    assert.equal(summary.todayChargeNanos, 17750000000);
    assert.equal(summary.monthChargeNanos, 23775000000);
    assert.equal(summary.todayRevenueParts.find((part) => part.key === 'output').chargeNanos, 15000000000);
    assert.equal(summary.monthRevenueParts.find((part) => part.key === 'cache_hit_input').chargeNanos, 275000000);
    assert.equal(summary.customerSpendingRankings.month[0].phone, '13800138001');
    assert.deepEqual(summary.recentCharges.slice(0, 2), [
        { id: 'charge-gpt', phone: '13800138001' },
        { id: 'charge-old', phone: '13800138002' }
    ]);
});

test('周消费统计按中国周一到周日生成 7 天桶', () => {
    const weekly = buildWeeklySpending([
        {
            status: 'charged',
            created_at: '2026-06-10T10:00:00+08:00',
            charge_nanos: 15000000000,
            cache_hit_input_tokens: 0,
            cache_miss_input_tokens: 0,
            output_tokens: 1000000,
            price_version: 'gpt-5.4-rmb-20260613'
        }
    ], new Date('2026-06-13T12:00:00+08:00'));

    const current = weekly.weeks[weekly.currentWeekStart];
    assert.equal(weekly.currentWeekStart, '2026-06-08');
    assert.equal(current.weekEnd, '2026-06-14');
    assert.equal(current.days.length, 7);
    assert.equal(current.days.some((day) => day.date === '2026-06-10' && day.chargeNanos === 15000000000), true);
});
