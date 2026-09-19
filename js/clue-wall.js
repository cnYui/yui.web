// 首页线索墙（侦探书房）：拖动环视、点击便签放大档案、环境音。
// 设计稿：Claude Design「侦探线索墙个人主页」Clue Wall Study。墙面按 1440 × 900 排版，
// 这里按视口算出缩放系数 k，并把 js/clue-data.js 的档案数据渲染进浮层。
// 打开档案会写入 #about / #projects / #blog / #resume / #photos，可直接分享链接，返回键关闭。
(function () {
    const root = document.getElementById('clueWall');
    if (!root) return;

    const DESIGN_WIDTH = 1440;
    const DESIGN_HEIGHT = 900;
    const CLOSE_MS = 1150;
    const REDUCED_CLOSE_MS = 250;

    const scene = document.getElementById('cwScene');
    const stage = document.getElementById('cwStage');
    const cam = document.getElementById('cwCam');
    const drift = document.getElementById('cwDrift');
    const dim = document.getElementById('cwDim');
    const hint = document.getElementById('cwHint');
    const nav = root.querySelector('.cw-nav');
    const soundButton = document.getElementById('cwSound');
    const soundState = document.getElementById('cwSoundState');
    const overlay = document.getElementById('cwOverlay');
    const overlayContent = document.getElementById('cwOverlayContent');
    const board = document.getElementById('cwBoard');
    const backButton = document.getElementById('cwBack');
    const files = {};
    root.querySelectorAll('.cw-file').forEach((file) => {
        files[file.dataset.file] = file;
    });

    const stackedQuery = window.matchMedia('(max-width: 899px)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const state = {
        rx: -6,
        ry: 16,
        dragging: false,
        k: 1,
        vw: DESIGN_WIDTH,
        vh: DESIGN_HEIGHT,
        active: null,
        rect: null,
        zoomed: false,
        closing: false,
        sound: false,
        hint: true
    };
    let drag = null;
    let moved = false;
    let touched = false;
    let frame = 0;
    let pending = null;
    let audio = null;
    let closeTimer = 0;
    let opener = null;

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
    const num = (value) => Number(value) || 0;

    function setList(name, html) {
        const list = root.querySelector(`[data-list="${name}"]`);
        if (list) list.innerHTML = html;
    }

    function renderFiles(data) {
        const keywords = data.keywords || [];
        const timeline = data.timeline || [];
        const posts = data.posts || [];
        const awards = data.awards || [];
        const photos = data.photos || [];

        setList('keywords', keywords.map((item) => (
            `<li class="cw-keyword" style="--rot:${num(item.rot)}deg">${escapeHtml(item.t)}</li>`
        )).join(''));

        setList('timeline', timeline.map((item) => `
            <li class="cw-case" style="--rot:${num(item.rot)}deg">
                <span class="cw-case-clip" aria-hidden="true"></span>
                <div class="cw-case-card">
                    <div class="cw-case-photo">${item.img ? `<img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.title)}" loading="lazy" decoding="async">` : ''}</div>
                    <div class="cw-case-meta"><span>${escapeHtml(item.date)}</span><span>${escapeHtml(item.city)}</span></div>
                    <h3 class="cw-case-title">${escapeHtml(item.title)}</h3>
                    <p class="cw-case-note">${escapeHtml(item.note)}</p>
                </div>
                ${item.award ? `<span class="cw-case-award">${escapeHtml(item.award)}</span>` : ''}
            </li>`).join(''));

        setList('posts', posts.map((post) => `
            <article class="cw-post" style="--rot:${num(post.rot)}deg">
                <span class="cw-post-tape" aria-hidden="true"></span>
                <div class="cw-post-meta"><span>AI · ${escapeHtml(post.date)}</span><span>${escapeHtml(post.read)}</span></div>
                ${post.img ? `<div class="cw-post-photo"><img src="${escapeHtml(post.img)}" alt="" loading="lazy" decoding="async"></div>` : ''}
                <h3 class="cw-post-title">${escapeHtml(post.title)}</h3>
                <p class="cw-post-excerpt">${escapeHtml(post.excerpt)}</p>
                <a class="cw-post-link" href="${escapeHtml(post.link)}" target="_blank" rel="noopener">阅读 · READ →</a>
            </article>`).join(''));

        setList('awards', awards.map((award) => (
            `<li class="cw-dossier-award"><span>${escapeHtml(award.t)}</span><span>${escapeHtml(award.y)}</span></li>`
        )).join(''));

        setList('photos', photos.map((photo) => `
            <figure class="cw-sighting" style="--x:${num(photo.x)}px; --y:${num(photo.y)}px; --rot:${num(photo.rot)}deg">
                <div class="cw-sighting-photo">${photo.img ? `<img src="${escapeHtml(photo.img)}" alt="${escapeHtml(photo.cap)}" loading="lazy" decoding="async">` : ''}</div>
                <figcaption class="cw-sighting-caption">${escapeHtml(photo.cap)}</figcaption>
            </figure>`).join('') + photos.map((photo) => (
            `<span class="cw-sighting-pin" style="--x:${num(photo.px)}px; --y:${num(photo.py)}px" aria-hidden="true"></span>`
        )).join(''));
    }

    function fit() {
        const rect = root.getBoundingClientRect();
        state.vw = rect.width || window.innerWidth || DESIGN_WIDTH;
        state.vh = rect.height || window.innerHeight || DESIGN_HEIGHT;
        state.k = Math.max(0.35, Math.min(state.vw / DESIGN_WIDTH, state.vh / DESIGN_HEIGHT));
        render();
    }

    function render() {
        const { k, rx, ry, active, dragging } = state;
        scene.style.perspective = `${Math.round(1100 * k)}px`;
        stage.style.transform = `scale3d(${k}, ${k}, ${k})`;
        cam.style.transform = active
            ? `rotateX(${rx * 0.4}deg) rotateY(${ry * 0.4}deg) translate3d(0px, 0px, 240px)`
            : `rotateX(${rx}deg) rotateY(${ry}deg) translate3d(0px, 0px, 0px)`;
        if (dragging || reducedMotion.matches) cam.style.transition = 'none';
        else cam.style.transition = active ? 'transform 1.4s cubic-bezier(.45,0,.2,1)' : 'transform 2.2s cubic-bezier(.2,.7,.2,1)';
        drift.classList.toggle('is-paused', Boolean(active) || dragging);
        scene.classList.toggle('is-dragging', dragging);
        dim.style.opacity = active ? '0.55' : '0';
        hint.style.opacity = state.hint ? '0.85' : '0';
        soundState.textContent = state.sound ? 'ON' : 'OFF';
        soundButton.setAttribute('aria-pressed', String(state.sound));
        renderOverlay();
    }

    // 浮层从被点击的便签位置（含倾角）放大到全屏，关闭时再缩回去。
    function renderOverlay() {
        const { active, rect, zoomed, vw, vh, k } = state;
        overlay.hidden = !active;
        if (!active) return;
        const reduce = reducedMotion.matches;
        overlay.dataset.file = active;
        Object.keys(files).forEach((id) => {
            files[id].hidden = id !== active;
        });
        if (rect && !zoomed && !reduce) {
            const cx = rect.l + rect.w / 2;
            const cy = rect.t + rect.h / 2;
            overlay.style.transform = `translate(${cx}px, ${cy}px) rotate(${rect.tilt}deg) scale(${rect.w / vw}, ${rect.h / vh}) translate(-50%, -50%)`;
        } else {
            overlay.style.transform = `translate(${vw / 2}px, ${vh / 2}px) rotate(0deg) scale(1, 1) translate(-50%, -50%)`;
        }
        overlay.style.transition = reduce ? 'opacity .2s ease' : 'transform 1.15s cubic-bezier(.7,0,.2,1)';
        overlay.style.opacity = reduce && !zoomed ? '0' : '1';
        overlayContent.style.opacity = zoomed ? '1' : '0';
        if (reduce) overlayContent.style.transition = 'none';
        else overlayContent.style.transition = zoomed ? 'opacity .6s ease .55s' : 'opacity .25s ease 0s';
        board.style.transform = stackedQuery.matches ? '' : `translate(-50%, -50%) scale(${k})`;
    }

    function setBackgroundInert(value) {
        [scene, nav, soundButton].forEach((element) => {
            element.inert = value;
        });
    }

    function openFile(id, rect, trigger) {
        if (!files[id]) return;
        clearTimeout(closeTimer);
        opener = trigger || null;
        Object.assign(state, { active: id, rect, zoomed: false, closing: false, hint: false });
        overlay.setAttribute('aria-labelledby', files[id].getAttribute('aria-labelledby'));
        render();
        overlayContent.scrollTop = 0;
        setBackgroundInert(true);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            if (state.active !== id || state.closing) return;
            state.zoomed = true;
            renderOverlay();
            backButton.focus({ preventScroll: true });
        }));
    }

    function openCentered(id) {
        openFile(id, { l: state.vw / 2 - 150, t: state.vh / 2 - 100, w: 300, h: 200, tilt: -3 }, null);
    }

    function openFromCard(card) {
        const id = card.dataset.section;
        const rect = card.getBoundingClientRect();
        const base = root.getBoundingClientRect();
        openFile(id, {
            l: rect.left - base.left,
            t: rect.top - base.top,
            w: rect.width,
            h: rect.height,
            tilt: parseFloat(card.dataset.tilt) || 0
        }, card);
        if (window.location.hash !== `#${id}`) history.pushState({ clueFile: id }, '', `#${id}`);
    }

    function closeFile() {
        if (!state.active || state.closing) return;
        state.closing = true;
        state.zoomed = false;
        renderOverlay();
        clearTimeout(closeTimer);
        closeTimer = setTimeout(() => {
            Object.assign(state, { active: null, rect: null, closing: false });
            render();
            setBackgroundInert(false);
            if (opener && opener.isConnected) opener.focus({ preventScroll: true });
            opener = null;
        }, reducedMotion.matches ? REDUCED_CLOSE_MS : CLOSE_MS);
    }

    // 从墙上打开的档案有自己的历史记录，关闭时退回上一条；直接带锚点进入的则只清掉锚点。
    function requestClose() {
        if (!state.active || state.closing) return;
        if (history.state && history.state.clueFile === state.active) {
            history.back();
            return;
        }
        closeFile();
        if (window.location.hash) history.replaceState(history.state, '', window.location.pathname + window.location.search);
    }

    function fileFromHash() {
        let id = '';
        try {
            id = decodeURIComponent(window.location.hash.slice(1));
        } catch (error) {
            id = '';
        }
        return Object.prototype.hasOwnProperty.call(files, id) ? id : null;
    }

    function syncWithLocation() {
        const id = fileFromHash();
        if (id) {
            if (id !== state.active || state.closing) openCentered(id);
        } else if (state.active) {
            closeFile();
        }
    }

    function onPointerDown(event) {
        if (state.active || (event.button !== undefined && event.button !== 0)) return;
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
    }

    // 环境音：低通滤波的布朗噪声模拟雨声，每秒一次带通短噪声模拟座钟滴答，全部现场合成。
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

    renderFiles(window.YuiClueData || {});
    if (reducedMotion.matches) Object.assign(state, { rx: -2, ry: 6 });
    fit();

    scene.addEventListener('pointerdown', onPointerDown);
    root.querySelectorAll('.cw-card[data-section]').forEach((card) => {
        card.addEventListener('click', () => {
            if (!moved) openFromCard(card);
        });
        card.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            openFromCard(card);
        });
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
    stackedQuery.addEventListener('change', renderOverlay);

    const initialFile = fileFromHash();
    if (initialFile) openCentered(initialFile);

    // 开场镜头从侧面缓缓转向正对线索墙；访客已经开始拖动时不再覆盖视角。
    if (!reducedMotion.matches) {
        setTimeout(() => {
            if (touched) return;
            Object.assign(state, { rx: -2, ry: 6 });
            render();
        }, 300);
    }
})();
