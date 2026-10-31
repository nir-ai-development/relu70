import { THREE, paint, mesh, loadGltf, matte } from './engine.js';
import { model } from './models.js';
import { clone as cloneSkinned } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/SkeletonUtils.js/+esm';

const SKIN = 0xf3cba6, CHEEK = 0xf29a9a, HAIR = 0x2b1d16, EYE = 0x1a1414;

// ---------- sculpted, rigged toddler Relu (Meshy model, Mixamo skeleton) ----------
// game mode -> start of the clip name inside relu_toddler.glb (Meshy numbers its idles: Idle_02, Idle_03, ...)
const CLIPS = { run: 'Running', walk: 'Walking', idle: 'Idle_0', jump: 'Jump_Run', wave: 'Wave_One_Hand', cheer: 'happy_jump_m' };
const SCALE = 2;   // the model is 0.9 m tall; the world is built around a ~1.8-unit toddler
let relu = null;

function prepRig(gltf, jumpClip) {
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    matte(o.material, 0.8);   // skin keeps a hint of softness, never a plastic shine
    o.material.side = THREE.FrontSide;
    o.castShadow = true;
    o.frustumCulled = false;   // skinned bounds don't follow the animation
    o.userData.keep = true;    // geometry is shared by every clone; levels must not dispose it
  });
  // the game moves characters itself, so keep the hips over the origin (no root motion);
  // for jumps also drop the clip's own height, physics provides it
  for (const clip of gltf.animations) {
    for (const tr of clip.tracks) {
      if (!/Hips\.position$/.test(tr.name)) continue;
      const v = tr.values, x0 = v[0], y0 = v[1], z0 = v[2];
      for (let i = 0; i < v.length; i += 3) {
        v[i] = x0; v[i + 2] = z0;
        if (clip.name === jumpClip) v[i + 1] = y0;
      }
    }
  }
  return gltf;
}

// Other rigged people (Meshy models, Mixamo skeleton); each is optional until its file exists.
// `m` is the real height Meshy rigged the model at.
const FIGURES = {
  mom: { url: 'assets/mom_1958.glb', m: 1.7 },
  dad: { url: 'assets/dad_1958.glb', m: 1.78 },
  kid: { url: 'assets/relu_kid.glb', m: 1.4 },       // Relu at about 10, Jerusalem 1966
  teacher: { url: 'assets/teacher.glb', m: 1.6 },    // his piano teacher
  teen: { url: 'assets/relu_teen.glb', m: 1.55 },    // Relu at 13, Leyada 1969
  classmate: { url: 'assets/classmate.glb', m: 1.5 },
  mathTeacher: { url: 'assets/math_teacher.glb', m: 1.75 },
  officer: { url: 'assets/relu_officer.glb', m: 1.78 },   // Relu at 20, IDF officer (also his 1980 look)
  soldier: { url: 'assets/soldier.glb', m: 1.75 },
  doctor: { url: 'assets/relu_doctor.glb', m: 1.78 },     // Dr. Avraham, Hadassah
  aline: { url: 'assets/aline.glb', m: 1.65 },
  father: { url: 'assets/relu_father.glb', m: 1.78 },     // father of four, 1989
  girlKid: { url: 'assets/girl_kid.glb', m: 1.05 },
  boyKid: { url: 'assets/boy_kid.glb', m: 1.2 },
  saba: { url: 'assets/saba.glb', m: 1.75 },              // Saba Relu, 70
};
const figures = {}, pending = {};

// toddler Relu is needed from the title screen on; everyone else loads with the level that uses them
export async function loadCharacters(keys = []) {
  relu ||= prepRig(await loadGltf('assets/relu_toddler.glb'), CLIPS.jump);
  await loadFigures(keys);
}

export function loadFigures(keys) {
  return Promise.all(keys.filter(k => FIGURES[k]).map(k => pending[k] ||= (async () => {
    try { figures[k] = prepRig(await loadGltf(FIGURES[k].url)); } catch { /* fall back to the hand-built figures */ }
  })()));
}

// A person who plays whichever of their clips matches the mode ("wave", "idle", "sit", "clap", ...).
// Same animate(t, mode) interface as makeAdult; null if that model isn't available.
export function makeFigure(which, height) {
  const gltf = figures[which];
  if (!gltf) return null;
  const root = new THREE.Group();
  const m = cloneSkinned(gltf.scene);
  root.add(m);
  // (a skinned model's bounding box is unreliable before its first animation frame)
  m.scale.setScalar(height / FIGURES[which].m);
  const mixer = new THREE.AnimationMixer(m);
  const clip = mode => gltf.animations.find(a => a.name.toLowerCase().includes(mode));
  // people without an idle clip wave rather than run on the spot
  const fallback = clip('idle') || clip('wave') || gltf.animations[0];
  let cur = null, lastT = null;
  // someone with no idle clip stands still in the first frame of their wave (arms down) or walk instead
  const still = !clip('idle') && (clip('wave') || clip('walk'));
  root.userData.animate = (t, mode) => {
    const dt = lastT === null ? 0 : Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
    const stand = mode === 'idle' && still;
    const c = stand ? still : clip(mode) || fallback;
    if (c && c !== cur) {
      const next = mixer.clipAction(c).reset().play();
      if (cur) mixer.clipAction(cur).crossFadeTo(next, 0.25, false);
      cur = c;
    }
    if (c) { const a = mixer.clipAction(c); a.paused = stand; if (stand) a.time = 0; }
    mixer.update(dt);
  };
  root.userData.clipLength = mode => (clip(mode) || fallback)?.duration || 1;
  root.userData.bone = name => { let b = null; m.traverse(o => { if (!b && o.isBone && o.name.endsWith(name)) b = o; }); return b; };
  return root;
}

