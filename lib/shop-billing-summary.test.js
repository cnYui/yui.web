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

test('Admin 最近扣费记录返回全部记录', () => {
    const rows = Array.from({ length: 12 }, (_, index) => ({
        id: `charge-${index + 1}`,
        phone: '13800138001',
        status: 'charged',
        created_at: `2026-06-13T10:${String(index).padStart(2, '0')}:00+08:00`,
        charge_nanos: 1000,
        cache_hit_input_tokens: 0,
        cache_miss_input_tokens: 0,
        output_tokens: 1,
        price_version: 'gpt-5.4-rmb-20260613'
    }));

    const summary = buildBillingSummary(rows, {
        todayStart: new Date('2026-06-13T00:00:00+08:00'),
        monthStart: new Date('2026-06-01T00:00:00+08:00')
    }, {
        publicChargeRecord: (row) => ({ id: row.id })
    });

    assert.equal(summary.recentCharges.length, rows.length);
    assert.equal(summary.recentCharges.at(-1).id, 'charge-12');
});

test('收银统计按 usage 发生时间切分今日和本月', () => {
    const rows = [
        {
            id: 'charge-delayed',
            phone: '13800138001',
            status: 'charged',
            created_at: '2026-06-13T16:05:00+08:00',
            usage_requested_at: '2026-06-12T12:00:00+08:00',
            charge_nanos: 5000000000,
            cache_hit_input_tokens: 0,
            cache_miss_input_tokens: 1000000,
            output_tokens: 0,
            price_version: 'gpt-5.4-rmb-20260613'
        },
        {
            id: 'charge-today',
            phone: '13800138002',
            status: 'charged',
            created_at: '2026-06-13T16:10:00+08:00',
            usage_requested_at: '2026-06-13T10:00:00+08:00',
            charge_nanos: 1500000000,
            cache_hit_input_tokens: 0,
            cache_miss_input_tokens: 0,
            output_tokens: 100000,
            price_version: 'gpt-5.4-rmb-20260613'
        }
    ];

    const summary = buildBillingSummary(rows, {
        todayStart: new Date('2026-06-13T00:00:00+08:00'),
        monthStart: new Date('2026-06-01T00:00:00+08:00')
    });

    assert.equal(summary.todayChargeNanos, 1500000000);
    assert.equal(summary.monthChargeNanos, 6500000000);
    assert.deepEqual(summary.customerSpendingRankings.today.map((item) => item.phone), ['13800138002']);
    assert.deepEqual(summary.customerSpendingRankings.month.map((item) => item.phone), ['13800138001', '13800138002']);
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

test('周消费统计按 usage 发生日期归入每天桶', () => {
    const weekly = buildWeeklySpending([
        {
            status: 'charged',
            created_at: '2026-06-13T16:05:00+08:00',
            usage_requested_at: '2026-06-10T12:00:00+08:00',
            charge_nanos: 15000000000,
            cache_hit_input_tokens: 0,
            cache_miss_input_tokens: 0,
            output_tokens: 1000000,
            price_version: 'gpt-5.4-rmb-20260613'
        }
    ], new Date('2026-06-13T18:00:00+08:00'));

    const current = weekly.weeks[weekly.currentWeekStart];
    assert.equal(current.days.find((day) => day.date === '2026-06-10').chargeNanos, 15000000000);
    assert.equal(current.days.find((day) => day.date === '2026-06-13').chargeNanos, 0);
});
