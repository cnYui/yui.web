const nanosPerYuan = 1000000000;
const nanosPerCent = 10000000;

function nonNegativeInteger(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.floor(number);
}

function parsePositiveCnyToCents(value) {
    const text = String(value ?? '').trim();
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
        const error = new Error('金额必须是大于 0 的人民币数字，最多保留两位小数。');
        error.status = 400;
        error.code = 'INVALID_AMOUNT';
        throw error;
    }
    const [yuanPart, centPart = ''] = text.split('.');
    const cents = Number(yuanPart) * 100 + Number(centPart.padEnd(2, '0'));
    if (!Number.isSafeInteger(cents) || cents <= 0) {
        const error = new Error('金额必须大于 0。');
        error.status = 400;
        error.code = 'INVALID_AMOUNT';
        throw error;
    }
    return cents;
}

function centsToCny(cents) {
    return Number(cents || 0) / 100;
}

function centsToNanos(cents) {
    return nonNegativeInteger(cents) * nanosPerCent;
}

function signedCentsToNanos(cents) {
    const value = Number(cents || 0);
    if (!Number.isSafeInteger(value)) return 0;
    return value * nanosPerCent;
}

function nanosToCny(nanos) {
    return Number(nanos || 0) / nanosPerYuan;
}

function nanosToBalanceCents(nanos) {
    const value = Number(nanos || 0);
    if (value >= 0) return Math.floor(value / nanosPerCent);
    return -Math.ceil(Math.abs(value) / nanosPerCent);
}

function chargeNanosToCents(nanos) {
    const value = nonNegativeInteger(nanos);
    return value <= 0 ? 0 : Math.ceil(value / nanosPerCent);
}

module.exports = {
    centsToCny,
    centsToNanos,
    chargeNanosToCents,
    nanosPerCent,
    nanosPerYuan,
    nanosToBalanceCents,
    nanosToCny,
    nonNegativeInteger,
    parsePositiveCnyToCents,
    signedCentsToNanos
};
