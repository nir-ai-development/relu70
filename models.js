import { THREE, loadGltf, matte } from './engine.js';

// Sculpted Meshy props for Level 1. Each is fitted to the game's scale (Relu, ~0.9 m, is 1.8 units tall):
// `h` fits the height, `l` fits the longest horizontal side; `rot` turns the model so its front faces +z.
const SPECS = {
  ship:     { l: 80 },
  suitcase: { l: 0.9 },
  teddy:    { h: 0.9 },
  piano:    { h: 2.5 },
  armchair: { h: 2.0 },
  goose:    { h: 1.05 },
  houseA:   { h: 7.2 },
  houseB:   { h: 7.6 },
  tree:     { h: 4.3 },
  barrel:   { h: 0.85 },
  cart:     { l: 2.6 },
  lamp:     { h: 4.6 },
  bed:      { l: 3.6 },
  window:   { h: 3.4 },
  // Level 2 · Jerusalem 1966
  archWindow: { h: 5.4 },
  bookshelf: { h: 4.4 },
  sofa:     { l: 4.2 },
  pianoBench: { l: 1.6 },
  plant:    { h: 3.0 },
  openCase: { l: 1.9 },
  bottle:   { h: 0.6 },
  blanket:  { l: 0.95 },
  terminal: { l: 18 },
  luggageCart: { l: 3.4 },
  // Level 3 · Leyada 1969
  schoolDesk: { l: 2.6 },
  // Level 4 · IDF 1976
  jeep:     { l: 7.2 },
  armyTent: { l: 9 },
  // Level 5 · Hadassah 1985
  examBed:  { l: 4.2 },
  medCabinet: { h: 4.0 },
  // Level 6 · Jerusalem 1980
  cafeTable: { l: 3.4 },
  // Level 7 · 1989
  lounger:  { l: 4.4 },
  // Level 8 · 2026
  cake:     { h: 1.6 },
};

const loaded = {}, pending = {};

// Each level loads only the props it uses, the first time it's opened, so phones don't download
// the whole game up front. Names already loaded (or loading) are skipped.
export function loadModels(names) {
  return Promise.all(names.filter(n => SPECS[n]).map(name => pending[name] ||= loadOne(name, SPECS[name])));
}

async function loadOne(name, spec) {
  {
    let gltf;
    try { gltf = await loadGltf(`assets/${name}.glb`); } catch { return; }   // not made yet: callers fall back
    const root = new THREE.Group();
    const m = gltf.scene;
    if (spec.rot) m.rotation.y = spec.rot;
    root.add(m);
    m.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      o.userData.keep = true;   // shared by every clone; levels must not dispose it
      matte(o.material);
    });
    const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3());
    const k = spec.h ? spec.h / size.y : spec.l / Math.max(size.x, size.z);
    m.scale.multiplyScalar(k);
    const fitted = new THREE.Box3().setFromObject(root), c = fitted.getCenter(new THREE.Vector3());
    m.position.set(-c.x, -fitted.min.y, -c.z);
    if (spec.floor) {
      // put the top of the model's floor (not its underside) at y = 0, so props stand on it
      root.updateMatrixWorld(true);
      const hit = new THREE.Raycaster(new THREE.Vector3(0, 50, 0), new THREE.Vector3(0, -1, 0)).intersectObject(root, true)[0];
      if (hit) m.position.y -= hit.point.y;
    }
    loaded[name] = root;
  }
}

export const hasModel = name => !!loaded[name];

// a fresh copy (geometry and textures are shared), or null if that model isn't available
export function model(name) {
  return loaded[name] ? loaded[name].clone() : null;
}
