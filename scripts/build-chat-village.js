// 生成首页茶叙的徽派村落线稿（两段 inline SVG），写回 index.html：
// scroll-chat-roof 是卡片上方的屋顶村落，scroll-chat-walls 是卡片两侧落到地面的墙线。
// 用法：node scripts/build-chat-village.js [--print]（改了房子的位置、高度就重跑一次）
const fs = require('fs');
const path = require('path');

const W = 620;        // viewBox 宽：预约卡片占中间 60..560，两边各多出 60 让村落伸出去
const H = 132;        // viewBox 高：底边贴着预约卡片的上沿
const CARD = [60, 560];
const r = (n) => Math.round(n * 10) / 10;

// 一座房子：从左到中间的若干段墙（w 宽、top 墙顶高度），右半边镜像。
// 墙顶比相邻段高的那一头是「马头」，压一道瓦顶并向上翘一下。
function house({ x, segs }) {
    const left = segs.map((s) => ({ ...s }));
    const center = left.pop();
    const all = [...left, { w: center.w * 2, top: center.top }, ...left.slice().reverse()];
    let cx = x;
    const parts = all.map((s) => {
        const part = { x1: cx, x2: cx + s.w, top: s.top };
        cx += s.w;
        return part;
    });
    return parts;
}

function wallPath(parts, base) {
    let d = `M${r(parts[0].x1)} ${base}`;
    for (const p of parts) d += ` V${r(p.top)} H${r(p.x2)}`;
    return d + ` V${base} Z`;
}

// 瓦顶：底线贴墙顶，顶线高 5，马头一端出挑 3 并上翘；ticks>0 时画瓦垄。
function caps(parts, { ticks = 0, cap = 6 } = {}) {
    let lines = '';
    let tickD = '';
    parts.forEach((p, i) => {
        const prev = parts[i - 1];
        const next = parts[i + 1];
        const freeL = !prev || prev.top > p.top;   // 左邻更低（y 更大）或没有：左端是马头
        const freeR = !next || next.top > p.top;
        const xl = freeL ? p.x1 - 3 : p.x1;
        const xr = freeR ? p.x2 + 3 : p.x2;
        const yt = p.top - cap;
        lines += `M${r(xl + (freeL ? 4 : 0))} ${r(yt)} H${r(xr - (freeR ? 4 : 0))}`;
        if (freeL) lines += ` M${r(xl + 4)} ${r(yt)} Q${r(xl - 1)} ${r(yt)} ${r(xl - 3)} ${r(yt - 5)}`;
        if (freeR) lines += ` M${r(xr - 4)} ${r(yt)} Q${r(xr + 1)} ${r(yt)} ${r(xr + 3)} ${r(yt - 5)}`;
        lines += ` M${r(xl + 1)} ${r(p.top)} H${r(xr - 1)} `;
        if (ticks) {
            for (let tx = p.x1 + ticks / 2; tx < p.x2 - 1; tx += ticks) tickD += `M${r(tx)} ${r(yt)} V${r(p.top)}`;
        }
    });
    return { lines: lines.trim(), ticks: tickD };
}

function windows(list) {
    return list.map(([x, y, w, h]) => `M${x} ${y} h${w} v${h} h${-w} Z`).join(' ');
}

// 远、中、近三层，越远越淡；前屋就是预约卡片那面白墙。
const far = [
    house({ x: 4, segs: [{ w: 24, top: 58 }, { w: 22, top: 44 }, { w: 34, top: 32 }] }),
    house({ x: 236, segs: [{ w: 24, top: 44 }, { w: 22, top: 30 }, { w: 34, top: 18 }] }),
    house({ x: 446, segs: [{ w: 30, top: 50 }, { w: 26, top: 36 }, { w: 28, top: 26 }] }),
];
const mid = [
    house({ x: 112, segs: [{ w: 26, top: 46 }, { w: 22, top: 58 }, { w: 40, top: 70 }] }),
    house({ x: 330, segs: [{ w: 24, top: 66 }, { w: 22, top: 54 }, { w: 30, top: 42 }] }),
    house({ x: 520, segs: [{ w: 22, top: 56 }, { w: 22, top: 70 }, { w: 34, top: 82 }] }),
    // 贴着预约卡片两侧的两座，墙线一直落到卡片底部
    house({ x: 30, segs: [{ w: 18, top: 74 }, { w: 16, top: 88 }, { w: 14, top: 96 }] }),
    house({ x: 494, segs: [{ w: 18, top: 74 }, { w: 16, top: 88 }, { w: 14, top: 96 }] }),
];
const front = house({ x: CARD[0], segs: [{ w: 34, top: 62 }, { w: 34, top: 80 }, { w: 182, top: 100 }] });

