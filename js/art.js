'use strict';
// ─────────────────────────────────────────────────────────────
//  Procedural art: buildings, trees, characters and comic portraits.
//  The hand-drawn campus base map is loaded separately.
// ─────────────────────────────────────────────────────────────

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function rectsOverlap(a, b, pad = 0) {
  return a.x - pad < b.x + b.w && a.x + a.w + pad > b.x && a.y - pad < b.y + b.h && a.y + a.h + pad > b.y;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';

// ── Static world decoration (generated once) ─────────────────
// Street lights, trees, benches and bins come from the Map Editor when placed there; otherwise they are placed automatically.
const CARS = [];
const TREES = [];
const LAMPS = [];
const BENCHES = [];
const BINS = [];
const ROCKS = [];
const MAP_IMAGES = MAP_EXTRAS.mapImages || [];
(function buildDecor() {
  // Parked vehicles are no longer painted on: they drive in and out (see the commute system in kenney_art.js).
  const m = snapshotMap();
  // street lights stand on the footpath next to their road, leaning over it (positions saved in the editor are kept, just moved off the asphalt)
  LAMPS.push(...(MAP_EXTRAS.lamps || autoLamps(m)).map(l => seatLamp(l, ROADS, BUILDINGS)).filter(Boolean));
  TREES.push(...(MAP_EXTRAS.trees || autoTrees(m)));
  BENCHES.push(...(MAP_EXTRAS.benches || autoBenches(m)));
  BINS.push(...(MAP_EXTRAS.bins || autoBins(m)));
  ROCKS.push(...(MAP_EXTRAS.rocks || autoRocks(m)));
})();

// ── Ground (pre-rendered to one big canvas) ──────────────────
// The campus base is the hand-drawn picture assets/campus_map.png, stretched over the whole world.
// Its red background is transparent, so the game-painted grass and areas show through where the
// picture was red; everywhere else the picture covers what is painted beneath it.
const MAP_IMG = new Image();
MAP_IMG.src = 'assets/campus_map.png';
const MAP_ASSET_CACHE = new Map();
function mapAssetImage(item) {
  if (!MAP_ASSET_CACHE.has(item.src)) {
    const img = new Image();
    img.onload = () => { if (typeof ground !== 'undefined') ground = makeGround(); };
    img.src = item.src;
    MAP_ASSET_CACHE.set(item.src, img);
  }
  return MAP_ASSET_CACHE.get(item.src);
}

function makeGround() {
  const c = document.createElement('canvas');
  c.width = WORLD_W; c.height = WORLD_H;
  const g = c.getContext('2d');
  const rnd = mulberry32(42);

  g.fillStyle = '#5c9e4c'; g.fillRect(0, 0, WORLD_W, WORLD_H);
  if (!paintTileGrass(g, WORLD_W, WORLD_H) && !paintPixelGrass(g, WORLD_W, WORLD_H, rnd)) for (let i = 0; i < 16000; i++) {   // pixel grass tiles (Kenney), or soft speckles
    g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,40,0,0.08)';
    g.fillRect(rnd() * WORLD_W, rnd() * WORLD_H, 2 + rnd() * 5, 2 + rnd() * 5);
  }

  // Sports ground: track + field + cricket pitch
  const G = AREAS.ground;
  g.fillStyle = '#b5523b'; roundRect(g, G.x, G.y, G.w, G.h, 220); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2;
  for (let i = 1; i < 4; i++) { roundRect(g, G.x + i * 14, G.y + i * 14, G.w - i * 28, G.h - i * 28, 220 - i * 14); g.stroke(); }
  g.save(); roundRect(g, G.x + 60, G.y + 60, G.w - 120, G.h - 120, 170); g.clip();
  // mowing stripes and the pitch run along the field's longer side, so rotating it in the editor turns them too
  const gTall = G.h > G.w, gcx = G.x + G.w / 2, gcy = G.y + G.h / 2;
  if (gTall) for (let y = G.y; y < G.y + G.h; y += 60) { g.fillStyle = ((y - G.y) / 60) % 2 ? '#4f9a3c' : '#5aa846'; g.fillRect(G.x, y, G.w, 60); }
  else for (let x = G.x; x < G.x + G.w; x += 60) { g.fillStyle = ((x - G.x) / 60) % 2 ? '#4f9a3c' : '#5aa846'; g.fillRect(x, G.y, 60, G.h); }
  g.restore();
  g.fillStyle = '#d8c79a'; g.strokeStyle = '#fff'; g.lineWidth = 2;
  if (gTall) { g.fillRect(gcx - 22, gcy - 80, 44, 160); g.beginPath(); g.moveTo(gcx - 22, gcy - 66); g.lineTo(gcx + 22, gcy - 66); g.moveTo(gcx - 22, gcy + 66); g.lineTo(gcx + 22, gcy + 66); g.stroke(); }
  else { g.fillRect(gcx - 80, gcy - 22, 160, 44); g.beginPath(); g.moveTo(gcx - 66, gcy - 22); g.lineTo(gcx - 66, gcy + 22); g.moveTo(gcx + 66, gcy - 22); g.lineTo(gcx + 66, gcy + 22); g.stroke(); }
  const rx = Math.min(300, G.w / 2 - 90), ry = Math.min(300, G.h / 2 - 90);
  g.beginPath(); g.ellipse(gcx, gcy, Math.max(40, gTall ? Math.min(rx, 180) : rx), Math.max(40, gTall ? ry : Math.min(ry, 180)), 0, 0, 7); g.setLineDash([10, 8]); g.stroke(); g.setLineDash([]);

  // Basketball court
  const C = AREAS.court;
  g.fillStyle = '#d9822b'; g.fillRect(C.x, C.y, C.w, C.h);
  g.fillStyle = '#2f6690'; g.fillRect(C.x + 16, C.y + 16, C.w - 32, C.h - 32);
  g.strokeStyle = '#fff'; g.lineWidth = 3;
  g.strokeRect(C.x + 16, C.y + 16, C.w - 32, C.h - 32);
  // hoops at the two short ends: top/bottom when the court is tall, left/right when it is wide
  const cr = Math.min(70, Math.min(C.w, C.h) / 2 - 18), cc = Math.min(40, Math.min(C.w, C.h) / 4);
  g.beginPath(); g.arc(C.x + C.w / 2, C.y + C.h / 2, cc, 0, 7); g.stroke();
  if (C.h >= C.w) {
    g.beginPath(); g.moveTo(C.x + 16, C.y + C.h / 2); g.lineTo(C.x + C.w - 16, C.y + C.h / 2); g.stroke();
    g.beginPath(); g.arc(C.x + C.w / 2, C.y + 16, cr, 0, Math.PI); g.stroke();
    g.beginPath(); g.arc(C.x + C.w / 2, C.y + C.h - 16, cr, Math.PI, 0); g.stroke();
    g.fillStyle = '#fff'; g.fillRect(C.x + C.w / 2 - 12, C.y + 18, 24, 4); g.fillRect(C.x + C.w / 2 - 12, C.y + C.h - 22, 24, 4);
  } else {
    g.beginPath(); g.moveTo(C.x + C.w / 2, C.y + 16); g.lineTo(C.x + C.w / 2, C.y + C.h - 16); g.stroke();
    g.beginPath(); g.arc(C.x + 16, C.y + C.h / 2, cr, -Math.PI / 2, Math.PI / 2); g.stroke();
    g.beginPath(); g.arc(C.x + C.w - 16, C.y + C.h / 2, cr, Math.PI / 2, Math.PI * 1.5); g.stroke();
    g.fillStyle = '#fff'; g.fillRect(C.x + 18, C.y + C.h / 2 - 12, 4, 24); g.fillRect(C.x + C.w - 22, C.y + C.h / 2 - 12, 4, 24);
  }

  // Parking: both lots use straight drive aisles, with bus bays in the larger lot.
  const bayLines = (b, col, lw) => {   // the two sides and the kerb end; the aisle end stays open
    const [r0, f0, f1, r1] = b.poly;
    g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round';
    g.beginPath(); g.moveTo(r0.x, r0.y); g.lineTo(f0.x, f0.y); g.lineTo(f1.x, f1.y); g.lineTo(r1.x, r1.y); g.stroke();
  };
  const PLOTS = parkingAreas();
  for (const P of PLOTS) {
    const plan = parkingPlan(P, ROADS), drive = lotDriveway(plan, ROADS), A = plan.aisle;
    g.fillStyle = '#4a4e57';
    if (drive) for (const l of drive.legs) g.fillRect(l.x, l.y, l.w, l.h);
    g.fillRect(P.x, P.y, P.w, P.h);
    if (drive) for (const l of drive.legs) fillTiles(g, l, 'modern_city', MC.asphalt);
    fillTiles(g, P, 'modern_city', MC.asphalt);
    g.fillStyle = 'rgba(20,22,28,0.18)'; g.fillRect(P.x, P.y, P.w, P.h);
    for (const b of plan.bays.bus) {
      g.fillStyle = 'rgba(255,214,10,0.07)'; g.beginPath(); b.poly.forEach((q, i) => i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)); g.closePath(); g.fill();
      bayLines(b, 'rgba(255,214,10,0.85)', 3);
    }
    for (const b of plan.bays.car) bayLines(b, 'rgba(255,255,255,0.8)', 3);
    g.save(); g.font = 'bold 15px Rajdhani, "Trebuchet MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const b of plan.bays.bus) { g.save(); g.translate(b.cx, b.cy); g.rotate(b.ang); g.fillStyle = 'rgba(255,214,10,0.55)'; g.fillText('BUS', 0, 0); g.restore(); }
    for (const b of plan.bays.car) { g.save(); g.translate(b.cx, b.cy); g.rotate(b.ang); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(b.L / 2 - 10, -b.W / 2 + 6, 4, b.W - 12); g.restore(); }
    g.restore();
    g.setLineDash([16, 14]); g.strokeStyle = 'rgba(242,193,78,0.85)'; g.lineWidth = 3; g.beginPath();
    { const p0 = plan.W2(A.mid, 30), p1 = plan.W2(A.mid, A.Vc - 160); g.moveTo(p0.x, p0.y); g.lineTo(p1.x, p1.y); }
    g.stroke(); g.setLineDash([]);
  }

  // Garden flower beds
  const Gd = AREAS.garden;
  g.fillStyle = '#4c8c3c'; roundRect(g, Gd.x, Gd.y, Gd.w, Gd.h, 40); g.fill();
  const flowers = ['#ff6b6b', '#ffd166', '#f4f1de', '#c77dff', '#ff9f1c'];
  // flower beds fill the garden in a grid that fits its size
  const gc = Math.max(1, Math.round(Gd.w / 200)), gr = Math.max(1, Math.round(Gd.h / 190));
  g.save(); roundRect(g, Gd.x, Gd.y, Gd.w, Gd.h, 40); g.clip();
  for (let i = 0; i < gc * gr; i++) {
    const cx = Gd.x + (i % gc + 0.5) * Gd.w / gc, cy = Gd.y + (((i / gc) | 0) + 0.5) * Gd.h / gr;
    g.fillStyle = '#6b4226'; g.beginPath(); g.ellipse(cx, cy, 70, 40, 0, 0, 7); g.fill();
    for (let k = 0; k < 60; k++) {
      const a = rnd() * 7, r = Math.sqrt(rnd()) * 60;
      g.fillStyle = flowers[(rnd() * flowers.length) | 0];
      g.beginPath(); g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6, 3.5, 0, 7); g.fill();
    }
  }
  g.restore();

  // Procedural roads remain underneath the campus picture as a fallback and for transparent regions.
  if (paintTileRoads(g)) {
    for (const P of PLOTS) {
      const dw = lotDriveway(parkingPlan(P, ROADS), ROADS);
      if (dw) for (const l of dw.legs) fillTiles(g, l, 'modern_city', MC.asphalt);
    }
  } else {
    for (const r of ROADS) {
      g.fillStyle = '#9a9a9a'; g.fillRect(r.x - 4, r.y - 4, r.w + 8, r.h + 8);
      g.fillStyle = '#3d4049'; g.fillRect(r.x, r.y, r.w, r.h);
    }
    g.strokeStyle = '#f2c14e'; g.lineWidth = 3; g.setLineDash([24, 20]);
    for (const r of ROADS) {
      if (r.w < 90 && r.h < 90) continue;
      g.beginPath();
      if (r.w > r.h) { g.moveTo(r.x + 10, r.y + r.h / 2); g.lineTo(r.x + r.w - 10, r.y + r.h / 2); }
      else { g.moveTo(r.x + r.w / 2, r.y + 10); g.lineTo(r.x + r.w / 2, r.y + r.h - 10); }
      g.stroke();
    }
    g.setLineDash([]);
  }

  // Paved paths / plazas
  for (const p of PATHS) {
    if (paintTilePlaza(g, p) || paintPixelPavement(g, p, rnd)) continue;
    g.fillStyle = '#cdb79e'; g.fillRect(p.x, p.y, p.w, p.h);
    g.strokeStyle = 'rgba(90,60,30,0.18)'; g.lineWidth = 1;
    for (let x = p.x; x <= p.x + p.w; x += 20) { g.beginPath(); g.moveTo(x, p.y); g.lineTo(x, p.y + p.h); g.stroke(); }
    for (let y = p.y; y <= p.y + p.h; y += 20) { g.beginPath(); g.moveTo(p.x, y); g.lineTo(p.x + p.w, y); g.stroke(); }
  }

  // The hand-drawn campus picture sits above the painted ground, areas, parking and paths.
  // Its transparent red regions let the game's grass and underlying placements show through.
  if (MAP_IMG.complete && MAP_IMG.naturalWidth) g.drawImage(MAP_IMG, 0, 0, WORLD_W, WORLD_H);
  for (const item of MAP_IMAGES) {
    const img = mapAssetImage(item);
    if (img.complete && img.naturalWidth) g.drawImage(img, item.x, item.y, item.w, item.h);
  }

  // Benches (placed in the Map Editor, or around the fountain by default); rot 90 = turned sideways
  for (const b of BENCHES) {
    if (drawTileBench(g, b)) continue;
    if (b.rot) { g.fillStyle = '#7f5539'; g.fillRect(b.x, b.y - 25, 12, 50); g.fillStyle = '#5e3c24'; g.fillRect(b.x + 13, b.y - 25, 5, 50); }
    else { g.fillStyle = '#7f5539'; g.fillRect(b.x, b.y, 50, 12); g.fillStyle = '#5e3c24'; g.fillRect(b.x, b.y - 6, 50, 5); }
  }
  // Bins and hydrants (placed in the Map Editor, or beside the street lights by default)
  for (const b of BINS) paintBin(g, b);
  paintRocks(g);
  // Doormats
  for (const b of BUILDINGS) { const m = doorInfo(b).mat; g.fillStyle = '#7a2e2e'; g.fillRect(m.x, m.y, m.w, m.h); }

  // Boundary wall, open at the main gate and the back gate
  const gi = gateInfo(GATE, WORLD_W, WORLD_H), bgi = backGateInfo(getBackGate(), WORLD_W, WORLD_H);
  {
    const L = 90, a = bgi.gap[0] + 8, b = bgi.gap[1] - 8;   // asphalt through the back gate
    const r = bgi.side === 'W' ? { x: 0, y: a, w: L, h: b - a } : bgi.side === 'E' ? { x: WORLD_W - L, y: a, w: L, h: b - a }
      : bgi.side === 'N' ? { x: a, y: 0, w: b - a, h: L } : { x: a, y: WORLD_H - L, w: b - a, h: L };
    g.fillStyle = '#3d4049'; g.fillRect(r.x, r.y, r.w, r.h);
  }
  {
    const ap = gi.horiz ? { x: gi.gap[0] + 10, y: gi.side === 'N' ? 0 : WORLD_H - 230, w: gi.gap[1] - gi.gap[0] - 20, h: 230 }
                        : { x: gi.side === 'W' ? 0 : WORLD_W - 230, y: gi.gap[0] + 10, w: 230, h: gi.gap[1] - gi.gap[0] - 20 };
    g.fillStyle = '#c9b89c'; g.fillRect(ap.x, ap.y, ap.w, ap.h);
    g.strokeStyle = 'rgba(90,60,30,0.2)'; g.lineWidth = 1;
    for (let x = ap.x; x <= ap.x + ap.w; x += 24) { g.beginPath(); g.moveTo(x, ap.y); g.lineTo(x, ap.y + ap.h); g.stroke(); }
    for (let y = ap.y; y <= ap.y + ap.h; y += 24) { g.beginPath(); g.moveTo(ap.x, y); g.lineTo(ap.x + ap.w, y); g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; g.strokeRect(ap.x, ap.y, ap.w, ap.h);
  }
  g.fillStyle = '#9b3d2c';
  for (const p of wallPieces([gi, bgi], WORLD_W, WORLD_H)) g.fillRect(p.x, p.y, p.w, p.h);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
  for (let y = 0; y < WORLD_H; y += 10) {
    const open = (side) => [gi, bgi].some(q => q.side === side && y > q.gap[0] && y < q.gap[1]);
    g.beginPath();
    if (!open('W')) { g.moveTo(0, y); g.lineTo(30, y); }
    if (!open('E')) { g.moveTo(WORLD_W - 30, y); g.lineTo(WORLD_W, y); }
    g.stroke();
  }

  // Parked cars (drawn on the ground; they're solid in game.js)
  for (const car of CARS) drawCar(g, car);
  return c;
}

