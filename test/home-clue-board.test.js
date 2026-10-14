const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const rootDir = path.join(__dirname, '..');
const readFile = (file) => fs.readFileSync(path.join(rootDir, file), 'utf8');

// clue-board.js 在没有 #clueWall 的页面上什么都不做，只把纯计算挂到 window.YuiClueBoardMath 上。
function loadMath() {
    const context = { window: {}, document: { getElementById: () => null } };
    vm.runInNewContext(readFile('js/clue-board.js'), context);
    return context.window.YuiClueBoardMath;
}

// 墙上能拖、能连线的纸：选择器 → 它在 index.html 里的 class。
const ITEMS = {
    '.cw-card--about': 'cw-card cw-card--about',
    '.cw-bizcard': 'cw-bizcard',
    '.cw-card--shop': 'cw-card cw-card--shop',
    '.cw-card--projects': 'cw-card cw-card--projects',
    '.cw-card--blog': 'cw-card cw-card--blog',
    '.cw-card--map': 'cw-card cw-card--map',
    '.cw-polaroid': 'cw-polaroid',
    '.cw-card--resume': 'cw-card cw-card--resume',
    '.cw-github': 'cw-github'
};

function openingTag(html, className) {
    const match = new RegExp(`<div class="${className}"[^>]*>`).exec(html);
    assert.ok(match, `index.html 里找不到 <div class="${className}">`);
    return match[0];
}

test('墙上不再有肖像卡，个人介绍只剩「关于我」一个入口', () => {
    const html = readFile('index.html');
    const css = readFile('styles/clue-wall.css');
    const script = readFile('js/clue-wall.js');
    const wall = html.slice(html.indexOf('class="cw-cork"'), html.indexOf('class="cw-face cw-desk"'));

    assert.ok(!wall.includes('portrait'), '软木板上还有肖像的残留');
    assert.ok(!/cw-portrait|cw-card--portrait/.test(css), '样式里还有肖像卡的残留');
    assert.ok(!/aboutPortrait|wall\.portrait/.test(script + html + readFile('js/clue-i18n.js')), '脚本、词典或页面里还有肖像卡的残留');
    // 肖像照片本身还在「关于我」档案里，只是不再单独占墙上一张卡。
    assert.match(html, /<section class="cw-file cw-file--about"[\s\S]*?portrait-compressed\.webp/);
});

