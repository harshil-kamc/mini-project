'use strict';
// ─────────────────────────────────────────────────────────────
//  MVSR College Life RPG — main game
// ─────────────────────────────────────────────────────────────

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SAVE_KEY = 'mvsr-rpg-save-v1';

const cv = $('#game'), ctx = cv.getContext('2d');
const light = document.createElement('canvas'), lg = light.getContext('2d');
let dpr = 1, zoom = 1, VW = 0, VH = 0;
let camZoom = 1;
try { camZoom = clamp(+localStorage.getItem('mvsr_cam_zoom') || 1, 0.6, 1.6); } catch (e) { /* storage unavailable */ }
function setCamZoom(f) {
  camZoom = clamp(camZoom * f, 0.6, 1.6);
  try { localStorage.setItem('mvsr_cam_zoom', camZoom.toFixed(2)); } catch (e) { /* ignore */ }
  resize();
}
const cam = { x: 0, y: 0 };
let ground = null, miniBase = null;

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
  // Close-up camera on the player; + / - keys adjust it (remembered in this browser).
  zoom = clamp(innerHeight / 540, 1.1, 2.0) * camZoom;
  if (innerWidth < 700) zoom = 1.0 * camZoom;
  if (innerHeight < 520) zoom = clamp(innerHeight / 430, 0.8, 1.15) * camZoom;   // phones held sideways
  VW = innerWidth / zoom; VH = innerHeight / zoom;
  light.width = Math.ceil(VW / 2); light.height = Math.ceil(VH / 2);
  if (typeof bigMap !== 'undefined') sizeMinimap();
}
addEventListener('resize', resize);

// ── Collision world ──────────────────────────────────────────
const SOLIDS = [
  ...BUILDINGS.map(b => buildingParts(b).solid),
  ...TREES.map(t => ({ x: t.x - 7, y: t.y - 8, w: 14, h: 8 })),
  ...ROCKS.filter(r => r.solid !== false).map(rockCollisionBox),
  ...MAP_IMAGES.filter(img => img.collides).map(img => ({ x: img.x, y: img.y, w: img.w, h: img.h })),
  ...CARS.map(c => ({ x: c.x, y: c.y + 10, w: c.w, h: c.h - 10 })),
  ...LAMPS.map(l => ({ x: l.x - 3, y: l.y - 4, w: 6, h: 4 })),
  { x: FOUNTAIN.x - 58, y: FOUNTAIN.y - 24, w: 116, h: 48 },
  ...MEDIANS,   // the green lawn dividers in the middle of the roads: nobody crosses them
  ...gateInfo(GATE, WORLD_W, WORLD_H).pillars,
  ...backGateInfo(getBackGate(), WORLD_W, WORLD_H).pillars,
  { x: NOTICE.x - 6, y: NOTICE.y - 6, w: 62, h: 6 },
];
function blocked(x, y) {
  const l = x - 10, r = x + 10, t = y - 8, b = y;
  if (l < 30 || r > WORLD_W - 30 || t < 30 || b > WORLD_H - 42) return true;
  for (const s of SOLIDS) if (r > s.x && l < s.x + s.w && b > s.y && t < s.y + s.h) return true;
  return false;
}
const doorOf = (id) => doorInfo(BUILDINGS.find(q => q.id === id));   // where you stand to enter (any side; see map_loader.js)
const bName = (id) => id === 'ground' ? 'Cricket Ground' : BUILDINGS.find(b => b.id === id).name;

// ── State ────────────────────────────────────────────────────
let S = null;
const player = { dir: 'down', phase: 0, moving: false };
let npcs = [];
let floaters = [];
let target = null;
let overlay = null;          // 'locker' | 'timetable' | 'help' | 'report' | 'title'
let overlayReturn = null;
let bigMap = false;
let introPausedForRotation = false;

function freshState(name, shirt) {
  const slot = (id, qty = 1) => ({ id, qty });
  const inv = Array(9).fill(null), locker = Array(12).fill(null);
  [slot('notebook'), slot('pen'), slot('snack', 2)].forEach((s, i) => inv[i] = s);
  [slot('calculator'), slot('lab_coat'), slot('sports_kit'), slot('laptop'), slot('tea', 2)].forEach((s, i) => locker[i] = s);
  return {
    name, look: { ...CHARS.player, name, shirt, backpack: '#264653', sprite: 0 },
    day: 1, min: 7 * 60, energy: 85, hunger: 70, water: 70, prep: 5, social: 15, fitness: 25, money: 600,
    attended: 0, held: 0, exams: [], inv, locker, sel: 0,
    flags: {}, fr: { arjun: 0, priya: 0, sana: 0, ravi: 0 }, talked: {}, slots: {}, events: {}, reminded: {},
    clubXP: 0, music: 0, practice: 0,
    pickups: [
      { id: 'usb', x: 1738, y: 545 }, { id: 'money', x: 2700, y: 1950 }, { id: 'money', x: 830, y: 1010 },
      { id: 'money', x: 2880, y: 2290 }, { id: 'tea', x: 1250, y: 1990 }, { id: 'money', x: 250, y: 320 },
    ],
    x: 530, y: 615,
  };
}
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }
function loadSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }

// ── Helpers ──────────────────────────────────────────────────
const hour = () => S.min / 60;
function fmtTime(min) {
  const h = Math.floor(min / 60) % 24, m = Math.floor(min % 60);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}
const fmtHour = (h) => fmtTime(h * 60);
const attPct = () => S.held ? Math.round(S.attended / S.held * 100) : 100;
function cgpa() {
  if (!S.exams.length) return null;
  const w = S.exams.map(e => e.final ? 1.5 : 1);
  return Math.round(S.exams.reduce((a, e, i) => a + e.gp * w[i], 0) / w.reduce((a, b) => a + b, 0) * 100) / 100;
}
const weekday = (d = S.day) => (d - 1) % 7;
function periodKey(h) {
  return h < 9 ? 'morning' : h < 12 ? 'class' : h < 13 ? 'lunch' : h < 16 ? 'lab' : h < 18 ? 'sports' : h < 21 ? 'evening' : 'night';
}
const PERIOD_LABEL = { morning: 'Morning', class: 'Lecture Hours', lunch: 'Lunch Break', lab: 'Lab Session', sports: 'Sports Hour', evening: 'Evening · Clubs & Projects', night: 'Night' };

function todaySlots(day = S.day) {
  const ev = EVENTS[day];
  if (ev && ev.type === 'exam') return [];
  const wd = weekday(day);
  if (wd === 6) return [];
  return TIMETABLE[wd].map((s, i) => s && ({ hour: SLOT_HOURS[i], subject: s[0], place: s[1], lab: s[1] === 'labs', key: day + '-' + i })).filter(Boolean);
}

function gain(d, silent) {
  const labels = { energy: 'Energy', hunger: 'Hunger', water: 'Water', prep: 'Prep', social: 'Social', fitness: 'Fitness' };
  let i = 0;
  for (const k in d) {
    if (!d[k]) continue;
    if (k === 'money') S.money = Math.max(0, S.money + d[k]);
    else S[k] = clamp(Math.round((S[k] + d[k]) * 10) / 10, 0, 100);
    if (!silent) {
      const txt = k === 'money' ? `${d[k] > 0 ? '+' : '−'}₹${Math.abs(d[k])}` : `${d[k] > 0 ? '+' : ''}${Math.round(d[k])} ${labels[k]}`;
      floaters.push({ x: S.x, y: S.y - 70 - i * 18, text: txt, color: d[k] > 0 ? '#8ef58e' : '#ff8a8a', t: 1.6 });
      i++;
    }
  }
}

function drainNeeds(mins) {
  S.hunger = clamp(S.hunger - 0.045 * mins, 0, 100);
  S.water = clamp(S.water - 0.055 * mins, 0, 100);
}
function advance(mins) {
  S.min += mins;
  S.energy = clamp(S.energy - 2.5 * mins / 60, 0, 100);
  drainNeeds(mins);
}
const skipPanel = (txt) => ({ scene: 'clock', art: '⏩', caption: txt });

function toast(msg, kind = '') {
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  // A leading emoji in the message becomes a matching SVG icon; otherwise pick one from the toast kind.
  const { icon, text } = Icons.split(msg);
  const ic = icon || (kind === 'good' ? 'check' : kind === 'bad' ? 'warning' : 'info');
  t.innerHTML = `<span class="t-ic">${Icons.svg(ic)}</span><span class="t-tx"></span>`;
  t.lastChild.textContent = Icons.strip(text);
  const box = $('#toasts');
  box.appendChild(t);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => t.classList.add('out'), 3600);
  setTimeout(() => t.remove(), 4200);
}

// ── Inventory ────────────────────────────────────────────────
const invHas = (id) => S.inv.some(s => s && s.id === id);
const ownsAnywhere = (id) => invHas(id) || S.locker.some(s => s && s.id === id) || S.pickups.some(p => p.id === id);
function addTo(arr, id, qty = 1) {
  const def = ITEMS[id];
  if (def.stack) {
    const s = arr.find(s => s && s.id === id && s.qty < def.stack);
    if (s) { s.qty += qty; return true; }
  }
  const i = arr.indexOf(null);
  if (i < 0) return false;
  arr[i] = { id, qty };
  return true;
}
function invAdd(id, qty = 1) { const ok = addTo(S.inv, id, qty); renderHotbar(); return ok; }
function invRemove(id) {
  const i = S.inv.findIndex(s => s && s.id === id);
  if (i < 0) return false;
  if (--S.inv[i].qty <= 0) S.inv[i] = null;
  renderHotbar();
  return true;
}
function useSelected() {
  const s = S.inv[S.sel];
  if (!s) return;
  const def = ITEMS[s.id];
  if (!def.use) { toast(`${def.icon} ${def.name}: ${def.desc}`); return; }
  gain(def.use);
  toast(`${def.icon} Used ${def.name}`);
  if (--s.qty <= 0) S.inv[S.sel] = null;
  renderHotbar();
}
function dropSelected() {
  const s = S.inv[S.sel];
  if (!s) return;
  const off = { up: [0, -30], down: [0, 26], left: [-30, 0], right: [30, 0] }[player.dir];
  S.pickups.push({ id: s.id, x: S.x + off[0], y: S.y + off[1] });
  if (--s.qty <= 0) S.inv[S.sel] = null;
  toast(`Dropped ${ITEMS[s.id].name}`);
  renderHotbar();
}

// ── NPCs ─────────────────────────────────────────────────────
// A random standing spot in a zone — off the roads where possible, so people don't loiter in front of traffic.
const onRoad = (x, y) => ROADS.some(r => x > r.x - 6 && x < r.x + r.w + 6 && y > r.y - 6 && y < r.y + r.h + 6);
function randIn(z) {
  let fallback = null;
  for (let i = 0; i < 40; i++) {
    const x = z.x + Math.random() * z.w, y = z.y + Math.random() * z.h;
    if (!reachable(x, y)) continue;
    if (!onRoad(x, y)) return { x, y };
    fallback = fallback || { x, y };
  }
  return fallback || { x: z.x + z.w / 2, y: z.y + z.h / 2 };
}
function makeNPCs() {
  npcs = [];
  const KIND = { arjun: 'hostel', ravi: 'hostel', priya: 'day', sana: 'day', prof: 'staff', coach: 'staff', librarian: 'staff', anna: 'staff', guard: 'guard' };
  for (const id of Object.keys(NPC_SCHED)) {
    npcs.push({ id, name: CHARS[id].name, look: CHARS[id], sched: NPC_SCHED[id], named: true, kind: KIND[id] || 'staff', home: id === 'arjun' ? 'hostel2' : 'hostel' });
  }
  const rnd = mulberry32(99);
  const pick = (a) => a[(rnd() * a.length) | 0];
  const pools = {
    morning: ['hostelFront', 'quad', 'canteenFront', 'gate'], class: ['blockFront', 'labsFront', 'libraryFront', 'quad'],
    lunch: ['canteenFront', 'quad', 'audiFront'], lab: ['labsFront', 'blockFront', 'libraryFront', 'garden'],
    sports: ['ground', 'court', 'quad', 'canteenFront'], evening: ['canteenFront', 'audiFront', 'libraryFront', 'hostelFront', 'garden'],
    night: ['hostelFront', 'canteenFront', 'quad'],
  };
  for (let i = 0; i < 20; i++) {
    const seed = (rnd() * 1000) | 0;
    npcs.push({
      id: 'student' + i, name: 'Student', named: false,
      kind: i < 12 ? 'hostel' : 'day', home: i % 2 ? 'hostel2' : 'hostel',
      look: {
        sprite: 1 + ((rnd() * 7) | 0),
        skin: pick(['#8d5524', '#c68642', '#e0ac69', '#a86b3c', '#7a4a24', '#d29a6a']),
        hair: pick(['#111', '#2a1608', '#3b2314', '#0d0d0d']),
        hairStyle: pick(['short', 'spiky', 'long', 'curly', 'bun', 'short']),
        shirt: pick(['#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#f4a261', '#8338ec', '#3a86ff', '#ff006e', '#06d6a0', '#adb5bd']),
        pants: pick(['#2b2d42', '#3d405b', '#1d3557', '#495057']), glasses: rnd() < 0.25,
        backpack: pick(['#264653', '#6d597a', '#bc4749', '#386641']),
      },
      sched: (h) => { const p = pools[periodKey(h)]; return p[(seed + S.day) % p.length]; },
    });
  }
  // Day scholars who come by college bus, and office staff who come by car (see the commute system in kenney_art.js).
  const looks = () => ({
    sprite: 1 + ((rnd() * 7) | 0),
    skin: pick(['#8d5524', '#c68642', '#e0ac69', '#a86b3c', '#7a4a24', '#d29a6a']),
    hair: pick(['#111', '#2a1608', '#3b2314', '#0d0d0d']),
    hairStyle: pick(['short', 'spiky', 'long', 'curly', 'bun', 'short']),
    shirt: pick(['#e76f51', '#2a9d8f', '#e9c46a', '#264653', '#f4a261', '#8338ec', '#3a86ff', '#ff006e', '#06d6a0', '#adb5bd']),
    pants: pick(['#2b2d42', '#3d405b', '#1d3557', '#495057']), glasses: rnd() < 0.25,
    backpack: pick(['#264653', '#6d597a', '#bc4749', '#386641']),
  });
  for (let i = 0; i < 26; i++) {
    const seed = (rnd() * 1000) | 0;
    npcs.push({ id: 'bus' + i, name: 'Student', named: false, kind: 'day', look: looks(),
      sched: (h) => { const p = pools[periodKey(h)]; return p[(seed + S.day) % p.length]; } });
  }
  const staffZones = ['blockFront', 'labsFront', 'adminFront', 'libraryFront'];
  for (let i = 0; i < 4; i++) {
    npcs.push({ id: 'staff' + i, name: 'Staff', named: false, kind: 'staff', look: { ...looks(), backpack: null, shirt: pick(['#6c757d', '#1d3557', '#9d4edd', '#2a9d8f']) },
      sched: (h) => h < 12 ? staffZones[i] : h < 13 ? 'canteenFront' : h < 16 ? staffZones[(i + 1) % 4] : 'adminFront' });
  }
  // Who arrives by vehicle (the rest are hostellers or the gate guard), and where they wait when their timetable is empty.
  const STAY = { prof: 'adminFront', coach: 'ground', librarian: 'libraryFront', anna: 'canteenFront', priya: 'libraryFront', sana: 'audiFront' };
  for (const n of npcs) {
    if (STAY[n.id] || n.kind === 'day' || /^staff\d/.test(n.id)) { n.commuter = true; n.stayZone = STAY[n.id] || (n.kind === 'staff' ? 'adminFront' : 'quad'); }
    n.busRider = n.commuter && (/^bus\d/.test(n.id) || ['student16', 'student17', 'student18', 'student19'].includes(n.id));
  }
  // Every NPC gets their own rhythm so nobody moves in lockstep.
  for (const n of npcs) Object.assign(n, {
    x: -999, y: -999, tx: 0, ty: 0, gather: null, spawnAt: null, replans: 0, dir: 'down', phase: Math.random() * 6, moving: false, zone: undefined, wait: 0, stuck: 0, visible: false, freeze: 0, bubble: null, bubbleT: 0, bubbleCD: 0, enter: null, inside: null, enterCD: 0,
    jit: (Math.random() - 0.5) * 0.5, r1: Math.random(), r2: Math.random(), spd: 0.8 + Math.random() * 0.45, stops: 0, anchor: null,
  });
}
const onScreen = (o, m = 80) => o.x > cam.x - m && o.x < cam.x + VW + m && o.y > cam.y - m && o.y < cam.y + VH + m + 60;

