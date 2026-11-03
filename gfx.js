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

// plaster, sand, packed earth: soft blotches of colour and a fine bump, no tiles
export function plasterSet({ size = 512, rgb = [235, 225, 205], vary = 16, bump = 2, speck = 10, seed = 5, repeat = [1, 1] } = {}) {
  const rand = rng(seed), S = size;
  const [col, g] = canvas2d(S, S), [hgt, gh] = canvas2d(S, S);
  g.fillStyle = `rgb(${rgb})`; g.fillRect(0, 0, S, S);
  gh.fillStyle = '#808080'; gh.fillRect(0, 0, S, S);
  blotches(g, S, 120, S * 0.03, S * 0.16, rand, r => { const d = (r() - 0.5) * vary * 2; return `rgba(${rgb[0] + d},${rgb[1] + d},${rgb[2] + d * 0.9},.22)`; });
  blotches(gh, S, 240, 2, S * 0.05, rand, r => { const v = r() < 0.5 ? 0 : 255; return `rgba(${v},${v},${v},${0.06 + r() * 0.14})`; });
  speckle(g, S, speck, rand); speckle(gh, S, 26, rand);
  const out = { map: texOf(col, true, repeat), normalMap: texOf(normalFromHeight(hgt, bump), false, repeat), dispose() { this.map.dispose(); this.normalMap.dispose(); } };
  return out;
}

// Seamless ripples: sine waves with whole-number frequencies, so the normal map tiles
export function rippleNormals(repeat) {
  const S = 256, rand = rng(11), waves = [];
  for (let i = 0; i < 12; i++) waves.push([Math.ceil(rand() * 6) * (rand() < 0.5 ? -1 : 1), Math.ceil(rand() * 6), rand() * 6.28, 1 / (2 + i * 0.5)]);
  const H = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let h = 0; for (const [fx, fy, p, a] of waves) h += Math.sin((x * fx + y * fy) / S * 6.2832 + p) * a;
    H[y * S + x] = h;
  }
  const data = new Uint8Array(S * S * 4), at = (x, y) => H[((y + S) % S) * S + ((x + S) % S)];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4;
    data[i] = 127 + (at(x - 1, y) - at(x + 1, y)) * 300; data[i + 1] = 127 + (at(x, y - 1) - at(x, y + 1)) * 300; data[i + 2] = 255; data[i + 3] = 255;
  }
  const t = new THREE.DataTexture(data, S, S); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.needsUpdate = true;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}

