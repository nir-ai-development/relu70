import { THREE, paint, mesh, photoTex, Timeline, sound } from './engine.js';
import { skyEnvironment, plasterSet, tileSet } from './gfx.js';
import { makeFigure } from './character.js';
import { model } from './models.js';

// Level 5 · Hadassah, Jerusalem, 1985
// Dr. Avraham's clinic. Patients come in one by one, each with a complaint over their head; tap the right
// treatment before their patience runs out. Faster cures, more stars. Nobody fails a clinic day.

const PATIENTS = 12;
const PATIENCE = 7;          // seconds before a patient gives up (shrinks as the day gets busy)
const TOOLS = [
  { icon: '🌡️', he: 'מדחום', col: '#e05a4f' },
  { icon: '🩺', he: 'סטטוסקופ', col: '#4f8fd6' },
  { icon: '🩹', he: 'פלסטר', col: '#f0a23a' },
  { icon: '💊', he: 'תרופה', col: '#5bb36a' },
];
// complaint -> the tool that cures it
const COMPLAINTS = [
  { icon: '🤒', he: 'יש לי חום!', tool: 0 },
  { icon: '😮‍💨', he: 'אני משתעל…', tool: 1 },
  { icon: '💓', he: 'הלב דופק מהר', tool: 1 },
  { icon: '🤕', he: 'נחתכתי!', tool: 2 },
  { icon: '🦵', he: 'שרטתי את הברך', tool: 2 },
  { icon: '🤢', he: 'כואבת לי הבטן', tool: 3 },
  { icon: '🥶', he: 'קר לי, אני רועד', tool: 0 },
  { icon: '🤧', he: 'אפצ׳י!', tool: 3 },
];
// who comes in (rigged figures already made for the earlier levels) and how tall they stand
// (three, to keep the level's download small; Mom and Dad are often cached from level 1 already)
const VISITORS = [['mom', 3.3], ['dad', 3.5], ['teacher', 3.1]];
const DOOR_X = 6.9, SPOT_X = 2.0, SPOT_Z = 1.2;
const DOC_HOME = new THREE.Vector3(-0.5, 0, -0.9), DOC_NEAR = new THREE.Vector3(0.45, 0, 0.1);
const REACH = new THREE.Vector3();
const near = (a, b, step) => { const d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + d * Math.min(1, step); };

