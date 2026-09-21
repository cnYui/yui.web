// 首页线索墙（侦探书房）v2：拖动环视，点击便签后一只手把它从墙上取下来、放到桌面上摊开细看。
// 设计稿：Claude Design「侦探线索墙个人主页」Clue Wall Study v2。墙面按 1440 × 900 排版，
// 桌上的档案按 1280 × 760 排版，这里按视口算出缩放系数 k，再把 js/clue-data.js 的数据渲染进去。
// 打开档案会写入 #about / #projects / #blog / #resume / #travel / #shop，可直接分享，返回键或 ESC 关闭。
// 窄屏与「减少动态效果」下跳过取件动画，档案直接铺满屏幕滚动。
(function () {
    const root = document.getElementById('clueWall');
    if (!root) return;

    const DESIGN_WIDTH = 1440;
    const DESIGN_HEIGHT = 900;
    const SHEET_WIDTH = 1280;
    const SHEET_HEIGHT = 760;

    // 取件动画里手经过的阶段：DESK 表示镜头已经压到桌面，HIDDEN 表示墙上那张便签要先藏起来，
    // CARRY 表示手里正举着封面。
    const DESK_PHASES = ['carry', 'land', 'open', 'closing', 'grab2'];
    const HIDDEN_PHASES = ['grab', 'carry', 'land', 'open', 'closing', 'grab2', 'return'];
    const CARRY_PHASES = ['grab', 'carry', 'grab2', 'return'];
    const DESK_TILT = 64;
    const PINCH = { ax: -0.15, ay: 0.38 };

    const FILE_LABELS = {
        about: 'FILE 01 / 06', projects: 'FILE 02 / 06', blog: 'FILE 03 / 06',
        resume: 'FILE 04 / 06', travel: 'FILE 05 / 06', shop: 'FILE 06 / 06'
    };
    const CAT_LABELS = { award: '获奖 AWARD', hackathon: '黑客松 HACKATHON', meetup: '聚会 MEETUP', project: '项目 PROJECT' };
    // 手里举着的封面长什么样，取决于被取下来的是哪张便签，而不只是哪个档案。
    const COVERS = {
        about: { file: 'FILE 01 · 关于我', title: '谁是悠一？', sub: 'WHO IS YUI?', bg: 'linear-gradient(135deg,#cfae7c,#bb955f 55%,#caa877)', fg: '#2a1d12' },
        aboutPortrait: { file: 'FILE 01 · 关于我', title: '主角 · 悠一 Yui', sub: 'SUBJECT · AI NATIVE DEVELOPER', bg: '#f2ede2', fg: '#2a1d12' },
        projects: { file: 'FILE 02 · 项目', title: '案件时间线', sub: 'CASE TIMELINE', bg: '#f2ede2', fg: '#2a1d12' },
        blog: { file: 'FILE 03 · 博客', title: '笔记 · Field Notes', sub: '6 ENTRIES', bg: '#efe6d0', fg: '#2a1d12' },
        resume: { file: 'FILE 04 · 履历', title: '身份档案', sub: 'DOSSIER · CONFIDENTIAL', bg: 'linear-gradient(180deg,#f4efe3,#e9e1cf)', fg: '#2a1d12' },
        travel: { file: 'FILE 05 · 旅行', title: '行踪图', sub: 'TRAVEL LOG', bg: '#e8dcc0', fg: '#2a1d12' },
        travelPhoto: { file: 'FILE 05 · 旅行', title: '照片 · 行踪', sub: '60+ PHOTOS', bg: '#f2ede2', fg: '#2a1d12' },
        shop: { file: 'FILE 06 · 商店', title: '天才程序员中转站', sub: 'CODE TRANSIT · SUB2API', bg: '#1a1512', fg: '#f2e8d0' }
    };

    const scene = document.getElementById('cwScene');
    const stage = document.getElementById('cwStage');
    const cam = document.getElementById('cwCam');
    const drift = document.getElementById('cwDrift');
    const dim = document.getElementById('cwDim');
    const hint = document.getElementById('cwHint');
    const soundButton = document.getElementById('cwSound');
    const soundState = document.getElementById('cwSoundState');
    const sheet = document.getElementById('cwSheet');
    const sheetInner = document.getElementById('cwSheetInner');
    const backButton = document.getElementById('cwBack');
    const fileLabel = document.getElementById('cwFileLabel');
    const handBack = document.getElementById('cwHandBack');
    const handFront = document.getElementById('cwHandFront');
    const fingers = document.getElementById('cwFingers');
    const thumb = document.getElementById('cwThumb');
    const carried = document.getElementById('cwCarried');
    const coverFile = document.getElementById('cwCoverFile');
    const coverTitle = document.getElementById('cwCoverTitle');
    const coverSub = document.getElementById('cwCoverSub');
    const handCanvas = document.getElementById('cwHandCanvas');
    const propsCanvas = document.getElementById('cwPropsCanvas');
    const clockHour = document.getElementById('cwClockHour');
    const clockMinute = document.getElementById('cwClockMinute');
    const clockSecond = document.getElementById('cwClockSecond');
    const clockTicks = document.getElementById('cwClockTicks');
    const blogList = document.getElementById('cwBlogList');
    const reader = document.getElementById('cwReader');

    const cards = Array.from(root.querySelectorAll('.cw-card[data-section]'));
    const files = {};
    root.querySelectorAll('.cw-file').forEach((file) => { files[file.dataset.file] = file; });

    const stackedQuery = window.matchMedia('(max-width: 899px)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // 窄屏和降低动效下不演取件动画，直接把档案铺开。
    const skipChoreography = () => stackedQuery.matches || reducedMotion.matches;

    const state = {
        rx: -6, ry: 16, dragging: false, k: 1, vw: DESIGN_WIDTH, vh: DESIGN_HEIGHT,
        phase: 'idle', active: null, card: null, note: null, land: null,
        sheetIn: false, sheetFull: false, fingers: 'open', handPos: null, handTrans: 'none',
        pf: 'all', tf: 'all', sound: false, hint: true,
        article: null, zoom: null, readerIn: false, listMounted: false
    };

    let drag = null;
    let moved = false;
    let touched = false;
    let frame = 0;
    let pending = null;
    let audio = null;
    let timers = [];
    let turnTimers = [];
    let opener = null;
    let articlesLoading = false;
    let hand = null;            // js/hand3d.js 里的 3D 手，加载好之前一直是 null
    let handLoading = false;
    let lastHand = {};          // 上一次同步给 3D 手的状态，避免每帧重复下发

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const num = (value) => Number(value) || 0;
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);

    function data() { return window.YuiClueData || {}; }
    function articles() { return window.YuiArticles || null; }

    function setList(name, html) {
        const list = root.querySelector(`[data-list="${name}"]`);
        if (list) list.innerHTML = html;
    }

    // ---- 数据渲染 ----

    function renderKeywords() {
        setList('keywords', (data().keywords || []).map((item) => (
            `<li class="cw-keyword" style="--rot:${num(item.rot)}deg">${escapeHtml(item.t)}</li>`
        )).join(''));
    }

    function renderAwards() {
        setList('awards', (data().awards || []).map((award) => (
            `<li class="cw-dossier-award"><span>${escapeHtml(award.t)}</span><span>${escapeHtml(award.y)}</span></li>`
        )).join(''));
    }

    function renderTabs(name, list, current, key) {
        setList(name, (list || []).map((tab) => (
            `<button class="cw-tab${tab.id === current ? ' is-active' : ''}" type="button" data-filter="${key}" data-value="${escapeHtml(tab.id)}">${escapeHtml(tab.label)}</button>`
        )).join(''));
    }

    function renderProjects() {
        const all = data().projects || [];
        const list = all.filter((item) => state.pf === 'all' || item.cat === state.pf);
        renderTabs('projectTabs', data().projectCats, state.pf, 'pf');
        setList('projects', list.map((item) => `
            <article class="cw-case" style="--rot:${num(item.rot)}deg">
                <span class="cw-case-clip" aria-hidden="true"></span>
                ${item.img ? `<div class="cw-case-photo"><img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async"></div>` : ''}
                <div class="cw-case-meta"><span>${escapeHtml(item.date)}</span><span>${escapeHtml(item.city)}</span></div>
                <h3 class="cw-case-title">${escapeHtml(item.title)}</h3>
                <p class="cw-case-note">${escapeHtml(item.desc)}</p>
                <div class="cw-case-foot"><span>${escapeHtml(CAT_LABELS[item.cat] || item.cat || '')}</span>${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">查看 · VIEW →</a>` : ''}</div>
                ${item.award ? `<span class="cw-case-award">${escapeHtml(item.award)}</span>` : ''}
            </article>`).join(''));
        const count = document.getElementById('cwProjectCount');
        if (count) count.textContent = `${list.length} / ${all.length}`;
    }

    function renderTravel() {
        const all = data().travel || [];
        const list = all.filter((item) => state.tf === 'all' || item.city === state.tf);
        renderTabs('travelTabs', data().travelCities, state.tf, 'tf');
        setList('travel', list.map((item) => `
            <figure class="cw-sighting" style="--rot:${num(item.rot)}deg">
                <div class="cw-sighting-photo">${item.img ? `<img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async">` : ''}</div>
                <figcaption>
                    <div class="cw-sighting-title">${escapeHtml(item.title)}</div>
                    <div class="cw-sighting-en">${escapeHtml(item.en)}</div>
                    <div class="cw-sighting-desc">${escapeHtml(item.desc)}</div>
                </figcaption>
            </figure>`).join(''));
    }

    function slugOf(link) { return String(link || '').replace(/\/$/, '').split('/').pop(); }

    function renderPosts() {
        setList('posts', (data().posts || []).map((post) => `
            <button class="cw-post" type="button" style="--rot:${num(post.rot)}deg" data-article="${escapeHtml(slugOf(post.link))}">
                <span class="cw-post-tape" aria-hidden="true"></span>
                <span class="cw-post-meta"><span>AI · ${escapeHtml(post.date)}</span><span>${escapeHtml(post.read)}</span></span>
                ${post.img ? `<span class="cw-post-photo"><img src="${escapeHtml(post.img)}" alt="" loading="lazy" decoding="async"></span>` : ''}
                <span class="cw-post-title">${escapeHtml(post.title)}</span>
                <span class="cw-post-excerpt">${escapeHtml(post.excerpt)}</span>
                <span class="cw-post-link">阅读 · READ →</span>
            </button>`).join(''));
    }

    function renderAll() {
        renderKeywords();
        renderAwards();
        renderProjects();
        renderTravel();
        renderPosts();
    }

    // ---- 文章手稿 ----

    function blockHtml(block, imgIndex) {
        switch (block.t) {
            case 'h2': return `<div class="cw-blk-h2">${escapeHtml(block.s)}</div>`;
            case 'h3': return `<div class="cw-blk-h3">${escapeHtml(block.s)}</div>`;
            case 'p': return `<p class="cw-blk-p">${escapeHtml(block.s)}</p>`;
            case 'img': return `<figure class="cw-blk-img" style="--rot:${(imgIndex % 2 ? 1 : -1) * 0.8}deg">
                    <span class="cw-blk-img-tape" aria-hidden="true"></span>
                    <img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" loading="lazy" decoding="async">
                    ${block.alt ? `<figcaption class="cw-blk-img-cap">${escapeHtml(block.alt)}</figcaption>` : ''}
                </figure>`;
            case 'code': return `<div class="cw-blk-code"><div class="cw-blk-code-kicker">CARBON COPY</div><pre>${escapeHtml(block.s)}</pre></div>`;
            case 'ul': return `<div class="cw-blk-list">${(block.items || []).map((item) => (
                `<div class="cw-blk-list-item"><span class="cw-blk-list-mark">—</span><span>${escapeHtml(item)}</span></div>`
            )).join('')}</div>`;
            case 'ol': return `<div class="cw-blk-list cw-blk-list--ol">${(block.items || []).map((item, i) => (
                `<div class="cw-blk-list-item"><span class="cw-blk-list-mark">${i + 1}.</span><span>${escapeHtml(item)}</span></div>`
            )).join('')}</div>`;
            case 'quote': return `<div class="cw-blk-quote">${escapeHtml(block.s)}</div>`;
            case 'table': return `<div class="cw-blk-table">${(block.rows || []).map((row, i) => (
                `<div class="cw-blk-row${i === 0 ? ' cw-blk-row--head' : ''}">${row.map((cell) => `<div class="cw-blk-cell">${escapeHtml(cell)}</div>`).join('')}</div>`
            )).join('')}</div>`;
            case 'hr': return '<div class="cw-blk-hr"></div>';
            default: return '';
        }
    }

    function renderArticle(slug) {
        const store = articles();
        const article = store && store[slug];
        if (!article) return false;
        const link = `${(data().site || 'https://aaccx.pw')}/blog/${article.slug}`;
        const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        set('cwArtTitle', article.title);
        set('cwArtMeta', `${article.date} · ${article.readTime}`);
        set('cwArtExcerpt', article.excerpt);
        set('cwArtPaperDate', `REPORT · 手稿 · ${article.date}`);
        set('cwArtPaperCount', `${article.blocks.length} BLOCKS · YUI`);
        const hero = document.getElementById('cwArtHero');
        const heroImg = document.getElementById('cwArtHeroImg');
        if (hero && heroImg) {
            hero.hidden = !article.hero;
            if (article.hero) { heroImg.src = article.hero; heroImg.alt = article.title; }
        }
        const tags = document.getElementById('cwArtTags');
        if (tags) tags.innerHTML = (article.tags || []).map((tag) => `<span class="cw-reader-tag">${escapeHtml(tag)}</span>`).join('');
        ['cwArtLink', 'cwArtEndLink'].forEach((id) => { const el = document.getElementById(id); if (el) el.href = link; });
        let imgIndex = 0;
        const blocks = document.getElementById('cwArtBlocks');
        if (blocks) {
            blocks.innerHTML = article.blocks.map((block) => {
                const html = blockHtml(block, imgIndex);
                if (block.t === 'img') imgIndex += 1;
                return html;
            }).join('');
        }
        const paper = document.getElementById('cwArtPaper');
        if (paper) paper.scrollTop = 0;
        // 窄屏下整张纸就是滚动容器，从列表滚到一半再点开文章时要回到顶部。
        if (sheet) sheet.scrollTop = 0;
        return true;
    }

    // 文章正文有 60+ KB，首屏不需要，等真的要看某篇时再按需加载。
    function ensureArticles(then) {
        if (articles()) { then(); return; }
        if (articlesLoading) return;
        articlesLoading = true;
        const script = document.createElement('script');
        script.src = '/js/blog-articles.js?v=20260921-1';
        script.onload = () => { articlesLoading = false; then(); };
        script.onerror = () => { articlesLoading = false; };
        document.head.appendChild(script);
    }

    function openArticle(slug, trigger) {
        clearTurnTimers();
        let zoom = null;
        const host = files.blog;
        if (trigger && host) {
            const box = trigger.getBoundingClientRect();
            const base = host.getBoundingClientRect();
            if (base.width && base.height) {
                const sx = SHEET_WIDTH / base.width;
                const sy = SHEET_HEIGHT / base.height;
                zoom = { x: (box.left - base.left) * sx, y: (box.top - base.top) * sy, w: box.width * sx, h: box.height * sy };
            }
        }
        ensureArticles(() => {
            if (!renderArticle(slug)) return;
            state.article = slug;
            state.zoom = zoom || { x: 440, y: 260, w: 400, h: 240 };
            state.readerIn = false;
            state.listMounted = true;
            renderReader();
            turnTimers.push(setTimeout(() => { state.readerIn = true; renderReader(); }, 40));
            turnTimers.push(setTimeout(() => { state.listMounted = false; renderReader(); }, 900));
        });
    }

    function closeArticle() {
        if (!state.article) return;
        clearTurnTimers();
        state.listMounted = true;
        state.readerIn = true;
        renderReader();
        turnTimers.push(setTimeout(() => { state.readerIn = false; renderReader(); }, 40));
        turnTimers.push(setTimeout(() => {
            state.article = null;
            renderReader();
            if (sheet) sheet.scrollTop = 0;
        }, 820));
    }

    function clearTurnTimers() { turnTimers.forEach(clearTimeout); turnTimers = []; }

    function renderReader() {
        if (!reader || !blogList) return;
        const open = Boolean(state.article);
        reader.hidden = !open;
        blogList.hidden = open && !state.listMounted;
        blogList.classList.toggle('is-behind', open && state.readerIn);
        if (!open) return;
        const zoom = state.zoom || { x: 440, y: 260, w: 400, h: 240 };
        reader.classList.toggle('is-in', state.readerIn);
        if (!state.readerIn) {
            reader.style.transform = `translate(${zoom.x.toFixed(1)}px, ${zoom.y.toFixed(1)}px) scale(${(zoom.w / SHEET_WIDTH).toFixed(4)}, ${(zoom.h / SHEET_HEIGHT).toFixed(4)})`;
        } else {
            reader.style.transform = '';
        }
    }

    // ---- 挂钟 ----

    function buildClockTicks() {
        if (!clockTicks || clockTicks.childElementCount) return;
        let html = '';
        for (let i = 0; i < 60; i++) {
            const major = i % 5 === 0;
            html += `<span class="cw-clock-tick" style="width:${major ? 3 : 1.5}px; height:${major ? 12 : 6}px; margin-left:${major ? -1.5 : -0.75}px; opacity:${major ? 1 : 0.65}; transform:rotate(${i * 6}deg)"></span>`;
        }
        clockTicks.innerHTML = html;
    }

    let dayBase = 0;
    function tickClock() {
        if (!clockHour || !clockMinute || !clockSecond) return;
        if (!dayBase) { const d = new Date(); d.setHours(0, 0, 0, 0); dayBase = d.getTime(); }
        // 用「今天已过的秒数」推角度，跨整点时指针不会倒着转回去。
        const seconds = Math.floor((Date.now() - dayBase) / 1000);
        clockHour.style.transform = `rotate(${seconds / 120}deg)`;
        clockMinute.style.transform = `rotate(${seconds / 10}deg)`;
        clockSecond.style.transform = `rotate(${seconds * 6}deg)`;
    }

    // ---- 尺寸与镜头 ----

    function fit() {
        const rect = root.getBoundingClientRect();
        state.vw = rect.width || window.innerWidth || DESIGN_WIDTH;
        state.vh = rect.height || window.innerHeight || DESIGN_HEIGHT;
        state.k = Math.max(0.35, Math.min(state.vw / DESIGN_WIDTH, state.vh / DESIGN_HEIGHT));
        render();
    }

    // 读档镜头：压到桌面正上方，同时保证桌沿不会穿出画面顶端、也不会顶到天花板。
    function deskCamera() {
        const { vw: W, vh: H, k } = state;
        const theta = DESK_TILT * Math.PI / 180;
        const halfW = W / (2 * k);
        const halfH = H / (2 * k);
        const margin = 40;
        const distance = Math.max(520, Math.min(
            650 * Math.sin(theta) * 1100 / (halfH + margin) - 650 * Math.cos(theta),
            1000 * 1100 / (halfW + margin) - 650 * Math.cos(theta),
            1080 / Math.sin(theta) - 120,
            1200
        ));
        return `translate3d(0px, 0px, ${Math.round(1100 - distance)}px) rotateX(${-DESK_TILT}deg) rotateY(0deg) translate3d(0px, -380px, -50px)`;
    }

    function restPos() {
        const { vw: W, vh: H, k } = state;
        return { x: W + 320 * k, y: H + 280 * k, r: -40 };
    }

    // 手捏住纸的位置：靠近纸的下缘、略偏左，这样手腕和袖子都不会压在纸面上。
    function pinchOf(center, w, h, rot, scale) {
        const a = rot * Math.PI / 180;
        const ax = PINCH.ax * w * scale;
        const ay = PINCH.ay * h * scale;
        return { x: center.x + ax * Math.cos(a) - ay * Math.sin(a), y: center.y + ax * Math.sin(a) + ay * Math.cos(a) };
    }

    // 手腕朝着手臂进场的那个角落，捏点落在 p 上。
    function handAt(p) {
        const { vw: W, vh: H, k } = state;
        const dx = (W + 200 * k) - p.x;
        const dy = (H + 320 * k) - p.y;
        const n = Math.hypot(dx, dy) || 1;
        const r = clamp(Math.atan2(-dx / n, dy / n) * 180 / Math.PI, -58, -16);
        return { x: p.x, y: p.y, r };
    }

    // ---- 3D 手（js/hand3d.js + js/three 里自托管的 three.js）----

    // 600 KB 出头的 three.js 不该进首屏：等访客第一次碰这面墙（按下、hover 便签或直接开档案）再加载。
    // 加载完成前一直用 SVG 的平面手顶着，加载失败就一直用它。
    function initHand() {
        if (hand || handLoading || !handCanvas || !propsCanvas || skipChoreography()) return;
        handLoading = true;
        import('/js/hand3d.js?v=20260921-1').then((module) => {
            hand = module.createHand(handCanvas, {
                propsCanvas,
                style: 'glove',
                onReady: () => { root.classList.add('has-hand3d'); render(); },
                onError: () => { root.classList.remove('has-hand3d'); }
            });
            hand.setSceneEls(cam, drift);
            hand.resize(state.vw, state.vh, state.k);
            hand.moveTo(state.handPos || restPos(), 0, 'inOut');
            hand.setCurl(state.fingers === 'closed' ? 0.9 : 0.18, 0);
            syncPaper(state.phase);
            lastHand = { handPos: state.handPos, handTrans: state.handTrans, fingers: state.fingers, vw: state.vw, vh: state.vh, phase: state.phase };
        }).catch(() => { handLoading = false; });
    }

    function usingHand3d() { return Boolean(hand) && root.classList.contains('has-hand3d'); }

    // 告诉 3D 手它正伸手去够哪张纸（当遮挡体用），或者正捏着哪张（每帧按捏点驱动）。
    function syncPaper(phase) {
        if (!hand) return;
        const { note, land } = state;
        if (!note) { hand.hold(null); hand.setPaper(null); return; }
        const wall = { x: note.x, y: note.y, w: note.w, h: note.h, r: note.r };
        const desk = land ? { x: land.x, y: land.y, w: land.w, h: land.h, r: 0 } : null;
        const grip = (r0, r1, s0, s1) => ({ w: note.w, h: note.h, ax: PINCH.ax, ay: PINCH.ay, r0, r1, s0, s1, el: carried });
        switch (phase) {
            case 'reach': hand.hold(null); hand.setPaper(wall); break;
            case 'grab': hand.setPaper(null); hand.hold(grip(note.r, note.r, 1, 1)); break;
            case 'carry': hand.hold(grip(note.r, 0, 1, 1.25)); break;
            case 'land': case 'closing': hand.hold(null); hand.setPaper(desk); break;
            case 'grab2': hand.setPaper(null); hand.hold(grip(0, 0, 1.25, 1.25)); break;
            case 'return': hand.hold(grip(0, note.r, 1.25, 1)); break;
            case 'release': hand.hold(null); hand.setPaper(wall); break;
            default: hand.hold(null); hand.setPaper(null);
        }
    }

    // 把这一帧的状态差分下发给 3D 手：位置、手指弯曲、视口、以及它该遮挡/捏住哪张纸。
    function syncHand() {
        if (!hand) return;
        const durations = { reach: 650, carry: 1050, retreat: 600 };
        if (lastHand.handPos !== state.handPos || lastHand.handTrans !== state.handTrans) {
            hand.moveTo(state.handPos || restPos(), durations[state.handTrans] || 0, state.handTrans === 'retreat' ? 'in' : 'inOut');
        }
        if (lastHand.fingers !== state.fingers) hand.setCurl(state.fingers === 'closed' ? 0.9 : 0.18, 220);
        if (lastHand.vw !== state.vw || lastHand.vh !== state.vh) hand.resize(state.vw, state.vh, state.k);
        if (lastHand.phase !== state.phase) syncPaper(state.phase);
        lastHand = { handPos: state.handPos, handTrans: state.handTrans, fingers: state.fingers, vw: state.vw, vh: state.vh, phase: state.phase };
    }

    // ---- 渲染 ----

    function render() {
        const { k, rx, ry, phase, dragging } = state;
        const onDesk = DESK_PHASES.includes(phase);
        scene.style.perspective = `${Math.round(1100 * k)}px`;
        stage.style.transform = `scale3d(${k}, ${k}, ${k})`;
        cam.style.transform = onDesk ? deskCamera() : `translate3d(0px, 0px, 0px) rotateX(${rx}deg) rotateY(${ry}deg)`;
        if (dragging || reducedMotion.matches) cam.style.transition = 'none';
        else cam.style.transition = phase === 'idle' ? 'transform 2.2s cubic-bezier(.2,.7,.2,1)' : 'transform 1.05s cubic-bezier(.55,0,.2,1)';
        drift.classList.toggle('is-paused', phase !== 'idle' || dragging);
        scene.classList.toggle('is-dragging', dragging);
        dim.style.opacity = onDesk ? '0.06' : '0';
        hint.style.opacity = state.hint ? '0.85' : '0';
        soundState.textContent = state.sound ? 'ON' : 'OFF';
        soundButton.setAttribute('aria-pressed', String(state.sound));

        // 只有真正被取走的那张便签从墙上消失，其它的留在原位。
        const lifted = HIDDEN_PHASES.includes(phase) ? state.card : null;
        cards.forEach((card) => card.classList.toggle('is-lifted', Boolean(lifted) && card.dataset.card === lifted));

        renderHand();
        renderSheet();
        syncHand();
    }

    function renderHand() {
        const { k, phase } = state;
        const stacked = skipChoreography();
        const pos = state.handPos || restPos();
        const transform = `translate(${pos.x}px, ${pos.y}px) rotate(${pos.r}deg) scale(${k * 1.1}) translate(-75px, -240px)`;
        const transitions = {
            reach: 'transform .65s cubic-bezier(.35,0,.25,1)',
            carry: 'transform 1.05s cubic-bezier(.5,0,.25,1)',
            retreat: 'transform .6s cubic-bezier(.4,0,.7,1)',
            none: 'none'
        };
        const transition = transitions[state.handTrans] || 'none';
        [handBack, handFront].forEach((layer) => {
            if (!layer) return;
            layer.style.transform = transform;
            layer.style.transition = transition;
        });
        const closed = state.fingers === 'closed';
        if (fingers) fingers.style.transform = closed ? 'scaleY(.58)' : 'scaleY(1)';
        if (thumb) thumb.style.transform = closed ? 'rotate(16deg)' : 'rotate(-24deg)';

        const carrying = !stacked && CARRY_PHASES.includes(phase) && Boolean(state.note);
        if (!carried) return;
        carried.hidden = !carrying;
        if (!carrying) return;
        const cover = COVERS[state.card] || COVERS[state.active] || COVERS.about;
        coverFile.textContent = cover.file;
        coverTitle.textContent = cover.title;
        coverSub.textContent = cover.sub;
        carried.style.background = cover.bg;
        carried.style.color = cover.fg;
        // 有 3D 手时，被捏住的纸每帧由手按捏点驱动（Web Animations），这里只画出行程起点的姿势；
        // 没有 3D 手时，纸自己跟着手的 CSS transition 走。
        const on3d = usingHand3d();
        const atLand = on3d ? (phase === 'grab2' || phase === 'return') : (phase === 'carry' || phase === 'grab2');
        const target = atLand ? state.land : state.note;
        const scale = atLand ? 1.25 : 1;
        const w = state.note.w / k;
        const h = state.note.h / k;
        carried.style.width = `${w}px`;
        carried.style.height = `${h}px`;
        carried.style.transition = on3d ? 'none' : transition;
        carried.style.transform = `translate(${target.x}px, ${target.y}px) rotate(${atLand ? 0 : state.note.r}deg) scale(${k * scale}) translate(${-w / 2}px, ${-h / 2}px)`;
    }

    function renderSheet() {
        if (!sheet) return;
        sheet.hidden = !state.sheetIn;
        if (!state.sheetIn) { sheet.classList.remove('is-open'); return; }
        sheet.dataset.file = state.active || '';
        fileLabel.textContent = `${FILE_LABELS[state.active] || ''} · ESC`;
        Object.keys(files).forEach((id) => { files[id].hidden = id !== state.active; });
        const labelledBy = files[state.active] && files[state.active].getAttribute('aria-labelledby');
        if (labelledBy) sheet.setAttribute('aria-labelledby', labelledBy);
        sheet.classList.toggle('is-open', state.sheetFull);

        if (skipChoreography()) { sheet.style.transform = ''; return; }
        const { k, vw: W, vh: H, land } = state;
        const ks = k * 0.9;
        sheet.style.transform = (state.sheetFull || !land)
            ? `translate(${W / 2}px, ${H / 2 + 20 * k}px) rotate(0deg) scale(${ks}, ${ks}) rotateX(4deg) translate(-640px, -380px)`
            : `translate(${land.x}px, ${land.y}px) rotate(0deg) scale(${land.w / SHEET_WIDTH}, ${land.h / SHEET_HEIGHT}) rotateX(4deg) translate(-640px, -380px)`;
    }

    function setBackgroundInert(value) {
        [scene, soundButton].forEach((element) => { element.inert = value; });
    }

    // ---- 取件编排：手把便签从墙上取下来，摊到桌上 ----

    function after(ms, fn) { timers.push(setTimeout(fn, ms)); }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function take(id, rect, cardName, trigger) {
        initHand();
        clearTimers();
        clearTurnTimers();
        const { vw: W, vh: H, k } = state;
        // 便签是斜着钉在墙上的，先从它的外接矩形反推出纸本身的宽高。
        const ta = Math.abs(rect.tilt) * Math.PI / 180;
        const tc = Math.cos(ta);
        const ts = Math.sin(ta);
        const tq = tc * tc - ts * ts || 1;
        const nw = Math.max(40, (rect.w * tc - rect.h * ts) / tq);
        const nh = Math.max(40, (rect.h * tc - rect.w * ts) / tq);
        const note = { x: rect.l + rect.w / 2, y: rect.t + rect.h / 2, r: rect.tilt, w: nw, h: nh };
        const land = { x: W / 2 + 10 * k, y: H / 2 + 30 * k, w: nw * 1.25, h: nh * 1.25 };

        opener = trigger || null;
        Object.assign(state, {
            active: id, card: cardName || null, note, land, hint: false,
            article: null, listMounted: false, readerIn: false
        });
        renderReader();
        if (state.active === 'blog') ensureArticles(() => {});
        setBackgroundInert(true);

        if (skipChoreography()) {
            Object.assign(state, { phase: 'open', sheetIn: true, sheetFull: true, fingers: 'open', handPos: restPos(), handTrans: 'none' });
            render();
            if (sheetInner) sheetInner.scrollTop = 0;
            backButton.focus({ preventScroll: true });
            return;
        }

        Object.assign(state, {
            phase: 'reach', fingers: 'open', sheetIn: false, sheetFull: false,
            handPos: handAt(pinchOf(note, nw, nh, note.r, 1)), handTrans: 'reach'
        });
        render();
        after(650, () => { Object.assign(state, { phase: 'grab', fingers: 'closed' }); render(); });
        after(900, () => { Object.assign(state, { phase: 'carry', handPos: handAt(pinchOf(land, nw, nh, 0, 1.25)), handTrans: 'carry' }); render(); });
        after(1980, () => { Object.assign(state, { phase: 'land', fingers: 'open', sheetIn: true, sheetFull: false }); render(); thud(); });
        after(2060, () => { state.sheetFull = true; render(); });
        after(2200, () => { Object.assign(state, { handPos: restPos(), handTrans: 'retreat' }); render(); });
        after(2800, () => {
            state.phase = 'open';
            render();
            backButton.focus({ preventScroll: true });
        });
    }

    function closeFile() {
        if (state.phase !== 'open' || !state.note) return;
        clearTimers();
        clearTurnTimers();
        state.article = null;
        renderReader();

        if (skipChoreography()) {
            Object.assign(state, { phase: 'idle', active: null, card: null, note: null, land: null, sheetIn: false, sheetFull: false });
            render();
            setBackgroundInert(false);
            restoreFocus();
            return;
        }

        const { land, note } = state;
        Object.assign(state, {
            phase: 'closing', sheetFull: false, fingers: 'open',
            handPos: handAt(pinchOf(land, note.w, note.h, 0, 1.25)), handTrans: 'reach'
        });
        render();
        after(560, () => { Object.assign(state, { phase: 'grab2', sheetIn: false, fingers: 'closed' }); render(); });
        after(780, () => { Object.assign(state, { phase: 'return', handPos: handAt(pinchOf(note, note.w, note.h, note.r, 1)), handTrans: 'carry' }); render(); });
        after(1820, () => { Object.assign(state, { phase: 'release', fingers: 'open' }); render(); thud(); });
        after(1980, () => { Object.assign(state, { handPos: restPos(), handTrans: 'retreat' }); render(); });
        after(2600, () => {
            Object.assign(state, { phase: 'idle', active: null, card: null, note: null, land: null });
            render();
            setBackgroundInert(false);
            restoreFocus();
        });
    }

    function restoreFocus() {
        if (opener && opener.isConnected) opener.focus({ preventScroll: true });
        opener = null;
    }

    function openFromCard(card) {
        if (state.phase !== 'idle') return;
        const id = card.dataset.section;
        const rect = card.getBoundingClientRect();
        const base = root.getBoundingClientRect();
        take(id, {
            l: rect.left - base.left,
            t: rect.top - base.top,
            w: rect.width,
            h: rect.height,
            tilt: parseFloat(card.dataset.tilt) || 0
        }, card.dataset.card, card);
        if (window.location.hash !== `#${id}`) history.pushState({ clueFile: id }, '', `#${id}`);
    }

    function openCentered(id) {
        if (!files[id]) return;
        const { vw: W, vh: H, k } = state;
        const card = cards.find((item) => item.dataset.section === id);
        take(id, { l: W / 2 - 170 * k, t: H / 2 - 120 * k, w: 340 * k, h: 240 * k, tilt: -3 }, card ? card.dataset.card : null, null);
    }

    // 从墙上打开的档案有自己的历史记录，关闭时退回上一条；直接带锚点进入的则只清掉锚点。
    function requestClose() {
        if (state.phase !== 'open') return;
        if (state.article) { closeArticle(); return; }
        if (history.state && history.state.clueFile === state.active) { history.back(); return; }
        closeFile();
        if (window.location.hash) history.replaceState(history.state, '', window.location.pathname + window.location.search);
    }

    function fileFromHash() {
        let id = '';
        try { id = decodeURIComponent(window.location.hash.slice(1)); } catch (error) { id = ''; }
        if (id === 'photos') id = 'travel';   // v1 的照片档案并进了旅行
        return Object.prototype.hasOwnProperty.call(files, id) ? id : null;
    }

    function syncWithLocation() {
        const id = fileFromHash();
        if (!id) {
            if (state.phase === 'open') closeFile();
            return;
        }
        if (id === state.active) return;
        if (state.phase === 'idle') { openCentered(id); return; }
        // 已经摊开一份档案时（例如用浏览器前进 / 后退换一份），直接换内容，不再演一遍取件。
        if (state.phase === 'open' && files[id]) {
            clearTurnTimers();
            Object.assign(state, { active: id, card: null, article: null, listMounted: false, readerIn: false });
            renderReader();
            if (id === 'blog') ensureArticles(() => {});
            render();
            if (sheetInner) sheetInner.scrollTop = 0;
        }
    }

    // ---- 拖动环视 ----

    function onPointerDown(event) {
        initHand();
        if (state.phase !== 'idle' || (event.button !== undefined && event.button !== 0)) return;
        drag = { x: event.clientX, y: event.clientY, rx: state.rx, ry: state.ry };
        moved = false;
        touched = true;
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
        window.addEventListener('pointercancel', onPointerUp);
        state.dragging = true;
        render();
    }

    function onPointerMove(event) {
        if (!drag) return;
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (Math.hypot(dx, dy) > 6) moved = true;
        pending = { ry: clamp(drag.ry + dx * 0.075, -32, 32), rx: clamp(drag.rx - dy * 0.06, -14, 14) };
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            if (!pending) return;
            Object.assign(state, pending);
            pending = null;
            render();
        });
    }

    function onPointerUp() {
        if (!drag) return;
        drag = null;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        state.dragging = false;
        state.hint = state.hint && !moved;
        render();
        setTimeout(() => { moved = false; }, 0);
    }

    // ---- 环境音：低通滤波的布朗噪声模拟雨声，每秒一次带通短噪声模拟座钟滴答，全部现场合成 ----

    function startSound() {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            const ctx = new AudioContextClass();
            const master = ctx.createGain();
            master.gain.setValueAtTime(0, ctx.currentTime);
            master.gain.linearRampToValueAtTime(1, ctx.currentTime + 2);
            master.connect(ctx.destination);

            const rate = ctx.sampleRate;
            const length = rate * 4;
            const rainBuffer = ctx.createBuffer(1, length, rate);
            const rainData = rainBuffer.getChannelData(0);
            let last = 0;
            for (let i = 0; i < length; i++) {
                const white = Math.random() * 2 - 1;
                last = (last + 0.02 * white) / 1.02;
                rainData[i] = last * 3.5;
            }
            const rain = ctx.createBufferSource();
            rain.buffer = rainBuffer;
            rain.loop = true;
            const lowpass = ctx.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.frequency.value = 700;
            const rainGain = ctx.createGain();
            rainGain.gain.value = 0.28;
            rain.connect(lowpass);
            lowpass.connect(rainGain);
            rainGain.connect(master);
            rain.start();

            const tickLength = Math.floor(rate * 0.03);
            const tickBuffer = ctx.createBuffer(1, tickLength, rate);
            const tickData = tickBuffer.getChannelData(0);
            for (let i = 0; i < tickLength; i++) tickData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / tickLength, 3);
            const tick = () => {
                if (ctx.state === 'closed') return;
                const source = ctx.createBufferSource();
                source.buffer = tickBuffer;
                const bandpass = ctx.createBiquadFilter();
                bandpass.type = 'bandpass';
                bandpass.frequency.value = 2600;
                bandpass.Q.value = 6;
                const gain = ctx.createGain();
                gain.gain.value = 0.35;
                source.connect(bandpass);
                bandpass.connect(gain);
                gain.connect(master);
                source.start();
            };
            audio = { ctx, master, timer: setInterval(tick, 1000) };
        } catch (error) {
            audio = null;
        }
    }

    // 纸落到桌面、以及被钉回墙上时的一声闷响。
    function thud() {
        const current = audio;
        if (!current) return;
        try {
            const ctx = current.ctx;
            const length = Math.floor(ctx.sampleRate * 0.14);
            const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
            const channel = buffer.getChannelData(0);
            for (let i = 0; i < length; i++) channel[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            const lowpass = ctx.createBiquadFilter();
            lowpass.type = 'lowpass';
            lowpass.frequency.value = 1100;
            const gain = ctx.createGain();
            gain.gain.value = 0.5;
            source.connect(lowpass);
            lowpass.connect(gain);
            gain.connect(current.master);
            source.start();
        } catch (error) {
            // 音频上下文已经关闭时无需处理。
        }
    }

    function stopSound() {
        const current = audio;
        if (!current) return;
        audio = null;
        clearInterval(current.timer);
        try {
            const now = current.ctx.currentTime;
            current.master.gain.cancelScheduledValues(now);
            current.master.gain.setValueAtTime(current.master.gain.value, now);
            current.master.gain.linearRampToValueAtTime(0, now + 0.6);
            setTimeout(() => current.ctx.close(), 800);
        } catch (error) {
            // 音频上下文已经关闭时无需处理。
        }
    }

    function toggleSound() {
        if (state.sound) stopSound();
        else startSound();
        state.sound = !state.sound;
        render();
    }

    // ---- 启动 ----

    buildClockTicks();
    tickClock();
    renderAll();
    if (reducedMotion.matches) Object.assign(state, { rx: -2, ry: 6 });
    fit();

    setInterval(tickClock, 1000);
    window.addEventListener('yui-clue-data', renderAll);

    scene.addEventListener('pointerdown', onPointerDown);
    cards.forEach((card) => {
        // 鼠标挪到便签上、或用键盘聚焦到便签时就开始加载 3D 手，点下去时通常已经就位。
        card.addEventListener('pointerenter', initHand);
        card.addEventListener('focus', initHand);
        card.addEventListener('click', () => { if (!moved) openFromCard(card); });
        card.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            openFromCard(card);
        });
    });

    // 档案里的筛选标签和文章卡片都是渲染出来的，统一用事件委托。
    sheetInner.addEventListener('click', (event) => {
        const tab = event.target.closest('.cw-tab');
        if (tab) {
            const key = tab.dataset.filter;
            state[key] = tab.dataset.value;
            if (key === 'pf') renderProjects();
            else renderTravel();
            return;
        }
        const post = event.target.closest('[data-article]');
        if (post) { openArticle(post.dataset.article, post); return; }
        if (event.target.closest('#cwArtBack')) closeArticle();
    });

    backButton.addEventListener('click', requestClose);
    soundButton.addEventListener('click', toggleSound);
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') requestClose();
    });
    window.addEventListener('popstate', syncWithLocation);
    window.addEventListener('hashchange', syncWithLocation);
    window.addEventListener('resize', fit);
    if (window.ResizeObserver) new ResizeObserver(fit).observe(root);
    stackedQuery.addEventListener('change', render);

    const initialFile = fileFromHash();
    if (initialFile) openCentered(initialFile);

    // 开场镜头从侧面缓缓转向正对线索墙；访客已经开始拖动时不再覆盖视角。
    if (!reducedMotion.matches) {
        setTimeout(() => {
            if (touched || state.phase !== 'idle') return;
            Object.assign(state, { rx: -2, ry: 6 });
            render();
        }, 300);
    }
})();
