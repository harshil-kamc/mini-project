'use strict';
// Applies a saved layout on top of the built-in one in data.js (which is drawn over the
// hand-drawn picture assets/campus_map.png). Saves from the visual Map Editor (editor.html)
// are kept in js/custom_map.js and in this browser; whichever is newer wins; data.js is the fallback.
const MAP_KEY = 'mvsr_custom_map_v2';
// Layout version 4 = the campus seen from the main gate: turned 90° anticlockwise from a north-up map
// (real-life west at the bottom, north on the left). Maps saved north-up (no version, or version 3) are turned
// automatically when loaded, keeping every building's wall direction, roof and entrance pointing the same real way.
// Version 5 adds the second, library-side parking lot; version 6 adds editable rocks and images.
const LAYOUT_VERSION = 6;
// Items placed in the editor (null = use automatic placement for the original decorations).
const MAP_EXTRAS = { lamps: null, trees: null, benches: null, bins: null, rocks: null, mapImages: null, backGate: null };
const snapshotMap = () => JSON.parse(JSON.stringify({
  world: { w: WORLD_W, h: WORLD_H }, buildings: BUILDINGS, roads: ROADS, paths: PATHS, medians: MEDIANS,
  areas: AREAS, zones: ZONES, gate: GATE, fountain: FOUNTAIN, notice: NOTICE,
  lamps: MAP_EXTRAS.lamps, trees: MAP_EXTRAS.trees, benches: MAP_EXTRAS.benches, bins: MAP_EXTRAS.bins,
  rocks: MAP_EXTRAS.rocks, mapImages: MAP_EXTRAS.mapImages, backGate: MAP_EXTRAS.backGate, layoutVersion: LAYOUT_VERSION,
}));
const DEFAULT_MAP = snapshotMap();
const STORY_IDS = ['hostel', 'hostel2', 'canteen', 'audi', 'blockA', 'blockB', 'labs', 'library', 'admin'];   // used by the timetable/quests

// Turn a north-up map a quarter turn anticlockwise (the gate view).
function rotateMap(src) {
  const m = JSON.parse(JSON.stringify(src)), W = m.world.w, H = m.world.h;
  const R = (r) => ({ ...r, x: r.y, y: W - r.x - r.w, w: r.h, h: r.w });
  const P = (p) => ({ ...p, x: p.y, y: W - p.x });
  const SIDE = { N: 'W', W: 'S', S: 'E', E: 'N' };
  m.world = { w: H, h: W };
  m.buildings = (m.buildings || []).map((b) => {
    const n = R(b), door = SIDES.includes(b.door) ? b.door : 'S', t = b.doorAt ?? 0.5;
    n.face = SIDE[SIDES.includes(b.face) ? b.face : 'S'];   // the front wall turns with the building (roof depth stays the same)
    n.door = SIDE[door];
    if (door === 'N' || door === 'S') n.doorAt = Math.round((1 - t) * 100) / 100; else if (b.doorAt != null) n.doorAt = t;
    delete n.corner;
    return n;
  });
  for (const k of ['roads', 'paths', 'medians']) m[k] = (m[k] || []).map(R);
  for (const k of ['areas', 'zones']) { const o = {}; for (const [n, r] of Object.entries(m[k] || {})) o[n] = R(r); m[k] = o; }
  for (const k of ['fountain', 'notice']) if (m[k]) m[k] = P(m[k]);
  for (const k of ['lamps', 'trees', 'bins']) if (Array.isArray(m[k])) m[k] = m[k].map(P);
  if (Array.isArray(m.benches)) m.benches = m.benches.map(b => ({ ...P(b), rot: b.rot ? 0 : 90 }));
  for (const k of ['rocks', 'mapImages']) if (Array.isArray(m[k])) m[k] = m[k].map(R);
  if (m.gate) {
    const gi = gateInfo(m.gate, W, H), p = P({ x: gi.x, y: gi.y }), side = SIDE[gi.side];
    m.gate = { x: side === 'N' || side === 'S' ? p.x : Math.round(H / 2), y: side === 'E' || side === 'W' ? p.y : 0, side };
  }
  m.layoutVersion = LAYOUT_VERSION;
  return m;
}
function addLibraryParking(m) {
  m.areas = m.areas || {};
  if (!m.areas.parking2) {
    const p = m.areas.parking, library = m.buildings.find(b => b.id === 'library');
    const target = { x: 30, y: library ? Math.max(30, library.y - 507) : 963, w: 500, h: 500 };
    const overlaps = p && p.x < target.x + target.w && p.x + p.w > target.x && p.y < target.y + target.h && p.y + p.h > target.y;
    if (!p || overlaps) m.areas.parking = { x: 30, y: 30, w: 270, h: 470 };
    m.areas.parking2 = target;
  }
  m.layoutVersion = LAYOUT_VERSION;
  return m;
}
const upgradeMap = (m) => {
  if (!m || !Array.isArray(m.buildings) || !m.world) return m;
  if (m.layoutVersion >= LAYOUT_VERSION) return m;
  if ([2, 4, 5].includes(m.layoutVersion)) return addLibraryParking(m); // already in the gate view
  return addLibraryParking(rotateMap(m));                                       // north-up (no version / version 3)
};

