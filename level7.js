import { THREE, mesh, canvasTex, makeSky, Timeline, sound } from './engine.js';
import { rng, tileSet, foliageSet, worldBox, contactShadow, ownMaterials, skyEnvironment, cloudSprite } from './gfx.js';
import { makeFigure } from './character.js';
import { model } from './models.js';

// Level 7 · a family day at the pool, 1989
// Dad stands in the water; one by one the four kids leap off the edge. Swipe (or tap left/right) to move Dad
// under the splash target and catch each child. Every catch is a cheer; misses just splash. Nobody fails.

const LANES = [-2.6, 0, 2.6];   // (narrow enough that Dad stays on a portrait phone's screen)
const JUMPS = 16;
const FLIGHT = 1.5;          // seconds in the air (shorter as the game goes on)
// the four children: [figure, height] — Karin the eldest, Idan, Tal and little Nir
const KIDS = [['karin', 2.5, 'קארין'], ['idan', 2.25, 'עידן'], ['tal', 1.9, 'טל'], ['nir', 1.6, 'ניר']];

const SUN = new THREE.Vector3(9, 12, -4);
const SKY = { top: '#2a78d4', mid: '#86c3ef', horizon: '#e4f2f6', sunDir: [SUN.x, SUN.y, SUN.z], sunColor: '#fff4d8', radius: 150 };
const WATER_Y = -0.35, W = 12, D = 8, DEPTH = 1.6, POOL_Z = 0.5;

// Seamless ripples: sine waves with whole-number frequencies, so the normal map tiles
function rippleNormals() {
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
  return t;
}

