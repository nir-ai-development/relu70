import { THREE, paint, mesh, photoTex, makeSky, Timeline, sound } from './engine.js';
import { skyEnvironment, tileSet } from './gfx.js';
import { makeFigure } from './character.js';
import { model } from './models.js';

// Level 6 · Jerusalem, 1980
// Relu meets Aline. A memory game on the promenade at sunset: twelve cards hide six pairs from their story.
// Every pair brings the two of them a step closer; when all are found they dance. Fewer misses, more stars.

const PAIRS = [
  { icon: '❤️', he: 'אהבה' }, { icon: '🌹', he: 'ורד' }, { icon: '☕', he: 'קפה' },
  { icon: '🎵', he: 'שיר' }, { icon: '📷', he: 'תמונה' }, { icon: '💍', he: 'טבעת' },
];

function buildPromenade(own) {
  const g = new THREE.Group();
  // the stone terrace
  // (Jerusalem stone pavers, wide enough that the terrace runs out of the picture on a wide screen)
  const pavers = tileSet({ tiles: 3, rgb: [226, 204, 164], vary: 18, grout: '#a8946e', groutW: 6, rough: 0.55, seed: 29 });
  for (const t of [pavers.map, pavers.normalMap, pavers.roughnessMap]) t.repeat.set(60 / 4.5, 28 / 4.5);
  own.push(pavers);
  const stone = new THREE.MeshStandardMaterial({ map: pavers.map, normalMap: pavers.normalMap, roughnessMap: pavers.roughnessMap, roughness: 1, envMapIntensity: 0.8 });
  const floor = mesh(new THREE.PlaneGeometry(60, 28), stone, 0, 0, 9); floor.rotation.x = -Math.PI / 2; floor.castShadow = false; g.add(floor);
  // the balustrade along the edge, the Old City beyond it
  const rail = paint(0xdcc49a, { roughness: 0.9 });
  g.add(mesh(new THREE.BoxGeometry(30, 0.3, 0.6), rail, 0, 1.9, -5));
  g.add(mesh(new THREE.BoxGeometry(30, 0.25, 0.7), rail, 0, 0.12, -5));
  for (let x = -14.5; x <= 14.5; x += 0.7) g.add(mesh(new THREE.CylinderGeometry(0.13, 0.18, 1.65, 8), rail, x, 0.95, -5));
  const view = new THREE.Mesh(new THREE.PlaneGeometry(150, 84), new THREE.MeshBasicMaterial({ map: photoTex('assets/jerusalem_view.jpg'), toneMapped: false, fog: false }));
  view.position.set(0, 14, -62); g.add(view);
  // street lamps lighting up for the evening
  for (const x of [-7, 7]) {
    g.add(mesh(new THREE.CylinderGeometry(0.08, 0.12, 4.6, 8), paint(0x2c2c2c, { metalness: 0.5, roughness: 0.4 }), x, 2.3, -4.2));
    const bulb = mesh(new THREE.SphereGeometry(0.28, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfff1c8, emissive: 0xffc870, emissiveIntensity: 3.4 }), x, 4.75, -4.2);
    bulb.castShadow = false; g.add(bulb);
    const l = new THREE.PointLight(0xffc477, 8, 10, 1.6); l.position.set(x, 4.6, -4); g.add(l);
  }
  // a bougainvillea pot or two
  const pot = (x, z) => {
    const p = new THREE.Group(); p.position.set(x, 0, z); g.add(p);
    p.add(mesh(new THREE.CylinderGeometry(0.55, 0.42, 0.9, 12), paint(0xb5653e), 0, 0.45, 0));
    for (let i = 0; i < 26; i++) { const b = mesh(new THREE.SphereGeometry(0.22 + Math.random() * 0.12, 7, 5), paint([0xd23c8f, 0xe25aa5, 0x4f8a3c][i % 3], { roughness: 1 }), (Math.random() - 0.5) * 1.3, 1.1 + Math.random() * 1.1, (Math.random() - 0.5) * 1.1); p.add(b); }
  };
  pot(-9.5, -3.8); pot(9.5, -3.8);
  return g;
}