function readSavedMap() {
  let local = null;
  try { const s = localStorage.getItem(MAP_KEY); if (s) local = upgradeMap(JSON.parse(s)); } catch (e) { /* storage unavailable */ }
  const file = upgradeMap(window.CUSTOM_MAP || null);
  if (!local) return file;
  if (!file) return local;
  return (local.savedAt || 0) > (file.savedAt || 0) ? local : file;   // the file wins a tie
}

function applyMap(m) {
  if (!m) return;
  try {
    if (m.world && m.world.w > 0 && m.world.h > 0) { WORLD_W = Math.round(m.world.w); WORLD_H = Math.round(m.world.h); }
    const fill = (arr, src) => { if (Array.isArray(src)) { arr.length = 0; for (const o of src) arr.push(o); } };
    fill(BUILDINGS, m.buildings); fill(ROADS, m.roads); fill(PATHS, m.paths); fill(MEDIANS, m.medians);
    const merge = (o, src) => { if (src) Object.assign(o, src); };
    merge(AREAS, m.areas); merge(ZONES, m.zones);
    merge(GATE, m.gate); merge(FOUNTAIN, m.fountain); merge(NOTICE, m.notice);
    for (const k of ['lamps', 'trees', 'benches', 'bins', 'rocks', 'mapImages']) MAP_EXTRAS[k] = Array.isArray(m[k]) ? m[k] : null;
    MAP_EXTRAS.backGate = m.backGate && SIDES.includes(m.backGate.side) ? m.backGate : null;
    // The story and timetable need these buildings, so they can never go missing.
    for (const d of DEFAULT_MAP.buildings) if (STORY_IDS.includes(d.id) && !BUILDINGS.some(b => b.id === d.id)) BUILDINGS.push(d);
  } catch (e) { console.warn('Custom map could not be applied; using the built-in map.', e); }
}