// The water surface: drawn in linear light, tone mapped later with everything else.
// Ripples bend the view; the sky and garden reflect in it, more at low angles (Fresnel); up to six splash rings spread out.
function makeWater(normals) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uTime: { value: 0 }, uNormals: { value: normals },
      uRipples: { value: Array.from({ length: 6 }, () => new THREE.Vector3(0, 0, -1)) },
      uDad: { value: new THREE.Vector2(0, 0) }, uHalf: { value: new THREE.Vector2(W / 2, D / 2) }, uCentre: { value: new THREE.Vector2(0, POOL_Z) },
    },
    vertexShader: 'varying vec3 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `precision highp float;
      uniform float uTime; uniform sampler2D uNormals; uniform vec3 uRipples[6]; uniform vec2 uDad, uHalf, uCentre; varying vec3 vP;
      vec3 sky(vec3 r){
        vec3 c = mix(vec3(.72,.86,.95), vec3(.10,.36,.78), smoothstep(.0, .75, r.y));
        // the far hedge and the trees, mirrored at a low angle
        return mix(vec3(.10,.20,.07), c, smoothstep(.06, .24, r.y));
      }
      void main(){
        vec2 p = vP.xz;
        vec2 a = texture2D(uNormals, p * .13 + uTime * vec2(.018, .011)).xy - .5;
        vec2 b = texture2D(uNormals, p * .31 - uTime * vec2(.024, .007)).xy - .5;
        vec2 c = texture2D(uNormals, p * .83 + uTime * vec2(-.03, .04)).xy - .5;
        vec2 d = a * .34 + b * .24 + c * .12;
        float foam = 0.;
        for (int i = 0; i < 6; i++) {
          float age = uRipples[i].z; if (age < 0.) continue;
          vec2 q = p - uRipples[i].xy; float r = length(q) + .001, front = age * 2.6;
          float fade = exp(-age * 1.15);
          d += q / r * sin((r - front) * 11.) * exp(-abs(r - front) * 2.4) * fade * .55;
          foam += smoothstep(.75, 0., abs(r - front * .55)) * exp(-age * 2.6);
        }
        // the water moves against Dad's body as he wades
        vec2 qd = p - uDad; float rd = length(qd) + .001;
        d += qd / rd * sin(rd * 13. - uTime * 3.2) * exp(-rd * 1.3) * .10;
        foam += smoothstep(1.05, .62, rd) * smoothstep(.45, .66, rd) * .6;
        foam *= .55 + 2.1 * max(c.x + b.y + .15, 0.);
        vec3 N = normalize(vec3(d.x, 1., d.y)), V = normalize(cameraPosition - vP);
        float F = .035 + .965 * pow(1. - max(dot(N, V), 0.), 5.);
        vec3 R = reflect(-V, N);
        // two tones: the pale water you see straight down and the deeper blue further away
        vec3 body = mix(vec3(.03,.42,.56), vec3(.015,.24,.42), smoothstep(.2, .85, 1. - V.y));
        vec3 col = mix(body, sky(R), clamp(F * 1.6, 0., .85));
        float alpha = mix(.58, .95, clamp(F * 2.2, 0., 1.));
        // the sun's sparkle (aimed so that it falls on the water the camera sees)
        float sp = pow(max(dot(R, normalize(vec3(.22, .62, -.75))), 0.), 240.);
        float sharp = pow(max(dot(R, normalize(vec3(-.3, .5, -.81))), 0.), 700.);
        col += vec3(1., .96, .86) * (sp * 1.5 + sharp * 6.);
        alpha = max(alpha, min(1., sp + sharp * 2.));
        col = mix(col, vec3(1.2), clamp(foam, 0., .85)); alpha = max(alpha, clamp(foam, 0., .92));
        // the dark line where the water meets the wall
        vec2 e = uHalf - abs(p - uCentre); float edge = min(e.x, e.y);
        col *= mix(.72, 1., smoothstep(0., .22, edge));
        gl_FragColor = vec4(col, alpha);
      }`,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat);
  water.rotation.x = -Math.PI / 2; water.renderOrder = 2;
  return water;
}

// The net of sunlight on the pool floor
function makeCaustics() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `precision highp float; uniform float uTime; varying vec2 vP;
      float net(vec2 uv, float t){
        vec2 p = mod(uv * 6.2832, 6.2832) - 250., i = p; float c = 1.;
        for (int n = 0; n < 3; n++) {
          float s = t * (1. - 3.5 / float(n + 1));
          i = p + vec2(cos(s - i.x) + sin(s + i.y), sin(s - i.y) + cos(s + i.x));
          c += 1. / length(vec2(p.x / (sin(i.x + s) / .005), p.y / (cos(i.y + s) / .005)));
        }
        c = 1.17 - pow(c / 3., 1.4);
        return pow(abs(c), 7.);
      }
      void main(){ gl_FragColor = vec4(vec3(.85, 1., 1.) * min(net(vP * .19, uTime * .55), 1.6) * .62, 1.); }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, D - 0.1), mat);
  m.rotation.x = -Math.PI / 2; m.renderOrder = 1;
  return m;
}

// hills far behind the garden, painted once
function makeHills() {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 512;
  const g = c.getContext('2d'), rand = rng(5);
  const ridge = (base, amp, col, f) => {
    const p = [rand() * 6, rand() * 6, rand() * 6];
    const at = x => base - amp * (Math.sin(x * f + p[0]) * 0.6 + Math.sin(x * f * 2.3 + p[1]) * 0.28 + Math.sin(x * f * 5.1 + p[2]) * 0.12);
    g.fillStyle = col; g.beginPath(); g.moveTo(0, 512);
    for (let x = 0; x <= 2048; x += 8) g.lineTo(x, at(x));
    g.lineTo(2048, 512); g.closePath(); g.fill();
    return at;
  };
  ridge(235, 60, '#b7cbd6', 0.004);
  ridge(310, 55, '#9db5a8', 0.0065);
  ridge(390, 38, '#71925f', 0.009);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const hills = new THREE.Mesh(new THREE.PlaneGeometry(420, 44), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, fog: false }));
  hills.position.set(0, 9, -120); hills.renderOrder = -1;
  return hills;
}

function stripes(a, b, n, w = 256, h = 16) {
  return canvasTex(w, h, (g, W2, H2) => { for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? b : a; g.fillRect(i * W2 / n, 0, W2 / n + 1, H2); } });
}

