'use strict';
// ─────────────────────────────────────────────────────────────
//  MVSR visual Map Editor. Edits the layout from data.js and saves it
//  to localStorage (key MAP_KEY), which js/map_loader.js applies in the game.
// ─────────────────────────────────────────────────────────────
const REF_KEY = 'mvsr_editor_ref_v1';
const $ = (s) => document.querySelector(s);
const clone = (o) => JSON.parse(JSON.stringify(o));
const CORE_IDS = STORY_IDS;

const AREA_NAMES = { ground: 'MVSR Playground', court: 'Ball court', parking: 'Parking', parking2: 'Parking behind library', garden: 'Garden' };
const ZONE_NAMES = {
  gate: 'NPCs: main gate', quad: 'NPCs: central plaza', adminFront: 'NPCs: Admin front', canteenFront: 'NPCs: Canteen front',
  blockFront: 'NPCs: Block A front', labsFront: 'NPCs: Labs & Block B front', libraryFront: 'NPCs: Library front',
  hostelFront: 'NPCs: Hostel front', court: 'NPCs: Court', ground: 'NPCs: Playground', audiFront: 'NPCs: Auditorium front', garden: 'NPCs: Garden',
};
const POINT_NAMES = { gate: 'Main gate', backGate: 'Back gate', fountain: 'Fountain', notice: 'Notice board' };
const isGate = (s) => s && s.type === 'point' && (s.key === 'gate' || s.key === 'backGate');
const gateGeo = (key) => key === 'backGate' ? backGateInfo(M.backGate, M.world.w, M.world.h) : gateInfo(M.gate, M.world.w, M.world.h);
const DECOS = ['', 'awning', 'tanks', 'solar', 'ac', 'skylight', 'stripes', 'flag'];
const DECO_NAMES = { '': 'none', awning: 'Shop awning', tanks: 'Water tanks', solar: 'Solar panels', ac: 'AC units', skylight: 'Skylight', stripes: 'Stripes', flag: 'Flag pole' };
const AREA_COLORS = { ground: '#3f8f3a', court: '#d9822b', parking: '#4a4e57', parking2: '#4a4e57', garden: '#4c8c3c' };
const medianRadius = (o) => Math.min(Math.max(0, Number.isFinite(+o.radius) ? +o.radius : 30), Math.min(o.w, o.h) / 2);

// Street lights, trees, benches and bins become editable items (filled in from the automatic placement the first time).
function ensureExtras(m) {
  if (!Array.isArray(m.lamps)) m.lamps = autoLamps(m);
  if (!Array.isArray(m.trees)) m.trees = autoTrees(m);
  if (!Array.isArray(m.benches)) m.benches = autoBenches(m);
  if (!Array.isArray(m.bins)) m.bins = autoBins(m);
  if (!Array.isArray(m.rocks)) m.rocks = autoRocks(m);
  if (!Array.isArray(m.mapImages)) m.mapImages = [];
  if (!m.backGate) m.backGate = autoBackGate(m);
  return m;
}
let M = ensureExtras(snapshotMap());   // the layout being edited (map_loader already applied any saved one)
let sel = null;                        // { type: 'building'|'road'|'path'|'median'|'area'|'zone'|'point'|'lamp'|'tree'|'bench'|'bin', key }
const show = { areas: true, roads: true, paths: true, medians: true, buildings: true, lamps: true, trees: true, benches: true, bins: true, rocks: true, mapImages: true, zones: false, points: true, labels: true, grid: true, picture: true, mapPic: true };
const SHOW_NAMES = { areas: 'Areas', roads: 'Roads', paths: 'Plazas', medians: 'Green dividers', buildings: 'Buildings', lamps: 'Street lights', trees: 'Trees', benches: 'Benches', bins: 'Trash cans', rocks: 'Rocks', mapImages: 'Placed images', zones: 'NPC spots', points: 'Gate/fountain', labels: 'Names', grid: 'Grid', picture: 'Tracing picture', mapPic: 'Campus picture' };
const SMALL = ['point', 'lamp', 'tree', 'bench', 'bin'];          // items you move but don't resize with handles
const LISTS = { lamp: 'lamps', tree: 'trees', bench: 'benches', bin: 'bins', rock: 'rocks', image: 'mapImages', road: 'roads', path: 'paths', median: 'medians', building: 'buildings' };
const BIN_KINDS = { bin: 'Trash can', binDark: 'Dark trash can', hydrant: 'Fire hydrant' };

// The hand-drawn campus picture: the base you are laying everything out on (its red background is transparent).
const MAP_IMG = new Image();
MAP_IMG.onload = () => draw();
MAP_IMG.src = 'assets/campus_map.png';
const ROCK_IMG = new Image();
ROCK_IMG.onload = () => draw();
ROCK_IMG.src = 'assets/itch/rocks.png';
const MAP_IMAGE_CACHE = new Map();
function cachedMapImage(src) {
  if (!MAP_IMAGE_CACHE.has(src)) {
    const img = new Image();
    img.onload = () => draw();
    img.src = src;
    MAP_IMAGE_CACHE.set(src, img);
  }
  return MAP_IMAGE_CACHE.get(src);
}