function drawCar(g, c) {
  if (drawPixelParkedCar(g, c)) return;
  g.fillStyle = 'rgba(0,0,0,0.3)'; roundRect(g, c.x + 4, c.y + 6, c.w, c.h, 10); g.fill();
  g.fillStyle = c.c; roundRect(g, c.x, c.y, c.w, c.h, 10); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.stroke();
  if (c.h >= c.w) {   // parked nose-up
    g.fillStyle = '#9fd3ff'; roundRect(g, c.x + 6, c.y + 16, c.w - 12, 18, 4); g.fill();
    g.fillStyle = '#7fb6e0'; roundRect(g, c.x + 6, c.y + c.h - 26, c.w - 12, 14, 4); g.fill();
  } else {             // parked sideways (tall parking area)
    g.fillStyle = '#9fd3ff'; roundRect(g, c.x + 16, c.y + 6, 18, c.h - 12, 4); g.fill();
    g.fillStyle = '#7fb6e0'; roundRect(g, c.x + c.w - 26, c.y + 6, 14, c.h - 12, 4); g.fill();
  }
}

// ── Buildings (foreground layer) ─
function drawBuilding(g, b, dark, t) {
  if (drawTileBuilding(g, b, dark, t)) return;   // Kenney Modern City walls, windows, doors and roofs
  // The front wall can face any direction (b.face); the roof fills the rest of the footprint.
  const P = buildingParts(b), W = P.wallR, R = P.roofR, face = P.face;
  const door = doorInfo(b), doorFill = dark > 0.3 ? '#ffcf70' : '#2b1a10';
  const picF = bpic(b, 'front'), picR = bpic(b, 'roof');   // pictures uploaded in the editor
  g.save();
  g.globalAlpha = 1;
  // Drop shadow
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(b.x + 14, b.y + 14, b.w, b.h);
  let DR = null;
  const vert = face === 'E' || face === 'W';
  if (picF) picRect(g, picF, W);
  else {
  // Front wall, darker along its ground edge
  g.fillStyle = b.wall; g.fillRect(W.x, W.y, W.w, W.h);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  if (face === 'S') g.fillRect(W.x, W.y + W.h - 10, W.w, 10);
  else if (face === 'N') g.fillRect(W.x, W.y, W.w, 10);
  else if (face === 'E') g.fillRect(W.x + W.w - 10, W.y, 10, W.h);
  else g.fillRect(W.x, W.y, 10, W.h);
  // Entrance on the front wall (if the door is on the same side the wall faces)
  DR = null;
  if (door.side === face) {
    if (face === 'S') DR = { x: door.x - 22, y: b.y + b.h - 56, w: 44, h: 56 };
    else if (face === 'N') DR = { x: door.x - 22, y: b.y, w: 44, h: 56 };
    else if (face === 'E') DR = { x: b.x + b.w - 56, y: door.y - 22, w: 56, h: 44 };
    else DR = { x: b.x, y: door.y - 22, w: 56, h: 44 };
  }
  // Windows (a grid on the wall; skip the ones where the door is)
  const rnd = mulberry32(b.x * 7 + b.y);
  const top = face === 'N' ? W.y + 20 : W.y + 46, bottom = face === 'N' ? W.y + W.h - 40 : W.y + W.h - 4;
  const rows = vert ? Math.max(1, Math.floor((W.h - 66) / 56)) : b.floors;
  const cols = vert ? b.floors : Math.floor(W.w / 60);
  const cellW = (W.w - 36) / Math.max(1, cols), cellH = vert ? (W.h - 66) / rows : Math.min(42, (W.h - 70) / rows);
  const ww = Math.max(8, Math.min(vert ? 34 : 999, cellW - 14)), winH = Math.max(8, Math.min(30, cellH - 12));
  for (let r = 0; r < rows; r++) {
    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const wx = W.x + 18 + cIdx * cellW + (cellW - ww) / 2;
      const wy = top + r * cellH + (vert ? (cellH - winH) / 2 : 0);
      if (wy + winH > bottom) continue;
      if (DR && wx < DR.x + DR.w + 8 && wx + ww > DR.x - 8 && wy < DR.y + DR.h + 8 && wy + winH > DR.y - 8) continue;   // door gap
      const lit = rnd() < 0.7;
      g.fillStyle = dark > 0.3 && lit ? '#ffd166' : '#5b8fb9';
      g.fillRect(wx, wy, ww, winH);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(wx, wy, ww * 0.35, winH);
      g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2; g.strokeRect(wx, wy, ww, winH);
    }
  }
  if (DR) {
    g.fillStyle = '#4a2c1a'; g.fillRect(DR.x - 4, DR.y - 4, DR.w + 8, DR.h + 8);
    g.fillStyle = doorFill; g.fillRect(DR.x, DR.y, DR.w, DR.h);
    g.fillStyle = 'rgba(255,255,255,0.15)';
    if (vert) g.fillRect(DR.x, DR.y + DR.h / 2 - 1, DR.w, 2); else g.fillRect(DR.x + DR.w / 2 - 1, DR.y, 2, DR.h);
  }
  // Shop awning along the line where the wall meets the roof
  if (b.deco === 'awning') {
    if (vert) { const ax = face === 'E' ? W.x : W.x + W.w - 22; for (let i = 0; i < W.h / 30; i++) { g.fillStyle = i % 2 ? '#fff' : '#e63946'; g.fillRect(ax, W.y + i * 30, 22, Math.min(30, W.y + W.h - (W.y + i * 30))); } }
    else { const ay = face === 'S' ? W.y : W.y + W.h - 22; for (let i = 0; i < W.w / 30; i++) { g.fillStyle = i % 2 ? '#fff' : '#e63946'; g.fillRect(W.x + i * 30, ay, Math.min(30, W.x + W.w - (W.x + i * 30)), 22); } }
  }
  }
  if (picF && door.side === face) DR = true;   // the front picture already shows the entrance
  // Roof (overhangs the wall ends a little), shaded on the edge that meets the wall
  if (picR && R.w > 0 && R.h > 0) { picRect(g, picR, R); g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 3; g.strokeRect(R.x, R.y, R.w, R.h); }
  else if (R.w > 0 && R.h > 0) {
    const RO = vert ? { x: R.x, y: R.y - 8, w: R.w, h: R.h + 16 } : { x: R.x - 8, y: R.y, w: R.w + 16, h: R.h };
    g.fillStyle = b.roofC; g.fillRect(RO.x, RO.y, RO.w, RO.h);
    const edge = { S: [RO.x, RO.y + RO.h - 10, RO.w, 10], N: [RO.x, RO.y, RO.w, 10], E: [RO.x + RO.w - 10, RO.y, 10, RO.h], W: [RO.x, RO.y, 10, RO.h] }[face];
    const lite = { S: [RO.x, RO.y, RO.w, 6], N: [RO.x, RO.y + RO.h - 6, RO.w, 6], E: [RO.x, RO.y, 6, RO.h], W: [RO.x + RO.w - 6, RO.y, 6, RO.h] }[face];
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(...edge);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(...lite);
    g.save(); g.beginPath(); g.rect(RO.x, RO.y, RO.w, RO.h); g.clip();
    drawRoofDeco(g, { ...b, x: R.x, y: R.y, w: R.w, h: R.h, roof: R.h }, t);
    g.restore();
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 3; g.strokeRect(RO.x, RO.y, RO.w, RO.h);
  }
  g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 3; g.strokeRect(W.x, W.y, W.w, W.h);
  // Entrance on a side the front wall doesn't face: a small porch / side door
  if (!DR) {
    g.fillStyle = '#4a2c1a';
    if (door.side === 'N' || door.side === 'S') {
      const py = door.side === 'N' ? b.y - 16 : b.y + b.h - 2;
      g.fillRect(door.x - 28, py, 56, 18);
      g.fillStyle = doorFill; g.fillRect(door.x - 22, py + 4, 44, 12);
      g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2; g.strokeRect(door.x - 28, py, 56, 18);
    } else {
      const px = door.side === 'E' ? b.x + b.w - 4 : b.x - 10, py = Math.max(b.y + 4, door.y - 58);
      g.fillRect(px - 2, py - 4, 18, door.y - py + 2);
      g.fillStyle = doorFill; g.fillRect(px + 1, py, 12, door.y - py - 4);
      g.fillStyle = '#4a2c1a'; g.fillRect(px - 6, py - 10, 26, 7);   // little canopy
    }
  }
  // Name board on the front wall
  if (b.nameBoard === false) { g.restore(); return; }
  g.font = 'bold 17px "Comic Neue", "Trebuchet MS", sans-serif';
  const tw = g.measureText(b.name).width + 24, nx = W.x + W.w / 2, ny = face === 'N' ? W.y + W.h - 36 : W.y + 10;
  g.fillStyle = '#1d3557'; roundRect(g, nx - tw / 2, ny, tw, 26, 5); g.fill();
  g.strokeStyle = '#f1faee'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#f1faee'; g.textAlign = 'center'; g.fillText(b.name, nx, ny + 19);
  g.textAlign = 'left';
  g.restore();
}