// Sparks, confetti, fireworks: one pool of glowing points in a single draw call
export function makeSparks(scene, N = 700, size = 0.3) {
  const c = document.createElement('canvas'); c.width = c.height = 32;
  const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
  const geo = new THREE.BufferGeometry();
  const P = new THREE.BufferAttribute(new Float32Array(N * 3), 3), C = new THREE.BufferAttribute(new Float32Array(N * 3), 3);
  geo.setAttribute('position', P); geo.setAttribute('color', C);
  const tex = new THREE.CanvasTexture(c);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: tex, size, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  pts.frustumCulled = false; pts.renderOrder = 8; scene.add(pts);
  const drops = Array.from({ length: N }, () => ({ life: 0, max: 1, g: 6, v: new THREE.Vector3(), p: new THREE.Vector3(0, -99, 0), c: new THREE.Color() }));
  let at = 0;
  return {
    burst(pos, n, cols, speed = 2.2, life = 0.8, gravity = 6) {
      for (let i = 0; i < n; i++) {
        const d = drops[at = (at + 1) % N];
        d.p.copy(pos);
        d.v.set(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).normalize().multiplyScalar(speed * (0.5 + Math.random()));
        d.life = d.max = life * (0.7 + Math.random() * 0.5); d.g = gravity; d.c.set(cols[i % cols.length]);
      }
    },
    update(dt) {
      drops.forEach((d, i) => {
        if (d.life > 0) { d.life -= dt; d.v.y -= d.g * dt; d.p.addScaledVector(d.v, dt); }
        const b = d.life > 0 ? Math.min(1, d.life / d.max * 1.6) : 0;
        P.setXYZ(i, d.p.x, d.p.y, d.p.z); C.setXYZ(i, d.c.r * b, d.c.g * b, d.c.b * b);
      });
      P.needsUpdate = C.needsUpdate = true;
    },
    dispose() { geo.dispose(); pts.material.dispose(); tex.dispose(); },
  };
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

// Soft shade where walls meet the floor and each other: the darkening real rooms have in their corners.
// x0..x1, z0..z1 is the room; walls lists which sides are real ('n', 's', 'e', 'w').
let aoTex = null;
export function roomShade(x0, x1, z0, z1, h, walls = 'nsew', size = 1.5, strength = 0.55) {
  if (!aoTex) {
    const [c, g] = canvas2d(4, 64), gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.35, 'rgba(0,0,0,.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
    aoTex = new THREE.CanvasTexture(c);
  }
  const mat = new THREE.MeshBasicMaterial({ map: aoTex, transparent: true, opacity: strength, depthWrite: false, color: 0x120a04, fog: false, side: THREE.DoubleSide });
  const G = new THREE.Group();
  // a strip starting at the crease and fading out across a surface
  const strip = (ax, ay, az, bx, by, bz, ox, oy, oz) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([ax, ay, az, bx, by, bz, bx + ox, by + oy, bz + oz, ax + ox, ay + oy, az + oz], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const m = new THREE.Mesh(geo, mat); m.renderOrder = 1; G.add(m);
  };
  const e = 0.012;
  if (walls.includes('n')) { strip(x0, e, z0 + e, x1, e, z0 + e, 0, 0, size); strip(x0, e, z0 + e, x1, e, z0 + e, 0, size, 0); }
  if (walls.includes('s')) { strip(x0, e, z1 - e, x1, e, z1 - e, 0, 0, -size); strip(x0, e, z1 - e, x1, e, z1 - e, 0, size, 0); }
  if (walls.includes('w')) { strip(x0 + e, e, z0, x0 + e, e, z1, size, 0, 0); strip(x0 + e, e, z0, x0 + e, e, z1, 0, size, 0); }
  if (walls.includes('e')) { strip(x1 - e, e, z0, x1 - e, e, z1, -size, 0, 0); strip(x1 - e, e, z0, x1 - e, e, z1, 0, size, 0); }
  // upright corners, and under the ceiling
  const cn = [['n', 'w', x0, z0, 1, 1], ['n', 'e', x1, z0, -1, 1], ['s', 'w', x0, z1, 1, -1], ['s', 'e', x1, z1, -1, -1]];
  for (const [a, b, x, z, sx, sz] of cn) if (walls.includes(a) && walls.includes(b)) {
    strip(x, 0, z + sz * e, x, h, z + sz * e, sx * size * 0.8, 0, 0);
    strip(x + sx * e, 0, z, x + sx * e, h, z, 0, 0, sz * size * 0.8);
  }
  if (walls.includes('n')) strip(x0, h, z0 + e, x1, h, z0 + e, 0, -size * 0.8, 0);
  if (walls.includes('w')) strip(x0 + e, h, z0, x0 + e, h, z1, 0, -size * 0.8, 0);
  if (walls.includes('e')) strip(x1 - e, h, z0, x1 - e, h, z1, 0, -size * 0.8, 0);
  G.userData.dispose = () => { G.traverse(o => o.geometry?.dispose()); mat.dispose(); };
  return G;
}

// Sunlight through a window: the bright panes thrown on the floor, and a faint shaft of light in the air.
// win = [x0, x1, yBottom, yTop, z] on a wall facing +z; slope = [dx, dz] the sun moves per unit it falls.
export function sunbeam({ win, slope, color = 0xffd9a0, floor = 0.5, air = 0.13, panes = [2, 3] }) {
  const [x0, x1, y0, y1, z] = win, [dx, dz] = slope;
  const G = new THREE.Group();
  const onFloor = (x, y) => [x + dx * y, 0.02, z + dz * y];
  // the patch on the floor, with the window bars in it
  const [c, g] = canvas2d(256, 256);
  g.filter = 'blur(5px)'; g.fillStyle = '#fff';
  const pw = 256 / panes[0], ph = 256 / panes[1];
  for (let i = 0; i < panes[0]; i++) for (let j = 0; j < panes[1]; j++) g.fillRect(i * pw + 8, j * ph + 8, pw - 16, ph - 16);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const pts = [onFloor(x0, y0), onFloor(x1, y0), onFloor(x1, y1), onFloor(x0, y1)].flat();
  const patch = new THREE.BufferGeometry();
  patch.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  patch.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  patch.setIndex([0, 2, 1, 0, 3, 2]);
  const pm = new THREE.MeshBasicMaterial({ map: t, color, transparent: true, opacity: floor, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide });
  const pmesh = new THREE.Mesh(patch, pm); pmesh.renderOrder = 2; G.add(pmesh);
  // the shaft: fades from the window down to the floor
  const [c2, g2] = canvas2d(4, 64), gr = g2.createLinearGradient(0, 0, 0, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g2.fillStyle = gr; g2.fillRect(0, 0, 4, 64);
  const t2 = new THREE.CanvasTexture(c2);
  const am = new THREE.MeshBasicMaterial({ map: t2, color, transparent: true, opacity: air, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide });
  for (const [xa, ya] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [(x0 + x1) / 2, (y0 + y1) / 2]]) {
    // sheets running from the window's edge along the sun's direction
    const geo = new THREE.BufferGeometry(), w = (x1 - x0) * 0.5, A = [xa - w * 0.5, ya, z], B = [xa + w * 0.5, ya, z], C = onFloor(xa + w * 0.5, ya), D = onFloor(xa - w * 0.5, ya);
    geo.setAttribute('position', new THREE.Float32BufferAttribute([...A, ...B, ...C, ...D], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0], 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const m = new THREE.Mesh(geo, am); m.renderOrder = 3; G.add(m);
  }
  G.userData.dispose = () => { G.traverse(o => o.geometry?.dispose()); pm.dispose(); am.dispose(); t.dispose(); t2.dispose(); };
  return G;
}

// Dust drifting in the light
export function dustMotes(scene, [x0, x1, y0, y1, z0, z1], n = 70, color = 0xffe6c0, size = 0.05) {
  const rand = rng(77), base = [], geo = new THREE.BufferGeometry(), P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) base.push([x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0), z0 + rand() * (z1 - z0), rand() * 6]);
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  const [c, g] = canvas2d(16, 16), gr = g.createRadialGradient(8, 8, 0, 8, 8, 8);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 16, 16);
  const tex = new THREE.CanvasTexture(c);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ map: tex, size, color, transparent: true, opacity: 0.75, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  pts.frustumCulled = false; pts.renderOrder = 4; scene.add(pts);
  return {
    update(t) {
      base.forEach(([x, y, z, p], i) => { P[i * 3] = x + Math.sin(t * 0.21 + p) * 0.35; P[i * 3 + 1] = y + Math.sin(t * 0.13 + p * 2) * 0.3; P[i * 3 + 2] = z + Math.cos(t * 0.17 + p) * 0.35; });
      geo.attributes.position.needsUpdate = true;
    },
    dispose() { geo.dispose(); pts.material.dispose(); tex.dispose(); },
  };
}

// ---------- the colour finish that goes after tone mapping ----------
export const GradeShader = {
  uniforms: { tDiffuse: { value: null }, contrast: { value: 1.12 }, saturation: { value: 1.12 }, vignette: { value: 0.34 }, tint: { value: new THREE.Vector3(1.01, 1, 0.975) } },
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
