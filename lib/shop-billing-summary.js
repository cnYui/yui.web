const {
    currentDefaultRmbPrice,
    priceForVersion
} = require('./shop-pricing');
const {
    nanosToCny,
    nonNegativeInteger
} = require('./shop-money');

const chinaOffsetMs = 8 * 60 * 60 * 1000;

function emptyBillingStats() {
    return {
        todayChargeNanos: 0,
        monthChargeNanos: 0,
        todayCacheHitInputTokens: 0,
        todayCacheMissInputTokens: 0,
        todayOutputTokens: 0,
        todayCacheHitInputChargeNanos: 0,
        todayCacheMissInputChargeNanos: 0,
        todayOutputChargeNanos: 0,
        cacheHitInputTokens: 0,
        cacheMissInputTokens: 0,
        outputTokens: 0,
        cacheHitInputChargeNanos: 0,
        cacheMissInputChargeNanos: 0,
        outputChargeNanos: 0,
        todayCustomerSpendingByPhone: new Map(),
        monthCustomerSpendingByPhone: new Map()
    };
}

function emptyCustomerSpending() {
    return {
        chargeNanos: 0,
        cacheHitInputChargeNanos: 0,
        cacheMissInputChargeNanos: 0,
        outputChargeNanos: 0
    };
}

function addCustomerSpending(target, phone, charges) {
    const normalizedPhone = String(phone || '').trim();
    if (!normalizedPhone) return;
    const current = target.get(normalizedPhone) || emptyCustomerSpending();
    target.set(normalizedPhone, {
        chargeNanos: current.chargeNanos + nonNegativeInteger(charges.chargeNanos),
        cacheHitInputChargeNanos: current.cacheHitInputChargeNanos + nonNegativeInteger(charges.cacheHitInputChargeNanos),
        cacheMissInputChargeNanos: current.cacheMissInputChargeNanos + nonNegativeInteger(charges.cacheMissInputChargeNanos),
        outputChargeNanos: current.outputChargeNanos + nonNegativeInteger(charges.outputChargeNanos)
    });
}

function billingPeriodDate(row) {
    const value = row.usage_requested_at || row.requested_at || row.created_at;
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) return date;
    return new Date(row.created_at);
}

function addBillingStats(stats, row, ranges) {
    if (row.status !== 'charged') return;
    const periodDate = billingPeriodDate(row);
    if (!Number.isFinite(periodDate.getTime())) return;
    const chargeNanos = nonNegativeInteger(row.charge_nanos);
    const cacheHitInputTokens = nonNegativeInteger(row.cache_hit_input_tokens);
    const cacheMissInputTokens = nonNegativeInteger(row.cache_miss_input_tokens);
    const outputTokens = nonNegativeInteger(row.output_tokens);
    const price = priceForVersion(row.price_version);
    const cacheHitInputChargeNanos = cacheHitInputTokens * price.cacheHitInputNanosPerToken;
    const cacheMissInputChargeNanos = cacheMissInputTokens * price.cacheMissInputNanosPerToken;
    const outputChargeNanos = outputTokens * price.outputNanosPerToken;
    if (periodDate >= ranges.todayStart) {
        stats.todayChargeNanos += chargeNanos;
        stats.todayCacheHitInputTokens += cacheHitInputTokens;
        stats.todayCacheMissInputTokens += cacheMissInputTokens;
        stats.todayOutputTokens += outputTokens;
        stats.todayCacheHitInputChargeNanos += cacheHitInputChargeNanos;
        stats.todayCacheMissInputChargeNanos += cacheMissInputChargeNanos;
        stats.todayOutputChargeNanos += outputChargeNanos;
        addCustomerSpending(stats.todayCustomerSpendingByPhone, row.phone, {
            chargeNanos,
            cacheHitInputChargeNanos,
            cacheMissInputChargeNanos,
            outputChargeNanos
        });
    }
    if (periodDate >= ranges.monthStart) {
        stats.monthChargeNanos += chargeNanos;
        stats.cacheHitInputTokens += cacheHitInputTokens;
        stats.cacheMissInputTokens += cacheMissInputTokens;
        stats.outputTokens += outputTokens;
        stats.cacheHitInputChargeNanos += cacheHitInputChargeNanos;
        stats.cacheMissInputChargeNanos += cacheMissInputChargeNanos;
        stats.outputChargeNanos += outputChargeNanos;
        addCustomerSpending(stats.monthCustomerSpendingByPhone, row.phone, {
            chargeNanos,
            cacheHitInputChargeNanos,
            cacheMissInputChargeNanos,
            outputChargeNanos
        });
    }
}