export function makeBabyRelu() {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const model = cloneSkinned(relu.scene);
  model.scale.setScalar(SCALE);
  body.add(model);

  const mixer = new THREE.AnimationMixer(model);
  const actions = {};
  for (const [mode, name] of Object.entries(CLIPS)) actions[mode] = mixer.clipAction(relu.animations.find(a => a.name.startsWith(name)));
  actions.jump.setLoop(THREE.LoopOnce).clampWhenFinished = true;

  let hand = null;
  model.traverse(o => { if (o.isBone && /RightHand$/.test(o.name)) hand = o; });

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.14, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01;
  root.add(shadow);

  let cur = null, lastT = null, carried = null;
  const v = new THREE.Vector3();
  const animate = (t, mode, k = 1) => {
    const dt = lastT === null ? 0 : Math.min(0.1, Math.max(0, t - lastT)); lastT = t;
    const next = actions[mode] || actions.idle;
    if (next !== cur) {
      next.reset().setEffectiveWeight(1).fadeIn(cur ? 0.18 : 0).play();
      // the jump clip is stretched to fit the physics airtime (~0.65 s)
      if (mode === 'jump') next.setEffectiveTimeScale(next.getClip().duration / 0.7);
      if (cur) cur.fadeOut(0.18);
      cur = next;
    }
    if (mode === 'run') cur.setEffectiveTimeScale(k);
    mixer.update(dt);
    if (carried && hand) {
      // the suitcase hangs straight down from his right hand
      hand.getWorldPosition(v); root.worldToLocal(v);
      carried.position.set(v.x, v.y - 0.24, v.z);
    }
  };

  Object.assign(root.userData, { body, shadow, animate, carry: obj => { carried = obj; if (obj) root.add(obj); } });
  return root;
}

function limb(r, len, color) {
  const g = new THREE.Group();
  const m = mesh(new THREE.CapsuleGeometry(r, len, 4, 10), color, 0, -len / 2 - r * 0.6, 0);
  g.add(m);
  return g;
}

function face(head, r) {
  // eyes with a highlight, rosy cheeks, small smile; the face looks along +z
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(r * 0.13, 16, 12), EYE, s * r * 0.36, r * 0.02, r * 0.9);
    eye.scale.set(1, 1.25, 0.6);
    const hl = mesh(new THREE.SphereGeometry(r * 0.045, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), s * r * 0.36 + r * 0.04, r * 0.08, r * 0.98);
    const cheek = mesh(new THREE.SphereGeometry(r * 0.14, 12, 8), paint(CHEEK, { transparent: true, opacity: 0.7 }), s * r * 0.58, -r * 0.24, r * 0.74);
    cheek.scale.set(1, 0.6, 0.4);
    const ear = mesh(new THREE.SphereGeometry(r * 0.17, 12, 10), SKIN, s * r * 0.98, -r * 0.02, 0);
    ear.scale.set(0.5, 1, 0.8);
    head.add(eye, hl, cheek, ear);
  }
  const smile = mesh(new THREE.TorusGeometry(r * 0.16, r * 0.035, 6, 16, Math.PI), 0x8c2f2f, 0, -r * 0.3, r * 0.9);
  smile.rotation.z = Math.PI;
  const nose = mesh(new THREE.SphereGeometry(r * 0.08, 10, 8), SKIN, 0, -r * 0.1, r * 1.0);
  head.add(smile, nose);
}

