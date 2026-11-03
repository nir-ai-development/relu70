import { THREE, mesh, paint, sound, save, studioEnv, makeSky, asset, onLoadProgress } from './engine.js';
import { makeTree, makeHouse, makeLamp, cobbleTex, slabTex } from './props1.js';
import { EffectComposer } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js/+esm';
import { RenderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/RenderPass.js/+esm';
import { UnrealBloomPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js/+esm';
import { OutputPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/OutputPass.js/+esm';
import { ShaderPass } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js/+esm';
import { GradeShader } from './gfx.js';
import { makeBabyRelu, makeSuitcase, loadCharacters, loadFigures } from './character.js';
import { Level1 } from './level1.js';
import { Level2 } from './level2.js';
import { Level3 } from './level3.js';
import { Level4 } from './level4.js';
import { Level5 } from './level5.js';
import { Level6 } from './level6.js';
import { Level7 } from './level7.js';
import { Level8 } from './level8.js';
import { loadModels, model } from './models.js';

const $ = id => document.getElementById(id);
const show = (id, on = true) => { $(id).hidden = !on; };
const SCREENS = ['screen-title', 'screen-map', 'screen-story', 'screen-howto', 'screen-pause', 'screen-fail', 'screen-result'];
const only = id => SCREENS.forEach(s => show(s, s === id));

// ---------- the eight chapters ----------
// `load` lists the sculpted props and rigged people each level needs; they download when it's opened
const LEVELS = [
  { yr: '1958', name: 'בורחים לישראל', img: 'era1_toddler', ready: true, make: app => new Level1(app),
    load: { models: ['suitcase', 'teddy', 'piano', 'armchair', 'goose', 'houseA', 'houseB', 'tree', 'barrel', 'cart', 'lamp', 'bed', 'window',
      'openCase', 'bottle', 'blanket', 'terminal', 'luggageCart'], figures: ['mom', 'dad'] },
    story: {
      date: 'פיאטרה נמץ, רומניה · 7.7.1958',
      title: 'בורחים לישראל',
      body: [
        'רלו הקטן בן שנתיים. ב-7 ביולי 1958 המשפחה מקבלת את המסמך הכי חשוב שלה: תעודת מסע לישראל. רלו רשום בה, עם התמונה שלו.',
        'קודם אורזים את המזוודה, ואז רצים לנמל לפני שהאונייה מפליגה!',
      ],
      photos: ['assets/era1_toddler.jpg', 'assets/cert_1958.jpg'],
    },
    howto: {
      title: 'רצים לנמל!', go: 'רוץ, רלו, רוץ!',
      text: 'האונייה לישראל עומדת להפליג. אספו בולים, תתחמקו ממכשולים, ואל תפספסו אותה.',
      items: [['⇆', 'החלקה ימינה ושמאלה', 'או חיצים במקלדת'], ['⤒', 'החלקה למעלה או נגיעה', 'או רווח · קפיצה'], ['❤', '3 חיים', 'בקבוק חלב מחזיר לב']],
    },
    hud: { labels: ['פיאטרה נמץ', 'לישראל ⚓'], icon: '✉', hearts: true },
    result: { label: 'Israel · July 1958', title: 'רלו בדרך לישראל!', text: 'רלו עלה לאונייה עם אמא ואבא.', mark: ['ISRAEL', '1958'] } },
  { yr: '1966', name: 'הפסנתר בירושלים', img: 'era2_piano', ready: true, make: app => new Level2(app),
    load: { models: ['piano', 'pianoBench', 'archWindow', 'bookshelf', 'sofa', 'plant'], figures: ['kid', 'teacher'] },
    story: {
      date: 'ירושלים · 1966',
      title: 'הפסנתר בירושלים',
      body: [
        'רלו בן עשר וגר בירושלים. כל שבוע מגיעה המורה לפסנתר, והיום הוא מנגן לה את השיר שתרגל כל השבוע: יונתן הקטן.',
        'התווים נופלים אל הקלידים. הקישו על כל קליד בדיוק כשהתו מגיע אליו, ועזרו לרלו לנגן את כל השיר!',
      ],
      photos: ['assets/era2_piano.jpg'],
    },
    howto: {
      title: 'מנגנים לַמורה!', go: 'נגן, רלו!',
      text: 'השיר: יונתן הקטן. כשתו מגיע לקו, הקישו על הקליד שלו.',
      items: [['🎹', 'הקישו על הקליד', 'או המקשים 1–5'], ['✨', 'בדיוק בזמן', 'מושלם או יפה'], ['★', 'יותר תווים', 'יותר כוכבים']],
    },
    hud: { labels: ['תחילת השיר', 'סוף השיר 🎵'], icon: '♪', hearts: false },
    result: { label: 'Jerusalem · 1966', title: 'איזה ביצוע!', text: 'המורה מחאה כפיים.', mark: ['JERUSALEM', '1966'] } },
  { yr: '1969', name: 'תלמיד מצטיין', img: 'era3_school', ready: true, make: app => new Level3(app),
    load: { models: ['schoolDesk', 'bookshelf', 'plant'], figures: ['teen', 'classmate', 'mathTeacher'] },
    story: {
      date: 'תיכון ליד״ה, ירושלים · 1969',
      title: 'תלמיד מצטיין',
      body: [
        'רלו בן 13 ולומד בליד״ה, בית הספר של האוניברסיטה העברית. הוא מהתלמידים הכי טובים בכיתה.',
        'היום המורה למתמטיקה מפתיע את כולם: בוחן פתע! עזרו לרלו לענות נכון ומהר על כל השאלות.',
      ],
      photos: ['assets/era3_school.jpg'],
    },
    howto: {
      title: 'בוחן פתע!', go: 'מתחילים!',
      text: 'שאלה מופיעה על הלוח. בחרו את התשובה הנכונה לפני שהגיר נגמר.',
      items: [['👆', 'הקישו על התשובה', 'או המקשים 1–3'], ['⏱', 'מהר יותר', 'יותר נקודות'], ['✓', 'יותר תשובות נכונות', 'יותר כוכבים']],
    },
    hud: { labels: ['שאלה ראשונה', 'סוף הבוחן 📝'], icon: '✓', hearts: false },
    result: { label: 'Leyada · 1969', title: 'תלמיד מצטיין!', text: 'המורה כתב "מצוין" על הבוחן.', mark: ['LEYADA', '1969'] } },
  { yr: '1976', name: 'הקצין', img: 'era4_soldier', ready: true, make: app => new Level4(app),
    load: { models: ['jeep', 'tree'], figures: ['officer', 'soldier'] },
    story: {
      date: 'בסיס טירונים · 1976',
      title: 'הקצין',
      body: [
        'רלו התגייס לצה״ל, ובזכות הכישרון והלב הגדול שלו הוא נשלח לקורס קצינים.',
        'היום מבחן המסלול: להוביל את החיילים דרך המכשולים, ולהגיע לטקס הסיום ולקבל את הדרגות!',
      ],
      photos: ['assets/era4_soldier.jpg'],
    },
    howto: {
      title: 'מסלול המכשולים!', go: 'קדימה, המפקד!',
      text: 'קופצים מעל קירות וצמיגים, זוחלים מתחת לגדר התיל, ועוקפים שקי חול וג׳יפים.',
      items: [['⇆', 'החלקה ימינה ושמאלה', 'מעבר נתיב'], ['⤒', 'החלקה למעלה', 'קפיצה'], ['⤓', 'החלקה למטה', 'זחילה מתחת לתיל']],
    },
    hud: { labels: ['טירונות', 'טקס סיום 🎖'], icon: '🎖', hearts: true },
    result: { label: 'IDF · 1976', title: 'קצין בצה״ל!', text: 'רלו קיבל את הדרגות.', mark: ['IDF', '1976'] } },
  { yr: 'הדסה', name: 'ד״ר אברהם', img: 'era5_doctor', ready: true, make: app => new Level5(app),
    load: { models: ['examBed', 'medCabinet', 'plant'], figures: ['doctor', 'mom', 'dad', 'teacher'] },
    story: {
      date: 'הדסה, ירושלים · שנות ה-80',
      title: 'ד״ר אברהם',
      body: [
        'רלו למד רפואה באוניברסיטה העברית ובהדסה, והפך לד״ר אברהם.',
        'היום במרפאה יש תור ארוך! בדקו מה כואב לכל מטופל, ובחרו את הטיפול הנכון לפני שנגמרת לו הסבלנות.',
      ],
      photos: ['assets/era5_doctor.jpg'],
    },
    howto: {
      title: 'יום במרפאה!', go: 'הבא בתור!',
      text: 'כל מטופל אומר מה כואב לו. הקישו על הכלי הנכון לפני שהפס מתרוקן.',
      items: [['🌡️', 'חום או צמרמורת', 'מדחום'], ['🩺', 'שיעול או דופק', 'סטטוסקופ'], ['🩹💊', 'פצע או כאב בטן', 'פלסטר או תרופה']],
    },
    hud: { labels: ['פתיחת המרפאה', 'סוף היום 🏥'], icon: '♥', hearts: false },
    result: { label: 'Hadassah · 1985', title: 'רופא מעולה!', text: 'כל המטופלים יצאו מחייכים.', mark: ['HADASSAH', '1985'] } },
  { yr: '1980', name: 'אלין', img: 'era6_aline', ready: true, make: app => new Level6(app),
    load: { models: ['cafeTable'], figures: ['officer', 'aline'] },
    story: {
      date: 'ירושלים · 1980',
      title: 'אלין',
      body: [
        'בשנת 1980 רלו, קצין צעיר, פוגש את אלין עטיה. מהרגע הראשון ברור שזה משהו מיוחד.',
        'מצאו את כל הזוגות של הקלפים מהסיפור שלהם, וכל זוג יקרב את רלו ואלין אחד אל השנייה.',
      ],
      photos: ['assets/era6_aline.jpg'],
    },
    howto: {
      title: 'משחק הזיכרון', go: 'מתחילים!',
      text: 'הפכו שני קלפים בכל פעם. זוג תואם נשאר פתוח, ורלו ואלין מתקרבים.',
      items: [['🃏', 'הקישו על קלף', 'כדי להפוך אותו'], ['❤️', 'מצאו זוג', 'הקלפים נשארים פתוחים'], ['★', 'פחות טעויות', 'יותר כוכבים']],
    },
    hud: { labels: ['הפגישה הראשונה', 'ביחד 💍'], icon: '❤', hearts: false },
    result: { label: 'Jerusalem · 1980', title: 'רלו ואלין!', text: 'ומכאן הכול התחיל.', mark: ['RELU ♥ ALINE', '1980'] } },
  { yr: '1983–1990', name: 'אבא לארבעה', img: 'era7_dad', ready: true, make: app => new Level7(app),
    load: { models: ['lounger', 'tree', 'houseA'], figures: ['father', 'karin', 'idan', 'tal', 'nir'] },
    story: {
      date: 'שנות ה-80',
      title: 'אבא לארבעה',
      body: [
        'רלו ואלין מתחתנים, ונולדים להם ארבעה ילדים: קארין, עידן, טל וניר.',
        'אבא אוהב בריכות! הילדים קופצים למים אחד אחרי השני, ואבא צריך לתפוס את כולם.',
      ],
      photos: ['assets/era7_dad.jpg'],
    },
    howto: {
      title: 'יום בבריכה!', go: 'קופצים!',
      text: 'ילד קופץ, והעיגול על המים מראה איפה הוא ינחת. הזיזו את אבא לשם לפני שהוא נוחת.',
      items: [['⇆', 'החלקה או נגיעה בצד', 'אבא זז ימינה ושמאלה'], ['◎', 'העיגול על המים', 'שם הילד ינחת'], ['★', 'יותר תפיסות', 'יותר כוכבים']],
    },
    hud: { labels: ['קפיצה ראשונה', 'כולם במים 🏊'], icon: '👶', hearts: false },
    result: { label: 'Family · 1989', title: 'אבא הכי טוב!', text: 'קארין, עידן, טל וניר צוחקים במים.', mark: ['FAMILY', '1989'] } },
  { yr: '2026', name: 'סבא רלו', img: 'era8_saba', ready: true, make: app => new Level8(app),
    load: { models: ['cake', 'tree'], figures: ['saba', 'girlKid', 'boyKid'] },
    story: {
      date: 'נובמבר 2026',
      title: 'סבא רלו',
      body: [
        'היום רלו הוא סבא אוהב לנכדים, ומוקף במשפחה גדולה.',
        'ועכשיו הוא חוגג 70! הדליקו את הנרות על העוגה, ועזרו לסבא לכבות את כולם בנשיפה אחת.',
      ],
      photos: ['assets/era8_saba.jpg'],
    },
    howto: {
      title: 'יום הולדת 70!', go: 'למסיבה!',
      text: 'הקישו על המסך כדי להדליק את שבעת הנרות, ואז החזיקו את כפתור הנשיפה עד שכולם כבים.',
      items: [['🕯️', 'הקשה', 'מדליקה נר'], ['🌬️', 'החזיקו את הכפתור', 'כדי לנשוף'], ['🎉', 'כל הנרות כבו', 'מסיבה!']],
    },
    hud: { labels: ['מדליקים', 'מזל טוב! 🎂'], icon: '🕯', hearts: false },
    result: { label: 'Saba Relu · 70', title: 'מזל טוב, סבא!', text: 'עד 120!', mark: ['HAPPY 70', '2026'] } },
];

// ---------- renderer ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.localClippingEnabled = true;   // Level 1's street stops at the quay
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
$('stage').appendChild(renderer.domElement);
// the title screen and the first level are ready before the start button; the rest load as they're opened
// the loading bar (shown from the first paint by index.html, under the title)
const loadingUI = {
  show(text, overLevel) { $('loading-text').textContent = text; $('loading').classList.toggle('level', overLevel); $('loading').hidden = false; },
  hide() { $('loading').hidden = true; },
};
onLoadProgress(p => {
  const bar = $('loading-fill').parentElement;
  bar.classList.toggle('wait', p === 0);
  $('loading-fill').style.width = `${Math.round(p * 100)}%`;
  if ($('btn-start').disabled && p) $('btn-start').textContent = `טוען את העולם… ${Math.round(p * 100)}%`;
});
await Promise.all([loadCharacters(LEVELS[0].load.figures), loadModels(LEVELS[0].load.models)]);
loadingUI.hide();
const loadLevel = i => { const L = LEVELS[i].load || {}; return Promise.all([loadModels(L.models || []), loadFigures(L.figures || [])]); };
// the start button waits (and says so) until every sculpted model has arrived
Object.assign($('btn-start'), { disabled: false, textContent: 'יוצאים לדרך' });
const env = studioEnv(renderer);
// film-like finish: only the brightest lights (lamps, sun glints) get a faint glow, then tone mapping
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.06, 0.5, 0.97);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass(GradeShader);
composer.addPass(grade);
grade.enabled = false;

// A level can ask for the polished look with a `look` field; the others keep the plain finish above.
// Phones that can't hold the frame rate step down, for the rest of the visit:
// 0 full, 1 sharper edges off, 2 lower resolution, 3 also no glow and rougher shadows
const fullRatio = renderer.getPixelRatio();
const quality = { step: 0, t: 0, frames: 0 };
const PLAIN = { exposure: 0.92, bloom: [0.06, 0.5, 0.97] };
let activeLook = null;
function setSamples(n) {
  if (composer.renderTarget1.samples === n) return;
  for (const rt of [composer.renderTarget1, composer.renderTarget2]) { rt.samples = n; rt.dispose(); }
}
function setRatio(r) {
  if (renderer.getPixelRatio() === r) return;
  renderer.setPixelRatio(r); composer.setPixelRatio(r);
}
function applyLook(view) {
  const look = view.look || null;
  const L = look || PLAIN;
  renderer.toneMappingExposure = L.exposure;
  [bloom.strength, bloom.radius, bloom.threshold] = L.bloom;
  bloom.enabled = !(look && quality.step >= 3);
  grade.enabled = !!look;
  setSamples(look && quality.step < 1 ? Math.min(4, renderer.capabilities.maxSamples) : 0);
  setRatio(look && quality.step >= 2 ? Math.min(fullRatio, 1.15) : fullRatio);
  if (look && quality.step >= 3) view.lowerQuality?.();
  activeLook = view;
  quality.t = quality.frames = 0;
}
// average two seconds of frames at a time; a stall (a hidden tab, a level loading) doesn't count
function watchFrameRate(raw) {
  if (quality.locked) return;
  if (raw > 0.25) { quality.t = quality.frames = 0; return; }
  quality.t += raw; quality.frames++;
  if (quality.t < 2) return;
  const fps = quality.frames / quality.t;
  quality.t = quality.frames = 0;
  if (fps < 40 && quality.step < 3) { quality.step++; applyLook(activeLook); }
}
function draw(v) {
  if (activeLook !== v) applyLook(v);
  renderPass.scene = v.scene; renderPass.camera = v.camera;
  composer.render();
}

// ---------- title scene: toddler Relu with his suitcase on a little island ----------
class TitleScene {
  // Relu on his street in Piatra Neamț at sunset, suitcase at his feet
  constructor() {
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0xe8b68e);
    scene.fog = new THREE.Fog(0xe2ad86, 22, 95);
    scene.add(makeSky({ top: '#2c3f72', mid: '#c98c80', horizon: '#ffcf96', sunDir: [-0.5, 0.08, -1], sunColor: '#ffd9a0', radius: 120 }));
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    scene.add(new THREE.HemisphereLight(0xffe2c4, 0x5a4a5e, 1.1));
    const sun = new THREE.DirectionalLight(0xffc98f, 2.4); sun.position.set(-5, 5, -8);   // low sun behind, golden rim
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 4; sun.shadow.normalBias = 0.02;
    Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, far: 30 });
    scene.add(sun, sun.target);
    const front = new THREE.DirectionalLight(0xfff0e0, 0.9); front.position.set(2, 3, 8); scene.add(front);

    // the street: cobbles, pavements, houses, trees and lamps running off into the dusk
    const cob = cobbleTex(); cob.repeat.set(1.6, 18);
    const road = mesh(new THREE.PlaneGeometry(5.4, 80), paint(0xffffff, { map: cob, bumpMap: cob, bumpScale: 1.5, roughness: 0.8 }), 0, 0, -30);
    road.rotation.x = -Math.PI / 2; road.castShadow = false; scene.add(road);
    const slab = slabTex(); slab.repeat.set(1, 24);
    for (const side of [-1, 1]) {
      const walk = mesh(new THREE.PlaneGeometry(1.8, 80), paint(0xffffff, { map: slab }), side * 3.6, 0.03, -30); walk.rotation.x = -Math.PI / 2; walk.castShadow = false; scene.add(walk);
      const grass = mesh(new THREE.PlaneGeometry(30, 80), paint(0x6f8f4e), side * 19.5, 0.01, -30); grass.rotation.x = -Math.PI / 2; grass.castShadow = false; scene.add(grass);
      for (let i = 0; i < 6; i++) {
        const house = makeHouse(i + (side > 0 ? 1 : 0), 0xe9c46a, 6, 4, 0x9c4a2f);
        house.position.set(side * 6.6, 0, -4 - i * 11 + (side > 0 ? 4 : 0)); if (side > 0) house.rotation.y = Math.PI;
        scene.add(house);
        const tree = makeTree(); tree.position.set(side * 4.4, 0, -1 - i * 11 + (side > 0 ? 3 : 0)); tree.rotation.y = i * 1.7; scene.add(tree);
        if (i % 2 === 0) {
          const lamp = makeLamp(); lamp.position.set(side * 3.1, 0, -0.5 - i * 11 + (side > 0 ? -4 : 0)); scene.add(lamp);
          if (i === 0) { const glow = new THREE.PointLight(0xffc477, 6, 9, 1.6); glow.position.set(side * 3.1, 4.3, lamp.position.z); scene.add(glow); }
        }
      }
    }

    const baby = this.baby = makeBabyRelu(); baby.position.set(0, 0, 0); scene.add(baby);
    const sc = makeSuitcase(0.75); sc.position.set(0.9, 0, 0.2); sc.rotation.y = -0.4; sc.traverse(m => { m.castShadow = !!m.isMesh; }); scene.add(sc);
    sun.target.position.set(0, 0, 0);

    this.t = 0;
  }
  resize(a) {
    this.camera.aspect = a; this.camera.fov = a < 1 ? 60 : 40; this.camera.updateProjectionMatrix();
    // Relu sits in the upper half so the title can go below him
    // a low, child's-eye camera tilted up: the sunset sky fills the top, Relu stands above the title
    this.camera.position.set(0, 0.75, a < 1 ? 9 : 7);
    this.camera.lookAt(0, a < 1 ? -0.1 : 0.6, -4);
  }
  update(dt) {
    this.t += dt;
    // mostly idle, with a little wave every few seconds
    this.baby.userData.animate(this.t, this.t % 7 > 4.6 ? 'wave' : 'idle');
  }
}