const GATE_INFO = gateInfo(GATE, WORLD_W, WORLD_H);
let gateAlpha = 1;   // fades while you walk behind the gate
const BACK_GATE_INFO = backGateInfo(getBackGate(), WORLD_W, WORLD_H);
const GATE_EXIT = GATE_INFO.exit;
// ── NPC route finding ────────────────────────────────────────
// A fine walk grid built from the current map. A cell is walkable only if a person standing there has elbow room
// (so routes never graze a wall corner), cells hugging walls cost more (people keep to the middle of a passage), and
// every cell knows which connected area it belongs to, so nobody is ever sent to a spot they can't reach.
const NAV = { c: 24, cols: 0, rows: 0, walk: null, cost: null, comp: null, main: 0 };
const onPaved = (x, y) => [...ROADS, ...PATHS].some(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
const roomy = (x, y) => !blocked(x, y) && !blocked(x - 6, y) && !blocked(x + 6, y) && !blocked(x, y + 5) && !blocked(x, y - 4);
function buildNav() {
  const c = NAV.c; NAV.cols = Math.ceil(WORLD_W / c); NAV.rows = Math.ceil(WORLD_H / c);
  const C = NAV.cols, R = NAV.rows, N = C * R;
  NAV.walk = new Uint8Array(N); NAV.cost = new Float32Array(N); NAV.comp = new Int32Array(N).fill(-1);
  for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) {
    const x = (i + 0.5) * c, y = (j + 0.5) * c + 4, k = j * C + i;
    NAV.walk[k] = roomy(x, y) ? 1 : 0;
    NAV.cost[k] = PATHS.some(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) ? 1 : onRoad(x, y) ? 2.6 : 1.4;   // walkers use paths and grass, and cross roads rather than walk along them
  }
  for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) {   // keep away from walls
    const k = j * C + i; if (!NAV.walk[k]) continue;
    let near = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= C || b >= R || !NAV.walk[b * C + a]) near++; }
    if (near) NAV.cost[k] += 0.8 + near * 0.25;
  }
  // connected areas (flood fill); the main one is wherever the main gate opens onto
  let id = 0; const sizes = [];
  for (let s = 0; s < N; s++) {
    if (!NAV.walk[s] || NAV.comp[s] >= 0) continue;
    const st = [s]; NAV.comp[s] = id; let n = 0;
    while (st.length) {
      const k = st.pop(); n++;
      const i = k % C, j = (k / C) | 0;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= C || b >= R) continue; const q = b * C + a; if (NAV.walk[q] && NAV.comp[q] < 0) { NAV.comp[q] = id; st.push(q); } }
    }
    sizes.push(n); id++;
  }
  const g = nearestWalkCell(...navCell(GATE_EXIT.x, GATE_EXIT.y));
  NAV.main = g ? NAV.comp[g[1] * C + g[0]] : sizes.indexOf(Math.max(...sizes));
}
const navCell = (x, y) => [clamp(Math.floor(x / NAV.c), 0, NAV.cols - 1), clamp(Math.floor(y / NAV.c), 0, NAV.rows - 1)];
// Is (x, y) a spot people can stand on and walk to from the rest of campus?
function reachable(x, y) {
  if (!NAV.walk) return !blocked(x, y);
  const [i, j] = navCell(x, y), k = j * NAV.cols + i;
  return NAV.walk[k] === 1 && NAV.comp[k] === NAV.main && !blocked(x, y);
}
function nearestWalkCell(i, j, mainOnly = false) {
  const ok = (k) => NAV.walk[k] && (!mainOnly || NAV.comp[k] === NAV.main);
  if (ok(j * NAV.cols + i)) return [i, j];
  for (let r = 1; r < 16; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
    const a = i + di, b = j + dj;
    if (a >= 0 && b >= 0 && a < NAV.cols && b < NAV.rows && ok(b * NAV.cols + a)) return [a, b];
  }
  return null;
}
const cellCentre = ([i, j]) => ({ x: (i + 0.5) * NAV.c, y: (j + 0.5) * NAV.c + 4 });
function lineClear(ax, ay, bx, by) {
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 10);
  for (let i = 1; i < n; i++) { const t = i / n; if (blocked(ax + (bx - ax) * t, ay + (by - ay) * t)) return false; }
  return true;
}
// A corridor check as wide as a person (plus a little elbow room), used to straighten routes.
function wideClear(ax, ay, bx, by) {
  const d = Math.hypot(bx - ax, by - ay) || 1, nx = -(by - ay) / d * 9, ny = (bx - ax) / d * 9;
  return lineClear(ax, ay, bx, by) && lineClear(ax + nx, ay + ny, bx + nx, by + ny) && lineClear(ax - nx, ay - ny, bx - nx, by - ny);
}
// Route from (x0,y0) to (x1,y1) as a list of waypoints (ending at the target), or null if there is none.
function navPath(x0, y0, x1, y1) {
  if (!NAV.walk) return null;
  if (Math.hypot(x1 - x0, y1 - y0) < 220 && wideClear(x0, y0, x1, y1)) return [{ x: x1, y: y1 }];
  const s0 = nearestWalkCell(...navCell(x0, y0)), g0 = nearestWalkCell(...navCell(x1, y1));
  if (!s0 || !g0) return null;
  const C = NAV.cols, start = s0[1] * C + s0[0], goal = g0[1] * C + g0[0];
  if (NAV.comp[start] !== NAV.comp[goal]) return null;   // can't get there from here
  const gs = new Float32Array(C * NAV.rows).fill(Infinity), from = new Int32Array(C * NAV.rows).fill(-1), closed = new Uint8Array(C * NAV.rows);
  const heap = [];   // binary heap of [f, k]
  const push = (f, k) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const pI = (i - 1) >> 1; if (heap[pI][0] <= heap[i][0]) break; [heap[pI], heap[i]] = [heap[i], heap[pI]]; i = pI; } };
  const pop = () => { const top = heap[0], end = heap.pop(); if (heap.length) { heap[0] = end; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const hx = g0[0], hy = g0[1], H = (i, j) => Math.hypot(i - hx, j - hy);
  gs[start] = 0; push(H(s0[0], s0[1]), start);
  let found = false;
  while (heap.length) {
    const [, k] = pop();
    if (closed[k]) continue;
    if (k === goal) { found = true; break; }
    closed[k] = 1;
    const i = k % C, j = (k / C) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue;
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= C || b >= NAV.rows) continue;
      const nk = b * C + a;
      if (!NAV.walk[nk] || closed[nk]) continue;
      if (di && dj && (!NAV.walk[j * C + a] || !NAV.walk[b * C + i])) continue;   // don't cut corners
      const ng = gs[k] + NAV.cost[nk] * (di && dj ? 1.414 : 1);
      if (ng < gs[nk]) { gs[nk] = ng; from[nk] = k; push(ng + H(a, b), nk); }
    }
  }
  if (!found) return null;
  const cells = [];
  for (let k = goal; k !== -1; k = from[k]) cells.push(cellCentre([k % C, (k / C) | 0]));
  cells.reverse();
  cells.push({ x: x1, y: y1 });
  // Straighten: skip waypoints reachable along a clear, person-wide corridor.
  const out = []; let cx = x0, cy = y0, i = 0;
  while (i < cells.length) {
    let far = i;
    for (let j = Math.min(cells.length - 1, i + 12); j > i; j--) if (wideClear(cx, cy, cells[j].x, cells[j].y)) { far = j; break; }
    out.push(cells[far]); cx = cells[far].x; cy = cells[far].y; i = far + 1;
  }
  return out;
}
// Give an NPC a new destination and plan the route to it.
function setNpcTarget(n, x, y) {
  if (NAV.walk && !reachable(x, y)) { const c = nearestWalkCell(...navCell(x, y), true); if (c) ({ x, y } = cellCentre(c)); }
  n.tx = x; n.ty = y;
  n.path = navPath(n.x, n.y, x, y);
  n.stuck = 0; n.replans = 0;
}

const npcHome = (n) => n.commuter ? vehicleDoor(n.vehicle) : n.kind === 'hostel' ? doorOf(n.home)
  : GATE_INFO.horiz ? { x: GATE_EXIT.x + (n.r2 - 0.5) * 160, y: GATE_EXIT.y } : { x: GATE_EXIT.x, y: GATE_EXIT.y + (n.r2 - 0.5) * 160 };

// Where this NPC should be right now (null = heading home / not on campus).
// Hostelers are back in their hostel by 7:30 PM; day scholars and staff are out of the gate by 6 PM at the latest.
// Students who came by bus spend the morning lectures inside their department block, then come out.
const CLASS_END_H = 12;      // the 11 o'clock lecture ends at 12:00 (lunch)
const MAX_CROWD = 5;         // never more than this many people standing together
function classZone(b) {
  const k = 'class_' + b.id;
  if (!ZONES[k]) { const d = doorInfo(b); ZONES[k] = { x: d.x - 8, y: d.y - 8, w: 16, h: 16, classOf: b.id }; }
  return k;
}
// How many visible people stand (or are about to stand) within r of a point.
function crowdAt(x, y, self, r = 85) {
  let c = 0;
  for (const o of npcs) if (o !== self && o.visible && !o.inClass && (Math.hypot(o.x - x, o.y - y) < r || (o.moving && Math.hypot(o.tx - x, o.ty - y) < r))) c++;
  return c;
}
function npcZone(n) {
  const h = hour();
  if (n.commuter) {   // only on campus between getting out of their vehicle and walking back to it
    if (!n.vehicle || !n.arrived || n.boarded || h >= n.leaveAt) return null;
    if (n.classB && !n.skipClass && h + n.jit * 0.3 < CLASS_END_H) return classZone(n.classB);   // in lectures till the 11 o'clock one ends
    return n.sched(h + n.jit) || n.stayZone;
  }
  if (n.kind === 'hostel' && (h >= 18.8 + n.r1 * 0.4 || h < 6.8 + n.r2 * 1.4)) return null;
  if (n.kind === 'day' && (h >= 16.3 + n.r1 * 1.2 || h < 7 + n.r2 * 1.2)) return null;
  return n.sched(h + n.jit);
}
const npcGone = (n) => { const h = hour(); return (n.kind === 'hostel' && h >= 19.5) || (n.kind === 'day' && h >= 18); };

// Pick a standing spot in a zone near an anchor, away from other NPCs, that can actually be walked to.
function npcSpot(n, zr, near) {
  let best = null, bd = -Infinity;
  for (let i = 0; i < 10; i++) {
    let p = randIn(zr);
    if (near) {
      const x = near.x + (Math.random() - 0.5) * 140, y = near.y + (Math.random() - 0.5) * 80;
      if (x > zr.x && x < zr.x + zr.w && y > zr.y && y < zr.y + zr.h && reachable(x, y) && !onRoad(x, y)) p = { x, y };
    }
    let d = 1e9;
    for (const o of npcs) if (o !== n && o.visible) d = Math.min(d, Math.hypot(p.x - o.x, p.y - o.y), Math.hypot(p.x - o.tx, p.y - o.ty));
    const crowded = !zr.classOf && crowdAt(p.x, p.y, n) >= MAX_CROWD - 1;   // a spot where they'd make a crowd of 6+
    if (crowded) d -= 1000;
    if (d > bd) { bd = d; best = p; }
    if (d > 90 && !crowded) break;
  }
  return best;
}

// ── Gatherings: little circles of people chatting, facing each other ──
// Which building each open zone sits in front of, so people can actually go inside now and then.
const ZONE_BUILDING = {};
function tagZoneBuildings() {
  for (const k of Object.keys(ZONE_BUILDING)) delete ZONE_BUILDING[k];
  for (const [k, zr] of Object.entries(ZONES)) {
    if (zr.classOf || !/Front$/.test(k)) continue;
    const cx = zr.x + zr.w / 2, cy = zr.y + zr.h / 2;
    let best = null, bd = 380;
    for (const b of BUILDINGS) {
      const d = doorInfo(b);
      const dist = Math.hypot(d.x - cx, d.y - cy);
      if (dist < bd) { bd = dist; best = b; }
    }
    if (best) ZONE_BUILDING[k] = best.id;
  }
}
function zoneBuilding(key) {
  const zr = ZONES[key];
  if (!zr) return null;
  if (zr.classOf) return BUILDINGS.find(b => b.id === zr.classOf) || null;
  return ZONE_BUILDING[key] ? BUILDINGS.find(b => b.id === ZONE_BUILDING[key]) || null : null;
}

const GROUPS = [];
const GROUP_LINES = ['Did you finish the assignment?', 'The canteen samosas are elite today.', 'Who\'s coming to the match?', 'Sir said it\'s on the exam!', 'Lab record due tomorrow…', 'Bro, the Wi-Fi is down again.', 'Fest Night is going to be huge!', 'Let\'s grab chai after this.', 'Did you see the notice board?', 'I slept through the alarm, again.'];
function joinGroup(n, zr) {
  for (let i = GROUPS.length - 1; i >= 0; i--) if (GROUPS[i].members.length === 0 || GROUPS[i].until < S.min) GROUPS.splice(i, 1);
  if (ZONES[n.zone] && ZONES[n.zone].classOf) return false;
  let g = GROUPS.find(q => q.zone === n.zone && q.members.length < q.size && Math.hypot(q.x - n.x, q.y - n.y) < 420 && crowdAt(q.x, q.y, n, 90) < MAX_CROWD - 1);
  if (!g) {
    if (Math.random() > 0.55) return false;
    const c = npcSpot(n, zr); if (!c) return false;
    // a new circle needs its own space: no other circle close by and nobody much around
    if (GROUPS.some(q => Math.hypot(q.x - c.x, q.y - c.y) < 190) || crowdAt(c.x, c.y, n, 110) > 1) return false;
    // need open ground around the centre for the circle
    for (let a = 0; a < 6; a++) if (!reachable(c.x + Math.cos(a) * 30, c.y + Math.sin(a) * 20)) return false;
    for (let a = 0; a < 8; a++) if (onRoad(c.x + Math.cos(a * 0.785) * 52, c.y + Math.sin(a * 0.785) * 40)) return false;   // keep chat circles off the roads
    g = { zone: n.zone, x: c.x, y: c.y, members: [], size: 2 + ((Math.random() * 3) | 0), until: S.min + 25 + Math.random() * 50, talkT: 2 };
    GROUPS.push(g);
  }
  const slot = g.members.length, ang = (slot / g.size) * Math.PI * 2 + 0.4, r = 22 + g.size * 3;
  g.members.push(n); n.gather = g;
  const sx = g.x + Math.cos(ang) * r, sy = g.y + Math.sin(ang) * r * 0.7;
  setNpcTarget(n, sx, sy);
  return true;
}
// Break up any knot of more than MAX_CROWD people standing together: the extra ones go and stand somewhere else.
let crowdT = 0;
function capCrowds() {
  const still = npcs.filter(n => n.visible && !n.inClass && !n.moving && n.zone && ZONES[n.zone] && !ZONES[n.zone].classOf);
  const staying = new Set(still);
  for (const n of still) {
    let c = 1;
    for (const o of staying) if (o !== n && Math.hypot(o.x - n.x, o.y - n.y) < 85) c++;
    if (c <= MAX_CROWD) continue;
    staying.delete(n);
    leaveGroup(n);
    let p = npcSpot(n, ZONES[n.zone]);
    if (!p || crowdAt(p.x, p.y, n) >= MAX_CROWD - 1) {   // the whole zone is busy: wander over to the nearest quieter one
      const alts = Object.keys(ZONES).filter(k => k !== n.zone && !ZONES[k].classOf && k !== 'gate')
        .map(k => ({ k, z: ZONES[k], d: Math.hypot(ZONES[k].x + ZONES[k].w / 2 - n.x, ZONES[k].y + ZONES[k].h / 2 - n.y) })).sort((a, b) => a.d - b.d);
      for (const a of alts.slice(0, 4)) { const q = npcSpot(n, a.z); if (q && crowdAt(q.x, q.y, n) < MAX_CROWD - 1) { p = q; n.overflow = a.k; n.overflowUntil = S.min + 20 + Math.random() * 25; break; } }
    }
    if (!p) continue;
    n.enter = null;
    setNpcTarget(n, p.x, p.y); n.anchor = p; n.wait = 0; n.freeze = 0;
  }
}
function leaveGroup(n) {
  const g = n.gather; if (!g) return;
  g.members = g.members.filter(m => m !== n); n.gather = null;
}
function updateGroups(dt) {
  for (const g of GROUPS) {
    const here = g.members.filter(m => m.visible && !m.moving && Math.hypot(m.x - g.x, m.y - g.y) < 70);
    if (here.length < 2) continue;
    g.talkT -= dt;
    if (g.talkT <= 0) {
      g.talkT = 3 + Math.random() * 4;
      const m = here[(Math.random() * here.length) | 0];
      if (!m.named && m.bubbleT <= 0 && onScreen(m, 0)) { m.bubble = GROUP_LINES[(Math.random() * GROUP_LINES.length) | 0]; m.bubbleT = 2.6; }
    }
  }
}
// Face a point (four-way sprites), with a little hysteresis so people don't flicker between two directions.
function faceTowards(n, dx, dy) {
  const ax = Math.abs(dx), ay = Math.abs(dy);
  const horiz = n.dir === 'left' || n.dir === 'right';
  const useH = horiz ? ax > ay * 0.8 : ax > ay * 1.25;
  n.dir = useH ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
}

const NPC_GRID = new Map();
const NPC_CELL = 32;
function buildNpcGrid() {
  NPC_GRID.clear();
  for (const n of npcs) {
    if (!n.visible) continue;
    const k = ((n.x / NPC_CELL) | 0) + ',' + ((n.y / NPC_CELL) | 0);
    let a = NPC_GRID.get(k); if (!a) NPC_GRID.set(k, a = []); a.push(n);
  }
}
function eachNearbyNpc(n, fn) {
  const cx = (n.x / NPC_CELL) | 0, cy = (n.y / NPC_CELL) | 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const a = NPC_GRID.get((cx + dx) + ',' + (cy + dy));
    if (a) for (const o of a) fn(o);
  }
}

