import { THREE, paint, mesh, canvasTex, Timeline, ease, sound } from './engine.js';
import { skyEnvironment, rippleNormals } from './gfx.js';
import { makeBabyRelu, makeAdult, makeFigure, makeSuitcase } from './character.js';
import {
  buildRoom, makeOpenCase, makeTeddy, makeBottle, makeBlanket, makeCertificate, makePhotoFrame, makePiano, makeArmchair, makeGoose,
  makeBarrel, makeCart, makePuddle, makeHouse, makeTree, makeLamp, makeTower, makeSign, makeStamp, makeLandscape,
  makeShip, DOOR_OPEN, makeStairs, makeLighthouse, makeCrane, makeBollard, makeTerminal, makeLuggageCart, cobbleTex, slabTex, concreteTex,
} from './props1.js';

// Level 1 · Piatra Neamț, July 1958
// Phase "pack": tap the five things a toddler needs into the suitcase (and learn what can't come).
// Phase "run":  three-lane run through town to the ship to Israel.

const LANES = [-1.6, 0, 1.6];
const GOAL = 500;          // meters to the port
const GRAVITY = 30, JUMP_V = 9.6;

function disposeTree(obj) {
  obj.traverse(o => { if (o.geometry && !o.userData.keep) o.geometry.dispose(); });
}

// =====================================================================
const SUN_DIR = new THREE.Vector3(4, 10, 6);

export class Level1 {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    this.t = 0;
    this.tl = new Timeline();
    this.paused = false;
    this.aspect = 1;

