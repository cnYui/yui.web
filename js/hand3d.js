// 线索墙的 3D 侦探手 —— 真实的骨骼手部网格（WebXR generic-hand profile，Apache-2.0），
// 用 three.js 在一层透明覆盖 canvas 上摆姿势和做动画。对外的坐标都是 CSS 像素。
// 对应 Claude Design「侦探线索墙个人主页」的 hand3d.js；站点 CSP 是 script-src 'self' / connect-src 'self'，
// 所以 three.js、GLTFLoader 和手的模型都改成站内自托管（见 js/three/ 与 files/）。
// 这个模块由 js/clue-wall.js 在第一次取件时才动态 import()，首屏不加载。
import * as THREE from '/js/three/three.module.min.js';
import { GLTFLoader } from '/js/three/GLTFLoader.js';

const HAND_URL = '/files/webxr-generic-hand-right.glb';
const FINGERS = ['index-finger', 'middle-finger', 'ring-finger', 'pinky-finger'];
const ease = { inOut: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, out: t => 1 - Math.pow(1 - t, 3), in: t => t * t * t };

export function createHand(canvas, opts = {}) {
  const mkRenderer = (c) => { const r = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, premultipliedAlpha: true, preserveDrawingBuffer: true }); r.setClearColor(0x000000, 0); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05; return r; };
  const renderer = mkRenderer(canvas);
  const propsRenderer = opts.propsCanvas ? mkRenderer(opts.propsCanvas) : null;
  const propsScene = new THREE.Scene();
  propsScene.add(new THREE.HemisphereLight(0xffe2b8, 0x2a1a10, 1.1));
  const pkey = new THREE.DirectionalLight(0xffd6a0, 2.0); pkey.position.set(600, 900, 900); propsScene.add(pkey);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 10, 20000);
  scene.add(new THREE.HemisphereLight(0xffe2b8, 0x2a1a10, 1.1));
  const key = new THREE.DirectionalLight(0xffd6a0, 2.2); key.position.set(600, 900, 900); scene.add(key);
  const fill = new THREE.DirectionalLight(0x8fa8ff, 0.35); fill.position.set(-800, 200, 600); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffb070, 0.8); rim.position.set(200, -400, -600); scene.add(rim);

  const hand = new THREE.Group(); scene.add(hand);            // 屏幕位置 + 倾角
  const rig = new THREE.Group(); hand.add(rig);                // 以掌心为原点，手指 +Y，手背 +Z（朝向观众）
  const mats = {
    glove: new THREE.MeshPhysicalMaterial({ color: 0x2a1c14, roughness: .5, metalness: .05, clearcoat: .35, clearcoatRoughness: .45, sheen: .4, sheenColor: new THREE.Color(0x6b4a33) }),
    skin: new THREE.MeshStandardMaterial({ color: 0xd8a487, roughness: .68, metalness: 0 }),
    sleeve: new THREE.MeshStandardMaterial({ color: 0x1f1814, roughness: .95 }),
    cuff: new THREE.MeshStandardMaterial({ color: 0xe9e0cf, roughness: .8 }),
    link: new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: .35, metalness: .8 })
  };
  let style = opts.style || 'glove';
  // 袖子和袖口从手腕（rig -Y）垂下去，长到足以出画
  const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(.062, .085, 2.4, 40), mats.sleeve); sleeve.position.y = -1.32; rig.add(sleeve);
  const cuff = new THREE.Mesh(new THREE.CylinderGeometry(.066, .07, .075, 40), mats.cuff); cuff.position.y = -.145; rig.add(cuff);
  const link = new THREE.Mesh(new THREE.SphereGeometry(.009, 16, 12), mats.link); link.position.set(.056, -.14, .03); rig.add(link);
  // 手背后的柔和接触阴影
  const sc = document.createElement('canvas'); sc.width = sc.height = 256;
  const g = sc.getContext('2d'), grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0,0,0,.55)'); grad.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(.46, .6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  scene.add(shadow);   // 每帧挪到纸的前面一点点，让阴影也落在纸面上
  // 正在被处理的那张纸：一块只写深度的平面 —— 捏住时指尖藏到纸后面，拇指留在纸上面
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ colorWrite: false })); paper.renderOrder = -1; paper.visible = false; scene.add(paper);
  let paperRect = null, held = null, calibLog = [];
  const MUL = { 'index-finger': .55, 'middle-finger': 1, 'ring-finger': 1.06, 'pinky-finger': 1.12, thumb: .9 };   // 每根手指的弯曲系数；拇指和食指由 calibrate() 重新拟合，保证捏合时指尖能碰上，其余手指只是收拢
  const pinchLocal = new THREE.Vector3(), tipA = new THREE.Vector3(), tipB = new THREE.Vector3();

  // ---- 桌上的道具：放在 CSS 房间的坐标系里的真实几何体 ----
  const cssRoot = new THREE.Group(); cssRoot.matrixAutoUpdate = false; (propsRenderer ? propsScene : scene).add(cssRoot);
  const deskUp = new THREE.Group(); deskUp.position.set(0, 380, 0); deskUp.scale.y = -1; cssRoot.add(deskUp);   // 局部坐标：y 从桌面向上，1 单位 = 1 毫米
  const lamp = new THREE.PointLight(0xffd2a0, 1.7, 0, 0); lamp.position.set(620, 300, 200); deskUp.add(lamp);
  const pm = {
    ceramic: new THREE.MeshStandardMaterial({ color: 0xe9e0d0, roughness: .32 }), coffee: new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: .2 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc09a45, roughness: .3, metalness: .9 }), wood: new THREE.MeshStandardMaterial({ color: 0x3a2414, roughness: .55 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0xd6ebf0, transparent: true, opacity: .3, roughness: .05, metalness: 0, side: THREE.DoubleSide }),
    yellow: new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: .5 }), eraser: new THREE.MeshStandardMaterial({ color: 0xd98a8a, roughness: .7 }),
    ferrule: new THREE.MeshStandardMaterial({ color: 0xb9b9b9, roughness: .3, metalness: .85 }), graphite: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: .4 }), tipwood: new THREE.MeshStandardMaterial({ color: 0xe8c9a0, roughness: .8 })
  };
  const shadowTex = () => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c); };
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex(), transparent: true, depthWrite: false });
  const ground = (r, sx, sz) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), shadowMat); m.rotation.x = -Math.PI / 2; m.scale.set(sx || 1, sz || 1, 1); m.position.y = .6; return m; };
  // 马克杯
  const mug = new THREE.Group(); mug.position.set(560, 0, -330); deskUp.add(mug);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(45, 41, 95, 48, 1, true), pm.ceramic); body.material.side = THREE.DoubleSide; body.position.y = 47.5; mug.add(body);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(41, 48), pm.ceramic); bottom.rotation.x = -Math.PI / 2; bottom.position.y = .5; mug.add(bottom);
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(43, 48), pm.coffee); coffee.rotation.x = -Math.PI / 2; coffee.position.y = 86; mug.add(coffee);
  const mugRim = new THREE.Mesh(new THREE.TorusGeometry(45, 2.6, 10, 48), pm.ceramic); mugRim.rotation.x = Math.PI / 2; mugRim.position.y = 95; mug.add(mugRim);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(30, 6.5, 12, 32, Math.PI), pm.ceramic); handle.rotation.z = -Math.PI / 2; handle.position.set(44, 50, 0); mug.add(handle);
  mug.add(ground(70, 1.15, 1));
  // 铅笔
  const pencil = new THREE.Group(); pencil.position.set(-590, 4, -120); pencil.rotation.y = -1.25; deskUp.add(pencil);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 186, 6), pm.yellow); shaft.rotation.z = Math.PI / 2; pencil.add(shaft);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(4, 16, 6), pm.tipwood); tip.rotation.z = -Math.PI / 2; tip.position.x = 101; pencil.add(tip);
  const lead = new THREE.Mesh(new THREE.ConeGeometry(1.4, 5, 6), pm.graphite); lead.rotation.z = -Math.PI / 2; lead.position.x = 111; pencil.add(lead);
  const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.3, 9, 12), pm.ferrule); ferrule.rotation.z = Math.PI / 2; ferrule.position.x = -97; pencil.add(ferrule);
  const eraser = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 3.9, 9, 12), pm.eraser); eraser.rotation.z = Math.PI / 2; eraser.position.x = -106; pencil.add(eraser);
  const pShadow = ground(20, 5.4, .5); pShadow.position.set(2, -3.4, 4); pencil.add(pShadow);
  // 放大镜
  const mag = new THREE.Group(); mag.position.set(480, 0, 260); mag.rotation.y = 1.2; deskUp.add(mag);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(60, 7, 16, 64), pm.brass); ring.rotation.x = Math.PI / 2; ring.position.y = 9; mag.add(ring);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(55, 64), pm.glass); lens.rotation.x = -Math.PI / 2; lens.position.y = 9; mag.add(lens);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(11, 12, 22, 20), pm.brass); collar.rotation.z = Math.PI / 2; collar.position.set(72, 9, 0); mag.add(collar);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 12, 130, 24), pm.wood); grip.rotation.z = Math.PI / 2; grip.position.set(147, 10, 0); mag.add(grip);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(12, 20, 14), pm.brass); cap.position.set(214, 10, 0); mag.add(cap);
  const mShadow = ground(70, 1.9, 1); mShadow.position.x = 80; mag.add(mShadow);
  // ---- 左墙的书柜：开放式书架立在桌面上，背靠墙（局部坐标：x 伸进房间，y 从桌面向上，z 沿着墙）----
  const wallL = new THREE.Group(); wallL.position.set(-1000, 380, 0); wallL.scale.y = -1; cssRoot.add(wallL);
  const bm = {
    wood: new THREE.MeshStandardMaterial({ color: 0x4a3120, roughness: .6 }), woodDark: new THREE.MeshStandardMaterial({ color: 0x22150e, roughness: .85 }),
    pages: new THREE.MeshStandardMaterial({ color: 0xe4d9c0, roughness: .92 }), label: new THREE.MeshStandardMaterial({ color: 0xece0c2, roughness: .8 }), gold: new THREE.MeshStandardMaterial({ color: 0xc9a24a, roughness: .4, metalness: .6 }),
    covers: [0x7a2e24, 0x2e3f5c, 0xb08a3a, 0x3a5a3a, 0x6a3a2a, 0xd8c8a8, 0x2b2b2b, 0x8a4a3a, 0x2a4a6a, 0xc2a36a, 0x5a2a2a, 0x1f2a1f].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .78 }))
  };
  const box = (w, h, d, m) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  const BW = 380, BH = 632, BD = 240, T = 18, BAYS = 3, bayH = (BH - T * (BAYS + 1)) / BAYS;
  const bookcase = new THREE.Group(); bookcase.position.set(0, 1, -370); wallL.add(bookcase);
  const back = box(8, BH, BW - 2 * T, bm.woodDark); back.position.set(4, BH / 2, 0); bookcase.add(back);
  [-1, 1].forEach(sg => { const side = box(BD, BH, T, bm.wood); side.position.set(BD / 2, BH / 2, sg * (BW - T) / 2); bookcase.add(side); });
  for (let i = 0; i <= BAYS; i++) {
    const y = i * (bayH + T) + T / 2, sh = box(BD - 6, T, BW - 2 * T, bm.wood); sh.position.set(BD / 2 - 3, y, 0); bookcase.add(sh);
    const lip = box(5, T + 4, BW - 2 * T, bm.woodDark); lip.position.set(BD - 8.5, y, 0); bookcase.add(lip);
  }
  const crown = box(BD + 16, 12, BW + 22, bm.wood); crown.position.set(BD / 2 + 4, BH + 6, 0); bookcase.add(crown);
  const bShadow = ground(200, .7, 1.05); bShadow.position.set(BD / 2 + 30, .8, 0); bookcase.add(bShadow);
  let seed = 11; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const zStart = -(BW / 2 - T) + 6, zSpan = BW - 2 * T - 12;
  const mkBook = (d, h, t, cov) => new THREE.Mesh(new THREE.BoxGeometry(d, h, t), [cov, bm.pages, bm.pages, bm.pages, cov, cov]);   // 书脊 +x，书口 -x/上下，封面 ±z
  for (let i = 0; i < BAYS; i++) {
    const y0 = i * (bayH + T) + T, fill = [.96, .76, .56][i];
    let z = zStart;
    while (z < zStart + zSpan * fill) {
      const t = 16 + rnd() * 28, h = 118 + rnd() * 54, d = 130 + rnd() * 40, cov = bm.covers[Math.floor(rnd() * bm.covers.length)], fx = BD - 12 - rnd() * 18;
      if (z + t > zStart + zSpan) break;
      const b = mkBook(d, h, t, cov); b.position.set(fx - d / 2, y0 + h / 2, z + t / 2); bookcase.add(b);
      const lab = box(1.6, 9 + rnd() * 8, Math.max(5, t - 7), rnd() < .3 ? bm.gold : bm.label); lab.position.set(fx + .8, y0 + h * (.66 + rnd() * .14), z + t / 2); bookcase.add(lab);
      z += t + (rnd() < .18 ? 5 : 1.2);
    }
    if (i === 1) {   // 一本斜靠在这一排末尾
      const t = 24, h = 148, d = 150, a = .3, lean = new THREE.Group(); lean.position.set(0, y0, z + h * Math.sin(a) + 2); lean.rotation.x = -a; bookcase.add(lean);
      const lb = mkBook(d, h, t, bm.covers[7]); lb.position.set(BD - 16 - d / 2, h / 2, t / 2); lean.add(lb);
      const ll = box(1.6, 14, t - 7, bm.gold); ll.position.set(BD - 16 + .8, h * .72, t / 2); lean.add(ll);
    }
    if (i === 2) {   // 顶层末尾平放一小摞
      let yy = y0; const zc = z + 72;
      [[168, 22, 118, 3], [150, 16, 104, 9], [176, 26, 120, 1]].forEach(([d2, t2, h2, ci]) => { const cov = bm.covers[ci], f = new THREE.Mesh(new THREE.BoxGeometry(d2, t2, h2), [cov, bm.pages, cov, cov, bm.pages, bm.pages]); f.position.set(BD - 18 - d2 / 2, yy + t2 / 2, zc); f.rotation.y = (rnd() - .5) * .14; bookcase.add(f); yy += t2; });
    }
  }
  let camEl = null, driftEl = null, lastA = '', lastB = '';
  const toM4 = (css) => { const m = new THREE.Matrix4(); if (!css || css === 'none') return m; const d = new DOMMatrix(css); return m.set(d.m11, d.m21, d.m31, d.m41, d.m12, d.m22, d.m32, d.m42, d.m13, d.m23, d.m33, d.m43, d.m14, d.m24, d.m34, d.m44); };
  function syncRoom() {
    if (!camEl || !driftEl) return false;
    const a = getComputedStyle(camEl).transform, b = getComputedStyle(driftEl).transform;
    if (a === lastA && b === lastB) return false;
    lastA = a; lastB = b;
    cssRoot.matrix.copy(new THREE.Matrix4().makeScale(1, -1, 1)).multiply(new THREE.Matrix4().makeScale(k, k, k)).multiply(toM4(a)).multiply(toM4(b));
    return true;
  }

  let model = null, joints = {}, curlBones = [], ready = false, meshes = [];
  new GLTFLoader().load(HAND_URL, (gltf) => {
    model = gltf.scene;
    model.traverse(o => { if (o.isMesh) { o.frustumCulled = false; meshes.push(o); } if (o.isBone || o.type === 'Bone' || o.name) joints[o.name] = o; });
    applyStyle();
    model.updateMatrixWorld(true);
    // glb 里的骨架是扁平的（每个关节都直接挂在 armature 下）—— 串成链，弯一个指节才能带动整根手指
    const chain = (names) => { for (let i = 1; i < names.length; i++) { const p = joints[names[i - 1]], c = joints[names[i]]; if (p && c && c.parent !== p) p.attach(c); } };
    ['thumb', ...FINGERS].forEach(f => chain(['wrist', `${f}-metacarpal`, `${f}-phalanx-proximal`, ...(f === 'thumb' ? [] : [`${f}-phalanx-intermediate`]), `${f}-phalanx-distal`, `${f}-tip`]));
    model.updateMatrixWorld(true);
    const wp = n => { const o = joints[n]; if (!o) return null; const v = new THREE.Vector3(); o.getWorldPosition(v); return v; };
    const wrist = wp('wrist'), midTip = wp('middle-finger-tip'), idxM = wp('index-finger-metacarpal'), pkM = wp('pinky-finger-metacarpal');
    if (wrist && midTip && idxM && pkM) {
      const fwd = midTip.clone().sub(wrist).normalize();
      const side = idxM.clone().sub(pkM).normalize();                       // 小指 → 食指（拇指那一侧）
      const palm = new THREE.Vector3().crossVectors(side, fwd).normalize();  // 掌心法线（右手：拇指侧 × 手指）
      const back = palm.clone().negate();
      const right = new THREE.Vector3().crossVectors(fwd, back).normalize();
      const M = new THREE.Matrix4().makeBasis(right, fwd, back);
      const q = new THREE.Quaternion().setFromRotationMatrix(M).invert();  // 模型 →（手指 +Y，手背 +Z = 朝向观众）
      const len = midTip.distanceTo(wrist);
      const holder = new THREE.Group(); holder.quaternion.copy(q); holder.scale.setScalar(0.19 / len);
      // 掌心（约在手长的 45% 处）落在 rig 原点
      const palmC = wrist.clone().lerp(midTip, .45).applyQuaternion(q).multiplyScalar(0.19 / len);
      holder.position.copy(palmC.negate());
      holder.add(model); rig.add(holder); rig.updateMatrixWorld(true);
      const qw = new THREE.Quaternion(); holder.getWorldQuaternion(qw);
      const palmW = palm.clone().applyQuaternion(qw), sideW = side.clone().applyQuaternion(qw), midK = joints['middle-finger-phalanx-proximal'];
      // 每根骨头的弯曲轴，在各自的静止坐标系里算
      const add = (name, next, amt, useSide, adduct) => {
        const b = joints[name], n = joints[next]; if (!b || !n) return;
        const bw = new THREE.Vector3(), nw = new THREE.Vector3(); b.getWorldPosition(bw); n.getWorldPosition(nw);
        const inv = new THREE.Quaternion(); b.getWorldQuaternion(inv).invert();
        const d = nw.clone().sub(bw).normalize().applyQuaternion(inv), pk = palmW.clone().applyQuaternion(inv).normalize();
        // 铰链轴：手指用指节连线，拇指用朝掌心折叠的方向；符号取成 +角度 = 向掌心弯
        let axis;
        if (useSide) { const sl = sideW.clone().applyQuaternion(inv); axis = sl.sub(d.clone().multiplyScalar(sl.dot(d))).normalize(); }
        else axis = new THREE.Vector3().crossVectors(pk, d).normalize();
        if (new THREE.Vector3().crossVectors(axis, d).dot(pk) < 0) axis.negate();
        // 内收（手指合拢，抓握时拇指扫过掌心）：绕掌心法线朝中指指节转
        let adAxis = null;
        if (adduct && midK) { const tw = new THREE.Vector3(); midK.getWorldPosition(tw); const toT = tw.sub(bw).applyQuaternion(inv); adAxis = pk.clone(); if (new THREE.Vector3().crossVectors(adAxis, d).dot(toT) < 0) adAxis.negate(); }
        const finger = name.replace(/-(phalanx|metacarpal).*$/, '');
        curlBones.push({ b, name, finger, rest: b.quaternion.clone(), axis, amt, adAxis, ad: adduct || 0 });
      };
      const AD = { 'index-finger': .16, 'middle-finger': 0, 'ring-finger': .1, 'pinky-finger': .22 };
      FINGERS.forEach(f => { add(`${f}-phalanx-proximal`, `${f}-phalanx-intermediate`, .95, true, AD[f]); add(`${f}-phalanx-intermediate`, `${f}-phalanx-distal`, 1.25, true); add(`${f}-phalanx-distal`, `${f}-tip`, .55, true); });
      add('thumb-metacarpal', 'thumb-phalanx-proximal', .22, false, .7); add('thumb-phalanx-proximal', 'thumb-phalanx-distal', .45); add('thumb-phalanx-distal', 'thumb-tip', .35);
      calibrate();
    } else { rig.add(model); }
    ready = true; if (opts.onReady) opts.onReady(); kick();
  }, undefined, (err) => { if (opts.onError) opts.onError(err); });

  function applyStyle() { const m = style === 'skin' ? mats.skin : mats.glove; meshes.forEach(o => { o.material = m; }); }

  // ---- 屏幕映射与补间 ----
  let W = 1440, H = 900, k = 1;
  const cur = { x: -9999, y: -9999, r: -40, curl: .12 }, from = { ...cur }, to = { ...cur };
  let t0 = 0, dur = 0, fn = ease.inOut, curlFrom = cur.curl, curlTo = cur.curl, curlT0 = 0, curlDur = 0, raf = 0, fb = 0, active = false, tiltY = .42, tiltX = -.4, wasVisible = null, propsDirty = true, handDirty = false;
  function resize(w, h, scale) {
    W = w; H = h; k = scale;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); if (propsRenderer) { propsRenderer.setPixelRatio(dpr); propsRenderer.setSize(w, h, false); }
    camera.aspect = w / h; camera.position.set(0, 0, 1100 * k); camera.fov = 2 * Math.atan(h / (2 * 1100 * k)) * 180 / Math.PI; camera.updateProjectionMatrix(); lastA = ''; lastB = ''; propsDirty = true;
    kick();
  }
  function moveTo(p, ms, easing) { Object.assign(from, cur); to.x = p.x; to.y = p.y; to.r = p.r; t0 = performance.now(); dur = ms; fn = ease[easing] || ease.inOut; handDirty = true; kick(); }
  function setCurl(c, ms) { curlFrom = cur.curl; curlTo = c; curlT0 = performance.now(); curlDur = ms; handDirty = true; kick(); }
  function kick() { if (!raf) { raf = requestAnimationFrame(frame); clearTimeout(fb); fb = setTimeout(() => { if (raf) { cancelAnimationFrame(raf); frame(performance.now()); } }, 120); } }
  function pose(c) {
    curlBones.forEach(({ b, rest, axis, amt, finger, adAxis, ad }) => {
      b.quaternion.copy(rest).multiply(new THREE.Quaternion().setFromAxisAngle(axis, amt * (MUL[finger] || 1) * c));
      if (adAxis && ad) b.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(adAxis, ad * c));
    });
  }
  // 捏合标定：在手挂在墙上的姿势下，拟合拇指内收 / 拇指弯曲 / 食指弯曲，
  // 让闭合姿势里拇指指尖在屏幕上正好落在食指指尖处，同时留在它前面约 1.5 厘米（靠观众一侧）—— 纸就塞进这道缝里
  function calibrate() {
    if (!joints['thumb-tip'] || !joints['index-finger-tip']) return;
    calibLog = [];
    hand.rotation.order = 'ZYX'; hand.rotation.set(tiltX, tiltY, THREE.MathUtils.degToRad(40)); hand.scale.setScalar(1); hand.position.set(0, 0, 0);
    const thumbMC = curlBones.find(e => e.name === 'thumb-metacarpal'), knuckle = joints['index-finger-phalanx-proximal'];
    const a = new THREE.Vector3(), c = new THREE.Vector3(), kn = new THREE.Vector3(); let best = null;
    for (const ad of [0, .25, .5, .75, 1, 1.25, 1.5]) for (const tm of [.3, .5, .7, .9, 1.1, 1.3, 1.5]) for (const im of [.25, .35, .45, .55, .65, .75, .85, .95]) {
      MUL.thumb = tm; MUL['index-finger'] = im; if (thumbMC) thumbMC.ad = ad;
      pose(.9); hand.updateMatrixWorld(true);
      joints['thumb-tip'].getWorldPosition(a); joints['index-finger-tip'].getWorldPosition(c); if (knuckle) knuckle.getWorldPosition(kn);
      const sep = a.z - c.z, gap = Math.hypot(a.x - c.x, a.y - c.y), mid = (a.z + c.z) / 2;
      const cost = gap + Math.max(0, .014 - sep) * 8 + Math.max(0, sep - .03) * 3 + (knuckle ? Math.max(0, .006 - (kn.z - mid)) * 8 : 0);
      if (!best || cost < best.cost) best = { ad, tm, im, sep, gap, cost, mid: a.clone().add(c).multiplyScalar(.5) };
    }
    MUL.thumb = best.tm; MUL['index-finger'] = best.im; if (thumbMC) thumbMC.ad = best.ad;
    calibLog = [best.ad, best.tm, best.im, +best.sep.toFixed(4), +best.gap.toFixed(4), +best.cost.toFixed(4)];
    pinchLocal.copy(hand.worldToLocal(best.mid.clone()));
    pose(cur.curl); handDirty = true;
  }
  function frame(now) {
    raf = 0; clearTimeout(fb);
    let busy = false, prog = 1;
    if (dur > 0) { const t = Math.min(1, (now - t0) / dur), e = fn(t); prog = e; cur.x = from.x + (to.x - from.x) * e; cur.y = from.y + (to.y - from.y) * e; cur.r = from.r + (to.r - from.r) * e; if (t < 1) busy = true; else dur = 0; }
    else { cur.x = to.x; cur.y = to.y; cur.r = to.r; }
    if (curlDur > 0) { const t = Math.min(1, (now - curlT0) / curlDur); cur.curl = curlFrom + (curlTo - curlFrom) * ease.inOut(t); if (t < 1) busy = true; else curlDur = 0; }
    else cur.curl = curlTo;
    const onScreen = cur.x > -400 * k && cur.x < W + 400 * k && cur.y > -400 * k && cur.y < H + 400 * k;
    const roomMoved = syncRoom();
    hand.visible = ready && (onScreen || active);
    if (roomMoved || busy || handDirty || hand.visible !== wasVisible) {
      wasVisible = hand.visible; handDirty = false;
      const S = 1280 * k, d = 1100 * k;
      let rect = null;
      if (hand.visible) {
        hand.rotation.order = 'ZYX'; hand.rotation.set(tiltX, tiltY, -THREE.MathUtils.degToRad(cur.r)); hand.scale.setScalar(S);
        pose(cur.curl);
        // cur 是捏点（闭合姿势下拇指尖 ↔ 食指尖）在屏幕上的落点，反推出手的原点
        const o = pinchLocal.clone().applyEuler(hand.rotation).multiplyScalar(S), f = d / (d - o.z);
        hand.position.set((cur.x - W / 2) / f - o.x, (H / 2 - cur.y) / f - o.y, 0);
        hand.updateMatrixWorld(true);
        rect = paperRect;
        if (held) {   // 被捏住的纸挂在捏点上
          const rot = held.r0 + (held.r1 - held.r0) * prog, m = held.s0 + (held.s1 - held.s0) * prog, a = rot * Math.PI / 180;
          const ax = held.ax * held.w * m, ay = held.ay * held.h * m;
          const cx = cur.x - (ax * Math.cos(a) - ay * Math.sin(a)), cy = cur.y - (ax * Math.sin(a) + ay * Math.cos(a));
          if (held.el) {   // 用 Web Animations 而不是写 style：每秒 60 次属性写入会拖慢页面
            const T = `translate(${cx}px, ${cy}px) rotate(${rot}deg) scale(${k * m}) translate(${-held.w / k / 2}px, ${-held.h / k / 2}px)`;
            try {
              if (!held.anim || held.anim.effect.target !== held.el) { if (held.anim) held.anim.cancel(); held.anim = held.el.animate([{ transform: T }, { transform: T }], { duration: 1000, fill: 'both' }); held.anim.pause(); }
              else held.anim.effect.setKeyframes([{ transform: T }, { transform: T }]);
            } catch (_) {}
          }
          rect = { x: cx, y: cy, w: held.w * m, h: held.h * m, r: rot };
        }
      }
      let zShadow = -.02 * S;
      if (hand.visible && rect && joints['thumb-tip'] && joints['index-finger-tip']) {
        // 捏住之后纸夹在拇指（前）和食指尖（后）之间；手张开时纸整体在手后面
        joints['thumb-tip'].getWorldPosition(tipA); joints['index-finger-tip'].getWorldPosition(tipB);
        const pf = Math.max(0, Math.min(1, (cur.curl - .35) / .5));
        const zp = pf * (tipA.z + tipB.z) / 2 + (1 - pf) * (Math.min(tipA.z, tipB.z, 0) - 30 * k), fp = d / (d - zp);
        paper.visible = true; paper.position.set((rect.x - W / 2) / fp, (H / 2 - rect.y) / fp, zp); paper.scale.set(rect.w / fp, rect.h / fp, 1); paper.rotation.z = -rect.r * Math.PI / 180;
        zShadow = Math.max(zShadow, zp + 8 * k);
      } else paper.visible = false;
      shadow.visible = hand.visible; shadow.position.set(hand.position.x + .06 * S, hand.position.y - .08 * S, zShadow); shadow.scale.setScalar(S);
      renderer.render(scene, camera);
      active = onScreen;
    }
    if (propsRenderer && (roomMoved || propsDirty)) { propsDirty = false; propsRenderer.render(propsScene, camera); }
    if (busy || camEl) kick();
  }
  return {
    resize, moveTo, setCurl,
    setStyle(s) { style = s; applyStyle(); kick(); },
    setTilt(y) { tiltY = y; kick(); },
    setSceneEls(c, d) { camEl = c; driftEl = d; lastA = ''; lastB = ''; kick(); },
    setPaper(r) { paperRect = r || null; handDirty = true; kick(); },   // 手即将捏起的那张纸（屏幕中心、尺寸、旋转）
    tune(o) { Object.assign(MUL, o.mul || {}); if (o.tiltY !== undefined) tiltY = o.tiltY; if (o.tiltX !== undefined) tiltX = o.tiltX; calibrate(); kick(); },
    hold(h) { if (held && held.anim && !(h && h.el === held.el)) { try { held.anim.cancel(); } catch (_) {} } if (h && held && held.anim && h.el === held.el) h.anim = held.anim; held = h || null; handDirty = true; kick(); },           // 手捏着的纸：{ w, h, ax, ay, r0, r1, s0, s1, el }，每帧驱动
    debug() { try { frame(performance.now()); return { ready, cur: { ...cur }, to: { ...to }, W, H, k, frames: renderer.info.render.frame, hv: hand.visible, hp: hand.position.toArray().map(Math.round), wasVisible, active, camEl: !!camEl, bones: curlBones.length, pinch: pinchLocal.toArray().map(v => +v.toFixed(3)), calib: calibLog, mul: { ...MUL }, tips: [+tipA.z.toFixed(1), +tipB.z.toFixed(1)], paper: paper.visible, held: !!held, curl: cur.curl, err: null }; } catch (e) { return { err: String(e && e.stack || e) }; } },
    get ready() { return ready; },
    dispose() { cancelAnimationFrame(raf); clearTimeout(fb); renderer.dispose(); if (propsRenderer) propsRenderer.dispose(); }
  };
}