function updateNPC(n, dt) {
  const z = npcZone(n);
  if (n.inside) {
    const ins = n.inside;
    if (z === ins.zone && S.min < ins.until) return;
    n.inside = null;
    n.visible = true;
    n.x = ins.door.x; n.y = ins.door.y;
    n.tx = n.x; n.ty = n.y; n.path = null;
    n.wait = 1 + Math.random() * 2;
    n.anchor = null;
    n.enterCD = S.min + 25 + Math.random() * 35;
    n.moving = false;
  }
  if (z !== n.zone) {
    leaveGroup(n);
    n.enter = null;
    n.zone = z; n.overflow = null;
    if (z) {
      const zr = ZONES[z];
      if (!n.visible) {
        let o = n.kind === 'guard' || n.spawnInZone ? npcSpot(n, zr) : (n.spawnAt || npcHome(n));
        if (!reachable(o.x, o.y)) { const c = nearestWalkCell(...navCell(o.x, o.y), true); if (c) o = cellCentre(c); }
        n.spawnInZone = false; n.spawnAt = null; n.inClass = false;
        n.x = o.x; n.y = o.y; n.visible = true; n.wait = n.commuter ? n.r1 * 0.8 : n.r1 * 4;
      } else if (!onScreen(n)) { const p = npcSpot(n, zr); n.x = p.x; n.y = p.y; n.wait = Math.random() * 3; }
      const p = npcSpot(n, zr); setNpcTarget(n, p.x, p.y); n.anchor = p; n.stops = 0;
    } else { const h = npcHome(n); setNpcTarget(n, h.x, h.y); n.wait = 0; }
  }
  if (!n.visible) return;
  if (!n.zone && (!onScreen(n) || (!n.commuter && npcGone(n)))) { if (n.commuter) n.boarded = true; n.visible = false; return; }
  if (n.bubbleT > 0) n.bubbleT -= dt;
  if (n.bubbleCD > 0) n.bubbleCD -= dt;
  if (n.freeze > 0) {
    n.freeze -= dt; n.moving = false;
    faceTowards(n, S.x - n.x, S.y - n.y);
    return;
  }
  if (n.wait > 0) {
    n.wait -= dt; n.moving = false;
    if (n.gather) {   // in a circle: face the middle, or whoever is talking
      const g = n.gather, talker = g.members.find(m => m !== n && m.bubbleT > 0);
      faceTowards(n, (talker ? talker.x : g.x) - n.x, (talker ? talker.y : g.y) - n.y);
      if (g.until < S.min) { n.wait = Math.min(n.wait, Math.random() * 2); leaveGroup(n); }
    }
    return;
  }
  const d = Math.hypot(n.tx - n.x, n.ty - n.y);
  if (d < 6 || (!n.zone && d < 26)) {
    n.moving = false;
    if (!n.zone) { if (n.commuter) n.boarded = true; n.visible = false; return; }   // walked into the hostel / got into their vehicle
    if (n.enter) {
      const e = n.enter; n.enter = null;
      if (n.zone === e.zone && S.min < e.until) {
        n.inside = { zone: n.zone, door: e.door, until: e.until };
        n.visible = false; n.inClass = false; n.moving = false;
        return;
      }
    }
    if (ZONES[n.zone] && ZONES[n.zone].classOf) { leaveGroup(n); n.inClass = true; n.visible = false; n.spawnAt = { x: n.x + (Math.random() - 0.5) * 24, y: n.y + (Math.random() - 0.5) * 16 }; return; }   // into the lecture hall
    // Sometimes walk into the building this area belongs to, rather than loiter outside it forever.
    if (!n.gather && !n.overflow && n.kind !== 'guard' && (!n.named || n.kind === 'staff') && S.min >= (n.enterCD || 0) && Math.random() < 0.45) {
      const b = zoneBuilding(n.zone);
      if (b) {
        const di = doorInfo(b);
        n.enter = { zone: n.zone, door: { x: di.x, y: di.y }, until: S.min + 20 + Math.random() * 35 };
        setNpcTarget(n, di.x, di.y); n.wait = 0;
        return;
      }
    }
    if (n.overflow && (S.min > n.overflowUntil || !ZONES[n.overflow])) n.overflow = null;
    const zr = ZONES[n.overflow || n.zone];
    if (!n.gather && crowdAt(n.x, n.y, n) >= MAX_CROWD) { const tx = n.tx, ty = n.ty; capCrowds(); if (n.tx !== tx || n.ty !== ty) return; }   // arrived somewhere already busy: someone moves on
    if (n.gather) { n.wait = 8 + Math.random() * 18; return; }   // took their place in the circle
    // Idle: often join (or start) a chat circle, otherwise hang around one spot and now and then stroll to a new one.
    if (n.kind !== 'guard' && Math.random() < 0.5 && joinGroup(n, zr)) return;
    n.wait = Math.random() < 0.25 ? 8 + Math.random() * 10 : 2 + Math.random() * 6;
    if (++n.stops % 4 === 0 || !n.anchor) n.anchor = npcSpot(n, zr);
    const p = npcSpot(n, zr, n.anchor); setNpcTarget(n, p.x, p.y);
    return;
  }
  if (n.gather && d > 6) { /* walking to the circle */ } else if (n.gather) leaveGroup(n);
  const zr = n.zone && ZONES[n.zone];
  const inZone = zr && n.x > zr.x && n.x < zr.x + zr.w && n.y > zr.y && n.y < zr.y + zr.h;
  const sp = (inZone ? 52 : 105) * n.spd;
  // follow the planned route; skip ahead whenever a later waypoint is in plain view
  let gx = n.tx, gy = n.ty;
  if (n.path && n.path.length) {
    while (n.path.length > 1 && Math.hypot(n.path[0].x - n.x, n.path[0].y - n.y) < 14) n.path.shift();
    if (n.path.length > 1 && (n.skipT = (n.skipT || 0) - dt) <= 0) { n.skipT = 0.4; if (wideClear(n.x, n.y, n.path[1].x, n.path[1].y)) n.path.shift(); }
    gx = n.path[0].x; gy = n.path[0].y;
  }
  const dx = gx - n.x, dy = gy - n.y, dg = Math.max(0.001, Math.hypot(dx, dy));
  const step = Math.min(sp * dt, dg + 0.5);
  let vx = dx / dg * step, vy = dy / dg * step;
  // Gentle sideways give-way to anyone close in front, so people pass each other instead of walking through.
  let sx = 0, sy = 0;
  eachNearbyNpc(n, (o) => {
    if (o === n || !o.visible) return;
    const ox = n.x - o.x, oy = n.y - o.y, dd = ox * ox + oy * oy;
    if (dd < 900 && dd > 0.01) { const d = Math.sqrt(dd), k = (30 - d) / 30; sx += ox / d * k; sy += oy / d * k; }
  });
  if (sx || sy) { const l = Math.hypot(sx, sy); vx += sx / l * step * 0.45; vy += sy / l * step * 0.45; }
  const free = (x, y) => !blocked(x, y) && !vehicleBlocks(x, y, n.x, n.y);
  const px = n.x, py = n.y;
  if (free(n.x + vx, n.y + vy)) { n.x += vx; n.y += vy; }
  else if (free(n.x + dx / dg * step, n.y + dy / dg * step)) { n.x += dx / dg * step; n.y += dy / dg * step; }   // drop the give-way if it pushes into a wall
  else {
    // slide along the wall, or edge round the corner
    let moved = false;
    for (const [ax, ay] of [[vx, 0], [0, vy]]) if (!moved && (Math.abs(ax) + Math.abs(ay)) > 0.05 && free(n.x + ax, n.y + ay)) { n.x += ax; n.y += ay; moved = true; }
    if (!moved) for (const turn of [0.6, -0.6, 1.2, -1.2]) {
      const c = Math.cos(turn), s = Math.sin(turn), tx = (dx * c - dy * s) / dg * step, ty = (dx * s + dy * c) / dg * step;
      if (free(n.x + tx, n.y + ty)) { n.x += tx; n.y += ty; moved = true; break; }
    }
  }
  const mvx = n.x - px, mvy = n.y - py;
  n.moving = true; n.phase += dt * 10 * n.spd;
  faceTowards(n, Math.abs(mvx) + Math.abs(mvy) > 0.01 ? mvx : dx, Math.abs(mvx) + Math.abs(mvy) > 0.01 ? mvy : dy);
  // made no real progress? re-plan from here, then step onto open ground, then give up on this spot
  if (Math.hypot(mvx, mvy) < step * 0.3) {
    n.stuck += dt;
    if (n.stuck > 0.6) {
      n.stuck = 0; n.replans = (n.replans || 0) + 1;
      if (!onScreen(n)) { n.x = n.tx; n.y = n.ty; n.path = null; if (!reachable(n.x, n.y) && zr) { const p = npcSpot(n, zr); n.x = p.x; n.y = p.y; } }
      else if (n.replans === 1) { const r = n.replans; setNpcTarget(n, n.tx, n.ty); n.replans = r; }
      else if (n.replans === 2) {
        const c = nearestWalkCell(...navCell(n.x, n.y), true);
        if (c) { const q = cellCentre(c); if (Math.hypot(q.x - n.x, q.y - n.y) < 30 && free(q.x, q.y)) { n.x = q.x; n.y = q.y; } }
        const r = n.replans; setNpcTarget(n, n.tx, n.ty); n.replans = r;
      } else {
        leaveGroup(n);
        n.enter = null;
        const p = zr ? npcSpot(n, zr) : npcHome(n); setNpcTarget(n, p.x, p.y);
      }
    }
  } else if (n.stuck > 0) n.stuck = Math.max(0, n.stuck - dt);
}

// ── Story / dialogue content ─────────────────────────────────
const LECTURE_LINES = {
  DBMS: 'Today: normalization. 1NF, 2NF, 3NF… and BCNF will be on the exam. Hint, hint.',
  Operating: 'Deadlock needs four conditions: mutual exclusion, hold-and-wait, no preemption, circular wait.',
  Computer: 'The OSI model has seven layers. "Please Do Not Throw Sausage Pizza Away!"',
  Probability: 'Bayes\' theorem — the most useful formula you will ever forget. Write it down!',
  Algorithms: 'Dijkstra fails with negative edges. Bellman-Ford doesn\'t. Remember that.',
  Software: 'Requirements first, code later. Waterfall, Agile… and your project deadlines.',
  Lab: 'Lab session: write the code, record the output, get your record signed before you leave.',
};
const QUIZ = {
  DBMS: ['Which normal form removes transitive dependencies?', ['2NF', '3NF', '1NF'], 1],
  Operating: ['Which one is NOT a deadlock condition?', ['Circular wait', 'Preemption', 'Hold and wait'], 1],
  Computer: ['Which OSI layer handles routing?', ['Network', 'Transport', 'Session'], 0],
  Probability: ['P(A|B) equals…', ['P(B|A)·P(A) / P(B)', 'P(A)·P(B)', 'P(A) + P(B)'], 0],
  Algorithms: ['Time complexity of binary search?', ['O(n)', 'O(log n)', 'O(n log n)'], 1],
  Software: ['Agile teams deliver work in…', ['Sprints', 'One big release', 'Waterfalls'], 0],
};
const subjKey = (s) => s.includes('Lab') ? 'Lab' : Object.keys(LECTURE_LINES).find(k => s.startsWith(k)) || 'DBMS';

function introStory() {
  return [
    { scene: 'dawn', art: '🏫', sfx: 'DAY 1!', caption: `MVSR Engineering College · Day 1 · ${fmtTime(S.min)}` },
    { narr: `${S.name} arrives at the MVSR main gate. First day of the new semester!` },
    { who: 'ravi', text: `There you are, ${S.name}! New semester, and you STILL don't have your ID card!` },
    { who: 'player', text: 'Just got off the bus… give me a minute!' },
    { who: 'ravi', text: `No ID means no library, no labs, no exams. Get it from the ${bName('admin')}. Follow the arrow. GO!`, newPage: true },
    { narr: 'WASD / Arrows to move · E to interact · 1–9 select items · F use · Q drop · T timetable · M map · Z wait · H help' },
    { narr: 'Your backpack holds only 9 items. Spare gear lives in your hostel locker — plan what you carry each day!' },
  ];
}

function morningStory(day) {
  const wd = DAY_NAMES[weekday(day)];
  const head = { scene: 'dawn', art: '☀️', caption: `Day ${day} · ${wd}${EVENTS[day] ? ' · ' + EVENTS[day].name : ''}` };
  const team = S.flags.team;
  switch (day) {
    case 3: return [head, { who: 'ravi', text: 'Mid-terms are TOMORROW at 10. The library is open till 10 PM tonight. Just saying.' }];
    case 4: return [{ scene: 'exam', art: '📝', sfx: 'EXAM DAY!', caption: `Mid-Term 1 · 10:00 AM · ${bName('blockA')}` }, { who: 'ravi', text: 'ID card. Pen. Calculator. Check your bag twice!' }];
    case 6: return [head, team ? { who: 'arjun', text: 'Final is TOMORROW, 4 PM! Bring your sports kit and your A-game!' } : { who: 'arjun', text: 'Tomorrow\'s the cricket final… still time to join the team. Talk to Coach today!' }];
    case 7: return [{ scene: 'stadium', art: '🏏', sfx: 'SUNDAY!', caption: 'No classes · Inter-College Cricket Final at 4 PM' }];
    case 8: return [{ scene: 'exam', art: '📝', sfx: 'ROUND TWO!', caption: `Mid-Term 2 · 10:00 AM · ${bName('blockA')}` }];
    case 9: return [head, { who: 'sana', text: 'Fest Night is TOMORROW! The Music Club needs performers — come jam with us in the evening.' }];
    case 10: return [{ scene: 'stage', art: '🎤', sfx: 'FEST!', caption: `Classes as usual · Fest Night at 7 PM, ${bName('audi')}` }];
    case 11: return [head, { who: 'priya', text: 'Finals are tomorrow. I\'ll be at the library all evening if you want to group study.' }];
    case 12: return [{ scene: 'exam', art: '🎓', sfx: 'FINALS!', caption: `Semester Finals · 10:00 AM · ${bName('blockA')}` }, { who: 'ravi', text: 'Last day, roomie. Make it count.' }];
    default: {
      const tips = ['Tip: Lectures are worth more prep if you carry a Notebook.', 'Tip: Labs need a Lab Coat AND your ID card.', 'Tip: Canteen meals restore lots of energy.', 'Tip: The Coding Club needs a laptop — it\'s in your locker.', 'Tip: Toss a coin in the fountain before an exam… for luck.'];
      return [head, { narr: tips[day % tips.length] }];
    }
  }
}

// ── Interaction ──────────────────────────────────────────────
const SPOTS = [
  { id: 'court', x: 1590, y: 410, r: 90, label: '🏀 Shoot some hoops' },
  { id: 'fountain', x: FOUNTAIN.x, y: FOUNTAIN.y + 40, r: 70, label: '🪙 Toss a coin in the fountain' },
  { id: 'notice', x: NOTICE.x + 25, y: NOTICE.y + 14, r: 50, label: '📋 Read the notice board' },
];

function findTarget() {
  let best = null, bd = 1e9;
  const consider = (d, r, o) => { if (d < r && d < bd) { bd = d; best = o; } };
  for (const n of npcs) if (n.visible) consider(Math.hypot(n.x - S.x, n.y - S.y), 50, { kind: 'npc', n, x: n.x, y: n.y - 62, label: n.named ? `Talk to ${n.name}` : 'Chat' });
  for (const p of S.pickups) consider(Math.hypot(p.x - S.x, p.y - S.y), 40, { kind: 'pickup', p, x: p.x, y: p.y - 34, label: `Pick up ${ITEMS[p.id].name}` });
  for (const b of BUILDINGS) { const d = doorOf(b.id); consider(Math.hypot(d.x - S.x, d.y - S.y), 55, { kind: 'door', b, x: d.x, y: d.y - 80, label: `Enter ${b.name}` }); }
  for (const s of SPOTS) consider(Math.hypot(s.x - S.x, s.y - S.y), s.r, { kind: 'spot', s, x: s.x, y: s.y - 60, label: s.label });
  return best;
}

function interact() {
  if (!target) return;
  if (target.kind === 'pickup') {
    const p = target.p, def = ITEMS[p.id];
    if (def.instant) { gain({ money: def.instant }); S.pickups.splice(S.pickups.indexOf(p), 1); toast(`💵 Found ₹${def.instant}!`, 'good'); return; }
    if (!invAdd(p.id)) { toast('🎒 Backpack full! Drop something (Q) or use your hostel locker.', 'bad'); return; }
    S.pickups.splice(S.pickups.indexOf(p), 1);
    toast(`${def.icon} Picked up ${def.name}`, 'good');
    if (p.id === 'usb' && !S.flags.usbQuest) toast('Hmm, "CODING CLUB" is written on it…');
    return;
  }
  if (target.kind === 'npc') return talkTo(target.n);
  if (target.kind === 'door') return enterBuilding(target.b);
  if (target.kind === 'spot') return useSpot(target.s);
}

function choice(who, text, options) { return { who, text, options: options.concat([{ label: '🚪 Leave' }]) }; }

// ── Building menus ───────────────────────────────────────────
function enterBuilding(b) {
  const h = hour();
  switch (b.id) {
    case 'hostel2': return hostelMenu();
    case 'hostel': return Comic.play([{ narr: `${bName('hostel')}. Your room is in ${bName('hostel2')}.` }]);
    case 'canteen': return canteenMenu();
    case 'library': return libraryMenu();
    case 'admin': return adminMenu();
    case 'audi': return audiMenu();
    case 'blockA': case 'blockB': case 'labs': return classroomMenu(b);
    default: return Comic.play([{ narr: `${b.name}. Nothing to do here right now.` }]);   // scenery buildings added in the Map Editor
  }
}

function hostelMenu() {
  const h = hour();
  const canSleep = h >= 19 || S.energy < 25;
  Comic.play([choice('player', `Room 214, ${bName('hostel2')}. Home sweet home. What now?`, [
    { label: '😴 Sleep until morning', disabled: canSleep ? null : 'after 7 PM or when exhausted', after: () => sleep(false) },
    { label: '💤 Nap for 1 hour (+15 energy)', act: () => { advance(60); gain({ energy: 15 }); return [skipPanel('One hour later… you feel refreshed.')]; } },
    { label: '🎒 Open locker', after: openLocker },
  ])]);
}

