import { THREE, paint, mesh, canvasTex, makeSky, Timeline, sound } from './engine.js';
import { makeFigure } from './character.js';
import { model } from './models.js';

// Level 7 · a family day at the pool, 1989
// Dad stands in the water; one by one the four kids leap off the edge. Swipe (or tap left/right) to move Dad
// under the splash target and catch each child. Every catch is a cheer; misses just splash. Nobody fails.

const LANES = [-2.6, 0, 2.6];   // (narrow enough that Dad stays on a portrait phone's screen)
const JUMPS = 16;
const FLIGHT = 1.5;          // seconds in the air (shorter as the game goes on)
// the four children: [figure, height] — Karin the eldest, Idan, Tal and little Nir
const KIDS = [['karin', 2.5, 'קארין'], ['idan', 2.25, 'עידן'], ['tal', 1.9, 'טל'], ['nir', 1.6, 'ניר']];

const waterTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#3fb6d8'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 3;
  for (let i = 0; i < 26; i++) { g.beginPath(); const x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); g.bezierCurveTo(x + 20, y - 14, x + 40, y + 12, x + 64, y); g.stroke(); }
}, [3, 2]);
const tileTex = () => canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#f1ece2'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#d8d0c0'; g.lineWidth = 3; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 32, 0); g.lineTo(i * 32, h); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); }
}, [12, 8]);

function buildPool() {
  const g = new THREE.Group();
  // the deck: four tiled strips around the pool's opening
  const deckMat = paint(0xffffff, { map: tileTex(), roughness: 0.7 });
  for (const [w, d, x, z] of [[40, 10.5, 0, -8.75], [40, 10.5, 0, 9.75], [14, 8, -13, 0.5], [14, 8, 13, 0.5]]) {
    const strip = mesh(new THREE.PlaneGeometry(w, d), deckMat, x, 0, z); strip.rotation.x = -Math.PI / 2; strip.castShadow = false; g.add(strip);
  }
  // the pool: a sunken blue box with a water surface
  const blue = paint(0x58b7d6, { roughness: 0.4 });
  const W = 12, D = 8, depth = 1.6;
  const basin = new THREE.Group(); basin.position.set(0, 0, 0.5); g.add(basin);
  basin.add(mesh(new THREE.BoxGeometry(W, 0.05, D), blue, 0, -depth, 0));
  for (const [w, d, x, z] of [[W, 0.1, 0, -D / 2], [W, 0.1, 0, D / 2], [0.1, D, -W / 2, 0], [0.1, D, W / 2, 0]]) basin.add(mesh(new THREE.BoxGeometry(w, depth, d), blue, x, -depth / 2, z));
  const coping = paint(0xe9e1d0, { roughness: 0.6 });
  for (const [w, d, x, z] of [[W + 1, 0.6, 0, -D / 2 - 0.25], [W + 1, 0.6, 0, D / 2 + 0.25], [0.6, D, -W / 2 - 0.25, 0], [0.6, D, W / 2 + 0.25, 0]]) basin.add(mesh(new THREE.BoxGeometry(w, 0.12, d), coping, x, 0.03, z));
  const tex = waterTex();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: tex, color: 0xbfefff, transparent: true, opacity: 0.86, roughness: 0.12, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2; water.position.y = -0.35; basin.add(water);
  g.userData.water = tex;
  // lane rope floats
  for (const x of [-1.5, 1.5]) for (let z = -3.6; z <= 3.6; z += 0.45) basin.add(mesh(new THREE.SphereGeometry(0.11, 8, 6), paint(z * 10 % 2 ? 0xe23c3c : 0xffffff), x, -0.3, z));
  // loungers and trees around the deck
  for (const [x, z, r] of [[-9.5, -3, 0.4], [-9.5, 1.5, 0.2], [9.5, -2, -0.4]]) { const l = model('lounger'); if (l) { l.position.set(x, 0, z); l.rotation.y = r + Math.PI / 2 * Math.sign(x); g.add(l); } }
  for (const [x, z, s] of [[-12, -9, 1], [12, -9, 1], [-15, 2, 1], [15, 3, 1], [-7, -12.5, 1.25], [6.5, -13, 1.35], [-1.5, -15, 1.15]]) {
    const t = model('tree'); if (t) { t.position.set(x, 0, z); t.scale.multiplyScalar(s); g.add(t); }
  }
  // the garden behind the pool: a clipped hedge, the family's house, and sun umbrellas by the loungers
  const hedge = paint(0x4f8a3a, { roughness: 0.95 });
  g.add(mesh(new THREE.BoxGeometry(40, 1.8, 1.4), hedge, 0, 0.9, -13.5));
  const house = model('houseA'); if (house) { house.position.set(3, 0, -21); g.add(house); }
  const canvas = [paint(0xe2533e, { roughness: 0.8, side: THREE.DoubleSide }), paint(0xf4f0e6, { roughness: 0.8, side: THREE.DoubleSide })];
  for (const [x, z, k] of [[-9.6, -0.8, 0], [9.6, 0.2, 1], [-4, -7, 1], [4.5, -7.5, 0]]) {
    const u = new THREE.Group(); u.position.set(x, 0, z);
    u.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), 0xdddddd, 0, 1.6, 0));
    u.add(mesh(new THREE.ConeGeometry(1.9, 0.7, 12, 1, true), canvas[k], 0, 3.2, 0));
    g.add(u);
  }
  // the diving edge the kids jump from: a bright springboard
  g.add(mesh(new THREE.BoxGeometry(LANES[2] - LANES[0] + 3, 0.5, 1.6), paint(0xf6f1e6), 0, 0.25, -D / 2 - 0.7 + 0.5));
  return g;
}