function buildClinic(own) {
  const room = new THREE.Group();
  const w = 13, d = 10, h = 6.2;
  // (the room runs on behind the camera, so its end never shows)
  const floor = mesh(new THREE.PlaneGeometry(w, d + 14), paint(0xa4aaa0, { roughness: 0.32 }), 0, 0, 7);
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false; room.add(floor);
  // terrazzo flecks
  const fleck = new THREE.InstancedMesh(new THREE.CircleGeometry(0.05, 5), paint(0x9aa096), 500);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  for (let i = 0; i < 500; i++) fleck.setMatrixAt(i, m4.compose(new THREE.Vector3((Math.random() - 0.5) * w, 0.005, (Math.random() - 0.5) * d), q, new THREE.Vector3(1, 1, 1).multiplyScalar(0.5 + Math.random())));
  room.add(fleck);
  const upperSet = plasterSet({ rgb: [243, 241, 232], vary: 8, repeat: [3, 2], seed: 9 }), lowerSet = tileSet({ tiles: 4, rgb: [150, 198, 188], vary: 10, grout: '#d9ece6', groutW: 4, rough: 0.2, stone: false, seed: 23 });
  lowerSet.scale(1.6); own.push(upperSet, lowerSet);
  const upper = paint(0xffffff, { map: upperSet.map, normalMap: upperSet.normalMap, roughness: 0.92 });
  const lower = paint(0xffffff, { map: lowerSet.map, normalMap: lowerSet.normalMap, roughnessMap: lowerSet.roughnessMap, roughness: 1 });
  const wall = (len, x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; room.add(g);
    const p = mesh(new THREE.PlaneGeometry(len, h), upper, 0, h / 2, 0); p.castShadow = false; g.add(p);
    // (tile faces measured in world units, so they stay square)
    const lg = new THREE.PlaneGeometry(len, 2.2), luv = lg.attributes.uv, lp = lg.attributes.position;
    for (let i = 0; i < lp.count; i++) luv.setXY(i, lp.getX(i), lp.getY(i));
    const l = mesh(lg, lower, 0, 1.1, 0.01); l.castShadow = false; g.add(l);
    g.add(mesh(new THREE.BoxGeometry(len, 0.08, 0.05), paint(0x6f9a90), 0, 2.2, 0.03));
    return g;
  };
  const back = wall(w, 0, -d / 2, 0);
  wall(d + 14, -w / 2, 7, Math.PI / 2);
  wall(d + 14, w / 2, 7, -Math.PI / 2);
  // a window onto Jerusalem and the hospital's name over the door
  const view = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.4), new THREE.MeshBasicMaterial({ map: photoTex('assets/jerusalem_view.jpg'), toneMapped: false }));
  view.position.set(2.6, 3.7, 0.03); back.add(view);
  for (const [fw, fh, ox, oy] of [[3.4, 0.14, 0, 1.27], [3.4, 0.14, 0, -1.27], [0.14, 2.6, -1.67, 0], [0.14, 2.6, 1.67, 0], [0.08, 2.4, 0, 0]])
    back.add(mesh(new THREE.BoxGeometry(fw, fh, 0.12), paint(0xe8e8e0), 2.6 + ox, 3.7 + oy, 0.06));
  const sign = document.createElement('canvas'); sign.width = 512; sign.height = 128;
  const g = sign.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#1f5f8b'; g.font = 'bold 54px "Secular One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillText('הדסה · מרפאה', 256, 52); g.font = '28px "Varela Round", sans-serif'; g.fillText('ד״ר ר. אברהם', 256, 100);
  const st = new THREE.CanvasTexture(sign); st.colorSpace = THREE.SRGBColorSpace;
  back.add(mesh(new THREE.PlaneGeometry(2.6, 0.65), paint(0xffffff, { map: st, roughness: 0.6 }), -2.6, 4.9, 0.04));
  // an eye chart, as every clinic had
  const chart = document.createElement('canvas'); chart.width = 128; chart.height = 192;
  const c = chart.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, 128, 192); c.fillStyle = '#111'; c.textAlign = 'center';
  ['E', 'F P', 'T O Z', 'L P E D', 'P E C F D'].forEach((r, i) => { c.font = `bold ${44 - i * 8}px sans-serif`; c.fillText(r, 64, 40 + i * 34); });
  const ct = new THREE.CanvasTexture(chart); ct.colorSpace = THREE.SRGBColorSpace;
  back.add(mesh(new THREE.PlaneGeometry(0.9, 1.35), paint(0xffffff, { map: ct }), -0.6, 3.6, 0.04));

  const put = (name, x, z, ry) => { const m = model(name); if (m) { m.position.set(x, 0, z); m.rotation.y = ry; room.add(m); } return m; };
  put('examBed', -3.6, -3.4, 0);
  put('medCabinet', -5.6, 0.4, Math.PI / 2);
  put('plant', 5.6, -4.2, 0.4);
  const ceiling = mesh(new THREE.PlaneGeometry(w, d + 14), paint(0xf1efe6, { roughness: 0.95 }), 0, h, 7); ceiling.rotation.x = Math.PI / 2; ceiling.castShadow = false; room.add(ceiling);
  // the door the patients come in by, in the right-hand wall
  const frame = paint(0xe8e8e0, { roughness: 0.5 }), dark = new THREE.MeshBasicMaterial({ color: 0x1a2422 });
  const doorway = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 4.4), dark); doorway.position.set(w / 2 - 0.02, 2.2, 1.2); doorway.rotation.y = -Math.PI / 2; room.add(doorway);
  for (const [dz, dy, sz, sy] of [[-1.1, 2.2, 0.16, 4.5], [1.1, 2.2, 0.16, 4.5], [0, 4.45, 2.36, 0.16]]) room.add(mesh(new THREE.BoxGeometry(0.14, sy, sz), frame, w / 2 - 0.06, dy, 1.2 + dz));
  const hinge = new THREE.Group(); hinge.position.set(w / 2 - 0.06, 0, 0.15); room.add(hinge);
  hinge.add(mesh(new THREE.BoxGeometry(0.08, 4.35, 2.1), paint(0xc9b08a, { roughness: 0.55 }), 0, 2.18, 1.05));
  hinge.add(mesh(new THREE.SphereGeometry(0.09, 10, 8), paint(0xd8c070, { roughness: 0.3, metalness: 0.8 }), -0.1, 2.05, 1.9));
  room.userData.door = hinge;
  // soft fluorescent light
  const lamp = new THREE.PointLight(0xf4fbff, 18, 14, 1.4); lamp.position.set(0, 5.6, 0); room.add(lamp);
  return room;
}