// ── Entrances (shared by the game and the editor) ────────────
// A building's entrance: b.door = 'N' | 'E' | 'S' | 'W' (which wall it is on; default south),
// b.doorAt = 0.1–0.9 (where along that wall; default the middle).
const SIDES = ['N', 'E', 'S', 'W'];
const SIDE_NAMES = { N: 'Top ↑', E: 'Right →', S: 'Bottom ↓', W: 'Left ←' };   // screen directions (the map is seen from the main gate)
// Which way a building's front wall faces: b.face = 'S' (default: roof at the top, wall below it),
// 'N' (wall at the top, roof below), 'E' (wall on the right, roof on the left) or 'W' (wall on the left).
// b.roof is the roof's depth measured towards the front wall. Returns the roof, wall and solid rectangles.
function buildingParts(b) {
  const face = SIDES.includes(b.face) ? b.face : 'S';
  const along = face === 'E' || face === 'W' ? b.w : b.h;
  const roof = Math.max(0, Math.min(b.roof || 0, along - 20));
  let roofR, wallR, solid;
  if (face === 'S') { roofR = { x: b.x, y: b.y, w: b.w, h: roof }; wallR = { x: b.x, y: b.y + roof, w: b.w, h: b.h - roof }; solid = { x: b.x, y: b.y + roof + 10, w: b.w, h: Math.max(10, b.h - roof - 10) }; }
  else {
    if (face === 'N') { wallR = { x: b.x, y: b.y, w: b.w, h: b.h - roof }; roofR = { x: b.x, y: b.y + b.h - roof, w: b.w, h: roof }; }
    else if (face === 'E') { roofR = { x: b.x, y: b.y, w: roof, h: b.h }; wallR = { x: b.x + roof, y: b.y, w: b.w - roof, h: b.h }; }
    else { wallR = { x: b.x, y: b.y, w: b.w - roof, h: b.h }; roofR = { x: b.x + b.w - roof, y: b.y, w: roof, h: b.h }; }
    solid = { x: b.x, y: b.y + 20, w: b.w, h: Math.max(10, b.h - 20) };   // only S-facing buildings have a walk-behind roof
  }
  return { face, roof, roofR, wallR, solid };
}
function doorInfo(b) {
  const side = SIDES.includes(b.door) ? b.door : 'S';
  const t = Math.min(0.9, Math.max(0.1, Number.isFinite(+b.doorAt) && b.doorAt !== '' ? +b.doorAt : 0.5));
  const sol = buildingParts(b).solid, top = sol.y, wh = sol.h;
  if (side === 'N') { const x = b.x + b.w * t; return { side, t, x, y: b.y - 20, ox: 0, oy: -1, mat: { x: x - 26, y: b.y - 14, w: 52, h: 12 } }; }
  if (side === 'E') { const y = top + wh * t; return { side, t, x: b.x + b.w + 20, y, ox: 1, oy: 0, mat: { x: b.x + b.w, y: y - 30, w: 12, h: 40 } }; }
  if (side === 'W') { const y = top + wh * t; return { side, t, x: b.x - 20, y, ox: -1, oy: 0, mat: { x: b.x - 12, y: y - 30, w: 12, h: 40 } }; }
  const x = b.x + b.w * t; return { side: 'S', t, x, y: b.y + b.h + 20, ox: 0, oy: 1, mat: { x: x - 26, y: b.y + b.h, w: 52, h: 12 } };
}
// The main gate is boundary-attached by default; editor layouts may store a free map position and facing.
function gateInfo(gate, W, H) {
  const side = SIDES.includes(gate.side) ? gate.side : 'N';
  const horiz = side === 'N' || side === 'S';
  const width = Math.min(900, Math.max(100, Number.isFinite(+gate.width) ? +gate.width : 400));
  const scale = horiz ? width / 400 : 1;
  if (gate.free === true) {
    const x = Math.round(Math.min(W, Math.max(0, gate.x))), y = Math.round(Math.min(H, Math.max(0, gate.y)));
    if (horiz) return {
      side, horiz, at: x, x, y, width, freePosition: true, onBoundary: false, gap: [],
      exit: { x, y: y + (side === 'N' ? 50 : -50) * scale },
      box: { x: x - 230 * scale, y: y - 165 * scale, w: 460 * scale, h: 180 * scale },
      pillars: [{ x: x - 180 * scale, y: y - 42 * scale, w: 42 * scale, h: 30 * scale }, { x: x + 138 * scale, y: y - 42 * scale, w: 42 * scale, h: 30 * scale }],
      clear: { x: x - 210 * scale, y: y - 150 * scale, w: 420 * scale, h: 280 * scale }, sortY: y,
    };
    const px = side === 'E' ? x - 80 : x + 35;
    return {
      side, horiz, at: y, x, y, width, freePosition: true, onBoundary: false, gap: [],
      exit: { x: x + (side === 'E' ? -50 : 50), y },
      box: { x: x - 90, y: y - 305, w: 90, h: 500 },
      pillars: [{ x: px, y: y - 185, w: 45, h: 30 }, { x: px, y: y + 155, w: 45, h: 30 }],
      clear: { x: x - 280, y: y - 320, w: 280, h: 540 }, sortY: y + 185,
    };
  }
  const at = Math.round(horiz ? Math.min(W, Math.max(0, gate.x ?? W / 2)) : Math.min(H, Math.max(0, gate.y ?? H / 2)));
  const o = { side, horiz, at, width, onBoundary: true };
  // The gate picture (assets/gate_main.png) is drawn 400 wide x 143 deep; its pillars stand ~140–180 px either side of the centre.
  const gap = [at - 140 * scale, at + 140 * scale];
  if (side === 'N') Object.assign(o, { x: at, y: 0, exit: { x: at, y: 45 * scale }, gap, box: { x: at - 200 * scale, y: 0, w: 400 * scale, h: 143 * scale },
    pillars: [{ x: at - 180 * scale, y: 108 * scale, w: 42 * scale, h: 30 * scale }, { x: at + 138 * scale, y: 108 * scale, w: 42 * scale, h: 30 * scale }], clear: { x: at - 210 * scale, y: 0, w: 420 * scale, h: 240 * scale }, sortY: 140 * scale });
  else if (side === 'S') Object.assign(o, { x: at, y: H, exit: { x: at, y: H - 50 * scale }, gap, box: { x: at - 200 * scale, y: H - 150 * scale, w: 400 * scale, h: 150 * scale },
    pillars: [{ x: at - 180 * scale, y: H - 72 * scale, w: 42 * scale, h: 30 * scale }, { x: at + 138 * scale, y: H - 72 * scale, w: 42 * scale, h: 30 * scale }], clear: { x: at - 210 * scale, y: H - 280 * scale, w: 420 * scale, h: 280 * scale }, sortY: H });
  else if (side === 'E') Object.assign(o, { x: W, y: at, exit: { x: W - 50, y: at }, gap, box: { x: W - 90, y: at - 305, w: 90, h: 500 },
    pillars: [{ x: W - 80, y: at - 185, w: 45, h: 30 }, { x: W - 80, y: at + 155, w: 45, h: 30 }], clear: { x: W - 280, y: at - 320, w: 280, h: 540 }, sortY: at + 185 });
  else Object.assign(o, { x: 0, y: at, exit: { x: 50, y: at }, gap, box: { x: 0, y: at - 305, w: 90, h: 500 },
    pillars: [{ x: 35, y: at - 185, w: 45, h: 30 }, { x: 35, y: at + 155, w: 45, h: 30 }], clear: { x: 0, y: at - 320, w: 280, h: 540 }, sortY: at + 185 });
  return o;
}
// ── Back gate (a smaller second gate; by default on the left wall where a road meets it) ──
function autoBackGate(m) {
  const W = m.world.w, H = m.world.h, gi = gateInfo(m.gate, W, H);
  const touching = (m.roads || []).filter(r => r.w >= r.h && r.x <= 40).sort((a, b) => b.h - a.h);
  if (gi.side !== 'W' && touching.length) return { side: 'W', x: 0, y: Math.round(touching[0].y + touching[0].h / 2) };
  const right = (m.roads || []).filter(r => r.w >= r.h && r.x + r.w >= W - 40).sort((a, b) => b.h - a.h);
  if (right.length) return { side: 'E', x: W, y: Math.round(right[0].y + right[0].h / 2) };
  return { side: gi.side === 'W' ? 'E' : 'W', x: 0, y: Math.round(H * 0.45) };
}
const getBackGate = () => MAP_EXTRAS.backGate || autoBackGate(snapshotMap());
function backGateInfo(bg, W, H) {
  const side = SIDES.includes(bg.side) ? bg.side : 'W', horiz = side === 'N' || side === 'S';
  const at = Math.round(horiz ? Math.min(W - 150, Math.max(150, bg.x || W / 2)) : Math.min(H - 150, Math.max(150, bg.y || H / 2)));
  const gap = [at - 85, at + 85];
  const inward = { N: [0, 1], S: [0, -1], E: [-1, 0], W: [1, 0] }[side];
  const o = { side, horiz, at, gap, inward, back: true };
  if (side === 'W') Object.assign(o, { x: 0, y: at, inside: { x: 45, y: at }, outside: { x: -10, y: at }, box: { x: 0, y: at - 140, w: 80, h: 250 },
    pillars: [{ x: 30, y: at - 105, w: 34, h: 20 }, { x: 30, y: at + 85, w: 34, h: 20 }], sortY: at + 105 });
  else if (side === 'E') Object.assign(o, { x: W, y: at, inside: { x: W - 45, y: at }, outside: { x: W + 10, y: at }, box: { x: W - 80, y: at - 140, w: 80, h: 250 },
    pillars: [{ x: W - 64, y: at - 105, w: 34, h: 20 }, { x: W - 64, y: at + 85, w: 34, h: 20 }], sortY: at + 105 });
  else if (side === 'N') Object.assign(o, { x: at, y: 0, inside: { x: at, y: 50 }, outside: { x: at, y: -10 }, box: { x: at - 110, y: 0, w: 220, h: 110 },
    pillars: [{ x: at - 105, y: 70, w: 20, h: 24 }, { x: at + 85, y: 70, w: 20, h: 24 }], sortY: 94 });
  else Object.assign(o, { x: at, y: H, inside: { x: at, y: H - 55 }, outside: { x: at, y: H + 10 }, box: { x: at - 110, y: H - 110, w: 220, h: 110 },
    pillars: [{ x: at - 105, y: H - 66, w: 20, h: 24 }, { x: at + 85, y: H - 66, w: 20, h: 24 }], sortY: H });
  return o;
}