function buildPool(sets) {
  const g = new THREE.Group();
  const trees = [];
  const onDeck = (obj, x, z, rx, rz = rx, s = 0.5) => { const c = contactShadow(rx, rz, s); c.position.set(x, 0.012, z); obj.add(c); };

  // the deck: one tiled sheet with the pool cut out, so the tiles run true across it
  const deckShape = new THREE.Shape([[-20, -15], [20, -15], [20, 14], [-20, 14]].map(([x, y]) => new THREE.Vector2(x, y)));
  const zN = POOL_Z - D / 2, zS = POOL_Z + D / 2;
  deckShape.holes.push(new THREE.Path([[-W / 2, -zS], [-W / 2, -zN], [W / 2, -zN], [W / 2, -zS]].map(([x, y]) => new THREE.Vector2(x, y))));
  const deckGeo = new THREE.ShapeGeometry(deckShape);
  const stone = sets.stone;
  const deckMat = new THREE.MeshStandardMaterial({ map: stone.map, normalMap: stone.normalMap, roughnessMap: stone.roughnessMap, roughness: 1, envMapIntensity: 0.85, normalScale: new THREE.Vector2(0.7, 0.7) });
  const deck = new THREE.Mesh(deckGeo, deckMat); deck.rotation.x = -Math.PI / 2; deck.receiveShadow = true; g.add(deck);
  // the garden around the deck, and the hills beyond
  // (a frame around the deck: the grass must not run through the pool)
  const lawnShape = new THREE.Shape([[-210, -120], [210, -120], [210, 220], [-210, 220]].map(([x, y]) => new THREE.Vector2(x, y)));
  lawnShape.holes.push(new THREE.Path([[-19.9, -14.9], [-19.9, 13.9], [19.9, 13.9], [19.9, -14.9]].map(([x, y]) => new THREE.Vector2(x, y))));
  const grass = new THREE.Mesh(new THREE.ShapeGeometry(lawnShape), new THREE.MeshStandardMaterial({ map: sets.grass.map, normalMap: sets.grass.normalMap, roughness: 1, envMapIntensity: 0.5 }));
  sets.grass.map.repeat.set(1 / 6, 1 / 6); sets.grass.normalMap.repeat.set(1 / 6, 1 / 6);
  grass.rotation.x = -Math.PI / 2; grass.position.y = -0.05; grass.receiveShadow = true; g.add(grass);
  g.add(makeHills());
  for (const seed of [31, 32, 33, 34]) {
    const c = cloudSprite(seed), i = seed - 31;
    c.scale.set(70 + i * 12, 22 + i * 3, 1); c.position.set(-95 + i * 62, 24 + (i % 2) * 10, -135); c.renderOrder = -1;
    g.add(c); sets.clouds.push(c);
  }

  // the pool: a sunken box of small mosaic tiles, with a band of dark tiles at the waterline
  const mosaic = sets.mosaic;
  const blue = new THREE.MeshStandardMaterial({ map: mosaic.map, normalMap: mosaic.normalMap, roughnessMap: mosaic.roughnessMap, roughness: 1, envMapIntensity: 0.5 });
  const basin = new THREE.Group(); basin.position.set(0, 0, POOL_Z); g.add(basin);
  const part = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; basin.add(m); return m; };
  part(worldBox(W, 0.05, D, 1 / 1.6), blue, 0, -DEPTH, 0);
  for (const [w, d, x, z] of [[W, 0.1, 0, -D / 2], [W, 0.1, 0, D / 2], [0.1, D, -W / 2, 0], [0.1, D, W / 2, 0]]) part(worldBox(w, DEPTH, d, 1 / 1.6), blue, x, -DEPTH / 2, z);
  const line = new THREE.MeshStandardMaterial({ color: 0x173f73, roughness: 0.45, envMapIntensity: 0.4 });
  for (const x of [-LANES[2], 0, LANES[2]]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.3, D - 1.2), line); l.rotation.x = -Math.PI / 2; l.position.set(x, -DEPTH + 0.03, 0); l.receiveShadow = true; basin.add(l); }
  const band = new THREE.MeshStandardMaterial({ map: sets.band.map, normalMap: sets.band.normalMap, roughness: 0.25, envMapIntensity: 1 });
  for (const [w, d, x, z] of [[W, 0.04, 0, -D / 2 + 0.07], [W, 0.04, 0, D / 2 - 0.07], [0.04, D, -W / 2 + 0.07, 0], [0.04, D, W / 2 - 0.07, 0]]) part(worldBox(w, 0.42, d, 1 / 1.6), band, x, -0.22, z).castShadow = false;
  const caustics = makeCaustics(); caustics.position.y = -DEPTH + 0.05; basin.add(caustics);
  const water = makeWater(sets.ripples); water.position.y = WATER_Y; basin.add(water);
  // the stone lip of the pool
  const copingMat = new THREE.MeshStandardMaterial({ map: sets.coping.map, normalMap: sets.coping.normalMap, roughnessMap: sets.coping.roughnessMap, roughness: 1, envMapIntensity: 0.9 });
  for (const [w, d, x, z] of [[W + 1.3, 0.65, 0, -D / 2 - 0.27], [W + 1.3, 0.65, 0, D / 2 + 0.27], [0.65, D, -W / 2 - 0.27, 0], [0.65, D, W / 2 + 0.27, 0]]) part(worldBox(w, 0.14, d, 1 / 1.6), copingMat, x, 0.05, z);

  // lane ropes: floats in runs of red and white, all one draw call
  const floats = []; for (const x of [-1.5, 1.5]) for (let i = 0; i <= 24; i++) floats.push([x, -3.6 + i * 0.3, i % 6 < 3]);
  const rope = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshStandardMaterial({ roughness: 0.25, envMapIntensity: 1 }), floats.length);
  const M = new THREE.Matrix4(), col = new THREE.Color();
  floats.forEach(([x, z, red], i) => { M.setPosition(x, WATER_Y + 0.05, z); rope.setMatrixAt(i, M); rope.setColorAt(i, col.set(red ? 0xd8282c : 0xf6f4ee)); });
  rope.castShadow = true; basin.add(rope);

  // chrome ladder: the thing in the scene that shows off the reflections
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe8ecef, metalness: 1, roughness: 0.14, envMapIntensity: 1.4 });
  for (const x of [4.35, 5.05]) {
    const curve = new THREE.CatmullRomCurve3([[x, 0.05, D / 2 + 0.55], [x, 0.85, D / 2 + 0.45], [x, 1.1, D / 2 + 0.05], [x, 0.85, D / 2 - 0.3], [x, -1.3, D / 2 - 0.34]].map(p => new THREE.Vector3(...p)));
    part(new THREE.TubeGeometry(curve, 28, 0.045, 8), chrome, 0, 0, 0);
  }
  for (const y of [-0.55, -1.05]) { const r = part(new THREE.CylinderGeometry(0.035, 0.035, 0.7, 8), chrome, 4.7, y, D / 2 - 0.34); r.rotation.z = Math.PI / 2; }

  // toys on the water
  const ring = part(new THREE.TorusGeometry(0.55, 0.2, 12, 28), new THREE.MeshStandardMaterial({ map: stripes('#ee4b35', '#fbf6ea', 12), roughness: 0.28, envMapIntensity: 1 }), -4.5, WATER_Y + 0.04, 2.2);
  ring.rotation.x = Math.PI / 2;
  const ball = part(new THREE.SphereGeometry(0.34, 20, 14), new THREE.MeshStandardMaterial({ map: stripes('#f6c932', '#2e8ad6', 6), roughness: 0.2, envMapIntensity: 1 }), 4.4, WATER_Y + 0.22, -1.6);
  g.userData.toys = [ring, ball];

  // loungers and trees around the deck
  for (const [x, z, r] of [[-9.5, -3, 0.4], [-9.5, 1.5, 0.2], [9.5, -2, -0.4]]) { const l = model('lounger'); if (l) { l.position.set(x, 0, z); l.rotation.y = r + Math.PI / 2 * Math.sign(x); g.add(l); onDeck(g, x, z, 1.5, 1.9, 0.45); } }
  for (const [x, z, s] of [[-12, -9, 1], [12, -9, 1], [-15, 2, 1], [15, 3, 1], [-7, -12.5, 1.25], [6.5, -13, 1.35], [-1.5, -15, 1.15], [-24, -20, 1.5], [-13, -24, 1.7], [15, -22, 1.6], [26, -19, 1.5]]) {
    const t = model('tree'); if (t) { t.position.set(x, 0, z); t.scale.multiplyScalar(s); g.add(t); trees.push(t); if (z < -15.5) t.traverse(o => { o.castShadow = false; }); if (z > -14.5) onDeck(g, x, z, 1.1 * s, 1.1 * s, 0.45); }
  }
  g.userData.trees = trees;

  // a clipped hedge all round the garden: leafy clumps, not a green box
  const hedgeLen = [[-20, 20, -14.3, 'x'], [-14, 15, -20.4, 'z'], [-14, 15, 20.4, 'z']];
  const clumps = [], cr = rng(9);
  for (const [a, b, at, axis] of hedgeLen) for (let v = a; v <= b; v += 0.8) for (const y of [0.55, 1.45]) {
    const off = (cr() - 0.5) * 0.3;
    clumps.push(axis === 'x' ? [v, y + cr() * 0.25, at + off] : [at + off, y + cr() * 0.25, v]);
  }
  const hedge = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ map: sets.leaves.map, normalMap: sets.leaves.normalMap, roughness: 0.92, envMapIntensity: 0.55 }), clumps.length);
  const q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  clumps.forEach(([x, y, z], i) => {
    const r = 0.72 + cr() * 0.3;
    M.compose(pos.set(x, y, z), q.setFromEuler(e.set(cr() * 6, cr() * 6, cr() * 6)), sc.set(r, r, r));
    hedge.setMatrixAt(i, M);
    hedge.setColorAt(i, col.setHSL(0.27 + cr() * 0.04, 0.45, 0.58 + cr() * 0.2));
  });
  hedge.receiveShadow = true; g.add(hedge);
  const house = model('houseA'); if (house) { house.position.set(3, 0, -21); house.traverse(o => { o.castShadow = false; }); g.add(house); }

  // sun umbrellas by the loungers, with striped canvas and a chrome pole
  const canvasA = new THREE.MeshStandardMaterial({ map: stripes('#e2533e', '#f7ecd8', 16), roughness: 0.75, side: THREE.DoubleSide, envMapIntensity: 0.7 });
  const canvasB = new THREE.MeshStandardMaterial({ map: stripes('#2f7fb8', '#f7f3e8', 16), roughness: 0.75, side: THREE.DoubleSide, envMapIntensity: 0.7 });
  for (const [x, z, k] of [[-9.6, -0.8, 0], [9.6, 0.2, 1], [-4, -7, 1], [4.5, -7.5, 0]]) {
    const u = new THREE.Group(); u.position.set(x, 0, z);
    u.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.2, 10), chrome, 0, 1.6, 0));
    u.add(mesh(new THREE.ConeGeometry(1.9, 0.7, 16, 1, true), k ? canvasB : canvasA, 0, 3.2, 0));
    g.add(u); onDeck(g, x, z, 0.5, 0.5, 0.6);
  }

  // the edge the kids jump from: a block of the same stone, with a soft shadow where it meets the deck
  const edge = new THREE.Mesh(worldBox(10.8, 0.5, 1.6, 1 / 1.6), copingMat);
  edge.position.set(0, 0.25, -D / 2 - 0.7 + 0.5); edge.castShadow = edge.receiveShadow = true; g.add(edge);
  onDeck(g, 0, -D / 2 - 0.2, 5.9, 1.25, 0.5);

  Object.assign(g.userData, { water, caustics });
  return g;
}

