import { THREE, makeSky, skyEnvFrom } from './engine.js';

// The "polished" look a level can opt into: painted surface sets (colour, bump and shine drawn on canvases,
// so nothing extra to download), reflections from the level's own sky, and soft contact shadows.

// a repeatable random stream, so a surface looks the same on every phone and every visit
export function rng(seed = 1) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }

function canvas2d(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d', { willReadFrequently: true })]; }

function texOf(c, srgb, repeat) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  return t;
}

// a grey height canvas becomes a tangent-space normal map (wrapping at the edges, so it tiles)
function normalFromHeight(heightCanvas, strength = 2) {
  const w = heightCanvas.width, h = heightCanvas.height;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const [c, g] = canvas2d(w, h);
  const out = g.createImageData(w, h), d = out.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255;
  }
  g.putImageData(out, 0, 0);
  return c;
}

// soft blotches that wrap around the canvas edges, so the repeat doesn't show
function blotches(g, S, n, r0, r1, rand, colorAt) {
  for (let i = 0; i < n; i++) {
    const x = rand() * S, y = rand() * S, r = r0 + rand() * (r1 - r0), col = colorAt(rand);
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      if (x + ox + r < 0 || x + ox - r > S || y + oy + r < 0 || y + oy - r > S) continue;
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
      gr.addColorStop(0, col); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
      g.fillStyle = gr; g.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
    }
  }
}

function speckle(g, S, amount, rand) {
  const im = g.getImageData(0, 0, S, S), d = im.data;
  for (let i = 0; i < d.length; i += 4) { const n = (rand() - 0.5) * amount; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
  g.putImageData(im, 0, 0);
}

// square tiles: a colour, bump and shine map that repeat. `rgb` is the tile colour, `vary` how far each tile strays.
export function tileSet({ size = 512, tiles = 4, rgb = [222, 208, 184], vary = 12, grout = '#8d8473', groutW = 5, rough = 0.62, stone = true, seed = 7 } = {}) {
  const rand = rng(seed), S = size, cell = S / tiles;
  const [col, g] = canvas2d(S, S), [hgt, gh] = canvas2d(S, S), [rgh, gr] = canvas2d(S, S);
  g.fillStyle = grout; g.fillRect(0, 0, S, S);
  gh.fillStyle = '#000'; gh.fillRect(0, 0, S, S);
  gr.fillStyle = '#fff'; gr.fillRect(0, 0, S, S);
  for (let y = 0; y < tiles; y++) for (let x = 0; x < tiles; x++) {
    const v = (rand() - 0.5) * vary, a = groutW / 2;
    g.fillStyle = `rgb(${rgb[0] + v},${rgb[1] + v},${rgb[2] + v * 0.9})`;
    g.fillRect(x * cell + a, y * cell + a, cell - groutW, cell - groutW);
    gh.fillStyle = `rgb(${200 + rand() * 30},${200},${200})`;
    gh.fillRect(x * cell + a, y * cell + a, cell - groutW, cell - groutW);
    const m = Math.round((rough + (rand() - 0.5) * 0.12) * 255);
    gr.fillStyle = `rgb(${m},${m},${m})`;   // three reads roughness from the green channel
    gr.fillRect(x * cell + a, y * cell + a, cell - groutW, cell - groutW);
  }
  if (stone) {
    // the veins and pits of natural stone
    blotches(g, S, 90, S * 0.02, S * 0.1, rand, r => r() < 0.55 ? `rgba(120,100,70,${0.05 + r() * 0.08})` : `rgba(255,248,232,${0.05 + r() * 0.08})`);
    blotches(gh, S, 140, 1, S * 0.012, rand, r => `rgba(0,0,0,${0.2 + r() * 0.3})`);
  }
  speckle(g, S, 9, rand); speckle(gh, S, 16, rand);
  return {
    map: texOf(col, true), normalMap: texOf(normalFromHeight(hgt, 3), false), roughnessMap: texOf(rgh, false),
    scale(world) { for (const t of [this.map, this.normalMap, this.roughnessMap]) t.repeat.set(1 / world, 1 / world); return this; },
    dispose() { this.map.dispose(); this.normalMap.dispose(); this.roughnessMap.dispose(); },
  };
}

// leaves, grass, anything soft: lots of little dabs in a few shades
export function foliageSet({ size = 256, dark = [46, 84, 34], light = [122, 164, 70], dabs = 1300, dab = 6, seed = 3 } = {}) {
  const rand = rng(seed), S = size;
  const [col, g] = canvas2d(S, S), [hgt, gh] = canvas2d(S, S);
  g.fillStyle = `rgb(${dark})`; g.fillRect(0, 0, S, S);
  gh.fillStyle = '#333'; gh.fillRect(0, 0, S, S);
  for (let i = 0; i < dabs; i++) {
    const x = rand() * S, y = rand() * S, k = rand(), r = dab * (0.4 + rand()), a = rand() * Math.PI;
    const c = dark.map((v, j) => v + (light[j] - v) * k);
    for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) {
      g.fillStyle = `rgb(${c})`; g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.45, a, 0, 7); g.fill();
      const b = 60 + k * 190; gh.fillStyle = `rgb(${b},${b},${b})`; gh.beginPath(); gh.ellipse(x + ox, y + oy, r, r * 0.45, a, 0, 7); gh.fill();
    }
  }
  return { map: texOf(col, true), normalMap: texOf(normalFromHeight(hgt, 2.5), false), dispose() { this.map.dispose(); this.normalMap.dispose(); } };
}