export class Level6 {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf0b88a);
    this.scene.fog = new THREE.Fog(0xf2c49a, 30, 90);
    const SKY = { top: '#5a6fb0', mid: '#e8a58a', horizon: '#ffd39a', sunDir: [-0.6, 0.12, -1], sunColor: '#ffe0a8', radius: 120 };
    this.scene.add(makeSky(SKY));
    this.look = { exposure: 0.84, bloom: [0.34, 0.65, 1.15] };
    this.envTarget = skyEnvironment(SKY, 0xc9a97c);
    this.scene.environment = this.envTarget.texture;
    this.own = [];
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
    this.t = 0;
    this.paused = false;
    this.aspect = 1;
    this.phase = 'ready';
    this.music = false;

    this.scene.add(new THREE.HemisphereLight(0xffe2c8, 0x7a5a50, 0.6));
    const sun = new THREE.DirectionalLight(0xffc98f, 2.3); sun.position.set(-8, 6, -6);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 4; sun.shadow.normalBias = 0.02;
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
    this.scene.add(sun);
    const front = new THREE.DirectionalLight(0xfff0e0, 0.7); front.position.set(3, 4, 9); this.scene.add(front);
    this.scene.add(buildPromenade(this.own));

    const table = model('cafeTable');
    if (table) { table.position.set(0, 0, -3.4); this.scene.add(table); }   // where the two of them end up
    this.relu = makeFigure('officer', 3.55);
    this.aline = makeFigure('aline', 3.3);
    if (this.relu) { this.relu.rotation.y = 0.5; this.scene.add(this.relu); }
    if (this.aline) { this.aline.rotation.y = -0.5; this.scene.add(this.aline); }

    // little hearts that float up on every match
    this.hearts = [];
    this.heartTex = new THREE.CanvasTexture((() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.font = '52px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('❤️', 32, 36); return c; })());

    this.buildOverlay();
    this.startRun();
  }

  buildOverlay() {
    if (!document.getElementById('memory-style')) {
      const st = document.createElement('style'); st.id = 'memory-style';
      st.textContent = `
        #memory{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(12px + env(safe-area-inset-bottom));width:min(94vw,520px);z-index:5;
          display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;perspective:600px}
        #memory .card{aspect-ratio:3/3.4;position:relative;transform-style:preserve-3d;transition:transform .35s;cursor:pointer;touch-action:manipulation}
        #memory .card.open,#memory .card.done{transform:rotateY(180deg)}
        #memory .card > div{position:absolute;inset:0;border-radius:12px;backface-visibility:hidden;display:flex;flex-direction:column;align-items:center;justify-content:center;
          box-shadow:0 4px 0 rgba(0,0,0,.2)}
        #memory .back{background:repeating-linear-gradient(45deg,#c8384a 0 8px,#d9485a 8px 16px);border:3px solid #fff4ea}
        #memory .back::after{content:"R ♥ A";font:16px "Secular One",sans-serif;color:#fff4ea;letter-spacing:1px}
        #memory .face{background:#fff8ef;transform:rotateY(180deg);font:clamp(28px,8vw,40px) serif}
        #memory .face small{font:clamp(11px,3vw,14px) "Secular One",sans-serif;color:#7a3a3a;margin-top:2px;max-width:100%;padding:0 3px;text-align:center;overflow-wrap:anywhere}
        #memory .card.done .face{background:#ffe6a8}
        @media (orientation:landscape) and (max-height:520px){#memory{width:min(60vw,440px);grid-template-columns:repeat(6,minmax(0,1fr))}}`;
      document.head.appendChild(st);
    }
    const el = this.el = document.createElement('div'); el.id = 'memory';
    document.body.appendChild(el);
    el.addEventListener('click', e => { const c = e.target.closest('.card'); if (c) { sound.unlock(); this.flip(+c.dataset.i); } });
  }
  layoutOverlay() {}
  move() {}
  jump() {}

  startRun() {
    this.phase = 'run';
    this.ending = false; this.close = 0; this.resize(this.aspect);
    this.tl = new Timeline();
    const deck = PAIRS.flatMap((p, k) => [k, k]);
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    this.deck = deck.map(k => ({ k, state: 'down' }));
    this.open = []; this.found = 0; this.misses = 0; this.busy = false;
    this.el.style.visibility = 'visible';
    this.el.innerHTML = this.deck.map((c, i) => `<div class="card" data-i="${i}"><div class="back"></div><div class="face">${PAIRS[c.k].icon}<small>${PAIRS[c.k].he}</small></div></div>`).join('');
    this.cards = [...this.el.children];
    this.gap = 1;   // how far apart the two of them still stand (1 = across the terrace, 0 = side by side)
    this.app.hud({ stamps: 0, progress: 0 });
  }

  flip(i) {
    const c = this.deck[i];
    if (this.paused || this.phase !== 'run' || this.busy || c.state !== 'down') return;
    c.state = 'open'; this.cards[i].classList.add('open'); this.open.push(i);
    sound.tone(660, 0.05, 'sine', 0.08);
    if (this.open.length < 2) return;
    const [a, b] = this.open;
    this.open = [];
    if (this.deck[a].k === this.deck[b].k) {
      for (const j of [a, b]) { this.deck[j].state = 'done'; this.cards[j].classList.add('done'); }
      this.found++;
      sound.tone(880, 0.12, 'sine', 0.12); setTimeout(() => sound.tone(1175, 0.2, 'sine', 0.1), 120);
      this.app.hud({ stamps: this.found, progress: this.found / PAIRS.length });
      this.burst(5);
      if (this.found === PAIRS.length) this.finish();
    } else {
      this.misses++;
      this.busy = true;
      this.tl.add(0.75, 0.01, null, () => {
        for (const j of [a, b]) { this.deck[j].state = 'down'; this.cards[j].classList.remove('open'); }
        this.busy = false;
      });
    }
  }

  burst(n) {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.heartTex, transparent: true, depthWrite: false }));
      s.position.set((Math.random() - 0.5) * 1.6, 3.2 + Math.random() * 0.8, -1.5 + Math.random() * 0.5);
      s.scale.setScalar(0.5 + Math.random() * 0.3);
      this.scene.add(s);
      this.hearts.push({ s, life: 1.6 + Math.random() * 0.6, vx: (Math.random() - 0.5) * 0.6 });
    }
  }

  finish() {
    this.phase = 'done'; this.ending = true;
    this.tl.add(0.6, 0.01, null, () => { this.el.style.visibility = 'hidden'; sound.fanfare(); this.app.toast('אלין ורלו 💍'); });
    this.tl.add(0.8, 2.4, p => { if (p * 10 % 1 < 0.1) this.burst(2); });
    // the cards are gone: move in close on the two of them dancing
    this.tl.add(0.5, 1.6, p => { this.close = p * p * (3 - 2 * p); this.resize(this.aspect); });
    this.tl.add(4.2, 0.01, null, () => this.app.levelComplete(this.result()));
  }

  result() {
    const stars = this.misses <= 4 ? 3 : this.misses <= 9 ? 2 : 1;
    return { stars, summary: `מצאת את כל הזוגות עם ${this.misses} ניחושים שגויים.` };
  }

  resize(aspect) {
    this.aspect = aspect;
    const c = this.camera;
    c.aspect = aspect;
    c.fov = aspect < 1 ? 56 : 40;
    const k = this.close || 0, mix = (a, b) => a + (b - a) * k;
    c.position.set(0, mix(aspect < 1 ? 4.4 : 3.6, 2.7), mix(aspect < 1 ? 12.5 : 10, aspect < 1 ? 5.4 : 5.8));
    c.lookAt(0, mix(aspect < 1 ? 2.8 : 2.4, 2.1), mix(-2, -1.6));   // (heads below the toast)
    const H = 1000, Wd = H * aspect;
    // the cards cover the lower part of the screen; lift the couple above them (until the close-up at the end)
    c.setViewOffset(Wd, H, 0, mix(H * (aspect < 1 ? 0.3 : 0.2), H * 0.05), Wd, H);
    c.updateProjectionMatrix();
  }

  update(dt) {
    if (this.paused) return;
    this.t += dt;
    this.tl.update(dt);
    // every pair found brings them a step closer: they walk, facing each other, then turn back to chat
    const target = this.phase === 'done' ? 0 : 1 - this.found / PAIRS.length;
    const range = this.aspect < 1 ? 1.4 : 2.4, base = this.aspect < 1 ? 0.75 : 1.0;
    const step = dt * 1.0 / range;   // about one unit a second
    const moving = Math.abs(target - this.gap) > 0.004;
    this.gap += THREE.MathUtils.clamp(target - this.gap, -step, step);
    const sep = base + this.gap * range;
    const done = this.phase === 'done';
    const inward = moving ? 1.35 : done ? 1.0 : 0.5;
    this.turnIn = (this.turnIn ?? 0.5) + (inward - (this.turnIn ?? 0.5)) * Math.min(1, dt * 6);
    if (this.relu) { this.relu.position.set(-sep, 0, -1.6); this.relu.rotation.y = this.turnIn; this.relu.userData.animate(this.t, moving ? 'walk' : done ? 'dance' : this.gap > 0.5 ? 'idle' : 'talk', moving ? 0.8 : 1); }
    if (this.aline) { this.aline.position.set(sep, 0, -1.6); this.aline.rotation.y = -this.turnIn; this.aline.userData.animate(this.t + 0.4, moving ? 'walk' : done ? 'dance' : this.gap > 0.5 ? 'idle' : 'sway', moving ? 0.8 : 1); }
    for (const h of this.hearts) { h.life -= dt; h.s.position.y += dt * 0.9; h.s.position.x += h.vx * dt; h.s.material.opacity = Math.min(1, h.life); }
    this.hearts = this.hearts.filter(h => { if (h.life > 0) return true; this.scene.remove(h.s); h.s.material.dispose(); return false; });
  }

  dispose() {
    this.envTarget.dispose(); this.own.forEach(o => o.dispose());
    this.el.remove();
    this.scene.traverse(o => { if (o.geometry && !o.userData.keep) o.geometry.dispose(); });
  }
}