function drawRoofDeco(g, b, t) {
  const rnd = mulberry32(b.x + b.y * 3);
  if (b.deco === 'tanks') {
    for (let i = 0; i < 3; i++) {
      const x = b.x + 60 + i * 140, y = b.y + 50;
      g.fillStyle = '#1f4e79'; g.beginPath(); g.ellipse(x, y + 30, 26, 12, 0, 0, 7); g.fill();
      g.fillRect(x - 26, y, 52, 30);
      g.fillStyle = '#2f6fa8'; g.beginPath(); g.ellipse(x, y, 26, 12, 0, 0, 7); g.fill();
    }
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 6; i++) g.fillRect(b.x + 20 + rnd() * (b.w - 80), b.y + 120 + rnd() * 70, 40, 4);
  } else if (b.deco === 'solar') {
    for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) {
      g.fillStyle = '#16324f'; g.fillRect(b.x + 20 + i * 70, b.y + 25 + r * 62, 60, 48);
      g.strokeStyle = '#4c7aa6'; g.lineWidth = 1;
      for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(b.x + 20 + i * 70 + k * 15, b.y + 25 + r * 62); g.lineTo(b.x + 20 + i * 70 + k * 15, b.y + 73 + r * 62); g.stroke(); }
    }
  } else if (b.deco === 'ac') {
    for (let i = 0; i < 5; i++) {
      const x = b.x + 30 + rnd() * (b.w - 90), y = b.y + 20 + rnd() * (b.roof - 70);
      g.fillStyle = '#d9d9d9'; g.fillRect(x, y, 44, 30); g.fillStyle = '#888';
      g.beginPath(); g.arc(x + 22, y + 15, 10, 0, 7); g.fill();
      g.strokeStyle = '#555'; g.lineWidth = 2; g.beginPath();
      const a = t * 8 + i; g.moveTo(x + 22 - Math.cos(a) * 9, y + 15 - Math.sin(a) * 9); g.lineTo(x + 22 + Math.cos(a) * 9, y + 15 + Math.sin(a) * 9); g.stroke();
    }
  } else if (b.deco === 'skylight') {
    g.fillStyle = '#a7d3f2'; roundRect(g, b.x + b.w / 2 - 110, b.y + 30, 220, 100, 50); g.fill();
    g.strokeStyle = '#4b3b30'; g.lineWidth = 3; g.stroke();
    for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(b.x + b.w / 2 - 110 + i * 37, b.y + 30); g.lineTo(b.x + b.w / 2 - 110 + i * 37, b.y + 130); g.stroke(); }
  } else if (b.deco === 'stripes') {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'; g.fillRect(b.x - 8, b.y + i * (b.roof / 8), b.w + 16, b.roof / 8); }
    g.font = '46px ' + EMOJI_FONT; g.fillText('🎭', b.x + b.w / 2 - 24, b.y + 88);
  } else if (b.deco === 'flag') {
    const fx = b.x + b.w / 2, fy = b.y + 20;
    g.fillStyle = '#ddd'; g.fillRect(fx - 2, fy, 4, 100);
    const wave = Math.sin(t * 3) * 3;
    g.fillStyle = '#ff9933'; g.fillRect(fx + 2, fy + wave * 0.3, 54, 12);
    g.fillStyle = '#fff'; g.fillRect(fx + 2, fy + 12 + wave * 0.3, 54, 12);
    g.fillStyle = '#138808'; g.fillRect(fx + 2, fy + 24 + wave * 0.3, 54, 12);
    g.strokeStyle = '#000080'; g.lineWidth = 1.5; g.beginPath(); g.arc(fx + 29, fy + 18 + wave * 0.3, 5, 0, 7); g.stroke();
  }
}

