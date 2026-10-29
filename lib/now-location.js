const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// 行旅页「此刻」：iPhone 快捷指令把当前位置 POST 到 /travel/now，页面 GET 同一路径读出来。
// 只公开到城市级：坐标写盘前就四舍五入到 0.1°（约十公里），原始坐标不落盘、不进日志。
// 路径挂在 /travel/ 下，是因为 cloudflared 只把固定几个前缀转给本服务，/api/ 会落到 Sub2API。

const CITY_MAX_LENGTH = 32;

function digest(value) {
    return crypto.createHash('sha256').update(String(value), 'utf8').digest();
}

// 先摘要再比对，长度固定，timingSafeEqual 不会抛错，也不泄漏口令长度。
function verifyBearerToken(header, expected) {
    const match = /^Bearer\s+(\S+)\s*$/i.exec(String(header || ''));
    if (!match || !expected) return false;
    return crypto.timingSafeEqual(digest(match[1]), digest(expected));
}

// 快捷指令里的数字可能是数字，也可能是文本（个别地区用逗号作小数点）。
function parseCoordinate(value, limit) {
    if (value === null || value === undefined || value === '') return null;
    const number = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
    if (!Number.isFinite(number) || Math.abs(number) > limit) return null;
    return Math.round(number * 10) / 10;
}

function cleanCity(value) {
    return String(value ?? '').replace(/[\x00-\x1f\x7f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, CITY_MAX_LENGTH);
}

function isTrue(value) {
    return value === true || String(value).trim().toLowerCase() === 'true';
}

function publicView(entry) {
    if (!entry) return { city: null };
    if (entry.hidden) return { hidden: true, updatedAt: entry.updatedAt };
    return { city: entry.city, lat: entry.lat, lon: entry.lon, updatedAt: entry.updatedAt };
}

function createNowLocationStore({ filePath, now = () => new Date() }) {
    let cached;

    function load() {
        if (cached !== undefined) return cached;
        try {
            const entry = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            cached = entry && typeof entry.updatedAt === 'string' ? entry : null;
        } catch (error) {
            cached = null;
        }
        return cached;
    }

    // 先写临时文件再改名，进程中途退出也不会留下半截 JSON。
    function save(entry) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        const temp = `${filePath}.tmp`;
        fs.writeFileSync(temp, JSON.stringify(entry));
        fs.renameSync(temp, filePath);
        cached = entry;
    }

    function update(body = {}) {
        const updatedAt = now().toISOString();
        if (isTrue(body.hidden)) {
            save({ hidden: true, updatedAt });
            return { ok: true, view: publicView(cached) };
        }
        const lat = parseCoordinate(body.lat ?? body.latitude, 90);
        const lon = parseCoordinate(body.lon ?? body.lng ?? body.longitude, 180);
        if (lat === null || lon === null) {
            return { ok: false, code: 'INVALID_COORDINATES', message: 'lat / lon 必须是有效的经纬度。' };
        }
        save({ city: cleanCity(body.city), lat, lon, updatedAt });
        return { ok: true, view: publicView(cached) };
    }

    return {
        read: () => publicView(load()),
        update
    };
}

module.exports = {
    createNowLocationStore,
    verifyBearerToken,
    parseCoordinate,
    cleanCity
};