    this.look = { exposure: 0.86, bloom: [0.14, 0.5, 1.25] };
    this.hemi = new THREE.HemisphereLight(0xfff4e0, 0x6a5a48, 0.95); this.scene.add(this.hemi);
    // warm key light with a tight soft shadow box that follows Relu
    const sun = this.sun = new THREE.DirectionalLight(0xffe9cc, 2.6); sun.position.set(4, 10, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 30 });
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02; sun.shadow.radius = 4;
    this.scene.add(sun, sun.target);

    this.baby = makeBabyRelu();
    this.handCase = makeSuitcase(0.32);
    this.handCase.position.set(0, -0.62, 0.02);
    this.handCase.rotation.y = Math.PI / 2;
    this.buildPacking();
  }

  // ------------------------------------------------ packing
  buildPacking() {
    this.phase = 'pack';
    const room = this.room = new THREE.Group();
    // the room floats like a dollhouse against a warm dark backdrop
    this.scene.background = canvasTex(16, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a1d14'); gr.addColorStop(0.6, '#4a3222'); gr.addColorStop(1, '#2a1d14'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    this.sun.shadow.mapSize.set(2048, 2048); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null;
    this.scene.fog = null;
    this.sun.position.set(-3, 11, 7); this.sun.intensity = 1.7;

    room.add(buildRoom());
    this.roomSphere = null;   // framed by resize() once the room is in place
    const sc = this.bigCase = makeOpenCase();
    this.lid = sc.userData.lid;
    sc.position.set(0, 0, -0.2);
    room.add(sc);

    const items = [
      { id: 'cert', name: 'תעודת המסע', good: true, obj: makeCertificate(), pos: [-1.6, 2.4], rot: 0.25 },
      { id: 'teddy', name: 'דובי', good: true, obj: makeTeddy(), pos: [2.0, 1.7], rot: -0.4 },
      { id: 'bottle', name: 'בקבוק חלב', good: true, obj: makeBottle(), pos: [-3.3, 0.6], rot: 0 },
      { id: 'blanket', name: 'שמיכה', good: true, obj: makeBlanket(), pos: [1.0, 2.9], rot: 0.15 },
      { id: 'photo', name: 'תמונה של אמא ואבא', good: true, obj: makePhotoFrame(), pos: [-2.4, -1.4], rot: 0.35 },
      { id: 'piano', good: false, obj: makePiano(), pos: [-1.7, -3.35], rot: 0, msg: 'פסנתר לא נכנס למזוודה! הוא יחכה לרלו בירושלים' },
      { id: 'chair', good: false, obj: makeArmchair(), pos: [3.7, 2.0], rot: -0.9, msg: 'הכורסה של סבתא כבדה מדי' },
      { id: 'goose', good: false, obj: makeGoose(), pos: [1.7, -1.3], rot: -0.6, msg: 'האווז נשאר בחצר. הוא לא מפליג לישראל!' },
    ];
    for (const it of items) {
      it.obj.position.set(it.pos[0], 0, it.pos[1]);
      it.obj.rotation.y = it.rot;
      it.baseY = 0;
      it.phase = Math.random() * 6;
      room.add(it.obj);
    }
    this.items = items;
    this.packed = 0;
    this.packStart = this.t;

    const b = this.baby;
    b.position.set(1.3, 0, 1.0);
    b.rotation.set(0, -0.5, 0);
    room.add(b);
    this.babyMode = 'idle';
    this.scene.add(room);
    this.app.setChecklist(items.filter(i => i.good).map(i => ({ id: i.id, name: i.name, got: false })));
    this.resize(this.aspect);
  }

  packTap(sx, sy) {
    if (this.phase !== 'pack' || this.tl.busy && this.packed >= 5) return;
    // forgiving screen-space pick: nearest item center within reach
    const rect = this.app.rect();
    let best = null, bestD = Math.max(60, rect.w * 0.09);
    const v = new THREE.Vector3();
    for (const it of this.items) {
      if (it.done) continue;
      it.obj.getWorldPosition(v); v.y += it.id === 'piano' || it.id === 'chair' ? 0.7 : 0.35;
      v.project(this.camera);
      const px = (v.x + 1) / 2 * rect.w, py = (1 - v.y) / 2 * rect.h;
      const d = Math.hypot(px - sx, py - sy);
      if (d < bestD) { bestD = d; best = it; }
    }
    if (!best) return;
    if (!best.good) {
      sound.nope();
      this.app.toast(best.msg);
      const o = best.obj, r0 = o.rotation.y;
      this.tl.add(0, 0.5, p => { o.rotation.y = r0 + Math.sin(p * Math.PI * 6) * 0.15 * (1 - p); });
      return;
    }
    best.done = true;
    sound.pop();
    const o = best.obj, from = o.position.clone(), to = new THREE.Vector3(0, 0.55, -0.2), s0 = o.scale.x;
    this.tl.add(0, 0.7, p => {
      const e = ease.inOut(p);
      o.position.lerpVectors(from, to, e);
      o.position.y += Math.sin(p * Math.PI) * 2.2;
      o.rotation.y += 0.25;
      o.scale.setScalar(s0 * (1 - e * 0.65));
    }, () => { o.visible = false; });
    this.packed++;
    this.app.markChecked(best.id);
    this.babyMode = 'cheer';
    this.tl.add(0.9, 0.01, null, () => { if (this.phase === 'pack') this.babyMode = 'idle'; });
    if (this.packed === 5) this.finishPacking();
  }

  finishPacking() {
    this.phase = 'packdone';
    const ready = () => { sound.collect(); this.app.toast('המזוודה מוכנה. יוצאים!'); };
    if (this.lid) this.tl.add(0.8, 0.6, p => { this.lid.rotation.x = -1.9 * (1 - ease.out(p)); }, ready);
    else {
      // the sculpted open case can't shut, so it squashes and pops into the closed one
      const sc = this.bigCase;
      this.tl.add(0.8, 0.25, p => { sc.scale.set(1 + p * 0.15, 1 - p * 0.5, 1 + p * 0.15); }, () => {
        sc.children.forEach(c => { c.visible = false; });
        const closed = makeSuitcase(2); sc.add(closed); sc.scale.setScalar(1);
        ready();
      });
      this.tl.add(1.05, 0.35, p => { sc.scale.setScalar(0.8 + ease.back(p) * 0.2); });
    }
    const b = this.baby, from = b.position.clone(), to = new THREE.Vector3(0.95, 0, 0.55);
    this.tl.add(1.5, 0.7, p => { this.babyMode = 'walk'; b.position.lerpVectors(from, to, p); b.rotation.y = -1.2 * p; });
    this.tl.add(2.2, 0.01, null, () => {
      this.bigCase.visible = false;
      this.baby.userData.carry(this.handCase);
      this.babyMode = 'cheer';
    });
    this.tl.add(3.4, 0.01, null, () => this.app.packingDone());
  }

  // ------------------------------------------------ running
  startRun() {
    // tear down whatever was there (room, or a previous run); the baby is reused
    if (this.baby.parent) this.baby.parent.remove(this.baby);
    for (const g of [this.room, this.world]) if (g) { this.scene.remove(g); disposeTree(g); }
    this.port = null; this.ending = null; this.dead = false; this.parents = [];
    this.room = null;
    this.tl = new Timeline();
    this.phase = 'run';
    const W = this.world = new THREE.Group();
    this.scene.add(W);
    this.scene.background = new THREE.Color(0xf3dcc0);
    this.scene.fog = new THREE.Fog(0xdde3e0, 70, 330);
    this.sun.position.set(4, 10, 6); this.sun.intensity = 3;
    // the open air: reflections and ambient light from the sky, the shadows clearer than in the room
    this.envTarget ||= skyEnvironment({ top: '#3a86dc', mid: '#a6d3f2', horizon: '#f6efe0', sunDir: [4, 10, 6], sunColor: '#fff4d8' }, 0x9c9484);
    this.scene.environment = this.envTarget.texture;
    this.hemi.intensity = 0.6;

    const land = this.land = makeLandscape();
    W.add(land);
    this.roadTex = cobbleTex();
    // the street stops at the quay: clipped there, so it doesn't run on across the harbour
    const clip = this.roadClip = new THREE.Plane(new THREE.Vector3(0, 0, 1), 1000), clipping = { clippingPlanes: [clip] };
    const road = mesh(new THREE.PlaneGeometry(5.4, 240), paint(0xffffff, { map: this.roadTex, bumpMap: this.roadTex, bumpScale: 1.5, roughness: 0.75, ...clipping }), 0, 0, -100);
    road.rotation.x = -Math.PI / 2; road.castShadow = false; W.add(road);
    this.walkTex = slabTex();
    for (const s of [-1, 1]) {
      const walk = mesh(new THREE.PlaneGeometry(1.8, 240), paint(0xffffff, { map: this.walkTex, roughness: 0.85, ...clipping }), s * 3.6, 0.03, -100); walk.rotation.x = -Math.PI / 2; walk.castShadow = false; W.add(walk);
      const curb = mesh(new THREE.BoxGeometry(0.2, 0.14, 240), paint(0xb3aa96, { roughness: 0.8, ...clipping }), s * 2.72, 0.07, -100); W.add(curb);
    }

    // recycling scenery
    this.scenery = [];
    const houseCols = [0xe9c46a, 0xa8c8e6, 0xb9dcc2, 0xf2b8a2, 0xf6efe0, 0xe6d3a3];
    const roofs = [0x9c4a2f, 0x7a3b2a, 0x8f5a3a];
    const SPACING = 11, N = 10;
    this.sceneSpan = SPACING * N;
    for (let i = 0; i < N; i++) for (const s of [-1, 1]) {
      const h = 3.4 + ((i * 3 + (s > 0 ? 1 : 0)) % 4) * 0.8;
      const house = makeHouse(i + (s > 0 ? 1 : 0), houseCols[(i * 2 + (s > 0 ? 1 : 0)) % houseCols.length], 6, h, roofs[i % 3]);
      house.position.set(s * 6.6, 0, 6 - i * SPACING + (s > 0 ? 4 : 0));
      if (s > 0) house.rotation.y = Math.PI;
      W.add(house); this.scenery.push(house);
      const tree = makeTree(); tree.position.set(s * 4.4, 0, 6 - i * SPACING - 5 + (s > 0 ? 3 : 0)); tree.rotation.y = i * 1.7; W.add(tree); this.scenery.push(tree);
      if (i % 2 === 0) { const lamp = makeLamp(); lamp.position.set(s * 3.1, 0, 6 - i * SPACING - 1.5 + (s > 0 ? 5 : 0)); W.add(lamp); this.scenery.push(lamp); }
    }
    // one-off landmarks and road signs (these scroll by once)
    this.oneOffs = [];
    const tower = makeTower(); tower.position.set(-12, 0, -70); W.add(tower); this.oneOffs.push(tower);
    const start = makeSign(['PIATRA NEAMȚ'], '#2e6b3f'); start.position.set(4.3, 0, -10); start.rotation.y = -0.35; W.add(start); this.oneOffs.push(start);
    this.signsAt = [{ d: 150, lines: ['PORT ⚓', '2 km'] }, { d: 310, lines: ['PORT ⚓', '1 km'] }];

    // player
    const b = this.baby;
    if (b.parent) b.parent.remove(b);
    b.position.set(0, 0, 0);
    b.rotation.set(0, Math.PI, 0);
    b.scale.setScalar(1);
    b.visible = true;
    b.userData.carry(this.handCase);
    W.add(b);

    this.lane = 1; this.px = 0; this.py = 0; this.vy = 0;
    this.speed = 10; this.dist = 0; this.hearts = 3; this.invuln = 0; this.stamps = 0; this.stampTotal = 0;
    this.nextRow = 34; this.entities = []; this.shake = 0; this.ending = null; this.babyMode = 'run';
    this.app.hud({ hearts: 3, stamps: 0, progress: 0 });
    this.resize(this.aspect);
  }

  spawnRow(z) {
    const prog = this.dist / GOAL;
    const r = Math.random();
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    const jumpables = ['puddle', 'goose', 'barrel'];
    const pickJ = () => jumpables[Math.floor(Math.random() * jumpables.length)];
    if (r < 0.35) {
      // stamp arc over a jumpable obstacle
      const lane = lanes[0];
      this.addObstacle(pickJ(), lane, z);
      for (let i = 0; i < 5; i++) { const k = (i - 2) / 2; this.addStamp(lane, z + k * 3.2, 0.9 + (1 - k * k) * 1.2); }
      if (prog > 0.3 && Math.random() < 0.6) this.addObstacle('cart', lanes[1], z - 2);
    } else if (r < 0.75) {
      this.addObstacle(Math.random() < 0.5 ? 'cart' : pickJ(), lanes[0], z);
      if (prog > 0.15) this.addObstacle(Math.random() < 0.5 ? 'cart' : pickJ(), lanes[1], z - (Math.random() < 0.5 ? 0 : 5));
      for (let i = 0; i < 5; i++) this.addStamp(lanes[2], z + 4 - i * 2.2, 0.85);
    } else {
      // a goose crossing plus a line of stamps that changes lane
      this.addObstacle('goose', lanes[0], z, true);
      const a = lanes[1], c = lanes[2];
      for (let i = 0; i < 3; i++) this.addStamp(a, z + 6 - i * 2.2, 0.85);
      for (let i = 0; i < 3; i++) this.addStamp(c, z - 2 - i * 2.2, 0.85);
    }
    if (this.hearts < 3 && Math.random() < 0.18) this.addPickup('bottle', lanes[2], z - 8);
  }
  addObstacle(kind, lane, z, walking = false) {
    const spec = {
      puddle: { make: makePuddle, h: 0.15, depth: 1.2 },
      goose: { make: makeGoose, h: 0.75, depth: 0.9 },
      barrel: { make: makeBarrel, h: 0.8, depth: 0.8 },
      cart: { make: makeCart, h: 9, depth: 2.4 },
    }[kind];
    const o = spec.make();
    o.position.set(LANES[lane], 0, z);
    if (kind === 'goose') o.rotation.y = walking ? Math.PI / 2 : 0;
    o.traverse(m => { m.castShadow = !!m.isMesh; });
    this.world.add(o);
    this.entities.push({ type: 'obstacle', kind, obj: o, lane, h: spec.h, depth: spec.depth, walking, phase: Math.random() * 6 });
  }
  addStamp(lane, z, y) {
    const o = makeStamp(this.stampTotal);
    o.position.set(LANES[lane], y, z);
    this.world.add(o);
    this.stampTotal++;
    this.entities.push({ type: 'stamp', obj: o, lane, y, depth: 0.6 });
  }
  addPickup(kind, lane, z) {
    const o = makeBottle(); o.scale.setScalar(1.3);
    o.position.set(LANES[lane], 0.4, z);
    this.world.add(o);
    this.entities.push({ type: 'bottle', obj: o, lane, y: 0.4, depth: 0.7 });
  }

  move(dir) {
    if (this.phase !== 'run' || this.ending?.locked || this.ending?.stage === 'climb' || this.dead) return;
    const nl = Math.max(0, Math.min(2, this.lane + dir));
    if (nl !== this.lane) { this.lane = nl; sound.tone(520 + dir * 60, 0.06, 'sine', 0.12); }
  }
  jump() {
    if (this.phase !== 'run' || this.ending?.locked || this.dead) return;
    if (this.py <= 0.001) { this.vy = JUMP_V; sound.jump(); }
  }

  updateRun(dt) {
    const b = this.baby;
    if (!this.ending && !this.dead) {
      this.speed = Math.min(15.5, 10 + this.dist / GOAL * 5.5);
    }
    const dz = this.speed * dt;
    this.dist += dz;
    // scroll the ground textures at exactly the world's speed
    this.roadTex.offset.y += dz * this.roadTex.repeat.y / 240;
    this.walkTex.offset.y += dz * this.walkTex.repeat.y / 240;
    for (const c of this.land.userData.clouds.children) c.position.x += dt * 0.8;

    for (const o of this.scenery) {
      o.position.z += dz;
      // once the port is coming, houses that pass behind the camera don't come back
      if (o.position.z > 14) { o.position.z -= this.sceneSpan; if (this.port) o.visible = false; }
    }
    for (const o of this.oneOffs) o.position.z += dz;
    while (this.signsAt.length && this.dist >= this.signsAt[0].d) {
      const s = makeSign(this.signsAt.shift().lines); s.position.set(4.3, 0, -95); s.rotation.y = -0.3; this.world.add(s); this.oneOffs.push(s);
    }

    // spawn rows until near the port
    if (!this.ending && this.dist < GOAL - 112) {   // the last row is passed before the steering locks
      this.nextRow -= dz;
      if (this.nextRow <= 0) { this.spawnRow(-95); this.nextRow = 24 - (this.dist / GOAL) * 9; }
    }
    if (!this.ending && this.dist >= GOAL - 100) this.spawnPort();

    // player physics
    this.px += (LANES[this.lane] - this.px) * Math.min(1, dt * 14);
    this.vy -= GRAVITY * dt; this.py = Math.max(0, this.py + this.vy * dt);
    if (this.py === 0) this.vy = 0;
    const scripted = this.ending && this.ending.stage !== 'approach';
    if (!scripted) { b.position.x = this.px; b.position.y = this.py; }
    b.userData.shadow.position.y = 0.01 - b.position.y;
    b.userData.shadow.scale.setScalar(1 - Math.min(0.5, this.py * 0.3));
    this.invuln = Math.max(0, this.invuln - dt);
    if (!scripted) b.visible = this.invuln > 0 ? Math.floor(this.invuln * 12) % 2 === 0 : true;

    // entities
    for (const e of this.entities) {
      e.obj.position.z += dz;
      if (e.type === 'stamp') { e.obj.rotation.y += dt * 3; e.obj.position.y = e.y + Math.sin(this.t * 4 + e.obj.position.z) * 0.08; }
      if (e.type === 'bottle') e.obj.rotation.y += dt * 2;
      if (e.kind === 'goose') {
        e.obj.rotation.z = Math.sin(this.t * 10 + e.phase) * 0.08;
        if (e.walking) { const x = LANES[e.lane] + Math.sin(this.t * 1.2 + e.phase) * 0.6; e.obj.position.x = x; }
      }
      if (e.flying) { e.obj.position.y += e.vy * dt; e.vy -= 20 * dt; e.obj.rotation.x += dt * 8; e.obj.position.x += e.vx * dt; continue; }
      if (e.gone) continue;
      const z = e.obj.position.z;
      if (Math.abs(z) > e.depth / 2 + 0.35 || Math.abs(e.obj.position.x - this.px) > 0.95) continue;
      if (e.type === 'stamp') {
        if (Math.abs(e.obj.position.y - (this.py + 0.75)) < 1.0) { e.gone = true; e.obj.visible = false; this.stamps++; sound.collect(); this.app.hud({ stamps: this.stamps }); }
      } else if (e.type === 'bottle') {
        if (this.py < 1.2) { e.gone = true; e.obj.visible = false; this.hearts = Math.min(3, this.hearts + 1); sound.heal(); this.app.hud({ hearts: this.hearts }); this.app.toast('חלב חם! +❤'); }
      } else if (this.py < e.h - 0.05 && this.invuln <= 0 && !this.dead) {
        this.hit(e);
      }
    }
    this.entities = this.entities.filter(e => {
      if (e.obj.position.z > 10 || e.obj.position.y < -6) { this.world.remove(e.obj); return false; }
      return true;
    });

    if (!this.ending) this.app.hud({ progress: Math.min(1, this.dist / GOAL) });
    if (this.ending) this.updateEnding(dt, dz);

    // camera
    const narrow = this.aspect < 1;
    const cx = this.ending && this.ending.cam ? null : this.px * 0.55;
    if (cx !== null) {
      const sh = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
      this.shake = Math.max(0, this.shake - dt * 2);
      // on a phone the camera sits closer so Relu is big and the obstacles read clearly
      this.camera.position.set(cx + sh, 3.4 + this.py * 0.25, narrow ? 6.2 : 6.4);
      this.camera.lookAt(this.px * 0.35, narrow ? 0.7 : 1.1, -9);
    }
    if (!this.dead) this.babyMode = this.py > 0.05 ? 'jump' : this.ending && this.ending.stage === 'climb' ? 'walk' : this.ending && this.ending.stage === 'sail' ? 'cheer' : this.ending && this.ending.stage === 'done' ? 'idle' : 'run';
  }

  hit(e) {
    this.hearts--;
    this.invuln = 1.6;
    this.shake = 0.6;
    sound.hit();
    e.flying = true; e.vy = 7; e.vx = (Math.random() - 0.5) * 6;
    this.app.hud({ hearts: this.hearts });
    if (this.hearts <= 0) {
      this.dead = true;
      this.speed = 0;
      const b = this.baby;
      this.babyMode = 'none';
      this.tl.add(0, 0.5, p => { b.rotation.x = -p * 1.4; b.position.y = Math.sin(p * Math.PI) * 0.6; });
      this.tl.add(1.3, 0.01, null, () => this.app.levelFailed());
    }
  }

  spawnPort() {
    if (this.port) return;
    const A = this.port = new THREE.Group();
    // the wagon stairs grow to the height of the ship's door sill (their top, foot and first step scale with them);
    // the ship lies with its door at x = 0 and the sill against the end of the stairs' platform
    const ship = this.ship = makeShip(); A.add(ship);
    const D = ship.userData.doorAt;
    const k = D.y / 2.5, S = this.stair = { k, top: D.y, foot: 3.9 * k - 0.1, head: 0.2 * k - 0.1, end: -0.1 - 1.7 * k };
    this.shipX = -D.x; this.shipZ = S.end - D.z + 0.05;
    ship.position.set(this.shipX, 0, this.shipZ);
    // the quay runs along the ship; beyond its edge is the harbour
    const edge = this.quayEdge = Math.max(S.end, this.shipZ + ship.userData.side) + 0.15, depth = 40;
    const concrete = concreteTex(); concrete.repeat.set(16, 4);
    const quay = mesh(new THREE.PlaneGeometry(200, depth), paint(0xffffff, { map: concrete, roughness: 0.9 }), 0, 0.05, edge + depth / 2); quay.rotation.x = -Math.PI / 2; quay.castShadow = false; A.add(quay);
    A.add(mesh(new THREE.BoxGeometry(200, 0.1, 0.5), paint(0x4d4a45, { roughness: 0.9 }), 0, 0.08, edge + 0.25));
    // the harbour: deep water that catches the sky on its ripples
    const water = this.waterTex = rippleNormals([90, 45]);
    const sea = mesh(new THREE.PlaneGeometry(1200, 600), new THREE.MeshStandardMaterial({ color: 0x14586f, normalMap: water, normalScale: new THREE.Vector2(0.55, 0.55), roughness: 0.16, metalness: 0, envMapIntensity: 1.35 }), 0, 0, edge - 300); sea.rotation.x = -Math.PI / 2; sea.castShadow = false; A.add(sea);
    for (let x = -46; x <= 46; x += 11.5) if (Math.abs(x) > 3) { const b = makeBollard(); b.position.set(x, 0.05, edge + 0.8); A.add(b); }
    const stairs = this.stairs = makeStairs(); stairs.scale.setScalar(k); stairs.position.set(0, 0, -0.1); A.add(stairs);
    const small = o => { o.scale.setScalar(0.8); return o; };   // the hand-built fallbacks are oversized
    const mom = makeFigure('mom', 2.9) || small(makeAdult({ coat: 0x7d4f6e, dress: true })); mom.position.set(-0.45, S.top, S.end + 0.75 * k); mom.rotation.y = 0.15;
    const dad = makeFigure('dad', 3.1) || small(makeAdult({ coat: 0x3d4250, hat: true })); dad.position.set(0.5, S.top, S.end + 0.7 * k); dad.rotation.y = -0.15;
    for (const p of [mom, dad]) { p.userData.baseScale = p.scale.x; p.userData.mode = 'idle'; }
    A.add(mom, dad);
    this.parents = [mom, dad];
    const crane = makeCrane(); crane.position.set(-27, 0.05, edge + 3.5); A.add(crane);
    const crane2 = makeCrane(); crane2.position.set(34, 0.05, edge + 3.5); A.add(crane2);
    const lighthouse = makeLighthouse(); lighthouse.position.set(70, 0, edge - 110); A.add(lighthouse);
    const terminal = makeTerminal(); if (terminal) { terminal.position.set(-17, 0.05, edge + 19); terminal.rotation.y = 2.8; A.add(terminal); }
    const cart = makeLuggageCart(); if (cart) { cart.position.set(2.8, 0.05, 3.4); cart.rotation.y = -0.5; A.add(cart); }
    const sign = makeSign(['PORTUL', 'CONSTANȚA ⚓'], '#1f4e9c'); sign.position.set(-6.5, 0.05, 9); sign.rotation.y = 0.5; A.add(sign);
    A.position.z = -this.world.position.z - (GOAL - this.dist) - 6;
    // clear the street beyond the quay so nothing stands in the sailing shot
    for (const o of [...this.scenery, ...this.oneOffs]) if (o.position.z < A.position.z + edge + depth + 4) o.visible = false;
    this.world.add(A);
    this.ending = { stage: 'approach' };
  }

  updateEnding(dt, dz) {
    const A = this.port, E = this.ending, b = this.baby, ship = this.ship;
    if (!A) return;
    A.position.z += dz;
    this.roadClip.constant = -(A.position.z + this.quayEdge);
    // the ship rides the swell, its funnel smokes, and the harbour ripples
    ship.userData.smoke.userData.update(dt);
    ship.position.y = Math.sin(this.t * 0.9) * 0.06;
    ship.rotation.x = Math.sin(this.t * 0.7) * 0.004;
    this.waterTex.offset.x += dt * 0.05; this.waterTex.offset.y += dt * 0.03;
    // stairs foot is at A.z + 3.9; stop the world so the baby stops just in front of it
    const S = this.stair, remaining = -(A.position.z + S.foot) - 0.5;
    // Mom and Dad wait at the door and wave to Relu now and then (one wave each, out of step), not nonstop
    this.parents.forEach((p, i) => {
      if (E.stage !== 'approach') { p.userData.animate(this.t, p.userData.mode); return; }
      const len = p.userData.clipLength('wave'), cycle = len + 2.2 + i * 0.9;
      p.userData.animate(this.t, remaining < 45 && (this.t + i * 1.7) % cycle < len ? 'wave' : 'idle');
    });
    // the door swings open as Relu comes up to the stairs
    const door = ship.userData.door;
    if (door && E.stage === 'approach' && remaining < 30) door.rotation.y += (DOOR_OPEN - door.rotation.y) * Math.min(1, dt * 2.5);
    if (E.stage === 'approach') {
      // he steers freely until the last few meters, then lines up with the stairs
      if (remaining < 12) { E.locked = true; this.lane = 1; }
      if (remaining < 30) this.speed = Math.max(2.5, Math.min(this.speed, remaining * 0.9));
      if (remaining <= 0.05) {
        this.speed = 0; E.stage = 'climb';
        sound.fanfare();
        this.app.hud({ progress: 1 });
        this.tl.add(0, 2.4, p => {
          // climb the 9 steps up to the door
          const z = A.position.z + S.foot - p * (S.foot - S.head);
          b.position.set(0, p * S.top, z);
          b.rotation.y = Math.PI;
        }, () => { E.stage = 'done'; });
        // the family walks in through the door together (the dark inside hides them as they go in), and it shuts behind them
        // (Relu lives in the world group, Mom and Dad in the port's: all end up 1.6 m inside the door)
        const inside = [b, ...this.parents].map(o => ({ o, z: o.position.z, to: (o === b ? A.position.z : 0) + S.end - 1.6 }));
        this.tl.add(2.5, 0.01, null, () => this.parents.forEach(p => { p.userData.mode = 'walk'; }));
        this.tl.add(2.6, 1.1, p => { for (const { o, z, to } of inside) { o.position.z = z + (to - z) * ease.inOut(p); o.rotation.y = Math.PI; } },
          () => inside.forEach(({ o }) => { o.visible = false; }));
        if (door) this.tl.add(3.75, 0.6, p => { door.rotation.y = DOOR_OPEN * (1 - ease.inOut(p)); });
        // the stair wagon rolls back and the ship sounds its horn
        const st = this.stairs, stZ = st.position.z;
        this.tl.add(4.3, 1.2, p => { st.position.z = stZ + ease.inOut(p) * 4.5; st.position.x = -ease.inOut(p) * 1.5; });
        this.tl.add(4.6, 0.01, null, () => sound.horn());
        // the three of them come out on deck to wave goodbye as she sails
        this.tl.add(4.9, 0.01, null, () => {
          const d = ship.userData.deck;
          [this.parents[0], b, this.parents[1]].forEach((o, i) => {
            ship.add(o); o.position.set(d.x - 2.4 + i * 2.4, d.y, d.z); o.rotation.set(0, 0, 0); o.visible = true;
          });
          this.parents.forEach(p => { p.userData.mode = 'wave'; });
          E.stage = 'sail'; E.sail = 0;
        });
        this.tl.add(8.6, 0.01, null, () => sound.horn());
        const X = this.shipX;
        const Z = this.shipZ;
        this.tl.add(5.4, 7.2, p => {
          // gathering way, and turning her bow out to sea
          ship.position.x = X - p * p * 110;
          ship.position.z = Z - p * p * 70;
          ship.rotation.y = -0.45 * p * p;
        });
        this.tl.add(12.4, 0.01, null, () => this.app.levelComplete(this.result()));
        E.cam = true;
        E.camFrom = this.camera.position.clone();
      }
    }
    if (E.cam) {
      E.ct = (E.ct || 0) + dt;
      const p = Math.min(1, E.ct / 1.5), e = ease.inOut(p);
      if (E.stage !== 'sail') {
        // swing round to watch Relu climb up to Mom and Dad at the door
        this.camera.position.lerpVectors(E.camFrom, new THREE.Vector3(-7.5, 5.6, A.position.z + 13), e);
        this.camera.lookAt(0.4, 3.9, A.position.z - 0.6);
      } else {
        // first close on the family at the rail, then pull back along the quay as the ship draws away
        E.sail += dt;
        const d = ship.userData.deck, q = ease.inOut(Math.min(1, E.sail / 7));
        const x = ship.position.x + d.x, y = d.y, z = A.position.z + ship.position.z + d.z;
        const want = new THREE.Vector3(x + 3 + q * 34, y + 1 + q * 7, A.position.z + this.shipZ + d.z + 13 + q * 24);
        this.camera.position.lerp(want, Math.min(1, dt * 2.2));
        this.camera.lookAt(x + q * 14, y + 1.2 + q * 2, z);
      }
    }
  }

  result() {
    const ratio = this.stampTotal ? this.stamps / this.stampTotal : 0;
    const stars = 1 + (ratio >= 0.4 ? 1 : 0) + (ratio >= 0.7 ? 1 : 0);
    return { stars, stamps: this.stamps, total: this.stampTotal, hearts: this.hearts };
  }

  // ------------------------------------------------ loop plumbing
  resize(aspect) {
    this.aspect = aspect;
    const c = this.camera;
    c.aspect = aspect;
    if (this.phase === 'pack' || this.phase === 'packdone') {
      c.fov = aspect < 1 ? 55 : 42;
      // fit the whole dollhouse (walls, window and all) on any screen
      if (!this.roomSphere && this.room) this.roomSphere = new THREE.Box3().setFromObject(this.room).getBoundingSphere(new THREE.Sphere());
      const s = this.roomSphere || new THREE.Sphere(new THREE.Vector3(0, 2, 0), 7);
      const vHalf = c.fov * Math.PI / 360, hHalf = Math.atan(Math.tan(vHalf) * aspect);
      // on a portrait phone, let the side walls run off the edges so the toys are big enough to tap
      const d = s.radius * (aspect < 1 ? 0.6 : 0.74) / Math.sin(Math.min(vHalf, hHalf));
      const dir = new THREE.Vector3(0.08, 0.6, 0.8).normalize();
      c.position.copy(s.center).addScaledVector(dir, d);
      c.lookAt(s.center.x, s.center.y - 1.1, s.center.z + 0.4);
    } else {
      c.fov = aspect < 1 ? 66 : 58;
    }
    c.updateProjectionMatrix();
  }

  update(dt) {
    if (this.paused) return;
    this.t += dt;
    this.tl.update(dt);
    if (this.phase === 'pack' || this.phase === 'packdone') {
      for (const it of this.items) if (!it.done) {
        it.obj.position.y = Math.abs(Math.sin(this.t * 2.2 + it.phase)) * 0.12;
        const hint = it.good && this.t - this.packStart > 14;
        const s = hint ? 1 + Math.sin(this.t * 8) * 0.08 : 1;
        it.obj.scale.setScalar(s);
      }
    } else if (this.phase === 'run') {
      this.updateRun(dt);
    }
    // keep the shadow box centred on Relu
    this.baby.getWorldPosition(this.sun.target.position);
    this.sun.position.copy(this.sun.target.position).add(SUN_DIR);
    if (this.babyMode !== 'none') this.baby.userData.animate(this.t, this.babyMode, this.speed ? Math.max(0.7, this.speed / 12) : 1);
  }

  dispose() { disposeTree(this.scene); this.envTarget?.dispose(); this.waterTex?.dispose(); }
}