// Grown-ups for cut-scenes (Miriam and Reuven at the plane door).
export function makeAdult({ coat = 0x4a4a52, hair = HAIR, dress = false, hat = false } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const parts = {};
  const torso = dress
    ? mesh(new THREE.CylinderGeometry(0.26, 0.48, 1.15, 18), coat, 0, 1.05, 0)
    : mesh(new THREE.CapsuleGeometry(0.3, 0.55, 4, 14), coat, 0, 1.25, 0);
  body.add(torso);
  for (const s of [-1, 1]) {
    const leg = limb(0.1, 0.55, dress ? SKIN : 0x2f2f36); leg.position.set(s * 0.14, dress ? 0.62 : 0.8, 0);
    const shoe = mesh(new THREE.SphereGeometry(0.11, 10, 8), 0x231a14, 0, dress ? -0.66 : -0.76, 0.06); shoe.scale.set(0.9, 0.6, 1.5); leg.add(shoe);
    const arm = limb(0.08, 0.5, coat); arm.position.set(s * 0.36, 1.6, 0); arm.rotation.z = s * 0.12;
    arm.add(mesh(new THREE.SphereGeometry(0.09, 10, 8), SKIN, 0, -0.62, 0));
    body.add(leg, arm);
    parts[s < 0 ? 'legL' : 'legR'] = leg;
    parts[s < 0 ? 'armL' : 'armR'] = arm;
  }
  const head = new THREE.Group(); head.position.set(0, 2.05, 0);
  const R = 0.27;
  head.add(mesh(new THREE.SphereGeometry(R, 22, 18), SKIN));
  face(head, R);
  head.add(mesh(new THREE.SphereGeometry(R * 1.06, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), hair, 0, R * 0.05, -R * 0.06));
  if (dress) { const bun = mesh(new THREE.SphereGeometry(R * 0.5, 14, 10), hair, 0, R * 0.55, -R * 0.75); head.add(bun); }
  if (hat) {
    head.add(mesh(new THREE.CylinderGeometry(R * 1.5, R * 1.5, 0.04, 20), 0x2e2a26, 0, R * 0.75, 0));
    head.add(mesh(new THREE.CylinderGeometry(R * 0.95, R * 1.05, 0.26, 20), 0x2e2a26, 0, R * 0.9, 0));
  }
  body.add(head);
  parts.head = head;
  Object.assign(root.userData, { body, parts });
  root.userData.animate = (t, mode, k = 1) => animateFigure(root, t, mode, k);
  return root;
}

function animateFigure(root, t, mode, k) {
  const { body, parts } = root.userData;
  const { legL, legR, armL, armR, head } = parts;
  if (mode === 'run') {
    const s = Math.sin(t * 14 * k);
    legL.rotation.x = s * 0.9; legR.rotation.x = -s * 0.9;
    armL.rotation.x = -s * 0.8; armR.rotation.x = s * 0.5 - 0.2;
    body.position.y = Math.abs(Math.cos(t * 14 * k)) * 0.08;
    body.rotation.z = s * 0.05;
    head.rotation.z = -s * 0.06;
  } else if (mode === 'walk') {
    const s = Math.sin(t * 8);
    legL.rotation.x = s * 0.5; legR.rotation.x = -s * 0.5;
    armL.rotation.x = -s * 0.4; armR.rotation.x = s * 0.4;
    body.position.y = Math.abs(Math.cos(t * 8)) * 0.04;
  } else if (mode === 'jump') {
    legL.rotation.x = -0.7; legR.rotation.x = -0.3;
    armL.rotation.x = -2.6; armR.rotation.x = -0.4;
    armL.rotation.z = -0.4;
  } else if (mode === 'cheer') {
    armL.rotation.x = 0; armR.rotation.x = 0;
    armL.rotation.z = -2.6 + Math.sin(t * 10) * 0.3; armR.rotation.z = 2.6 - Math.sin(t * 10) * 0.3;
    legL.rotation.x = legR.rotation.x = 0;
    body.position.y = Math.abs(Math.sin(t * 7)) * 0.25;
  } else if (mode === 'wave') {
    armR.rotation.z = 2.5 + Math.sin(t * 9) * 0.35; armR.rotation.x = 0;
    armL.rotation.z = -0.12; legL.rotation.x = legR.rotation.x = 0;
    body.position.y = 0;
  } else { // idle
    legL.rotation.x = legR.rotation.x = 0;
    armL.rotation.x = Math.sin(t * 2) * 0.08; armR.rotation.x = -Math.sin(t * 2) * 0.08;
    armL.rotation.z = -0.25; armR.rotation.z = 0.25;
    body.position.y = Math.sin(t * 3) * 0.015;
    body.rotation.z = 0;
    head.rotation.z = Math.sin(t * 1.3) * 0.08;
  }
}

// little brown leather suitcase with a strap
export function makeSuitcase(scale = 1) {
  const g = new THREE.Group();
  const m = model('suitcase');
  if (m) { g.add(m); g.scale.setScalar(scale); return g; }
  const leather = 0x8a4e2b;
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.62, 0.32), leather, 0, 0.31, 0));
  g.add(mesh(new THREE.BoxGeometry(0.92, 0.07, 0.34), 0x5e3219, 0, 0.42, 0));
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.07, 0.64, 0.34), 0xc9a36a, s * 0.28, 0.31, 0));
  const handle = mesh(new THREE.TorusGeometry(0.11, 0.025, 6, 14, Math.PI), 0x3b2312, 0, 0.62, 0);
  g.add(handle);
  g.scale.setScalar(scale);
  return g;
}
