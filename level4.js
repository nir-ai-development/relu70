import { THREE, paint, mesh, canvasTex, makeSky, Timeline, sound } from './engine.js';
import { makeFigure } from './character.js';
import { model } from './models.js';

// Level 4 · IDF basic training, 1976
// Relu leads his squad down the obstacle course: jump the walls and tyres, crawl under the barbed wire,
// switch lanes around the sandbags and the jeeps, and collect the officer's bars on the way to graduation.

const LANES = [-2.6, 0, 2.6];
const GOAL = 560;            // meters of course
const GRAVITY = 34, JUMP_V = 12.5;
const SLIDE_T = 0.75;        // seconds a crawl lasts

const sandTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#d9b98a'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2600; i++) { const v = 150 + Math.random() * 70; g.fillStyle = `rgba(${v + 40},${v + 15},${v - 30},.35)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(150,110,70,.18)'; g.lineWidth = 3; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y - 10, w * 0.7, y + 10, w, y); g.stroke(); }
}, [3, 60]);
const trackTex = () => canvasTex(128, 256, (g, w, h) => {
  g.fillStyle = '#b89466'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1600; i++) { const v = 120 + Math.random() * 60; g.fillStyle = `rgba(${v + 30},${v + 5},${v - 30},.4)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
  g.fillStyle = 'rgba(90,60,30,.25)'; for (let y = 0; y < h; y += 18) { g.fillRect(w * 0.22, y, 10, 8); g.fillRect(w * 0.7, y + 9, 10, 8); }   // boot prints
}, [1, 40]);
const flagTex = () => canvasTex(192, 128, (g, w, h) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1f4fa8'; g.fillRect(0, 14, w, 16); g.fillRect(0, h - 30, w, 16);
  g.strokeStyle = '#1f4fa8'; g.lineWidth = 6; const cx = w / 2, cy = h / 2, r = 26;
  for (const s of [1, -1]) { g.beginPath(); for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 * s + i * 2 * Math.PI / 3; g[i ? 'lineTo' : 'moveTo'](cx + r * Math.cos(a), cy + r * Math.sin(a)); } g.closePath(); g.stroke(); }
});

// course pieces, built in code so they read clearly at speed
function makeWall() {
  const g = new THREE.Group();
  const wood = paint(0x8a6a44, { roughness: 0.9 });
  g.add(mesh(new THREE.BoxGeometry(2.3, 1.5, 0.35), wood, 0, 0.75, 0));
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.BoxGeometry(2.36, 0.05, 0.4), paint(0x6a4f30), 0, 0.2 + i * 0.37, 0));
  for (const x of [-1.1, 1.1]) g.add(mesh(new THREE.BoxGeometry(0.16, 1.9, 0.4), paint(0x5c4128), x, 0.95, 0));
  return g;
}
function makeTyres() {
  const g = new THREE.Group();
  const rubber = paint(0x2a2a2a, { roughness: 0.95 });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
    const t = mesh(new THREE.TorusGeometry(0.36, 0.16, 10, 18), rubber, -0.75 + i * 0.75, 0.16, -0.3 + j * 0.6); t.rotation.x = Math.PI / 2; g.add(t);
  }
  return g;
}
function makeWire() {
  // barbed wire stretched between posts at chest height: crawl under it
  const g = new THREE.Group();
  const post = paint(0x6b5a44, { roughness: 0.9 });
  for (const x of [-1.2, 1.2]) g.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 2.9, 6), post, x, 1.45, 0));
  const wire = paint(0x9aa0a6, { roughness: 0.4, metalness: 0.6 });
  for (const y of [1.75, 2.2, 2.65]) {
    const w = mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 4), wire, 0, y, 0); w.rotation.z = Math.PI / 2; g.add(w);
    for (let k = -1; k <= 1; k += 0.25) { const b = mesh(new THREE.BoxGeometry(0.04, 0.14, 0.04), wire, k, y, 0); b.rotation.z = 0.8; g.add(b); }
  }
  return g;
}
// a plain olive army tent, for when the sculpted one isn't available
function makeTent() {
  const g = new THREE.Group();
  const canvas = paint(0x6b6a3e, { roughness: 1 });
  g.add(mesh(new THREE.BoxGeometry(5, 1.6, 4), canvas, 0, 0.8, 0));
  const roof = mesh(new THREE.CylinderGeometry(0.01, 3.3, 1.8, 4, 1), canvas, 0, 2.5, 0); roof.rotation.y = Math.PI / 4; roof.scale.set(1.05, 1, 0.85); g.add(roof);
  g.add(mesh(new THREE.PlaneGeometry(1.2, 1.4), paint(0x2f2e1c), 0, 0.7, 2.01));
  return g;
}
function makeSandbags() {
  const g = new THREE.Group();
  const bag = paint(0xbfa77a, { roughness: 1 });
  for (let r = 0; r < 5; r++) for (let i = 0; i < 4 - (r % 2); i++) {
    const b = mesh(new THREE.CapsuleGeometry(0.22, 0.42, 4, 8), bag, -0.85 + i * 0.56 + (r % 2) * 0.28, 0.22 + r * 0.4, 0);
    b.rotation.z = Math.PI / 2; b.scale.set(1, 1, 0.7); g.add(b);
  }
  return g;
}
function makeBars() {
  // the officer's bars (סגן-mishne): two gold bars on an olive tab, spinning
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.62, 0.4, 0.06), paint(0x55603a, { roughness: 0.8 })));
  const gold = paint(0xf2c84b, { roughness: 0.25, metalness: 0.7, emissive: 0x5a4210 });
  for (const y of [-0.09, 0.09]) g.add(mesh(new THREE.BoxGeometry(0.48, 0.1, 0.1), gold, 0, y, 0.05));
  g.scale.setScalar(1.9);
  return g;
}
function makeCanteen() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 14), paint(0x4f5a34, { roughness: 0.8 }), 0, 0.25, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.14, 8), paint(0x222222), 0, 0.56, 0));
  return g;
}
function makeFlag() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.09, 9, 8), paint(0xd0d0d0, { metalness: 0.5, roughness: 0.4 }), 0, 4.5, 0));
  const f = mesh(new THREE.PlaneGeometry(2.4, 1.6, 12, 1), new THREE.MeshStandardMaterial({ map: flagTex(), side: THREE.DoubleSide, roughness: 0.8 }), 1.25, 8, 0);
  f.castShadow = false; g.add(f); g.userData.cloth = f;
  return g;
}
function makeDune(w, h, col) {
  const d = mesh(new THREE.SphereGeometry(1, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), paint(col, { roughness: 1 }));
  d.scale.set(w, h, w * 0.6); d.castShadow = false;
  return d;
}

export class Level4 {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 600);
    this.t = 0;
    this.paused = false;
    this.aspect = 1;
    this.phase = 'ready';

    this.scene.background = new THREE.Color(0xf0dcc0);
    this.scene.fog = new THREE.Fog(0xf0dcc0, 80, 300);
    this.scene.add(makeSky({ top: '#3f7fd0', mid: '#a9cfee', horizon: '#f6e2c0', sunDir: [0.4, 0.5, -1], sunColor: '#fff6dc', radius: 320 }));
    this.scene.add(new THREE.HemisphereLight(0xfff4dc, 0x9c7a50, 1.2));
    const sun = this.sun = new THREE.DirectionalLight(0xfff0d0, 2.6); sun.position.set(5, 12, 6);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
    this.scene.add(sun, sun.target);

    this.relu = makeFigure('officer', 3.5);
    // two of his soldiers running behind him
    this.squad = [makeFigure('soldier', 3.4), makeFigure('soldier', 3.3)].filter(Boolean);
    this.startRun();
  }

  startRun() {
    if (this.world) { this.scene.remove(this.world); this.world.traverse(o => { if (o.geometry && !o.userData.keep) o.geometry.dispose(); }); }
    const W = this.world = new THREE.Group();
    this.scene.add(W);
    this.phase = 'run';
    this.tl = new Timeline();
    this.ending = null; this.dead = false;

    this.sand = sandTex();
    const ground = mesh(new THREE.PlaneGeometry(120, 400), paint(0xffffff, { map: this.sand, roughness: 1 }), 0, 0, -150);
    ground.rotation.x = -Math.PI / 2; ground.castShadow = false; W.add(ground);
    this.track = trackTex();
    const track = mesh(new THREE.PlaneGeometry(8.4, 400), paint(0xffffff, { map: this.track, roughness: 1 }), 0, 0.02, -150);
    track.rotation.x = -Math.PI / 2; track.castShadow = false; W.add(track);
    for (const s of [-1, 1]) {
      // white-painted stones edging the course, as on every base
      for (let i = 0; i < 70; i++) { const st = mesh(new THREE.SphereGeometry(0.22, 6, 4), paint(0xf2efe6, { roughness: 1 }), s * 4.4, 0.08, 10 - i * 4); st.scale.y = 0.6; st.castShadow = false; W.add(st); }
    }
    // distant dunes and hills
    if (this.farGroup) this.scene.remove(this.farGroup);
    const far = this.far = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const s = i % 2 ? 1 : -1, dune = makeDune(14 + Math.random() * 18, 4 + Math.random() * 6, [0xd8b582, 0xcfa874, 0xe2c394][i % 3]);
      dune.position.set(s * (40 + Math.random() * 40), 0, -60 - i * 18); far.add(dune);
    }
    this.scene.add(far);
    this.farGroup = far;

    // recycling camp scenery: tents, jeeps, water tanks, trees, the fence
    this.scenery = [];
    const SPACING = 16, N = 9;
    this.sceneSpan = SPACING * N;
    for (let i = 0; i < N; i++) for (const s of [-1, 1]) {
      const z = 6 - i * SPACING + (s > 0 ? 8 : 0);
      const pick = (i + (s > 0 ? 1 : 0)) % 3;
      let o = pick === 0 ? model('armyTent') || makeTent() : pick === 1 ? model('jeep') : model('tree');
      if (!o) continue;
      o.position.set(s * (pick === 1 ? 8 : 10.5), 0, z);
      o.rotation.y = pick === 1 ? (s > 0 ? -0.6 : 0.6) : s > 0 ? -Math.PI / 2 : Math.PI / 2;
      W.add(o); this.scenery.push(o);
    }
    // the fence line far out on both sides
    for (const s of [-1, 1]) for (let i = 0; i < 40; i++) W.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 2, 5), paint(0x7a6a55), s * 16, 1, 10 - i * 10));
    this.flag = makeFlag(); this.flag.position.set(-6, 0, -30); W.add(this.flag);

    // Relu and his squad
    for (const f of [this.relu, ...this.squad]) if (f) { f.position.set(0, 0, 0); f.rotation.set(0, Math.PI, 0); W.add(f); }
    // the squad runs alongside the course, just outside the lanes, so they never block the view
    this.squad.forEach((s, i) => { s.userData.slot = [i ? 4.7 : -4.7, 1.2 + i * 1.4]; s.userData.offset = i * 0.37; });

    this.lane = 1; this.px = 0; this.py = 0; this.vy = 0; this.slide = 0;
    this.speed = 12; this.dist = 0; this.hearts = 3; this.invuln = 0; this.bars = 0; this.barTotal = 0;
    this.nextRow = 30; this.entities = []; this.shake = 0;
    this.app.hud({ hearts: 3, stamps: 0, progress: 0 });
    this.resize(this.aspect);
  }

  spawnRow(z) {
    const prog = this.dist / GOAL;
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    const r = Math.random();
    if (r < 0.3) {
      // a full-width wire: everyone crawls, bars above it for the brave
      for (const l of [0, 1, 2]) this.addObstacle('wire', l, z);
      for (let i = 0; i < 3; i++) this.addBars(lanes[0], z + 6 + i * 2.4, 1.0);
    } else if (r < 0.62) {
      this.addObstacle(Math.random() < 0.5 ? 'wall' : 'tyres', lanes[0], z);
      for (let i = 0; i < 5; i++) { const k = (i - 2) / 2; this.addBars(lanes[0], z + k * 3.4, 1.2 + (1 - k * k) * 2.2); }
      this.addObstacle(Math.random() < 0.6 ? 'sandbags' : 'jeep', lanes[1], z - (prog > 0.4 ? 0 : 6));
    } else {
      this.addObstacle('sandbags', lanes[0], z);
      if (prog > 0.25) this.addObstacle(Math.random() < 0.5 ? 'wall' : 'tyres', lanes[1], z - 4);
      for (let i = 0; i < 5; i++) this.addBars(lanes[2], z + 4 - i * 2.4, 1.1);
    }
    if (this.hearts < 3 && Math.random() < 0.2) this.addCanteen(lanes[2], z - 10);
  }
  addObstacle(kind, lane, z) {
    const spec = {
      wall: { make: makeWall, h: 1.5, depth: 0.6 },
      tyres: { make: makeTyres, h: 0.5, depth: 1.3 },
      wire: { make: makeWire, wire: true, depth: 0.5 },
      sandbags: { make: makeSandbags, h: 9, depth: 1.0 },
      jeep: { make: () => model('jeep') || makeSandbags(), h: 9, depth: 3.6 },
    }[kind];
    const o = spec.make();
    o.position.set(LANES[lane], 0, z);
    if (kind === 'jeep') o.rotation.y = Math.PI / 2;
    this.world.add(o);
    this.entities.push({ type: 'obstacle', kind, obj: o, lane, h: spec.h, wire: spec.wire, depth: spec.depth });
  }
  addBars(lane, z, y) {
    const o = makeBars(); o.position.set(LANES[lane], y, z);
    this.world.add(o); this.barTotal++;
    this.entities.push({ type: 'bars', obj: o, lane, y, depth: 0.7 });
  }
  addCanteen(lane, z) {
    const o = makeCanteen(); o.position.set(LANES[lane], 0.3, z); o.scale.setScalar(1.4);
    this.world.add(o);
    this.entities.push({ type: 'canteen', obj: o, lane, y: 0.3, depth: 0.8 });
  }

  move(dir) {
    if (this.phase !== 'run' || this.ending || this.dead) return;
    const nl = Math.max(0, Math.min(2, this.lane + dir));
    if (nl !== this.lane) { this.lane = nl; sound.tone(520 + dir * 60, 0.06, 'sine', 0.12); }
  }
  jump() {
    if (this.phase !== 'run' || this.ending || this.dead) return;
    if (this.py <= 0.001) { this.vy = JUMP_V; this.slide = 0; sound.jump(); }
  }
  duck() {
    if (this.phase !== 'run' || this.ending || this.dead) return;
    if (this.py > 0.001) this.vy = Math.min(this.vy, -18);   // drop out of a jump straight into the crawl
    this.slide = SLIDE_T; sound.tone(300, 0.1, 'triangle', 0.1);
  }

  update(dt) {
    if (this.paused) return;
    this.t += dt;
    this.tl.update(dt);
    if (this.phase === 'run') this.updateRun(dt);
    if (this.flag) { const f = this.flag.userData.cloth, p = f.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, Math.sin(this.t * 5 + x * 2.2) * 0.12 * (x + 1.2)); } p.needsUpdate = true; }
  }

  updateRun(dt) {
    if (!this.ending && !this.dead) this.speed = Math.min(19, 12 + this.dist / GOAL * 7);
    const dz = this.speed * dt;
    this.dist += dz;
    this.sand.offset.y += dz * this.sand.repeat.y / 400;
    this.track.offset.y += dz * this.track.repeat.y / 400;
    for (const o of this.scenery) { o.position.z += dz; if (o.position.z > 16) o.position.z -= this.sceneSpan; }
    for (const c of this.world.children) if (c.geometry?.type === 'CylinderGeometry' || c.geometry?.type === 'SphereGeometry') { c.position.z += dz; if (c.position.z > 12) c.position.z -= c.geometry.type === 'SphereGeometry' ? 280 : 400; }
    if (this.flag && !this.ending) { this.flag.position.z += dz; if (this.flag.position.z > 20) this.flag.position.z -= 220; }

    if (!this.ending && this.dist < GOAL - 70) {
      this.nextRow -= dz;
      if (this.nextRow <= 0) { this.spawnRow(-110); this.nextRow = 30 - (this.dist / GOAL) * 10; }
    }
    if (!this.ending && this.dist >= GOAL) this.startEnding();

    // Relu: lanes, jump, crawl
    this.px += (LANES[this.lane] - this.px) * Math.min(1, dt * 12);
    this.vy -= GRAVITY * dt; this.py = Math.max(0, this.py + this.vy * dt);
    if (this.py === 0) this.vy = 0;
    this.slide = Math.max(0, this.slide - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    const R = this.relu;
    if (R) {
      R.position.set(this.px, this.py, 0);
      R.visible = this.invuln > 0 ? Math.floor(this.invuln * 12) % 2 === 0 : true;
      const crawl = this.slide > 0 && this.py < 0.01;
      // the crawl: he dives forward and slides low on his front, under the wire
      this.tilt = (this.tilt || 0) + ((crawl ? 1.3 : 0) - (this.tilt || 0)) * Math.min(1, dt * 16);
      R.rotation.set(this.tilt, Math.PI, 0, 'YXZ');
      R.userData.animate(this.t, this.ending ? this.ending.mode : this.dead ? 'idle' : this.py > 0.05 ? 'jump' : 'running');
    }
    // the squad follows in his footsteps, a little behind
    for (const s of this.squad) {
      const [ox, oz] = s.userData.slot;
      const tx = this.ending ? ox * 0.55 : ox, tz = this.ending ? -0.5 : oz;
      s.position.x += (tx - s.position.x) * Math.min(1, dt * 5); s.position.z += (tz - s.position.z) * Math.min(1, dt * 3);
      s.userData.animate(this.t + s.userData.offset, this.ending ? this.ending.squad : 'running');
    }

    for (const e of this.entities) {
      e.obj.position.z += dz;
      if (e.type === 'bars') { e.obj.rotation.y += dt * 3; e.obj.position.y = e.y + Math.sin(this.t * 4 + e.obj.position.z) * 0.1; }
      if (e.type === 'canteen') e.obj.rotation.y += dt * 2;
      if (e.flying) { e.obj.position.y += e.vy * dt; e.vy -= 20 * dt; e.obj.rotation.x += dt * 6; e.obj.position.x += e.vx * dt; continue; }
      if (e.gone || this.dead) continue;
      if (Math.abs(e.obj.position.z) > e.depth / 2 + 0.4 || Math.abs(e.obj.position.x - this.px) > 1.3) continue;
      if (e.type === 'bars') {
        if (Math.abs(e.obj.position.y - (this.py + 1.6)) < 1.5) { e.gone = true; e.obj.visible = false; this.bars++; sound.collect(); this.app.hud({ stamps: this.bars }); }
      } else if (e.type === 'canteen') {
        if (this.py < 1.4) { e.gone = true; e.obj.visible = false; this.hearts = Math.min(3, this.hearts + 1); sound.heal(); this.app.hud({ hearts: this.hearts }); this.app.toast('מים קרים! +❤'); }
      } else if (this.invuln <= 0) {
        const blocked = e.wire ? !(this.slide > 0 && this.py < 0.3) : this.py < e.h - 0.05;
        if (blocked) this.hit(e);
      }
    }
    this.entities = this.entities.filter(e => { if (e.obj.position.z > 14 || e.obj.position.y < -6) { this.world.remove(e.obj); return false; } return true; });
    if (!this.ending) this.app.hud({ progress: Math.min(1, this.dist / GOAL) });

    // camera: behind and above, a little to the side of his lane
    const narrow = this.aspect < 1;
    const sh = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    this.shake = Math.max(0, this.shake - dt * 2);
    if (!this.ending) {
      this.camera.position.set(this.px * 0.5 + sh, 5.4 + this.py * 0.2, narrow ? 10.5 : 9.5);
      this.camera.lookAt(this.px * 0.3, narrow ? 1.6 : 2.2, -12);
    } else {
      // swing round to the front for the graduation
      const k = Math.min(1, this.ending.t / 1.6);
      const from = new THREE.Vector3(this.px * 0.5, 5.4, narrow ? 10.5 : 9.5), to = new THREE.Vector3(narrow ? 3.5 : 4.5, 3.6, narrow ? -9.5 : -8.5);
      this.camera.position.lerpVectors(from, to, k * k * (3 - 2 * k));
      this.camera.lookAt(0, 2.2, 0.5);
      this.ending.t += dt;
    }
  }

  hit(e) {
    this.hearts--;
    this.invuln = 1.6;
    this.shake = 0.7;
    sound.hit();
    if (!e.wire) { e.flying = true; e.vy = 7; e.vx = (Math.random() - 0.5) * 6; }
    this.app.hud({ hearts: this.hearts });
    if (this.hearts <= 0) {
      this.dead = true; this.speed = 0;
      this.tl.add(1.2, 0.01, null, () => this.app.levelFailed());
    }
  }

  startEnding() {
    // the course ends on the parade ground: halt, the squad lines up, Relu gets his bars
    this.ending = { t: 0, mode: 'idle', squad: 'idle' };
    this.lane = 1;
    for (const e of this.entities) e.obj.visible = false;
    this.flag.position.set(-4.5, 0, -6);
    this.speed = 0;
    this.app.hud({ progress: 1 });
    this.tl.add(0.6, 0.01, null, () => { this.ending.mode = 'victory'; this.ending.squad = 'cheer'; sound.fanfare(); this.app.toast('קצין! 🎖'); });
    this.tl.add(4.2, 0.01, null, () => this.app.levelComplete(this.result()));
  }

  result() {
    const share = this.bars / Math.max(1, this.barTotal);
    const stars = this.hearts === 3 && share > 0.5 ? 3 : share > 0.3 || this.hearts >= 2 ? 2 : 1;
    return { stars, summary: `אספת ${this.bars} דרגות בדרך.` };
  }

  resize(aspect) {
    this.aspect = aspect;
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 1 ? 66 : 52;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.scene.traverse(o => { if (o.geometry && !o.userData.keep) o.geometry.dispose(); });
  }
}
