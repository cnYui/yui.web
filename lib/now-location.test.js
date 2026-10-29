const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createNowLocationStore, verifyBearerToken, parseCoordinate, cleanCity } = require('./now-location');

function tempFile() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yui-now-location-'));
    return path.join(dir, 'data', 'now-location.json');
}

test('坐标四舍五入到 0.1°，文本数字和逗号小数点也收', () => {
    assert.equal(parseCoordinate(34.69374, 90), 34.7);
    assert.equal(parseCoordinate('135.50218', 180), 135.5);
    assert.equal(parseCoordinate('36,06', 90), 36.1);
    assert.equal(parseCoordinate(91, 90), null);
    assert.equal(parseCoordinate('abc', 180), null);
    assert.equal(parseCoordinate('', 180), null);
});

test('城市名去掉控制字符和尖括号，最多 32 个字', () => {
    assert.equal(cleanCity('  大阪市\n'), '大阪市');
    assert.equal(cleanCity('<b>京都</b>'), 'b京都/b');
    assert.equal(cleanCity('长'.repeat(40)).length, 32);
});

test('Bearer 口令比对', () => {
    assert.equal(verifyBearerToken('Bearer secret-token', 'secret-token'), true);
    assert.equal(verifyBearerToken('bearer secret-token', 'secret-token'), true);
    assert.equal(verifyBearerToken('Bearer wrong', 'secret-token'), false);
    assert.equal(verifyBearerToken('secret-token', 'secret-token'), false);
    assert.equal(verifyBearerToken('Bearer secret-token', ''), false);
});

test('写入后只留城市级位置，重启后还能读出来；hidden 会把位置收起来', () => {
    const filePath = tempFile();
    const now = () => new Date('2026-10-29T05:00:00Z');
    const store = createNowLocationStore({ filePath, now });
    assert.deepEqual(store.read(), { city: null });

    const result = store.update({ lat: '34.69374', lon: 135.50218, city: '大阪市' });
    assert.equal(result.ok, true);
    assert.deepEqual(result.view, { city: '大阪市', lat: 34.7, lon: 135.5, updatedAt: '2026-10-29T05:00:00.000Z' });
    assert.doesNotMatch(fs.readFileSync(filePath, 'utf8'), /34\.69|135\.50/, '原始坐标不落盘');

    const reopened = createNowLocationStore({ filePath, now });
    assert.deepEqual(reopened.read(), result.view);

    assert.deepEqual(reopened.update({ hidden: 'true' }).view, { hidden: true, updatedAt: '2026-10-29T05:00:00.000Z' });
    assert.deepEqual(reopened.read(), { hidden: true, updatedAt: '2026-10-29T05:00:00.000Z' });
});

test('缺坐标时拒绝写入，原来的位置保持不变', () => {
    const store = createNowLocationStore({ filePath: tempFile() });
    store.update({ lat: 35, lon: 135, city: '京都' });
    const result = store.update({ city: '没有坐标' });
    assert.equal(result.ok, false);
    assert.equal(result.code, 'INVALID_COORDINATES');
    assert.equal(store.read().city, '京都');
});
