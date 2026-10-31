import { THREE, paint, mesh, photoTex, Timeline, ease, sound } from './engine.js';
import { makeFigure } from './character.js';
import { model } from './models.js';

// Level 2 · Jerusalem, 1966
// Relu, about ten, plays "Yonatan HaKatan" for his piano teacher. Notes fall onto five keys (C D E F G);
// tap each key as its note reaches the line. Every note counts toward the stars; nobody fails a song.

const BPM = 100;
const BEAT = 60 / BPM;
const COUNT_IN = 4;        // metronome clicks before the first note
const TRAVEL = 1.9;        // seconds a note takes to fall to the line
const PERFECT = 0.12, GOOD = 0.3;

// "Yonatan HaKatan" (traditional): [lane 0..4 = C D E F G, length in beats]
const C = 0, D = 1, E = 2, F = 3, G = 4;
const SONG = [
  [G, 1], [E, 1], [E, 2], [F, 1], [D, 1], [D, 2], [C, 1], [D, 1], [E, 1], [F, 1], [G, 1], [G, 1], [G, 2],
  [G, 1], [E, 1], [E, 2], [F, 1], [D, 1], [D, 2], [C, 1], [E, 1], [G, 1], [G, 1], [C, 4],
  [D, 1], [D, 1], [D, 1], [D, 1], [D, 1], [E, 1], [F, 2], [E, 1], [E, 1], [E, 1], [E, 1], [E, 1], [F, 1], [G, 2],
  [G, 1], [E, 1], [E, 2], [F, 1], [D, 1], [D, 2], [C, 1], [E, 1], [G, 1], [G, 1], [C, 4],
];
// one chord per bar, for the soft left-hand accompaniment
const BARS = ['C', 'G', 'C', 'C', 'C', 'G', 'C', 'C', 'G', 'G', 'C', 'C', 'C', 'G', 'C', 'C'];
const BASS = { C: [130.8, 98.0], G: [98.0, 146.8] };
const FREQ = [261.6, 293.7, 329.6, 349.2, 392.0];
const KEYS = [
  { he: 'דו', en: 'C', col: '#e05a4f' }, { he: 'רה', en: 'D', col: '#f0a23a' }, { he: 'מי', en: 'E', col: '#e8c94a' },
  { he: 'פה', en: 'F', col: '#5bb36a' }, { he: 'סול', en: 'G', col: '#4f8fd6' },
];

// where the piano group stands, and its turn out from the back wall
const SET = { x: -2.0, z: -3.85, ry: -0.45 };

const CAM = { posL: [3.4, 3.5, -1.5], lookL: [-3.1, 1.75, -3.2], fovL: 43, offL: 0.12,
              posP: [3.4, 4.3, -0.2], lookP: [-3.2, 1.5, -3.2], fovP: 58, offP: 0.08 };

// an open songbook on the piano's music rest
function makeMusicBook() {
  const tex = new THREE.CanvasTexture((() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#f3ead6'; g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#c9b996'; g.fillRect(126, 0, 4, 160);
    g.strokeStyle = '#4a3b2a'; g.lineWidth = 1;
    for (const x0 of [12, 140]) for (let st = 0; st < 4; st++) for (let l = 0; l < 5; l++) {
      const y = 22 + st * 34 + l * 4; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + 104, y); g.stroke();
    }
    g.fillStyle = '#2b2118';
    for (let i = 0; i < 40; i++) { const x = (i % 20 < 10 ? 18 : 146) + (i % 10) * 10, y = 22 + Math.floor(i / 10) % 4 * 34 + (i * 7 % 5) * 2; g.beginPath(); g.ellipse(x, y + 2, 3, 2.2, -0.4, 0, 7); g.fill(); }
    return c;
  })());
  tex.colorSpace = THREE.SRGBColorSpace;
  const book = mesh(new THREE.BoxGeometry(1.0, 0.62, 0.03), paint(0xffffff, { map: tex, roughness: 0.95 }), 0, 2.05, 0.2);
  book.rotation.x = -0.28;
  return book;
}