// ---------- app ----------
const app = {
  view: null, level: null, levelIndex: 0, title: new TitleScene(),
  rect() { const r = renderer.domElement.getBoundingClientRect(); return { w: r.width, h: r.height, x: r.left, y: r.top }; },

  toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(this._toast); this._toast = setTimeout(() => t.classList.remove('show'), 2200);
  },
  setChecklist(items) {
    $('checklist').innerHTML = items.map(i => `<span data-id="${i.id}">${i.name}</span>`).join('');
  },
  markChecked(id) { const el = $('checklist').querySelector(`[data-id="${id}"]`); if (el) el.classList.add('got'); },
  hud({ hearts, stamps, progress }) {
    if (hearts !== undefined) $('hud-hearts').innerHTML = [0, 1, 2].map(i => `<span class="${i < hearts ? '' : 'lost'}">❤</span>`).join('');
    if (stamps !== undefined) $('hud-stamp-n').textContent = stamps;
    if (progress !== undefined) $('hud-fill').style.width = (progress * 100).toFixed(1) + '%';
  },
  fade(fn) {
    $('fade').classList.add('on');
    setTimeout(() => { fn(); $('fade').classList.remove('on'); }, 450);
  },

  // flow
  openMap() {
    sound.stopMusic();
    this.endLevel();
    this.view = this.title;
    renderStamps();
    only('screen-map');
  },
  openStory(i) {
    const L = LEVELS[i]; this.levelIndex = i;
    loadLevel(i);   // start downloading while the story is read
    $('story-date').textContent = L.story.date;
    $('story-title').textContent = L.story.title;
    $('story-body').innerHTML = L.story.body.map(p => `<p>${p}</p>`).join('');
    $('story-photos').innerHTML = L.story.photos.map(src => `<img src="${asset(src)}" alt="">`).join('');
    only('screen-story');
  },
  async startLevel() {
    const loading = loadLevel(this.levelIndex);
    const slow = setTimeout(() => loadingUI.show('טוען את השלב…', true), 150);
    await loading; clearTimeout(slow); loadingUI.hide();
    this.fade(() => {
      only(null);
      this.endLevel();
      this.level = LEVELS[this.levelIndex].make(this);
      this.view = this.level;
      onResize();
      show('hud');
      show('hud-progress', false); show('hud-stamps', false); show('hud-hearts', false);
      // levels with a packing phase start there; the others go straight to their instructions
      if (this.level.packTap) show('pack-ui');
      else { this.level.paused = true; this.showHowto(); }
    });
  },
  packingDone() {
    this.fade(() => {
      show('pack-ui', false);
      this.level.startRun();
      this.level.paused = true;
      this.showHowto();
    });
  },
  showHowto() {
    const H = LEVELS[this.levelIndex].howto;
    $('howto-title').textContent = H.title;
    $('howto-text').textContent = H.text;
    $('howto-items').innerHTML = H.items.map(([b, t, s]) => `<div><b>${b}</b>${t}<small>${s}</small></div>`).join('');
    $('btn-howto-go').textContent = H.go;
    only('screen-howto');
  },
  beginRun() {
    only(null);
    const U = LEVELS[this.levelIndex].hud;
    $('hud-label-a').textContent = U.labels[0]; $('hud-label-b').textContent = U.labels[1];
    $('hud-stamp-icon').textContent = U.icon;
    show('hud-progress'); show('hud-stamps'); show('hud-hearts', U.hearts);
    this.level.paused = false;
    if (this.level.music !== false) sound.startMusic();
  },
  levelFailed() {
    sound.stopMusic();
    only('screen-fail');
  },
  retry() {
    this.fade(() => {
      this.level.startRun();
      this.level.paused = true;
      this.showHowto();
    });
  },
  levelComplete(res) {
    sound.stopMusic();
    save.set(this.levelIndex, res.stars);
    const R = LEVELS[this.levelIndex].result;
    $('result-label').textContent = R.label;
    $('result-title').textContent = R.title;
    $('result-stars').innerHTML = [0, 1, 2].map(i => i < res.stars ? `<span class="on" style="animation-delay:${0.2 + i * 0.25}s">★</span>` : '<span>★</span>').join('');
    $('result-text').textContent = `${R.text} ${res.summary || `אספת ${res.stamps} בולים מתוך ${res.total}.`}`;
    $('result-postmark').innerHTML = `<div>${R.mark[0]}<small>${R.mark[1]}</small>שלב ${this.levelIndex + 1}</div>`;
    show('hud', false);
    only('screen-result');
    sound.fanfare();
  },
  endLevel() {
    if (this.level) { this.level.dispose(); this.level = null; }
    show('hud', false); show('pack-ui', false);
  },
  pause(on) {
    if (!this.level || this.view !== this.level) return;
    this.level.paused = on;
    show('screen-pause', on);
    if (on) sound.stopMusic(); else if (this.level.phase === 'run' && !this.level.ending && this.level.music !== false) sound.startMusic();
  },
};
app.view = app.title;

