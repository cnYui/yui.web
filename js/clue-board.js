// 首页线索墙的软木板互动：墙上每张纸（便签、名片、拍立得、GitHub 贡献图）都能按住拖到别处，
// 图钉跟着一起走；点一枚图钉再点另一枚不同的图钉，两枚之间就拉起一根红线，再点一次同一对剪断。
// 点便签仍是打开档案（js/clue-wall.js），只有按住并挪动超过几像素才算拖动。
// 墙面是被 3D 镜头拍着的，屏幕上的位移不能直接当成软木板上的位移：这里在软木板四个角各放一个看不见的探针，
// 用它们在屏幕上的位置解出一个单应矩阵（透视变换），把指针换算回 1700 × 880 的软木板坐标。
(function () {
    const BOARD_WIDTH = 1700;
    const BOARD_HEIGHT = 880;
    // 按住挪动超过这个屏幕距离（像素）才算拖动，之内都算点击。
    const DRAG_THRESHOLD = 6;
    // 拖到板边时留的余量，纸稍微倾斜也不会探出软木板。
    const EDGE = 4;
    const DEFAULT_PIN_TOP = 18;
    const PIN_TONES = ['red', 'blue', 'gold'];
    const Z_START = 10;
    // 红线和图钉层的 z-index 是 900 / 901（见 styles/clue-wall.css），纸叠得再高也不能越过它们。
    const Z_LIMIT = 800;
    const SVG_NS = 'http://www.w3.org/2000/svg';

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const round = (value) => Math.round(value * 10) / 10;

    // ---- 纯计算（也挂在 window.YuiClueBoardMath 上，给测试用）----

    // data-pins 的写法：空格分隔的若干枚图钉，每枚是「颜色」或「颜色:左,上」。
    // 左为负数时从纸的右边量起；不写位置就钉在上边正中间。
    function parsePins(text) {
        const pins = String(text || '').split(/\s+/).filter(Boolean).map((token) => {
            const [name, at] = token.split(':');
            const tone = PIN_TONES.includes(name) ? name : 'red';
            if (!at) return { tone, x: null, y: DEFAULT_PIN_TOP };
            const [x, y] = at.split(',').map(Number);
            return { tone, x: Number.isFinite(x) ? x : null, y: Number.isFinite(y) ? y : DEFAULT_PIN_TOP };
        });
        return pins.length ? pins : [{ tone: 'red', x: null, y: DEFAULT_PIN_TOP }];
    }

    // 纸（left/top/w/h，绕自己的中心倾斜 tilt 度）上某枚图钉在软木板上的位置。
    function pinPoint(box, spot) {
        const local = spot.x === null ? box.w / 2 : (spot.x < 0 ? box.w + spot.x : spot.x);
        const dx = local - box.w / 2;
        const dy = spot.y - box.h / 2;
        const angle = box.tilt * Math.PI / 180;
        return {
            x: box.left + box.w / 2 + dx * Math.cos(angle) - dy * Math.sin(angle),
            y: box.top + box.h / 2 + dx * Math.sin(angle) + dy * Math.cos(angle)
        };
    }

    // 两枚图钉之间的红线：一根自然下垂的线，越长垂得越多，但最多垂 46 像素。
    function stringPath(a, b) {
        const droop = Math.min(46, Math.hypot(b.x - a.x, b.y - a.y) * 0.09);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2 + droop * 2;
        return `M${round(a.x)} ${round(a.y)} Q${round(cx)} ${round(cy)} ${round(b.x)} ${round(b.y)}`;
    }

    // 四组对应点（src → dst）解出单应矩阵 h0…h7，u = (h0x+h1y+h2)/(h6x+h7y+1)，v = (h3x+h4y+h5)/(h6x+h7y+1)。
    function solveHomography(src, dst) {
        const m = [];
        for (let i = 0; i < 4; i++) {
            const [x, y] = src[i];
            const [u, v] = dst[i];
            m.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
            m.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
        }
        for (let col = 0; col < 8; col++) {
            let pivot = col;
            for (let row = col + 1; row < 8; row++) {
                if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
            }
            if (Math.abs(m[pivot][col]) < 1e-12) return null;
            [m[col], m[pivot]] = [m[pivot], m[col]];
            for (let row = 0; row < 8; row++) {
                if (row === col) continue;
                const factor = m[row][col] / m[col][col];
                for (let k = col; k < 9; k++) m[row][k] -= factor * m[col][k];
            }
        }
        return m.map((row, i) => row[8] / row[i]);
    }

    function applyHomography(h, x, y) {
        const w = h[6] * x + h[7] * y + 1;
        return { x: (h[0] * x + h[1] * y + h[2]) / w, y: (h[3] * x + h[4] * y + h[5]) / w };
    }

    window.YuiClueBoardMath = { parsePins, pinPoint, stringPath, solveHomography, applyHomography };

    // ---- 软木板 ----

    const root = document.getElementById('clueWall');
    const scene = document.getElementById('cwScene');
    const drift = document.getElementById('cwDrift');
    const pinsLayer = document.getElementById('cwPins');
    const cork = root && root.querySelector('.cw-cork');
    const strings = cork && cork.querySelector('.cw-strings');
    if (!root || !scene || !pinsLayer || !strings) return;
    const shadowGroup = strings.querySelector('.cw-strings-shadow');
    const redGroup = strings.querySelector('.cw-strings-red');
    const preview = strings.querySelector('.cw-strings-preview');
    if (!shadowGroup || !redGroup) return;

    const pinByElement = new Map();
    const links = [];
    let selected = null;
    let press = null;          // 按下还没松开的那一次：{ item, id, x, y, grabX, grabY, active }
    let suppressClick = false; // 刚拖完的那一下松手会补发一个 click，不能让它打开便签
    let frame = 0;
    let hover = null;          // 虚线的另一头：选中图钉之后指针在软木板上的位置 { x, y }
    let pointer = null;        // 指针在屏幕上的位置 { cx, cy }，等下一帧再换算成 hover
    let hoverFrame = 0;
    let downAt = null;
    let topZ = Z_START;

    // 四个探针：软木板的四个角，屏幕上的位置会随镜头、漂移和窗口大小变，所以每次用的时候现量。
    const probes = [[0, 0], [BOARD_WIDTH, 0], [BOARD_WIDTH, BOARD_HEIGHT], [0, BOARD_HEIGHT]].map(([x, y]) => {
        const el = document.createElement('i');
        el.className = 'cw-probe';
        el.style.left = `${x - 1}px`;
        el.style.top = `${y - 1}px`;
        cork.appendChild(el);
        return { el, x, y };
    });

    // 返回「屏幕坐标 → 软木板坐标」的换算函数；镜头被挡住或矩阵退化时返回 null。
    function boardMapper() {
        const src = probes.map(({ el }) => {
            const box = el.getBoundingClientRect();
            return [box.left + box.width / 2, box.top + box.height / 2];
        });
        const h = solveHomography(src, probes.map(({ x, y }) => [x, y]));
        return h ? (cx, cy) => applyHomography(h, cx, cy) : null;
    }

    const items = Array.from(cork.querySelectorAll('[data-pins]')).map((el) => {
        const item = {
            el,
            left: el.offsetLeft,
            top: el.offsetTop,
            tilt: parseFloat(el.dataset.tilt) || 0,
            ready: el.dataset.pinReady || '',
            pins: []
        };
        parsePins(el.dataset.pins).forEach((spot) => {
            const pinEl = document.createElement('span');
            pinEl.className = `cw-pin cw-pin--${spot.tone}`;
            pinsLayer.appendChild(pinEl);
            const pin = { el: pinEl, item, spot, x: 0, y: 0 };
            pinByElement.set(pinEl, pin);
            item.pins.push(pin);
        });
        return item;
    });

    function drawLink(link) {
        const d = stringPath(link.a, link.b);
        link.shadow.setAttribute('d', d);
        link.red.setAttribute('d', d);
    }

    // 纸挪了（或大小变了）：图钉按纸现在的位置重新算，连着它们的红线跟着重画。
    function layoutItem(item) {
        const box = { left: item.left, top: item.top, w: item.el.offsetWidth, h: item.el.offsetHeight, tilt: item.tilt };
        item.pins.forEach((pin) => {
            const point = pinPoint(box, pin.spot);
            pin.x = point.x;
            pin.y = point.y;
            pin.el.style.left = `${round(point.x)}px`;
            pin.el.style.top = `${round(point.y)}px`;
        });
        links.forEach((link) => {
            if (link.a.item === item || link.b.item === item) drawLink(link);
        });
        if (selected && selected.item === item) drawPreview();
    }

    function layoutAll() { items.forEach(layoutItem); }

    // 贡献图这类要等数据的纸：数据没到之前它是透明的，图钉也不该单独悬在墙上。
    function syncReady(item) {
        const shown = !item.ready || item.el.classList.contains(item.ready);
        item.pins.forEach((pin) => pin.el.classList.toggle('is-off', !shown));
    }

    // ---- 红线 ----

    function findLink(a, b) {
        return links.find((link) => (link.a === a && link.b === b) || (link.a === b && link.b === a));
    }

    function toggleLink(a, b) {
        const existing = findLink(a, b);
        if (existing) {
            existing.shadow.remove();
            existing.red.remove();
            links.splice(links.indexOf(existing), 1);
            return;
        }
        const link = { a, b, shadow: document.createElementNS(SVG_NS, 'path'), red: document.createElementNS(SVG_NS, 'path') };
        shadowGroup.appendChild(link.shadow);
        redGroup.appendChild(link.red);
        links.push(link);
        drawLink(link);
    }

    // 选中的第一枚图钉：放大并亮一圈，同时从它拉一根虚线到指针，提示「再点另一枚」。
    function select(pin) {
        if (selected) selected.el.classList.remove('is-selected');
        selected = pin;
        if (pin) pin.el.classList.add('is-selected');
        // 刚选中时指针就压在这枚图钉上，虚线长度为零，等指针一动才拉出来。
        hover = pin ? { x: pin.x, y: pin.y } : null;
        drawPreview();
    }

    function drawPreview() {
        if (!preview) return;
        if (!selected || !hover) { preview.removeAttribute('d'); return; }
        preview.setAttribute('d', `M${round(selected.x)} ${round(selected.y)} L${round(hover.x)} ${round(hover.y)}`);
    }

    function onPinClick(pin) {
        if (!selected) { select(pin); return; }
        if (selected === pin) { select(null); return; }
        toggleLink(selected, pin);
        select(null);
    }

    // 指针在墙上移动时更新那根虚线（节流到每帧一次）。
    function trackHover(event) {
        if (!selected) return;
        pointer = { cx: event.clientX, cy: event.clientY };
        if (hoverFrame) return;
        hoverFrame = requestAnimationFrame(() => {
            hoverFrame = 0;
            const map = selected && pointer && boardMapper();
            if (!map) return;
            hover = map(pointer.cx, pointer.cy);
            drawPreview();
        });
    }

    // ---- 拖动 ----

    // 把拖动的纸叠到最上面。z-index 只升不降，涨到上限时按现有顺序重新编号。
    function raise(item) {
        topZ += 1;
        if (topZ > Z_LIMIT) {
            items.slice().sort((a, b) => (Number(a.el.style.zIndex) || 0) - (Number(b.el.style.zIndex) || 0))
                .forEach((entry, index) => { entry.el.style.zIndex = String(Z_START + 1 + index); });
            topZ = Z_START + items.length + 1;
        }
        item.el.style.zIndex = String(topZ);
    }

    function moveItem(item, left, top) {
        const w = item.el.offsetWidth;
        const h = item.el.offsetHeight;
        item.left = clamp(left, EDGE, BOARD_WIDTH - w - EDGE);
        item.top = clamp(top, EDGE, BOARD_HEIGHT - h - EDGE);
        item.el.style.left = `${round(item.left)}px`;
        item.el.style.top = `${round(item.top)}px`;
        layoutItem(item);
    }

    function startHold(current) {
        current.active = true;
        raise(current.item);
        current.item.el.classList.add('is-held');
        scene.classList.add('is-holding');
        // 镜头的缓慢漂移先停住，免得纸在指针下面慢慢滑。
        if (drift) drift.classList.add('is-paused');
    }

    function endHold(current) {
        current.item.el.classList.remove('is-held');
        scene.classList.remove('is-holding');
        if (drift) drift.classList.remove('is-paused');
    }

    function step() {
        frame = 0;
        if (!press || !press.active) return;
        const map = boardMapper();
        if (!map) return;
        const point = map(press.x, press.y);
        moveItem(press.item, point.x - press.grabX, point.y - press.grabY);
    }

    function onPointerMove(event) {
        if (!press || event.pointerId !== press.id) return;
        press.x = event.clientX;
        press.y = event.clientY;
        if (!press.active && Math.hypot(press.x - press.startX, press.y - press.startY) > DRAG_THRESHOLD) startHold(press);
        if (press.active && !frame) frame = requestAnimationFrame(step);
    }

    // 结束这一次按下。commit 为真时（正常松手）把最后一次位置也落实，并拦住随后补发的 click；
    // 为假时（被新的按下顶替、窗口失焦）纸就留在最后画出的位置。
    function finishPress(commit) {
        const current = press;
        if (!current) return;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        press = null;
        if (frame) { cancelAnimationFrame(frame); frame = 0; }
        if (!current.active) return;
        if (commit) {
            const map = boardMapper();
            if (map) {
                const point = map(current.x, current.y);
                moveItem(current.item, point.x - current.grabX, point.y - current.grabY);
            }
        }
        endHold(current);
        if (commit) {
            suppressClick = true;
            setTimeout(() => { suppressClick = false; }, 0);
        }
    }

    function onPointerUp(event) {
        if (press && event.pointerId === press.id) finishPress(true);
    }

    function onPointerDown(event) {
        downAt = { x: event.clientX, y: event.clientY };
        // 上一次按下的松手事件丢了（比如在窗口外松开）：同一个指针再次按下，说明上一次早就结束了，直接收尾。
        if (press && press.id === event.pointerId) finishPress(false);
        if (scene.inert || press || event.isPrimary === false || (event.button !== undefined && event.button !== 0)) return;
        const target = event.target;
        if (!target || !target.closest) return;
        const pinEl = target.closest('.cw-pins .cw-pin');
        const pin = pinEl ? pinByElement.get(pinEl) : null;
        const itemEl = target.closest('[data-pins]');
        const item = pin ? pin.item : items.find((entry) => entry.el === itemEl);
        // 按在空处：交给 js/clue-wall.js 的拖动环视。
        if (!item) return;
        const map = boardMapper();
        if (!map) return;
        const point = map(event.clientX, event.clientY);
        // 这次按下归纸（或图钉）了，不再触发环视。
        event.stopPropagation();
        press = {
            item,
            id: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            x: event.clientX,
            y: event.clientY,
            grabX: point.x - item.left,
            grabY: point.y - item.top,
            active: false
        };
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
    }

    // 在捕获阶段先看 click：刚拖完的松手不能打开便签；点在图钉上是选图钉；点在别处（没拖动）取消选中。
    function onClick(event) {
        if (suppressClick) {
            event.stopPropagation();
            event.preventDefault();
            return;
        }
        const pinEl = event.target.closest && event.target.closest('.cw-pins .cw-pin');
        if (pinEl) {
            event.stopPropagation();
            const pin = pinByElement.get(pinEl);
            if (pin) onPinClick(pin);
            return;
        }
        if (selected && (!downAt || Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y) <= DRAG_THRESHOLD)) select(null);
    }

    // ---- 启动 ----

    layoutAll();
    items.forEach(syncReady);
    items.filter((item) => item.ready).forEach((item) => {
        if (window.MutationObserver) new MutationObserver(() => syncReady(item)).observe(item.el, { attributes: true, attributeFilter: ['class'] });
    });
    // 字体加载、换语言之后纸的高度会变，图钉要跟着重新算。
    if (window.ResizeObserver) {
        const observer = new ResizeObserver(layoutAll);
        items.forEach((item) => observer.observe(item.el));
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(layoutAll);
    window.addEventListener('yui-clue-lang', layoutAll);

    scene.addEventListener('pointerdown', onPointerDown, true);
    scene.addEventListener('pointermove', trackHover);
    scene.addEventListener('click', onClick, true);
    window.addEventListener('keydown', (event) => { if (event.key === 'Escape') select(null); });
    window.addEventListener('blur', () => finishPress(false));
})();
