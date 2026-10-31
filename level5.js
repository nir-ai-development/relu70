import { THREE, paint, mesh, photoTex, Timeline, sound } from './engine.js';
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

function buildClinic() {
  const room = new THREE.Group();
  const w = 13, d = 10, h = 6.2;
  const floor = mesh(new THREE.PlaneGeometry(w, d), paint(0xd8dcd2, { roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false; room.add(floor);
  // terrazzo flecks
  const fleck = new THREE.InstancedMesh(new THREE.CircleGeometry(0.05, 5), paint(0x9aa096), 500);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  for (let i = 0; i < 500; i++) fleck.setMatrixAt(i, m4.compose(new THREE.Vector3((Math.random() - 0.5) * w, 0.005, (Math.random() - 0.5) * d), q, new THREE.Vector3(1, 1, 1).multiplyScalar(0.5 + Math.random())));
  room.add(fleck);
  const upper = paint(0xf3f1e8, { roughness: 0.9 }), lower = paint(0x9cc7bd, { roughness: 0.6 });
  const wall = (len, x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; room.add(g);
    const p = mesh(new THREE.PlaneGeometry(len, h), upper, 0, h / 2, 0); p.castShadow = false; g.add(p);
    const l = mesh(new THREE.PlaneGeometry(len, 2.2), lower, 0, 1.1, 0.01); l.castShadow = false; g.add(l);
    g.add(mesh(new THREE.BoxGeometry(len, 0.08, 0.05), paint(0x6f9a90), 0, 2.2, 0.03));
    return g;
  };
  const back = wall(w, 0, -d / 2, 0);
  wall(d, -w / 2, 0, Math.PI / 2);
  wall(d, w / 2, 0, -Math.PI / 2);
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

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x7a8a84, 1.25));
    const sun = new THREE.DirectionalLight(0xfff4e4, 1.5); sun.position.set(4, 10, 7);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 4; sun.shadow.normalBias = 0.02;
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
    this.scene.add(sun);
    this.scene.add(buildClinic());

    this.doctor = makeFigure('doctor', 3.6);
    if (this.doctor) { this.doctor.position.set(-1.0, 0, -1.4); this.doctor.rotation.y = 0.9; this.scene.add(this.doctor); }
    this.visitors = VISITORS.map(([k, h]) => { const f = makeFigure(k, h); if (f) { f.visible = false; this.scene.add(f); } return f; }).filter(Boolean);
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
    const pop = this.pop = document.createElement('div'); pop.id = 'clinic-pop'; document.body.appendChild(pop);
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
    if (fig) { fig.visible = true; fig.position.set(6.5, 0, 1.2); fig.rotation.y = -Math.PI / 2; }
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
      this.leave(true);
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
          // walk from the door to the spot in front of the doctor
          const k = Math.min(1, P.t / 1.4);
          if (f) { f.position.x = 6.5 - k * 3.6; f.userData.animate(this.t, 'walk'); }
          if (k >= 1) { P.stage = 'wait'; P.t = 0; if (f) f.rotation.y = -1.1; this.bubble.visible = true; }   // half toward the doctor, half toward us
        } else if (P.stage === 'wait') {
          P.left = Math.max(0, P.left - dt / P.patience);
          if (f) f.userData.animate(this.t, 'idle');
          this.bubble.position.set(this.aspect < 1 ? 1.5 : 2.9, (f ? 4.6 : 3.6), 1.2);   // nearer the middle on a narrow phone
          this.bubble.userData.draw(P.c.icon, P.c.he, P.left);
          if (P.left <= 0) { this.showPop('המטופל התעייף…'); this.leave(false); }
        } else if (P.stage === 'out') {
          const k = Math.min(1, P.t / 1.3);
          if (f) { f.rotation.y = Math.PI / 2; f.position.x = 2.9 + k * 3.8; f.userData.animate(this.t, 'walk'); }
          if (k >= 1) { if (f) f.visible = false; this.patient = null; this.waitT = 0.35; }
        }
      }
    }
    this.doctorMood = Math.max(0, (this.doctorMood || 0) - dt);
    if (this.doctor) this.doctor.userData.animate(this.t, this.phase === 'done' ? 'victory' : this.doctorMood > 0 ? 'agree' : P && P.stage === 'wait' ? 'talk' : 'idle');
  }

  dispose() {
    clearTimeout(this._pop);
    this.el.remove(); this.pop.remove();
    this.scene.traverse(o => { if (o.geometry && !o.userData.keep) o.geometry.dispose(); });
  }
}