// ── Parking plan: a one-way loop with angled bays ──
// The lot is laid out in a local frame: v runs from the entrance end (v = 0) to the far end, u runs across it
// (u grows to the right of a car driving in). Traffic drives on the left (India):
//   in  : up the left lane of the aisle → round the turning loop at the far end → back down the right lane
//   park: angled "sawtooth" bus bays on one side, angled car bays on the other, entered forwards from the out lane
//   leave: reverse out, straighten up, and drive down the out lane to the entrance.
// Every bay: { kind, cx, cy, ang (nose direction, radians), L, W, poly (4 corners), r (bounding box), aisle (door spot) }
function parkingPlan(P, roads) {
  const tall = P.h >= P.w, U = tall ? P.w : P.h, V = tall ? P.h : P.w;
  // Entrance = the short side nearest a road.
  const ends = tall ? [{ x: P.x + P.w / 2, y: P.y + P.h, d: [0, -1] }, { x: P.x + P.w / 2, y: P.y, d: [0, 1] }]
    : [{ x: P.x, y: P.y + P.h / 2, d: [1, 0] }, { x: P.x + P.w, y: P.y + P.h / 2, d: [-1, 0] }];
  const roadDist = (p) => (roads || []).reduce((m, r) => Math.min(m, Math.hypot(Math.max(r.x - p.x, 0, p.x - r.x - r.w), Math.max(r.y - p.y, 0, p.y - r.y - r.h))), 1e9);
  const ent = roads && roads.length && roadDist(ends[1]) < roadDist(ends[0]) ? ends[1] : ends[0];
  const din = ent.d, rgt = [-din[1], din[0]];                       // inward, and right of a car driving in
  const E0 = { x: ent.x - rgt[0] * U / 2, y: ent.y - rgt[1] * U / 2 };
  const W2 = (u, v) => ({ x: E0.x + rgt[0] * u + din[0] * v, y: E0.y + rgt[1] * u + din[1] * v });
  const angOf = (du, dv) => Math.atan2(rgt[1] * du + din[1] * dv, rgt[0] * du + din[0] * dv);   // local direction → world angle

  // Sized for VehicleArt.SCALE = 1.3: a two-lane aisle, car bays on the left band, near-parallel bus bays
  // on the right band — right beside the out lane, so a long bus only has to pull over, not cut across the aisle.
  const compact = V < 600;
  const AISLE = compact ? (U >= 450 ? 270 : U < 320 ? 140 : 100) : 100;
  let Db = compact ? Math.min(75, Math.max(60, U * 0.25)) : 75, Dc = U - AISLE - Db;
  if (Dc < 60) { Dc = Math.max(0, U - AISLE); Db = 0; }
  if (Dc > 130) { Db = Math.min(110, Db + Dc - 130); Dc = U - AISLE - Db; }
  if (compact && U < 320) { Db = 0; Dc = Math.max(0, U - AISLE); }
  const BAND_L = Dc;   // left band depth (cars); the aisle starts after it
  const a0 = BAND_L, laneIn = a0 + AISLE * 0.25, laneOut = a0 + AISLE * 0.79, mid = a0 + AISLE / 2;
  const R = compact ? (U >= 450 ? 88 : U < 320 ? 50 : Math.min(72, Math.max(50, U / 2 - 30))) : Math.min(95, Math.max(40, U / 2 - 30)), Vc = V - R - 22; // turning loop at the far end
  const vLast = compact ? Vc - 2 * R - 8 : Vc - 120;                 // compact lots reserve the turning apron without sacrificing every bay
  const bays = { bus: [], car: [] };
  const wideLot = U >= 450;

  // Angled bays along one side. side −1 = left band (u in [0, depth]), +1 = right band.
  // noseUp: the bay is angled with the flow up the in lane (drive straight in from it); otherwise it faces the entrance
  // and is entered coming down the out lane.
  function row(kind, side, depth, L, W, gap, vFrom, vTo, minPhi = 0.2, noseUp = false, maxPhi = 0.785) {
    let phi = maxPhi;
    { while (phi > minPhi && L * Math.sin(phi) + W * Math.cos(phi) > depth - 2) phi -= 0.01; }
    const sn = Math.sin(phi), cs = Math.cos(phi);
    if (L * sn + W * cs > depth + 1) return;
    const n = [side * sn, noseUp ? cs : -cs];                        // nose: angled into the side, up the lot or towards the entrance
    const ext = L * cs + W * sn, pitch = ext + gap;
    const uc = side < 0 ? depth / 2 : U - depth / 2;
    for (let vc = vFrom + ext / 2; vc + ext / 2 <= vTo; vc += pitch) {
      const c = W2(uc, vc), ang = angOf(n[0], n[1]);
      const ax = Math.cos(ang), ay = Math.sin(ang), px = -ay, py = ax;
      const poly = [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]].map(([a, b]) => ({ x: c.x + ax * a + px * b, y: c.y + ay * a + py * b }));
      const xs = poly.map(p => p.x), ys = poly.map(p => p.y);
      const r = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
      // local info for the driving lines
      const loc = { uc, vc, n, L, phi, noseUp };
      bays[kind].push({ kind, cx: c.x, cy: c.y, ang, L, W, poly, r, loc, side, aisle: W2(side < 0 ? a0 + 10 : a0 + AISLE - 10, vc), taken: null });
    }
  }
  if (!compact && Db >= 60) row('bus', 1, Db, 198, 54, 4, 190, vLast - 30, 0.04);   // the front bus needs room to pull out into the exit lane
  if (compact) {
    const bayEnd = Math.max(30, V - 30);
    if (Dc >= 60) row('car', -1, Dc, 114, 54, 4, 0, bayEnd, 0.04, false, Math.PI / 2);
    if (wideLot && Db >= 60) row('bus', 1, Db, 198, 54, 10, 0, bayEnd, 0.04);
    else if (Db >= 60) row('car', 1, Db, 114, 54, 4, 0, bayEnd, 0.04);
  } else if (Dc >= 60) row('car', -1, Dc, 114, 54, 4, 235, vLast - 30, 0.2, true);   // the mouth stays clear: a bus's nose sweeps wide while it straightens up after turning in
  // nearest the entrance first
  for (const k of Object.keys(bays)) bays[k].sort((a, b) => a.loc.vc - b.loc.vc);

  // ── driving lines (world points) ──
  const pts = (list) => list.map(([u, v]) => W2(u, v));
  const loopU = U >= 450 ? mid - 32 : compact && U < 320 ? mid + 15 : U / 2;
  const loop = [];
  for (let k = 0; k <= 12; k++) { const t = Math.PI - (k / 12) * Math.PI; loop.push([loopU + Math.cos(t) * R, Vc + Math.sin(t) * R]); }
  const lines = {
    // entrance → up the in lane → round the loop → top of the out lane
    loop: pts([[laneIn, -10], [laneIn, 36], [laneIn, Vc - 150], [loopU - R * 0.75, Vc - 40], ...loop, [loopU + R * 0.75, Vc - 40], [laneOut, Vc - 150]]),
    outAt: (v) => W2(laneOut, v),
    inAt: (v) => W2(laneIn, v),
    exit: pts([[laneOut, 36], [laneOut, -10]]),
    vOf: (p) => (p.x - E0.x) * din[0] + (p.y - E0.y) * din[1],
  };
  // How to get into a bay — straight off the in lane (noseUp bays) or coming down the out lane — and back out again.
  for (const b of [...bays.bus, ...bays.car]) {
    const { uc, vc, n, L, noseUp } = b.loc, lane = noseUp ? laneIn : laneOut, dv = noseUp ? 1 : -1;   // dv: direction of travel along the lot
    const pre = [uc - n[0] * L * 0.9, vc - n[1] * L * 0.9];          // centre one length behind the bay
    const lat = Math.abs(pre[0] - lane);
    let v0 = pre[1] - dv * Math.max(L * (noseUp ? 0.45 : 0.9), lat * (noseUp ? 2.4 : 1.6));
    if (!noseUp) v0 = Math.min(v0, Vc - 50);                          // far bays: straight off the turning loop
    // right-band (bus) bays fill from the exit end, so a bus only ever passes empty bays: it comes straight off the
    // turning loop down its own side to the bay, with no jog across to the out lane and back
    b.direct = !noseUp && b.side > 0;
    b.enter = b.direct ? pts([pre, [uc - n[0] * L * 0.25, vc - n[1] * L * 0.25], [uc, vc]])
      : pts([[lane, v0], [(lane + pre[0]) / 2, pre[1] - dv * Math.abs(v0 - pre[1]) * 0.4], pre, [uc - n[0] * L * 0.25, vc - n[1] * L * 0.25], [uc, vc]]);
    b.vEnter = b.direct ? pre[1] : v0;
    // reversing out: straight back along the bay, then curve so the last stretch runs straight along the lane.
    // Out-lane bays end up pointing at the exit; in-lane bays end up pointing up the lot, and go round the loop.
    const ur = noseUp ? laneIn : b.side < 0 ? mid : laneOut;
    let v1 = vc - n[1] * L * 0.9 - dv * 24, v2 = v1 - dv * L * 0.6;
    if (noseUp) { v1 = Math.max(v1, 60); v2 = Math.max(v2, 40); if (v2 > v1 - 12) v2 = v1 - 12; }   // never back out into the driveway
    b.leave = pts([[uc - n[0] * L * 0.6, vc - n[1] * L * 0.6], [ur, v1], [ur, v2]]);
    b.vLane = v2;
    // shallow (near-parallel) bays can also pull out forwards when the bay ahead is empty
    if (b.loc.phi < 0.35) {
      const vf = Math.max(vc - L * 1.5, 46), vm = Math.max(vc - L, vf + 45);   // stay inside the lot
      b.leaveFwd = pts([[uc - n[0] * L * 0.15, vc - L * 0.5], [(uc + laneOut) / 2, vm], [laneOut, vf]]);
      b.vLaneFwd = vf;
    }
  }
  return { P, tall, U, V, bays, compact, ends: [W2(mid, 0)], entry: W2(mid, 0), lines, aisle: { a0, AISLE, laneIn, laneOut, mid, R, Vc, vLast }, W2, angOf, din, rgt };
}

