import { THREE, paint, mesh, photoTex, makeSky, Timeline, sound } from './engine.js';
import { makeFigure } from './character.js';
import { model } from './models.js';

// Level 8 · Saba Relu, 70 (2026) — the finale
// A garden party at dusk. Tap to light the seven candles on the cake, then hold "blow" until they go out.
// Confetti, fireworks, everyone cheers and "Happy Birthday" plays. Everyone who gets here gets three stars.

const CANDLES = 7;
const PHOTOS = ['era1_toddler', 'era2_piano', 'era3_school', 'era4_soldier', 'era5_doctor', 'era6_aline', 'era7_dad', 'era8_saba'];
// Happy Birthday: [frequency, beats]
const N = { G4: 392, A4: 440, B4: 493.9, C5: 523.3, D5: 587.3, E5: 659.3, F5: 698.5, G5: 784 };
const SONG = [['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['C5', 1], ['B4', 2],
  ['G4', 0.75], ['G4', 0.25], ['A4', 1], ['G4', 1], ['D5', 1], ['C5', 2],
  ['G4', 0.75], ['G4', 0.25], ['G5', 1], ['E5', 1], ['C5', 1], ['B4', 1], ['A4', 2],
  ['F5', 0.75], ['F5', 0.25], ['E5', 1], ['C5', 1], ['D5', 1], ['C5', 3]];

function buildGarden() {
  const g = new THREE.Group();
  const grass = mesh(new THREE.CircleGeometry(40, 48), paint(0x5f8f45, { roughness: 1 }));
  grass.rotation.x = -Math.PI / 2; grass.castShadow = false; g.add(grass);
  // the long party table with a white cloth
  const cloth = paint(0xfaf6ee, { roughness: 0.9 });
  g.add(mesh(new THREE.BoxGeometry(7, 0.12, 2.4), cloth, 0, 1.55, 0));
  g.add(mesh(new THREE.BoxGeometry(7.1, 0.9, 2.5), cloth, 0, 1.1, 0));
  for (const x of [-3.2, 3.2]) for (const z of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 8), paint(0x8a6a4a), x, 0.75, z));
  // plates and cups along the table
  for (let i = 0; i < 6; i++) {
    const x = -3 + i * 1.2; if (Math.abs(x) < 0.9) continue;
    g.add(mesh(new THREE.CylinderGeometry(0.32, 0.3, 0.04, 20), paint(0xffffff, { roughness: 0.4 }), x, 1.63, 0.6));
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.28, 12), paint([0xe25a5a, 0x4f8fd6, 0xf2c84b][i % 3]), x + 0.35, 1.75, 0.2));
  }
  // a garland of his photos, from Piatra Neamț to today, strung behind the table
  const line = new THREE.CatmullRomCurve3([new THREE.Vector3(-7, 5.2, -3.4), new THREE.Vector3(0, 4.4, -3.4), new THREE.Vector3(7, 5.2, -3.4)]);
  g.add(mesh(new THREE.TubeGeometry(line, 40, 0.02, 4), paint(0x3a2a1a)));
  PHOTOS.forEach((p, i) => {
    const k = (i + 0.5) / PHOTOS.length, pt = line.getPoint(k);
    const f = new THREE.Group(); f.position.set(pt.x, pt.y - 0.75, pt.z + 0.02); f.rotation.z = (i % 2 ? 1 : -1) * 0.06; g.add(f);
    f.add(mesh(new THREE.BoxGeometry(1.25, 1.0, 0.04), paint(0xfaf6ee)));
    f.add(mesh(new THREE.PlaneGeometry(1.1, 0.82), paint(0xffffff, { map: photoTex(`assets/${p}.jpg`), roughness: 0.6 }), 0, 0.02, 0.03));
  });
  for (const x of [-7, 7]) g.add(mesh(new THREE.CylinderGeometry(0.08, 0.1, 5.4, 8), paint(0x6b4f33), x, 2.7, -3.4));
  // string lights overhead
  const bulbs = new THREE.Group(); g.add(bulbs); g.userData.bulbs = bulbs;
  for (const z of [-1.5, 1.5]) {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(-9, 6.2, z), new THREE.Vector3(0, 5.5, z), new THREE.Vector3(9, 6.2, z)]);
    for (let i = 0; i <= 24; i++) {
      const b = mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff1c0, emissive: 0xffd27a, emissiveIntensity: 2.5 }));
      b.position.copy(c.getPoint(i / 24)); b.castShadow = false; bulbs.add(b);
    }
  }
  // balloons: a 7 and a 0, and a few loose ones
  const balloon = (x, y, z, col) => {
    const b = mesh(new THREE.SphereGeometry(0.45, 16, 12), paint(col, { roughness: 0.35 }), x, y, z); b.scale.y = 1.18; g.add(b);
    g.add(mesh(new THREE.CylinderGeometry(0.01, 0.01, y - 1.7, 3), paint(0xffffff), x, (y + 1.7) / 2 - 0.4, z));
    return b;
  };
  [[-5.5, 4.2, -1.2, 0xe25a5a], [-4.8, 4.8, -1.0, 0xf2c84b], [5.0, 4.5, -1.1, 0x4f8fd6], [5.6, 3.9, -1.3, 0x5bb36a], [-6.2, 3.6, -0.8, 0xc86ad6]].forEach(a => balloon(...a));
  // the big "70" in gold balloon letters
  const gold = paint(0xf2c84b, { roughness: 0.25, metalness: 0.4, emissive: 0x3a2a00 });
  const seven = new THREE.Group(); seven.position.set(-1.0, 6.3, -3.0); g.add(seven);
  const top = mesh(new THREE.CapsuleGeometry(0.22, 0.9, 6, 12), gold); top.rotation.z = Math.PI / 2; seven.add(top);
  const leg = mesh(new THREE.CapsuleGeometry(0.22, 1.3, 6, 12), gold, 0.1, -0.85, 0); leg.rotation.z = -0.45; seven.add(leg);
  const zero = mesh(new THREE.TorusGeometry(0.62, 0.22, 12, 32), gold, 0.9, 5.65, -3.0); zero.scale.y = 1.35; g.add(zero);
  // a few trees around the garden
  for (const [x, z] of [[-12, -8], [12, -7], [-15, 4], [15, 5], [-6, -16]]) { const t = model('tree'); if (t) { t.position.set(x, 0, z); g.add(t); } }
  return g;
}