function layer(houses, cls, opts) {
    // 墙脚画到 viewBox 外面，底边那道线被裁掉，墙线才能和下面那段 svg 接上。
    const walls = houses.map((h) => wallPath(h, H + 4)).join(' ');
    const c = houses.map((h) => caps(h, opts));
    return [
        `<path class="${cls}-wall" d="${walls}"/>`,
        `<path class="${cls}-cap" d="${c.map((x) => x.lines).join(' ')}"/>`,
        opts.ticks ? `<path class="${cls}-tick" d="${c.map((x) => x.ticks).join('')}"/>` : '',
    ].filter(Boolean).join('');
}

const frontCaps = caps(front, { ticks: 5 });
const frontEdge = wallPath(front, H + 1).replace(/ Z$/, '');
const svg = [
    `<svg class="scroll-chat-roof" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">`,
    layer(far, 'far', { ticks: 0 }),
    `<path class="far-cap" d="${windows([[262, 64, 6, 8], [472, 70, 5, 7]])}"/>`,
    layer(mid, 'mid', { ticks: 7 }),
    `<path class="mid-cap" d="${windows([[146, 88, 7, 9], [356, 84, 6, 8]])}"/>`,
    `<path class="front-wall" d="${wallPath(front, H + 1)}"/>`,
    `<path class="front-edge" d="${frontEdge}"/>`,
    `<path class="front-tick" d="${frontCaps.ticks}"/>`,
    `<path class="front-cap" d="${frontCaps.lines}"/>`,
    '</svg>',
].join('');

// 预约卡片就是前屋的墙面：前屋两侧墙线、伸出卡片的邻屋外墙，一直画到卡片底部，再压一道地面线。
// 这一块纵向拉伸（preserveAspectRatio="none"），线宽靠 non-scaling-stroke 保持 1px。
function outerWalls(houses) {
    return houses.flatMap((h) => [h[0].x1, h[h.length - 1].x2])
        .filter((x) => (x < CARD[0] || x > CARD[1]) && x >= 0 && x <= W)
        .map((x) => `M${x} 0V100`).join('');
}
const stroke = 'vector-effect="non-scaling-stroke"';
const walls = [
    `<svg class="scroll-chat-walls" viewBox="0 0 ${W} 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">`,
    `<path class="far-line" ${stroke} d="${outerWalls(far)}"/>`,
    `<path class="mid-line" ${stroke} d="${outerWalls(mid)}"/>`,
    `<path class="front-edge" ${stroke} d="M${CARD[0]} 0V100M${CARD[1]} 0V100"/>`,
    `<path class="ground" ${stroke} d="M0 100H${W}"/>`,
    '</svg>',
].join('');

if (process.argv.includes('--print')) {
    console.log(svg + '\n' + walls);
    process.exit(0);
}

const file = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');
const eol = html.includes('\r\n') ? '\r\n' : '\n';
const roofRe = /      <svg class="scroll-chat-roof"[\s\S]*?<\/svg>\r?\n/;
if (!roofRe.test(html)) throw new Error('no roof svg');
html = html.replace(roofRe, '      ' + svg + eol);
const wallsRe = /      <svg class="scroll-chat-walls"[\s\S]*?<\/svg>\r?\n/;
if (wallsRe.test(html)) {
    html = html.replace(wallsRe, '      ' + walls + eol);
} else {
    const win = /(      <div class="scroll-chat-window">\r?\n[\s\S]*?\r?\n      <\/div>\r?\n)/;
    if (!win.test(html)) throw new Error('no chat window');
    html = html.replace(win, '$1      ' + walls + eol);
}
fs.writeFileSync(file, html);
console.log('svg bytes', svg.length + walls.length);