function drawTree(g, tr) {
  if (drawTileTree(g, tr) || drawPixelTree(g, tr)) return;
  const s = tr.s;
  g.save(); g.globalAlpha = tr.alpha ?? 1;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(tr.x + 6, tr.y, 30 * s, 10 * s, 0, 0, 7); g.fill();
  g.fillStyle = '#6b4226'; g.fillRect(tr.x - 6 * s, tr.y - 34 * s, 12 * s, 34 * s);
  const greens = tr.hue < 0.33 ? ['#2d6a4f', '#40916c', '#52b788'] : tr.hue < 0.66 ? ['#386641', '#6a994e', '#a7c957'] : ['#1b4332', '#2d6a4f', '#40916c'];
  const blobs = [[0, -70, 34], [-24, -56, 24], [24, -56, 24], [0, -92, 22]];
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
  blobs.forEach(([bx, by, r], i) => {
    g.fillStyle = greens[i % 3]; g.beginPath(); g.arc(tr.x + bx * s, tr.y + by * s, r * s, 0, 7); g.fill(); g.stroke();
  });
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(tr.x - 10 * s, tr.y - 82 * s, 10 * s, 0, 7); g.fill();
  g.restore();
}

function drawLamp(g, l, dark) {
  if (drawTileLamp(g, l, dark) || drawPixelLamp(g, l, dark)) return;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(l.x + 3, l.y, 8, 3, 0, 0, 7); g.fill();
  g.fillStyle = '#2b2d42'; g.fillRect(l.x - 2, l.y - 70, 4, 70);
  g.fillStyle = dark > 0.25 ? '#fff3b0' : '#ccc'; g.beginPath(); g.arc(l.x, l.y - 72, 6, 0, 7); g.fill();
  g.strokeStyle = '#2b2d42'; g.lineWidth = 2; g.stroke();
}