// ── Undo / save ──────────────────────────────────────────────
let hist = [clone(M)], hi = 0;
function commit(msg) {
  hist = hist.slice(0, hi + 1); hist.push(clone(M)); if (hist.length > 150) hist.shift(); hi = hist.length - 1;
  persist(msg || 'Saved');
}
// Saving: always into this browser, and permanently into js/custom_map.js through play_and_edit.py.
// On a hosted site (e.g. Vercel) there is no save server, so don't try to write files there.
const ONLINE = location.protocol.startsWith('http') && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const CAN_SAVE_FILE = location.protocol.startsWith('http') && !ONLINE;
let fileOk = null, saveT = 0;
function persist(msg) {
  M.savedAt = Date.now(); M.layoutVersion = LAYOUT_VERSION;
  let local = true;
  try { localStorage.setItem(MAP_KEY, JSON.stringify(M)); } catch (e) { local = false; }
  status(`${msg} …saving`);
  clearTimeout(saveT);
  saveT = setTimeout(() => saveToFile(msg, local), 250);
  renderPanel(); draw();
}
function saveToFile(msg, local) {
  if (!CAN_SAVE_FILE) { setSaveState(false); status(local ? `${msg} ✓ (this browser only)` : '⚠ Could not save. Use "Export map file".'); return; }
  fetch('api/save-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(M) })
    .then(r => r.json()).then(j => { if (!j.ok) throw new Error(j.error); setSaveState(true); status(`${msg} ✓ saved permanently`); })
    .catch(() => { setSaveState(false); status(local ? `${msg} ✓ (this browser only)` : '⚠ Could not save. Use "Export map file".'); });
}
function setSaveState(ok) {
  fileOk = ok;
  const el = $('#savestate'); if (!el) return;
  el.className = ok ? 'savestate ok' : 'savestate bad';
  el.innerHTML = ok
    ? '✅ <b>Permanent saving is on.</b> Every change is written to <b>js/custom_map.js</b>, so the game uses it in every browser until you edit again.'
    : ONLINE
      ? '🌐 <b>Online version: changes are saved only in this browser.</b> To change the map for everyone, click <b>💾 Export map file</b>, put the downloaded <b>custom_map.js</b> into the project\'s <b>js</b> folder and deploy again.'
      : '⚠ <b>Changes are only saved in this browser.</b> To save permanently, close this page and open the game with <b>Start Game.bat</b> (in the game folder), then edit the map from there.';
}
function undo() { if (hi > 0) { hi--; M = clone(hist[hi]); validateSel(); persist('Undone'); } }
function redo() { if (hi < hist.length - 1) { hi++; M = clone(hist[hi]); validateSel(); persist('Redone'); } }
function validateSel() { if (sel && !ref(sel)) sel = null; }
let stTimer = 0;
function status(t) { const s = $('#status'); s.textContent = t; clearTimeout(stTimer); stTimer = setTimeout(() => { s.textContent = 'Ready'; }, 3500); }

// ── Item access ──────────────────────────────────────────────
function ref(s) {
  if (!s) return null;
  switch (s.type) {
    case 'building': return M.buildings[s.key];
    case 'road': return M.roads[s.key];
    case 'path': return M.paths[s.key];
    case 'median': return M.medians[s.key];
    case 'area': return M.areas[s.key];
    case 'zone': return M.zones[s.key];
    case 'point': return M[s.key];
    case 'lamp': return M.lamps[s.key];
    case 'tree': return M.trees[s.key];
    case 'bench': return M.benches[s.key];
    case 'bin': return M.bins[s.key];
    case 'rock': return M.rocks[s.key];
    case 'image': return M.mapImages[s.key];
  }
  return null;
}
// Bounding box drawn/hit-tested for an item (points get a fixed-size box around their spot).
function box(s) {
  const o = ref(s); if (!o) return null;
  if (s.type === 'lamp') return { x: o.x - 10, y: o.y - 80, w: 20, h: 84 };
  if (s.type === 'tree') { const k = o.s || 1; return { x: o.x - 36 * k, y: o.y - 115 * k, w: 72 * k, h: 120 * k }; }
  if (s.type === 'bench') return o.rot ? { x: o.x - 2, y: o.y - 27, w: 22, h: 54 } : { x: o.x - 2, y: o.y - 8, w: 54, h: 22 };
  if (s.type === 'bin') return { x: o.x - 4, y: o.y - 4, w: 40, h: 40 };
  if (s.type === 'rock' || s.type === 'image') return o;
  if (s.type !== 'point') return o;
  if (s.key === 'gate') return gateInfo(o, M.world.w, M.world.h).box;
  if (s.key === 'backGate') return backGateInfo(o, M.world.w, M.world.h).box;
  if (s.key === 'fountain') return { x: o.x - 62, y: o.y - 45, w: 124, h: 80 };
  return { x: o.x - 6, y: o.y - 50, w: 62, h: 56 };   // notice board
}
const resizable = (s) => s && !SMALL.includes(s.type);
const rotatable = (s) => s && !['point', 'lamp', 'tree', 'bin', 'rock', 'image'].includes(s.type);
const deletable = (s) => s && (['road', 'path', 'median', 'lamp', 'tree', 'bench', 'bin', 'rock', 'image'].includes(s.type) || (s.type === 'building' && !CORE_IDS.includes(ref(s).id)));
function label(s) {
  const o = ref(s);
  switch (s.type) {
    case 'building': return o.name;
    case 'road': return `Road ${s.key + 1}`;
    case 'path': return `Paved plaza ${s.key + 1}`;
    case 'median': return `Green divider ${s.key + 1}`;
    case 'area': return AREA_NAMES[s.key] || s.key;
    case 'zone': return ZONE_NAMES[s.key] || s.key;
    case 'point': return POINT_NAMES[s.key];
    case 'lamp': return `Street light ${s.key + 1}`;
    case 'tree': return `Tree ${s.key + 1}`;
    case 'bench': return `Bench ${s.key + 1}`;
    case 'bin': return `${BIN_KINDS[o.kind] || 'Trash can'} ${s.key + 1}`;
    case 'rock': return `Rock ${s.key + 1}`;
    case 'image': return o.name || `Image ${s.key + 1}`;
  }
  return '';
}

// ── View (pan / zoom) ────────────────────────────────────────
const cv = $('#cv'), g = cv.getContext('2d');
const view = { x: 0, y: 0, s: 0.25 };
let DPR = 1;
function resize() {
  DPR = window.devicePixelRatio || 1;
  cv.width = Math.round(cv.clientWidth * DPR); cv.height = Math.round(cv.clientHeight * DPR);
  draw();
}
const toScreen = (x, y) => [(x - view.x) * view.s, (y - view.y) * view.s];
const toWorld = (sx, sy) => [sx / view.s + view.x, sy / view.s + view.y];
function fit() {
  const w = cv.clientWidth, h = cv.clientHeight;
  view.s = Math.min((w - 40) / M.world.w, (h - 40) / M.world.h);
  view.x = -((w / view.s) - M.world.w) / 2; view.y = -((h / view.s) - M.world.h) / 2;
  draw();
}
function zoomAt(f, sx, sy) {
  const [wx, wy] = toWorld(sx, sy);
  view.s = Math.min(4, Math.max(0.05, view.s * f));
  view.x = wx - sx / view.s; view.y = wy - sy / view.s;
  draw();
}

// ── Reference picture ────────────────────────────────────────
let refPic = { src: null, x: 0, y: 0, w: 1000, rot: 0, op: 0.5 };
const refImg = new Image();
refImg.onload = draw;
try { const r = JSON.parse(localStorage.getItem(REF_KEY) || 'null'); if (r) { refPic = { ...refPic, ...r }; if (r.src) refImg.src = r.src; } } catch (e) { /* none */ }
function saveRef() {
  try { localStorage.setItem(REF_KEY, JSON.stringify(refPic)); }
  catch (e) { try { localStorage.setItem(REF_KEY, JSON.stringify({ ...refPic, src: null })); } catch (e2) { /* ignore */ } status('Picture is too big to remember after closing. It still works for now.'); }
  syncRefInputs(); draw();
}
const refH = () => (refImg.naturalWidth ? refPic.w * refImg.naturalHeight / refImg.naturalWidth : 0);
let refMode = false;

// ── Drawing ──────────────────────────────────────────────────
function rectPath(o) { const [x, y] = toScreen(o.x, o.y); g.beginPath(); g.rect(x, y, o.w * view.s, o.h * view.s); }
function roundedRectPath(o, radius) {
  const [x, y] = toScreen(o.x, o.y), w = o.w * view.s, h = o.h * view.s, r = Math.min(radius * view.s, w / 2, h / 2);
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function text(t, wx, wy, size, color, bg) {
  const [x, y] = toScreen(wx, wy);
  g.font = `bold ${size}px "Comic Neue", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  if (bg) { const w = g.measureText(t).width + 8; g.fillStyle = bg; g.fillRect(x - w / 2, y - size / 2 - 2, w, size + 4); }
  g.fillStyle = color; g.fillText(t, x, y);
}
function draw() {
  if (!cv.width) return;
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.clearRect(0, 0, cv.clientWidth, cv.clientHeight);
  g.fillStyle = '#2b2d42'; g.fillRect(0, 0, cv.clientWidth, cv.clientHeight);
  // grass + world border
  g.fillStyle = '#6aa84f'; rectPath({ x: 0, y: 0, w: M.world.w, h: M.world.h }); g.fill();
  // the hand-drawn campus picture as the base (its red background is transparent, so this grass shows through there)
  if (show.mapPic && MAP_IMG.complete && MAP_IMG.naturalWidth) {
    const [ox, oy] = toScreen(0, 0);
    g.drawImage(MAP_IMG, ox, oy, M.world.w * view.s, M.world.h * view.s);
  }
  if (show.mapImages) M.mapImages.forEach((item) => {
    const img = cachedMapImage(item.src);
    if (img.complete && img.naturalWidth) {
      const [x, y] = toScreen(item.x, item.y);
      g.drawImage(img, x, y, item.w * view.s, item.h * view.s);
    }
    if (item.collides) {
      g.save(); g.fillStyle = 'rgba(230,57,70,0.2)'; g.strokeStyle = '#e63946'; g.setLineDash([6, 4]);
      rectPath(item); g.fill(); g.stroke(); g.setLineDash([]); g.restore();
    }
  });
  // reference picture
  if (show.picture && refPic.src && refImg.naturalWidth) {
    g.save(); g.globalAlpha = refPic.op;
    const [x, y] = toScreen(refPic.x, refPic.y), w = refPic.w * view.s, h = refH() * view.s;
    g.translate(x + w / 2, y + h / 2); g.rotate((refPic.rot || 0) * Math.PI / 180);
    g.drawImage(refImg, -w / 2, -h / 2, w, h); g.restore();
    if (refMode) { g.strokeStyle = '#ffd60a'; g.setLineDash([8, 6]); g.lineWidth = 2; g.strokeRect(x, y, w, h); g.setLineDash([]); }
  }
  // grid
  const step = +$('#snap').value >= 10 ? +$('#snap').value : 50;
  if (show.grid) {
    let st = step; while (st * view.s < 12) st *= 2;
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 1; g.beginPath();
    for (let x = 0; x <= M.world.w; x += st) { const [sx] = toScreen(x, 0); g.moveTo(sx, toScreen(0, 0)[1]); g.lineTo(sx, toScreen(0, M.world.h)[1]); }
    for (let y = 0; y <= M.world.h; y += st) { const [, sy] = toScreen(0, y); g.moveTo(toScreen(0, 0)[0], sy); g.lineTo(toScreen(M.world.w, 0)[0], sy); }
    g.stroke();
  }
  // boundary wall with the gate gap
  g.fillStyle = '#9b3d2c';
  for (const p of wallPieces([gateGeo('gate'), gateGeo('backGate')], M.world.w, M.world.h)) { rectPath(p); g.fill(); }
  // parking bays and driveways, using the same plans as the game
  for (const P of parkingAreas(M.areas)) {
    const plan = parkingPlan(P, M.roads), dw = lotDriveway(plan, M.roads);
    if (show.areas) { g.save(); g.globalAlpha = 0.75; g.fillStyle = '#4a4e57'; if (dw) for (const l of dw.legs) { rectPath(l); g.fill(); }
      g.lineWidth = 1; for (const b of plan.bays.bus) { g.strokeStyle = 'rgba(255,214,10,0.8)'; rectPath(b.r); g.stroke(); }
      for (const b of plan.bays.car) { g.strokeStyle = 'rgba(255,255,255,0.55)'; rectPath(b.r); g.stroke(); }
      for (const b of plan.bays.bus) text('BUS', b.cx, b.cy, 10, '#ffe066');
      g.restore(); }
  }

  if (show.areas) for (const k of Object.keys(M.areas)) {
    const a = M.areas[k];
    g.save(); g.globalAlpha = 0.65;   // see-through, so the picture beneath stays visible
    g.fillStyle = AREA_COLORS[k] || '#888'; rectPath(a); g.fill();
    if (k === 'ground') { g.strokeStyle = '#b5523b'; g.lineWidth = Math.max(2, 30 * view.s); rectPath({ x: a.x + 20, y: a.y + 20, w: a.w - 40, h: a.h - 40 }); g.stroke(); }
    g.restore();
    if (show.labels) text(AREA_NAMES[k] || k, a.x + a.w / 2, a.y + a.h / 2, 14, '#fff', 'rgba(0,0,0,0.35)');
  }
  if (show.roads) { g.save(); g.globalAlpha = 0.75; M.roads.forEach((r) => { g.fillStyle = '#3d4049'; rectPath(r); g.fill(); g.strokeStyle = '#9a9a9a'; g.lineWidth = 1.5; g.stroke(); }); g.restore(); }
  if (show.medians) { g.save(); g.globalAlpha = 0.85; g.setLineDash([10, 7]);   // no-go lawns: nobody can cross them in the game
    M.medians.forEach((r) => { g.fillStyle = 'rgba(64,143,54,0.55)'; roundedRectPath(r, medianRadius(r)); g.fill(); g.strokeStyle = '#1e4d1c'; g.lineWidth = 2; g.stroke(); });
    g.setLineDash([]); g.restore(); }
  if (show.paths) { g.save(); g.globalAlpha = 0.8; M.paths.forEach((p) => { g.fillStyle = '#cdb79e'; rectPath(p); g.fill(); g.strokeStyle = 'rgba(90,60,30,0.4)'; g.lineWidth = 1; g.stroke(); }); g.restore(); }
  if (show.buildings) M.buildings.forEach((b) => {
    const P = buildingParts(b);
    g.save(); g.globalAlpha = 0.85;   // slightly see-through, so the picture's roads under a building stay visible
    g.fillStyle = b.roofC || '#999'; rectPath(P.roofR); g.fill();
    g.fillStyle = b.wall || '#eee'; rectPath(P.wallR); g.fill();
    // a dark line where the front wall meets the ground, so you can see which way it faces
    const W = P.wallR, edge = { S: { x: W.x, y: W.y + W.h - 6, w: W.w, h: 6 }, N: { x: W.x, y: W.y, w: W.w, h: 6 }, E: { x: W.x + W.w - 6, y: W.y, w: 6, h: W.h }, W: { x: W.x, y: W.y, w: 6, h: W.h } }[P.face];
    g.fillStyle = 'rgba(0,0,0,0.35)'; rectPath(edge); g.fill();
    if (b.img) {   // uploaded pictures, bent to fit like in the game
      g.save(); g.setTransform(DPR * view.s, 0, 0, DPR * view.s, -view.x * view.s * DPR, -view.y * view.s * DPR);
      paintBuildingPictures(g, b); g.restore();
    }
    g.strokeStyle = '#000'; g.lineWidth = 1.5; rectPath(b); g.stroke();
    // door mark (on whichever side the entrance faces)
    g.fillStyle = '#7a2e2e'; rectPath(doorInfo(b).mat); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1; g.stroke();
    g.restore();
    if (show.labels) text(b.name, b.x + b.w / 2, b.y + b.h / 2, 13, '#111', 'rgba(255,255,255,0.8)');
  });
  if (show.bins) M.bins.forEach((b) => {
    const [x, y] = toScreen(b.x, b.y), s = 32 * view.s;
    g.fillStyle = b.kind === 'hydrant' ? '#c0392b' : b.kind === 'binDark' ? '#3f4a3a' : '#5f6b52';
    g.fillRect(x, y, s, s);
    g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(x, y, s, s);
  });
  if (show.rocks) M.rocks.forEach((rock) => {
    const [x, y] = toScreen(rock.x, rock.y), spr = rock.sprite || ROCK_SPRITES[0];
    if (ROCK_IMG.complete && ROCK_IMG.naturalWidth) g.drawImage(ROCK_IMG, spr[0], spr[1], spr[2], spr[3], x, y, rock.w * view.s, rock.h * view.s);
    if (rock.solid !== false) {
      const c = rockCollisionBox(rock);
      g.save(); g.fillStyle = 'rgba(230,57,70,0.2)'; g.strokeStyle = '#e63946'; g.setLineDash([6, 4]);
      rectPath(c); g.fill(); g.stroke(); g.setLineDash([]); g.restore();
    }
  });
  if (show.benches) M.benches.forEach((b) => { g.fillStyle = '#7f5539'; rectPath(b.rot ? { x: b.x, y: b.y - 25, w: 18, h: 50 } : { x: b.x, y: b.y - 6, w: 50, h: 18 }); g.fill(); g.strokeStyle = '#3b2414'; g.lineWidth = 1; g.stroke(); });
  if (show.trees) M.trees.forEach((t) => {
    const k = t.s || 1, [tx, ty] = toScreen(t.x, t.y), r = 32 * k * view.s;
    g.fillStyle = '#6b4226'; g.fillRect(tx - 5 * k * view.s, ty - 34 * k * view.s, 10 * k * view.s, 34 * k * view.s);
    g.fillStyle = t.hue < 0.33 ? '#40916c' : t.hue < 0.66 ? '#6a994e' : '#2d6a4f';
    g.beginPath(); g.arc(tx, ty - 70 * k * view.s, Math.max(2, r), 0, 7); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1; g.stroke();
  });
  if (show.lamps) M.lamps.forEach((l) => {
    const [lx, ly] = toScreen(l.x, l.y);
    g.strokeStyle = '#2b2d42'; g.lineWidth = Math.max(1.5, 4 * view.s); g.beginPath(); g.moveTo(lx, ly); g.lineTo(lx, ly - 70 * view.s); g.stroke();
    g.fillStyle = '#ffe066'; g.beginPath(); g.arc(lx, ly - 72 * view.s, Math.max(3, 7 * view.s), 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1; g.stroke();
  });
  if (show.zones) for (const k of Object.keys(M.zones)) {
    const z = M.zones[k]; g.strokeStyle = '#ffd60a'; g.setLineDash([6, 4]); g.lineWidth = 2; rectPath(z); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(255,214,10,0.12)'; g.fill();
    if (show.labels) text(ZONE_NAMES[k] || k, z.x + z.w / 2, z.y + z.h / 2, 11, '#000', 'rgba(255,214,10,0.85)');
  }
  if (show.points) for (const k of ['gate', 'backGate', 'fountain', 'notice']) {
    const b = box({ type: 'point', key: k });
    if (k === 'gate') {   // the same code-drawn gate the game shows
      g.save(); g.setTransform(DPR * view.s, 0, 0, DPR * view.s, -view.x * view.s * DPR, -view.y * view.s * DPR);
      drawGateArt(g, gateInfo(M.gate, M.world.w, M.world.h)); g.restore();
      continue;
    }
    if (k === 'backGate') {
      g.save(); g.setTransform(DPR * view.s, 0, 0, DPR * view.s, -view.x * view.s * DPR, -view.y * view.s * DPR);
      drawBackGate(g, gateGeo('backGate')); g.restore();
      if (show.labels) text('Back gate', b.x + b.w / 2, b.y + b.h / 2, 12, '#fff', 'rgba(0,0,0,0.5)');
      continue;
    }
    g.fillStyle = k === 'gate' ? '#1d3557' : k === 'fountain' ? '#4ea8de' : '#8d6e63';
    rectPath(b); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 1.5; g.stroke();
    if (show.labels) text(POINT_NAMES[k], b.x + b.w / 2, b.y + b.h / 2, 12, '#fff');
  }
  // selection
  if (sel && ref(sel)) {
    const b = box(sel);
    g.strokeStyle = '#ff006e'; g.lineWidth = 3; rectPath(b); g.stroke();
    if (resizable(sel)) for (const h of handles(b)) { g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5; g.fillRect(h.sx - 6, h.sy - 6, 12, 12); g.strokeRect(h.sx - 6, h.sy - 6, 12, 12); }
    const dh = doorHandle();
    if (dh) {   // the round "door" handle: drag it around the building to move the entrance
      const [mx, my] = toScreen(dh.d.x - dh.d.ox * 20, dh.d.y - dh.d.oy * 20);
      g.strokeStyle = '#7a2e2e'; g.lineWidth = 3; g.beginPath(); g.moveTo(mx, my); g.lineTo(dh.sx, dh.sy); g.stroke();
      g.fillStyle = '#7a2e2e'; g.beginPath(); g.arc(dh.sx, dh.sy, 11, 0, 7); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
      g.font = '12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🚪', dh.sx, dh.sy + 1);
    }
    const [lx, ly] = toScreen(b.x, b.y);
    g.font = 'bold 12px "Comic Neue", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'bottom';
    const t = `${label(sel)}  ${Math.round(b.w)}×${Math.round(b.h)}`; const tw = g.measureText(t).width + 10;
    g.fillStyle = '#ff006e'; g.fillRect(lx, ly - 20, tw, 18); g.fillStyle = '#fff'; g.fillText(t, lx + 5, ly - 4);
  }
}
function handles(b) {
  const [x, y] = toScreen(b.x, b.y), w = b.w * view.s, h = b.h * view.s;
  return [
    { k: 'nw', sx: x, sy: y }, { k: 'n', sx: x + w / 2, sy: y }, { k: 'ne', sx: x + w, sy: y },
    { k: 'e', sx: x + w, sy: y + h / 2 }, { k: 'se', sx: x + w, sy: y + h }, { k: 's', sx: x + w / 2, sy: y + h },
    { k: 'sw', sx: x, sy: y + h }, { k: 'w', sx: x, sy: y + h / 2 },
  ];
}
// The entrance handle of the selected building, a little outside the wall the door is on.
function doorHandle() {
  if (!sel || sel.type !== 'building' || !ref(sel)) return null;
  const d = doorInfo(ref(sel));
  const [x, y] = toScreen(d.x - d.ox * 20, d.y - d.oy * 20);
  return { d, sx: x + d.ox * 26, sy: y + d.oy * 26 };
}
// Put a building's entrance on the side nearest to (wx, wy), at that spot along the wall.
function placeDoor(b, wx, wy, free) {
  const dist = { N: Math.abs(wy - b.y), S: Math.abs(wy - (b.y + b.h)), W: Math.abs(wx - b.x), E: Math.abs(wx - (b.x + b.w)) };
  const side = Object.keys(dist).sort((p, q) => dist[p] - dist[q])[0];
  const roof = Math.min(b.roof || 0, b.h), top = b.y + roof + 10, wh = Math.max(10, b.h - roof - 10);
  let t = side === 'N' || side === 'S' ? (wx - b.x) / b.w : (wy - top) / wh;
  t = Math.min(0.9, Math.max(0.1, free ? t : Math.round(t * 20) / 20));
  b.door = side; b.doorAt = Math.round(t * 100) / 100;
}
// The main gate moves freely around the map; the back gate remains on a boundary wall.
function placeGate(wx, wy, free, key = 'gate') {
  if (key === 'gate') {
    moveMainGate(wx, wy, M.gate.side);
    return;
  }
  const W = M.world.w, H = M.world.h;
  const dist = { N: wy, S: H - wy, W: wx, E: W - wx };
  const side = Object.keys(dist).sort((p, q) => dist[p] - dist[q])[0];
  setGate(side, side === 'N' || side === 'S' ? snapV(wx, free) : snapV(wy, free), key);
}
function moveMainGate(x, y, side = M.gate.side) {
  const W = M.world.w, H = M.world.h;
  M.gate.side = side;
  M.gate.free = true;
  M.gate.x = Math.min(W, Math.max(0, x));
  M.gate.y = Math.min(H, Math.max(0, y));
  syncGateZone();
}
function syncGateZone() {
  const W = M.world.w, H = M.world.h, z = M.zones.gate, gi = gateInfo(M.gate, W, H);
  if (!z) return;
  const w = gi.horiz ? 230 : 90, h = gi.horiz ? 90 : 230;
  Object.assign(z, { x: Math.min(W - w, Math.max(0, gi.exit.x - w / 2)), y: Math.min(H - h, Math.max(0, gi.exit.y - h / 2)), w, h });
}
function setGate(side, at, key = 'gate') {
  const W = M.world.w, H = M.world.h, horiz = side === 'N' || side === 'S', o = M[key];
  o.side = side;
  if (horiz) o.x = Math.min(W, Math.max(0, at)); else o.y = Math.min(H, Math.max(0, at));
  if (key !== 'gate') return;
  const gi = gateInfo(M.gate, W, H);
  moveMainGate(gi.x, gi.y, side);
}
const CURSORS = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

// ── Hit testing ──────────────────────────────────────────────
const inBox = (b, x, y) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
function hit(wx, wy) {
  const tests = [];
  if (show.points) for (const k of ['notice', 'fountain', 'gate', 'backGate']) tests.push({ type: 'point', key: k });
  if (show.mapImages) M.mapImages.forEach((_, i) => tests.push({ type: 'image', key: i }));
  if (show.rocks) M.rocks.forEach((_, i) => tests.push({ type: 'rock', key: i }));
  if (show.lamps) M.lamps.forEach((_, i) => tests.push({ type: 'lamp', key: i }));
  if (show.bins) M.bins.forEach((_, i) => tests.push({ type: 'bin', key: i }));
  if (show.benches) M.benches.forEach((_, i) => tests.push({ type: 'bench', key: i }));
  if (show.trees) M.trees.forEach((_, i) => tests.push({ type: 'tree', key: i }));
  if (show.zones) for (const k of Object.keys(M.zones)) tests.push({ type: 'zone', key: k });
  if (show.buildings) for (let i = M.buildings.length - 1; i >= 0; i--) tests.push({ type: 'building', key: i });
  if (show.paths) for (let i = M.paths.length - 1; i >= 0; i--) tests.push({ type: 'path', key: i });
  if (show.medians) for (let i = M.medians.length - 1; i >= 0; i--) tests.push({ type: 'median', key: i });
  if (show.roads) for (let i = M.roads.length - 1; i >= 0; i--) tests.push({ type: 'road', key: i });
  if (show.areas) for (const k of Object.keys(M.areas)) tests.push({ type: 'area', key: k });
  // smaller items win when several overlap (so a court on top of a field stays clickable)
  const hits = tests.filter(s => inBox(box(s), wx, wy));
  if (!hits.length) return null;
  const pri = { lamp: 0, bench: 0, point: 0, tree: 0, bin: 0, rock: 0, image: 0, zone: 1, building: 2, path: 3, median: 3, road: 4, area: 5 };
  hits.sort((a, b) => (pri[a.type] - pri[b.type]) || (box(a).w * box(a).h - box(b).w * box(b).h));
  return hits[0];
}

// ── Mouse ────────────────────────────────────────────────────
let drag = null;
const snapV = (v, free) => { const s = +$('#snap').value; return free || s <= 1 ? Math.round(v) : Math.round(v / s) * s; };
function mpos(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener('mousedown', (e) => {
  const [sx, sy] = mpos(e), [wx, wy] = toWorld(sx, sy);
  if (e.button === 2 || e.button === 1) { drag = { kind: 'pan', sx, sy, vx: view.x, vy: view.y }; return; }
  if (refMode && refPic.src) { drag = { kind: 'ref', wx, wy, ox: refPic.x, oy: refPic.y }; return; }
  const dh = doorHandle();
  if (dh && Math.hypot(dh.sx - sx, dh.sy - sy) <= 13) { drag = { kind: 'door', moved: false }; return; }
  if (sel && resizable(sel)) {
    const h = handles(box(sel)).find(h => Math.abs(h.sx - sx) <= 8 && Math.abs(h.sy - sy) <= 8);
    if (h) { drag = { kind: 'resize', h: h.k, wx, wy, o: { ...ref(sel) }, moved: false }; return; }
  }
  const s = hit(wx, wy);
  if (s) {
    sel = s; renderPanel();
    const o = ref(s);
    drag = { kind: 'move', wx, wy, sx, sy, ox: o.x, oy: o.y, moved: false };
  } else {
    sel = null; renderPanel();
    drag = { kind: 'pan', sx, sy, vx: view.x, vy: view.y };
  }
  draw();
});
window.addEventListener('mousemove', (e) => {
  const [sx, sy] = mpos(e), [wx, wy] = toWorld(sx, sy);
  $('#coords').textContent = `x ${Math.round(wx)}  y ${Math.round(wy)}  ·  zoom ${Math.round(view.s * 100)}%`;
  if (!drag) {
    let cur = refMode ? 'move' : 'default';
    if (!refMode && sel && resizable(sel)) { const h = handles(box(sel)).find(h => Math.abs(h.sx - sx) <= 8 && Math.abs(h.sy - sy) <= 8); if (h) cur = CURSORS[h.k]; }
    const dh = !refMode && doorHandle(); if (dh && Math.hypot(dh.sx - sx, dh.sy - sy) <= 13) cur = 'grab';
    if (!refMode && cur === 'default' && hit(wx, wy)) cur = 'grab';
    cv.style.cursor = cur; return;
  }
  if (e.buttons === 0) { endDrag(); return; }   // the button was released outside the window: never keep dragging
  const free = e.altKey;
  if (drag.kind === 'pan') { view.x = drag.vx - (sx - drag.sx) / view.s; view.y = drag.vy - (sy - drag.sy) / view.s; draw(); return; }
  if (drag.kind === 'ref') { refPic.x = Math.round(drag.ox + wx - drag.wx); refPic.y = Math.round(drag.oy + wy - drag.wy); syncRefInputs(); draw(); return; }
  const o = ref(sel), dx = wx - drag.wx, dy = wy - drag.wy;
  if (drag.kind === 'door') {
    placeDoor(o, wx, wy, free); drag.moved = true;
    status(`Entrance: ${SIDE_NAMES[o.door]} side, ${Math.round(o.doorAt * 100)}% along`);
    renderPanel(); draw(); return;
  }
  if (drag.kind === 'move') {
    if (!drag.moved && Math.hypot(sx - drag.sx, sy - drag.sy) < 4) return;   // a plain click never nudges anything
    drag.moved = true;
    if (isGate(sel)) { placeGate(wx, wy, free, sel.key); renderPanel(); draw(); return; }
    o.x = snapV(drag.ox + dx, free);
    o.y = snapV(drag.oy + dy, free);
  } else if (drag.kind === 'resize') {
    const s = drag.o, MIN = 20;
    let x0 = s.x, y0 = s.y, x1 = s.x + s.w, y1 = s.y + s.h;
    if (drag.h.includes('w')) x0 = Math.min(snapV(s.x + dx, free), x1 - MIN);
    if (drag.h.includes('e')) x1 = Math.max(snapV(s.x + s.w + dx, free), x0 + MIN);
    if (drag.h.includes('n')) y0 = Math.min(snapV(s.y + dy, free), y1 - MIN);
    if (drag.h.includes('s')) y1 = Math.max(snapV(s.y + s.h + dy, free), y0 + MIN);
    // keep a building's roof the same share of its depth (height for N/S-facing, width for E/W-facing)
    if (sel.type === 'building') {
      const sideways = s.face === 'E' || s.face === 'W', was = sideways ? s.w : s.h, now = sideways ? x1 - x0 : y1 - y0;
      if (was) o.roof = Math.round((s.roof || 0) * now / was);
    }
    o.x = x0; o.y = y0; o.w = x1 - x0; o.h = y1 - y0;
    if (sel.type === 'median') o.radius = Math.min(medianRadius(s), Math.min(o.w, o.h) / 2);
    drag.moved = true;
  }
  renderSelFields(); draw();
});
function endDrag() {
  if (!drag) return;
  const d = drag; drag = null;
  if (d.kind === 'ref') saveRef();
  else if (d.moved && sel) commit(d.kind === 'move' ? `Moved ${label(sel)}` : d.kind === 'door' ? `Moved the entrance of ${label(sel)}` : `Resized ${label(sel)}`);
}
window.addEventListener('mouseup', endDrag);
window.addEventListener('blur', endDrag);
cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  const [sx, sy] = mpos(e);
  if (refMode && refPic.src) {
    const [wx, wy] = toWorld(sx, sy), f = e.deltaY < 0 ? 1.05 : 1 / 1.05;
    refPic.x = Math.round(wx - (wx - refPic.x) * f); refPic.y = Math.round(wy - (wy - refPic.y) * f); refPic.w = Math.round(refPic.w * f);
    saveRef(); return;
  }
  zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, sx, sy);
}, { passive: false });

// ── Keyboard ─────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, select, textarea')) return;
  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (ctrl && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
  if (e.key === 'Escape') { sel = null; renderPanel(); draw(); return; }
  if ((e.key === 'r' || e.key === 'R') && !ctrl && sel) { e.preventDefault(); rotateSel(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); removeSel(); return; }
  const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (dirs[e.key] && sel) {
    e.preventDefault();
    const o = ref(sel), st = (e.shiftKey ? 10 : 1) * Math.max(1, +$('#snap').value);
    if (isGate(sel) && sel.key === 'gate') {
      const gi = gateGeo('gate');
      moveMainGate(gi.x + dirs[e.key][0] * st, gi.y + dirs[e.key][1] * st);
    } else if (isGate(sel)) {   // slide along its own wall
      const gi = gateGeo(sel.key);
      setGate(gi.side, gi.at + (gi.horiz ? dirs[e.key][0] : dirs[e.key][1]) * st, sel.key);
    } else { o.x += dirs[e.key][0] * st; o.y += dirs[e.key][1] * st; }
    clearTimeout(nudgeT); nudgeT = setTimeout(() => commit(`Moved ${label(sel)}`), 400);
    renderSelFields(); draw();
  }
});
let nudgeT = 0;

// ── Add / duplicate / delete ─────────────────────────────────
function centre() { const [x, y] = toWorld(cv.clientWidth / 2, cv.clientHeight / 2); return [snapV(x), snapV(y)]; }
function addRoad(horizontal) {
  const [cx, cy] = centre();
  const r = horizontal ? { x: cx - 300, y: cy - 35, w: 600, h: 70 } : { x: cx - 35, y: cy - 300, w: 70, h: 600 };
  M.roads.push(r); sel = { type: 'road', key: M.roads.length - 1 }; commit('Added a road');
}
function addPath() { const [cx, cy] = centre(); M.paths.push({ x: cx - 150, y: cy - 100, w: 300, h: 200 }); sel = { type: 'path', key: M.paths.length - 1 }; commit('Added a plaza'); }
function addMedian() { const [cx, cy] = centre(); M.medians.push({ x: cx - 70, y: cy - 60, w: 140, h: 120, radius: 30 }); sel = { type: 'median', key: M.medians.length - 1 }; commit('Added a green divider'); }
function addBuilding() {
  const [cx, cy] = centre();
  let n = 1; while (M.buildings.some(b => b.id === 'extra' + n)) n++;
  M.buildings.push({ id: 'extra' + n, name: 'New Building ' + n, x: cx - 150, y: cy - 120, w: 300, h: 240, roof: 115, wall: '#f1e3c8', roofC: '#8d6e63', floors: 2, deco: '' });
  sel = { type: 'building', key: M.buildings.length - 1 }; commit('Added a building');
}
function addPoint(type) {
  const [cx, cy] = centre(), arr = M[LISTS[type]];
  arr.push(type === 'tree' ? { x: cx, y: cy, s: 1, hue: Math.round(Math.random() * 100) / 100 }
    : type === 'bench' ? { x: cx, y: cy, rot: 0 }
    : type === 'bin' ? { x: cx - 16, y: cy - 16, kind: 'bin' }
    : { x: cx, y: cy });
  sel = { type, key: arr.length - 1 };
  commit({ lamp: 'Added a street light', tree: 'Added a tree', bench: 'Added a bench', bin: 'Added a trash can' }[type]);
}
function addRock() {
  const [cx, cy] = centre(), sprite = ROCK_SPRITES[Math.floor(Math.random() * ROCK_SPRITES.length)], scale = 0.7;
  const rock = { x: Math.round(cx - sprite[2] * scale / 2), y: Math.round(cy - sprite[3] * scale / 2),
    w: Math.round(sprite[2] * scale), h: Math.round(sprite[3] * scale), sprite: [...sprite], solid: true };
  M.rocks.push(rock); sel = { type: 'rock', key: M.rocks.length - 1 }; commit('Added a rock');
}
function addMapImage(file) {
  if (!file || !file.type.startsWith('image/')) { status('Choose an image file.'); return; }
  if (file.size > 2000000) { status('Image files must be 2 MB or smaller.'); return; }
  const reader = new FileReader();
  reader.onerror = () => status('Could not read that image file.');
  reader.onload = () => {
    const src = reader.result, img = new Image();
    img.onerror = () => status('That file could not be decoded as an image.');
    img.onload = () => {
      const factor = Math.min(1, 400 / img.naturalWidth, 400 / img.naturalHeight);
      const w = Math.max(20, Math.round(img.naturalWidth * factor)), h = Math.max(20, Math.round(img.naturalHeight * factor));
      const [cx, cy] = centre();
      const item = { name: file.name.replace(/\.[^.]+$/, ''), src, x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h, collides: false };
      M.mapImages.push(item); sel = { type: 'image', key: M.mapImages.length - 1 }; commit('Placed an image');
    };
    img.src = src;
  };
  reader.readAsDataURL(file);
}
function duplicate() {
  if (!sel || !LISTS[sel.type]) { status('This item can not be duplicated.'); return; }
  const o = clone(ref(sel)); o.x += 60; o.y += 60;
  if (sel.type === 'building') { let n = 1; while (M.buildings.some(b => b.id === 'extra' + n)) n++; o.id = 'extra' + n; o.name = o.name + ' (copy)'; }
  const arr = M[LISTS[sel.type]]; arr.push(o); sel = { type: sel.type, key: arr.length - 1 };
  commit('Duplicated');
}
function removeSel() {
  if (!deletable(sel)) { status(sel.type === 'building' ? 'This building is part of the story, so it can be moved but not deleted.' : 'This item is needed by the game, so it can be moved but not deleted.'); return; }
  const name = label(sel);
  M[LISTS[sel.type]].splice(sel.key, 1); sel = null; commit(`Deleted ${name}`);
}
// Turn the selected item a quarter turn clockwise around its centre.
function rotateSel() {
  if (!rotatable(sel)) return;
  const o = ref(sel);
  if (sel.type === 'bench') { o.rot = o.rot ? 0 : 90; commit(`Turned ${label(sel)}`); return; }
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2, ow = o.w, oh = o.h;
  o.w = oh; o.h = ow; o.x = Math.round(cx - o.w / 2); o.y = Math.round(cy - o.h / 2);
  if (sel.type === 'building') {
    if (oh) o.roof = Math.round((o.roof || 0) * o.h / oh);
    const CW = { N: 'E', E: 'S', S: 'W', W: 'N' };
    o.door = CW[SIDES.includes(o.door) ? o.door : 'S'];
  }
  commit(`Turned ${label(sel)} 90 degrees`);
}

// ── Panel ────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Four direction buttons laid out like a compass (north at the top).
function compass(cur, forWhat) {
  const b = (s) => `<button data-side="${s}" data-for="${forWhat}" class="${cur === s ? 'on' : ''}" style="width:100%">${SIDE_NAMES[s]}</button>`;
  return `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;max-width:270px;margin:4px 0">
    <span></span>${b('N')}<span></span>${b('W')}<span style="text-align:center;align-self:center;font-size:18px">🧭</span>${b('E')}<span></span>${b('S')}<span></span></div>`;
}
// One picture slot (roof / entrance front / side wall) in the building panel.
function picSlot(o, part) {
  const name = { roof: 'Roof (from above)', front: 'Front wall' }[part];
  const src = o.img && o.img[part];
  return `<div class="pic"><div class="pic-name">${name}</div>
    <div class="pic-thumb">${src ? `<img src="${esc(src)}" alt="">` : '<span>none</span>'}</div>
    <label class="filebtn">⬆ Upload<input type="file" accept="image/*" data-pic="${part}"></label>
    ${src ? `<button data-picdel="${part}" class="danger">✕</button>` : ''}</div>`;
}
// Save an uploaded picture into assets/buildings/ (through play_and_edit.py), or keep it inside the map if that isn't running.
function uploadPic(o, part, dataUrl) {
  const done = (src, how) => { o.img = { ...(o.img || {}), [part]: src }; commit(`${o.name}: ${part} picture ${how}`); };
  const inline = () => {
    if (dataUrl.length > 1500000) status('⚠ Big picture: it is stored inside the map. Start the game with Start Game.bat to save pictures as files.');
    done(dataUrl, 'added (stored in the map)');
  };
  if (!CAN_SAVE_FILE) return inline();
  status('Uploading picture…');
  fetch('api/upload-image', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: o.id, part, data: dataUrl }) })
    .then(r => r.json()).then(j => { if (!j.ok) throw new Error(j.error); done(j.path + '?v=' + Date.now(), 'saved to ' + j.path); })
    .catch((err) => { status('⚠ ' + (err.message || 'Upload failed')); inline(); });
}
function numField(k, labelTxt, o) { return `<div class="field">${labelTxt}<input type="number" data-k="${k}" value="${Math.round(o[k] || 0)}"></div>`; }
function renderPanel() {
  const el = $('#selbox');
  $('#b-undo').disabled = hi <= 0; $('#b-redo').disabled = hi >= hist.length - 1;
  renderWarnings();
  if (!sel || !ref(sel)) { el.innerHTML = '<p class="muted">Nothing selected. Click anything on the map.</p>'; return; }
  const o = ref(sel);
  const kind = { building: 'Building', road: 'Road', path: 'Paved plaza', area: 'Area', zone: 'NPC hangout spot', point: 'Landmark' }[sel.type];
  const itemKind = { rock: 'Rock', image: 'Image' }[sel.type];
  let h = `<div style="font-weight:bold;font-size:15px">${esc(label(sel))}<span class="tag">${kind || itemKind || 'Map item'}</span></div>`;
  if (sel.type === 'building') {
    h += `<div class="grid2" style="margin-top:6px">
      <div class="field full">Name<input type="text" data-k="name" value="${esc(o.name)}"></div>
      ${numField('x', 'Left (x)', o)}${numField('y', 'Top (y)', o)}${numField('w', 'Width', o)}${numField('h', 'Height', o)}
      <div class="field">Wall colour<input type="color" data-k="wall" value="${o.wall || '#eeeeee'}"></div>
      <div class="field">Roof colour<input type="color" data-k="roofC" value="${o.roofC || '#999999'}"></div>
      <div class="field">Floors<select data-k="floors">${[1, 2, 3, 4].map(n => `<option ${+o.floors === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field">Roof detail<select data-k="deco">${DECOS.map(d => `<option value="${d}" ${(o.deco || '') === d ? 'selected' : ''}>${DECO_NAMES[d]}</option>`).join('')}</select></div>
    </div>
    <div class="field full" style="margin-top:8px">🏠 Front wall faces (the roof fills the rest)</div>
    ${compass(buildingParts(o).face, 'face')}
    <div class="field full">Roof depth: <b id="roofv">${o.roof}</b><input type="range" data-k="roof" min="0" max="${Math.max(0, ((o.face === 'E' || o.face === 'W') ? o.w : o.h) - 20)}" value="${o.roof}"></div>
    <p class="muted">Bigger roof = thinner wall. Only south-facing buildings let you walk behind the roof.</p>
    <div class="field full" style="margin-top:8px">🚪 Entrance faces</div>
    ${compass(doorInfo(o).side, 'door')}
    <div class="field full">Entrance position along that wall: <b id="doorv">${Math.round(doorInfo(o).t * 100)}%</b>
      <input type="range" id="door-at" min="10" max="90" step="5" value="${Math.round(doorInfo(o).t * 100)}"></div>
    <p class="muted">Or drag the round 🚪 handle around the building.</p>
    <div class="field full" style="margin-top:10px">🖼️ Building pictures <span class="muted">(each one is stretched to fit its part)</span></div>
    <div class="pics">${['roof', 'front'].map(part => picSlot(o, part)).join('')}</div>
    <label class="chk"><input type="checkbox" id="b-name" ${o.nameBoard === false ? '' : 'checked'}> Show the name board</label>`;
    if (CORE_IDS.includes(o.id)) h += '<p class="muted">Story building: it can be moved and changed, but not deleted.</p>';
  } else if (sel.type === 'point') {
    if (isGate(sel)) {
      const gi = gateGeo(sel.key);
      h += `<div class="field full" style="margin-top:6px">${sel.key === 'gate' ? 'Which way does the front gate face?' : 'Which wall is the back gate on?'}</div>${compass(gi.side, 'gate')}
        ${sel.key === 'gate'
          ? `<div class="grid2" style="margin-top:6px"><div class="field">Map X<input type="number" id="gate-x" value="${Math.round(gi.x)}" min="0" max="${M.world.w}"></div><div class="field">Map Y<input type="number" id="gate-y" value="${Math.round(gi.y)}" min="0" max="${M.world.h}"></div></div>`
          : `<div class="field" style="margin-top:6px">Position along wall<input type="number" id="gate-at" value="${gi.at}" step="10" min="150" max="${gi.horiz ? M.world.w - 150 : M.world.h - 150}"></div>`}
        ${sel.key === 'gate' && gi.horiz ? `<div class="field" style="margin-top:6px">Front gate image width<input type="number" id="gate-width" value="${Math.round(gi.width)}" min="100" max="900" step="10"></div>` : ''}
        <p class="muted">${sel.key === 'gate' ? 'Drag the front gate anywhere on the map, or enter map X and Y. The boundary wall stays intact when the gate is moved inside.'
          : 'College buses, staff cars and bikes come in through the main gate or this back gate. Put it where a road meets the wall.'}</p>`;
    } else h += `<div class="grid2" style="margin-top:6px">${numField('x', 'x', o)}${numField('y', 'y', o)}</div>`;
  } else if (sel.type === 'lamp' || sel.type === 'bench' || sel.type === 'bin') {
    h += `<div class="grid2" style="margin-top:6px">${numField('x', 'x', o)}${numField('y', 'y', o)}</div>`;
    if (sel.type === 'bench') h += `<p class="muted">${o.rot ? 'Turned sideways.' : 'Facing you.'} Use ⟳ Rotate to turn it.</p>`;
    if (sel.type === 'bin') h += `<div class="field full" style="margin-top:4px">What is it?<select data-k="kind">${Object.keys(BIN_KINDS).map(k => `<option value="${k}" ${o.kind === k ? 'selected' : ''}>${BIN_KINDS[k]}</option>`).join('')}</select></div>`;
  } else if (sel.type === 'tree') {
    h += `<div class="grid2" style="margin-top:6px">${numField('x', 'x', o)}${numField('y', 'y', o)}
      <div class="field full">Size: <b id="treev">${Math.round((o.s || 1) * 100)}%</b><input type="range" id="tree-s" min="50" max="180" step="5" value="${Math.round((o.s || 1) * 100)}"></div>
      <div class="field full">Leaf colour<select id="tree-hue"><option value="0.1" ${o.hue < 0.33 ? 'selected' : ''}>Fresh green</option><option value="0.5" ${o.hue >= 0.33 && o.hue < 0.66 ? 'selected' : ''}>Light olive</option><option value="0.9" ${o.hue >= 0.66 ? 'selected' : ''}>Dark green</option></select></div></div>`;
  } else if (sel.type === 'rock' || sel.type === 'image') {
    h += `<div class="grid2" style="margin-top:6px">${numField('x', 'Left (x)', o)}${numField('y', 'Top (y)', o)}${numField('w', 'Width', o)}${numField('h', 'Height', o)}</div>`;
    h += `<label class="chk" style="margin-top:6px"><input type="checkbox" id="item-collision" ${sel.type === 'rock' ? (o.solid !== false ? 'checked' : '') : (o.collides ? 'checked' : '')}> Solid collision</label>`;
    h += `<p class="muted">The red outline shows the collision area. Drag the white handles or edit width and height to resize.</p>`;
    if (sel.type === 'image') h += `<div class="field full">Name<input type="text" data-k="name" value="${esc(o.name || '')}"></div>`;
  } else {
    h += `<div class="grid2" style="margin-top:6px">${numField('x', 'Left (x)', o)}${numField('y', 'Top (y)', o)}${numField('w', 'Width', o)}${numField('h', 'Height', o)}</div>`;
    if (sel.type === 'zone') h += '<p class="muted">Characters wander inside this box at certain times of day. Keep it on open ground.</p>';
    if (sel.type === 'median') h += `<div class="field full">Corner radius: <b id="median-radius-value">${Math.round(medianRadius(o))}</b><input type="range" data-k="radius" min="0" max="${Math.floor(Math.min(o.w, o.h) / 2)}" step="1" value="${Math.round(medianRadius(o))}"></div>
      <p class="muted">A solid lawn nobody can walk or drive over. Adjust its corner radius to round the ends.</p>`;
  }
  h += '<div class="row" style="margin-top:8px">';
  if (rotatable(sel)) h += '<button id="s-rot" title="Turn a quarter turn (R)">⟳ Rotate 90°</button>';
  if (LISTS[sel.type]) h += '<button id="s-dup">⧉ Duplicate</button>';
  if (deletable(sel)) h += '<button id="s-del" class="danger">🗑 Delete</button>';
  h += '<button id="s-centre">⌖ Show on screen</button></div>';
  el.innerHTML = h;
  el.querySelectorAll('[data-k]').forEach(inp => {
    const k = inp.dataset.k;
    const apply = () => {
      const v = inp.type === 'number' || inp.type === 'range' || k === 'floors' ? +inp.value : inp.value;
      if ((inp.type === 'number') && !Number.isFinite(v)) return;
      if ((k === 'w' || k === 'h') && v < 20) return;
      if (sel.type === 'median' && k === 'radius' && (v < 0 || v > Math.min(o.w, o.h) / 2)) { status("Corner radius must be between 0 and half the divider's shortest side."); return; }
      if (sel.type === 'building' && k === ((o.face === 'E' || o.face === 'W') ? 'w' : 'h') && o[k]) o.roof = Math.round(o.roof * v / o[k]);
      o[k] = v;
      if (k === 'roof') { const rv = $('#roofv'); if (rv) rv.textContent = v; }
      if (sel.type === 'median' && k === 'radius') $('#median-radius-value').textContent = Math.round(v);
      draw();
    };
    inp.addEventListener('input', apply);
    inp.addEventListener('change', () => { apply(); commit(`Changed ${label(sel)}`); });
  });
  el.querySelectorAll('[data-side]').forEach(btn => btn.onclick = () => {
    const side = btn.dataset.side;
    if (btn.dataset.for === 'door') { o.door = side; commit(`${label(sel)}: entrance now faces ${SIDE_NAMES[side]}`); }
    else if (btn.dataset.for === 'face') {
      const was = (o.face === 'E' || o.face === 'W') ? o.w : o.h, now = (side === 'E' || side === 'W') ? o.w : o.h;
      if (was) o.roof = Math.round((o.roof || 0) * now / was);   // keep the same roof-to-wall share
      o.face = side; o.door = side;                                // the entrance moves to the new front wall
      commit(`${label(sel)}: front wall now faces ${SIDE_NAMES[side]}`);
    }
    else if (sel.key === 'gate') { const gi = gateGeo(sel.key); moveMainGate(gi.x, gi.y, side); commit(`Turned the front gate to face ${SIDE_NAMES[side]}`); }
    else { const gi = gateGeo(sel.key); setGate(side, side === 'N' || side === 'S' ? (gi.horiz ? gi.at : M.world.w / 2) : (gi.horiz ? M.world.h / 2 : gi.at), sel.key); commit(`${POINT_NAMES[sel.key]} moved to the ${SIDE_NAMES[side]} wall`); }
  });
  const da = $('#door-at');
  if (da) {
    da.oninput = () => { o.doorAt = +da.value / 100; $('#doorv').textContent = da.value + '%'; draw(); };
    da.onchange = () => { o.doorAt = +da.value / 100; commit(`Moved the entrance of ${label(sel)}`); };
  }
  const ga = $('#gate-at');
  if (ga) ga.onchange = () => { const v = +ga.value; if (Number.isFinite(v)) { setGate(gateGeo(sel.key).side, v, sel.key); commit(`Moved the ${POINT_NAMES[sel.key].toLowerCase()}`); } };
  const gx = $('#gate-x'), gy = $('#gate-y');
  if (gx || gy) {
    const updateMainGate = () => {
      const x = +(gx ? gx.value : M.gate.x), y = +(gy ? gy.value : M.gate.y);
      if (Number.isFinite(x) && Number.isFinite(y)) { moveMainGate(x, y); commit('Moved the front gate'); }
    };
    if (gx) gx.onchange = updateMainGate;
    if (gy) gy.onchange = updateMainGate;
  }
  const gw = $('#gate-width');
  if (gw) gw.onchange = () => {
    const v = +gw.value;
    if (Number.isFinite(v) && v >= 100 && v <= 900) { o.width = v; syncGateZone(); commit('Resized the front gate'); }
    else { gw.value = Math.round(gateGeo('gate').width); status('Gate width must be between 100 and 900.'); }
  };
  const collision = $('#item-collision');
  if (collision) collision.onchange = () => {
    if (sel.type === 'rock') o.solid = collision.checked;
    else o.collides = collision.checked;
    commit(`${collision.checked ? 'Enabled' : 'Disabled'} collision for ${label(sel)}`);
  };
  el.querySelectorAll('input[data-pic]').forEach(inp => inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const rd = new FileReader(); rd.onload = () => uploadPic(o, inp.dataset.pic, rd.result); rd.readAsDataURL(f);
  });
  el.querySelectorAll('[data-picdel]').forEach(btn => btn.onclick = () => {
    const part = btn.dataset.picdel; if (o.img) { delete o.img[part]; if (!Object.keys(o.img).length) delete o.img; }
    commit(`${o.name}: ${part} picture removed`);
  });
  const bn = $('#b-name'); if (bn) bn.onchange = () => { if (bn.checked) delete o.nameBoard; else o.nameBoard = false; commit(`${o.name}: name board ${bn.checked ? 'shown' : 'hidden'}`); };
  const rot = $('#s-rot'); if (rot) rot.onclick = rotateSel;
  const ts = $('#tree-s');
  if (ts) { ts.oninput = () => { o.s = +ts.value / 100; $('#treev').textContent = ts.value + '%'; draw(); }; ts.onchange = () => { o.s = +ts.value / 100; commit(`Resized ${label(sel)}`); }; }
  const th = $('#tree-hue'); if (th) th.onchange = () => { o.hue = +th.value; commit(`Recoloured ${label(sel)}`); };
  const dup = $('#s-dup'); if (dup) dup.onclick = duplicate;
  const del = $('#s-del'); if (del) del.onclick = removeSel;
  $('#s-centre').onclick = () => { const b = box(sel); view.x = b.x + b.w / 2 - cv.clientWidth / 2 / view.s; view.y = b.y + b.h / 2 - cv.clientHeight / 2 / view.s; draw(); };
}
// Update the number boxes while dragging without rebuilding the whole panel.
function renderSelFields() {
  if (!sel) return; const o = ref(sel);
  $('#selbox').querySelectorAll('input[type=number][data-k]').forEach(inp => { if (document.activeElement !== inp) inp.value = Math.round(o[inp.dataset.k] || 0); });
  if (sel.type === 'median') {
    const radius = $('#selbox input[type=range][data-k="radius"]');
    if (radius) { radius.max = Math.floor(Math.min(o.w, o.h) / 2); radius.value = Math.round(medianRadius(o)); $('#median-radius-value').textContent = Math.round(medianRadius(o)); }
  }
}

function renderWarnings() {
  const out = [];
  const W = M.world.w, H = M.world.h;
  const solid = (b) => buildingParts(b).solid;
  const overl = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  M.buildings.forEach((b, i) => {
    if (b.x < 30 || b.y < 30 || b.x + b.w > W - 30 || b.y + b.h > H - 40) out.push(`${b.name} is outside the walls.`);
    const di = doorInfo(b), door = { x: di.x - 10, y: di.y - 8, w: 20, h: 16 };
    if (door.x < 30 || door.x + door.w > W - 30 || door.y < 30 || door.y + door.h > H - 42) out.push(`${b.name}: its entrance is against the boundary wall.`);
    M.buildings.forEach((c, j) => {
      if (j <= i) return;
      if (overl(solid(b), solid(c))) out.push(`${b.name} overlaps ${c.name}.`);
    });
    M.buildings.forEach((c, j) => { if (j !== i && overl(door, solid(c))) out.push(`${b.name}: door is blocked by ${c.name}.`); });
  });
  { const gi = gateInfo(M.gate, W, H), ex = { x: gi.exit.x - 15, y: gi.exit.y - 15, w: 30, h: 30 };
    const by = M.buildings.find(b => overl(ex, solid(b))); if (by) out.push(`The main gate is blocked by ${by.name}.`); }
  for (const k of Object.keys(M.zones)) { const z = M.zones[k]; if (M.buildings.some(b => overl(z, solid(b)))) out.push(`${ZONE_NAMES[k]} overlaps a building, so characters may get stuck.`); }
  $('#warnings').innerHTML = out.length ? out.slice(0, 12).map(t => `<li>⚠ ${esc(t)}</li>`).join('') : '<li class="ok">✓ No problems found.</li>';
}

// ── Static controls ──────────────────────────────────────────
function syncRefInputs() {
  $('#ref-x').value = refPic.x; $('#ref-y').value = refPic.y; $('#ref-w').value = refPic.w; $('#ref-rot').value = refPic.rot || 0; $('#ref-op').value = refPic.op;
  $('#ref-move').classList.toggle('on', refMode);
}
function initControls() {
  const L = $('#layers');
  for (const k of Object.keys(show)) {
    const lab = document.createElement('label'); lab.className = 'chk';
    lab.innerHTML = `<input type="checkbox" ${show[k] ? 'checked' : ''}> ${SHOW_NAMES[k]}`;
    lab.querySelector('input').onchange = (e) => { show[k] = e.target.checked; if (sel && !visibleType(sel.type)) { sel = null; renderPanel(); } draw(); };
    L.appendChild(lab);
  }
  $('#snap').onchange = draw;
  $('#b-undo').onclick = undo; $('#b-redo').onclick = redo;
  $('#b-play').onclick = () => {
    M.savedAt = Date.now(); M.layoutVersion = LAYOUT_VERSION;
    try { localStorage.setItem(MAP_KEY, JSON.stringify(M)); } catch (e) { /* ignore */ }
    const go = () => { location.href = 'index.html'; };
    if (!CAN_SAVE_FILE) return go();
    fetch('api/save-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(M) }).then(go, go);
  };
  $('#add-road-h').onclick = () => addRoad(true);
  $('#add-road-v').onclick = () => addRoad(false);
  $('#add-path').onclick = addPath;
  $('#add-median').onclick = addMedian;
  $('#add-building').onclick = addBuilding;
  $('#add-lamp').onclick = () => addPoint('lamp');
  $('#add-tree').onclick = () => addPoint('tree');
  $('#add-bench').onclick = () => addPoint('bench');
  $('#add-bin').onclick = () => addPoint('bin');
  $('#add-rock').onclick = addRock;
  $('#image-file').onchange = (e) => { const f = e.target.files[0]; if (f) addMapImage(f); e.target.value = ''; };
  $('#auto-lamps').onclick = () => { M.lamps = autoLamps(M); M.bins = autoBins(M); sel = null; commit('Street lights placed along the roads'); };
  $('#auto-bins').onclick = () => { M.bins = autoBins(M); sel = null; commit('Trash cans placed beside the street lights'); };
  $('#auto-trees').onclick = () => { M.trees = autoTrees(M, (Math.random() * 1e6) | 0); sel = null; commit('Trees scattered again'); };
  $('#clear-trees').onclick = () => { M.trees = []; sel = null; commit('Removed all trees'); };
  $('#z-in').onclick = () => zoomAt(1.25, cv.clientWidth / 2, cv.clientHeight / 2);
  $('#z-out').onclick = () => zoomAt(0.8, cv.clientWidth / 2, cv.clientHeight / 2);
  $('#z-fit').onclick = fit;
  // world size
  $('#world-w').value = M.world.w; $('#world-h').value = M.world.h;
  const ws = () => { const w = +$('#world-w').value, h = +$('#world-h').value; if (w >= 1200 && h >= 900) { M.world.w = w; M.world.h = h; commit('Map size changed'); } };
  $('#world-w').onchange = ws; $('#world-h').onchange = ws;
  // reference picture
  $('#ref-file').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const rd = new FileReader();
    rd.onload = () => { refPic.src = rd.result; refImg.onload = () => { refPic.x = 0; refPic.y = 0; refPic.w = M.world.w; refImg.onload = draw; saveRef(); status('Picture loaded. Use "Move/size picture" to line it up.'); }; refImg.src = rd.result; };
    rd.readAsDataURL(f); e.target.value = '';
  };
  $('#ref-move').onclick = () => { if (!refPic.src) { status('Load a picture first.'); return; } refMode = !refMode; if (refMode) { sel = null; renderPanel(); status('Picture mode: drag to move, wheel to resize. Click the button again when done.'); } syncRefInputs(); draw(); };
  $('#ref-fit').onclick = () => { if (!refPic.src) return; refPic.x = 0; refPic.y = 0; refPic.w = M.world.w; saveRef(); };
  $('#ref-clear').onclick = () => { refPic = { src: null, x: 0, y: 0, w: 1000, rot: 0, op: 0.5 }; refMode = false; try { localStorage.removeItem(REF_KEY); } catch (e) { /* ignore */ } syncRefInputs(); draw(); };
  $('#ref-op').oninput = (e) => { refPic.op = +e.target.value; draw(); };
  $('#ref-op').onchange = saveRef;
  for (const [id, k] of [['#ref-x', 'x'], ['#ref-y', 'y'], ['#ref-w', 'w'], ['#ref-rot', 'rot']]) $(id).onchange = (e) => { const v = +e.target.value; if (Number.isFinite(v) && (k !== 'w' || v > 10)) { refPic[k] = v; saveRef(); } };
  // export / import / reset
  $('#b-export').onclick = () => {
    const txt = '// MVSR map layout, made with the visual Map Editor (editor.html).\n'
      + '// Put this file in the game\'s js/ folder (replace the old custom_map.js) to make it the default map.\n'
      + 'window.CUSTOM_MAP = ' + JSON.stringify(M, null, 1) + ';\n';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/javascript' })); a.download = 'custom_map.js';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    status('Exported custom_map.js. Copy it into the game\'s js folder.');
  };
  $('#imp-file').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    f.text().then(t => {
      try {
        let m = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
        if (!m || !Array.isArray(m.buildings) || !Array.isArray(m.roads)) throw new Error('not a map');
        m = upgradeMap(m);   // older map files get turned to the gate view
        M = ensureExtras({ ...clone(DEFAULT_MAP), ...m }); sel = null; commit('Imported map'); fit();
      } catch (err) { status('⚠ That file is not a map exported from this editor.'); }
    });
    e.target.value = '';
  };
  let resetArm = 0;
  $('#b-reset').onclick = (e) => {
    if (Date.now() - resetArm > 3000) { resetArm = Date.now(); e.target.textContent = '⚠ Click again to confirm reset'; setTimeout(() => { e.target.textContent = '⟲ Reset to original map'; }, 3000); return; }
    M = ensureExtras(clone(DEFAULT_MAP)); sel = null;
    $('#world-w').value = M.world.w; $('#world-h').value = M.world.h;
    commit('Reset to the original map'); fit();
    e.target.textContent = '⟲ Reset to original map';
  };
}
function visibleType(t) { return { building: show.buildings, road: show.roads, path: show.paths, median: show.medians, area: show.areas, zone: show.zones, point: show.points, lamp: show.lamps, tree: show.trees, bench: show.benches, bin: show.bins, rock: show.rocks, image: show.mapImages }[t]; }

window.addEventListener('resize', resize);
window.onBuildingImage = () => draw();   // redraw when an uploaded picture finishes loading
initControls(); syncRefInputs(); renderPanel();
if (CAN_SAVE_FILE) fetch('api/ping').then(r => r.json()).then(j => setSaveState(!!j.ok)).catch(() => setSaveState(false)); else setSaveState(false);
resize(); fit();
if (document.fonts) document.fonts.ready.then(draw);