function makeCandle(i) {
  const c = new THREE.Group();
  const col = [0xe25a5a, 0x4f8fd6, 0xf2c84b, 0x5bb36a, 0xc86ad6, 0xf09a4a, 0x4fc8d6][i % 7];
  c.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.42, 10), paint(col, { roughness: 0.5 }), 0, 0.21, 0));
  c.add(mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 4), paint(0x222222), 0, 0.45, 0));
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc04a, transparent: true, opacity: 0.95 }));
  flame.scale.set(0.8, 1.8, 0.8); flame.position.y = 0.55; flame.visible = false; c.add(flame);
  c.userData.flame = flame;
  return c;
}

export class Level8 {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2c2a52);
    this.scene.fog = new THREE.Fog(0x3a3460, 30, 90);
    this.scene.add(makeSky({ top: '#1d2150', mid: '#7a4f86', horizon: '#f2a86a', sunDir: [0.2, 0.04, -1], sunColor: '#ffcf8a', radius: 120 }));
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 300);
    this.t = 0;
    this.paused = false;
    this.aspect = 1;
    this.phase = 'ready';
    this.music = false;

    this.scene.add(new THREE.HemisphereLight(0xffe0c8, 0x40385a, 0.9));
    const key = new THREE.DirectionalLight(0xffd8a8, 1.6); key.position.set(4, 8, 7);
    key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 4; key.shadow.normalBias = 0.02;
    Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
    this.scene.add(key);
    const warm = new THREE.PointLight(0xffc477, 14, 14, 1.5); warm.position.set(0, 5.4, 1); this.scene.add(warm);
    this.candleLight = new THREE.PointLight(0xffa040, 0, 6, 1.8); this.candleLight.position.set(0, 3.4, 0.4); this.scene.add(this.candleLight);
    this.garden = buildGarden(); this.scene.add(this.garden);

    // the cake on the table, with its candles in a ring on top
    const cake = model('cake');
    this.cakeTop = 1.61 + 0.9;
    if (cake) {
      cake.scale.multiplyScalar(0.8); cake.position.set(0, 1.61, 0.2); this.scene.add(cake);
      // candles stand on the cake's real top layer, found by a ray down its middle
      cake.updateMatrixWorld(true);
      const hit = new THREE.Raycaster(new THREE.Vector3(0.32, 9, 0.2), new THREE.Vector3(0, -1, 0)).intersectObject(cake, true)[0];
      this.cakeTop = hit ? hit.point.y : new THREE.Box3().setFromObject(cake).max.y;
    }
    else this.scene.add(mesh(new THREE.CylinderGeometry(0.8, 0.85, 0.9, 32), paint(0xf6e2c6), 0, 2.05, 0.2));
    this.candles = [];
    for (let i = 0; i < CANDLES; i++) {
      const c = makeCandle(i), a = i / CANDLES * Math.PI * 2;
      c.position.set(Math.cos(a) * 0.32, this.cakeTop - 0.08, 0.2 + Math.sin(a) * 0.32);
      this.scene.add(c); this.candles.push(c);
    }

    this.saba = makeFigure('saba', 3.5);
    if (this.saba) { this.saba.position.set(1.5, 0, -1.7); this.saba.rotation.y = -0.25; this.scene.add(this.saba); }   // beside the cake, so it never hides his face
    // the grandchildren around the table
    this.kids = [['girlKid', 2.1, -2.6, 1.6, 0.5], ['boyKid', 2.4, 2.7, 1.6, -0.5], ['girlKid', 1.8, -3.9, 0.4, 0.9], ['boyKid', 1.9, 4.0, 0.3, -0.9]]
      .map(([k, h, x, z, r]) => { const f = makeFigure(k, h); if (f) { f.position.set(x, 0, z); f.rotation.y = r; this.scene.add(f); } return f; }).filter(Boolean);
    this.parts = [];

    this.buildOverlay();
    this.startRun();
  }

  buildOverlay() {
    if (!document.getElementById('party-style')) {
      const st = document.createElement('style'); st.id = 'party-style';
      st.textContent = `
        #party-hint{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(30px + env(safe-area-inset-bottom));z-index:5;pointer-events:none;
          font:clamp(20px,5.5vw,28px) "Secular One",sans-serif;color:#fff;text-shadow:0 2px 10px rgba(0,0,0,.6);white-space:nowrap}
        #party-blow{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(22px + env(safe-area-inset-bottom));z-index:5;width:150px;height:150px;border-radius:50%;
          border:0;background:conic-gradient(#f2c84b var(--p,0%),#ffffff33 0);box-shadow:0 8px 24px rgba(0,0,0,.35);touch-action:none;display:none;
          font:26px "Secular One",sans-serif;color:#3a2a00;cursor:pointer;user-select:none;-webkit-user-select:none}
        #party-blow span{display:flex;align-items:center;justify-content:center;flex-direction:column;position:absolute;inset:10px;border-radius:50%;background:#fff6dc}
        #party-card{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(.9);z-index:6;width:min(88vw,460px);padding:26px 22px;border-radius:18px;
          background:#fffaf0;box-shadow:0 20px 60px rgba(0,0,0,.45);text-align:center;direction:rtl;opacity:0;transition:all .6s;pointer-events:none}
        #party-card.show{opacity:1;transform:translate(-50%,-50%) scale(1)}
        #party-card h2{font:clamp(26px,7vw,38px) "Secular One",sans-serif;margin:0 0 8px;color:#b8322f}
        #party-card p{font:clamp(16px,4.2vw,19px) "Varela Round",sans-serif;margin:6px 0;color:#333;line-height:1.5}`;
      document.head.appendChild(st);
    }
    const hint = this.hint = document.createElement('div'); hint.id = 'party-hint'; document.body.appendChild(hint);
    const blow = this.blowBtn = document.createElement('button'); blow.id = 'party-blow'; blow.innerHTML = '<span>🌬️<br>נשוף!</span>'; document.body.appendChild(blow);
    this.holding = false;
    const on = e => { e.preventDefault(); sound.unlock(); this.holding = true; }, off = () => { this.holding = false; };
    blow.addEventListener('pointerdown', on); blow.addEventListener('pointerup', off); blow.addEventListener('pointerleave', off); blow.addEventListener('pointercancel', off);
    const card = this.card = document.createElement('div'); card.id = 'party-card';
    card.innerHTML = '<h2>יום הולדת 70 שמח, סבא רלו! 🎉</h2><p>מפיאטרה נמץ לירושלים, מהפסנתר לבית החולים, ממשפחה של ארבעה לנכדים.</p><p>אוהבים אותך המון ❤️</p>';
    document.body.appendChild(card);
  }
  layoutOverlay() {}

  startRun() {
    this.phase = 'run';
    this.stage = 'light';
    this.ending = false;
    this.tl = new Timeline();
    this.lit = 0; this.blow = 0;
    for (const c of this.candles) { c.userData.flame.visible = false; c.userData.flame.scale.set(0.8, 1.8, 0.8); }
    this.hint.textContent = 'הקישו כדי להדליק את הנרות 🕯️';
    this.hint.style.display = ''; this.blowBtn.style.display = 'none'; this.card.classList.remove('show');
    this.app.hud({ stamps: 0, progress: 0 });
  }

  // every tap lights the next candle
  tapAt() { this.light(); }
  jump() { this.light(); }
  move() { this.light(); }
  onKey(code) { if (code === 'Space' || code === 'Enter') { if (this.stage === 'light') this.light(); else this.holding = true; return true; } return false; }

  light() {
    if (this.paused || this.stage !== 'light') return;
    const c = this.candles[this.lit++];
    c.userData.flame.visible = true;
    sound.tone(1200 + this.lit * 60, 0.08, 'triangle', 0.08);
    this.spark(c.position.clone().add(new THREE.Vector3(0, 0.55, 0)), 8, [0xffd27a, 0xffffff]);
    this.app.hud({ stamps: this.lit, progress: this.lit / CANDLES * 0.5 });
    if (this.lit >= CANDLES) {
      this.stage = 'blow';
      this.hint.style.display = 'none';
      this.blowBtn.style.display = 'block';
      this.app.toast('עכשיו מחזיקים את הכפתור ונושפים!');
    }
  }

  // little particles: sparks, confetti, fireworks
  spark(at, n, cols, speed = 2.2, life = 0.8, size = 0.06) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(size, 6, 4), new THREE.MeshBasicMaterial({ color: cols[i % cols.length], transparent: true }));
      m.position.copy(at); this.scene.add(m);
      const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
      this.parts.push({ m, v, life, max: life, g: speed > 4 ? 3 : 6 });
    }
  }

  celebrate() {
    this.stage = 'party';
    this.phase = 'done'; this.ending = true;
    this.blowBtn.style.display = 'none';
    this.app.hud({ progress: 1 });
    for (const c of this.candles) { c.userData.flame.visible = false; this.spark(c.position.clone().add(new THREE.Vector3(0, 0.6, 0)), 4, [0xcccccc, 0x999999], 0.8, 1.2, 0.05); }
    // confetti over the table, then fireworks in the sky
    const confetti = [0xe25a5a, 0xf2c84b, 0x4f8fd6, 0x5bb36a, 0xc86ad6, 0xffffff];
    this.tl.add(0.3, 0.01, null, () => this.spark(new THREE.Vector3(0, 4.5, 0.5), 90, confetti, 4.5, 2.6, 0.07));
    for (let i = 0; i < 6; i++) this.tl.add(1 + i * 0.7, 0.01, null, () => {
      const at = new THREE.Vector3((Math.random() - 0.5) * 16, 9 + Math.random() * 4, -10 - Math.random() * 6);
      this.spark(at, 60, [confetti[i % 6], 0xffffff], 6, 1.6, 0.1);
      sound.tone(180 + Math.random() * 60, 0.25, 'sawtooth', 0.05);
    });
    // Happy Birthday on the piano, then the card
    let at = 1.2;
    for (const [n, b] of SONG) { sound.piano(N[n], 0.26, at); at += b * 0.42; }
    this.tl.add(2.2, 0.01, null, () => this.card.classList.add('show'));
    this.tl.add(at + 1.2, 0.01, null, () => { this.card.classList.remove('show'); this.app.levelComplete(this.result()); });
  }

  result() {
    return { stars: 3, summary: 'סבא רלו כיבה את כל 70 הנרות (טוב, שבעה גדולים).' };
  }

  resize(aspect) {
    this.aspect = aspect;
    const c = this.camera;
    c.aspect = aspect;
    c.fov = aspect < 1 ? 62 : 44;
    c.position.set(0, aspect < 1 ? 5.2 : 4.6, aspect < 1 ? 11.5 : 10);
    c.lookAt(0, aspect < 1 ? 2.9 : 3.2, -1);
    c.updateProjectionMatrix();
  }

  update(dt) {
    if (this.paused) return;
    this.t += dt;
    this.tl.update(dt);
    // the flames flicker; while blowing they bend and shrink
    if (this.stage === 'blow') {
      this.blow = Math.max(0, Math.min(1, this.blow + (this.holding ? dt / 2.2 : -dt * 0.35)));
      this.blowBtn.style.setProperty('--p', (this.blow * 100).toFixed(0) + '%');
      if (this.holding && Math.random() < dt * 8) sound.tone(90 + Math.random() * 40, 0.12, 'sawtooth', 0.025);
      this.app.hud({ progress: 0.5 + this.blow * 0.5 });
      if (this.blow >= 1) this.celebrate();
    }
    let lit = 0;
    for (const c of this.candles) {
      const f = c.userData.flame; if (!f.visible) continue; lit++;
      const k = 1 - this.blow * 0.8;
      f.scale.set(0.8 * k, (1.8 + Math.sin(this.t * 17 + c.position.x * 9) * 0.25) * k, 0.8 * k);
      f.rotation.z = this.holding ? 0.6 * this.blow : Math.sin(this.t * 5 + c.position.z) * 0.08;
    }
    this.candleLight.intensity = lit * 0.9 * (1 - this.blow * 0.6) * (0.9 + Math.random() * 0.2);
    for (const b of this.garden.userData.bulbs.children) b.material.emissiveIntensity = 2.2 + Math.sin(this.t * 3 + b.position.x) * 0.4;
    // Saba waves at the grandchildren, sends a big heart while the candles are lit, then dances
    const party = this.stage === 'party';
    if (this.saba) this.saba.userData.animate(this.t, party ? 'dance' : this.stage === 'blow' ? 'heart' : this.t % 8 > 5.5 ? 'wave' : 'idle');
    this.kids.forEach((k, i) => k.userData.animate(this.t + i * 0.3, party ? (i % 2 ? 'jump' : 'cheer') : 'idle'));
    for (const p of this.parts) { p.life -= dt; p.v.y -= p.g * dt; p.m.position.addScaledVector(p.v, dt); p.m.material.opacity = Math.max(0, p.life / p.max); }
    this.parts = this.parts.filter(p => { if (p.life > 0) return true; this.scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); return false; });
  }

  dispose() {
    for (const el of [this.hint, this.blowBtn, this.card]) el.remove();
    this.scene.traverse(o => { if (o.geometry && !o.userData.keep) o.geometry.dispose(); });
  }
}