function parkingAreas(areas = AREAS) {
  return Object.entries(areas || {}).filter(([k, a]) => /^parking\d*$/.test(k) && a && a.w > 0 && a.h > 0).map(([, a]) => a);
}

// Driveway from the end of the parking aisle to the nearest road (an L-shaped strip of asphalt).
function lotDriveway(plan, roads) {
  let best = null;
  for (const e of plan.ends) for (const r of roads) {
    const px = Math.min(r.x + r.w, Math.max(r.x, e.x)), py = Math.min(r.y + r.h, Math.max(r.y, e.y)), d = Math.hypot(px - e.x, py - e.y);
    if (!best || d < best.d) best = { d, end: e, road: { x: px, y: py } };
  }
  if (!best) return null;
  const e = best.end, q = best.road, H2 = 52;   // two lanes wide
  const legs = plan.tall
    ? [{ x: e.x - H2, y: Math.min(e.y, q.y), w: 2 * H2, h: Math.abs(q.y - e.y) }, { x: Math.min(e.x, q.x) - H2, y: q.y - H2, w: Math.abs(q.x - e.x) + 2 * H2, h: 2 * H2 }]
    : [{ x: Math.min(e.x, q.x), y: e.y - H2, w: Math.abs(q.x - e.x), h: 2 * H2 }, { x: q.x - H2, y: Math.min(e.y, q.y) - H2, w: 2 * H2, h: Math.abs(q.y - e.y) + 2 * H2 }];
  return { entry: e, road: q, legs: legs.filter(l => l.w > 1 && l.h > 1) };
}