test('红线和图钉不再写死在页面里，都交给 clue-board.js 生成', () => {
    const html = readFile('index.html');
    const wall = html.slice(html.indexOf('class="cw-cork"'), html.indexOf('class="cw-face cw-desk"'));

    assert.ok(!/<span class="cw-pin /.test(wall), '软木板上不该再有写死的图钉');
    const svg = /<svg class="cw-strings"[\s\S]*?<\/svg>/.exec(wall);
    assert.ok(svg, '缺少 .cw-strings');
    assert.ok(!/<path d=/.test(svg[0]), '页面里不该再有写死的红线');
    assert.match(svg[0], /class="cw-strings-shadow"/);
    assert.match(svg[0], /class="cw-strings-red"/);
    assert.match(svg[0], /class="cw-strings-preview"/);
    assert.match(wall, /<div class="cw-pins" id="cwPins"/);

    // 脚本放在 clue-wall.js 之后，同样 defer，不能内联（CSP 是 script-src 'self'）。
    assert.match(html, /<script src="\/js\/clue-board\.js\?v=[^"]+" defer><\/script>/);
    assert.ok(html.indexOf('/js/clue-wall.js') < html.indexOf('/js/clue-board.js'), 'clue-board.js 要在 clue-wall.js 之后加载');
});

test('每张能拖的纸都写了图钉，倾角和样式里的 rotate 一致，图钉位置才算得对', () => {
    const html = readFile('index.html');
    const css = readFile('styles/clue-wall.css');
    const { parsePins } = loadMath();

    for (const [selector, className] of Object.entries(ITEMS)) {
        const tag = openingTag(html, className);
        const pins = /data-pins="([^"]+)"/.exec(tag);
        const tilt = /data-tilt="(-?[\d.]+)"/.exec(tag);
        assert.ok(pins, `${selector} 没有 data-pins`);
        assert.ok(tilt, `${selector} 没有 data-tilt`);
        assert.ok(parsePins(pins[1]).length > 0);

        const rule = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{[^}]*\\}`).exec(css);
        assert.ok(rule, `样式里找不到 ${selector}`);
        const rotate = /transform:\s*rotate\((-?[\d.]+)deg\)/.exec(rule[0]);
        assert.ok(rotate, `${selector} 的 transform 不是单纯的 rotate`);
        assert.equal(Number(tilt[1]), Number(rotate[1]), `${selector} 的 data-tilt 和样式里的 rotate 不一致`);
    }

    // 只有墙上点得开的便签带 data-section，名片、拍立得、贡献图只拖不开。
    for (const className of ['cw-bizcard', 'cw-polaroid', 'cw-github']) {
        const tag = openingTag(html, className);
        assert.ok(!/data-section|role="button"|tabindex/.test(tag), `${className} 不该是可点开的便签`);
    }
});

test('贡献图的图钉要等数据到达才出现，样式里数据到达后才接收指针', () => {
    const html = readFile('index.html');
    const css = readFile('styles/clue-wall.css');

    assert.match(openingTag(html, 'cw-github'), /data-pin-ready="is-ready"/);
    assert.match(css, /\.cw-github\.is-ready\s*\{[^}]*pointer-events:\s*auto/);
    assert.match(css, /\.cw-pins \.cw-pin\.is-off\s*\{[^}]*pointer-events:\s*none/);
});

test('data-pins 的写法：颜色、可选的位置，负数从右边量起', () => {
    const math = loadMath();
    // 对象是在 vm 里造的，原型不是本上下文的 Object.prototype，先规整成普通对象再比。
    const parsePins = (text) => JSON.parse(JSON.stringify(math.parsePins(text)));

    assert.deepEqual(parsePins('red'), [{ tone: 'red', x: null, y: 18 }]);
    assert.deepEqual(parsePins('gold'), [{ tone: 'gold', x: null, y: 18 }]);
    assert.deepEqual(parsePins('blue:15,15 blue:-15,15'), [{ tone: 'blue', x: 15, y: 15 }, { tone: 'blue', x: -15, y: 15 }]);
    // 写错颜色退回红色，缺省或写坏的位置退回上边正中间，什么都不写也至少有一枚。
    assert.deepEqual(parsePins('green'), [{ tone: 'red', x: null, y: 18 }]);
    assert.deepEqual(parsePins('red:oops'), [{ tone: 'red', x: null, y: 18 }]);
    assert.deepEqual(parsePins(''), [{ tone: 'red', x: null, y: 18 }]);
    assert.deepEqual(parsePins(undefined), [{ tone: 'red', x: null, y: 18 }]);
});

test('图钉随纸的位置和倾角走：不倾斜时就是纸上的偏移，倾斜时绕纸的中心转', () => {
    const { pinPoint } = loadMath();
    const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}：${actual} ≠ ${expected}`);

    // 不倾斜：上边正中间 18px 处。
    let point = pinPoint({ left: 100, top: 50, w: 200, h: 100, tilt: 0 }, { x: null, y: 18 });
    near(point.x, 200, 'x');
    near(point.y, 68, 'y');

    // 负数从右边量起。
    point = pinPoint({ left: 100, top: 50, w: 200, h: 100, tilt: 0 }, { x: -15, y: 15 });
    near(point.x, 285, 'x');
    near(point.y, 65, 'y');

    // 顺时针转 90°：纸中心在 (200, 100)，原来在中心正上方 32px 的图钉转到中心正右方 32px。
    point = pinPoint({ left: 100, top: 50, w: 200, h: 100, tilt: 90 }, { x: null, y: 18 });
    near(point.x, 232, 'x');
    near(point.y, 100, 'y');

    // 纸挪到别处，图钉整体平移同样的距离。
    const moved = pinPoint({ left: 130, top: 90, w: 200, h: 100, tilt: 4 }, { x: null, y: 18 });
    const origin = pinPoint({ left: 100, top: 50, w: 200, h: 100, tilt: 4 }, { x: null, y: 18 });
    near(moved.x - origin.x, 30, 'dx');
    near(moved.y - origin.y, 40, 'dy');
});

test('红线是一根下垂的曲线，端点就是两枚图钉', () => {
    const { stringPath } = loadMath();

    const short = stringPath({ x: 0, y: 0 }, { x: 100, y: 0 });
    assert.equal(short, 'M0 0 Q50 18 100 0');
    // 垂得再多也不超过 46px：控制点最多往下 92px。
    const long = stringPath({ x: 0, y: 0 }, { x: 1600, y: 0 });
    assert.equal(long, 'M0 0 Q800 92 1600 0');
    // 方向反过来，线还是接在同样的两个点上。
    assert.match(stringPath({ x: 100, y: 0 }, { x: 0, y: 0 }), /^M100 0 Q.* 0 0$/);
});

test('屏幕坐标换算回软木板坐标：透视之下也是精确的', () => {
    const { solveHomography, applyHomography } = loadMath();
    const corners = [[0, 0], [1700, 0], [1700, 880], [0, 880]];

    // 一个带明显透视的「软木板 → 屏幕」变换（右边比左边小，像镜头转了 20° 的样子）。
    const forward = ([u, v]) => {
        const w = 0.00018 * u - 0.00006 * v + 1;
        return [(0.5 * u + 0.08 * v + 30) / w, (-0.04 * u + 0.46 * v + 24) / w];
    };
    const screen = corners.map(forward);
    const h = solveHomography(screen, corners);
    assert.ok(h, '矩阵不该退化');

    for (const probe of [[850, 440], [120, 700], [1555, 90], [3, 877]]) {
        const [x, y] = forward(probe);
        const back = applyHomography(h, x, y);
        assert.ok(Math.abs(back.x - probe[0]) < 1e-6 && Math.abs(back.y - probe[1]) < 1e-6, `${probe} 换算回来是 ${back.x}, ${back.y}`);
    }

    // 四个点在屏幕上共线（镜头把软木板压成一条线）时解不出来，要返回 null 而不是 NaN。
    assert.equal(solveHomography([[0, 0], [10, 10], [20, 20], [30, 30]], corners), null);
});
