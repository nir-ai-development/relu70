import { THREE, paint, mesh, photoTex, Timeline, sound } from './engine.js';
import { skyEnvironment, plasterSet, roomShade, dustMotes } from './gfx.js';
import { makeFigure } from './character.js';
import { model } from './models.js';

// Level 3 · Leyada school, Jerusalem, 1969
// Relu, the top of his class, in a pop quiz. A question appears on the chalkboard with three answers;
// tap the right one before the chalk timer runs out. Faster answers score more. Nobody fails a quiz.

const ROUNDS = 10;
const TIME = 12;            // seconds per question
// [question, right answer, two wrong ones]; the two about Saba are always asked, the rest are drawn at random
const ABOUT_RELU = [
  ['מאיזו מדינה רלו עלה לישראל?', 'רומניה', 'פולין', 'מרוקו'],
  ['על איזה כלי נגינה רלו ניגן כשהיה ילד?', 'פסנתר', 'כינור', 'חליל'],
];
const POOL = [
  ['7 × 8 = ?', '56', '54', '63'],
  ['12 + 19 = ?', '31', '29', '33'],
  ['100 − 37 = ?', '63', '73', '67'],
  ['9 × 6 = ?', '54', '56', '45'],
  ['81 ÷ 9 = ?', '9', '8', '7'],
  ['חצי מ-50 זה…', '25', '20', '15'],
  ['כמה רגליים יש לעכביש?', '8', '6', '10'],
  ['באיזו טמפרטורה מים רותחים?', '100 מעלות', '50 מעלות', '200 מעלות'],
  ['איזה מהם הוא יונק?', 'לווייתן', 'כריש', 'תמנון'],
  ['איזה כוכב לכת הכי קרוב לשמש?', 'כוכב חמה', 'מאדים', 'צדק'],
  ['מה בירת ישראל?', 'ירושלים', 'תל אביב', 'חיפה'],
  ['מה המקום הנמוך ביותר בעולם?', 'ים המלח', 'הכנרת', 'ים סוף'],
  ['כמה יבשות יש בעולם?', '7', '5', '9'],
  ['כמה אותיות יש באלף-בית העברי?', '22', '24', '26'],
  ['מה ההפך של "גבוה"?', 'נמוך', 'רחב', 'קטן'],
  ['איך אומרים "תודה" באנגלית?', 'Thank you', 'Please', 'Sorry'],
  ['באיזו שנה קמה מדינת ישראל?', '1948', '1958', '1967'],
  ['כמה דקות יש בשעה?', '60', '100', '30'],
  ['כמה צבעים יש בקשת בענן?', '7', '5', '9'],
  ['מה גדל על עץ זית?', 'זיתים', 'תפוזים', 'שקדים'],
  ['כמה צלעות יש למשולש?', '3', '4', '5'],
  ['מה שותים הדבורים כדי להכין דבש?', 'צוף', 'מים', 'חלב'],
];

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// the classroom: cream plaster over mint-green paint, wooden floor, tall windows onto Jerusalem
function buildClassroom(own) {
  const room = new THREE.Group();
  const w = 13, d = 11, h = 6.4;
  const floorTex = photoTex('assets/tex_floor.jpg'); floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping; floorTex.repeat.set(w / 3, d / 3);
  const floor = mesh(new THREE.PlaneGeometry(w, d), paint(0xd9c0a0, { map: floorTex, roughness: 0.48 }));
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false; room.add(floor);
  const plasterTex = plasterSet({ rgb: [240, 230, 208], repeat: [3, 2], seed: 5 }), mintTex = plasterSet({ rgb: [162, 196, 158], vary: 12, repeat: [4, 1], seed: 6 });
  own.push(plasterTex, mintTex);
  const plaster = paint(0xffffff, { map: plasterTex.map, normalMap: plasterTex.normalMap, roughness: 0.95 }), mint = paint(0xffffff, { map: mintTex.map, normalMap: mintTex.normalMap, roughness: 0.5 });
  const wall = (len, x, z, ry, windows) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; room.add(g);
    const p = mesh(new THREE.PlaneGeometry(len, h), plaster, 0, h / 2, 0); p.castShadow = false; g.add(p);
    const low = mesh(new THREE.PlaneGeometry(len, 1.9), mint, 0, 0.95, 0.01); low.castShadow = false; g.add(low);
    g.add(mesh(new THREE.BoxGeometry(len, 0.08, 0.06), paint(0x6f8f6a), 0, 1.9, 0.03));
    if (windows) {
      // three tall steel-framed windows, the Jerusalem afternoon behind them
      const view = photoTex('assets/jerusalem_view.jpg');
      for (let i = -1; i <= 1; i++) {
        const fx = i * 3.6;
        const glass = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6), new THREE.MeshBasicMaterial({ map: view, toneMapped: false }));
        glass.position.set(fx, 3.7, 0.02); g.add(glass);
        const frame = paint(0x5c6b74, { roughness: 0.6 });
        for (const [fw, fh, ox, oy] of [[2.6, 0.12, 0, 1.85], [2.6, 0.12, 0, -1.85], [0.12, 3.8, -1.25, 0], [0.12, 3.8, 1.25, 0], [0.06, 3.6, 0, 0], [2.4, 0.06, 0, 0.6]])
          g.add(mesh(new THREE.BoxGeometry(fw, fh, 0.1), frame, fx + ox, 3.7 + oy, 0.06));
        g.add(mesh(new THREE.BoxGeometry(2.8, 0.12, 0.4), paint(0xe6dcc6), fx, 1.85, 0.2));   // deep sill
      }
    }
  };
  wall(w, 0, -d / 2, 0);
  wall(d, -w / 2, 0, Math.PI / 2, true);
  wall(d, w / 2, 0, -Math.PI / 2);
  wall(w, 0, d / 2, Math.PI);
  // a corkboard of pinned work at the back of the class
  const cork = new THREE.Group(); cork.position.set(1.5, 3.4, d / 2 - 0.06); cork.rotation.y = Math.PI; room.add(cork);
  cork.add(mesh(new THREE.BoxGeometry(4.4, 2.2, 0.08), paint(0xb88a5a, { roughness: 1 })));
  const pins = [0xfff6d8, 0xd8ecff, 0xffe0e0, 0xe6ffd8, 0xfff6d8, 0xeee6ff];
  pins.forEach((c, i) => { const p = mesh(new THREE.PlaneGeometry(0.85, 0.7), paint(c), -1.55 + (i % 3) * 1.55, i < 3 ? 0.5 : -0.45, 0.05); p.rotation.z = (i % 2 ? 1 : -1) * 0.06; cork.add(p); });

  // the chalkboard on the front wall, behind the teacher
  const board = new THREE.Group(); board.position.set(0, 0, -d / 2 + 0.05); room.add(board);
  board.add(mesh(new THREE.BoxGeometry(7.2, 2.9, 0.1), paint(0x6b4a2e, { roughness: 0.7 }), 0, 3.6, 0));
  const bc = document.createElement('canvas'); bc.width = 1024; bc.height = 400;
  const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace;
  board.add(mesh(new THREE.PlaneGeometry(6.9, 2.6), paint(0xffffff, { map: bt, roughness: 0.95 }), 0, 3.6, 0.06));
  board.add(mesh(new THREE.BoxGeometry(7.2, 0.1, 0.25), paint(0x6b4a2e), 0, 2.2, 0.12));   // chalk ledge
  room.userData.writeBoard = (text, tick) => {
    const g = bc.getContext('2d');
    g.fillStyle = '#2f4a3a'; g.fillRect(0, 0, 1024, 400);
    g.globalAlpha = 0.08; g.fillStyle = '#fff'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 1024, Math.random() * 400, 120, 3); g.globalAlpha = 1;
    g.fillStyle = '#f4f1e6'; g.font = 'bold 64px "Secular One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = /[֐-׿]/.test(text) ? 'rtl' : 'ltr';
    g.fillText(text, 512, 170);
    if (tick) { g.fillStyle = '#9fe08a'; g.font = 'bold 90px sans-serif'; g.fillText('✓', 880, 320); }
    g.font = '36px "Secular One", sans-serif'; g.fillStyle = 'rgba(244,241,230,.6)'; g.fillText('ירושלים, 1969', 160, 350);
    bt.needsUpdate = true;
  };
  room.userData.writeBoard('בוחן פתע!');

  const put = (name, x, z, ry) => { const m = model(name); if (m) { m.position.set(x, 0, z); m.rotation.y = ry; room.add(m); } return m; };
  put('bookshelf', w / 2 - 0.5, 1.5, -Math.PI / 2);
  put('plant', w / 2 - 0.9, -d / 2 + 0.9, 0.6);

  // afternoon sun through the windows
  const beam = new THREE.SpotLight(0xffcf94, 120, 20, 0.72, 0.8, 1.4);
  beam.position.set(-w / 2 + 0.5, 5.4, 0); beam.target.position.set(1, 0, 0.5);
  beam.castShadow = true; beam.shadow.mapSize.set(1024, 1024); beam.shadow.normalBias = 0.03;
  room.add(beam, beam.target);
  return room;
}

