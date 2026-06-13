const assert = require('node:assert/strict');
const test = require('node:test');

const {
    centsToCny,
    centsToNanos,
    nanosToBalanceCents,
    nanosToCny,
    nonNegativeInteger,
    parsePositiveCnyToCents,
    signedCentsToNanos
} = require('./shop-money');

test('金额工具统一处理 cents、nanos 和人民币展示', () => {
    assert.equal(nonNegativeInteger('12.9'), 12);
    assert.equal(nonNegativeInteger(-1), 0);
    assert.equal(parsePositiveCnyToCents('12.34'), 1234);
    assert.equal(centsToCny(1234), 12.34);
    assert.equal(centsToNanos(123), 1230000000);
    assert.equal(signedCentsToNanos(-123), -1230000000);
    assert.equal(nanosToCny(1500000000), 1.5);
    assert.equal(nanosToBalanceCents(19999999), 1);
    assert.equal(nanosToBalanceCents(-19999999), -2);
});

test('人民币金额解析拒绝非正数和超过两位小数', () => {
    assert.throws(() => parsePositiveCnyToCents('0'), /金额必须大于 0/);
    assert.throws(() => parsePositiveCnyToCents('1.234'), /金额必须是大于 0 的人民币数字/);
});