// Boundary wall pieces (thickness: 30 on N/E/W, 40 on S) with the gate openings left out.
// `gis` is one gate description or a list of them (main gate + back gate).
function wallPieces(gis, W, H) {
  const list = Array.isArray(gis) ? gis : [gis];
  const out = [];
  const seg = (side, a0, a1, rect) => {
    const gaps = list.filter(g => g && g.onBoundary !== false && g.side === side).map(g => g.gap).sort((p, q) => p[0] - q[0]);
    let a = a0;
    for (const [g0, g1] of gaps) { if (g0 > a) out.push(rect(a, Math.min(g0, a1))); a = Math.max(a, g1); }
    if (a < a1) out.push(rect(a, a1));
  };
  seg('N', 0, W, (a, b) => ({ x: a, y: 0, w: b - a, h: 30 }));
  seg('S', 0, W, (a, b) => ({ x: a, y: H - 40, w: b - a, h: 40 }));
  seg('W', 0, H, (a, b) => ({ x: 0, y: a, w: 30, h: b - a }));
  seg('E', 0, H, (a, b) => ({ x: W - 30, y: a, w: 30, h: b - a }));
  return out;
}

// ── Automatic placement (used until street lights / trees / benches are placed in the editor) ──
function _rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const _ov = (a, b, pad = 0) => a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
// Street lights every ~300 px along each road edge.
// Street lights every ~300 px, alternating sides of the road, standing on the footpath.
function autoLamps(m) {
  const out = [];
  for (const r of m.roads) {
    const horiz = r.w >= r.h, len = horiz ? r.w : r.h;
    if (len < 400 || Math.min(r.w, r.h) < 40) continue;
    let k = 0;
    for (let d = 150; d < len - 60; d += 300, k++) {
      const raw = horiz ? { x: r.x + d, y: k % 2 ? r.y + 2 : r.y + r.h - 2 } : { x: k % 2 ? r.x + 2 : r.x + r.w - 2, y: r.y + d };
      const l = seatLamp(raw, m.roads, m.buildings);
      if (l) out.push({ x: l.x, y: l.y });
    }
  }
  return out;
}
// Put a street light on the footpath beside its nearest road and say which side it stands on
// ('L'/'R' of an up-down road, 'T'/'B' of a left-right road), so it can lean over the road.
// Returns null if there's no room (another road or a building in the way).
function seatLamp(l, roads, buildings) {
  let best = null, bd = 1e9;
  for (const r of roads) {
    const dx = Math.max(r.x - l.x, 0, l.x - (r.x + r.w)), dy = Math.max(r.y - l.y, 0, l.y - (r.y + r.h)), d = Math.hypot(dx, dy);
    if (d < bd) { bd = d; best = r; }
  }
  if (!best || bd > 60) return { x: l.x, y: l.y, side: null };
  const r = best, horiz = r.w >= r.h, cl = (v, a, b) => Math.min(b, Math.max(a, v));
  const spot = (side) => side === 'T' ? { x: cl(l.x, r.x + 20, r.x + r.w - 20), y: r.y - 8, side }
    : side === 'B' ? { x: cl(l.x, r.x + 20, r.x + r.w - 20), y: r.y + r.h + 14, side }
    : side === 'L' ? { x: r.x - 10, y: cl(l.y, r.y + 30, r.y + r.h - 10), side }
    : { x: r.x + r.w + 10, y: cl(l.y, r.y + 30, r.y + r.h - 10), side };
  const bad = (q) => roads.some(o => q.x > o.x - 4 && q.x < o.x + o.w + 4 && q.y > o.y - 4 && q.y < o.y + o.h + 4)
    || buildings.some(b => q.x > b.x - 8 && q.x < b.x + b.w + 8 && q.y > b.y && q.y < b.y + b.h + 10);
  const first = horiz ? (l.y < r.y + r.h / 2 ? 'T' : 'B') : (l.x < r.x + r.w / 2 ? 'L' : 'R');
  const other = { T: 'B', B: 'T', L: 'R', R: 'L' }[first];
  for (const sd of [first, other]) { const q = spot(sd); if (!bad(q)) return { x: Math.round(q.x), y: Math.round(q.y), side: sd }; }
  return null;
}
// About 90 trees scattered on open grass (not on roads, buildings, entrances, the gate or sports areas).
function autoTrees(m, seed = 7) {
  const rnd = _rng(seed), W = m.world.w, H = m.world.h, out = [];
  const a = m.areas || {};
  const blockers = [
    ...m.buildings.map(b => ({ x: b.x - 40, y: b.y - 30, w: b.w + 80, h: b.h + 70 })),
    ...m.roads, ...m.paths, ...(m.medians || []), ...Object.keys(a).filter(k => /^(ground|court|parking\d*)$/.test(k)).filter(k => a[k]).map(k => a[k]),
    gateInfo(m.gate, W, H).clear,
    ...m.buildings.map(b => { const d = doorInfo(b); return { x: d.x - 60, y: d.y - 60, w: 120, h: 120 }; }),
  ];
  const ok = (x, y) => {
    const r = { x: x - 30, y: y - 70, w: 60, h: 80 };
    if (x < 60 || x > W - 60 || y < 120 || y > H - 60) return false;
    if (blockers.some(b => _ov(r, b, 6))) return false;
    return !out.some(t => Math.hypot(t.x - x, t.y - y) < 70);
  };
  for (let tries = 0; out.length < 90 && tries < 6000; tries++) {
    const x = rnd() * W, y = rnd() * H;
    if (ok(x, y)) out.push({ x: Math.round(x), y: Math.round(y), s: Math.round((0.8 + rnd() * 0.5) * 100) / 100, hue: Math.round(rnd() * 100) / 100 });
  }
  return out;
}
// Four benches around the fountain.
function autoBenches(m) {
  const f = m.fountain;
  return [[-160, -70], [110, -70], [-160, 70], [110, 70]].map(([dx, dy]) => ({ x: f.x + dx, y: f.y + dy, rot: 0 }));
}
// Bins and hydrants beside the street lights, on the side away from the road.
// kind: 'bin' (light trash can), 'binDark' (dark trash can) or 'hydrant'.
function autoBins(m) {
  const lamps = (Array.isArray(m.lamps) && m.lamps.length ? m.lamps : autoLamps(m))
    .map(l => seatLamp(l, m.roads, m.buildings)).filter(Boolean);
  const rnd = _rng(5), out = [];
  lamps.forEach((l, i) => {
    const off = { L: [-44, -28], R: [12, -28], T: [16, -34], B: [16, -14] }[l.side] || [18, -30];
    const x = l.x + off[0], y = l.y + off[1];
    if (m.roads.some(r => x + 12 > r.x && x + 12 < r.x + r.w && y + 24 > r.y && y + 24 < r.y + r.h)) return;
    const r = rnd();
    if (r < 0.35) out.push({ x, y, kind: i % 2 ? 'bin' : 'binDark' });
    else if (r < 0.5) out.push({ x, y, kind: 'hydrant' });
  });
  return out;
}

