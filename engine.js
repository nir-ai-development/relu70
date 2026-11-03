// the +esm build is the same module instance the GLTFLoader/SkeletonUtils +esm builds import
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js/+esm';
import { MeshoptDecoder } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/meshopt_decoder.module.js/+esm';
import { RoomEnvironment } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/environments/RoomEnvironment.js/+esm';
export { THREE };

// ---------- materials ----------
// soft, matte "painted" PBR surfaces that sit well next to the sculpted Meshy models
const matCache = new Map();
export function paint(color, opts) {
  if (!opts) {
    if (!matCache.has(color)) matCache.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, envMapIntensity: 0.6 }));
    return matCache.get(color);
  }
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, envMapIntensity: 0.6, ...opts });
}

export function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, typeof mat === 'string' || typeof mat === 'number' ? paint(mat) : mat);
  m.position.set(x, y, z);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// Meshy models ship with metal/roughness maps that make skin, cloth and wood look like wet plastic.
// Turn them into soft, matte painted surfaces (like clay or fabric); `rough` is how matte.
export function matte(material, rough = 0.92) {
  material.metalness = 0; material.metalnessMap = null;
  material.roughness = rough; material.roughnessMap = null;
  material.envMapIntensity = 0.55;
  if (material.normalMap) material.normalScale.set(0.6, 0.6);
  material.needsUpdate = true;
}

// ---------- image-based lighting shared by every scene ----------
let env = null, envRenderer = null;
export function studioEnv(renderer) {
  envRenderer = renderer;
  if (!env) env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  return env;
}
// the same, but lit by a scene of the level's own (dispose the returned render target with the level)
export function skyEnvFrom(scene) {
  const pm = new THREE.PMREMGenerator(envRenderer), target = pm.fromScene(scene, 0.02);
  pm.dispose();
  return target;
}

// ---------- gradient sky dome with a soft sun glow ----------
export function makeSky({ top = '#4f86cf', mid = '#a9cdec', horizon = '#fbe3c4', sunDir = [0.3, 0.25, -1], sunColor = '#fff2d6', radius = 300 } = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, horizon: { value: new THREE.Color(horizon) },
      sunDir: { value: new THREE.Vector3(...sunDir).normalize() }, sunColor: { value: new THREE.Color(sunColor) },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 top, mid, horizon, sunDir, sunColor; varying vec3 vDir;
      void main(){
        float h = clamp(vDir.y, -0.1, 1.0);
        vec3 c = mix(horizon, mid, smoothstep(0.0, 0.18, h));
        c = mix(c, top, smoothstep(0.18, 0.75, h));
        float s = max(dot(vDir, sunDir), 0.0);
        c += sunColor * (pow(s, 600.0) * 1.5 + pow(s, 12.0) * 0.25);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), mat);
  dome.renderOrder = -1;
  return dome;
}

// ---------- glTF ----------
// Artifacts can't serve .glb, so models ship as glTF JSON with the buffer embedded as base64.
// Rebuild the binary GLB in memory so the loader never has to fetch a data: URL.
// assets are packed offline with gltfpack (meshopt-compressed, smooth normals already baked in);
// the JSON sources and the packing script live in Dad70/src_models
// index.html's build stamp keeps a phone from mixing cached files of two deploys
export const asset = url => `${url}?v=${document.querySelector('meta[name=build]')?.content || 0}`;
const gltfLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

// download progress for the loading bars: bytes received out of bytes expected, over every asset
// downloading right now (the count starts again once they have all arrived)
const meter = { got: 0, want: 0, busy: 0, listener: null };
export const onLoadProgress = fn => { meter.listener = fn; };
const report = () => meter.listener?.(meter.want ? Math.min(1, meter.got / meter.want) : 0);
async function download(url) {
  const res = await fetch(asset(url));
  if (!res.ok) throw new Error(url + ' ' + res.status);
  // (a compressed response reports its compressed size, so cap each file's share at that)
  const size = +res.headers.get('content-length') || 1;
  meter.busy++; meter.want += size; report();
  const parts = []; let n = 0, counted = 0;
  try {
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value); n += value.length;
      const add = Math.min(value.length, size - counted); counted += add; meter.got += add; report();
    }
  } finally {
    meter.got += size - counted;
    if (--meter.busy === 0) { report(); meter.got = meter.want = 0; } else report();
  }
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out.buffer;
}

export async function loadGltf(url) {
  const gltf = await gltfLoader.parseAsync(await download(url), '');
  gltf.scene.traverse(o => { if (o.isMesh) o.material.normalMap = null; });
  return gltf;
}

// ---------- canvas textures ----------
export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 4;
  return t;
}