// a speech bubble with the complaint, drawn to a sprite over the patient's head
function makeBubble() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256;
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(2.6, 1.3, 1); s.renderOrder = 10;
  s.userData.draw = (icon, text, left) => {
    const g = cv.getContext('2d'); g.clearRect(0, 0, 512, 256);
    g.fillStyle = 'rgba(255,255,255,.96)'; g.beginPath(); g.roundRect(16, 16, 480, 176, 40); g.fill();
    g.beginPath(); g.moveTo(230, 188); g.lineTo(256, 236); g.lineTo(282, 188); g.fill();
    g.font = '96px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(icon, 100, 104);
    g.fillStyle = '#1f2a33'; g.font = 'bold 46px "Secular One", sans-serif'; g.direction = 'rtl'; g.fillText(text, 320, 92);
    // patience bar
    g.fillStyle = '#e4e4e4'; g.fillRect(170, 140, 300, 16);
    g.fillStyle = left > 0.5 ? '#5bb36a' : left > 0.25 ? '#f0a23a' : '#e05a4f'; g.fillRect(170, 140, 300 * Math.max(0, left), 16);
    tex.needsUpdate = true;
  };
  return s;
}

export class Level5 {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x26302e);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    this.t = 0;
    this.paused = false;
    this.aspect = 1;
    this.phase = 'ready';
    this.music = false;

    this.look = { exposure: 0.84, bloom: [0.16, 0.55, 1.35] };
    this.envTarget = skyEnvironment({ top: '#f4f6f0', mid: '#e0ece6', horizon: '#ffffff', sunDir: [0.3, 0.9, 0.2], sunColor: '#ffffff' }, 0xb9bdb4);
    this.scene.environment = this.envTarget.texture;
    this.own = [];
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7a8a84, 0.7));
    const sun = new THREE.DirectionalLight(0xfff4e4, 1.8); sun.position.set(4, 10, 7);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 4; sun.shadow.normalBias = 0.02;
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
    this.scene.add(sun);
    const clinic = buildClinic(this.own); this.scene.add(clinic);
    this.door = clinic.userData.door;

    this.doctor = makeFigure('doctor', 3.6);
    if (this.doctor) {
      this.doctor.position.copy(DOC_HOME); this.doctor.rotation.y = 0.9; this.scene.add(this.doctor);
      // his hand goes out to the patient with the tool he chose
      this.doctor.userData.after = () => {
        if (this.reachW > 0.01 && this.patient?.who) {
          this.patient.who.getWorldPosition(REACH); REACH.y += this.patient.who.userData.chest; REACH.x -= 0.25;
          this.doctor.userData.reach('Right', REACH, this.reachW);
        }
      };
    }
    this.toolSprite = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false })); this.toolSprite.scale.setScalar(0.75); this.toolSprite.visible = false; this.toolSprite.renderOrder = 9; this.scene.add(this.toolSprite);
    this.toolTex = TOOLS.map(t => { const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d'); g.font = '76px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t.icon, 48, 54); const x = new THREE.CanvasTexture(c); x.colorSpace = THREE.SRGBColorSpace; return x; });
    this.visitors = VISITORS.map(([k, h]) => { const f = makeFigure(k, h); if (f) { f.visible = false; f.userData.chest = h * 0.68; this.scene.add(f); } return f; }).filter(Boolean);
    this.bubble = makeBubble(); this.bubble.visible = false; this.scene.add(this.bubble);

    this.buildOverlay();
    this.startRun();
  }

  buildOverlay() {
    if (!document.getElementById('clinic-style')) {
      const st = document.createElement('style'); st.id = 'clinic-style';
      st.textContent = `
        #clinic{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom));width:min(96vw,640px);z-index:5;
          display:grid;grid-template-columns:repeat(4,1fr);gap:8px;direction:rtl;font-family:"Secular One",sans-serif}
        #clinic button{border:0;border-radius:16px;color:#fff;padding:10px 4px 8px;box-shadow:0 5px 0 rgba(0,0,0,.25);touch-action:manipulation;cursor:pointer;
          display:flex;flex-direction:column;align-items:center;gap:2px;font:inherit;font-size:clamp(13px,3.6vw,17px);transition:transform .08s}
        #clinic button b{font-size:clamp(30px,9vw,42px);line-height:1.1;font-weight:normal}
        #clinic button:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.25)}
        #clinic-pop{position:fixed;left:50%;top:30%;transform:translate(-50%,-50%);z-index:5;font:44px "Secular One",sans-serif;color:#fff;
          text-shadow:0 3px 12px rgba(0,0,0,.5);opacity:0;transition:opacity .2s;pointer-events:none;white-space:nowrap;text-align:center}`;
      document.head.appendChild(st);
    }
    const el = this.el = document.createElement('div'); el.id = 'clinic';
    el.innerHTML = TOOLS.map(t => `<button style="background:${t.col}"><b>${t.icon}</b>${t.he}</button>`).join('');
    document.body.appendChild(el);
    [...el.children].forEach((b, i) => b.addEventListener('click', () => { sound.unlock(); this.treat(i); }));
    const pop = this.pop = document.createElement('div'); pop.id = 'clinic-pop'; pop.dir = 'rtl'; document.body.appendChild(pop);
  }
  layoutOverlay() {}
  onKey(code) {
    const i = ['Digit1', 'Digit2', 'Digit3', 'Digit4'].indexOf(code);
    if (i < 0 || this.phase !== 'run') return false;
    this.treat(i); return true;
  }
  move() {}
  jump() {}

  startRun() {
    this.phase = 'run';
    this.ending = false;
    this.tl = new Timeline();
    this.served = 0; this.cured = 0; this.points = 0;
    this.patient = null; this.waitT = 1.2;
    this.reachW = 0; this.treating = 0;
    this.order = [];
    for (let i = 0; i < PATIENTS; i++) this.order.push({ who: this.visitors.length ? this.visitors[i % this.visitors.length] : null, c: COMPLAINTS[(i * 5 + 3) % COMPLAINTS.length] });
    for (const v of this.visitors) v.visible = false;
    this.app.hud({ stamps: 0, progress: 0 });
  }

  // the next patient walks in from the door on the right
  admit() {
    const p = this.order[this.served];
    const fig = p.who;
    this.patient = { ...p, stage: 'in', t: 0, patience: PATIENCE - this.served * 0.25, left: 1 };
    if (fig) { fig.visible = true; fig.position.set(DOOR_X, 0, SPOT_Z); fig.rotation.y = -Math.PI / 2; }
    this.bubble.visible = false;
  }

  treat(i) {
    const P = this.patient;
    if (this.paused || this.phase !== 'run' || !P || P.stage !== 'wait') return;
    if (i === P.c.tool) {
      this.cured++;
      const pts = 100 + Math.round(100 * P.left);
      this.points += pts;
      sound.tone(880, 0.12, 'sine', 0.12); setTimeout(() => sound.tone(1320, 0.2, 'sine', 0.1), 110);
      this.showPop(P.left > 0.6 ? 'ריפוי מהיר!' : 'מרגיש טוב יותר!', pts);
      this.app.hud({ stamps: this.cured });
      // the doctor steps over with the tool; the patient thanks him, then goes
      this.treating = 0.95; this.toolSprite.material.map = this.toolTex[i]; this.toolSprite.material.needsUpdate = true;
      P.stage = 'thanks'; P.t = 0; P.happy = true;
      this.bubble.visible = false;
      this.served++;
      this.doctorMood = 1.8;
      this.app.hud({ progress: this.served / PATIENTS });
    } else {
      sound.tone(150, 0.2, 'square', 0.08);
      this.showPop('לא זה…');
      P.left = Math.max(0, P.left - 0.25);
    }
  }

  leave(happy) {
    const P = this.patient;
    P.stage = 'out'; P.t = 0; P.happy = happy;
    this.bubble.visible = false;
    this.doctorMood = happy ? 1.6 : 0;
    this.served++;
    this.app.hud({ progress: this.served / PATIENTS });
  }

  showPop(s, pts) {
    this.pop.innerHTML = s + (pts ? `<div dir="ltr" style="font-size:.6em">+${pts}</div>` : '');
    this.pop.style.opacity = 1;
    clearTimeout(this._pop); this._pop = setTimeout(() => { this.pop.style.opacity = 0; }, 800);
  }

  finish() {
    this.phase = 'done'; this.ending = true;
    this.el.style.visibility = 'hidden';
    sound.fanfare();
    this.app.hud({ progress: 1 });
    this.tl.add(2.6, 0.01, null, () => this.app.levelComplete(this.result()));
  }

  result() {
    const stars = this.cured >= 11 ? 3 : this.cured >= 8 ? 2 : 1;
    return { stars, summary: `ריפאת ${this.cured} מתוך ${PATIENTS} מטופלים.` };
  }

  resize(aspect) {
    this.aspect = aspect;
    const c = this.camera;
    c.aspect = aspect;
    c.fov = aspect < 1 ? 64 : 40;
    c.position.set(...(aspect < 1 ? [2.4, 4.6, 8.2] : [5.6, 4.8, 11.5]));
    c.lookAt(aspect < 1 ? 0.9 : 0.6, aspect < 1 ? 1.5 : 1.9, -1.2);
    const H = 1000, Wd = H * aspect;
    c.setViewOffset(Wd, H, 0, H * (aspect < 1 ? 0.05 : 0.1), Wd, H);
    c.updateProjectionMatrix();
  }

  update(dt) {
    if (this.paused) return;
    this.t += dt;
    this.tl.update(dt);
    const P = this.patient;
    if (this.phase === 'run') {
      if (!P) { this.waitT -= dt; if (this.waitT <= 0) { if (this.served >= PATIENTS) this.finish(); else this.admit(); } }
      else {
        P.t += dt;
        const f = P.who;
        if (P.stage === 'in') {
          // through the door and over to the spot in front of the doctor
          const k = Math.min(1, P.t / 1.75);
          if (f) { f.position.x = DOOR_X + (SPOT_X - DOOR_X) * k; f.userData.animate(this.t, 'walk'); }
          if (k >= 1) { P.stage = 'wait'; P.t = 0; this.bubble.visible = true; }
        } else if (P.stage === 'wait') {
          P.left = Math.max(0, P.left - dt / P.patience);
          // they turn from the way they walked to half toward the doctor, half toward us
          if (f) { f.rotation.y = near(f.rotation.y, -0.95, dt * 7); f.userData.animate(this.t, 'idle'); }
          this.bubble.position.set(SPOT_X, (f ? 4.6 : 3.6), SPOT_Z);
          this.bubble.userData.draw(P.c.icon, P.c.he, P.left);
          if (P.left <= 0) { this.showPop('המטופל התעייף…'); this.leave(false); }
        } else if (P.stage === 'thanks') {
          // a wave for the ones who can (Mom and Dad), a cheer for the teacher
          if (f) { f.rotation.y = near(f.rotation.y, -0.75, dt * 7); f.userData.animate(this.t, P.t > 0.5 ? (P.who === this.visitors[2] ? 'cheer' : 'wave') : 'idle'); }
          if (P.t >= 1.5) { P.stage = 'out'; P.t = 0; }
        } else if (P.stage === 'out') {
          // turn round first, then walk back out through the door
          if (f) f.rotation.y = near(f.rotation.y, Math.PI / 2, dt * 8);
          const k = Math.min(1, Math.max(0, P.t - 0.25) / 1.6);
          if (f) { f.position.x = SPOT_X + (DOOR_X - SPOT_X) * k; f.userData.animate(this.t, 'walk'); }
          if (k >= 1) { if (f) f.visible = false; this.patient = null; this.waitT = 0.35; }
        }
      }
    }
    // the door opens for whoever is near it
    const who = this.patient?.who, atDoor = who && who.visible && who.position.x > 3.8;
    if (this.door) this.door.rotation.y += ((atDoor ? 1.5 : 0) - this.door.rotation.y) * Math.min(1, dt * 6);
    // the doctor faces his patient, and steps over to treat them
    this.treating = Math.max(0, this.treating - dt);
    const going = this.treating > 0;
    this.reachW += ((going && this.treating < 0.8 ? 1 : 0) - this.reachW) * Math.min(1, dt * 9);
    if (this.doctor) {
      const D = this.doctor, to = going ? DOC_NEAR : DOC_HOME, was = D.position.clone();
      D.position.lerp(to, Math.min(1, dt * 5));
      this.docMoving = was.distanceTo(D.position) / Math.max(dt, 0.001) > 0.7;
      const face = this.patient?.who && this.patient.stage !== 'out' ? Math.atan2(this.patient.who.position.x - D.position.x, this.patient.who.position.z - D.position.z) : 0.9;
      D.rotation.y = near(D.rotation.y, face, dt * 6);
      this.toolSprite.visible = this.reachW > 0.5;
      if (this.toolSprite.visible) { D.userData.bone('RightHand').getWorldPosition(this.toolSprite.position); this.toolSprite.position.y += 0.25; }
    }
    this.doctorMood = Math.max(0, (this.doctorMood || 0) - dt);
    if (this.doctor) this.doctor.userData.animate(this.t, this.phase === 'done' ? 'victory' : this.docMoving ? 'walk' : this.treating > 0 ? 'idle' : this.doctorMood > 0 ? 'agree' : P && P.stage === 'wait' ? 'talk' : 'idle');
  }

  dispose() {
    clearTimeout(this._pop);
    this.toolTex.forEach(t => t.dispose());
    this.envTarget.dispose(); this.own.forEach(o => o.dispose());
    this.el.remove(); this.pop.remove();
    this.scene.traverse(o => { if (o.geometry && !o.userData.keep) o.geometry.dispose(); });
  }
}