function canteenMenu() {
  const h = hour();
  if (h < 7 || h >= 21.5) return Comic.play([{ narr: 'The canteen is closed. (Open 7 AM – 9:30 PM)' }]);
  const buy = (id, cost) => () => {
    if (S.money < cost) return [{ who: 'anna', text: 'Arre, no money? Come back later, thambi.' }];
    gain({ money: -cost });
    if (!invAdd(id)) { gain(ITEMS[id].use); return [{ who: 'anna', text: 'Your bag is full! Have it right here then.' }]; }
    return [{ who: 'anna', text: `One ${ITEMS[id].name}, hot and fresh! ${ITEMS[id].icon}` }];
  };
  const friendsHere = npcs.filter(n => n.visible && ['arjun', 'priya', 'sana', 'ravi'].includes(n.id) && n.zone === 'canteenFront');
  Comic.play([choice('anna', 'Welcome welcome! What will you have?', [
    { label: '☕ Chai — ₹15', act: buy('tea', 15) },
    { label: '🥟 Samosa — ₹20', act: buy('snack', 20) },
    { label: '🍎 Fruit cup — ₹25', act: buy('fruit', 25) },
    { label: '🍛 Full meals — ₹60 (+35 energy, +45 hunger, +30 water, 30 min)', disabled: S.money < 60 ? 'not enough money' : null, act: () => { gain({ money: -60, energy: 35, hunger: 45, water: 30 }); advance(30); return [{ scene: 'canteen', art: '🍛', sfx: 'NOM NOM!', caption: 'Rice, sambar, curd and a happy stomach.' }]; } },
    { label: `🗣️ Hang out (45 min)${friendsHere.length ? ' — friends are here!' : ''}`, act: () => {
      advance(45); gain({ social: 6 + friendsHere.length * 3, energy: -3 });
      friendsHere.forEach(n => S.fr[n.id] = (S.fr[n.id] || 0) + 0.5);
      const f = friendsHere[0];
      return [f ? { who: f.id, text: ['So who\'s crushing on who in our section? 👀', 'This chai hits different after a lab.', 'Bro, the Fest lineup this year is insane.'][S.day % 3] } : { narr: 'You chat with some classmates over chai.' }];
    } },
  ])]);
}

function libraryMenu() {
  const h = hour();
  if (h < 8 || h >= 22) return Comic.play([{ narr: 'The library is closed. (Open 8 AM – 10 PM)' }]);
  if (!invHas('id_card')) return Comic.play([{ who: 'librarian', text: S.flags.idcard ? 'No ID card, no entry. Did you leave it in your locker?' : `No ID card, no entry. Collect yours from the ${bName('admin')} first.` }]);
  const study = (hrs) => () => {
    const rate = 5 * (invHas('textbook') ? 1.25 : 1) * (S.energy < 25 ? 0.5 : 1);
    advance(hrs * 60); gain({ prep: rate * hrs, energy: -6 * hrs });
    return [skipPanel(`${hrs} hour${hrs > 1 ? 's' : ''} of focused study${S.energy < 25 ? '… you kept dozing off' : ''}.`)];
  };
  const priyaHere = npcs.find(n => n.id === 'priya' && n.visible && n.zone === 'libraryFront');
  const opts = [
    { label: '📚 Study 1 hour', act: study(1) },
    { label: '📚 Study 2 hours', act: study(2) },
  ];
  if (!ownsAnywhere('textbook')) opts.push({ label: '📘 Borrow a textbook', act: () => invAdd('textbook') ? [{ who: 'librarian', text: 'Return it in one piece. Studying with it is 25% more effective.' }] : [{ who: 'librarian', text: 'Your bag is full. Make some space first.' }] });
  if (priyaHere && S.fr.priya >= 2 && !S.talked['gs' + S.day]) opts.push({ label: '👩‍🎓 Group study with Priya (1h)', act: () => {
    S.talked['gs' + S.day] = true; advance(60); gain({ prep: 9, social: 5 }); S.fr.priya++;
    return [{ who: 'priya', text: 'Okay, I\'ll explain BCNF one more time and then you explain deadlocks to me. Deal?' }, skipPanel('An hour later — both of you understand way more.')];
  } });
  Comic.play([choice('librarian', `Shhh… Welcome to the ${bName('library')}.`, opts)]);
}

function adminMenu() {
  const h = hour();
  if (!S.flags.idcard) {
    return Comic.play([
      { scene: 'office', art: '🏛️', caption: `${bName('admin')} · Student Section` },
      { who: 'prof', text: `Ah, ${S.name}! I'm Prof. Lakshmi, HOD of CSE. Here is your student ID card.` },
      { who: 'prof', text: 'Keep it with you — the Library, Labs and Exam Hall won\'t let you in without it. And remember: attendance below 75% means detention.' },
    ], () => {
      if (invAdd('id_card')) { S.flags.idcard = true; toast('🪪 Received ID Card!', 'good'); }
      else Comic.play([{ who: 'prof', text: 'Your bag is full! Drop something (Q) and come back for your ID card.' }]);
    });
  }
  if (h < 8 || h >= 18) return Comic.play([{ narr: 'The Admin office is closed. (Open 8 AM – 6 PM)' }]);
  const opts = [
    { label: '📋 View report card', after: () => showReport(false) },
    { label: '💼 Part-time office help (2h, +₹120)', disabled: h >= 16 ? 'office closes soon' : null, act: () => { advance(120); gain({ money: 120, energy: -12 }); return [skipPanel('Two hours of filing and photocopying. +₹120')]; } },
  ];
  if (!ownsAnywhere('id_card')) opts.unshift({ label: '🪪 Duplicate ID card — ₹100', disabled: S.money < 100 ? 'not enough money' : null, act: () => { if (!invAdd('id_card')) return [{ narr: 'Your bag is full!' }]; gain({ money: -100 }); return [{ narr: 'Here you go. Try not to lose this one.' }]; } });
  Comic.play([choice('player', `${bName('admin')}. Files, forms and fans whirring overhead.`, opts)]);
}

function audiMenu() {
  const h = hour();
  const ev = EVENTS[S.day];
  if (ev && ev.type === 'fest' && !S.events[S.day] && h >= 18.5 && h < 21.5) return festFlow();
  if (h < 18 || h >= 21.5) return Comic.play([{ who: 'sana', text: 'Clubs meet from 6 to 9:30 PM. Come back in the evening!' }]);
  const opts = [
    { label: '💻 Coding Club project (2h)', disabled: invHas('laptop') ? null : 'needs Laptop', act: () => {
      advance(120); S.clubXP++; gain({ prep: S.flags.usbDone ? 7 : 5, social: 6, energy: -12 });
      return [{ scene: 'club', art: '💻', sfx: 'CLACK CLACK!', caption: `You push ${S.clubXP} commit${S.clubXP > 1 ? 's' : ''} to the club project.` },
        { who: 'sana', text: S.clubXP >= 3 ? 'Honestly? You\'re one of our best devs now.' : 'Nice work! The campus app is coming together.' }];
    } },
    { label: '🎵 Jam with the Music Club (1h)', act: () => {
      advance(60); S.music++; gain({ social: 8, energy: -6 });
      const out = [{ scene: 'stage', art: '🎸', sfx: 'STRUM!', caption: 'An hour of off-key singing and great vibes.' }];
      if (!ownsAnywhere('guitar')) {
        if (invAdd('guitar')) out.push({ who: 'sana', text: 'Take this club guitar! Practice — and play it at Fest Night.' });
        else out.push({ who: 'sana', text: 'I wanted to lend you a guitar, but your bag is full!' });
      }
      return out;
    } },
  ];
  Comic.play([choice('sana', 'Welcome to the club rooms! Coding Club on the left, Music Club on the right.', opts)]);
}

function currentSlot(place) {
  return todaySlots().find(s => s.place === place && !S.slots[s.key] && S.min >= s.hour * 60 - 20 && S.min <= s.hour * 60 + 30);
}

function classroomMenu(b) {
  const ev = EVENTS[S.day];
  if (ev && ev.type === 'exam' && ev.place === b.id && !S.events[S.day]) return examFlow(ev);
  const slot = currentSlot(b.id);
  if (slot) return lectureFlow(slot, b);
  const next = todaySlots().find(s => s.place === b.id && !S.slots[s.key] && S.min < s.hour * 60 - 20);
  if (b.id === 'labs') return Comic.play([{ narr: next ? `The labs open for ${next.subject} at ${fmtHour(next.hour)}. Bring a Lab Coat + ID card.` : 'The labs are locked. Lab sessions run 2–4 PM on weekdays.' }]);
  Comic.play([choice('player', `${b.name} — the classroom is empty right now.${next ? ` ${next.subject} starts here at ${fmtHour(next.hour)}.` : ''}`, [
    { label: '📖 Revise notes (1h, +3 prep)', disabled: invHas('notebook') ? null : 'needs Notebook', act: () => { advance(60); gain({ prep: 3, energy: -4 }); return [skipPanel('One quiet hour with your notes.')]; } },
  ])]);
}

function lectureFlow(slot, b) {
  if (slot.lab && (!invHas('lab_coat') || !invHas('id_card'))) {
    const miss = [!invHas('lab_coat') && 'Lab Coat', !invHas('id_card') && 'ID card'].filter(Boolean).join(' and ');
    return Comic.play([{ who: 'prof', text: `No ${miss}, no entry into the lab! You have until ${fmtTime(slot.hour * 60 + 30)} to fetch it.` }]);
  }
  const late = S.min > slot.hour * 60 + 10;
  const nb = invHas('notebook');
  const key = subjKey(slot.subject);
  S.slots[slot.key] = 'attended'; S.attended++; S.held++;
  const end = slot.hour * 60 + (slot.lab ? 115 : 55);
  advance(end - S.min);
  let pg = slot.lab ? 6 : nb ? 5 : 2;
  if (late) pg -= 1;
  gain({ prep: pg, energy: slot.lab ? -8 : -5 });
  const panels = [
    { scene: slot.lab ? 'lab' : 'class', art: slot.lab ? '🧪' : '👩‍🏫', sfx: late ? 'LATE!' : '', caption: `${slot.subject} · ${b.name} · ${fmtHour(slot.hour)}` },
    { who: 'prof', text: (late ? 'You\'re late. Sit down quietly. ' : '') + LECTURE_LINES[key] },
    nb || slot.lab ? { narr: `You take neat notes. Attendance: ${attPct()}%` } : { who: 'prof', text: 'No notebook?! You\'ll forget all of this by tomorrow.' },
  ];
  if (!slot.lab && QUIZ[key] && Math.random() < 0.45) {
    const [q, opts, ans] = QUIZ[key];
    panels.push({ who: 'prof', newPage: true, text: `Pop quiz! ${q}`, options: opts.map((o, i) => ({ label: o, act: () => {
      if (i === ans) { gain({ prep: 3, social: 2 }); return [{ who: 'prof', text: 'Correct! Good — someone was listening.' }]; }
      return [{ who: 'prof', text: `No — it's "${opts[ans]}". Revise this tonight.` }];
    } })) });
  }
  Comic.play(panels);
}

function examFlow(ev) {
  const start = ev.hour * 60;
  if (S.min < start - 30) return Comic.play([{ narr: `The exam hall opens at ${fmtTime(start - 30)}. ${ev.name} starts at ${fmtHour(ev.hour)}.` }]);
  if (!invHas('id_card') || !invHas('pen')) {
    const miss = [!invHas('id_card') && 'ID card', !invHas('pen') && 'pen'].filter(Boolean).join(' and ');
    return Comic.play([{ who: 'prof', text: `No ${miss}? You can't write the exam like this! Hurry — entry closes at ${fmtTime(start + 30)}.` }]);
  }
  const strategies = [
    { label: 'Start with what I know (safe)', mod: () => 0.2 },
    { label: 'Attack the hardest question first', mod: () => Math.random() * 1.4 - 0.6 },
    { label: 'Glance at the neighbour\'s paper 👀', mod: () => (Math.random() < 0.6 ? -1.5 : 0.3), cheat: true },
  ];
  Comic.play([
    { scene: 'exam', art: '📝', sfx: 'SCRIBBLE!', caption: `${ev.name} · Exam Hall, ${bName('blockA')}` },
    { who: 'prof', text: `Phones off. Bags at the front. You have ${ev.dur} hours. Begin!` },
    { who: 'player', text: 'Okay… deep breath. How do I tackle this paper?', options: strategies.map(st => ({ label: st.label, act: () => {
      const m = st.mod();
      let gp = 2.4 + S.prep * 0.06 + attPct() / 100 * 1.2 + (invHas('calculator') ? 0.3 : 0)
        + (S.energy > 40 ? 0.3 : S.energy < 20 ? -0.6 : 0) + (S.flags.luck ? 0.15 : 0) + m + (Math.random() * 0.6 - 0.3);
      gp = Math.round(clamp(gp, 0, 10) * 10) / 10;
      const grade = gp >= 9 ? 'O' : gp >= 8 ? 'A+' : gp >= 7 ? 'A' : gp >= 6 ? 'B+' : gp >= 5 ? 'B' : gp >= 4 ? 'C' : 'F';
      S.exams.push({ name: ev.name, gp, grade, final: !!ev.final });
      S.events[S.day] = 'done'; S.flags.luck = false;
      advance(start + ev.dur * 60 - S.min);
      gain({ energy: -15 });
      S.prep = Math.round(S.prep * 0.6);
      const out = [];
      if (st.cheat) out.push(m < 0 ? { who: 'prof', text: 'I SAW that. Marks deducted. Eyes on your own paper!' } : { narr: 'Nobody noticed… this time.' });
      out.push({ scene: 'result', art: grade, sfx: gp >= 8 ? 'BRILLIANT!' : gp >= 5 ? 'PHEW!' : 'OUCH!', caption: `${ev.name}: ${gp} grade points · CGPA ${cgpa()}`, newPage: !st.cheat });
      out.push({ who: 'prof', text: gp >= 8 ? 'Excellent paper. Keep this up!' : gp >= 6 ? 'Decent. There\'s room to improve.' : gp >= 4 ? 'You passed, barely. Attend classes and study!' : 'This is worrying. Meet me in my cabin.' });
      return out;
    }, after: ev.final ? () => ending() : null })) },
  ]);
}

// ── People ───────────────────────────────────────────────────
function talkTo(n) {
  n.freeze = 3;
  if (!n.named) {
    n.bubble = STUDENT_LINES[(Math.random() * STUDENT_LINES.length) | 0]; n.bubbleT = 3.5;
    if (!S.talked[n.id]) { S.talked[n.id] = true; gain({ social: 1 }); }
    return;
  }
  const first = !S.talked[n.id];
  S.talked[n.id] = true;
  const f = S.fr[n.id] || 0;
  const bump = () => { if (first) { S.fr[n.id] = f + 1; gain({ social: 4 }); } };
  switch (n.id) {
    case 'arjun': {
      bump();
      if ((S.day === 6 || S.day === 7) && S.flags.team) S.flags.arjunHype = true;
      const t = f === 0 ? 'Hey! New face in CSE? I\'m Arjun, cricket captain. We need players for Sunday\'s final — talk to Coach Mahesh at the ground!'
        : f === 1 ? 'Practice is 4 to 6 PM daily. Coach is strict but fair.'
        : S.flags.arjunHype ? 'Sunday we make history. I can feel it!'
        : ['If we win the final, biryani\'s on me!', `Your attendance is ${attPct()}%… keep it above 75, bro.`, 'Fest Night, mid-terms, the final… this semester is WILD.'][S.day % 3];
      return Comic.play([{ who: 'arjun', text: first ? t : 'Catch you later! 🏏' }]);
    }
    case 'priya': {
      bump();
      const panels = [{ who: 'priya', text: f === 0 ? 'Hi! I\'m Priya. Tip: Prof. Lakshmi\'s lectures are gold for exams — never skip them.'
        : f === 1 ? 'Want to group study sometime? Find me at the library in the evenings.' : first ? 'The library at night is so peaceful. Best place to revise.' : 'See you in class!' }];
      if (f >= 2 && !S.talked['notes' + S.day]) panels[0].options = [{ label: '📒 Borrow Priya\'s notes (+6 prep)', act: () => { S.talked['notes' + S.day] = true; gain({ prep: 6 }); return [{ who: 'priya', text: 'Color-coded and everything. Don\'t lose them!' }]; } }, { label: 'Maybe later' }];
      return Comic.play(panels);
    }
    case 'sana': {
      bump();
      if (invHas('usb') && !S.flags.usbDone) {
        return Comic.play([{ who: 'sana', text: 'Wait — is that… MY PEN DRIVE?! The whole club project is on it!', options: [{ label: '💾 Give it back', act: () => {
          invRemove('usb'); S.flags.usbDone = true; S.fr.sana += 2; gain({ social: 10, prep: 5 });
          return [{ who: 'sana', text: 'You\'re a lifesaver! Let me show you the backend we built — you\'ll learn a ton.' }];
        } }] }]);
      }
      if (f === 0) { S.flags.usbQuest = true; return Comic.play([{ who: 'sana', text: 'I\'m Sana, Coding Club lead. We build cool stuff 6–9 PM at the ' + bName('audi') + '. Bring a laptop!' }, { who: 'sana', text: 'Ugh, also… I lost my pen drive somewhere near the basketball court. If you find it, please bring it to me!' }]); }
      return Comic.play([{ who: 'sana', text: first ? (S.flags.usbDone ? 'Club tonight? We could really use your skills.' : 'Still no sign of my pen drive… it was near the basketball court, I think.') : 'Gotta run — code to review!' }]);
    }
    case 'ravi': {
      bump();
      const panels = [{ who: 'ravi', text: first ? ['Roomie! Did you eat? You look hungry.', 'The canteen samosas are elite today.', 'I\'m not skipping class, I\'m "managing my energy".'][S.day % 3] : 'Go, go, I\'m busy eating.' }];
      if (first && invAdd('snack')) panels.push({ narr: 'Ravi hands you a samosa. 🥟' });
      return Comic.play(panels);
    }
    case 'coach': return coachFlow();
    case 'prof': return Comic.play([{ who: 'prof', text: `Your attendance is ${attPct()}%. ${attPct() < 75 ? 'That is BELOW 75%. Detention is a real possibility!' : 'Good. Keep it that way.'}` }]);
    case 'librarian': return Comic.play([{ who: 'librarian', text: 'Shhh. The library is open from 8 AM to 10 PM. Bring your ID card.' }]);
    case 'anna': return Comic.play([{ who: 'anna', text: 'Chai, samosa, full meals — come inside, come inside!' }]);
    case 'guard': return Comic.play([{ who: 'guard', text: 'No bunking during college hours! The gate stays shut for hostellers.' }]);
  }
}