const loader = new THREE.TextureLoader();
export function photoTex(url) {
  const t = loader.load(asset(url));
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- tiny tween timeline ----------
export class Timeline {
  constructor() { this.items = []; this.t = 0; }
  add(delay, dur, fn, done) { this.items.push({ start: this.t + delay, dur, fn, done, fired: false }); return this; }
  update(dt) {
    this.t += dt;
    for (const it of this.items) {
      if (it.fired || this.t < it.start) continue;
      const p = Math.min(1, (this.t - it.start) / it.dur);
      it.fn && it.fn(p);
      if (p >= 1) { it.fired = true; it.done && it.done(); }
    }
    this.items = this.items.filter(i => !i.fired);
  }
  get busy() { return this.items.length > 0; }
}
export const ease = {
  out: p => 1 - Math.pow(1 - p, 3),
  inOut: p => p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2,
  back: p => { const c = 1.7; return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); },
};

// ---------- audio (all synthesized, starts on first tap) ----------
class Sound {
  constructor() { this.ctx = null; this.muted = false; this.musicTimer = null; }
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.55; }
  tone(freq, dur = .15, type = 'triangle', vol = .25, when = 0, slide = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  jump() { this.tone(330, .22, 'square', .12, 0, 400); }
  collect() { this.tone(988, .09, 'triangle', .22); this.tone(1319, .14, 'triangle', .2, .07); }
  heal() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, .14, 'triangle', .2, i * .06)); }
  hit() { this.tone(160, .3, 'sawtooth', .22, 0, -90); this.tone(90, .35, 'square', .15, .02); }
  pop() { this.tone(620, .12, 'sine', .3, 0, 300); }
  nope() { this.tone(220, .14, 'square', .12); this.tone(185, .2, 'square', .12, .12); }
  fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, i === 5 ? .6 : .18, 'triangle', .25, i * .13)); }
  horn() { for (const f of [98, 147]) this.tone(f, 2.2, 'sawtooth', .1); }
  // a soft upright-piano note: a struck fundamental with a quieter octave and a fast decay
  piano(freq, vol = 0.28, when = 0) {
    this.tone(freq, 1.1, 'triangle', vol, when);
    this.tone(freq * 2, 0.5, 'sine', vol * 0.35, when);
    this.tone(freq * 3, 0.25, 'sine', vol * 0.12, when);
  }


  // An original little freilach-style loop in D "Ahava Rabba" mode, a nod to 1950s Romania.
  startMusic(bpm = 150) {
    this.stopMusic();
    if (!this.ctx) return;
    const N = { D4: 293.7, Eb4: 311.1, Fs4: 370, G4: 392, A4: 440, Bb4: 466.2, C5: 523.3, D5: 587.3, Eb5: 622.3, Fs5: 740, D3: 146.8, A2: 110, G3: 196, C3: 130.8 };
    const mel = ['D4', 'Fs4', 'A4', 'Fs4', 'G4', 'A4', 'Bb4', 'A4', 'G4', 'Fs4', 'Eb4', 'Fs4', 'D4', null, 'D4', null,
                 'A4', 'Bb4', 'C5', 'D5', 'C5', 'Bb4', 'A4', 'G4', 'Fs4', 'G4', 'A4', 'Fs4', 'D4', 'Eb4', 'D4', null];
    const bass = ['D3', 'A2', 'D3', 'A2', 'G3', 'D3', 'D3', 'A2'];
    const step = 60 / bpm / 2;
    let i = 0, next = this.ctx.currentTime + 0.05;
    this.musicTimer = setInterval(() => {
      while (next < this.ctx.currentTime + 0.2) {
        const when = next - this.ctx.currentTime;
        const n = mel[i % mel.length];
        if (n) this.tone(N[n], step * 0.9, 'square', 0.045, when);
        if (i % 2 === 0) this.tone(N[bass[(i / 2) % bass.length]], step * 1.6, 'triangle', 0.12, when);
        if (i % 2 === 1) this.tone(2000, 0.03, 'square', 0.015, when);
        next += step; i++;
      }
    }, 50);
  }
  stopMusic() { clearInterval(this.musicTimer); this.musicTimer = null; }
}
export const sound = new Sound();

// ---------- progress (best stars per level) ----------
export const save = {
  get() { try { return JSON.parse(localStorage.getItem('relu70') || '{}'); } catch { return {}; } },
  set(level, stars) {
    try { const s = save.get(); s[level] = Math.max(s[level] || 0, stars); localStorage.setItem('relu70', JSON.stringify(s)); } catch { /* storage unavailable */ }
  },
};