export class Level7 {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfe2f6);
    this.scene.fog = new THREE.Fog(0xcfe9f8, 70, 260);
    this.scene.add(makeSky({ top: '#3c8fe0', mid: '#a6d6f6', horizon: '#e9f6ff', sunDir: [0.3, 0.6, -1], sunColor: '#fffbe8', radius: 150 }));
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 300);
    this.t = 0;
    this.paused = false;
    this.aspect = 1;
    this.phase = 'ready';

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x88a0a8, 1.25));
    const sun = new THREE.DirectionalLight(0xfffbe8, 2.6); sun.position.set(6, 14, 8);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 3; sun.shadow.normalBias = 0.02;
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 40 });
    this.scene.add(sun);
    const pool = this.pool = buildPool();
    this.scene.add(pool);

    this.dad = makeFigure('father', 3.6);
    if (this.dad) { this.dad.rotation.y = Math.PI; this.scene.add(this.dad); }
    this.kids = KIDS.map(([k, h, name]) => { const f = makeFigure(k, h); if (f) { f.userData.name = name; this.scene.add(f); } return f; }).filter(Boolean);
    // where the next child will land: a ring on the water
    this.marker = mesh(new THREE.RingGeometry(0.6, 0.85, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.castShadow = false; this.scene.add(this.marker);
    this.splashes = [];
    this.startRun();
  }

  startRun() {
    this.phase = 'run';
    this.ending = false;
    this.tl = new Timeline();
    this.lane = 1; this.dx = 0;
    this.jumpsDone = 0; this.caught = 0;
    this.leap = null; this.wait = 1.2;
    // the kids wait their turn on the edge
    this.kids.forEach((k, i) => { k.position.set(-4.5 + i * 3, 0.5, -3.9); k.rotation.y = 0; k.visible = true; k.userData.state = 'edge'; });
    this.app.hud({ stamps: 0, progress: 0 });
  }

  // swipes and taps move Dad between the three spots
  move(dir) {
    if (this.phase !== 'run') return;
    const nl = Math.max(0, Math.min(2, this.lane + dir));
    if (nl !== this.lane) { this.lane = nl; sound.tone(520 + dir * 60, 0.06, 'sine', 0.1); }
  }
  jump() {}
  // a plain tap moves Dad toward that side of the screen
  tapAt(fx) { this.move(fx < 0.5 ? -1 : 1); }
  onKey(code) {
    if (code === 'ArrowLeft' || code === 'KeyA') { this.move(-1); return true; }
    if (code === 'ArrowRight' || code === 'KeyD') { this.move(1); return true; }
    return false;
  }

  launch() {
    const kid = this.kids[this.jumpsDone % this.kids.length];
    const lane = Math.floor(Math.random() * 3);
    const flight = Math.max(0.95, FLIGHT - this.jumpsDone * 0.035);
    this.leap = { kid, lane, t: 0, flight, from: kid.position.clone() };
    kid.userData.state = 'air';
    this.marker.position.set(LANES[lane], 0.17, 0.6);
    sound.tone(990, 0.08, 'triangle', 0.08);
  }

  land() {
    const J = this.leap;
    const got = this.lane === J.lane;
    this.jumpsDone++;
    this.splash(LANES[J.lane], got ? 6 : 14);
    if (got) {
      this.caught++;
      sound.tone(880, 0.12, 'sine', 0.12); setTimeout(() => sound.tone(1320, 0.18, 'sine', 0.1), 100);
      this.app.toast(`תפסת את ${J.kid.userData.name}!`);
      this.app.hud({ stamps: this.caught });
      this.cheer = 1.2;
    } else {
      sound.tone(200, 0.25, 'sawtooth', 0.05);
    }
    // back to the edge for another turn
    const kid = J.kid;
    this.tl.add(0.9, 0.01, null, () => { kid.position.copy(J.from); kid.userData.state = 'edge'; });
    this.leap = null;
    this.wait = 0.55;
    this.app.hud({ progress: this.jumpsDone / JUMPS });
    if (this.jumpsDone >= JUMPS) this.finish();
  }

  splash(x, n) {
    for (let i = 0; i < n; i++) {
      const d = mesh(new THREE.SphereGeometry(0.09 + Math.random() * 0.07, 6, 4), new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true }));
      d.position.set(x + (Math.random() - 0.5) * 0.6, 0.2, 0.6 + (Math.random() - 0.5) * 0.6); d.castShadow = false;
      this.scene.add(d);
      this.splashes.push({ d, v: new THREE.Vector3((Math.random() - 0.5) * 3, 3 + Math.random() * 3, (Math.random() - 0.5) * 3), life: 0.9 });
    }
  }

  finish() {
    this.phase = 'done'; this.ending = true;
    this.marker.visible = false;
    sound.fanfare();
    this.tl.add(3.2, 0.01, null, () => this.app.levelComplete(this.result()));
  }

  result() {
    const stars = this.caught >= 14 ? 3 : this.caught >= 10 ? 2 : 1;
    return { stars, summary: `תפסת ${this.caught} מתוך ${JUMPS} קפיצות.` };
  }

  resize(aspect) {
    this.aspect = aspect;
    const c = this.camera;
    c.aspect = aspect;
    c.fov = aspect < 1 ? 70 : 48;
    // a phone: closer and lower, so the pool fills the screen and the garden shows behind the kids
    c.position.set(0, aspect < 1 ? 6.2 : 6.4, aspect < 1 ? 11.5 : 12);
    c.lookAt(0, aspect < 1 ? 1.4 : 0.6, aspect < 1 ? -2.5 : -1.2);
    c.updateProjectionMatrix();
  }

  update(dt) {
    if (this.paused) return;
    this.t += dt;
    this.tl.update(dt);
    this.pool.userData.water.offset.x += dt * 0.02; this.pool.userData.water.offset.y += dt * 0.013;
    // Dad wades to his spot (waist-deep: the water hides his legs)
    this.dx += (LANES[this.lane] - this.dx) * Math.min(1, dt * 9);
    if (this.dad) {
      this.dad.position.set(this.dx, -1.25, 0.9);
      this.cheer = Math.max(0, (this.cheer || 0) - dt);
      this.dad.userData.animate(this.t, this.phase === 'done' ? 'cheer' : this.cheer > 0 ? 'cheer' : 'idle');
    }
    if (this.phase === 'run') {
      if (!this.leap) { this.wait -= dt; if (this.wait <= 0 && this.kids.length) this.launch(); }
      else {
        const J = this.leap; J.t += dt;
        const k = Math.min(1, J.t / J.flight);
        const tx = LANES[J.lane], tz = 0.6;
        J.kid.position.set(J.from.x + (tx - J.from.x) * k, J.from.y + Math.sin(k * Math.PI) * 4.2 - k * 1.1, J.from.z + (tz - J.from.z) * k);
        J.kid.rotation.y = 0;
        this.marker.material.opacity = 0.5 + Math.sin(this.t * 10) * 0.3;
        if (k >= 1) this.land();
      }
    }
    for (const kid of this.kids) {
      const st = kid.userData.state;
      kid.userData.animate(this.t + kid.position.x, this.phase === 'done' ? 'cheer' : st === 'air' ? 'jump' : 'idle');
    }
    for (const s of this.splashes) { s.life -= dt; s.v.y -= 12 * dt; s.d.position.addScaledVector(s.v, dt); s.d.material.opacity = Math.max(0, s.life); }
    this.splashes = this.splashes.filter(s => { if (s.life > 0) return true; this.scene.remove(s.d); s.d.geometry.dispose(); s.d.material.dispose(); return false; });
  }

  dispose() {
    this.scene.traverse(o => { if (o.geometry && !o.userData.keep) o.geometry.dispose(); });
  }
}