// desks in rows facing the board; [x, z] of each desk, Relu's is the first
const DESKS = [[0.9, -0.4], [-2.4, -0.4], [0.9, 2.6], [-2.4, 2.6], [4.2, -0.4], [4.2, 2.6]];

export class Level3 {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a2620);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    this.t = 0;
    this.paused = false;
    this.aspect = 1;
    this.phase = 'ready';
    this.music = false;

    this.look = { exposure: 0.95, bloom: [0.24, 0.7, 1.3], grade: { contrast: 1.15, saturation: 1.06, vignette: 0.46 } };
    this.envTarget = skyEnvironment({ top: '#5a5040', mid: '#766a52', horizon: '#c0ac84', sunDir: [-1, 0.3, 0], sunColor: '#fff2d0' }, 0x3f2e1e);
    this.scene.environment = this.envTarget.texture;
    this.own = [];
    this.scene.add(new THREE.HemisphereLight(0xfff4e2, 0x4f4636, 0.68));
    const sun = new THREE.DirectionalLight(0xffdcb0, 1.1); sun.position.set(-8, 10, 6);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 4; sun.shadow.normalBias = 0.02;
    Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
    this.scene.add(sun);
    const room = this.room = buildClassroom(this.own);
    this.scene.add(room);
    this.extras = [roomShade(-6.5, 6.5, -5.5, 5.5, 6.4, 'nsew', 1.9, 0.68)];
    this.scene.add(...this.extras);
    this.dust = dustMotes(this.scene, [-5.5, 2, 1, 5, -4, 4], 80);

    for (const [x, z] of DESKS) {
      const desk = model('schoolDesk');
      if (desk) { desk.position.set(x, 0, z); this.scene.add(desk); }   // writing top toward the board, bench behind it
    }
    // Relu at the front desk on the right, his classmate beside him, a second classmate behind
    const seat = (who, h, x, z) => { const f = makeFigure(who, h); if (f) { f.position.set(x, 0, z); f.rotation.y = Math.PI; this.scene.add(f); } return f; };
    // (each desk seats two on its bench, 0.62 behind the desk's centre)
    this.relu = seat('teen', 3.1, DESKS[0][0] + 0.6, DESKS[0][1] + 0.62);
    this.girl = seat('classmate', 3.0, DESKS[0][0] - 0.6, DESKS[0][1] + 0.62);   // they share a desk, like in his photo
    this.girl2 = seat('classmate', 2.9, DESKS[3][0] - 0.6, DESKS[3][1] + 0.62);
    if (this.girl2) this.girl2.userData.offset = 1.7;   // so the two don't move in step
    this.teacher = makeFigure('mathTeacher', 3.5);
    if (this.teacher) { this.teacher.position.set(-3.6, 0, -4.1); this.teacher.rotation.y = 0.5; this.scene.add(this.teacher); }

    this.buildOverlay();
    this.startRun();
  }

  // ------------------------------------------------ chalkboard card and answer buttons (HTML over the 3D view)
  buildOverlay() {
    if (!document.getElementById('quiz-style')) {
      const st = document.createElement('style'); st.id = 'quiz-style';
      st.textContent = `
        #quiz{position:fixed;inset:0;z-index:5;pointer-events:none;font-family:"Secular One",sans-serif;direction:rtl}
        #quiz .q{position:absolute;left:50%;transform:translateX(-50%);top:calc(70px + env(safe-area-inset-top));width:min(92vw,560px);
          background:#2f4a3a;border:8px solid #6b4a2e;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.35);color:#f4f1e6;
          text-align:center;padding:14px 16px 18px;font-size:clamp(22px,6vw,32px);line-height:1.25}
        #quiz .q small{display:block;font-size:14px;opacity:.65;margin-bottom:4px;font-family:"Varela Round",sans-serif}
        #quiz .timer{position:absolute;left:12px;right:12px;bottom:7px;height:5px;border-radius:3px;background:rgba(255,255,255,.18);overflow:hidden}
        #quiz .timer i{display:block;height:100%;background:#f4f1e6;width:100%;transform-origin:right}
        #quiz .a{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom));width:min(94vw,620px);
          display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;pointer-events:auto}
        #quiz .a button{font:inherit;font-size:clamp(18px,5vw,26px);padding:18px 6px;border:0;border-radius:16px;color:#fff;
          box-shadow:0 5px 0 rgba(0,0,0,.25);touch-action:manipulation;cursor:pointer;transition:transform .08s}
        #quiz .a button:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(0,0,0,.25)}
        #quiz .a button:nth-child(1){background:#e05a4f}#quiz .a button:nth-child(2){background:#4f8fd6}#quiz .a button:nth-child(3){background:#5bb36a}
        #quiz .a button.right{background:#f4c542!important;color:#3a2a00}
        #quiz .a button.wrong{opacity:.35}
        #quiz .pop{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);font-size:44px;color:#fff;text-shadow:0 3px 12px rgba(0,0,0,.5);
          opacity:0;transition:opacity .2s;white-space:nowrap;text-align:center}
        @media (max-width:640px){#quiz .q{top:calc(104px + env(safe-area-inset-top))}}
        @media (orientation:landscape) and (max-height:500px){#quiz .q{top:56px;padding:8px 12px 14px}#quiz .a button{padding:12px 6px}}`;
      document.head.appendChild(st);
    }
    const el = this.el = document.createElement('div');
    el.id = 'quiz';
    el.innerHTML = '<div class="q"><small></small><span></span><div class="timer"><i></i></div></div><div class="a"><button></button><button></button><button></button></div><div class="pop"></div>';
    document.body.appendChild(el);
    this.btns = [...el.querySelectorAll('.a button')];
    this.btns.forEach((b, i) => b.addEventListener('click', () => { sound.unlock(); this.answer(i); }));
  }
  layoutOverlay() {}

  onKey(code) {
    const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(code);
    if (i < 0 || this.phase !== 'run') return false;
    this.answer(i);
    return true;
  }
  move() {}
  jump() {}

  // ------------------------------------------------ the quiz
  startRun() {
    this.phase = 'run';
    this.ending = false;
    this.tl = null;
    const rest = shuffle(POOL.slice()).slice(0, ROUNDS - ABOUT_RELU.length);
    // the questions about Saba come in the middle and at the end
    this.questions = [...rest.slice(0, 4), ABOUT_RELU[0], ...rest.slice(4), ABOUT_RELU[1]];
    this.qi = -1;
    this.right = 0; this.points = 0;
    this.cheer = 0;
    this.app.hud({ stamps: 0, progress: 0 });
    this.next();
  }

  next() {
    this.qi++;
    if (this.qi >= this.questions.length) return this.finish();
    const [q, good, ...bad] = this.questions[this.qi];
    this.options = shuffle([good, ...bad]);
    this.correct = this.options.indexOf(good);
    this.left = TIME;
    this.locked = false;
    this.el.querySelector('.q small').textContent = `שאלה ${this.qi + 1} מתוך ${this.questions.length}`;
    const qs = this.el.querySelector('.q span');
    qs.textContent = q;
    qs.dir = /[֐-׿]/.test(q) ? 'rtl' : 'ltr';   // "100 − 37 = ?" must read left to right
    this.btns.forEach((b, i) => { b.textContent = this.options[i]; b.className = ''; b.disabled = false; });
    this.room.userData.writeBoard(q);
    this.app.hud({ progress: this.qi / this.questions.length });
  }

  answer(i) {
    if (this.paused || this.phase !== 'run' || this.locked) return;
    this.locked = true;
    const ok = i === this.correct;
    this.btns.forEach((b, k) => { b.disabled = true; if (k === this.correct) b.classList.add('right'); else if (k === i || !ok) b.classList.add('wrong'); });
    if (ok) {
      this.right++;
      const pts = 100 + Math.round(50 * Math.max(0, this.left) / TIME);
      this.points += pts;
      this.cheer = 2.2;   // Relu's hand goes up
      sound.tone(880, 0.12, 'sine', 0.12); setTimeout(() => sound.tone(1320, 0.18, 'sine', 0.1), 110);
      this.popText(this.left > TIME * 0.6 ? 'מהיר ונכון!' : 'נכון!', pts);
      this.app.hud({ stamps: this.right });
      this.room.userData.writeBoard(this.questions[this.qi][0] + '  ' + this.questions[this.qi][1], true);
    } else {
      sound.tone(150, 0.25, 'square', 0.08);
      this.popText(i < 0 ? 'נגמר הזמן' : 'לא נורא!');
    }
    this.tl = new Timeline();
    this.tl.add(ok ? 1.2 : 1.8, 0.01, null, () => { this.tl = null; this.next(); });
  }

  popText(s, pts) {
    const p = this.el.querySelector('.pop');
    p.innerHTML = s + (pts ? `<div dir="ltr" style="font-size:.6em;text-align:center">+${pts}</div>` : ''); p.style.opacity = 1;
    clearTimeout(this._pop); this._pop = setTimeout(() => { p.style.opacity = 0; }, 900);
  }

  finish() {
    this.phase = 'done';
    this.ending = true;
    this.el.querySelector('.a').style.visibility = 'hidden';
    this.el.querySelector('.q span').textContent = this.right >= 8 ? 'מצוין! 💯' : this.right >= 5 ? 'כל הכבוד!' : 'יפה מאוד!';
    this.el.querySelector('.q small').textContent = 'סוף הבוחן';
    this.room.userData.writeBoard(`ציון: ${this.right * 10}`, this.right >= 8);
    this.app.hud({ progress: 1 });
    sound.fanfare();
    this.tl = new Timeline();
    this.tl.add(3, 0.01, null, () => this.app.levelComplete(this.result()));
  }

  result() {
    const stars = this.right >= 9 ? 3 : this.right >= 6 ? 2 : 1;
    return { stars, summary: `ענית נכון על ${this.right} מתוך ${this.questions.length} שאלות (${this.points} נקודות).` };
  }

  // ------------------------------------------------ loop plumbing
  resize(aspect) {
    this.aspect = aspect;
    const c = this.camera;
    c.aspect = aspect;
    c.fov = aspect < 1 ? 64 : 46;
    // from the front corner by the board, looking at the class: Relu's face, the windows, the teacher
    // (on a phone, high over the empty desk in front of Relu, so it doesn't fill the lower half)
    c.position.set(...(aspect < 1 ? [3.4, 4.7, -3.1] : [3.9, 3.0, -3.4]));
    c.lookAt(aspect < 1 ? 0.8 : -0.3, aspect < 1 ? 0.9 : 1.6, aspect < 1 ? 1.5 : 1.2);
    const H = 1000, Wd = H * aspect;
    // the chalkboard card covers the top and the buttons the bottom; keep the class between them
    c.setViewOffset(Wd, H, 0, H * (aspect < 1 ? 0.04 : 0.02), Wd, H);
    c.updateProjectionMatrix();
  }

  update(dt) {
    if (this.paused) return;
    this.t += dt;
    this.dust.update(this.t);
    if (this.tl) this.tl.update(dt);
    if (this.phase === 'run' && !this.locked) {
      this.left -= dt;
      this.el.querySelector('.timer i').style.transform = `scaleX(${Math.max(0, this.left / TIME)})`;
      if (this.left <= 0) this.answer(-1);
    }
    this.cheer = Math.max(0, this.cheer - dt);
    const done = this.phase === 'done';
    // (clip names are matched by substring, so these are specific: "sit" alone would also match "sit_cheer")
    if (this.relu) this.relu.userData.animate(this.t, done || this.cheer > 0 ? 'sit_cheer' : 'sit_idle_f');   // the upright sitting idle; the male one hunches over (and "answering" lifts him out of the seat)
    for (const g of [this.girl, this.girl2]) if (g) g.userData.animate(this.t + (g.userData.offset || 0), done ? 'sitting_clap' : 'chair_sit');
    if (this.teacher) this.teacher.userData.animate(this.t, done ? 'victory' : this.cheer > 0 ? 'agree' : 'talk');
  }

  dispose() {
    clearTimeout(this._pop);
    this.envTarget.dispose(); this.own.forEach(o => o.dispose()); this.dust.dispose(); this.extras.forEach(e => e.userData.dispose());
    this.el.remove();
    this.scene.traverse(o => { if (o.geometry && !o.userData.keep) o.geometry.dispose(); });
  }
}