function coachFlow() {
  const h = hour();
  const ev = EVENTS[S.day];
  if (ev && ev.type === 'match' && !S.events[S.day] && S.min >= ev.hour * 60 - 30 && S.min <= ev.hour * 60 + 45) {
    if (!S.flags.team) return Comic.play([{ who: 'coach', text: 'Only registered players today. Grab a seat in the stands!', options: [{ label: '📣 Watch from the stands', act: () => {
      S.events[S.day] = 'watched'; advance(150); gain({ social: 6 });
      return [{ scene: 'stadium', art: '🏏', sfx: 'SIXER!', caption: 'You cheer yourself hoarse as Arjun\'s team battles it out.' }];
    } }] }]);
    if (!invHas('sports_kit')) return Comic.play([{ who: 'coach', text: `Where is your kit?! Go get it — we start at ${fmtHour(ev.hour)}!` }]);
    return matchFlow();
  }
  if (!S.flags.team) return Comic.play([{ who: 'coach', text: 'Want to join the college cricket team? Practice is 4–6 PM every day, and the final is on Sunday!', options: [
    { label: '🏏 Sign me up!', act: () => { S.flags.team = true; return [{ who: 'coach', text: 'Good! Bring your sports kit to practice. No kit, no play.' }]; } },
    { label: 'Not right now' },
  ] }]);
  if (h >= 16 && h < 18) return Comic.play([{ who: 'coach', text: 'Practice time! Ready to sweat?', options: [
    { label: '🏃 Practice (1h)', disabled: invHas('sports_kit') ? null : 'needs Sports Kit', act: () => {
      advance(60); S.practice++; gain({ fitness: 6, social: 2, energy: -12 });
      return [{ scene: 'stadium', art: '🏏', sfx: 'THWACK!', caption: `Nets session #${S.practice}. Your timing is improving.` }];
    } },
    { label: 'Maybe later' },
  ] }]);
  return Comic.play([{ who: 'coach', text: 'Practice is 4 to 6 PM. Don\'t be late — and don\'t forget your kit!' }]);
}

function matchFlow() {
  let mod = 0;
  const finish = (m2) => () => {
    mod += m2;
    const p = clamp(0.3 + S.fitness / 250 + S.practice * 0.05 + mod + (S.flags.arjunHype ? 0.05 : 0), 0.1, 0.9);
    const win = Math.random() < p;
    S.events[S.day] = win ? 'won' : 'lost';
    S.min = Math.max(S.min, 18.5 * 60); gain({ energy: -20, fitness: 5 });
    if (win) { S.flags.champion = true; gain({ social: 20 }); }
    else gain({ social: 8 });
    return win ? [
      { scene: 'stadium', art: '🏆', sfx: 'SIX! WE WIN!', caption: 'The ball sails over the boundary. MVSR are CHAMPIONS!', newPage: true },
      { who: 'arjun', text: 'YOU ABSOLUTE LEGEND!! Biryani on me tonight!' },
      { who: 'coach', text: 'Proud of you. That\'s what practice does.' },
    ] : [
      { scene: 'stadium', art: '💔', sfx: 'CAUGHT!', caption: 'Caught at the boundary. MVSR lose by 3 runs.', newPage: true },
      { who: 'arjun', text: 'Hey — we gave them a real fight. Next year is ours.' },
    ];
  };
  Comic.play([
    { scene: 'stadium', art: '🏏', sfx: 'HOWZAT!', caption: 'Inter-College Final · MVSR vs Rivals XI' },
    { who: 'arjun', text: 'Last over. 12 runs needed. You\'re on strike. LET\'S GO!' },
    { who: 'player', text: 'The bowler runs in…', options: [
      { label: 'Play it safe — push for a single', act: () => { mod += 0.03; return [{ narr: 'A quick single. Arjun is on strike… then gives the strike back. 7 needed off 2.' }, secondBall()]; } },
      { label: 'Go for a big hit!', act: () => { const ok = Math.random() < 0.5; mod += ok ? 0.12 : -0.08; return [{ narr: ok ? 'FOUR! The crowd erupts. 8 needed off 5.' : 'Swing and a miss! The keeper grins.' }, secondBall()]; } },
      { label: 'Watch the bowler\'s grip carefully', act: () => { mod += S.fitness > 40 ? 0.1 : 0.02; return [{ narr: 'You read the slower ball early and nudge it for two.' }, secondBall()]; } },
    ] },
  ]);
  function secondBall() {
    return { who: 'player', text: 'Last ball. Everything comes down to this…', options: [
      { label: 'Slog it over midwicket!', act: finish(Math.random() * 0.2 - 0.05) },
      { label: 'Lofted straight drive', act: finish(S.practice >= 2 ? 0.1 : 0) },
    ] };
  }
}

function festFlow() {
  const hasGuitar = invHas('guitar');
  const done = (perform) => () => {
    S.events[S.day] = perform ? 'performed' : 'watched';
    S.min = Math.max(S.min, 21.5 * 60);
    if (perform) { S.flags.star = true; gain({ social: 25, energy: -10 }); }
    else gain({ social: 10 });
    return perform ? [
      { scene: 'stage', art: '🎸', sfx: 'ENCORE!', caption: 'The whole auditorium sings along. Phones light up like stars.', newPage: true },
      { who: 'sana', text: 'You were AMAZING! The college page already posted your video!' },
    ] : [{ scene: 'stage', art: '🎆', sfx: 'WOOO!', caption: 'Dance crews, a band, and a DJ set. What a night!' }];
  };
  Comic.play([
    { scene: 'stage', art: '🎤', sfx: 'FEST NIGHT!', caption: 'The auditorium is packed. Lights. Music. Energy.' },
    { who: 'sana', text: hasGuitar ? 'You brought the guitar! There\'s an open slot on stage — want it?' : 'Grab a spot, the show\'s about to start!', options: [
      ...(hasGuitar ? [{ label: '🎸 Perform on stage!', act: done(true) }] : []),
      { label: '🎉 Enjoy the show', act: done(false) },
    ] },
  ]);
}

function useSpot(s) {
  if (s.id === 'notice') return openTimetable();
  if (s.id === 'court') return Comic.play([choice('player', 'The basketball court. A ball lies near the hoop.', [
    { label: '🏀 Shoot hoops (30 min)', act: () => { advance(30); gain({ fitness: 3, social: 1, energy: -6 }); return [{ scene: 'court', art: '🏀', sfx: 'SWISH!', caption: 'Nothing but net. Well, sometimes.' }]; } },
  ])]);
  if (s.id === 'fountain') {
    if (S.talked['coin' + S.day]) return Comic.play([{ narr: 'You already made a wish today.' }]);
    return Comic.play([choice('player', 'The quad fountain. Legend says a coin here brings exam luck…', [
      { label: '🪙 Toss ₹5', disabled: S.money < 5 ? 'no money' : null, act: () => { S.talked['coin' + S.day] = true; S.flags.luck = true; gain({ money: -5 }); return [{ scene: 'quad', art: '✨', sfx: 'PLINK!', caption: 'You feel slightly luckier for your next exam.' }]; } },
    ])]);
  }
}

// ── Day flow ─────────────────────────────────────────────────
// Nearest spot (x, y) where you can stand.
function nearestFree(x, y) {
  x = clamp(x, 45, WORLD_W - 45); y = clamp(y, 45, WORLD_H - 50);
  if (!blocked(x, y)) return { x, y };
  for (let r = 10; r <= 600; r += 10) for (let a = 0; a < 16; a++) {
    const px = x + Math.cos(a / 16 * Math.PI * 2) * r, py = y + Math.sin(a / 16 * Math.PI * 2) * r;
    if (px > 40 && py > 40 && px < WORLD_W - 40 && py < WORLD_H - 45 && !blocked(px, py)) return { x: px, y: py };
  }
  return { x, y };
}
// New game: stand just inside the main gate, facing into the campus.
function placeAtGate() {
  const inward = { N: [0, 1, 'down'], S: [0, -1, 'up'], E: [-1, 0, 'left'], W: [1, 0, 'right'] }[GATE_INFO.side];
  const p = nearestFree(GATE_EXIT.x + inward[0] * 70, GATE_EXIT.y + inward[1] * 70);
  S.x = p.x; S.y = p.y; player.dir = inward[2];
}
function placeAtHostel() {
  const d = doorOf('hostel2'); S.x = d.x + d.ox * 10; S.y = d.y + d.oy * 10;
  player.dir = { N: 'up', E: 'right', S: 'down', W: 'left' }[d.side];
}

function sleep(crash) {
  const bedtime = S.min;
  S.min = Math.max(S.min, 24 * 60 + 1);
  processSchedule();
  if (S.day >= LAST_DAY) return ending();
  S.day++;
  S.min = (crash ? 8 : 7) * 60;
  S.energy = clamp(S.energy + (crash ? 40 : bedtime < 23 * 60 ? 80 : 65), 0, 100);
  S.prep = Math.max(0, S.prep - 1);
  S.talked = {};
  placeAtHostel();
  for (const n of npcs) { n.zone = undefined; n.visible = false; n.inside = null; n.enter = null; n.enterCD = 0; }
  buildTraffic();   // tomorrow's buses, cars and bikes
  save();
  const panels = crash ? [{ scene: 'night', art: '😵', sfx: 'THUD!', caption: 'You collapsed from exhaustion. Ravi dragged you back to the hostel.' }] : [{ scene: 'night', art: '🌙', sfx: 'ZZZ…', caption: 'Lights out. Tomorrow is another day.' }];
  Comic.play(panels.concat(morningStory(S.day).map((p, i) => i === 0 ? { ...p, newPage: true } : p)));
}

function faint() {
  const panels = [{ scene: 'night', art: '😵‍💫', sfx: 'WOBBLE…', caption: 'Zero energy. You fainted. Friends carried you to the hostel. 3 hours later…' }];
  placeAtHostel();
  advance(180);
  S.energy = 35;
  Comic.play(panels);
}

function processSchedule() {
  for (const s of todaySlots()) {
    if (!S.slots[s.key] && S.min > s.hour * 60 + 30) {
      S.slots[s.key] = 'missed'; S.held++;
      toast(`❌ Missed ${s.subject} — attendance ${attPct()}%`, 'bad');
    }
    if (!S.slots[s.key] && !S.reminded[s.key] && S.min >= s.hour * 60 - 15 && S.min < s.hour * 60) {
      S.reminded[s.key] = true;
      toast(`⏰ ${s.subject} starts at ${fmtHour(s.hour)} in ${bName(s.place)}`);
    }
  }
  const ev = EVENTS[S.day];
  if (ev && !S.events[S.day]) {
    const limit = ev.type === 'fest' ? 21.5 * 60 : ev.hour * 60 + 45;
    if (S.min > limit) {
      S.events[S.day] = 'missed';
      if (ev.type === 'exam') { S.exams.push({ name: ev.name, gp: 0, grade: 'AB', final: !!ev.final }); toast(`❌ You missed ${ev.name}! Marked absent.`, 'bad'); }
      else toast(`You missed ${ev.name}.`, 'bad');
      if (ev.final) setTimeout(ending, 500);
    } else if (!S.reminded['ev' + S.day] && S.min >= ev.hour * 60 - 45) {
      S.reminded['ev' + S.day] = true;
      toast(`📣 ${ev.name} at ${fmtHour(ev.hour)} — ${bName(ev.place)}`);
    }
  }
}

function getObjective() {
  const imminent = todaySlots().some(s => !S.slots[s.key] && S.min >= s.hour * 60 - 20 && S.min <= s.hour * 60 + 30);
  if (!S.flags.idcard && !imminent) return { text: `Collect your ID card from the ${bName('admin')}`, tgt: doorOf('admin') };
  const ev = EVENTS[S.day];
  if (ev && !S.events[S.day]) {
    const need = { exam: 'bring ID Card + Pen', match: S.flags.team ? 'bring Sports Kit, talk to Coach' : 'talk to Coach', fest: invHas('guitar') ? 'bring the Guitar!' : 'enjoy the show' }[ev.type];
    return { text: `${ev.name} · ${fmtHour(ev.hour)} · ${bName(ev.place)} (${need})`, tgt: ev.type === 'match' ? { x: AREAS.ground.x + AREAS.ground.w / 2, y: AREAS.ground.y + AREAS.ground.h / 2 } : doorOf(ev.place) };
  }
  for (const s of todaySlots()) if (!S.slots[s.key] && S.min <= s.hour * 60 + 30) return { text: `Next: ${s.subject} · ${bName(s.place)} · ${fmtHour(s.hour)}${s.lab ? ' (Lab Coat + ID)' : ''}`, tgt: doorOf(s.place) };
  if (S.min >= 21 * 60) return { text: 'It\'s late — head back to ' + bName('hostel2') + ' and sleep', tgt: doorOf('hostel2') };
  if (S.min >= 18 * 60) return { text: `Evening: clubs at the ${bName('audi')}, study at the ${bName('library')}, or hang out at the ${bName('canteen')}`, tgt: null };
  if (S.min >= 16 * 60) return { text: 'Sports hour: cricket practice with Coach at the Ground (4–6 PM)', tgt: { x: AREAS.ground.x + AREAS.ground.w / 2, y: AREAS.ground.y + AREAS.ground.h / 2 } };
  return { text: 'Free time — study, eat, make friends, or explore campus', tgt: null };
}

// ── Ending ───────────────────────────────────────────────────
let ended = false;
function ending() {
  if (ended) return;
  ended = true;
  const g = cgpa() ?? 0, att = attPct();
  const verdict = att < 75 ? `Your attendance is ${att}%. I'm sorry… you are detained this semester.`
    : g >= 8.5 ? `Outstanding! CGPA ${g}. You've made the Dean's List!`
    : g >= 7 ? `A solid semester. CGPA ${g}. Keep it up!`
    : g >= 5 ? `You passed. CGPA ${g}. Next semester, more focus please.`
    : `CGPA ${g}. Supplementary exams await you…`;
  const panels = [
    { scene: 'stage', art: '🎓', sfx: 'THE END?', caption: `End of Semester · Day ${S.day}`, newPage: true },
    { who: 'prof', text: verdict },
  ];
  if (S.flags.champion) panels.push({ who: 'arjun', text: 'And never forget — we\'re CHAMPIONS! 🏆' });
  if (S.flags.star) panels.push({ who: 'sana', text: 'Your Fest performance is still trending on the college page!' });
  panels.push({ who: 'ravi', text: S.social >= 70 ? 'Bro, the whole campus knows your name now.' : 'Next semester we hang out more, okay roomie?' });
  Comic.play(panels, () => showReport(true));
}

function semesterTitle() {
  const g = cgpa() ?? 0;
  if (attPct() < 75) return 'Detained 😬';
  if (g >= 8 && S.social >= 70 && (S.flags.champion || S.flags.star)) return 'Campus Legend 🌟';
  if (g >= 8.5) return 'Class Topper 📚';
  if (S.flags.champion) return 'Sports Star 🏏';
  if (S.flags.star) return 'Rockstar 🎸';
  if (S.social >= 75) return 'Social Butterfly 🦋';
  return 'Survivor 💪';
}

// ── Overlays: locker, timetable, report, help ────────────────
function openLocker() { overlay = 'locker'; $('#locker').classList.remove('hidden'); renderLocker(); }
function renderLocker() {
  const fill = (el, arr, other) => {
    el.innerHTML = '';
    arr.forEach((s, i) => {
      const d = document.createElement('div');
      d.className = 'slot' + (s ? '' : ' empty');
      if (s) {
        d.innerHTML = `<span class="ic" data-cat="${itemCat(s.id)}">${Icons.item(s.id)}</span>${s.qty > 1 ? `<span class="qty">${s.qty}</span>` : ''}`;
        d.title = `${ITEMS[s.id].name} — ${ITEMS[s.id].desc}`;
        d.onclick = () => {
          if (!addTo(other, s.id, 1)) { toast('No space there!', 'bad'); return; }
          if (--s.qty <= 0) arr[i] = null;
          renderLocker(); renderHotbar();
        };
      }
      el.appendChild(d);
    });
  };
  fill($('#locker-bag'), S.inv, S.locker);
  fill($('#locker-store'), S.locker, S.inv);
}