function renderStamps() {
  const best = save.get();
  $('stamps').innerHTML = LEVELS.map((L, i) => {
    const stars = best[i] || 0;
    return `<button class="stamp" data-i="${i}" ${L.ready ? '' : 'disabled'} aria-label="${L.name}">
      <img src="assets/${L.img}.jpg" alt="">
      ${L.ready ? '' : '<span class="soon">בקרוב</span>'}
      ${stars ? '<span class="done">עבר<br>✓</span>' : ''}
      <span class="yr">${L.yr}</span>
      <span class="nm">${i + 1}. ${L.name}</span>
      <span class="stars">${L.ready ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : ''}</span>
    </button>`;
  }).join('');
}

// ---------- buttons ----------
const tap = (id, fn) => $(id).addEventListener('click', e => { sound.unlock(); fn(e); });
tap('btn-start', () => app.openMap());
tap('btn-map-back', () => only('screen-title'));
$('stamps').addEventListener('click', e => {
  const b = e.target.closest('.stamp'); if (!b || b.disabled) return;
  sound.unlock(); sound.pop(); app.openStory(+b.dataset.i);
});
tap('btn-story-play', () => app.startLevel());
tap('btn-story-back', () => app.openMap());
tap('btn-howto-go', () => app.beginRun());
tap('btn-pause', () => app.pause(true));
tap('btn-resume', () => app.pause(false));
tap('btn-quit', () => { show('screen-pause', false); app.openMap(); });
tap('btn-retry', () => app.retry());
tap('btn-fail-map', () => app.openMap());
tap('btn-result-map', () => app.openMap());
tap('btn-result-again', () => app.startLevel());
tap('btn-sound', () => { sound.setMuted(!sound.muted); $('btn-sound').textContent = sound.muted ? '✕' : '♪'; });