function revenueParts(cacheHitInputTokens, cacheHitInputChargeNanos, cacheMissInputTokens, cacheMissInputChargeNanos, outputTokens, outputChargeNanos) {
    const parts = [
        {
            key: 'cache_hit_input',
            label: '缓存命中输入',
            tokens: nonNegativeInteger(cacheHitInputTokens),
            chargeNanos: nonNegativeInteger(cacheHitInputChargeNanos)
        },
        {
            key: 'cache_miss_input',
            label: '缓存未命中输入',
            tokens: nonNegativeInteger(cacheMissInputTokens),
            chargeNanos: nonNegativeInteger(cacheMissInputChargeNanos)
        },
        {
            key: 'output',
            label: '输出 token',
            tokens: nonNegativeInteger(outputTokens),
            chargeNanos: nonNegativeInteger(outputChargeNanos)
        }
    ];
    return parts.map((part) => ({
        ...part,
        chargeAmount: nanosToCny(part.chargeNanos)
    }));
}

function chinaParts(date) {
    const value = new Date(date);
    const shifted = new Date(value.getTime() + chinaOffsetMs);
    return {
        year: shifted.getUTCFullYear(),
        month: shifted.getUTCMonth() + 1,
        day: shifted.getUTCDate()
    };
}

function pad2(value) {
    return String(value).padStart(2, '0');
}