// a box whose texture is measured in world units, so tiles stay square on every face
export function worldBox(w, h, d, scale = 1) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const p = geo.attributes.position, n = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    if (Math.abs(n.getX(i)) > 0.5) uv.setXY(i, p.getZ(i) * scale, p.getY(i) * scale);
    else if (Math.abs(n.getY(i)) > 0.5) uv.setXY(i, p.getX(i) * scale, p.getZ(i) * scale);
    else uv.setXY(i, p.getX(i) * scale, p.getY(i) * scale);
  }
  return geo;
}

// a soft dark patch where an object meets the ground: the shade a real sun's bounce light can't reach
let contactTex = null;
export function contactShadow(rx, rz = rx, strength = 0.5) {
  if (!contactTex) {
    const [c, g] = canvas2d(128, 128);
    const gr = g.createRadialGradient(64, 64, 6, 64, 64, 64);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.5, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    contactTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(rx * 2, rz * 2), new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, opacity: strength, depthWrite: false, color: 0x1a1408, fog: false }));
  m.rotation.x = -Math.PI / 2; m.renderOrder = 1; m.userData.keepMap = true;
  return m;
}

// Levels share their model materials, so a level that wants stronger reflections gets its own copies.
export function ownMaterials(root, envIntensity) {
  const copies = new Map();
  root.traverse(o => {
    if (!o.isMesh || !o.material?.isMeshStandardMaterial || o.userData.ownMat) return;
    if (!copies.has(o.material)) { const m = o.material.clone(); m.envMapIntensity = Math.max(m.envMapIntensity, envIntensity); copies.set(o.material, m); }
    o.material = copies.get(o.material);
    o.userData.ownMat = true;
  });
  return [...copies.values()];
}

// reflections and ambient light taken from the level's actual sky
export function skyEnvironment(skyOpts, ground = 0xb9ad96) {
  const s = new THREE.Scene();
  s.add(makeSky({ ...skyOpts, radius: 50 }));
  const floor = new THREE.Mesh(new THREE.CircleGeometry(50, 16), new THREE.MeshBasicMaterial({ color: ground }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -1; s.add(floor);
  return skyEnvFrom(s);
}

// a little cloud, painted once and used as a far-off sprite
export function cloudSprite(seed) {
  const rand = rng(seed), [c, g] = canvas2d(256, 128);
  for (let i = 0; i < 26; i++) {
    const x = 40 + rand() * 176, y = 72 - rand() * 24 + (Math.abs(x - 128) / 128) * 16, r = 12 + rand() * 26 * (1 - Math.abs(x - 128) / 170);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
}

// ---------- the colour finish that goes after tone mapping ----------
export const GradeShader = {
  uniforms: { tDiffuse: { value: null }, contrast: { value: 1.08 }, saturation: { value: 1.12 }, vignette: { value: 0.28 }, tint: { value: new THREE.Vector3(1.01, 1, 0.975) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float contrast, saturation, vignette; uniform vec3 tint; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(l), c, saturation);
      c = (c - 0.5) * contrast + 0.5;
      c *= tint;
      vec2 q = vUv - 0.5;
      c *= 1.0 - vignette * smoothstep(0.25, 0.85, length(q * vec2(1.1, 1.0)) * 1.15);
      gl_FragColor = vec4(c, 1.0);
    }`,
};