const ROCK_SPRITES = [[22,46,58,62],[96,48,70,56],[186,46,54,58],[254,52,72,62],[340,60,64,50],[424,68,74,40],[20,128,82,42],[120,124,54,46],[190,134,76,36],[280,128,58,48],[352,130,70,46],[450,140,38,34],[20,200,34,28],[76,208,24,18],[128,210,28,18],[176,212,20,16],[222,202,34,30],[282,200,38,38],[344,206,34,28],[396,206,38,30],[458,212,32,22],[10,256,36,46],[62,258,54,48],[126,258,54,48],[192,268,44,34],[248,266,82,40],[344,266,48,38],[416,262,74,48],[98,316,74,64],[22,338,54,36],[192,336,74,48],[350,358,24,20],[402,328,74,54],[26,396,74,60],[120,398,82,64],[294,362,26,16],[218,428,60,34],[290,428,56,34],[374,424,48,40],[440,424,60,40]];
function rockCollisionBox(rock) {
  return { x: rock.x + rock.w * 0.18, y: rock.y + rock.h * 0.62, w: rock.w * 0.64, h: rock.h * 0.34 };
}
function autoRocks(m, seed = 31) {
  const rnd = _rng(seed), W = m.world.w, H = m.world.h, out = [], areas = m.areas || {};
  const blockers = [
    ...m.roads.map(r => ({ x: r.x - 26, y: r.y - 26, w: r.w + 52, h: r.h + 52 })),
    ...(m.medians || []).map(r => ({ x: r.x - 10, y: r.y - 10, w: r.w + 20, h: r.h + 20 })),
    ...(m.paths || []), ...['ground', 'court', 'parking', 'parking2'].map(k => areas[k]).filter(Boolean),
    ...m.buildings.map(b => ({ x: b.x - 30, y: b.y - 30, w: b.w + 60, h: b.h + 70 })),
    ...m.buildings.map(b => { const d = doorInfo(b); return { x: d.x - 60, y: d.y - 60, w: 120, h: 120 }; }),
  ];
  const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  for (let tries = 0; out.length < 34 && tries < 3000; tries++) {
    const sprite = ROCK_SPRITES[(rnd() * ROCK_SPRITES.length) | 0], scale = 0.5 + rnd() * 0.25;
    const rock = { x: 0, y: 0, w: Math.round(sprite[2] * scale), h: Math.round(sprite[3] * scale), sprite, solid: true };
    rock.x = Math.round(50 + rnd() * Math.max(1, W - rock.w - 100));
    rock.y = Math.round(50 + rnd() * Math.max(1, H - rock.h - 100));
    if (blockers.some(b => overlaps(rock, b))) continue;
    if ((m.trees || []).some(t => Math.hypot(t.x - (rock.x + rock.w / 2), t.y - (rock.y + rock.h / 2)) < 50)) continue;
    if (out.some(b => overlaps(rock, b))) continue;
    out.push(rock);
  }
  return out;
}
// Parking bays laid out along the longer side of the parking area (rows if wide, columns if tall).
function parkingLayout(P) {
  const wide = P.w >= P.h, bays = [], lines = [];
  if (wide) {
    const n = Math.max(1, Math.floor((P.w - 20) / 74));
    for (const row of [P.y + 10, P.y + P.h - 100].filter((r, i) => i === 0 || P.h >= 200)) {
      for (let i = 0; i < n; i++) bays.push({ x: P.x + 20 + i * 74, y: row, w: 46, h: 84 });
      for (let i = 0; i <= n; i++) lines.push([P.x + 10 + i * 74, row - 5, P.x + 10 + i * 74, row + 90]);
    }
  } else {
    const n = Math.max(1, Math.floor((P.h - 20) / 74));
    for (const col of [P.x + 10, P.x + P.w - 100].filter((c, i) => i === 0 || P.w >= 200)) {
      for (let i = 0; i < n; i++) bays.push({ x: col, y: P.y + 20 + i * 74, w: 84, h: 46 });
      for (let i = 0; i <= n; i++) lines.push([col - 5, P.y + 10 + i * 74, col + 90, P.y + 10 + i * 74]);
    }
  }
  return { wide, bays, lines };
}

// Apply the saved layout now (after all helpers above are defined).
applyMap(readSavedMap());