function drawFountain(g, t) {
  const { x, y } = FOUNTAIN;
  g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(x + 6, y + 8, 62, 30, 0, 0, 7); g.fill();
  g.fillStyle = '#b8b8b8'; g.beginPath(); g.ellipse(x, y, 60, 28, 0, 0, 7); g.fill();
  g.strokeStyle = '#555'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#4ea8de'; g.beginPath(); g.ellipse(x, y, 50, 22, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
  for (let i = 0; i < 2; i++) { const r = ((t * 20 + i * 25) % 50); g.beginPath(); g.ellipse(x, y, r, r * 0.44, 0, 0, 7); g.stroke(); }
  g.fillStyle = '#999'; g.fillRect(x - 6, y - 40, 12, 40);
  g.fillStyle = 'rgba(160,220,255,0.8)';
  for (let i = 0; i < 6; i++) { const a = t * 3 + i; g.beginPath(); g.arc(x + Math.cos(a) * 14, y - 40 + Math.abs(Math.sin(a * 1.3)) * 30, 3, 0, 7); g.fill(); }
}

// Main gate: drawn in code (js/gate_art.js) as a replica of the real MVSR entrance.
function drawGate(g, gi = gateInfo(GATE, WORLD_W, WORLD_H), alpha = 1) { drawGateArt(g, gi, alpha); }