const tiled = (url, rx, ry) => {
  const t = photoTex(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8;
  return t;
};

// the family's flat in Jerusalem: golden stone walls, patterned tiles, the Old City through the window
function buildApartment() {
  const room = new THREE.Group();
  const w = 12, d = 10, h = 6.4;
  const floor = mesh(new THREE.PlaneGeometry(w, d), paint(0xffffff, { map: tiled('assets/tex_tiles.jpg', w / 2.4, d / 2.4), roughness: 0.75 }), 0, 0, 0);
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false; room.add(floor);
  room.add(mesh(new THREE.BoxGeometry(w + 0.3, 0.35, 0.3), paint(0x8a6a4a, { roughness: 0.8 }), 0, -0.17, d / 2));
  const stone = len => paint(0xf0e0c4, { map: tiled('assets/tex_stone.jpg', len / 3, h / 3), roughness: 0.95 });
  const wall = (len, x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const p = mesh(new THREE.PlaneGeometry(len, h), stone(len), 0, h / 2, 0); p.castShadow = false; g.add(p);
    g.add(mesh(new THREE.BoxGeometry(len + 0.3, h, 0.3), paint(0xc9b08a, { roughness: 0.9 }), 0, h / 2, -0.16));   // thickness at the cut edges
    g.add(mesh(new THREE.BoxGeometry(len, 0.16, 0.1), paint(0xb89a74, { roughness: 0.9 }), 0, 0.08, 0.05));      // skirting
    room.add(g);
  };
  wall(w, 0, -d / 2, 0);
  wall(d, -w / 2, 0, Math.PI / 2);
  wall(d, w / 2, 0, -Math.PI / 2);

  // the arched window, with Jerusalem behind it
  const view = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 3.9), new THREE.MeshBasicMaterial({ map: photoTex('assets/jerusalem_view.jpg'), toneMapped: false }));
  view.position.set(2.8, 3.4, -d / 2 + 0.03); room.add(view);
  const win = model('archWindow');
  if (win) { win.position.set(2.8, 0.6, -d / 2 + 0.35); room.add(win); }

  // his real photo at the piano, framed above it
  const pic = new THREE.Group(); pic.position.set(-2.2, 4.75, -d / 2 + 0.06);
  pic.add(mesh(new THREE.BoxGeometry(1.35, 0.98, 0.06), paint(0x3d2616, { roughness: 0.4 }), 0, 0, 0));
  pic.add(mesh(new THREE.PlaneGeometry(1.2, 0.83), paint(0xffffff, { map: photoTex('assets/era2_piano.jpg'), roughness: 0.4 }), 0, 0, 0.04));
  room.add(pic);

  const put = (name, x, z, ry) => { const m = model(name); if (m) { m.position.set(x, 0, z); m.rotation.y = ry; room.add(m); } return m; };
  // (the piano, its bench and Relu are set up by the level, as one group)
  put('bookshelf', -5.55, -1.2, Math.PI / 2);
  put('sofa', 4.9, 1.6, -Math.PI / 2);
  put('plant', 5.0, -4.2, 0.4);

  // late-afternoon Jerusalem light through the window
  const beam = new THREE.SpotLight(0xffd59a, 70, 16, 0.65, 0.9, 1.5);
  beam.position.set(2.8, 5.0, -d / 2 + 0.8); beam.target.position.set(-1.0, 0, -1.5);
  room.add(beam, beam.target);
  return room;
}