function openTimetable() {
  overlay = 'timetable';
  const rows = DAY_NAMES.slice(0, 6).map((d, wd) => `<tr class="${weekday() === wd ? 'today' : ''}"><th>${d}</th>${TIMETABLE[wd].map((s, i) => `<td>${s ? `<b>${s[0]}</b><small>${bName(s[1])} · ${fmtHour(SLOT_HOURS[i])}</small>` : '—'}</td>`).join('')}</tr>`).join('');
  const evs = Object.entries(EVENTS).map(([d, e]) => `<li class="${+d === S.day ? 'today' : ''} ${S.events[d] ? 'done' : ''}">Day ${d} (${DAY_NAMES[weekday(+d)]}) — <b>${e.name}</b> · ${fmtHour(e.hour)} · ${bName(e.place)}${S.events[d] ? ` · <i>${S.events[d]}</i>` : ''}</li>`).join('');
  $('#tt-body').innerHTML = `<table><thead><tr><th></th>${SLOT_HOURS.map(h => `<th>${fmtHour(h)}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table>
    <h3>${Icons.svg('megaphone')}Notice Board — Milestones</h3><ul class="events">${evs}</ul>
    <p class="muted">Lunch 12–1 · Lab 2–4 PM · Sports 4–6 PM · Clubs 6–9:30 PM · Library 8 AM–10 PM · No classes on exam days or Sunday.</p>`;
  $('#timetable').classList.remove('hidden');
}

function showReport(final) {
  overlay = 'report';
  const g = cgpa();
  const ex = S.exams.map(e => `<tr><td>${e.name}</td><td>${e.grade}</td><td>${e.gp}</td></tr>`).join('') || '<tr><td colspan="3" class="muted">No exams written yet</td></tr>';
  const bar = (k) => `<div class="rbar"><span>${k[0].toUpperCase() + k.slice(1)}</span><div><i style="width:${S[k]}%"></i></div><b>${Math.round(S[k])}</b></div>`;
  $('#report-body').innerHTML = `
    ${final ? `<div class="title-badge">${Icons.iconize(semesterTitle())}</div>` : ''}
    <div class="rgrid">
      <div class="big"><small>CGPA</small><b>${g ?? '—'}</b></div>
      <div class="big ${attPct() < 75 ? 'bad' : ''}"><small>Attendance</small><b>${attPct()}%</b><small>${S.attended}/${S.held} classes</small></div>
      <div class="big"><small>Wallet</small><b>₹${S.money}</b></div>
    </div>
    <table class="exams"><thead><tr><th>Exam</th><th>Grade</th><th>GP</th></tr></thead><tbody>${ex}</tbody></table>
    ${['prep', 'social', 'fitness', 'energy'].map(bar).join('')}
    <h3>${Icons.svg('friends')}Friends</h3>
    <div class="friends-row">${Object.entries(S.fr).map(([k, v]) => { const n = Math.max(0, Math.min(5, Math.ceil(v))); return `<span>${CHARS[k].name} <span class="hearts">${Icons.svg('heart').repeat(n)}<span class="off">${Icons.svg('heart').repeat(5 - n)}</span></span></span>`; }).join('')}</div>
    ${final ? `<button class="btn" id="btn-again">${Icons.svg('campex')}Start a new semester</button>` : ''}`;
  $('#report').classList.remove('hidden');
  if (final) $('#btn-again').onclick = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } returnToTitle(false); };
}

function hideAllOverlays() {
  ['#locker', '#timetable', '#report', '#help', '#settings', '#credits', '#pause', '#pause-confirm', '#fs-tip', '#phone-overlay']
    .forEach(s => { const el = $(s); if (el) el.classList.add('hidden'); });
  document.querySelectorAll('#phone .phone-view').forEach(v => v.classList.toggle('hidden', v.dataset.view !== 'home'));
}
function openHelp(from = 'game') {
  hideAllOverlays();
  overlayReturn = from;
  overlay = 'help';
  $('#help').classList.remove('hidden');
}
function openSettings(from = 'title') {
  hideAllOverlays();
  overlayReturn = from;
  overlay = 'settings';
  $('#settings').classList.remove('hidden');
  updateFullscreenButtons();
}
function openCredits() {
  hideAllOverlays();
  overlayReturn = 'title';
  overlay = 'credits';
  $('#credits').classList.remove('hidden');
}
function openPause() {
  if (!S || ended) return;
  hideAllOverlays();
  overlayReturn = null;
  overlay = 'pause';
  $('#pause').classList.remove('hidden');
  renderPause();
}
function renderPause() {
  if (!S) return;
  $('#pause-face').src = Portraits.get('player', S.look);
  $('#pause-name').textContent = S.name;
  $('#pause-meta').textContent = `Day ${S.day} - ${fmtTime(S.min)}`;
  const rows = [['energy', 'Energy'], ['hunger', 'Hunger'], ['water', 'Water'], ['fitness', 'Fitness']];
  $('#pause-vitals').innerHTML = rows.map(([k, label]) => `<div class="pause-vital"><span>${label}</span><div><i style="width:${Math.round(S[k])}%"></i></div><b>${Math.round(S[k])}</b></div>`).join('');
  $('#pause-save').textContent = 'Progress auto-saves every few seconds and when you sleep.';
}
function openPauseConfirm() {
  hideAllOverlays();
  overlay = 'pause-confirm';
  $('#pause-confirm').classList.remove('hidden');
}
function closeOverlay() {
  if (overlay === 'report' && ended) return;
  const was = overlay;
  hideAllOverlays();
  overlay = null;
  if (was === 'pause-confirm') { openPause(); return; }
  if ((was === 'help' || was === 'settings') && overlayReturn === 'pause') { overlayReturn = null; openPause(); return; }
  overlayReturn = null;
}

// ── Phone ────────────────────────────────────────────────────
function openPhone(view = 'home') {
  if (!S || Comic.isOpen()) return;
  overlay = 'phone';
  $('#phone-overlay').classList.remove('hidden');
  showPhoneView(view);
}
function closePhone() { if (overlay === 'phone') closeOverlay(); }
function showPhoneView(view) {
  document.querySelectorAll('#phone .phone-view').forEach(v => v.classList.toggle('hidden', v.dataset.view !== view));
  const body = $('#phone .phone-view:not(.hidden) .phone-app-body');
  if (body) body.scrollTop = 0;
  if (view === 'campex') renderCampex();
  if (view === 'stats') renderStats();
}
function renderCampex() {
  const body = $('#campex-body');
  if (!body || !S) return;
  const att = attPct(), g = cgpa();
  const slots = todaySlots();
  const classRows = slots.length
    ? `<ul class="cx-list">${slots.map(s => {
      const st = S.slots[s.key];
      return `<li class="${st === 'attended' ? 'done' : st === 'missed' ? 'missed' : ''}"><b>${s.subject}</b><small>${bName(s.place)} · ${fmtHour(s.hour)}</small></li>`;
    }).join('')}</ul>`
    : '<div class="cx-empty">No classes today.</div>';
  const examRows = S.exams.length
    ? S.exams.map(e => `<div class="cx-exam"><b>${e.name}</b><span>${e.grade}</span><span>${e.gp} GP</span></div>`).join('')
    : '<div class="cx-empty">No exams written yet.</div>';
  const nextEv = Object.keys(EVENTS).map(Number).filter(d => d >= S.day && !S.events[d]).sort((a, b) => a - b)[0];
  const evRow = nextEv
    ? `<div class="cx-card"><small>Day ${nextEv} · ${DAY_NAMES[weekday(nextEv)]}</small><b style="font-size:16px;line-height:1.15">${EVENTS[nextEv].name}</b><div class="cx-sub">${fmtHour(EVENTS[nextEv].hour)} · ${bName(EVENTS[nextEv].place)}</div></div>`
    : '<div class="cx-empty">No milestones left. Finish strong!</div>';
  body.innerHTML = `
    <div class="cx-hero">
      <div class="cx-card ${att < 75 ? 'bad' : ''}"><small>Attendance</small><b>${att}%</b><div class="cx-sub">${S.attended}/${S.held} classes</div></div>
      <div class="cx-card"><small>CGPA</small><b>${g ?? '—'}</b><div class="cx-sub">${S.exams.length} exam${S.exams.length === 1 ? '' : 's'} written</div></div>
      <div class="cx-card cx-wide"><small>Prep</small><b>${Math.round(S.prep)}</b><div class="cx-sub">Studying, library sessions and assignments</div></div>
    </div>
    <div class="cx-title">Today · ${DAY_NAMES[weekday()]}</div>${classRows}
    <div class="cx-title">Exam results</div>${examRows}
    <div class="cx-title">Next milestone</div>${evRow}`;
}
function renderStats() {
  const note = $('#stats-note');
  if (!note || !S) return;
  const bad = [];
  if (S.hunger < 25) bad.push('hungry');
  if (S.water < 25) bad.push('thirsty');
  if (S.energy < 20) bad.push('exhausted');
  if (S.social < 20) bad.push('lonely');
  note.innerHTML = bad.length
    ? `You feel <b>${bad.join(' · ')}</b>. Eat, drink or rest soon.`
    : 'Hunger and water drain as the day passes. Eat, drink and rest to keep them up.';
}

// ── HUD ──────────────────────────────────────────────────────
// Item colour family for the hotbar icons.
const ITEM_CAT = { snack: 'food', tea: 'food', fruit: 'food', laptop: 'tech', usb: 'tech', calculator: 'tech', notebook: 'study', textbook: 'study', pen: 'study', id_card: 'study', lab_coat: 'gear', sports_kit: 'gear', guitar: 'gear', money: 'cash' };
const itemCat = (id) => ITEM_CAT[id] || '';

function renderHotbar() {
  const hb = $('#hotbar');
  if (!hb.children.length) for (let i = 0; i < 9; i++) {
    const d = document.createElement('div'); d.className = 'slot';
    d.onclick = () => { S.sel = i; renderHotbar(); };
    hb.appendChild(d);
  }
  S.inv.forEach((s, i) => {
    const d = hb.children[i];
    d.className = 'slot' + (i === S.sel ? ' sel' : '') + (s ? '' : ' empty');
    d.title = s ? ITEMS[s.id].name : '';
    d.innerHTML = `<span class="key">${i + 1}</span>${s ? `<span class="ic" data-cat="${itemCat(s.id)}">${Icons.item(s.id)}</span>${s.qty > 1 ? `<span class="qty">${s.qty}</span>` : ''}` : ''}`;
  });
  const s = S.inv[S.sel];
  $('#item-tip').innerHTML = s
    ? `${Icons.item(s.id)}<span><b>${ITEMS[s.id].name}</b> — ${ITEMS[s.id].desc}</span>`
    : `${Icons.svg('backpack')}<span class="muted">Empty slot · ${S.inv.filter(Boolean).length}/9 carried</span>`;
}

let hudT = 0, lastObjective = '', lastTgt = null;
function updateHUD(dt) {
  hudT -= dt;
  if (hudT > 0) { drawMinimap(lastTgt); return; }   // radar animates every frame; text updates on a tick
  hudT = 0.15;
  const h = hour(), day = h >= 6 && h < 18.5;
  const dayTxt = `Day ${S.day}/${LAST_DAY} · ${DAY_NAMES[weekday()]}`;
  // phone lock screen
  $('#hud-day').textContent = dayTxt;
  $('#hud-time').textContent = fmtTime(S.min);
  $('#hud-phone-time').textContent = fmtTime(S.min);
  $('#hud-period').innerHTML = Icons.svg(day ? 'sun' : 'moon') + PERIOD_LABEL[periodKey(h)];
  // HUD phone peek (half the phone rising from the bottom edge)
  $('#pp-day').textContent = dayTxt;
  $('#pp-time').textContent = fmtTime(S.min);
  $('#pp-stime').textContent = fmtTime(S.min);
  $('#pp-period').innerHTML = Icons.svg(day ? 'sun' : 'moon') + PERIOD_LABEL[periodKey(h)];
  // mobile clock plate (the old top-centre clock, replaces the phone half on touch screens)
  $('#pc-day').textContent = dayTxt;
  $('#pc-time').textContent = fmtTime(S.min);
  $('#pc-period').textContent = PERIOD_LABEL[periodKey(h)];
  $('#pc-ic use').setAttribute('href', day ? '#i-sun' : '#i-moon');
  $('#pc-progress').style.width = clamp((S.min - 6 * 60) / (18 * 60) * 100, 0, 100) + '%';   // 6 AM → midnight
  $('#phone-peek').classList.toggle('night', !day);
  // player frame
  $('#hp-name').textContent = S.name;
  $('#hp-day').textContent = 'D' + S.day;
  for (const k of ['energy', 'hunger', 'water']) {
    const v = $('#hv-' + k);
    v.querySelector('i').style.width = S[k] + '%';
    v.querySelector('b').textContent = Math.round(S[k]);
    v.classList.toggle('low', S[k] < 20);
  }
  $('#hp-money').textContent = '₹' + S.money;
  const att = attPct(), ac = $('#hp-att');
  ac.querySelector('b').textContent = att + '%';
  ac.classList.toggle('bad', att < 75);
  ac.querySelector('use').setAttribute('href', att < 75 ? '#i-warning' : '#i-check');
  ac.title = `Attendance ${S.attended}/${S.held}`;
  // phone stats app
  for (const k of ['energy', 'hunger', 'water', 'prep', 'social', 'fitness']) {
    $(`#bar-${k} i`).style.width = S[k] + '%';
    $(`#bar-${k} b`).textContent = Math.round(S[k]);
  }
  $('#bar-energy').classList.toggle('low', S.energy < 20);
  $('#bar-hunger').classList.toggle('low', S.hunger < 20);
  $('#bar-water').classList.toggle('low', S.water < 20);
  const pbatt = $('#phone .phone-batt');
  if (pbatt) { $('#phone-batt-level').style.width = Math.max(6, S.energy) + '%'; pbatt.classList.toggle('low', S.energy < 20); }
  const kbatt = $('#phone-peek .phone-batt');
  if (kbatt) { $('#pp-batt').style.width = Math.max(6, S.energy) + '%'; kbatt.classList.toggle('low', S.energy < 20); }
  $('#hud-money').textContent = '₹' + S.money;
  if (overlay === 'phone') renderStats();
  // quest tracker (flashes when the objective changes)
  const o = getObjective();
  if (o.text !== lastObjective) {
    const ob = $('#objective');
    ob.innerHTML = `<span class="ob-ic">${Icons.svg(o.tgt ? 'objective' : 'quest')}</span><small>${o.tgt ? 'Current objective' : 'Free roam'}</small><span class="ob-text"></span>`;
    ob.querySelector('.ob-text').textContent = Icons.strip(o.text);
    if (lastObjective) { ob.classList.remove('flash'); void ob.offsetWidth; ob.classList.add('flash'); }
    lastObjective = o.text;
  }
  const pr = $('#prompt');
  if (target) {
    const html = `<kbd>E</kbd>${Icons.svg('interact')}<span>${Icons.strip(target.label)}</span>`;
    if (pr.dataset.l !== target.label) { pr.innerHTML = html; pr.dataset.l = target.label; }
    if (isTouch()) pr.querySelector('kbd').style.display = 'none';
    pr.classList.remove('hidden');
  } else { pr.classList.add('hidden'); pr.dataset.l = ''; }
  lastTgt = o.tgt;
  drawMinimap(o.tgt);
}