function drawNotice(g) {
  const { x, y } = NOTICE;
  g.fillStyle = '#5e3c24'; g.fillRect(x - 3, y - 50, 6, 50); g.fillRect(x + 47, y - 50, 6, 50);
  g.fillStyle = '#8d6e63'; g.fillRect(x - 6, y - 80, 62, 40);
  g.fillStyle = '#fff'; g.fillRect(x, y - 75, 20, 14); g.fillStyle = '#ffd166'; g.fillRect(x + 24, y - 74, 22, 18); g.fillStyle = '#a8dadc'; g.fillRect(x + 6, y - 58, 30, 12);
}

// ── Characters ───────────────────────────────────────────────
// NPC sprites (sheet in sprites.js): walk cycles per direction, a looping idle, and 'down' reuses the side walk on the last side faced.
function drawSprite(g, x, y, L, dir, phase, moving) {
  if (dir === 'left' || dir === 'right') L._side = dir;
  const side = L._side || 'right';
  const t = performance.now() + (L.sprite * 397 + (x | 0) * 7) % 1000;
  let f, bob = 0;
  if (moving) {
    const seq = SPRITE.walk[dir === 'down' ? side : dir];
    f = seq[Math.floor(phase * 0.7) % seq.length];
    bob = Math.abs(Math.sin(phase * 0.7 * Math.PI)) * 1.2;
  } else {
    const idleDir = dir === 'down' ? side : dir;
    f = idleDir === 'up' ? SPRITE.idle.up : idleDir === 'left' ? (t % 1400 < 900 ? 23 : 24) : (t % 1400 < 900 ? 0 : 1);
    bob = Math.sin(t / 450) * 0.5 + 0.5;
  }
  const k = SPRITE.k;
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(x, y, 13, 5, 0, 0, 7); g.fill();
  g.drawImage(SPRITE.img, f * SPRITE.cw, L.sprite * SPRITE.ch, SPRITE.cw, SPRITE.ch, x - SPRITE.cw * k / 2, y - (SPRITE.ch - 2) * k - bob, SPRITE.cw * k, SPRITE.ch * k);
}