// ---------- input: swipes, taps, keys ----------
let down = null;
renderer.domElement.addEventListener('pointerdown', e => { sound.unlock(); down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
renderer.domElement.addEventListener('pointerup', e => {
  if (!down || !app.level || app.level.paused) { down = null; return; }
  const dx = e.clientX - down.x, dy = e.clientY - down.y, L = app.level;
  const r = app.rect();
  if (L.phase === 'pack') { if (Math.hypot(dx, dy) < 25) L.packTap(e.clientX - r.x, e.clientY - r.y); }
  else if (L.phase === 'run') {
    if (Math.abs(dx) > 28 && Math.abs(dx) > Math.abs(dy)) L.move(dx > 0 ? 1 : -1);
    else if (L.tapAt) L.tapAt((e.clientX - r.x) / r.w);
    else L.jump();
  }
  down = null;
});
// fire the swipe as soon as the finger has travelled far enough, so lane changes feel instant
renderer.domElement.addEventListener('pointermove', e => {
  if (!down || !app.level || app.level.paused || app.level.phase !== 'run') return;
  const dx = e.clientX - down.x, dy = e.clientY - down.y;
  if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { app.level.move(dx > 0 ? 1 : -1); down = null; }
  else if (dy < -40 && Math.abs(dy) > Math.abs(dx)) { app.level.jump(); down = null; }
  else if (dy > 40 && Math.abs(dy) > Math.abs(dx) && app.level.duck) { app.level.duck(); down = null; }
});
window.addEventListener('keydown', e => {
  const L = app.level;
  if (L && !L.paused && L.onKey && L.onKey(e.code)) { e.preventDefault(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (L && L.phase === 'run' && $('screen-howto').hidden && $('screen-fail').hidden) app.pause(!L.paused); return; }
  if (!L || L.paused || L.phase !== 'run') return;
  if (e.code === 'ArrowLeft' || e.code === 'KeyA') L.move(-1);
  else if (e.code === 'ArrowRight' || e.code === 'KeyD') L.move(1);
  else if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Space') { e.preventDefault(); L.jump(); }
  else if ((e.code === 'ArrowDown' || e.code === 'KeyS') && L.duck) { e.preventDefault(); L.duck(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && app.level && app.level.phase === 'run' && !app.level.paused && !app.level.ending) app.pause(true); });

// ---------- loop ----------
function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  composer.setSize(w, h);
  app.title.resize(w / h);
  if (app.level) app.level.resize(w / h);
}
window.addEventListener('resize', onResize);
onResize();

let last = performance.now();
renderer.setAnimationLoop(now => {
  const raw = (now - last) / 1000, dt = Math.min(0.05, raw); last = now;
  const v = app.view;
  if (v === app.title && !$('screen-title').hidden) return;   // the title picture covers the 3D street: save the phone's battery
  v.update(dt);
  if (!v.scene.environment) v.scene.environment = env;
  draw(v);
  if (v.look) watchFrameRate(raw);
});

// for quick testing: #level1 jumps straight into the level
const jump = location.hash.match(/^#level(\d)/);
if (jump && LEVELS[jump[1] - 1]?.make) { app.levelIndex = jump[1] - 1; app.startLevel(); }   // testing shortcut, also for levels not yet on the map
if (location.hash.endsWith('debug')) {
  window.app = app;
  // testing aid: draw a frame on demand (the animation loop stops while the page is hidden)
  app.renderNow = () => draw(app.view);
  app.quality = quality; app.renderer = renderer; app.setQuality = s => { quality.locked = true; quality.step = s; applyLook(app.view); };
  import('./testkit.js').catch(() => {});
}