// Camera: centred on (x, y).
function placeCam(x, y) {
  // The player always stays in the centre of the screen, even near the campus walls.
  cam.x = x - VW / 2;
  cam.y = y - VH / 2;
}
// Corner radar: a round, player-centred map. Big map (M): the whole campus, fitted to the screen.
const RADAR_SPAN = 1000;   // world units across the radar
function sizeMinimap() {
  const m = $('#minimap'); if (!m) return;
  document.body.classList.toggle('bigmap', bigMap);
  if (bigMap) {
    const bw = Math.min(900, innerWidth * 0.92), bh = innerHeight * 0.78;
    const k = Math.min(bw / WORLD_W, bh / WORLD_H), w = Math.round(WORLD_W * k), h = Math.round(WORLD_H * k);
    m.style.width = w + 'px'; m.style.height = h + 'px';
    const pxW = Math.round(w * 2);
    if (m.width !== pxW) { m.width = pxW; m.height = Math.round(pxW * WORLD_H / WORLD_W); }
  } else {
    m.style.width = ''; m.style.height = '';
    const px = Math.round(Math.max(m.clientWidth, 96) * Math.min(2, devicePixelRatio || 1));
    if (m.width !== px || m.height !== px) { m.width = px; m.height = px; }
  }
}
function makeMiniBase() {
  const W = 720, c = document.createElement('canvas'); c.width = W; c.height = Math.round(W * WORLD_H / WORLD_W);
  const g = c.getContext('2d');
  g.drawImage(ground, 0, 0, c.width, c.height);
  g.fillStyle = 'rgba(6, 12, 32, 0.28)'; g.fillRect(0, 0, c.width, c.height);   // cool tactical tint
  const k = W / WORLD_W;
  for (const b of BUILDINGS) {
    g.fillStyle = b.roofC; g.fillRect(b.x * k, b.y * k, b.w * k, b.h * k);
    g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = 2; g.strokeRect(b.x * k, b.y * k, b.w * k, b.h * k);
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1; g.strokeRect(b.x * k + 1.5, b.y * k + 1.5, b.w * k - 3, b.h * k - 3);
  }
  g.fillStyle = '#1f5a40'; for (const t of TREES) { g.beginPath(); g.arc(t.x * k, (t.y - 60) * k, 5, 0, 7); g.fill(); }
  return c;
}
function drawMinimap(tgt) {
  const m = $('#minimap');
  if (!bigMap && m.clientWidth && Math.abs(m.width - Math.round(m.clientWidth * Math.min(2, devicePixelRatio || 1))) > 2) sizeMinimap();
  const g = m.getContext('2d'), W = m.width, H = m.height;
  const now = performance.now();
  g.save();
  g.fillStyle = '#081024'; g.fillRect(0, 0, W, H);
  let k, ox, oy;
  if (bigMap) { k = W / WORLD_W; ox = 0; oy = 0; }
  else { k = W / RADAR_SPAN; ox = W / 2 - S.x * k; oy = H / 2 - S.y * k; }
  if (!bigMap) {   // tactical grid beyond the campus walls, locked to world space
    const step = 100 * k, gx = ((ox % step) + step) % step, gy = ((oy % step) + step) % step;
    g.strokeStyle = 'rgba(95,216,255,0.12)'; g.lineWidth = 1; g.beginPath();
    for (let x = gx; x < W; x += step) { g.moveTo(x, 0); g.lineTo(x, H); }
    for (let y = gy; y < H; y += step) { g.moveTo(0, y); g.lineTo(W, y); }
    g.stroke();
  }
  g.translate(ox, oy);
  g.imageSmoothingEnabled = true;
  g.drawImage(miniBase, 0, 0, WORLD_W * k, WORLD_H * k);
  const fs = bigMap ? Math.max(16, Math.round(W / 24)) : Math.max(10, Math.round(W / 22));
  g.font = `700 ${fs}px Rajdhani, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
  const label = (txt, x, y) => { g.strokeStyle = 'rgba(0,0,0,0.85)'; g.lineWidth = fs / 3; g.strokeText(txt, x, y); g.fillStyle = '#eaf4ff'; g.fillText(txt, x, y); };
  if (bigMap) {
    for (const b of BUILDINGS) label(b.name, (b.x + b.w / 2) * k, (b.y + b.h / 2) * k);
    for (const [n, a] of [['Cricket Ground', AREAS.ground], ['Court', AREAS.court], ...parkingAreas().map((a, i) => [i ? 'Parking behind library' : 'Parking', a]), ['Garden', AREAS.garden]]) label(n, (a.x + a.w / 2) * k, (a.y + a.h / 2) * k);
  }
  const dot = Math.max(4, W / (bigMap ? 110 : 60));
  for (const n of npcs) if (n.visible && n.named) {
    g.fillStyle = n.look.shirt; g.strokeStyle = '#fff'; g.lineWidth = dot / 2.5;
    g.beginPath(); g.arc(n.x * k, n.y * k, dot, 0, 7); g.fill(); g.stroke();
  }
  g.restore();

  // objective marker: diamond on the map, or an edge arrow when it's off the radar
  if (tgt) {
    let tx = tgt.x * k + ox, ty = tgt.y * k + oy;
    const R = W / 2 - dot * 3, cx = W / 2, cy = H / 2, dx = tx - cx, dy = ty - cy, d = Math.hypot(dx, dy);
    const off = !bigMap && d > R;
    if (off) { tx = cx + dx / d * R; ty = cy + dy / d * R; }
    const p = dot * 2.4 + Math.sin(now / 180) * dot * 0.5;
    g.save(); g.translate(tx, ty);
    g.shadowColor = '#ffcf4d'; g.shadowBlur = dot * 3;
    if (off) {
      g.rotate(Math.atan2(dy, dx));
      g.fillStyle = '#ffcf4d'; g.strokeStyle = '#000'; g.lineWidth = dot / 2;
      g.beginPath(); g.moveTo(p * 1.1, 0); g.lineTo(-p * 0.7, -p * 0.8); g.lineTo(-p * 0.3, 0); g.lineTo(-p * 0.7, p * 0.8); g.closePath(); g.fill(); g.stroke();
    } else {
      g.strokeStyle = 'rgba(255,207,77,0.6)'; g.lineWidth = dot / 2;
      g.beginPath(); g.arc(0, 0, p * 1.4 + ((now / 25) % (p * 1.4)), 0, 7); g.stroke();
      g.rotate(Math.PI / 4); g.fillStyle = '#ffcf4d'; g.strokeStyle = '#000'; g.lineWidth = dot / 2;
      g.fillRect(-p / 2, -p / 2, p, p); g.strokeRect(-p / 2, -p / 2, p, p);
    }
    g.restore();
  }

  // player: cyan arrow pointing the way they face
  const px = S.x * k + ox, py = S.y * k + oy, r = dot * (bigMap ? 2.4 : 2.2);
  const ang = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[player.dir] ?? -Math.PI / 2;
  g.save(); g.translate(px, py);
  const cone = g.createRadialGradient(0, 0, 0, 0, 0, r * 5);
  cone.addColorStop(0, 'rgba(95,216,255,0.45)'); cone.addColorStop(1, 'rgba(95,216,255,0)');
  g.fillStyle = cone; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r * 5, ang - 0.6, ang + 0.6); g.closePath(); g.fill();
  g.rotate(ang);
  g.shadowColor = '#5fd8ff'; g.shadowBlur = r * 2;
  g.fillStyle = '#ffffff'; g.strokeStyle = '#0a2a4a'; g.lineWidth = r / 3;
  g.beginPath(); g.moveTo(r * 1.3, 0); g.lineTo(-r, -r); g.lineTo(-r * 0.45, 0); g.lineTo(-r, r); g.closePath(); g.fill(); g.stroke();
  g.restore();

  // radar sweep
  if (!bigMap) {
    const a = (now / 1400) % (Math.PI * 2);
    const sw = g.createConicGradient ? g.createConicGradient(a, W / 2, H / 2) : null;
    if (sw) { sw.addColorStop(0, 'rgba(95,216,255,0.18)'); sw.addColorStop(0.12, 'rgba(95,216,255,0)'); sw.addColorStop(1, 'rgba(95,216,255,0)'); g.fillStyle = sw; g.fillRect(0, 0, W, H); }
  }
}

// ── Lighting ─────────────────────────────────────────────────
function darkness() {
  const h = hour() % 24;
  if (h < 6) return 0.72;
  if (h < 8) return 0.72 * (1 - (h - 6) / 2) * 0.6;
  if (h < 17) return 0;
  if (h < 19.5) return 0.68 * (h - 17) / 2.5;
  return 0.68;
}
function warmth() {
  const h = hour() % 24;
  if (h >= 6 && h < 8.5) return 0.16 * (1 - Math.abs(h - 7) / 1.5);
  if (h >= 16.5 && h < 19.5) return 0.2 * (1 - Math.abs(h - 18) / 1.5);
  return 0;
}

// ── Update ───────────────────────────────────────────────────
const keys = {};
const paused = () => !S || overlay || Comic.isOpen() || (isTouch() && portraitQ.matches);

function update(dt) {
  S.min += dt * TIME_SCALE;
  S.energy = clamp(S.energy - 2.5 / 60 * dt * TIME_SCALE, 0, 100);
  drainNeeds(dt * TIME_SCALE);
  if (S.hunger < 10 || S.water < 10) S.energy = clamp(S.energy - 1.2 / 60 * dt * TIME_SCALE, 0, 100);
  processSchedule();
  if (paused()) return;
  if (S.min >= 24 * 60) { Comic.play([{ scene: 'night', art: '🥱', caption: 'Midnight… your eyes close on their own.' }], () => sleep(true)); return; }
  if (S.energy <= 0) return faint();

  let vx = 0, vy = 0;
  if (keys.KeyA || keys.ArrowLeft) vx--;
  if (keys.KeyD || keys.ArrowRight) vx++;
  if (keys.KeyW || keys.ArrowUp) vy--;
  if (keys.KeyS || keys.ArrowDown) vy++;
  if (joy.on && (joy.x || joy.y)) { vx = joy.x; vy = joy.y; }   // touch joystick
  player.moving = !!(vx || vy);
  if (player.moving) {
    const len = Math.hypot(vx, vy); vx /= len; vy /= len;
    const sp = 175 * (S.energy < 10 ? 0.65 : 1);
    if (!blocked(S.x + vx * sp * dt, S.y) && !vehicleBlocks(S.x + vx * sp * dt, S.y, S.x, S.y)) S.x += vx * sp * dt;
    if (!blocked(S.x, S.y + vy * sp * dt) && !vehicleBlocks(S.x, S.y + vy * sp * dt, S.x, S.y)) S.y += vy * sp * dt;
    player.phase += dt * sp / 15;
    player.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
  }

  buildNpcGrid();
  for (const n of npcs) updateNPC(n, dt);
  updateGroups(dt);
  if ((crowdT -= dt) <= 0) { crowdT = 0.12; capCrowds(); }
  updateTraffic(dt);
  for (const n of npcs) if (!n.named && n.visible && n.bubbleCD <= 0 && n.bubbleT <= 0 && Math.hypot(n.x - S.x, n.y - S.y) < 90 && Math.random() < 0.01) {
    n.bubble = STUDENT_LINES[(Math.random() * STUDENT_LINES.length) | 0]; n.bubbleT = 3; n.bubbleCD = 12;
  }
  target = findTarget();

  // Keep foreground buildings fully visible while the player moves around them.
  const pr = { x: S.x - 14, y: S.y - 60, w: 28, h: 60 };
  const k = Math.min(1, dt * 10);
  { const gb = GATE_INFO.box, behind = GATE_INFO.sortY > S.y && rectsOverlap(pr, gb);
    gateAlpha += ((behind ? 0.4 : 1) - gateAlpha) * k; }
  for (const t of TREES) {
    if (Math.abs(t.x - S.x) > 120 || Math.abs(t.y - S.y) > 160) { t.alpha = 1; continue; }
    const behind = t.y > S.y && rectsOverlap(pr, { x: t.x - 40 * t.s, y: t.y - 115 * t.s, w: 80 * t.s, h: 115 * t.s });
    t.alpha = (t.alpha ?? 1) + ((behind ? 0.35 : 1) - (t.alpha ?? 1)) * k;
  }

  floaters = floaters.filter(f => (f.t -= dt) > 0);
  placeCam(S.x, S.y - 30);
}

// ── Render ───────────────────────────────────────────────────
function render(t) {
  const k = dpr * zoom;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#2d4a22'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(k, 0, 0, k, -cam.x * k, -cam.y * k);
  const sx = Math.max(0, cam.x), sy = Math.max(0, cam.y);
  const sw = Math.min(cam.x + VW, WORLD_W) - sx, sh = Math.min(cam.y + VH, WORLD_H) - sy;
  if (sw > 0 && sh > 0) ctx.drawImage(ground, sx, sy, sw, sh, sx, sy, sw, sh);
  const dark = darkness();
  const view = { x: cam.x - 150, y: cam.y - 50, w: VW + 300, h: VH + 300 };

  for (const p of S.pickups) {
    if (!onScreen(p)) continue;
    const bob = Math.sin(t * 3 + p.x) * 4;
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, 10, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,120,0.35)'; ctx.beginPath(); ctx.arc(p.x, p.y - 16 + bob, 15, 0, 7); ctx.fill();
    ctx.font = '22px ' + EMOJI_FONT; ctx.textAlign = 'center'; ctx.fillText(ITEMS[p.id].icon, p.x, p.y - 8 + bob); ctx.textAlign = 'left';
  }

  const list = [];
  for (const b of BUILDINGS) if (rectsOverlap(b, view)) list.push([b.y + b.h, () => drawBuilding(ctx, b, dark, t)]);
  for (const tr of TREES) if (onScreen(tr, 60)) list.push([tr.y, () => drawTree(ctx, tr)]);
  for (const l of LAMPS) if (onScreen(l, 40)) list.push([l.y, () => drawLamp(ctx, l, dark)]);
  if (onScreen(FOUNTAIN, 100)) list.push([FOUNTAIN.y + 28, () => drawFountain(ctx, t)]);
  if (onScreen({ x: GATE_INFO.x, y: GATE_INFO.y }, 300)) list.push([GATE_INFO.sortY, () => drawGate(ctx, GATE_INFO, gateAlpha)]);
  if (onScreen({ x: BACK_GATE_INFO.x, y: BACK_GATE_INFO.y }, 260)) list.push([BACK_GATE_INFO.sortY, () => drawBackGate(ctx, BACK_GATE_INFO)]);
  if (onScreen(NOTICE, 60)) list.push([NOTICE.y, () => drawNotice(ctx)]);
  for (const n of npcs) if (n.visible && onScreen(n)) list.push([n.y, () => drawChar(ctx, n.x, n.y, n.look, n.dir, n.phase, n.moving)]);
  for (const c of TRAFFIC.cars) if (c.on && onScreen({ x: c.rx ?? c.x, y: c.ry ?? c.y }, 180)) list.push([c.sortY, () => drawVehicle(ctx, c, dark)]);
  list.push([S.y, () => drawChar(ctx, S.x, S.y, S.look, player.dir, player.phase, player.moving)]);
  list.sort((a, b) => a[0] - b[0]);
  for (const [, fn] of list) fn();

  // Name tags + speech bubbles
  ctx.textAlign = 'center';
  for (const n of npcs) {
    if (!n.visible || !onScreen(n)) continue;
    const d = Math.hypot(n.x - S.x, n.y - S.y);
    if (n.named && d < 170) {
      ctx.font = 'bold 13px "Comic Neue", sans-serif';
      const w = ctx.measureText(n.name).width + 12;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; roundRect(ctx, n.x - w / 2, n.y - 82, w, 18, 6); ctx.fill();
      ctx.fillStyle = '#ffd60a'; ctx.fillText(n.name, n.x, n.y - 69);
    }
    if (n.bubbleT > 0 && n.bubble) {
      ctx.font = 'bold 13px "Comic Neue", sans-serif';
      const w = Math.min(240, ctx.measureText(n.bubble).width + 20);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
      roundRect(ctx, n.x - w / 2, n.y - 104, w, 26, 10); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(n.x - 6, n.y - 78); ctx.lineTo(n.x, n.y - 68); ctx.lineTo(n.x + 6, n.y - 78); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillText(n.bubble, n.x, n.y - 86, w - 12);
    }
  }
  // Interaction marker
  if (target && !paused()) {
    const by = target.y + Math.sin(t * 6) * 4;
    ctx.fillStyle = '#ffd60a'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(target.x - 9, by - 12); ctx.lineTo(target.x + 9, by - 12); ctx.lineTo(target.x, by); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  // Floating stat changes
  ctx.font = 'bold 16px Bangers, Impact, sans-serif';
  for (const f of floaters) {
    ctx.globalAlpha = Math.min(1, f.t);
    ctx.strokeStyle = '#000'; ctx.lineWidth = 4; ctx.strokeText(f.text, f.x, f.y - (1.6 - f.t) * 30);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y - (1.6 - f.t) * 30);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  // Objective arrow (when target is off in the distance)
  const o = getObjective();
  if (o.tgt && !paused()) {
    const dx = o.tgt.x - S.x, dy = o.tgt.y - S.y, d = Math.hypot(dx, dy);
    if (d > 260) {
      const a = Math.atan2(dy, dx), ax = S.x + Math.cos(a) * 62, ay = S.y - 28 + Math.sin(a) * 62;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
      ctx.globalAlpha = 0.85; ctx.fillStyle = '#ffd60a'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-6, -9); ctx.lineTo(-2, 0); ctx.lineTo(-6, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }

  // Day-night lighting
  const warm = warmth();
  if (warm > 0) { ctx.fillStyle = `rgba(255,120,40,${warm})`; ctx.fillRect(cam.x, cam.y, VW, VH); }
  if (dark > 0.01) {
    lg.globalCompositeOperation = 'source-over';
    lg.clearRect(0, 0, light.width, light.height);
    lg.fillStyle = `rgba(8,12,40,${dark})`; lg.fillRect(0, 0, light.width, light.height);
    lg.globalCompositeOperation = 'destination-out';
    const hole = (wx, wy, r, s) => {
      const x = (wx - cam.x) / 2, y = (wy - cam.y) / 2, rr = r / 2;
      if (x < -rr || y < -rr || x > light.width + rr || y > light.height + rr) return;
      const gr = lg.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, `rgba(0,0,0,${s})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      lg.fillStyle = gr; lg.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    };
    for (const l of LAMPS) for (const hd of (kimg('modern_city') ? mcLampHeads(l) : [{ x: l.x }])) hole(hd.x, l.y - 20, 190, 0.9);   // light pool under each lamp head
    for (const b of BUILDINGS) { const d = doorOf(b.id); hole(d.x, d.y - 30, 130, 0.8); const wr = buildingParts(b).wallR; hole(wr.x + wr.w / 2, wr.y + wr.h / 2, Math.max(wr.w, wr.h) * 0.9, 0.45); }
    hole(S.x, S.y - 25, 130, 0.6);
    hole(FOUNTAIN.x, FOUNTAIN.y, 120, 0.5);
    lg.globalCompositeOperation = 'source-over';
    ctx.drawImage(light, cam.x, cam.y, VW, VH);
    ctx.globalCompositeOperation = 'lighter';
    for (const l of LAMPS) {
      if (!onScreen(l, 100)) continue;
      const heads = kimg('modern_city') ? mcLampHeads(l) : [kimg('prop_light') ? lampHead(l) : { x: l.x, y: l.y - 72 }];
      for (const hd of heads) {
        const gr = ctx.createRadialGradient(hd.x, hd.y, 0, hd.x, hd.y, 60);
        gr.addColorStop(0, `rgba(255,220,120,${0.5 * dark})`); gr.addColorStop(1, 'rgba(255,220,120,0)');
        ctx.fillStyle = gr; ctx.fillRect(hd.x - 60, hd.y - 60, 120, 120);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ── Main loop ────────────────────────────────────────────────
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (S && !ended) {
    if (!paused()) update(dt);
    render(now / 1000);
    updateHUD(dt);
  }
  requestAnimationFrame(frame);
}

// ── Input ────────────────────────────────────────────────────
addEventListener('keydown', (e) => {
  const introEl = $('#intro');
  if (introEl && !introEl.classList.contains('hidden')) {
   
    return;
  }
  if (!S) {
    if (e.code === 'Escape' && overlay) closeOverlay();
    return;
  }
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (Comic.isOpen()) { Comic.key(e); return; }
  if (overlay) {
    if (e.code === 'Escape') { closeOverlay(); return; }
    if (overlay === 'phone') { if (['KeyP', 'KeyH'].includes(e.code)) closeOverlay(); return; }
    if (overlay === 'help' && e.code === 'KeyH') { closeOverlay(); return; }
    if (overlay === 'help' || overlay === 'settings' || overlay === 'credits' || overlay === 'pause' || overlay === 'pause-confirm') return;
    if (['KeyT', 'KeyH', 'KeyE'].includes(e.code) || (overlay === 'locker' && e.code === 'Tab')) closeOverlay();
    return;
  }
  keys[e.code] = true;
  if (e.repeat) return;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= 9) { S.sel = n - 1; renderHotbar(); return; }
  switch (e.code) {
    case 'KeyE': case 'Space': case 'Enter': interact(); break;
    case 'KeyF': useSelected(); break;
    case 'KeyQ': dropSelected(); break;
    case 'KeyZ': advance(30); gain({ energy: 2 }, true); toast(' ?3 You sit on a bench for 30 minutes.'); break;
    case 'KeyP': openPhone(); break;
    case 'KeyT': openTimetable(); break;
    case 'Equal': case 'NumpadAdd': setCamZoom(1.12); break;
    case 'Minus': case 'NumpadSubtract': setCamZoom(1 / 1.12); break;
    case 'KeyM': bigMap = !bigMap; $('#minimap').classList.toggle('big', bigMap); sizeMinimap(); break;
    case 'KeyH': openHelp('game'); break;
    case 'Escape': openPause(); break;
  }
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
addEventListener('wheel', (e) => {
  if (!S || paused()) return;
  S.sel = (S.sel + (e.deltaY > 0 ? 1 : 8)) % 9; renderHotbar();
}, { passive: true });
addEventListener('beforeunload', () => { if (S && !ended) save(); });
addEventListener('pagehide', () => { if (S && !ended) save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && S && !ended) save(); });
setInterval(() => { if (S && !ended && !paused()) save(); }, 5000);   // remember where you are every few seconds
document.querySelectorAll('[data-close]').forEach(b => b.onclick = closeOverlay);

// ── Phones & tablets ─────────────────────────────────────────
// Touch UI turns on automatically on touch screens (and the first time anyone touches the screen).
const isTouch = () => document.body.classList.contains('touch');
const portraitQ = matchMedia('(orientation: portrait)');
function checkRotationGate() {
  const blocked = isTouch() && portraitQ.matches;
  const video = $('#intro-video');
  if (blocked && !video.paused) {
    introPausedForRotation = true;
    video.pause();
  } else if (!blocked && introPausedForRotation) {
    introPausedForRotation = false;
    const play = video.play();
    if (play && play.catch) play.catch(() => {
      $('#intro-ready').classList.remove('hidden');
      $('#intro-ready small').textContent = 'Intro paused. Tap Play to resume.';
    });
  }
}
function enableTouchUI() {
  if (isTouch()) return;
  document.body.classList.add('touch');
  $('#comic-hint').textContent = 'TAP ▶';
  if (S) { $('#touch').classList.remove('hidden'); $('#mobile-menu').classList.remove('hidden'); }
  checkRotationGate();
  resize();
}
if (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0 && matchMedia('(hover: none)').matches) enableTouchUI();
addEventListener('touchstart', enableTouchUI, { passive: true, once: true });

// Joystick: drag to move in any direction.
const joy = { on: false, x: 0, y: 0, id: null };
(function initJoystick() {
  const pad = $('#joy'), knob = $('#joy-knob');
  const R = () => pad.clientWidth / 2;
  const move = (e) => {
    const r = pad.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy), max = R() - 10;
    if (d > max) { dx *= max / d; dy *= max / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.min(1, d / max);
    joy.x = m > 0.18 ? dx / max : 0; joy.y = m > 0.18 ? dy / max : 0;
  };
  const end = (e) => {
    if (e.pointerId !== joy.id) return;
    joy.on = false; joy.x = joy.y = 0; joy.id = null;
    knob.style.transform = ''; pad.classList.remove('active');
  };
  pad.addEventListener('pointerdown', (e) => { e.preventDefault(); joy.on = true; joy.id = e.pointerId; try { pad.setPointerCapture(e.pointerId); } catch (err) { /* keep tracking without capture */ } pad.classList.add('active'); move(e); });
  pad.addEventListener('pointermove', (e) => { if (joy.on && e.pointerId === joy.id) move(e); });
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end); pad.addEventListener('lostpointercapture', end);
})();