// Main character: full animated pack (idle loop + 8-frame walk cycles per direction).
function drawPlayerSprite(g, x, y, dir, phase, moving) {
  const P = PLAYER_SPRITE, key = moving ? dir : 'idle';
  const f = moving ? Math.floor(phase * 0.8) % P.frames[key] : Math.floor(performance.now() / 150) % P.frames.idle;
  const k = 0.8;
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(x, y, 13, 5, 0, 0, 7); g.fill();
  const im = P.img[key][f];
  if (!im.complete || !im.naturalWidth) return;
  g.drawImage(im, x - P.cw * k / 2, y - P.ch * k + 2, P.cw * k, P.ch * k);
}

function drawChar(g, x, y, L, dir, phase, moving) {
  if (L.sprite === 0 && PLAYER_SPRITE.ready) return drawPlayerSprite(g, x, y, dir, phase, moving);
  if (L.sprite != null && SPRITE.ready) return drawSprite(g, x, y, L, dir, phase, moving);
  const sw = moving ? Math.sin(phase) * 4 : 0;
  const bob = moving ? Math.abs(Math.sin(phase)) * 1.5 : 0;
  g.save(); g.translate(x, y);
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse(0, 0, 13, 5, 0, 0, 7); g.fill();
  g.translate(0, -bob);
  const ol = 'rgba(0,0,0,0.55)';
  // Legs + shoes
  if (!L.saree) {
    g.fillStyle = L.pants;
    g.fillRect(-8, -17, 7, 17 - Math.max(0, sw)); g.fillRect(1, -17, 7, 17 - Math.max(0, -sw));
    g.fillStyle = '#222';
    g.fillRect(-9, -4 - Math.max(0, sw), 8, 4); g.fillRect(1, -4 - Math.max(0, -sw), 8, 4);
  }
  // Body
  g.fillStyle = L.shirt; g.strokeStyle = ol; g.lineWidth = 1.5;
  if (L.saree) { g.beginPath(); g.moveTo(-11, -37); g.lineTo(11, -37); g.lineTo(14, 0); g.lineTo(-14, 0); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffd166'; g.fillRect(-14, -4, 28, 3); g.fillRect(dir === 'left' ? 2 : -10, -37, 7, 22); }
  else { roundRect(g, -11, -37, 22, 22, 5); g.fill(); g.stroke(); }
  if (L.apron) { g.fillStyle = '#e5e5e5'; g.fillRect(-8, -31, 16, 20); }
  // Arms
  const armSwing = sw * 0.8;
  g.fillStyle = L.shirt;
  if (dir !== 'right') { g.fillRect(-15, -35 + armSwing, 5, 14); g.fillStyle = L.skin; g.fillRect(-15, -22 + armSwing, 5, 4); }
  g.fillStyle = L.shirt;
  if (dir !== 'left') { g.fillRect(10, -35 - armSwing, 5, 14); g.fillStyle = L.skin; g.fillRect(10, -22 - armSwing, 5, 4); }
  // Backpack when facing up
  if (L.backpack && dir === 'up') { g.fillStyle = L.backpack; roundRect(g, -9, -35, 18, 18, 4); g.fill(); g.stroke(); }
  // Long hair behind head
  if (L.hairStyle === 'long') { g.fillStyle = L.hair; g.fillRect(-11, -50, 22, 20); }
  // Head
  g.fillStyle = L.skin; g.beginPath(); g.arc(0, -47, 10.5, 0, 7); g.fill(); g.stroke();
  // Hair
  g.fillStyle = L.hair;
  const hs = L.hairStyle;
  if (hs === 'cap') {
    g.fillStyle = L.cap || '#e63946';
    g.beginPath(); g.arc(0, -49, 11, Math.PI, 0); g.fill();
    if (dir === 'down') g.fillRect(-11, -50, 22, 4);
    else if (dir === 'left') g.fillRect(-17, -50, 12, 3);
    else if (dir === 'right') g.fillRect(5, -50, 12, 3);
  } else if (hs !== 'bald') {
    if (dir === 'up') { g.beginPath(); g.arc(0, -47, 11, 0, 7); g.fill(); }
    else { g.beginPath(); g.arc(0, -49, 11, Math.PI * 1.02, Math.PI * 1.98); g.fill(); g.fillRect(-11, -51, 22, 4); }
    if (hs === 'spiky') { for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(i * 4 - 3, -56); g.lineTo(i * 4, -63); g.lineTo(i * 4 + 3, -56); g.fill(); } }
    if (hs === 'curly') { for (let i = -2; i <= 2; i++) { g.beginPath(); g.arc(i * 4.5, -57, 4, 0, 7); g.fill(); } }
    if (hs === 'bun') { g.beginPath(); g.arc(dir === 'left' ? 8 : dir === 'right' ? -8 : 0, -59, 5, 0, 7); g.fill(); }
  } else { g.fillStyle = L.hair; g.fillRect(-11, -48, 3, 6); g.fillRect(8, -48, 3, 6); }
  // Face
  g.fillStyle = '#111';
  if (dir === 'down') { g.fillRect(-5, -47, 2.5, 3); g.fillRect(3, -47, 2.5, 3); }
  else if (dir === 'left') g.fillRect(-6, -47, 2.5, 3);
  else if (dir === 'right') g.fillRect(4, -47, 2.5, 3);
  if (L.glasses && dir !== 'up') {
    g.strokeStyle = '#111'; g.lineWidth = 1.2;
    if (dir === 'down') { g.strokeRect(-7, -48.5, 5.5, 5); g.strokeRect(1.5, -48.5, 5.5, 5); }
    else g.strokeRect(dir === 'left' ? -8 : 2, -48.5, 6, 5);
  }
  if (L.mustache && dir !== 'up') { g.fillStyle = '#111'; g.fillRect(dir === 'left' ? -7 : dir === 'right' ? 1 : -4, -42, dir === 'down' ? 8 : 6, 2); }
  g.restore();
}

