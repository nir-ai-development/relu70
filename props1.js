import { THREE, paint, mesh, canvasTex, photoTex, makeSky } from './engine.js';
import { model } from './models.js';

// Level 1 scenery and props: the Avraham flat in Piatra Neamț, the street to the port, and the ship.
// Sculpted Meshy models are used where they exist; the hand-built versions are fallbacks.

const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

// ---------- textures ----------
function grain(g, w, h, n, alpha) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${alpha * rnd()})`;
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}

export const rugTex = () => canvasTex(512, 384, (g, w, h) => {
  // a Romanian folk rug: red field, ivory and navy borders, stepped diamond medallions
  g.fillStyle = '#8a3a30'; g.fillRect(0, 0, w, h);
  const band = (inset, col, wd) => { g.strokeStyle = col; g.lineWidth = wd; g.strokeRect(inset, inset, w - inset * 2, h - inset * 2); };
  band(10, '#e6d6b4', 14); band(30, '#34405e', 14); band(48, '#c49a4a', 5);
  g.fillStyle = '#e6d6b4';
  for (let x = 40; x < w - 30; x += 22) { g.beginPath(); g.moveTo(x, 30); g.lineTo(x + 11, 20); g.lineTo(x + 22, 30); g.lineTo(x + 11, 40); g.fill(); g.beginPath(); g.moveTo(x, h - 30); g.lineTo(x + 11, h - 20); g.lineTo(x + 22, h - 30); g.lineTo(x + 11, h - 40); g.fill(); }
  const diamond = (cx, cy, r, cols) => cols.forEach((c, i) => {
    const rr = r * (1 - i / cols.length); g.fillStyle = c;
    g.beginPath(); g.moveTo(cx, cy - rr); g.lineTo(cx + rr * 1.3, cy); g.lineTo(cx, cy + rr); g.lineTo(cx - rr * 1.3, cy); g.fill();
  });
  diamond(w / 2, h / 2, 110, ['#34405e', '#e6d6b4', '#a8483c', '#c49a4a', '#34405e']);
  for (const [x, y] of [[110, 110], [w - 110, 110], [110, h - 110], [w - 110, h - 110]]) diamond(x, y, 38, ['#c49a4a', '#34405e', '#e6d6b4']);
  // woven wool: fine cross-hatching and fuzz
  for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.05})`; g.fillRect(0, y, w, 1); }
  for (let x = 0; x < w; x += 3) { g.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.03})`; g.fillRect(x, 0, 1, h); }
  grain(g, w, h, 9000, 0.16);
});

export const cobbleTex = () => canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#3e3a34'; g.fillRect(0, 0, w, h);
  const rows = 12, size = h / rows;
  for (let r = 0; r < rows; r++) for (let c = -1; c < 11; c++) {
    const sw = size * (0.9 + rnd() * 0.25), x = c * size * 1.05 + (r % 2) * size * 0.5 + rnd() * 4, y = r * size + 2;
    const v = 92 + rnd() * 42;
    const gr = g.createRadialGradient(x + sw * 0.35, y + size * 0.3, 2, x + sw / 2, y + size / 2, sw * 0.7);
    gr.addColorStop(0, `rgb(${v + 30},${v + 22},${v + 10})`); gr.addColorStop(1, `rgb(${v - 30},${v - 34},${v - 40})`);
    g.fillStyle = gr;
    g.beginPath(); g.roundRect(x + 2, y, sw - 4, size - 5, size * 0.35); g.fill();
  }
  grain(g, w, h, 5000, 0.1);
}, [1.6, 55]);

export const slabTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#c9bea7'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 64) for (let x = (y / 64 % 2) * 32; x < w + 64; x += 64) {
    const v = 190 + rnd() * 25; g.fillStyle = `rgb(${v},${v - 8},${v - 24})`; g.fillRect(x + 2, y + 2, 60, 60);
  }
  grain(g, w, h, 2500, 0.08);
}, [1, 70]);

export const grassTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#7da857'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 2500; i++) {
    const v = rnd(); g.fillStyle = v < 0.5 ? 'rgba(60,110,40,.35)' : 'rgba(170,200,100,.3)';
    g.fillRect(rnd() * w, rnd() * h, 2, 4);
  }
}, [60, 60]);

export const concreteTex = () => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = '#9b9c98'; g.fillRect(0, 0, w, h);
  grain(g, w, h, 6000, 0.12);
  g.fillStyle = 'rgba(40,40,40,.35)'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h);
}, [12, 8]);

const stampTex = (hue, label) => canvasTex(128, 152, (g, w, h) => {
  g.fillStyle = '#fffdf4'; g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-out';
  for (let x = 0; x <= w; x += 16) { g.beginPath(); g.arc(x, 0, 6, 0, 7); g.arc(x, h, 6, 0, 7); g.fill(); }
  for (let y = 0; y <= h; y += 16) { g.beginPath(); g.arc(0, y, 6, 0, 7); g.arc(w, y, 6, 0, 7); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  g.fillStyle = hue; g.fillRect(14, 14, w - 28, h - 28);
  g.fillStyle = '#fffdf4'; g.font = 'bold 22px Courier Prime, monospace'; g.textAlign = 'center';
  g.fillText(label, w / 2, 44);
  g.font = '50px serif'; g.fillText('⚓', w / 2, 102);
  g.font = 'bold 18px Courier Prime, monospace'; g.fillText('1958', w / 2, 128);
});
const signTex = (lines, bg = '#1f4e9c') => canvasTex(512, 192, (g, w, h) => {
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 54px Courier Prime, Courier New, monospace'; g.fillText(lines[0], w / 2, lines[1] ? 70 : h / 2);
  if (lines[1]) { g.font = 'bold 40px Courier Prime, Courier New, monospace'; g.fillText(lines[1], w / 2, 132); }
  grain(g, w, h, 1500, 0.08);
});
const mountainPainting = () => canvasTex(512, 320, (g, w, h) => {
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#8fbce6'); gr.addColorStop(0.7, '#f7dcb6'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  const ridge = (col, base, amp, seed) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, h); for (let x = 0; x <= w; x += 6) g.lineTo(x, base - Math.abs(Math.sin(x * 0.011 + seed)) * amp - Math.sin(x * 0.04 + seed) * 10); g.lineTo(w, h); g.fill(); };
  ridge('#9db3b5', 190, 120, 1); ridge('#6f9a74', 245, 70, 3); ridge('#4b7550', 295, 30, 5);
  g.fillStyle = '#e9e1d2'; g.fillRect(350, 190, 26, 70); g.fillStyle = '#7a3b2a'; g.beginPath(); g.moveTo(344, 192); g.lineTo(363, 150); g.lineTo(382, 192); g.fill();
});

// ---------- the room ----------
// The Avraham flat in Piatra Neamț: a three-walled stage set (back, left, right) seen from the open front.
// Walls and floor use sharp seamless painted textures; the furniture is sculpted Meshy models.
export const ROOM = { w: 10, d: 8, h: 5.4 };   // floor spans x ±5, z -4..+4

const tiled = (url, rx, ry) => {
  const t = photoTex(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8;
  return t;
};

export function buildRoom() {
  const room = new THREE.Group();
  const { w, d, h } = ROOM;
  const floor = mesh(new THREE.PlaneGeometry(w, d), paint(0xe0cdb4, { map: tiled('assets/tex_floor.jpg', w / 2.6, d / 2.6), roughness: 0.55 }), 0, 0, 0);
  floor.rotation.x = -Math.PI / 2; floor.castShadow = false; room.add(floor);
  // the floor's front edge, so the stage reads as a solid slab
  room.add(mesh(new THREE.BoxGeometry(w + 0.3, 0.35, 0.3), paint(0x5a3a22, { roughness: 0.6 }), 0, -0.17, d / 2));

  const PANEL_H = 1.7, PANEL_W = 1.7;
  const trim = paint(0x4a2c1a, { roughness: 0.45 });
  const cream = paint(0xf1e6cf, { roughness: 0.6 });
  const wall = (len, x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry;
    const paper = mesh(new THREE.PlaneGeometry(len, h - PANEL_H), paint(0xffffff, { map: tiled('assets/tex_wall.jpg', len / 1.8, (h - PANEL_H) / 1.8), roughness: 0.85 }), 0, PANEL_H + (h - PANEL_H) / 2, 0);
    paper.castShadow = false; g.add(paper);
    const panel = mesh(new THREE.PlaneGeometry(len, PANEL_H), paint(0xffffff, { map: tiled('assets/tex_panel.jpg', len / PANEL_W, 1), roughness: 0.45 }), 0, PANEL_H / 2, 0.02);
    panel.castShadow = false; g.add(panel);
    g.add(mesh(new THREE.BoxGeometry(len, 0.12, 0.14), trim, 0, PANEL_H, 0.07));       // chair rail
    g.add(mesh(new THREE.BoxGeometry(len, 0.2, 0.1), trim, 0, 0.1, 0.05));             // skirting board
    g.add(mesh(new THREE.BoxGeometry(len, 0.22, 0.2), cream, 0, h - 0.11, 0.1));       // cornice
    g.add(mesh(new THREE.BoxGeometry(len + 0.3, h, 0.3), paint(0x6b4a33), 0, h / 2, -0.16));   // wall thickness, seen at the cut edges
    room.add(g);
    return g;
  };
  wall(w, 0, -d / 2, 0);
  wall(d, -w / 2, 0, Math.PI / 2);
  wall(d, w / 2, 0, -Math.PI / 2);

  // the window on the back wall, with the Carpathians behind it
  const view = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.0), new THREE.MeshBasicMaterial({ map: mountainPainting(), toneMapped: false }));
  view.position.set(1.2, 3.35, -d / 2 + 0.03); room.add(view);
  const win = model('window');
  if (win) { win.position.set(1.2, 1.2, -d / 2 + 0.25); room.add(win); }

  // the family's own photos on the walls
  const photo = (url, fw, fh, x, y, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = ry;
    g.add(mesh(new THREE.BoxGeometry(fw + 0.18, fh + 0.18, 0.06), paint(0x3d2616, { roughness: 0.4 }), 0, 0, 0));
    g.add(mesh(new THREE.BoxGeometry(fw + 0.06, fh + 0.06, 0.065), paint(0xc9a14e, { metalness: 0.7, roughness: 0.35 }), 0, 0, 0.003));
    g.add(mesh(new THREE.PlaneGeometry(fw, fh), paint(0xffffff, { map: photoTex(url), roughness: 0.35 }), 0, 0, 0.04));
    room.add(g);
  };
  photo('assets/parents.jpg', 1.0, 0.7, -1.9, 3.5, -d / 2 + 0.06, 0);
  photo('assets/baby_parents.jpg', 0.6, 0.8, -3.3, 3.6, -d / 2 + 0.06, 0);
  photo('assets/era1_toddler.jpg', 0.55, 0.7, -w / 2 + 0.06, 3.4, -0.6, Math.PI / 2);

  // furniture (decor only; the packable things are placed by the level)
  const put = (name, x, z, ry) => { const m = model(name); if (!m) return; m.position.set(x, 0, z); m.rotation.y = ry; room.add(m); };
  // just a few pieces, so the floor stays open for play
  put('bed', 3.25, -2.3, 0);

  // warm afternoon sun falling through the window onto the floor
  const beam = new THREE.SpotLight(0xffd59a, 60, 14, 0.6, 0.9, 1.6);
  beam.position.set(1.2, 4.6, -d / 2 + 0.6); beam.target.position.set(0.6, 0, 0.6);
  room.add(beam, beam.target);

  const rug = mesh(new THREE.PlaneGeometry(4.6, 3.3), paint(0xffffff, { map: rugTex(), roughness: 1 }), 0.3, 0.02, 0.6);
  rug.rotation.x = -Math.PI / 2; rug.castShadow = false; room.add(rug);
  return room;
}

// open leather suitcase (lid hinged at the back)
export function makeOpenCase() {
  const sc = new THREE.Group();
  const m = model('openCase');
  if (m) { sc.add(m); sc.userData.lid = null; return sc; }   // the sculpted case has no hinged lid
  const leather = paint(0x7d4524, { roughness: 0.55 }), strap = paint(0xc9a36a, { roughness: 0.5 }), brass = paint(0xd9a646, { metalness: 0.8, roughness: 0.3 });
  const lining = paint(0xa94848, { roughness: 0.95 });
  sc.add(mesh(new THREE.BoxGeometry(1.8, 0.5, 1.2), leather, 0, 0.25, 0));
  sc.add(mesh(new THREE.BoxGeometry(1.66, 0.04, 1.06), lining, 0, 0.49, 0));
  for (const s of [-1, 1]) sc.add(mesh(new THREE.BoxGeometry(0.12, 0.52, 1.22), strap, s * 0.5, 0.25, 0));
  for (const x of [-0.86, 0.86]) for (const z of [-0.56, 0.56]) sc.add(mesh(new THREE.BoxGeometry(0.1, 0.12, 0.1), brass, x, 0.06, z));
  const lid = new THREE.Group(); lid.position.set(0, 0.5, -0.6);
  lid.add(mesh(new THREE.BoxGeometry(1.8, 0.16, 1.2), leather, 0, 0.08, 0.6));
  lid.add(mesh(new THREE.BoxGeometry(1.66, 0.02, 1.06), lining, 0, -0.01, 0.6));
  for (const s of [-1, 1]) lid.add(mesh(new THREE.BoxGeometry(0.12, 0.18, 1.22), strap, s * 0.5, 0.08, 0.6));
  lid.rotation.x = -1.9;
  sc.add(lid);
  sc.userData.lid = lid;
  return sc;
}

// ---------- packable items ----------
const fromModel = (name, fallback) => model(name) || fallback();

export const makeTeddy = () => fromModel('teddy', () => {
  const g = new THREE.Group(), c = 0x9b6236, l = 0xd7a676;
  g.add(mesh(new THREE.SphereGeometry(0.34, 16, 12), c, 0, 0.36, 0));
  g.add(mesh(new THREE.SphereGeometry(0.26, 16, 12), c, 0, 0.84, 0));
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(0.1, 10, 8), c, s * 0.2, 1.06, 0));
    g.add(mesh(new THREE.SphereGeometry(0.13, 10, 8), c, s * 0.3, 0.45, 0.12));
    g.add(mesh(new THREE.SphereGeometry(0.14, 10, 8), c, s * 0.2, 0.08, 0.15));
    g.add(mesh(new THREE.SphereGeometry(0.035, 8, 6), 0x111111, s * 0.09, 0.9, 0.22));
  }
  g.add(mesh(new THREE.SphereGeometry(0.11, 10, 8), l, 0, 0.78, 0.2));
  return g;
});

export function makeBottle() {
  const m = model('bottle');
  if (m) return m;
  const g = new THREE.Group();
  const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.08, transmission: 0.6, thickness: 0.2, transparent: true, opacity: 0.6 });
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.6, 24), glass, 0, 0.3, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.145, 0.145, 0.42, 24), paint(0xfffbf0, { roughness: 0.35 }), 0, 0.22, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.09, 24), paint(0x6aa6d8, { roughness: 0.35 }), 0, 0.63, 0));
  const teat = mesh(new THREE.SphereGeometry(0.09, 16, 12), paint(0xe7b56b, { roughness: 0.45 }), 0, 0.73, 0); teat.scale.y = 1.5; g.add(teat);
  return g;
}

export function makeBlanket() {
  const m = model('blanket');
  if (m) return m;
  const tex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#efd38a'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(178,52,52,.75)'; for (let i = 0; i < w; i += 64) { g.fillRect(i, 0, 18, h); g.fillRect(0, i, w, 18); }
    g.fillStyle = 'rgba(40,60,110,.5)'; for (let i = 26; i < w; i += 64) { g.fillRect(i, 0, 5, h); g.fillRect(0, i, w, 5); }
    grain(g, w, h, 4000, 0.12);
  });
  const g = new THREE.Group();
  const geo = new THREE.BoxGeometry(0.95, 0.13, 0.72, 8, 1, 6);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setY(i, p.getY(i) + Math.sin(p.getX(i) * 9) * 0.015);
  geo.computeVertexNormals();
  for (let i = 0; i < 3; i++) { const f = mesh(geo, paint(0xffffff, { map: tex, roughness: 1 }), 0, 0.07 + i * 0.125, 0); f.rotation.y = i * 0.08; g.add(f); }
  return g;
}

export function makeCertificate() {
  const g = new THREE.Group();
  const paper = paint(0xffffff, { map: photoTex('assets/cert_1958.jpg'), roughness: 0.85, side: THREE.DoubleSide });
  const geo = new THREE.PlaneGeometry(0.8, 1.12, 8, 1);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setZ(i, Math.abs(p.getX(i)) * 0.18);   // opened like a booklet
  geo.computeVertexNormals();
  const sheet = mesh(geo, paper, 0, 0.06, 0); sheet.rotation.x = -Math.PI / 2; g.add(sheet);
  g.add(mesh(new THREE.BoxGeometry(0.84, 0.03, 1.16), paint(0x6b5a3f, { roughness: 0.9 }), 0, 0.015, 0));   // card cover underneath
  g.scale.setScalar(1.15);
  return g;
}

export function makePhotoFrame() {
  const g = new THREE.Group();
  const wood = paint(0x5a3a22, { roughness: 0.45 }), gilt = paint(0xd2a64e, { metalness: 0.7, roughness: 0.35 });
  const pic = mesh(new THREE.PlaneGeometry(0.9, 0.6), paint(0xffffff, { map: photoTex('assets/parents.jpg'), roughness: 0.3 }), 0, 0.5, 0.045);
  g.add(mesh(new THREE.BoxGeometry(1.12, 0.82, 0.07), wood, 0, 0.5, 0), mesh(new THREE.BoxGeometry(0.98, 0.68, 0.075), gilt, 0, 0.5, 0.004), pic);
  const leg = mesh(new THREE.BoxGeometry(0.06, 0.6, 0.04), wood, 0, 0.32, -0.2); leg.rotation.x = 0.5; g.add(leg);
  g.rotation.x = -0.2;
  return g;
}

export const makePiano = () => fromModel('piano', () => {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.8, 1.5, 0.7), 0x3a2418, 0, 0.75, 0));
  g.add(mesh(new THREE.BoxGeometry(1.7, 0.08, 0.36), 0xfdfaf2, 0, 0.82, 0.5));
  g.add(mesh(new THREE.BoxGeometry(1.8, 0.1, 0.5), 0x3a2418, 0, 0.74, 0.45));
  return g;
});

export const makeArmchair = () => fromModel('armchair', () => {
  const g = new THREE.Group(), c = 0x7b3f5e;
  g.add(mesh(new THREE.BoxGeometry(1.3, 0.45, 1.1), c, 0, 0.42, 0));
  g.add(mesh(new THREE.BoxGeometry(1.3, 1.0, 0.25), c, 0, 0.95, -0.45));
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.22, 0.4, 1.1), c, s * 0.62, 0.78, 0));
  return g;
});

export const makeGoose = () => fromModel('goose', () => {
  const g = new THREE.Group();
  const b = mesh(new THREE.SphereGeometry(0.3, 14, 10), 0xfbfbf6, 0, 0.42, 0); b.scale.set(0.8, 0.75, 1.2); g.add(b);
  const neck = mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.45, 8), 0xfbfbf6, 0, 0.75, 0.24); neck.rotation.x = 0.25; g.add(neck);
  g.add(mesh(new THREE.SphereGeometry(0.12, 12, 10), 0xfbfbf6, 0, 1.0, 0.32));
  const beak = mesh(new THREE.ConeGeometry(0.05, 0.18, 8), 0xf09a2a, 0, 0.98, 0.48); beak.rotation.x = Math.PI / 2; g.add(beak);
  return g;
});

// ---------- street ----------
export const makeBarrel = () => fromModel('barrel', () => {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.78, 16), 0x9a6033, 0, 0.39, 0));
  for (const y of [0.12, 0.66]) { const hoop = mesh(new THREE.TorusGeometry(0.37, 0.025, 6, 20), 0x4a4a4a, 0, y, 0); hoop.rotation.x = Math.PI / 2; g.add(hoop); }
  return g;
});

export function makeCart() {
  const m = model('cart');
  if (m) { m.rotation.y = Math.PI / 2; const g = new THREE.Group(); g.add(m); return g; }   // long side along the road
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(1.3, 0.3, 2.2), 0x8a5a33, 0, 0.75, 0));
  const hay = mesh(new THREE.SphereGeometry(0.8, 14, 10), 0xe2c060, 0, 1.25, 0); hay.scale.set(0.85, 0.75, 1.35); g.add(hay);
  for (const s of [-1, 1]) for (const t of [-0.7, 0.7]) {
    const w = mesh(new THREE.TorusGeometry(0.3, 0.06, 6, 16), 0x4a2e1a, s * 0.7, 0.33, t); w.rotation.y = Math.PI / 2; g.add(w);
  }
  return g;
}

export function makePuddle() {
  const g = new THREE.Group();
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), new THREE.MeshStandardMaterial({ color: 0x4f7fae, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.85 }));
  water.rotation.x = -Math.PI / 2; water.scale.set(1, 0.8, 1); water.position.y = 0.02; water.receiveShadow = true;
  g.add(water);
  return g;
}

export function makeHouse(i, color, w, h, roofColor) {
  const m = model(i % 2 ? 'houseB' : 'houseA');
  if (m) { const g = new THREE.Group(); m.rotation.y = Math.PI / 2; g.add(m); return g; }   // front door faces the road (+x)
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(4, h, w), color, 0, h / 2, 0));
  const roof = mesh(new THREE.CylinderGeometry(2.6, 2.6, w + 0.4, 3, 1), roofColor, 0, h + 0.7, 0);
  roof.rotation.x = -Math.PI / 2; roof.scale.set(1, 1, 0.55);
  g.add(roof);
  const win = paint(0x2d4f7c, { roughness: 0.2 }), frame = paint(0xfdfaf2);
  const rows = h > 4.5 ? 2 : 1;
  for (let r = 0; r < rows; r++) for (let k = -1; k <= 1; k += 2) {
    const y = 1.6 + r * 2;
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.95, 0.75), frame, 2.0, y, k * w * 0.24));
    g.add(mesh(new THREE.BoxGeometry(0.12, 0.8, 0.6), win, 2.02, y, k * w * 0.24));
  }
  g.add(mesh(new THREE.BoxGeometry(0.1, 1.5, 0.8), 0x6b3f22, 2.01, 0.75, 0));
  return g;
}

export const makeTree = () => fromModel('tree', () => {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.12, 0.18, 1.6, 7), 0x6b4423, 0, 0.8, 0));
  g.add(mesh(new THREE.SphereGeometry(0.9, 10, 8), 0x5f9b4a, 0, 2.1, 0));
  g.add(mesh(new THREE.SphereGeometry(0.65, 10, 8), 0x79b35c, 0.3, 2.7, 0.2));
  return g;
});

export const makeLamp = () => fromModel('lamp', () => {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.1, 4.2, 8), 0x26272b, 0, 2.1, 0));
  g.add(mesh(new THREE.BoxGeometry(0.35, 0.45, 0.35), paint(0xfff1c4, { emissive: 0xffd98a, emissiveIntensity: 0.4 }), 0, 4.35, 0));
  return g;
});

export function makeTower() { // Piatra Neamț's old stone bell tower
  const g = new THREE.Group();
  const stone = paint(0xd9cdb4, { map: slabTex(), roughness: 0.9 });
  stone.map = stone.map.clone(); stone.map.repeat.set(2, 6); stone.map.needsUpdate = true;
  g.add(mesh(new THREE.BoxGeometry(3, 11, 3), stone, 0, 5.5, 0));
  g.add(mesh(new THREE.BoxGeometry(3.3, 0.3, 3.3), 0xb8a98c, 0, 8, 0));
  for (const s of [-1, 1]) for (const r of [0, 1]) { const w = mesh(new THREE.BoxGeometry(r ? 0.7 : 0.1, 1.4, r ? 0.1 : 0.7), 0x2a2018, r ? 0 : s * 1.51, 9.3, r ? s * 1.51 : 0); g.add(w); }
  const roof = mesh(new THREE.ConeGeometry(2.4, 4.5, 4), paint(0x7a3b2a, { roughness: 0.7 }), 0, 13.2, 0); roof.rotation.y = Math.PI / 4; g.add(roof);
  g.add(mesh(new THREE.SphereGeometry(0.2, 12, 8), paint(0xf0b93a, { metalness: 0.9, roughness: 0.25 }), 0, 15.6, 0));
  return g;
}

export function makeSign(lines, bg) {
  const g = new THREE.Group();
  const post = paint(0x4a4c50, { metalness: 0.6, roughness: 0.4 });
  for (const s of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.6, 8), post, s * 1.1, 1.3, 0));
  const board = mesh(new THREE.PlaneGeometry(2.6, 0.98), paint(0xffffff, { map: signTex(lines, bg), roughness: 0.6 }), 0, 2.3, 0.07);
  g.add(mesh(new THREE.BoxGeometry(2.7, 1.06, 0.1), 0xdddddd, 0, 2.3, 0), board);
  return g;
}

const stampTexCache = [];
export function makeStamp(i) {
  const cols = ['#2b55a3', '#c63a3a', '#6d3a86', '#2e7d4f', '#d08a1e'];
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.6), new THREE.MeshBasicMaterial({ map: stampTexCache[i % 5] || (stampTexCache[i % 5] = stampTex(cols[i % 5], 'R.P.R.')), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
  const g = new THREE.Group(); g.add(m);
  // a soft glow so stamps read from far away
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xfff1b0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
  halo.scale.set(1.3, 1.3, 1); g.add(halo);
  return g;
}
let glow = null;
const glowTex = () => glow || (glow = canvasTex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}));

// ---------- landscape around the road ----------
export function makeLandscape() {
  const g = new THREE.Group();
  g.add(makeSky({ top: '#3f78c4', mid: '#9cc8ec', horizon: '#fde4c2', sunDir: [0.35, 0.22, -1] }));
  const grass = mesh(new THREE.PlaneGeometry(400, 400), paint(0xffffff, { map: grassTex(), roughness: 1 }), 0, -0.03, -150);
  grass.rotation.x = -Math.PI / 2; grass.castShadow = false; g.add(grass);
  // rolling Carpathian foothills: a displaced strip with vertex colors, then a hazy far ridge
  const hills = (z, depth, amp, cols, seed) => {
    const geo = new THREE.PlaneGeometry(520, depth, 104, 12);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, col = [];
    const c0 = new THREE.Color(cols[0]), c1 = new THREE.Color(cols[1]);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), zz = p.getZ(i), t = (zz + depth / 2) / depth;         // 0 far edge .. 1 near edge
      const y = (Math.sin(x * 0.021 + seed) * 0.6 + Math.sin(x * 0.057 + seed * 2) * 0.3 + Math.sin(x * 0.13 + seed) * 0.1 + 1) * amp * (1 - t);
      p.setY(i, Math.max(0, y));
      const c = c0.clone().lerp(c1, Math.min(1, y / (amp * 1.4))); col.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    m.position.z = z; m.receiveShadow = true;
    return m;
  };
  g.add(hills(-215, 70, 26, ['#6f9a5c', '#a7c47f'], 1));
  g.add(hills(-250, 60, 48, ['#7d9a8e', '#b7c9c2'], 4));
  // clouds
  const puff = canvasTex(128, 64, (c, w, h) => {
    for (let i = 0; i < 9; i++) {
      const x = 20 + i * 11 + rnd() * 6, y = 38 - Math.sin(i / 8 * Math.PI) * 14, r = 14 + Math.sin(i / 8 * Math.PI) * 12;
      const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    }
  });
  const clouds = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, fog: false, opacity: 0.85 }));
    const k = 30 + rnd() * 40; s.scale.set(k, k * 0.5, 1);
    s.position.set((rnd() - 0.5) * 360, 45 + rnd() * 50, -150 - rnd() * 120);
    clouds.add(s);
  }
  g.add(clouds);
  g.userData.clouds = clouds;
  return g;
}

// ---------- the port ----------
// the ship lies with its bow to -x; the boarding door is in its near side. Returns a group with the waterline at y = 0.
export function makeShip() {
  const g = new THREE.Group();
  const m = model('ship') || handBuiltShip();
  g.add(m);
  const size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
  m.position.y -= WATERLINE * size.y;
  fitDoor(g, m);
  const smoke = makeSmoke(); smoke.position.copy(g.userData.funnel); g.add(smoke);
  g.userData.smoke = smoke;
  return g;
}
function handBuiltShip() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(80, 12, 11), paint(0x1d2740, { roughness: 0.6 }), 0, 6, 0));
  g.add(mesh(new THREE.BoxGeometry(56, 6, 9), paint(0xf1ece0, { roughness: 0.6 }), 2, 15, 0));
  g.add(mesh(new THREE.CylinderGeometry(2.2, 2.4, 9, 20), paint(0xe9d9a8, { roughness: 0.6 }), 0, 22, 0));
  return g;
}
// grey puffs that rise from the funnel, swell and fade, over and over; call update(dt) each frame
function makeSmoke() {
  const g = new THREE.Group();
  const tex = canvasTex(64, 64, (c, w) => {
    const r = c.createRadialGradient(w / 2, w / 2, 2, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(70,68,70,.8)'); r.addColorStop(1, 'rgba(70,68,70,0)');
    c.fillStyle = r; c.fillRect(0, 0, w, w);
  });
  const puffs = [];
  for (let i = 0; i < 12; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    g.add(sp); puffs.push({ sp, t: i / 12 });
  }
  g.userData.update = dt => {
    for (const P of puffs) {
      P.t = (P.t + dt / 5) % 1;
      P.sp.position.set(P.t * 16, P.t * 13, 0);
      P.sp.scale.setScalar(2.5 + P.t * 9);
      P.sp.material.opacity = 1 - P.t;
    }
  };
  g.userData.update(0);
  return g;
}

// the boarding door, lying flush on the hull: every layer follows the side's measured profile
// (surf(y) = the skin's z at height y): a trim outline, the dark inside behind the opening, and a door leaf
// hinged on the stern side that swings out flat against the hull (leaf.rotation.y: 0 shut, DOOR_OPEN wide open)
function curvedPanel(w, y0, y1, lift, surf, x0 = -w / 2) {
  const nx = 4, ny = 14, pos = [], idx = [];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const y = y0 + (y1 - y0) * j / ny;
    pos.push(x0 + w * i / nx, y, surf(y) + lift);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1;
    idx.push(a, b, d, a, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function makeHullDoor(W, y0, y1, surf) {
  const g = new THREE.Group(), H = y1 - y0, t = H / 30;   // t: trim and gap widths, in step with the door's size
  const flat = o => { o.castShadow = false; return o; };
  g.add(flat(mesh(curvedPanel(W + 2 * t, y0 - t, y1 + t, t * 0.2, surf), paint(0x8e949c, { metalness: 0.3, roughness: 0.5 }))));
  g.add(flat(mesh(curvedPanel(W, y0, y1, t * 0.35, surf), paint(0x15120e, { roughness: 1 }))));
  const hinge = new THREE.Group(); hinge.position.x = W / 2; g.add(hinge);
  const leaf = mesh(curvedPanel(W, y0, y1, t * 0.5, surf, -W), paint(0xeef0f2, { metalness: 0.35, roughness: 0.4, side: THREE.DoubleSide }));
  hinge.add(flat(leaf));
  // a porthole and a handle on the leaf
  const gy = y0 + H * 0.7, hy = y0 + H * 0.42, r = W * 0.15;
  hinge.add(flat(mesh(new THREE.CircleGeometry(r, 24), paint(0x23324d, { roughness: 0.1, metalness: 0.3 }), -W / 2, gy, surf(gy) + t * 0.7)));
  hinge.add(flat(mesh(new THREE.RingGeometry(r, r * 1.3, 24), paint(0xb9bec6, { metalness: 0.4, roughness: 0.4 }), -W / 2, gy, surf(gy) + t * 0.65)));
  hinge.add(flat(mesh(new THREE.BoxGeometry(W * 0.2, t * 0.8, t), 0x6b7078, -W * 0.83, hy, surf(hy) + t)));
  g.userData.leaf = hinge;
  return g;
}

// the door's centre as a fraction of the length from the bow, its sill and height above the water; the waterline
// as a fraction of the model's height; the funnel as a fraction of the length; how far in from the side the deck rail stands
const DOOR_ALONG = 0.42, DOOR_Y = 3.0, DOOR_H = 3.4, WATERLINE = 0.093, FUNNEL_ALONG = 0.475, RAIL_IN = 1.2;
// measure the hull at the door and fit a working door to it. userData gets: door (its hinge), doorAt (the sill's
// centre on the skin), side (the hull's furthest z), funnel (its top), deck (a spot on the open deck above the door)
function fitDoor(g, m) {
  m.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(m), V = THREE.Vector3, rc = new THREE.Raycaster();
  const hit = (o, d) => { rc.set(o, d); return rc.intersectObject(m, true)[0]?.point; };
  const L = box.max.x - box.min.x, x = box.min.x + DOOR_ALONG * L;
  const y0 = DOOR_Y, y1 = y0 + DOOR_H, rows = [];
  // the skin's z at a run of heights across the door, from rays fired at the ship's side
  for (let i = 0; i <= 20; i++) {
    const y = y0 + (y1 - y0) * (i / 20 * 1.2 - 0.1), p = hit(new V(x, y, box.max.z + 5), new V(0, 0, -1));
    if (p) rows.push([y, p.z]);
  }
  if (!rows.length) rows.push([y0, box.max.z]);
  const surf = y => {
    if (y <= rows[0][0]) return rows[0][1];
    for (let i = 1; i < rows.length; i++) if (y <= rows[i][0]) { const [ya, za] = rows[i - 1], [yb, zb] = rows[i]; return za + (zb - za) * (y - ya) / (yb - ya); }
    return rows[rows.length - 1][1];
  };
  const door = makeHullDoor(0.62 * DOOR_H, y0, y1, surf); door.position.x = x; g.add(door);
  const fx = box.min.x + FUNNEL_ALONG * L;
  const deckZ = surf(y1) - RAIL_IN, deckAt = hit(new V(x + 3, box.max.y + 5, deckZ), new V(0, -1, 0));
  g.userData.door = door.userData.leaf;
  g.userData.doorAt = new V(x, y0, surf(y0));
  g.userData.side = box.max.z;
  g.userData.funnel = hit(new V(fx, box.max.y + 5, 0), new V(0, -1, 0)) || new V(fx, box.max.y, 0);
  g.userData.deck = new V(x + 3, deckAt ? deckAt.y : y1 + 2, deckZ);
}
export const DOOR_OPEN = 2.85;

// a 1950s boarding-stair wagon: the treads keep the path the climb animation follows
// (top step at y 2.4, z 0.2; each step 0.27 down and 0.4 forward; foot at z ≈ 3.9)
export function makeStairs() {
  const g = new THREE.Group();
  const cream = paint(0xefe5cf, { roughness: 0.7 }), red = paint(0xb53a32, { roughness: 0.6 });
  const rubber = paint(0x34363a, { roughness: 0.95 }), steel = paint(0x9aa1a8, { roughness: 0.5, metalness: 0.3 });
  const n = 9, rise = 2.4 / n, run = 0.4;
  // steps: closed risers and grippy treads
  for (let i = 0; i < n; i++) {
    const y = 2.4 - i * rise, z = 0.2 + i * run;
    g.add(mesh(new THREE.BoxGeometry(1.42, 0.06, 0.44), rubber, 0, y + 0.03, z));
    g.add(mesh(new THREE.BoxGeometry(1.42, rise, 0.05), cream, 0, y - rise / 2, z + 0.2));
  }
  // solid side panels following the slope, with a red stripe
  const side = new THREE.Shape();
  side.moveTo(-1.75, 0.42); side.lineTo(4.15, 0.42); side.lineTo(4.15, 0.75); side.lineTo(0.15, 2.75); side.lineTo(-1.75, 2.75); side.closePath();
  const panelGeo = new THREE.ExtrudeGeometry(side, { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
  panelGeo.rotateY(-Math.PI / 2);   // shape x → world z
  const stripe = new THREE.Shape();
  stripe.moveTo(3.9, 0.55); stripe.lineTo(4.1, 0.55); stripe.lineTo(0.2, 2.5); stripe.lineTo(-1.7, 2.5); stripe.lineTo(-1.7, 2.36); stripe.lineTo(0.1, 2.36); stripe.closePath();
  const stripeGeo = new THREE.ShapeGeometry(stripe); stripeGeo.rotateY(-Math.PI / 2);
  const stripeM = paint(0xb53a32, { roughness: 0.6, side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const p = mesh(panelGeo, cream, s * 0.75 + (s > 0 ? 0.08 : 0), 0, 0); g.add(p);
    const st = mesh(stripeGeo, stripeM, s * 0.75 + (s > 0 ? 0.105 : -0.025), 0, 0); st.castShadow = false; g.add(st);
  }
  // top platform with a little railing at the door
  g.add(mesh(new THREE.BoxGeometry(1.5, 0.1, 1.8), rubber, 0, 2.45, -0.8));   // deep enough for Mom and Dad at the door
  // handrails on posts, rising with the stairs, then level along the platform
  const rail = (x, z0, y0, z1, y1) => {
    const len = Math.hypot(z1 - z0, y1 - y0);
    const r = mesh(new THREE.CylinderGeometry(0.045, 0.045, len, 10), red, x, (y0 + y1) / 2, (z0 + z1) / 2);
    r.rotation.x = Math.atan2(z1 - z0, y1 - y0); g.add(r);
  };
  for (const s of [-1, 1]) {
    const x = s * 0.8;
    rail(x, 4.0, 1.75, 0.2, 3.5);
    rail(x, 0.2, 3.5, -1.7, 3.5);
    for (const [z, yTop] of [[3.6, 1.95], [2.4, 2.5], [1.2, 3.05], [0.2, 3.5], [-0.75, 3.5], [-1.7, 3.5]]) {
      const yBase = z > 0.15 ? 2.4 - ((z - 0.2) / run) * rise + 0.3 : 2.75;
      g.add(mesh(new THREE.CylinderGeometry(0.03, 0.03, yTop - yBase, 8), steel, x, (yTop + yBase) / 2, z));
    }
  }
  // the truck underneath: chassis, tow bar and four fat wheels
  g.add(mesh(new THREE.BoxGeometry(1.3, 0.22, 5.8), paint(0x4a4e55, { roughness: 0.6 }), 0, 0.3, 1.2));
  g.add(mesh(new THREE.BoxGeometry(0.1, 0.1, 1.2), steel, 0, 0.3, 4.6));
  for (const sx of [-1, 1]) for (const z of [-1.3, 3.6]) {
    const w = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.2, 18), rubber, sx * 0.62, 0.24, z); w.rotation.z = Math.PI / 2; g.add(w);
    const hub = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.22, 12), cream, sx * 0.62, 0.24, z); hub.rotation.z = Math.PI / 2; g.add(hub);
  }
  return g;
}

export const makeTerminal = () => model('terminal');
export const makeLuggageCart = () => model('luggageCart');

// the harbour's far lighthouse, on its rock
export function makeLighthouse() {
  const g = new THREE.Group(), white = paint(0xf2eee4, { roughness: 0.8 }), red = paint(0xc0392f, { roughness: 0.7 });
  g.add(mesh(new THREE.CylinderGeometry(7, 9, 2, 12), paint(0x6d675c, { roughness: 1 }), 0, 1, 0));
  for (let i = 0; i < 4; i++) g.add(mesh(new THREE.CylinderGeometry(1.9 - i * 0.2, 2.1 - i * 0.2, 3.5, 16), i % 2 ? red : white, 0, 3.75 + i * 3.5, 0));
  g.add(mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.6, 16), paint(0xffe9a8, { roughness: 0.2, emissive: 0xffc860, emissiveIntensity: 0.5 }), 0, 17.3, 0));
  g.add(mesh(new THREE.ConeGeometry(1.7, 1.3, 16), red, 0, 18.75, 0));
  return g;
}
// a dockside crane: a steel tower on legs with a long jib over the water
export function makeCrane() {
  const g = new THREE.Group(), steel = paint(0x8a4b32, { roughness: 0.75, metalness: 0.2 });
  for (const x of [-1.8, 1.8]) for (const z of [-1.8, 1.8]) g.add(mesh(new THREE.BoxGeometry(0.35, 7, 0.35), steel, x, 3.5, z));
  g.add(mesh(new THREE.BoxGeometry(4.2, 0.5, 4.2), steel, 0, 7, 0));
  g.add(mesh(new THREE.BoxGeometry(1.1, 9, 1.1), steel, 0, 11.5, 0));
  g.add(mesh(new THREE.BoxGeometry(2.6, 2.2, 2.6), paint(0xe2c46a, { roughness: 0.7 }), 0, 16.6, 0));
  const jib = mesh(new THREE.BoxGeometry(0.5, 0.5, 15), steel, 0, 18.6, -5.5); jib.rotation.x = -0.18; g.add(jib);
  g.add(mesh(new THREE.BoxGeometry(0.06, 7, 0.06), 0x30343c, 0, 16, -12));
  g.add(mesh(new THREE.BoxGeometry(1.5, 1, 1.1), paint(0x7a5a38, { roughness: 0.9 }), 0, 12.2, -12));
  return g;
}
export function makeBollard() {
  const g = new THREE.Group(), iron = paint(0x2c3036, { roughness: 0.6, metalness: 0.3 });
  g.add(mesh(new THREE.CylinderGeometry(0.28, 0.34, 0.75, 12), iron, 0, 0.37, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 12), iron, 0, 0.8, 0));
  return g;
}