// Buttons send the same keys as the keyboard, so every action works exactly like on a computer.
function pressKey(code) {
  const key = { KeyE: 'e', KeyF: 'f', KeyQ: 'q', KeyZ: 'z', KeyM: 'm', KeyT: 't', KeyH: 'h', Equal: '=', Minus: '-' }[code] || '';
  dispatchEvent(new KeyboardEvent('keydown', { code, key }));
  dispatchEvent(new KeyboardEvent('keyup', { code, key }));
}
document.querySelectorAll('#touch [data-act], #mobile-menu [data-act], #hud [data-act]').forEach(b => {
  if (b.dataset.act === 'phone') return;
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault(); e.stopPropagation();
    const a = b.dataset.act;
    if (a === 'fullscreen') return toggleFullscreen();
    if (a === 'KeyH') return overlay === 'help' ? closeOverlay() : openPause();
    pressKey(a);
  });
});
$('#minimap').addEventListener('click', () => { if (S && !Comic.isOpen() && !overlay) pressKey('KeyM'); });   // tap the minimap for the big map

// The phone opens over the game; its home button and back arrows navigate the apps.
const phoneOverlay = $('#phone-overlay');
if (phoneOverlay) {
  $('#touch [data-act="phone"]').addEventListener('click', () => openPhone());
  $('#phone-peek').addEventListener('click', () => openPhone());
  $('#phone-close').addEventListener('click', closePhone);
  $('#phone-home').addEventListener('click', () => showPhoneView('home'));
  phoneOverlay.addEventListener('click', (e) => { if (e.target === phoneOverlay) closePhone(); });
  phoneOverlay.querySelectorAll('[data-app]').forEach(b => b.addEventListener('click', () => showPhoneView(b.dataset.app)));
  phoneOverlay.querySelectorAll('[data-back]').forEach(b => b.addEventListener('click', () => showPhoneView('home')));
}

// Full screen (and landscape, where the phone allows it). iPhones can't do this for web pages, so explain the home-screen way.
const fsTarget = document.documentElement;
const canFullscreen = !!(fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen);
const inFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
async function toggleFullscreen() {
  if (!canFullscreen) { overlay = overlay || 'fs-tip'; $('#fs-tip').classList.remove('hidden'); return; }
  try {
    if (inFullscreen()) await (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else {
      await (fsTarget.requestFullscreen || fsTarget.webkitRequestFullscreen).call(fsTarget, { navigationUI: 'hide' });
      try { await screen.orientation.lock('landscape'); } catch (e) { /* not supported: play in any orientation */ }
    }
  } catch (e) { toast('Full screen was blocked by the browser.'); }
}
function updateFullscreenButtons() {
  const on = inFullscreen();
  document.querySelectorAll('.fs-btn').forEach(b => {
    b.classList.toggle('on', on);
    if (b.id === 'btn-fs-title') b.innerHTML = Icons.svg(on ? 'fullscreen-exit' : 'fullscreen') + (on ? 'Exit full screen' : 'Full screen');
    else b.innerHTML = Icons.svg(on ? 'fullscreen-exit' : 'fullscreen');
  });
}
document.addEventListener('fullscreenchange', () => { updateFullscreenButtons(); resize(); });
document.addEventListener('webkitfullscreenchange', () => { updateFullscreenButtons(); resize(); });
$('#btn-fs-title').onclick = toggleFullscreen;
if (portraitQ.addEventListener) portraitQ.addEventListener('change', checkRotationGate);
else portraitQ.addListener(checkRotationGate);
addEventListener('resize', checkRotationGate);
checkRotationGate();
addEventListener('orientationchange', () => setTimeout(() => { checkRotationGate(); resize(); }, 250));

// ── Title screen ─────────────────────────────────────────────
const SHIRTS = ['#e63946', '#3a86ff', '#2a9d8f', '#ff9f1c', '#8338ec', '#212529'];
let chosenShirt = SHIRTS[0];
function titlePreview() {
  const L = { ...CHARS.player, shirt: chosenShirt };
  $('#title-portrait').src = Portraits.get('player', L);
}
// Neon city parallax behind the title screen (Nasha's Parallax Worlds), drifting slowly.
let titleBgRunning = false;
function startTitleBg() {
  if (titleBgRunning) return;
  const cv = $('#title-bg'); if (!cv) return;
  titleBgRunning = true;
  const layers = [1, 2, 3, 4, 5].map(i => { const im = new Image(); im.src = `assets/itch/neon/layer${i}.png`; return im; });
  const speed = [2, 6, 12, 22, 40];
  const tick = (now) => {
    if ($('#title').classList.contains('hidden')) { titleBgRunning = false; return; }
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
    layers.forEach((im, i) => {
      if (!im.complete || !im.naturalWidth) return;
      const k = H / im.naturalHeight, w = im.naturalWidth * k, off = (now / 1000 * speed[i]) % w;
      for (let x = -off; x < W; x += w) g.drawImage(im, x, 0, w, H);
    });
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
function setMenuItem(btn, label, sub) {
  if (!btn) return;
  const l = btn.querySelector('span'), s = btn.querySelector('small');
  if (l) l.textContent = label;
  if (s) s.textContent = sub;
}
function refreshContinue() {
  const cont = $('#btn-continue');
  if (!cont) return;
  const existing = loadSave();
  if (existing) {
    cont.disabled = false;
    setMenuItem(cont, 'Continue', `Day ${existing.day} - ${existing.name}`);
    cont.title = existing.name;
    cont.onclick = () => start(existing, false);
  } else {
    cont.disabled = true;
    setMenuItem(cont, 'Continue', 'No save yet');
    cont.title = '';
    cont.onclick = null;
  }
}
function closeNewGame() { $('#new-game-panel').classList.add('hidden'); }
function openNewGame() {
  $('#new-game-panel').classList.remove('hidden');
  setTimeout(() => { const n = $('#name'); if (n) { n.focus(); n.select(); } }, 60);
}
function initTitle() {
  startTitleBg();
  const sw = $('#shirts');
  if (sw && !sw.children.length) SHIRTS.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'swatch' + (i === 0 ? ' on' : ''); b.style.background = c;
    b.onclick = () => { chosenShirt = c; sw.querySelectorAll('.swatch').forEach(x => x.classList.remove('on')); b.classList.add('on'); titlePreview(); };
    sw.appendChild(b);
  });
  titlePreview();
  refreshContinue();
  $('#btn-new').onclick = openNewGame;
  $('#btn-begin').onclick = () => {
    const name = ($('#name').value || '').trim().slice(0, 14) || 'Student';
    start(freshState(name, chosenShirt), true);
  };
  $('#name').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') $('#btn-begin').click(); });
  document.querySelectorAll('[data-menu-close]').forEach(b => b.onclick = closeNewGame);
  $('#btn-help-menu').onclick = () => openHelp('title');
  $('#btn-settings-menu').onclick = () => openSettings('title');
  $('#btn-credits-menu').onclick = openCredits;
  $('#btn-replay-intro').onclick = () => {
    const from = S ? 'pause' : 'title';
    hideAllOverlays();
    overlay = from === 'pause' ? 'intro' : null;
    showIntro(from);
  };
  updateFullscreenButtons();
}
let introReturn = 'title';
function showIntro(returnTo = 'title') {
  const el = $('#intro'), video = $('#intro-video'), ready = $('#intro-ready');
  if (!el || !video) return;
  introReturn = returnTo;
  el.classList.remove('hidden', 'out', 'playing');
  ready.classList.remove('hidden');
  ready.querySelector('small').textContent = 'Best with sound on';
  try { video.pause(); video.currentTime = 0; } catch (e) { /* video may not be ready yet */ }
}
function playIntro() {
  const el = $('#intro'), video = $('#intro-video'), ready = $('#intro-ready');
  if (!el || !video) { finishIntro(); return; }
  ready.classList.add('hidden');
  el.classList.add('playing');
  const p = video.play();
  if (p && p.catch) p.catch(() => {
    el.classList.remove('playing');
    ready.classList.remove('hidden');
    ready.querySelector('small').textContent = 'Intro could not play. Tap Play to try again.';
  });
}

function finishIntro() {
  const el = $('#intro'), video = $('#intro-video'), ready = $('#intro-ready');
  if (!el || el.classList.contains('out')) return;
  try { video.pause(); } catch (e) { /* ignore */ }
  el.classList.add('out');
  setTimeout(() => {
    el.classList.add('hidden');
    el.classList.remove('out', 'playing');
    ready.classList.remove('hidden');
    ready.querySelector('small').textContent = 'Best with sound on';
    if (introReturn === 'pause' && S) openPause();
    else { $('#title').classList.remove('hidden'); startTitleBg(); }
  }, 560);
}

function initIntro() {
  const video = $('#intro-video'), play = $('#intro-play');
  if (!video || !play) return;
  video.volume = 1;
  video.addEventListener('ended', finishIntro);
  video.addEventListener('error', () => {
    finishIntro(); // Automatically proceeds if the video file is broken or missing
  });
  play.addEventListener('click', playIntro);
  showIntro('title');
}
function initPauseMenu() {
  $('#btn-resume').onclick = closeOverlay;
  $('#btn-pause-controls').onclick = () => openHelp('pause');
  $('#btn-pause-settings').onclick = () => openSettings('pause');
  $('#btn-pause-save').onclick = () => { save(); $('#pause-save').textContent = 'Game saved just now.'; };
  $('#btn-pause-menu').onclick = openPauseConfirm;
  $('#btn-confirm-menu').onclick = () => returnToTitle(true);
}
function returnToTitle(saveProgress = true) {
  if (saveProgress && S) save();
  if (Comic.isOpen()) Comic.play([]);
  S = null;
  ended = false;
  overlay = null;
  overlayReturn = null;
  for (const k in keys) keys[k] = false;
  hideAllOverlays();
  $('#hud').classList.add('hidden');
  $('#touch').classList.add('hidden');
  $('#mobile-menu').classList.add('hidden');
  $('#new-game-panel').classList.add('hidden');
  bigMap = false;
  $('#minimap').classList.remove('big');
  $('#title').classList.remove('hidden');
  refreshContinue();
  startTitleBg();
}

function start(state, isNew) {
  S = state;
  ended = false;
  overlay = null;
  overlayReturn = null;
  hideAllOverlays();
  $('#intro').classList.add('hidden');
  $('#new-game-panel').classList.add('hidden');
  if (typeof S.hunger !== 'number') S.hunger = 70;
  if (typeof S.water !== 'number') S.water = 70;
  S.look = { ...S.look, sprite: 0 };
  Comic.setLook(() => S.look);
  $('#title').classList.add('hidden');
  $('#hud').classList.remove('hidden');
  if (isTouch()) { $('#touch').classList.remove('hidden'); $('#mobile-menu').classList.remove('hidden'); }
  makeNPCs();
  if (!NAV.walk) buildNav();
  tagZoneBuildings();
  buildTraffic();
  if (isNew) placeAtGate();
  else if (!(S.x > 0 && S.y > 0 && S.x < WORLD_W && S.y < WORLD_H)) placeAtGate();   // saved spot is outside the (edited) map
  else if (blocked(S.x, S.y)) { const p = nearestFree(S.x, S.y); S.x = p.x; S.y = p.y; }   // a building now stands there: step aside
  // Items lying outside the map or inside something (left over from older layouts) move onto open ground nearby.
  const rp = mulberry32(S.day * 31 + 5);
  for (const pk of S.pickups || []) {
    if (pk.x > 40 && pk.y > 40 && pk.x < WORLD_W - 40 && pk.y < WORLD_H - 45 && !blocked(pk.x, pk.y)) continue;
    const q = nearestFree(60 + rp() * (WORLD_W - 120), 60 + rp() * (WORLD_H - 120)); pk.x = Math.round(q.x); pk.y = Math.round(q.y);
  }
  save();
  placeCam(S.x, S.y - 30);
  renderHotbar();
  if (isNew) Comic.play(introStory());
  else Comic.play([{ scene: 'dawn', art: '🏫', caption: `Welcome back, ${S.name}! Day ${S.day} · ${fmtTime(S.min)}` }]);
  checkRotationGate();
}

// ── Boot ─────────────────────────────────────────────────────
// Redraw the ground (pixel grass, pavement, parked cars) once the Kenney pictures have loaded.
window.onKenneyReady = () => { ground = makeGround(); miniBase = makeMiniBase(); };
resize();
ground = makeGround();
miniBase = makeMiniBase();
initTitle();
initIntro();
initPauseMenu();
requestAnimationFrame(frame);
// Fonts may load after the first ground render; redraw text once they arrive.
if (document.fonts) document.fonts.ready.then(() => { ground = makeGround(); miniBase = makeMiniBase(); });
// The hand-drawn campus picture may also still be loading; redraw the ground once it arrives.
if (!(MAP_IMG.complete && MAP_IMG.naturalWidth)) MAP_IMG.addEventListener('load', () => { ground = makeGround(); miniBase = makeMiniBase(); });