// ── Comic portraits ──────────────────────────────────────────
const Portraits = {
  cache: {},
  get(id, look) {
    const L = look || CHARS[id];
    if (L.sprite === 0) return PLAYER_SPRITE.portrait;
    if (L.sprite != null) return SPRITE.portraits[L.sprite];
    const key = id + JSON.stringify(L);
    if (this.cache[key]) return this.cache[key];
    const c = document.createElement('canvas'); c.width = 220; c.height = 220;
    const g = c.getContext('2d');
    g.lineJoin = 'round'; g.strokeStyle = '#111'; g.lineWidth = 6;
    const S = (fn) => { fn(); g.fill(); g.stroke(); };
    // Back hair
    if (L.hairStyle === 'long') { g.fillStyle = L.hair; S(() => { roundRect(g, 52, 70, 116, 130, 40); }); }
    // Shoulders
    g.fillStyle = L.shirt; S(() => { g.beginPath(); g.ellipse(110, 232, 92, 62, 0, Math.PI, 0); g.closePath(); });
    if (L.saree) { g.fillStyle = '#ffd166'; S(() => { g.beginPath(); g.moveTo(60, 190); g.lineTo(150, 230); g.lineTo(120, 232); g.lineTo(50, 200); g.closePath(); }); }
    if (L.apron) { g.fillStyle = '#eee'; S(() => { g.beginPath(); g.rect(80, 190, 60, 40); }); }
    // Neck
    g.fillStyle = L.skin; S(() => { g.beginPath(); g.rect(94, 140, 32, 36); });
    // Ears
    S(() => { g.beginPath(); g.ellipse(58, 104, 9, 14, 0, 0, 7); });
    S(() => { g.beginPath(); g.ellipse(162, 104, 9, 14, 0, 0, 7); });
    // Head
    S(() => { g.beginPath(); g.ellipse(110, 98, 52, 60, 0, 0, 7); });
    // Hair / cap
    g.fillStyle = L.hair;
    const hs = L.hairStyle;
    if (hs === 'cap') {
      g.fillStyle = L.cap || '#e63946';
      S(() => { g.beginPath(); g.ellipse(110, 64, 56, 34, 0, Math.PI, 0); g.closePath(); });
      S(() => { g.beginPath(); g.ellipse(124, 64, 64, 10, 0, 0, 7); });
    } else if (hs === 'bald') {
      S(() => { g.beginPath(); g.ellipse(62, 86, 8, 20, 0, 0, 7); });
      S(() => { g.beginPath(); g.ellipse(158, 86, 8, 20, 0, 0, 7); });
    } else {
      S(() => { g.beginPath(); g.ellipse(110, 64, 56, 36, 0, Math.PI * 0.95, Math.PI * 2.05); g.quadraticCurveTo(110, 70, 54, 70); g.closePath(); });
      if (hs === 'spiky') for (let i = -2; i <= 2; i++) S(() => { g.beginPath(); g.moveTo(98 + i * 20 - 12, 40); g.lineTo(98 + i * 20 + 6, 6 + Math.abs(i) * 6); g.lineTo(98 + i * 20 + 16, 40); g.closePath(); });
      if (hs === 'curly') for (let i = -2; i <= 2; i++) S(() => { g.beginPath(); g.arc(110 + i * 20, 36 + Math.abs(i) * 6, 15, 0, 7); });
      if (hs === 'bun') S(() => { g.beginPath(); g.arc(110, 20, 20, 0, 7); });
      if (hs === 'long') { g.fillStyle = L.hair; S(() => { g.beginPath(); g.rect(52, 70, 14, 80); }); S(() => { g.beginPath(); g.rect(154, 70, 14, 80); }); }
    }
    // Eyes
    g.lineWidth = 4;
    for (const ex of [88, 132]) {
      g.fillStyle = '#fff'; S(() => { g.beginPath(); g.ellipse(ex, 100, 11, 9, 0, 0, 7); });
      g.fillStyle = '#111'; g.beginPath(); g.arc(ex + 2, 101, 5, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(ex + 4, 99, 1.8, 0, 7); g.fill();
      g.beginPath(); g.moveTo(ex - 13, 83); g.quadraticCurveTo(ex, 76, ex + 13, 83); g.stroke();
    }
    if (L.glasses) {
      g.lineWidth = 4; g.strokeStyle = '#111';
      g.beginPath(); roundRect(g, 70, 88, 36, 26, 8); g.stroke();
      g.beginPath(); roundRect(g, 114, 88, 36, 26, 8); g.stroke();
      g.beginPath(); g.moveTo(106, 100); g.lineTo(114, 100); g.stroke();
    }
    // Nose + mouth
    g.lineWidth = 4; g.beginPath(); g.moveTo(110, 108); g.quadraticCurveTo(102, 124, 112, 126); g.stroke();
    if (L.mustache) { g.fillStyle = '#111'; g.beginPath(); g.ellipse(110, 134, 22, 6, 0, 0, 7); g.fill(); }
    g.beginPath(); g.moveTo(92, 140); g.quadraticCurveTo(110, 156, 128, 140); g.stroke();
    // Cheek blush
    g.fillStyle = 'rgba(255,90,90,0.25)'; g.beginPath(); g.arc(76, 124, 9, 0, 7); g.arc(144, 124, 9, 0, 7); g.fill();
    return (this.cache[key] = c.toDataURL());
  },
};