function chinaDateKey(date) {
    const parts = chinaParts(date);
    return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}`;
}

function startOfChinaDay(date) {
    const parts = chinaParts(date);
    return new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - chinaOffsetMs);
}

function startOfChinaWeek(date) {
    const dayStart = startOfChinaDay(date);
    const chinaDay = new Date(dayStart.getTime() + chinaOffsetMs).getUTCDay();
    const mondayOffset = chinaDay === 0 ? 6 : chinaDay - 1;
    return new Date(dayStart.getTime() - mondayOffset * 24 * 60 * 60 * 1000);
}

function chinaDateKeyToDayStart(dateKey) {
    const [year, month, day] = String(dateKey || '').split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day) - chinaOffsetMs);
}

function chinaDateLabel(dateKey) {
    const [, month, day] = String(dateKey || '').split('-').map(Number);
    return `${month}/${day}`;
}

function addSpendingPartCharges(target, row) {
    const cacheHitInputTokens = nonNegativeInteger(row.cache_hit_input_tokens);
    const cacheMissInputTokens = nonNegativeInteger(row.cache_miss_input_tokens);
    const outputTokens = nonNegativeInteger(row.output_tokens);
    const price = priceForVersion(row.price_version);
    target.chargeNanos += nonNegativeInteger(row.charge_nanos);
    target.cacheHitInputTokens += cacheHitInputTokens;
    target.cacheMissInputTokens += cacheMissInputTokens;
    target.outputTokens += outputTokens;
    target.cacheHitInputChargeNanos += cacheHitInputTokens * price.cacheHitInputNanosPerToken;
    target.cacheMissInputChargeNanos += cacheMissInputTokens * price.cacheMissInputNanosPerToken;
    target.outputChargeNanos += outputTokens * price.outputNanosPerToken;
}

function emptyDailySpending(dateKey) {
    return {
        date: dateKey,
        label: chinaDateLabel(dateKey),
        chargeNanos: 0,
        cacheHitInputTokens: 0,
        cacheMissInputTokens: 0,
        outputTokens: 0,
        cacheHitInputChargeNanos: 0,
        cacheMissInputChargeNanos: 0,
        outputChargeNanos: 0
    };
}

function publicDailySpending(day) {
    return {
        date: day.date,
        label: day.label,
        chargeNanos: nonNegativeInteger(day.chargeNanos),
        chargeAmount: nanosToCny(day.chargeNanos),
        parts: revenueParts(
            day.cacheHitInputTokens,
            day.cacheHitInputChargeNanos,
            day.cacheMissInputTokens,
            day.cacheMissInputChargeNanos,
            day.outputTokens,
            day.outputChargeNanos
        )
    };
}

function createWeeklySpendingBucket(weekStartKey) {
    const weekStart = chinaDateKeyToDayStart(weekStartKey);
    const dayMap = new Map();
    const days = Array.from({ length: 7 }, (_, index) => {
        const dateKey = chinaDateKey(new Date(weekStart.getTime() + index * 24 * 60 * 60 * 1000));
        const day = emptyDailySpending(dateKey);
        dayMap.set(dateKey, day);
        return day;
    });
    return {
        weekStart: weekStartKey,
        weekEnd: days[6]?.date || weekStartKey,
        dayMap,
        days
    };
}

function publicWeeklySpendingBucket(week) {
    const days = week.days.map(publicDailySpending);
    const totalChargeNanos = days.reduce((sum, day) => sum + nonNegativeInteger(day.chargeNanos), 0);
    return {
        weekStart: week.weekStart,
        weekEnd: week.weekEnd,
        label: `${chinaDateLabel(week.weekStart)}-${chinaDateLabel(week.weekEnd)}`,
        totalChargeNanos,
        totalChargeAmount: nanosToCny(totalChargeNanos),
        days
    };
}

function buildWeeklySpending(chargeRows, now) {
    const currentWeekStart = chinaDateKey(startOfChinaWeek(now));
    const weeksByStart = new Map();
    const ensureWeek = (weekStartKey) => {
        if (!weeksByStart.has(weekStartKey)) {
            weeksByStart.set(weekStartKey, createWeeklySpendingBucket(weekStartKey));
        }
        return weeksByStart.get(weekStartKey);
    };
    ensureWeek(currentWeekStart);

    for (const row of chargeRows) {
        if (row.status !== 'charged') continue;
        const periodDate = billingPeriodDate(row);
        if (!Number.isFinite(periodDate.getTime())) continue;
        const weekStartKey = chinaDateKey(startOfChinaWeek(periodDate));
        const dayKey = chinaDateKey(periodDate);
        const week = ensureWeek(weekStartKey);
        const day = week.dayMap.get(dayKey);
        if (!day) continue;
        addSpendingPartCharges(day, row);
    }

    const weekStarts = Array.from(weeksByStart.keys()).sort();
    const weeks = {};
    for (const weekStart of weekStarts) {
        weeks[weekStart] = publicWeeklySpendingBucket(weeksByStart.get(weekStart));
    }
    return {
        currentWeekStart,
        weekStarts,
        weeks
    };
}

function customerSpendingParts(spending) {
    return [
        {
            key: 'cache_hit_input',
            label: '缓存命中输入',
            chargeNanos: nonNegativeInteger(spending.cacheHitInputChargeNanos)
        },
        {
            key: 'cache_miss_input',
            label: '缓存未命中输入',
            chargeNanos: nonNegativeInteger(spending.cacheMissInputChargeNanos)
        },
        {
            key: 'output',
            label: '输出 token',
            chargeNanos: nonNegativeInteger(spending.outputChargeNanos)
        }
    ].map((part) => ({
        ...part,
        chargeAmount: nanosToCny(part.chargeNanos)
    }));
}

function customerSpendingRanking(spendingByPhone) {
    return Array.from(spendingByPhone.entries())
        .map(([phone, spending]) => ({
            phone,
            chargeNanos: nonNegativeInteger(spending.chargeNanos),
            chargeAmount: nanosToCny(spending.chargeNanos),
            parts: customerSpendingParts(spending)
        }))
        .sort((left, right) => {
            if (right.chargeNanos !== left.chargeNanos) return right.chargeNanos - left.chargeNanos;
            return left.phone.localeCompare(right.phone);
        });
}

function billingStatsToPublic(stats, chargeRows, options = {}) {
    const publicChargeRecord = options.publicChargeRecord || ((row) => row);
    return {
        priceVersion: currentDefaultRmbPrice.version,
        todayChargeNanos: stats.todayChargeNanos,
        todayChargeAmount: nanosToCny(stats.todayChargeNanos),
        monthChargeNanos: stats.monthChargeNanos,
        monthChargeAmount: nanosToCny(stats.monthChargeNanos),
        todayCacheHitInputTokens: stats.todayCacheHitInputTokens,
        todayCacheMissInputTokens: stats.todayCacheMissInputTokens,
        todayOutputTokens: stats.todayOutputTokens,
        cacheHitInputTokens: stats.cacheHitInputTokens,
        cacheMissInputTokens: stats.cacheMissInputTokens,
        outputTokens: stats.outputTokens,
        todayRevenueParts: revenueParts(
            stats.todayCacheHitInputTokens,
            stats.todayCacheHitInputChargeNanos,
            stats.todayCacheMissInputTokens,
            stats.todayCacheMissInputChargeNanos,
            stats.todayOutputTokens,
            stats.todayOutputChargeNanos
        ),
        monthRevenueParts: revenueParts(
            stats.cacheHitInputTokens,
            stats.cacheHitInputChargeNanos,
            stats.cacheMissInputTokens,
            stats.cacheMissInputChargeNanos,
            stats.outputTokens,
            stats.outputChargeNanos
        ),
        customerSpendingRankings: {
            today: customerSpendingRanking(stats.todayCustomerSpendingByPhone),
            month: customerSpendingRanking(stats.monthCustomerSpendingByPhone)
        },
        recentCharges: chargeRows.map(publicChargeRecord)
    };
}

function buildBillingSummary(chargeRows, ranges, options = {}) {
    const stats = emptyBillingStats();
    for (const row of chargeRows) {
        addBillingStats(stats, row, ranges);
    }
    return billingStatsToPublic(stats, chargeRows, options);
}

module.exports = {
    buildBillingSummary,
    buildWeeklySpending
};