export class Level7 {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xbfe2f6);
    this.scene.fog = new THREE.Fog(0xcfe9f8, 80, 300);
    this.scene.add(makeSky(SKY));
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 300);
    this.t = 0;
    this.paused = false;
    this.aspect = 1;
    this.phase = 'ready';
    this.shake = 0;
    // the polished finish (main.js): sharp edges, a soft glow on the sparkles, a colour grade
    this.look = { exposure: 0.78, bloom: [0.2, 0.55, 1.35] };
    this.envTarget = skyEnvironment(SKY);
    this.scene.environment = this.envTarget.texture;

    this.scene.add(new THREE.HemisphereLight(0xe8ecf4, 0xb09a78, 0.55));
    const sun = this.sun = new THREE.DirectionalLight(0xfff0d4, 3.7); sun.position.copy(SUN);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.radius = 3; sun.shadow.normalBias = 0.03;
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 20, bottom: -20, near: 1, far: 50 });
    this.scene.add(sun);
    // the sky's soft light on the faces turned toward the camera
    const fill = new THREE.DirectionalLight(0xcfe4ff, 0.7); fill.position.set(-5, 5, 12); this.scene.add(fill);

    const sets = this.sets = {
      stone: tileSet({ tiles: 4, rgb: [205, 188, 158], vary: 16, grout: '#8a7f6c', groutW: 5, rough: 0.6, seed: 7 }).scale(3.2),
      coping: tileSet({ tiles: 2, rgb: [226, 214, 192], vary: 8, grout: '#a89c88', groutW: 3, rough: 0.55, seed: 13 }),
      mosaic: tileSet({ tiles: 10, rgb: [52, 158, 196], vary: 34, grout: '#b7dde4', groutW: 3, rough: 0.3, stone: false, seed: 17 }),
      band: tileSet({ tiles: 10, rgb: [20, 62, 112], vary: 26, grout: '#8ab2c0', groutW: 3, rough: 0.2, stone: false, seed: 19 }),
      leaves: foliageSet({ seed: 3 }),
      grass: foliageSet({ dark: [58, 96, 38], light: [128, 168, 76], dabs: 2400, dab: 4, seed: 4 }),
      ripples: rippleNormals(),
      clouds: [],
    };
    const pool = this.pool = buildPool(sets);
    this.scene.add(pool);

    this.dad = makeFigure('father', 3.6);
    if (this.dad) { this.dad.rotation.y = Math.PI; this.scene.add(this.dad); }
    this.kids = KIDS.map(([k, h, name]) => { const f = makeFigure(k, h); if (f) { f.userData.name = name; this.scene.add(f); } return f; }).filter(Boolean);
    // where the next child will land: a ring on the water
    this.marker = mesh(new THREE.RingGeometry(0.6, 0.85, 32), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2; this.marker.castShadow = false; this.marker.renderOrder = 3; this.scene.add(this.marker);
    // a soft shadow under each child waiting on the edge
    this.kidShadows = this.kids.map(() => { const c = contactShadow(0.55, 0.55, 0.55); this.scene.add(c); return c; });
    this.makeSpray();
    this.ownMats = ownMaterials(this.scene, 0.7);
    this.nextRipple = 0;
    this.startRun();
  }

  startRun() {
    this.phase = 'run';
    this.ending = false;
    this.tl = new Timeline();
    this.lane = 1; this.dx = 0;
    this.jumpsDone = 0; this.caught = 0;
    this.leap = null; this.wait = 1.2;
    // the kids wait their turn on the edge
    this.kids.forEach((k, i) => { k.position.set(-4.5 + i * 3, 0.5, -3.9); k.rotation.y = 0; k.visible = true; k.userData.state = 'edge'; this.kidShadows[i].position.set(k.position.x, 0.515, k.position.z); });
    this.app.hud({ stamps: 0, progress: 0 });
  }

  // swipes and taps move Dad between the three spots
  move(dir) {
    if (this.phase !== 'run') return;
    const nl = Math.max(0, Math.min(2, this.lane + dir));
    if (nl !== this.lane) { this.lane = nl; sound.tone(520 + dir * 60, 0.06, 'sine', 0.1); }
  }
  jump() {}
  // a plain tap moves Dad toward that side of the screen
  tapAt(fx) { this.move(fx < 0.5 ? -1 : 1); }
  onKey(code) {
    if (code === 'ArrowLeft' || code === 'KeyA') { this.move(-1); return true; }
    if (code === 'ArrowRight' || code === 'KeyD') { this.move(1); return true; }
    return false;
  }

  launch() {
    const kid = this.kids[this.jumpsDone % this.kids.length];
    const lane = Math.floor(Math.random() * 3);
    const flight = Math.max(0.95, FLIGHT - this.jumpsDone * 0.035);
    this.leap = { kid, lane, t: 0, flight, from: kid.position.clone() };
    kid.userData.state = 'air';
    this.marker.position.set(LANES[lane], WATER_Y + 0.02, 0.6);
    sound.tone(990, 0.08, 'triangle', 0.08);
  }

  land() {
    const J = this.leap;
    const got = this.lane === J.lane;
    this.jumpsDone++;
    this.splash(LANES[J.lane], got ? 6 : 14);
    if (got) {
      this.caught++;
      sound.tone(880, 0.12, 'sine', 0.12); setTimeout(() => sound.tone(1320, 0.18, 'sine', 0.1), 100);
      this.app.toast(`תפסת את ${J.kid.userData.name}!`);
      this.app.hud({ stamps: this.caught });
      this.cheer = 1.2;
      this.shake = 1;
    } else {
      sound.tone(200, 0.25, 'sawtooth', 0.05);
    }
    // back to the edge for another turn
    const kid = J.kid;
    this.tl.add(0.9, 0.01, null, () => { kid.position.copy(J.from); kid.userData.state = 'edge'; });
    this.leap = null;
    this.wait = 0.55;
    this.app.hud({ progress: this.jumpsDone / JUMPS });
    if (this.jumpsDone >= JUMPS) this.finish();
  }

  // droplets: one pool of additive sprites, fading to black in their vertex colours
  makeSpray() {
    const N = 220, c = document.createElement('canvas'); c.width = c.height = 32;
    const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.spray = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(c), size: 0.5, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    this.spray.frustumCulled = false; this.spray.renderOrder = 4; this.scene.add(this.spray);
    this.drops = Array.from({ length: N }, () => ({ life: 0, max: 1, v: new THREE.Vector3(), p: new THREE.Vector3(0, -50, 0) }));
    this.dropAt = 0;
  }

  splash(x, n) {
    for (let i = 0; i < n * 5; i++) {
      const d = this.drops[this.dropAt = (this.dropAt + 1) % this.drops.length];
      const a = Math.random() * 6.283, r = Math.random(), up = 3.5 + Math.random() * 5 * (1 - r * 0.6);
      d.p.set(x + Math.cos(a) * r * 0.55, WATER_Y + 0.05, 0.6 + Math.sin(a) * r * 0.55);
      d.v.set(Math.cos(a) * (0.8 + r * 2.4), up, Math.sin(a) * (0.8 + r * 2.4));
      d.life = d.max = 0.55 + Math.random() * 0.6;
    }
    const R = this.pool.userData.water.material.uniforms.uRipples.value[this.nextRipple = (this.nextRipple + 1) % 6];
    R.set(x, 0.6, 0);
  }

  // a phone that can't keep up (main.js) trades the crisp shadows for frame rate
  lowerQuality() {
    this.sun.shadow.mapSize.set(1024, 1024); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null;
  }

  finish() {
    this.phase = 'done'; this.ending = true;
    this.marker.visible = false;
    sound.fanfare();
    this.tl.add(3.2, 0.01, null, () => this.app.levelComplete(this.result()));
  }

  result() {
    const stars = this.caught >= 14 ? 3 : this.caught >= 10 ? 2 : 1;
    return { stars, summary: `תפסת ${this.caught} מתוך ${JUMPS} קפיצות.` };
  }

  resize(aspect) {
    this.aspect = aspect;
    const c = this.camera;
    c.aspect = aspect;
    c.fov = aspect < 1 ? 70 : 48;
    // a phone: closer and lower, so the pool fills the screen and the garden shows behind the kids
    c.position.set(0, aspect < 1 ? 6.2 : 5.5, aspect < 1 ? 11.5 : 12.5);
    c.lookAt(0, aspect < 1 ? 1.4 : 0.85, aspect < 1 ? -2.5 : -1.2);
    c.updateProjectionMatrix();
    this.camBase = c.position.clone();
  }

  update(dt) {
    if (this.paused) return;
    this.t += dt;
    this.tl.update(dt);
    const { water, caustics, toys, trees } = this.pool.userData, U = water.material.uniforms;
    U.uTime.value = caustics.material.uniforms.uTime.value = this.t;
    for (const R of U.uRipples.value) if (R.z >= 0) { R.z += dt; if (R.z > 4) R.z = -1; }
    U.uDad.value.set(this.dx ?? 0, 0.9);
    toys[0].position.y = WATER_Y + 0.04 + Math.sin(this.t * 1.3) * 0.025; toys[0].rotation.z += dt * 0.06;
    toys[1].position.y = WATER_Y + 0.22 + Math.sin(this.t * 1.7 + 1) * 0.035; toys[1].rotation.x += dt * 0.12;
    trees.forEach((t, i) => { t.rotation.z = Math.sin(this.t * 0.8 + i * 1.7) * 0.012; t.rotation.x = Math.sin(this.t * 0.6 + i) * 0.008; });
    for (const c of this.sets.clouds) { c.position.x += dt * 0.5; if (c.position.x > 210) c.position.x = -210; }
    // the camera breathes a little, and bumps when Dad catches someone
    if (this.camBase) {
      this.shake = Math.max(0, this.shake - dt * 3.2);
      this.camera.position.copy(this.camBase);
      this.camera.position.x += Math.sin(this.t * 0.37) * 0.07;
      this.camera.position.y += Math.sin(this.t * 0.51) * 0.05 + Math.sin(this.t * 46) * 0.05 * this.shake * this.shake;
    }
    // Dad wades to his spot (waist-deep: the water hides his legs)
    this.dx += (LANES[this.lane] - this.dx) * Math.min(1, dt * 9);
    if (this.dad) {
      this.dad.position.set(this.dx, -1.25, 0.9);
      this.cheer = Math.max(0, (this.cheer || 0) - dt);
      this.dad.userData.animate(this.t, this.phase === 'done' ? 'cheer' : this.cheer > 0 ? 'cheer' : 'idle');
    }
    if (this.phase === 'run') {
      if (!this.leap) { this.wait -= dt; if (this.wait <= 0 && this.kids.length) this.launch(); }
      else {
        const J = this.leap; J.t += dt;
        const k = Math.min(1, J.t / J.flight);
        const tx = LANES[J.lane], tz = 0.6;
        J.kid.position.set(J.from.x + (tx - J.from.x) * k, J.from.y + Math.sin(k * Math.PI) * 4.2 - k * 1.1, J.from.z + (tz - J.from.z) * k);
        J.kid.rotation.y = 0;
        this.marker.material.opacity = 0.5 + Math.sin(this.t * 10) * 0.3;
        if (k >= 1) this.land();
      }
    }
    for (const kid of this.kids) {
      const st = kid.userData.state;
      kid.userData.animate(this.t + kid.position.x, this.phase === 'done' ? 'cheer' : st === 'air' ? 'jump' : 'idle');
    }
    this.kids.forEach((k, i) => { this.kidShadows[i].visible = k.userData.state === 'edge'; });
    const P = this.spray.geometry.attributes.position, C = this.spray.geometry.attributes.color;
    this.drops.forEach((d, i) => {
      if (d.life > 0) { d.life -= dt; d.v.y -= 13 * dt; d.p.addScaledVector(d.v, dt); if (d.p.y < WATER_Y) d.life = 0; }
      const b = d.life > 0 ? Math.min(1, d.life / d.max * 1.8) * 0.9 : 0;
      P.setXYZ(i, d.p.x, d.p.y, d.p.z); C.setXYZ(i, b, b, b);
    });
    P.needsUpdate = C.needsUpdate = true;
  }

  dispose() {
    this.scene.traverse(o => {
      if (o.geometry && !o.userData.keep) o.geometry.dispose();
      if (o.isInstancedMesh) o.dispose();
    });
    this.envTarget.dispose();
    this.ownMats.forEach(m => m.dispose());
    const S = this.sets;
    for (const k of ['stone', 'coping', 'mosaic', 'band', 'leaves', 'grass']) S[k].dispose();
    S.ripples.dispose();
    S.clouds.forEach(c => { c.material.map.dispose(); c.material.dispose(); });
    this.spray.material.map.dispose(); this.spray.material.dispose();
  }
}