export class Level2 {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a1d14);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    this.t = 0;
    this.paused = false;
    this.aspect = 1;
    this.phase = 'ready';
    this.music = false;   // the song is the music

    this.scene.add(new THREE.HemisphereLight(0xfff1dc, 0x6a5a48, 1.15));
    const sun = this.sun = new THREE.DirectionalLight(0xffe2bc, 1.8); sun.position.set(3, 11, 8);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 4; sun.shadow.normalBias = 0.02;
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 30 });
    this.scene.add(sun);
    this.scene.add(buildApartment());

    // the piano, angled out from the back wall so the camera at its side sees Relu's face and hands
    const set = this.set = new THREE.Group();
    set.position.set(SET.x, 0, SET.z); set.rotation.y = SET.ry;
    this.scene.add(set);
    const piano = model('piano');
    if (piano) { piano.scale.multiplyScalar(1.08); set.add(piano); }   // keys at a ten-year-old's hands
    const bench = model('pianoBench');
    if (bench) { bench.scale.y *= 0.7; bench.position.z = 1.25; set.add(bench); }   // seat at his hips, not his chest
    set.add(makeMusicBook());
    const lamp = new THREE.PointLight(0xffc98a, 9, 7, 1.6);   // warm light on the piano and his face
    lamp.position.set(1.4, 3.6, 2.2); set.add(lamp);

    // Relu on the bench, the teacher standing at the far end of the keyboard, facing him and us
    this.kid = makeFigure('kid', 2.8);
    if (this.kid) { this.kid.position.set(0, 0.17, 0.9); this.kid.rotation.y = Math.PI; set.add(this.kid); }   // raised so his seated hands reach the keys
    this.teacher = makeFigure('teacher', 3.1);
    if (this.teacher) { this.teacher.position.set(-4.0, 0, -2.3); this.teacher.rotation.y = 1.75; this.scene.add(this.teacher); }

    // musical notes that float up from the piano on every good hit
    this.floaters = [];
    this.noteTex = new THREE.CanvasTexture((() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.font = 'bold 54px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♪', 32, 34);
      return c;
    })());

    this.buildOverlay();
    this.startRun();
  }

  // ------------------------------------------------ the falling-notes overlay (2D canvas over the 3D view)
  buildOverlay() {
    const cv = this.cv = document.createElement('canvas');
    cv.id = 'rhythm';
    Object.assign(cv.style, { position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: '0', zIndex: 5, touchAction: 'none', display: 'block' });
    document.body.appendChild(cv);
    this.ctx = cv.getContext('2d');
    this.pressed = [0, 0, 0, 0, 0];
    this.onDown = e => {
      e.preventDefault();
      sound.unlock();
      const r = cv.getBoundingClientRect();
      this.press(Math.min(4, Math.max(0, Math.floor((e.clientX - r.left) / r.width * 5))));
    };
    cv.addEventListener('pointerdown', this.onDown);
  }
  layoutOverlay() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const cssW = Math.min(vw, 620), cssH = Math.round(vh * (this.aspect < 1 ? 0.42 : 0.4));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    Object.assign(this.cv.style, { width: cssW + 'px', height: cssH + 'px' });
    this.cv.width = Math.round(cssW * dpr); this.cv.height = Math.round(cssH * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.cw = cssW; this.ch = cssH;
  }

  onKey(code) {
    const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].indexOf(code);
    const j = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG'].indexOf(code);
    const lane = i >= 0 ? i : j;
    if (lane < 0 || this.phase !== 'run') return false;
    this.press(lane);
    return true;
  }
  // the run-level swipe/tap handlers don't apply here
  move() {}
  jump() {}

  // ------------------------------------------------ song
  startRun() {
    this.phase = 'run';
    this.ending = false;
    this.songT = -COUNT_IN * BEAT;
    let beat = 0;
    this.notes = SONG.map(([lane, len]) => { const n = { lane, t: beat * BEAT, hit: false, judged: false }; beat += len; return n; });
    this.songLen = beat * BEAT;
    this.hits = 0; this.perfects = 0;
    this.nextBeat = -COUNT_IN;
    this.pops = [];
    this.app.hud({ stamps: 0, progress: 0 });
  }

  press(lane) {
    if (this.paused || this.phase !== 'run') return;
    this.pressed[lane] = 0.18;
    let best = null, bestDt = GOOD;
    for (const n of this.notes) {
      if (n.judged || n.lane !== lane) continue;
      const dt = Math.abs(n.t - this.songT);
      if (dt < bestDt) { bestDt = dt; best = n; }
    }
    if (!best) { sound.tone(110, 0.08, 'sine', 0.06); return; }
    best.judged = best.hit = true;
    this.hits++;
    const perfect = bestDt <= PERFECT;
    if (perfect) this.perfects++;
    sound.piano(FREQ[lane]);
    this.pops.push({ lane, text: perfect ? 'מושלם!' : 'יפה!', col: perfect ? '#ffd76a' : '#ffffff', life: 0.7 });
    this.app.hud({ stamps: this.hits });
    this.floatNote(KEYS[lane].col);
  }

  floatNote(col) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.noteTex, color: col, transparent: true, depthWrite: false }));
    s.position.set((Math.random() - 0.5) * 1.6, 3.0, 0.2 + Math.random() * 0.3);
    this.set.localToWorld(s.position);
    s.scale.setScalar(0.55);
    this.scene.add(s);
    this.floaters.push({ s, life: 1.4, vx: 0.3 + Math.random() * 0.4 });
  }

  updateSong(dt) {
    this.songT += dt;
    // left-hand accompaniment and the count-in clicks, on the beat
    while (this.songT >= this.nextBeat * BEAT) {
      const b = this.nextBeat++;
      if (b < 0) { sound.tone(b === -1 ? 1568 : 1046, 0.05, 'square', 0.08); continue; }
      const bar = Math.floor(b / 4), inBar = b % 4;
      if (bar < BARS.length && (inBar === 0 || inBar === 2)) sound.piano(BASS[BARS[bar]][inBar ? 1 : 0], 0.12);
    }
    for (const n of this.notes) {
      if (!n.judged && this.songT - n.t > GOOD) { n.judged = true; this.pops.push({ lane: n.lane, text: 'פספוס', col: 'rgba(255,255,255,.55)', life: 0.5 }); }
    }
    this.app.hud({ progress: Math.min(1, Math.max(0, this.songT / this.songLen)) });
    if (this.songT > this.songLen + 0.8 && !this.ending) this.finish();
  }

  finish() {
    this.ending = true;
    this.phase = 'done';
    sound.fanfare();
    this.tl = new Timeline();
    this.tl.add(2.6, 0.01, null, () => this.app.levelComplete(this.result()));
  }

  result() {
    const ratio = this.hits / this.notes.length;
    const stars = ratio >= 0.85 ? 3 : ratio >= 0.6 ? 2 : 1;
    return { stars, summary: `ניגנת ${this.hits} מתוך ${this.notes.length} תווים${this.perfects ? `, ${this.perfects} מהם מושלמים` : ''}.` };
  }

  // ------------------------------------------------ drawing the overlay
  drawOverlay(dt) {
    const g = this.ctx, W = this.cw, H = this.ch;
    if (!W) return;
    g.clearRect(0, 0, W, H);
    const lw = W / 5, padH = Math.min(86, H * 0.24), hitY = H - padH - 8;
    // soft dark band so notes read over the room
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, 'rgba(30,20,12,0)'); bg.addColorStop(0.25, 'rgba(30,20,12,.45)'); bg.addColorStop(1, 'rgba(30,20,12,.75)');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 1; i < 5; i++) { g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(i * lw - 1, 0, 2, hitY); }
    // the line
    g.fillStyle = 'rgba(255,240,200,.85)'; g.fillRect(6, hitY - 2, W - 12, 4);
    // falling notes
    for (const n of this.notes) {
      if (n.hit) continue;
      const k = (n.t - this.songT) / TRAVEL;
      if (k > 1.05 || k < -0.3) continue;
      const x = n.lane * lw + lw / 2, y = hitY - k * hitY, r = Math.min(lw * 0.3, 26);
      g.globalAlpha = n.judged ? 0.3 : 1;
      g.fillStyle = KEYS[n.lane].col;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 3; g.stroke();
      g.fillStyle = '#fff'; g.font = `bold ${Math.round(r * 1.25)}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('♪', x, y + 1);
      g.globalAlpha = 1;
    }
    // the five keys
    for (let i = 0; i < 5; i++) {
      const x = i * lw + 5, y = H - padH - 2, pw = lw - 10, lit = this.pressed[i] > 0;
      g.fillStyle = lit ? '#fffdf4' : KEYS[i].col;
      g.beginPath(); g.roundRect(x, y, pw, padH - 6, 14); g.fill();
      g.fillStyle = lit ? KEYS[i].col : '#fff';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `bold ${Math.round(Math.min(26, lw * 0.3))}px "Secular One", sans-serif`; g.fillText(KEYS[i].he, x + pw / 2, y + padH * 0.38);
      g.font = `${Math.round(Math.min(14, lw * 0.16))}px "Varela Round", sans-serif`; g.fillText(KEYS[i].en, x + pw / 2, y + padH * 0.7);
      this.pressed[i] = Math.max(0, this.pressed[i] - dt);
    }
    // "perfect / nice / missed" pops
    for (const p of this.pops) {
      p.life -= dt;
      g.globalAlpha = Math.max(0, Math.min(1, p.life * 2));
      g.fillStyle = p.col; g.font = 'bold 20px "Secular One", sans-serif'; g.textAlign = 'center'; g.direction = 'rtl';   // Hebrew: the "!" goes on the left
      g.fillText(p.text, p.lane * lw + lw / 2, hitY - 34 - (0.7 - p.life) * 40);
      g.globalAlpha = 1;
    }
    this.pops = this.pops.filter(p => p.life > 0);
    // count-in
    if (this.songT < 0) {
      const n = Math.ceil(-this.songT / BEAT);
      g.fillStyle = '#fff'; g.font = 'bold 64px "Secular One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
      g.fillText(n > COUNT_IN - 1 ? 'מוכנים?' : String(n), W / 2, hitY / 2);
    }
  }

  // ------------------------------------------------ loop plumbing
  resize(aspect) {
    this.aspect = aspect;
    const c = this.camera;
    c.aspect = aspect;
    c.fov = aspect < 1 ? CAM.fovP : CAM.fovL;
    // from beside the piano, so Relu's face and hands show; the keys overlay covers the bottom of the
    // screen, so the view is shifted up to keep the scene above it
    c.position.set(...(aspect < 1 ? CAM.posP : CAM.posL));
    c.lookAt(...(aspect < 1 ? CAM.lookP : CAM.lookL));
    const H = 1000, Wd = H * aspect;
    c.setViewOffset(Wd, H, 0, H * (aspect < 1 ? CAM.offP : CAM.offL), Wd, H);
    c.updateProjectionMatrix();
    this.layoutOverlay();
  }

  update(dt) {
    if (this.paused) { this.drawOverlay(0); return; }
    this.t += dt;
    if (this.phase === 'run') this.updateSong(dt);
    if (this.tl) this.tl.update(dt);
    const done = this.phase === 'done';
    // Relu plays while the song runs; the teacher nods along, then cheers when he finishes
    const playing = this.phase === 'run' && this.songT > -BEAT;
    if (this.kid) this.kid.userData.animate(this.t, playing ? 'piano' : 'sit');
    if (this.teacher) {
      this.teacher.userData.animate(this.t, done ? 'cheer' : playing ? 'listening' : 'idle');
    }
    for (const f of this.floaters) {
      f.life -= dt;
      f.s.position.y += dt * 1.1; f.s.position.x += dt * f.vx;
      f.s.material.opacity = Math.max(0, Math.min(1, f.life));
    }
    this.floaters = this.floaters.filter(f => { if (f.life > 0) return true; this.scene.remove(f.s); f.s.material.dispose(); return false; });
    this.drawOverlay(dt);
  }

  dispose() {
    this.cv.removeEventListener('pointerdown', this.onDown);
    this.cv.remove();
    this.scene.traverse(o => { if (o.geometry && !o.userData.keep) o.geometry.dispose(); });
  }
}
