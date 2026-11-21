'use strict';
// ─────────────────────────────────────────────────────────────
//  Pixel-art dressing from Kenney's free CC0 packs (www.kenney.nl):
//    • PICO-8 City  – top-down cars, buses, trees, bushes, grass & pavement tiles
//    • Pixel Vehicle Pack – side-view traffic (cars, school bus, scooters, cycles) and street lamps
//  Everything falls back to the hand-drawn art if a picture hasn't loaded.
// ─────────────────────────────────────────────────────────────
const KENNEY = { base: 'assets/kenney/', img: {}, ready: false };
const KENNEY_FILES = [
  'car_h_red_a', 'car_h_red_b', 'car_h_green_a', 'car_h_green_b', 'car_h_pink_a', 'car_h_pink_b',
  'car_v_red_a', 'car_v_red_b', 'car_v_green_a', 'car_v_green_b', 'car_v_pink_a', 'car_v_pink_b', 'bus_v',
  'palm', 'tree_green', 'tree_orange', 'bush_green', 'bush_orange',
  'tile_grass', 'tile_grass_dots', 'tile_grass_flowers', 'tile_pave', 'tile_pave_dots', 'tile_pave_b',
  'side_sedan', 'side_sedan_blue', 'side_taxi', 'side_bus_school', 'side_bus', 'side_scooter', 'side_cycle', 'side_van_small',
  'side_suv', 'side_rounded_red', 'side_rounded_yellow', 'side_rounded_green', 'side_police', 'side_ambulance', 'side_station',
  'prop_light', 'modern_city', 'tiny_town',
  '../itch/rocks', '../itch/doors', '../itch/fruit',
  // (vehicles are hi-res vector art now: js/vehicle_art.js)
];
(function loadKenney() {
  let left = KENNEY_FILES.length;
  const done = () => { if (--left === 0) { KENNEY.ready = true; if (typeof window.onKenneyReady === 'function') window.onKenneyReady(); } };
  for (const n of KENNEY_FILES) { const im = new Image(); im.onload = im.onerror = done; im.src = KENNEY.base + n + '.png'; KENNEY.img[n] = im; }
})();
const kimg = (n) => { const im = KENNEY.img[n]; return im && im.complete && im.naturalWidth ? im : null; };

// Draw a pixel sprite crisply (no blur), optionally mirrored left-right, with its bottom-centre at (x, y).
function drawPixelSprite(g, im, x, y, scale, flip = false, alpha = 1) {
  const w = im.naturalWidth * scale, h = im.naturalHeight * scale;
  g.save(); g.imageSmoothingEnabled = false; g.globalAlpha *= alpha;
  if (flip) { g.translate(x, 0); g.scale(-1, 1); g.drawImage(im, -w / 2, y - h, w, h); }
  else g.drawImage(im, x - w / 2, y - h, w, h);
  g.restore();
}

// ── Trees: a mix of tall green trees, palms, autumn trees and round bushes ──
function pixelTreeKind(tr) {
  const h = tr.hue ?? 0.5;
  return h < 0.3 ? 'tree_green' : h < 0.5 ? 'palm' : h < 0.72 ? 'tree_orange' : h < 0.86 ? 'bush_green' : 'bush_orange';
}
function drawPixelTree(g, tr) {
  const im = kimg(pixelTreeKind(tr)); if (!im) return false;
  const k = 7.5 * (tr.s || 1);
  g.save(); g.globalAlpha = tr.alpha ?? 1;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(tr.x + 5, tr.y - 2, im.naturalWidth * k * 0.55, 9 * (tr.s || 1), 0, 0, 7); g.fill();
  drawPixelSprite(g, im, tr.x, tr.y + 2, k);
  g.restore();
  return true;
}

// ── Parked cars (top-down) ──
const PARKED_COLORS = ['red', 'green', 'pink'];
function drawPixelParkedCar(g, c) {
  const col = PARKED_COLORS[(Math.floor(c.x / 37) * 5 + Math.floor(c.y / 37) * 2 + (c.c ? c.c.charCodeAt(1) : 0)) % 3];
  const tall = c.h >= c.w;
  const im = kimg(tall ? `car_v_${col}_${(c.x + c.y) % 2 ? 'a' : 'b'}` : `car_h_${col}_${(c.x + c.y) % 2 ? 'a' : 'b'}`);
  if (!im) return false;
  const k = Math.min(c.w / im.naturalWidth, c.h / im.naturalHeight) * 0.95;
  g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(c.x + (c.w - im.naturalWidth * k) / 2 + 4, c.y + (c.h - im.naturalHeight * k) / 2 + 6, im.naturalWidth * k, im.naturalHeight * k);
  drawPixelSprite(g, im, c.x + c.w / 2, c.y + (c.h + im.naturalHeight * k) / 2, k);
  return true;
}

// ── Ground tiles ──
// Paint grass with PICO-8 grass tiles (a few speckled and flowery ones mixed in), brightened to match the campus palette.
function paintPixelGrass(g, W, H, rnd) {
  const a = kimg('tile_grass'), b = kimg('tile_grass_dots'), f = kimg('tile_grass_flowers');
  if (!a) return false;
  const T = 32;
  g.save(); g.imageSmoothingEnabled = false;
  for (let y = 0; y < H; y += T) for (let x = 0; x < W; x += T) {
    const r = rnd(); g.drawImage(r < 0.04 && f ? f : r < 0.2 && b ? b : a, x, y, T, T);
  }
  g.globalAlpha = 0.28; g.fillStyle = '#9be36b'; g.fillRect(0, 0, W, H);   // lighten the deep PICO-8 green a little
  g.restore();
  return true;
}
// Pavement tiles for plazas.
function paintPixelPavement(g, p, rnd) {
  const a = kimg('tile_pave'), b = kimg('tile_pave_dots'), c = kimg('tile_pave_b');
  if (!a) return false;
  const T = 32;
  g.save(); g.beginPath(); g.rect(p.x, p.y, p.w, p.h); g.clip(); g.imageSmoothingEnabled = false;
  for (let y = p.y; y < p.y + p.h; y += T) for (let x = p.x; x < p.x + p.w; x += T) {
    const r = rnd(); g.drawImage(r < 0.12 && b ? b : r < 0.2 && c ? c : a, x, y, T, T);
  }
  g.globalAlpha = 0.15; g.fillStyle = '#fff'; g.fillRect(p.x, p.y, p.w, p.h);
  g.restore();
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3; g.strokeRect(p.x, p.y, p.w, p.h);
  return true;
}

// ── Street lamps (pixel lamp post; its lamp head hangs to the right) ──
const LAMP_SCALE = 3;
const lampHead = (l) => ({ x: l.x + 2.5 * LAMP_SCALE, y: l.y - 26 * LAMP_SCALE });
function drawPixelLamp(g, l, dark) {
  const im = kimg('prop_light'); if (!im) return false;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(l.x + 3, l.y, 9, 3, 0, 0, 7); g.fill();
  drawPixelSprite(g, im, l.x, l.y + 1, LAMP_SCALE);
  if (dark > 0.25) { const h = lampHead(l); g.fillStyle = '#fff3b0'; g.beginPath(); g.arc(h.x, h.y + 4, 5, 0, 7); g.fill(); }
  return true;
}

// ── Kenney "Roguelike Modern City" + "Tiny Town" tile sheets (16 px tiles, CC0) ──
// Drawn straight from the sheets by tile number; TS = on-screen size of one tile.
const SHEETS = { modern_city: 37, tiny_town: 12 };
const TS = 48;
function drawTile(g, sheet, idx, x, y, w = TS, h = TS) {
  const im = kimg(sheet); if (!im) return false;
  const cols = SHEETS[sheet];
  g.drawImage(im, (idx % cols) * 16, Math.floor(idx / cols) * 16, 16, 16, x, y, w, h);
  return true;
}
// A repeating pattern of one tile (or a few random variants), aligned to (ox, oy).
const PATTERNS = {};
function tilePattern(g, sheet, ids, ox = 0, oy = 0, size = TS) {
  const key = sheet + ':' + ids.join(',') + ':' + size;
  if (!PATTERNS[key]) {
    const im = kimg(sheet); if (!im) return null;
    const n = 4, c = document.createElement('canvas'); c.width = c.height = size * n;
    const cg = c.getContext('2d'); cg.imageSmoothingEnabled = false;
    const rnd = mulberry32(ids.length * 97 + size);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const id = Array.isArray(ids[0]) ? null : ids[(rnd() * ids.length) | 0];
      cg.drawImage(im, (id % SHEETS[sheet]) * 16, Math.floor(id / SHEETS[sheet]) * 16, 16, 16, i * size, j * size, size, size);
    }
    PATTERNS[key] = c;
  }
  const p = g.createPattern(PATTERNS[key], 'repeat');
  if (p.setTransform) p.setTransform(new DOMMatrix().translate(ox, oy));
  return p;
}
const MC = {
  asphalt: [714], paveGrey: [741], paveTan: [744], paveBlue: [747],
  // trees are two tiles tall: [top, bottom]
  trees: [[401, 438], [402, 439], [403, 440], [404, 441], [405, 442], [406, 443]],
  smallTrees: [[475, 512], [476, 513], [477, 514], [478, 515], [479, 516], [480, 517]],
  lamp: [593, 630, 667], bench: [609, 610], benchSide: [571, 608], bin: 496, binDark: 498, hydrant: 533, mailbox: [567, 604], cone: 580,
  // cars: pixel rectangles in the sheet
  cars: {
    green:  { left: [503, 264, 36, 24], right: [549, 264, 36, 24], down: [501, 290, 22, 29], up: [533, 290, 22, 29] },
    grey:   { left: [503, 328, 36, 24], right: [549, 328, 36, 24], down: [501, 354, 22, 29], up: [533, 354, 22, 29] },
    orange: { left: [503, 392, 36, 24], right: [549, 392, 36, 24], down: [501, 418, 22, 29], up: [533, 418, 22, 29] },
  },
  // building looks: wall tile, base ledge, window frame, door [top, bottom]
  walls: {
    brick: { wall: 187, base: 298, win: 581, win4: 618, door: [988, 1025], rgb: [176, 109, 96] },
    grey:  { wall: 191, base: 302, win: 692, win4: 729, door: [877, 914], rgb: [137, 139, 143] },
    cream: { wall: 195, base: 306, win: 581, win4: 618, door: [989, 1026], rgb: [212, 197, 164] },
  },
  // roof fill tiles by colour (mostly plain, with the odd vent)
  roofs: {
    red:   { fill: [6, 6, 6, 6, 7, 43], rgb: [160, 100, 88] },
    dark:  { fill: [14, 14, 14, 14, 15, 51], rgb: [100, 102, 108] },
    light: { fill: [22, 22, 22, 22, 23, 59], rgb: [168, 171, 176] },
    tan:   { fill: [30, 30, 30, 30, 31, 67], rgb: [197, 181, 149] },
  },
};
const CAR_COLORS = ['green', 'grey', 'orange'];
const SEDAN_COLORS = ['white', 'white', 'black', 'red', 'yellow', 'green', 'purple', 'white', 'black'];
function drawRectSprite(g, sheet, r, x, y, scale, flip = false, alpha = 1) {   // bottom-centre at (x, y)
  const im = kimg(sheet); if (!im) return false;
  const w = r[2] * scale, h = r[3] * scale;
  g.save(); g.imageSmoothingEnabled = false; g.globalAlpha *= alpha;
  if (flip) { g.translate(x, 0); g.scale(-1, 1); g.drawImage(im, r[0], r[1], r[2], r[3], -w / 2, y - h, w, h); }
  else g.drawImage(im, r[0], r[1], r[2], r[3], x - w / 2, y - h, w, h);
  g.restore();
  return true;
}
const hexRgb = (hex) => { const n = parseInt((hex || '#cccccc').slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const nearestLook = (hex, table) => { const c = hexRgb(hex); let best = null, bd = 1e9; for (const [k, v] of Object.entries(table)) { const d = (c[0] - v.rgb[0]) ** 2 + (c[1] - v.rgb[1]) ** 2 + (c[2] - v.rgb[2]) ** 2; if (d < bd) { bd = d; best = k; } } return table[best]; };

// ── Ground ──
function paintTileGrass(g, W, H) {
  if (!kimg('tiny_town')) return false;
  const rnd = mulberry32(11);
  g.save(); g.imageSmoothingEnabled = false;
  for (let y = 0; y < H; y += TS) for (let x = 0; x < W; x += TS) { const r = rnd(); drawTile(g, 'tiny_town', r < 0.035 ? 2 : r < 0.16 ? 1 : 0, x, y); }
  g.restore();
  return true;
}
function fillTiles(g, r, sheet, ids) {
  const p = tilePattern(g, sheet, ids, r.x, r.y); if (!p) return false;
  g.save(); g.imageSmoothingEnabled = false; g.fillStyle = p; g.fillRect(r.x, r.y, r.w, r.h); g.restore();
  return true;
}
// Footpaths along every road, asphalt, white lane markings and zebra crossings where roads meet.
function paintTileRoads(g) {
  if (!kimg('modern_city')) return false;
  const K = 18;   // footpath width
  for (const r of ROADS) fillTiles(g, { x: r.x - K, y: r.y - K, w: r.w + 2 * K, h: r.h + 2 * K }, 'modern_city', MC.paveGrey);
  g.strokeStyle = 'rgba(60,64,72,0.55)'; g.lineWidth = 2;
  for (const r of ROADS) g.strokeRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4);   // kerb
  for (const r of ROADS) fillTiles(g, r, 'modern_city', MC.asphalt);
  // centre lines: white dashes on wide roads, edge lines on narrow ones
  g.fillStyle = 'rgba(240,240,240,0.9)';
  for (const r of ROADS) {
    const horiz = r.w >= r.h, len = horiz ? r.w : r.h, thick = horiz ? r.h : r.w;
    if (thick < 45) continue;
    for (let d = 20; d < len - 30; d += 54) horiz ? g.fillRect(r.x + d, r.y + r.h / 2 - 2, 28, 4) : g.fillRect(r.x + r.w / 2 - 2, r.y + d, 4, 28);
  }
  // zebra crossings at junctions: on each road, just outside the overlap with another road
  for (const a of ROADS) for (const b of ROADS) {
    if (a === b) continue;
    const ax = Math.max(a.x, b.x), ay = Math.max(a.y, b.y), bx = Math.min(a.x + a.w, b.x + b.w), by = Math.min(a.y + a.h, b.y + b.h);
    if (bx <= ax || by <= ay) continue;   // they don't touch
    const horiz = a.w >= a.h;
    if (horiz) {
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? ax - 34 : bx + 6;
        if (x0 < a.x + 4 || x0 + 28 > a.x + a.w - 4) continue;
        for (let y = a.y + 6; y < a.y + a.h - 8; y += 12) g.fillRect(x0, y, 28, 6);
      }
    } else {
      for (const side of [-1, 1]) {
        const y0 = side < 0 ? ay - 34 : by + 6;
        if (y0 < a.y + 4 || y0 + 28 > a.y + a.h - 4) continue;
        for (let x = a.x + 6; x < a.x + a.w - 8; x += 12) g.fillRect(x, y0, 6, 28);
      }
    }
  }
  return true;
}
function paintTilePlaza(g, p) {
  if (!fillTiles(g, p, 'modern_city', MC.paveTan)) return false;
  g.strokeStyle = 'rgba(90,70,40,0.45)'; g.lineWidth = 3; g.strokeRect(p.x, p.y, p.w, p.h);
  return true;
}
function drawTileBench(g, b) {
  if (!kimg('modern_city')) return false;
  g.save(); g.imageSmoothingEnabled = false;
  if (b.rot) { drawTile(g, 'modern_city', MC.benchSide[0], b.x - 8, b.y - 32, 32, 32); drawTile(g, 'modern_city', MC.benchSide[1], b.x - 8, b.y, 32, 32); }
  else { drawTile(g, 'modern_city', MC.bench[0], b.x - 4, b.y - 14, 32, 32); drawTile(g, 'modern_city', MC.bench[1], b.x + 28, b.y - 14, 32, 32); }
  g.restore();
  return true;
}
// One bin or hydrant placed in the Map Editor (or automatically beside a street light — see autoBins in map_loader.js).
function paintBin(g, b) {
  if (!kimg('modern_city')) return;
  g.save(); g.imageSmoothingEnabled = false;
  drawTile(g, 'modern_city', b.kind === 'hydrant' ? MC.hydrant : b.kind === 'binDark' ? MC.binDark : MC.bin, b.x, b.y, 32, 32);
  g.restore();
}
function paintRocks(g) {
  const im = kimg('../itch/rocks'); if (!im) return;
  g.save(); g.imageSmoothingEnabled = false;
  for (const rock of ROCKS) {
    const b = rock.sprite || ROCK_SPRITES[0];
    g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(rock.x + rock.w / 2, rock.y + rock.h - 2, rock.w * 0.35, 4, 0, 0, 7); g.fill();
    g.drawImage(im, b[0], b[1], b[2], b[3], rock.x, rock.y, rock.w, rock.h);
  }
  g.restore();
}
// Item icons from the Fruit+ sheet (16 px cells), as a small picture for the hotbar and the ground.
const ICON_CACHE = {};
function itemIconURL(id) {
  const it = ITEMS[id], im = kimg('../itch/fruit');
  if (!it || !it.sprite || !im) return null;
  if (!ICON_CACHE[id]) { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(im, it.sprite[0] * 16, it.sprite[1] * 16, 16, 16, 0, 0, 32, 32); ICON_CACHE[id] = c.toDataURL(); }
  return ICON_CACHE[id];
}
function itemIconHTML(id) { const u = itemIconURL(id); return u ? `<img src="${u}" alt="" style="width:28px;height:28px;image-rendering:pixelated">` : ITEMS[id].icon; }

// ── Trees and lamps ──
function drawTileTree(g, tr) {
  if (!kimg('modern_city')) return false;
  const h = tr.hue ?? 0.5, small = h > 0.8;
  const set = small ? MC.smallTrees : MC.trees, t = set[Math.floor((small ? (h - 0.8) / 0.2 : h / 0.8) * set.length) % set.length];
  const k = (small ? 2.6 : 3.4) * (tr.s || 1), w = 16 * k;
  g.save(); g.globalAlpha = tr.alpha ?? 1; g.imageSmoothingEnabled = false;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(tr.x + 4, tr.y - 2, w * 0.42, 8 * (tr.s || 1), 0, 0, 7); g.fill();
  drawTile(g, 'modern_city', t[0], tr.x - w / 2, tr.y - 32 * k + 2, w, w);
  drawTile(g, 'modern_city', t[1], tr.x - w / 2, tr.y - 16 * k + 2, w, w);
  g.restore();
  return true;
}
// Street lamps. The single-arm lamp's pole is at x=12 of its 16 px tile with the arm reaching left; it is mirrored
// when it stands on the left of a road so the lamp always hangs over the road. Lamps beside left-right roads use the
// double-arm lamp (pole in the middle). The base ends 2 px above the tile bottom.
const MC_LAMP_K = 2.3;
const lampKind = (l) => (l.side === 'T' || l.side === 'B') ? 'double' : 'single';
function mcLampHeads(l) {
  const k = MC_LAMP_K, top = l.y - 46 * k;
  if (lampKind(l) === 'double') return [{ x: l.x - 6 * k, y: top + 3 * k }, { x: l.x + 6 * k, y: top + 3 * k }];
  return [{ x: l.x + (l.side === 'L' ? 9 : -9) * k, y: top + 3 * k }];
}
const mcLampHead = (l) => mcLampHeads(l)[0];
function drawTileLamp(g, l, dark) {
  if (!kimg('modern_city')) return false;
  const k = MC_LAMP_K, w = 16 * k, dbl = lampKind(l) === 'double', flip = l.side === 'L';
  const ids = dbl ? [597, 634, 671] : MC.lamp, poleX = dbl ? 8 : 12, top = l.y - 46 * k;
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(l.x + 3, l.y, 9, 3, 0, 0, 7); g.fill();
  g.save(); g.imageSmoothingEnabled = false;
  if (flip) { g.translate(l.x, 0); g.scale(-1, 1); for (let i = 0; i < 3; i++) drawTile(g, 'modern_city', ids[i], -poleX * k, top + i * w, w, w); }
  else for (let i = 0; i < 3; i++) drawTile(g, 'modern_city', ids[i], l.x - poleX * k, top + i * w, w, w);
  g.restore();
  if (dark > 0.25) { g.fillStyle = '#fff3b0'; for (const hd of mcLampHeads(l)) { g.beginPath(); g.arc(hd.x, hd.y + 4, 5, 0, 7); g.fill(); } }
  return true;
}

// ── Buildings built from tiles ──
// Wall tile matched to the building's wall colour, a base ledge, framed windows (one row per floor), a door,
// and a roof edged and filled from the roof tiles matched to the roof colour. Uploaded pictures (b.img) take priority.
function drawTileBuilding(g, b, dark, t) {
  if (!kimg('modern_city') || b.img) return false;
  const P = buildingParts(b), W = P.wallR, R = P.roofR, face = P.face;
  const look = nearestLook(b.wall, MC.walls), roof = nearestLook(b.roofC, MC.roofs);
  const door = doorInfo(b);
  g.save(); g.globalAlpha = 1; g.imageSmoothingEnabled = false;
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(b.x + 14, b.y + 14, b.w, b.h);
  // wall
  fillTiles(g, W, 'modern_city', [look.wall]);
  const horizWall = face === 'S' || face === 'N';
  if (horizWall) {   // base ledge along the ground edge
    const by = face === 'S' ? W.y + W.h - 16 : W.y;
    const p = tilePattern(g, 'modern_city', [look.base], W.x, by - 32);
    g.fillStyle = p; g.fillRect(W.x, by, W.w, 16);
  }
  // windows
  let DR = null;
  if (door.side === face) {
    if (face === 'S') DR = { x: door.x - 24, y: b.y + b.h - 96, w: 48, h: 96 };
    else if (face === 'N') DR = { x: door.x - 24, y: b.y, w: 48, h: 96 };
    else DR = { x: face === 'E' ? b.x + b.w - 52 : b.x + 4, y: door.y - 76, w: 48, h: 96 };
  }
  const winTile = b.floors > 2 ? look.win4 : look.win, WS = 40;
  const vert = !horizWall;
  const rows = vert ? Math.max(1, Math.floor((W.h - 40) / 62)) : Math.max(1, Math.min(b.floors, Math.floor((W.h - 50) / 54)));
  const cols = vert ? Math.max(1, Math.floor((W.w - 20) / 56)) : Math.max(1, Math.floor((W.w - 20) / 62));
  const cw = (W.w - 20) / cols, ch = vert ? (W.h - 40) / rows : Math.min(58, (W.h - 50) / rows);
  const top = face === 'N' ? W.y + 24 : W.y + 44;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = W.x + 10 + c * cw + (cw - WS) / 2, y = top + r * ch + (ch - WS) / 2;
    if (y + WS > W.y + W.h - (horizWall ? 18 : 4)) continue;
    if (DR && x < DR.x + DR.w + 6 && x + WS > DR.x - 6 && y < DR.y + DR.h + 6 && y + WS > DR.y - 6) continue;
    drawTile(g, 'modern_city', winTile, x, y, WS, WS);
    if (dark > 0.3 && ((c * 7 + r * 3 + b.x) % 10) < 7) { g.fillStyle = 'rgba(255,209,102,0.55)'; g.fillRect(x + 6, y + 6, WS - 12, WS - 12); }
  }
  if (b.deco === 'ac') for (let c = 0; c < cols; c += 2) drawTile(g, 'modern_city', 545, W.x + 10 + c * cw + cw / 2 + 10, top - 4, 26, 26);
  const slide = kimg('../itch/doors');
  if (DR && slide && horizWall) {   // glass sliding doors that open as you walk up to them
    const near = S && Math.hypot(S.x - door.x, S.y - door.y) < 120 ? 1 : 0, now = performance.now();
    b._open = (b._open ?? 0) + (near - (b._open ?? 0)) * Math.min(1, (now - (b._openT || now)) / 160); b._openT = now;
    const f = Math.round(Math.max(0, Math.min(1, b._open)) * 4), dw = 70, dh = 58;
    const dx = door.x - dw / 2, dy = face === 'S' ? b.y + b.h - dh - 4 : b.y + 2;
    g.fillStyle = dark > 0.3 ? '#ffcf70' : '#1b1f2a'; g.fillRect(dx + 6, dy + 4, dw - 12, dh - 6);   // inside, seen through the opening
    g.drawImage(slide, 14, 6 + f * 32, 35, 29, dx, dy, dw, dh);
  } else if (DR) {
    const dv = !horizWall, dw = 46, dh = 66;   // one door tile, drawn tall
    const dx = dv ? DR.x : door.x - dw / 2, dy = face === 'S' ? b.y + b.h - dh - 4 : face === 'N' ? b.y + 2 : door.y - dh;
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(dx - 3, dy - 3, dw + 6, dh + 4);
    drawTile(g, 'modern_city', look.door[0], dx, dy, dw, dh);
    if (dark > 0.3) { g.fillStyle = 'rgba(255,207,112,0.35)'; g.fillRect(dx + 4, dy + 4, dw - 8, dh - 8); }
  }
  if (b.deco === 'awning' && horizWall) {
    const ay = face === 'S' ? W.y : W.y + W.h - 30;
    for (let x = W.x, i = 0; x < W.x + W.w; x += 32, i++) drawTile(g, 'modern_city', i % 2 ? 397 : 398, x, ay, Math.min(32, W.x + W.w - x), 30);
  }
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.strokeRect(W.x, W.y, W.w, W.h);
  // roof: 9-slice
  if (R.w > 0 && R.h > 0) {
    const RO = vert ? { x: R.x, y: R.y - 6, w: R.w, h: R.h + 12 } : { x: R.x - 6, y: R.y, w: R.w + 12, h: R.h };
    fillTiles(g, RO, 'modern_city', roof.fill);
    // parapet: a light rim with a darker inner line, like the pack's flat roofs
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 6; g.strokeRect(RO.x + 3, RO.y + 3, RO.w - 6, RO.h - 6);
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 2; g.strokeRect(RO.x + 8, RO.y + 8, RO.w - 16, RO.h - 16);
    const shade = { S: [RO.x, RO.y + RO.h - 8, RO.w, 8], N: [RO.x, RO.y, RO.w, 8], E: [RO.x + RO.w - 8, RO.y, 8, RO.h], W: [RO.x, RO.y, 8, RO.h] }[face];
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(...shade);
    if (b.deco && b.deco !== 'ac' && b.deco !== 'awning') { g.save(); g.beginPath(); g.rect(RO.x, RO.y, RO.w, RO.h); g.clip(); drawRoofDeco(g, { ...b, x: R.x, y: R.y, w: R.w, h: R.h, roof: R.h }, t); g.restore(); }
    g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2.5; g.strokeRect(RO.x, RO.y, RO.w, RO.h);
  }
  // entrance on a side the wall doesn't face: a small porch / side door
  if (!DR) {
    const doorFill = dark > 0.3 ? '#ffcf70' : '#2b1a10';
    g.fillStyle = '#4a2c1a';
    if (door.side === 'N' || door.side === 'S') {
      const py = door.side === 'N' ? b.y - 16 : b.y + b.h - 2;
      g.fillRect(door.x - 28, py, 56, 18); g.fillStyle = doorFill; g.fillRect(door.x - 22, py + 4, 44, 12);
    } else {
      const px = door.side === 'E' ? b.x + b.w - 4 : b.x - 10, py = Math.max(b.y + 4, door.y - 58);
      g.fillRect(px - 2, py - 4, 18, door.y - py + 2); g.fillStyle = doorFill; g.fillRect(px + 1, py, 12, door.y - py - 4);
      g.fillStyle = '#4a2c1a'; g.fillRect(px - 6, py - 10, 26, 7);
    }
  }
  g.restore();
  // name board (same as the drawn style)
  if (b.nameBoard !== false) {
    g.save(); g.globalAlpha = 1;
    g.font = 'bold 17px "Comic Neue", "Trebuchet MS", sans-serif';
    const tw = g.measureText(b.name).width + 24, nx = W.x + W.w / 2, ny = face === 'N' ? W.y + W.h - 36 : W.y + 8;
    g.fillStyle = '#1d3557'; roundRect(g, nx - tw / 2, ny, tw, 26, 5); g.fill();
    g.strokeStyle = '#f1faee'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#f1faee'; g.textAlign = 'center'; g.fillText(b.name, nx, ny + 19); g.textAlign = 'left';
    g.restore();
  }
  return true;
}

// ── Campus commute: college buses, staff cars, autos, a taxi and bikes ──────
// Vehicles drive in through the main gate or the back gate on the LEFT lane of the road (as in India), follow the road
// network to one of the parking lots, and pull forwards into an angled bay. People get out and walk
// to class. In the evening they walk back, get in, and the vehicle reverses out, straightens up and drives home.
//   • Steering is a real turning model (pure pursuit with a minimum turning radius), so corners are smooth arcs and
//     vehicles rotate to any angle — no more snapping between four sprites or sliding sideways into a bay.
//   • Every vehicle looks ahead along its own route and brakes for vehicles (moving or parked) and people.
//   • Art: hi-res vector vehicles from js/vehicle_art.js.
const TRAFFIC = { cars: [], plan: null, plans: [], bays: { car: [], bus: [] }, drive: null, gates: null, graph: null, vnav: null, highway: null, highwayAt: 0, highwayDir: 1 };
const tmin = (h, m = 0) => h * 60 + m;
const wrapA = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const MEDIAN_CLEARANCE = 38;
function segmentHitsMedian(ax, ay, bx, by, pad = 0) {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 8));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps, x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
    if (MEDIANS.some(m => x > m.x - pad && x < m.x + m.w + pad && y > m.y - pad && y < m.y + m.h + pad)) return true;
  }
  return false;
}

function findMainHighway() {
  const gate = TRAFFIC.gates && TRAFFIC.gates.main;
  if (!gate || !gate.freePosition || !gate.horiz || gate.side !== 'S') return null;
  // Prefer the real, map-wide horizontal road at the gate.  A newly-added narrow
  // gate-access strip is a connector, not a highway: it must not become the route
  // for through traffic, because that sends vehicles off-road at both world edges.
  const roads = ROADS.filter(r => r.w >= r.h && gate.outside.x >= r.x && gate.outside.x <= r.x + r.w);
  if (!roads.length) return null;
  const road = roads.sort((a, b) =>
    (b.w * b.h) - (a.w * a.h) ||
    Math.abs(a.y - gate.outside.y) - Math.abs(b.y - gate.outside.y)
  )[0];
  const verticalGap = gate.outside.y < road.y ? road.y - gate.outside.y
    : gate.outside.y > road.y + road.h ? gate.outside.y - (road.y + road.h) : 0;
  if (verticalGap > 220) return null;
  return { gate, road, y: road.y + road.h / 2, offset: Math.min(42, Math.max(18, road.h * 0.18)) };
}
const highwayLaneY = (direction) => TRAFFIC.highway.y - direction * TRAFFIC.highway.offset;

// Driving characteristics (world px, real seconds)
const VSPEC = {
  bus:     { Rmin: 88, cruise: 200, lot: 70, acc: 80, dec: 230, Ld: 62 },
  truck:   { Rmin: 72, cruise: 210, lot: 78, acc: 92, dec: 255, Ld: 58 },
  car:     { Rmin: 50, cruise: 260, lot: 92, acc: 145, dec: 320, Ld: 46 },
};

// ── Road network: the centreline of every road rectangle, joined where roads meet ──
function buildRoadGraph() {
  const nodes = [], keyOf = new Map();
  const node = (x, y) => { const k = Math.round(x / 4) + ',' + Math.round(y / 4); let i = keyOf.get(k); if (i === undefined) { i = nodes.length; nodes.push({ x, y, e: [] }); keyOf.set(k, i); } return i; };
  const link = (a, b, width, road = true) => {
    if (a === b) return;
    const A = nodes[a], B = nodes[b], d = Math.hypot(A.x - B.x, A.y - B.y);
    if (segmentHitsMedian(A.x, A.y, B.x, B.y, MEDIAN_CLEARANCE)) return;
    const cost = d * (width < 60 ? 3 : 1);   // keep traffic on the wide roads
    A.e.push({ to: b, cost, width, road }); B.e.push({ to: a, cost, width, road });
  };
  const lines = ROADS.map(r => r.w >= r.h
    ? { h: true, c: r.y + r.h / 2, a0: r.x, a1: r.x + r.w, width: r.h, at: [] }
    : { h: false, c: r.x + r.w / 2, a0: r.y, a1: r.y + r.h, width: r.w, at: [] });
  const t = 16;
  for (const A of lines) if (A.h) for (const B of lines) if (!B.h) {
    if (B.c >= A.a0 - B.width / 2 - t && B.c <= A.a1 + B.width / 2 + t && A.c >= B.a0 - A.width / 2 - t && A.c <= B.a1 + A.width / 2 + t) { A.at.push(B.c); B.at.push(A.c); }
  }
  for (const L of lines) {
    const lim = L.h ? WORLD_W : WORLD_H;
    let list = [Math.max(0, L.a0), Math.min(lim, L.a1), ...L.at].sort((a, b) => a - b);
    // ends that sit within a road's width of a junction merge into it
    const merged = [];
    for (const a of list) { if (merged.length && a - merged[merged.length - 1] < 24) { if (L.at.includes(a)) merged[merged.length - 1] = a; } else merged.push(a); }
    const ids = merged.map(a => L.h ? node(a, L.c) : node(L.c, a));
    for (let i = 1; i < ids.length; i++) link(ids[i - 1], ids[i], L.width);
  }
  return { nodes, node, link };
}
// Join a point to the nearest road centreline (splitting that stretch), returns the point's node.
// Split the nearest road stretch (at least minW wide) at the point closest to p; returns that road node (or null).
function splitRoadAt(G, p, minW = 0, maxD = Infinity, allowedRoads = null) {
  let best = null;
  for (let a = 0; a < G.nodes.length; a++) for (const e of G.nodes[a].e) {
    if (e.to < a || e.width < minW || !e.road || (allowedRoads && (!allowedRoads.has(a) || !allowedRoads.has(e.to)))) continue;
    const A = G.nodes[a], B = G.nodes[e.to], dx = B.x - A.x, dy = B.y - A.y, l2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((p.x - A.x) * dx + (p.y - A.y) * dy) / l2)), qx = A.x + dx * t, qy = A.y + dy * t, d = Math.hypot(p.x - qx, p.y - qy);
    if (segmentHitsMedian(p.x, p.y, qx, qy, MEDIAN_CLEARANCE)) continue;
    if (!best || d < best.d) best = { d, a, b: e.to, qx, qy, width: e.width };
  }
  if (!best || best.d > maxD) return null;
  const q = G.node(best.qx, best.qy);
  if (q !== best.a && q !== best.b) {   // split that stretch of road in two (drop the old, unsplit edge)
    const A = G.nodes[best.a], Bn = G.nodes[best.b];
    A.e = A.e.filter(e => e.to !== best.b); Bn.e = Bn.e.filter(e => e.to !== best.a);
    G.link(best.a, q, best.width); G.link(q, best.b, best.width);
  }
  return q;
}
// Join a point to the nearest road centreline (splitting that stretch), returns the point's node.
function attachToRoads(G, p, width = 64, allowedRoads = null) {
  const pn = G.node(p.x, p.y), q = splitRoadAt(G, p, 0, Infinity, allowedRoads);
  if (q !== null && q !== pn) G.link(pn, q, width, false);
  return pn;
}
function roadComponentFromAccess(G, access) {
  const seen = new Set(), queue = [], edges = G.nodes[access].e;
  for (const e of edges) {
    if (e.road) queue.push(e.to);
    else if (G.nodes[e.to].e.some(q => q.road)) queue.push(e.to);
  }
  while (queue.length) {
    const u = queue.pop();
    if (seen.has(u)) continue;
    seen.add(u);
    for (const e of G.nodes[u].e) if (e.road && !seen.has(e.to)) queue.push(e.to);
  }
  return seen;
}
// Shortest route s → g on roads at least minW wide, shifted onto the left lane for a vehicle of half-width halfW.
function roadPath(G, s, g, minW = 0, halfW = 0) {
  const N = G.nodes.length, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), via = new Array(N), done = new Uint8Array(N);
  dist[s] = 0;
  for (;;) {
    let u = -1, bd = Infinity;
    for (let i = 0; i < N; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
    if (u < 0 || u === g) break;
    done[u] = 1;
    for (const e of G.nodes[u].e) if (e.width >= minW && dist[u] + e.cost < dist[e.to]) { dist[e.to] = dist[u] + e.cost; prev[e.to] = u; via[e.to] = e; }
  }
  if (!isFinite(dist[g])) return minW > 0 ? roadPath(G, s, g, 0, halfW) : null;   // no wide enough way: squeeze through
  const pts = [], widths = [];
  for (let k = g; k !== -1; k = prev[k]) { pts.push({ x: G.nodes[k].x, y: G.nodes[k].y }); if (via[k]) widths.push(via[k].width); }
  pts.reverse(); widths.reverse();
  return lanePath(pts, widths, halfW);
}
const edgeWidth = (G, a, b) => { const e = G.nodes[a].e.find(e => e.to === b); return e ? e.width : 64; };
// Like roadPath, but never turns round in the road (only at a dead end) and can end at any of several goal nodes.
// Works on (node, came-from) states. extra(goal, cameFrom) adds a cost on arrival (used to prefer the kerb side).
function routeNoUturn(G, s, p0, goals, minW, extra) {
  const N = G.nodes.length + 1, key = (u, p) => u * N + (p + 1);
  const dist = new Map(), prev = new Map(), open = new Map(), k0 = key(s, p0);
  dist.set(k0, 0); open.set(k0, 0);
  let best = -1, bestCost = Infinity;
  while (open.size) {
    let bk = -1, bd = Infinity;
    for (const [k, d] of open) if (d < bd) { bd = d; bk = k; }
    open.delete(bk);
    if (bd >= bestCost) break;
    const u = Math.floor(bk / N), p = bk % N - 1;
    if (goals.has(u) && bk !== k0) { const c = bd + (extra ? extra(u, p) : 0); if (c < bestCost) { bestCost = c; best = bk; } }
    const deg = G.nodes[u].e.filter(e => e.width >= minW).length;
    for (const e of G.nodes[u].e) {
      if (e.width < minW) continue;
      let c = e.cost;
      if (e.to === p) { if (deg > 1) continue; c += 4000; }
      const nk = key(e.to, u), nd = bd + c;
      if (nd < (dist.has(nk) ? dist.get(nk) : Infinity)) { dist.set(nk, nd); prev.set(nk, bk); open.set(nk, nd); }
    }
  }
  if (best < 0) return null;
  const nodes = [];
  for (let k = best; k !== undefined; k = prev.get(k)) nodes.push(Math.floor(k / N));
  nodes.reverse();
  return { nodes, cost: bestCost, end: Math.floor(best / N), from: best % N - 1 };
}
// Shift a centreline route onto the left-hand lane; corners meet where the shifted lines cross.
// Shift a centreline route onto the left-hand lane; corners meet where the shifted lines cross.
// halfW: half the vehicle's width — on roads wide enough for two of it, it keeps fully to its own side.
function lanePath(pts, widths, halfW = 0) {
  const P = [], Wd = [], keep = [];
  for (let i = 0; i < pts.length; i++) {
    if (P.length && Math.hypot(pts[i].x - P[P.length - 1].x, pts[i].y - P[P.length - 1].y) < 1) { Object.assign(keep[keep.length - 1], pts[i].tag || {}); continue; }
    if (P.length) Wd.push(widths[i - 1]);
    P.push(pts[i]); keep.push({ ...(pts[i].tag || {}) });
  }
  if (P.length < 2) return P.map((p, i) => ({ x: p.x, y: p.y, ...keep[i] }));
  const offOf = (w) => { const o = Math.max(6, Math.min(24, w * 0.23)); return halfW && w >= 4 * halfW ? Math.max(o, halfW + 2.5) : o; };
  const seg = (i) => {
    const a = P[i], b = P[i + 1], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    const nx = dy / l, ny = -dx / l, baseOff = offOf(Wd[i]);   // left of the direction of travel (screen y points down)
    const clearance = halfW + 26;
    let side = segmentHitsMedian(a.x + nx * baseOff, a.y + ny * baseOff, b.x + nx * baseOff, b.y + ny * baseOff, clearance) ? -1 : 1;
    if (side < 0 && segmentHitsMedian(a.x - nx * baseOff, a.y - ny * baseOff, b.x - nx * baseOff, b.y - ny * baseOff, clearance)) side = 0;
    const off = baseOff * side;
    return { ax: a.x + nx * off, ay: a.y + ny * off, bx: b.x + nx * off, by: b.y + ny * off, dx: dx / l, dy: dy / l };
  };
  const out = [];
  let s0 = seg(0); out.push({ x: s0.ax, y: s0.ay, ...keep[0] });
  for (let i = 1; i < P.length - 1; i++) {
    const s1 = seg(i), cr = s0.dx * s1.dy - s0.dy * s1.dx;
    if (Math.abs(cr) < 0.05) out.push({ x: s1.ax, y: s1.ay, ...keep[i] });
    else { const t = ((s1.ax - s0.ax) * s1.dy - (s1.ay - s0.ay) * s1.dx) / cr; out.push({ x: s0.ax + s0.dx * t, y: s0.ay + s0.dy * t, ...keep[i] }); }
    s0 = s1;
  }
  out.push({ x: s0.bx, y: s0.by, ...keep[P.length - 1] });
  return out;
}

// ── College buses stop outside the department blocks to let students off, then go and park ──
const BUS_STOP_BLOCKS = [/\bece\b/i, /\bcse\b/i, /\bmech/i, /\bcivil\b/i];
function findBusStops(G, minW) {
  const out = [], MIN_J = 270;   // world px of straight road a bus wants before a stop
  for (const re of BUS_STOP_BLOCKS) {
    const b = BUILDINGS.find(b => re.test(b.name || '') || re.test(b.id || ''));
    if (!b) continue;
    const d = doorInfo(b);
    // the road stretch nearest the door
    let best = null;
    for (let a = 0; a < G.nodes.length; a++) for (const e of G.nodes[a].e) {
      if (e.to < a || e.width < minW || !e.road) continue;
      const A = G.nodes[a], B = G.nodes[e.to], dx = B.x - A.x, dy = B.y - A.y, l2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((d.x - A.x) * dx + (d.y - A.y) * dy) / l2)), dd = Math.hypot(d.x - A.x - dx * t, d.y - A.y - dy * t);
      if (!best || dd < best.dd) best = { dd, a, b: e.to, t };
    }
    if (!best || best.dd > 320) continue;
    const A = G.nodes[best.a], B = G.nodes[best.b], len = Math.hypot(B.x - A.x, B.y - A.y) || 1;
    const isJ = (n) => n.e.filter(e => e.width >= minW).length >= 3;   // footpaths joining don't count
    // where along this stretch the building's frontage runs (keep the whole bus beside it if possible)
    const proj = (x, y) => ((x - A.x) * (B.x - A.x) + (y - A.y) * (B.y - A.y)) / (len * len);
    const ts = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].map(([x, y]) => proj(x, y));
    const f0 = Math.max(0, Math.min(...ts)), f1 = Math.min(1, Math.max(...ts));
    let lo = isJ(A) ? MIN_J / len : 0, hi = isJ(B) ? 1 - MIN_J / len : 1;
    let t = best.t;
    if (lo <= hi) t = Math.max(lo, Math.min(hi, t));
    if (t < f0 || t > f1) t = Math.max(f0, Math.min(f1, t));   // never slide past the building itself
    const p = { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
    const q = splitRoadAt(G, p, minW, 40);
    if (q === null) continue;
    out.push({ name: b.name, b, door: { x: d.x, y: d.y }, node: q });
  }
  return out;
}
// Best order to visit the stops from a gate and then reach the lot: no U-turns, and stopping with the
// block on the kerb (left) side is strongly preferred so nobody has to cross the road.
function planBusRoute(G, startNode, stops, lotNode, minW) {
  if (!stops.length) return null;
  const byNode = new Map(stops.map(st => [st.node, st]));
  const kerb = (u, p) => {
    const st = byNode.get(u); if (!st || p < 0) return 0;
    const A = G.nodes[p], B = G.nodes[u], dx = B.x - A.x, dy = B.y - A.y;
    return ((st.door.x - B.x) * dy - (st.door.y - B.y) * dx) > 0 ? 0 : 6000;   // left of travel = (dy, -dx)
  };
  const perms = (a) => a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(r => [x, ...r]));
  let best = null;
  for (const order of perms(stops)) {
    let at = startNode, from = -1, cost = 0, nodes = [startNode], ok = true;
    const marks = [];
    for (const st of [...order, null]) {
      const r = routeNoUturn(G, at, from, new Set([st ? st.node : lotNode]), minW, st ? kerb : null);
      if (!r) { ok = false; break; }
      cost += r.cost; if (best && cost >= best.cost) { ok = false; break; }
      nodes.push(...r.nodes.slice(1)); at = r.end; from = r.from;
      if (st) marks.push({ i: nodes.length - 1, st });
    }
    if (ok && (!best || cost < best.cost)) best = { cost, nodes, marks, order };
  }
  return best;
}
function busRoadPath(v) {
  const T = TRAFFIC, G = T.graph, R = v.busRoute;
  if (!R) return null;
  const pts = R.nodes.map(k => ({ x: G.nodes[k].x, y: G.nodes[k].y }));
  for (const m of R.marks) if (v.delivery) pts[m.i] = { ...pts[m.i], tag: { stop: 15, busStop: m.st.node } };   // unloading crates
  else if (v.people.some(p => !p.arrived && p.busStop === m.st.node)) pts[m.i] = { ...pts[m.i], tag: { stop: 2, busStop: m.st.node } };   // only where someone gets off
  const widths = [];
  for (let i = 1; i < R.nodes.length; i++) widths.push(edgeWidth(G, R.nodes[i - 1], R.nodes[i]));
  return lanePath(pts, widths, v.W / 2);
}

// ── who comes by what ──
let VID = 0;
function makeVehicle(kind, opt) {
  const v = Object.assign({
    id: ++VID, kind, people: [], driver: null, state: 'pending', path: null, pi: 1, x: -999, y: -999, ang: 0, v: 0,
    alpha: 1, unloadT: 0, holdT: 0, stopT: 0, beeped: false, ghostT: 0, blockT: 0, on: false, sortY: 0, color: '', braking: false, rev: false,
  }, opt);
  if (!v.model) v.model = kind === 'bus' ? 'bus' : VehicleArt.CAR_MODELS[(Math.random() * VehicleArt.CAR_MODELS.length) | 0];
  if (!v.color) v.color = v.model === 'bus' ? (Math.random() < 0.7 ? '#f2b705' : '#2f6fb3')
    : v.model === 'truck' ? '#b08050' : v.model === 'van' ? '#d8d2b8'
    : v.model === 'police' ? '#f3f4f6' : v.model === 'taxi' ? '#f5c518'
    : VehicleArt.CAR_PAINTS[(Math.random() * VehicleArt.CAR_PAINTS.length) | 0];
  const sz = VehicleArt.size(v.model); v.L = sz.L; v.W = sz.W;
  v.spec = VSPEC[v.model === 'truck' ? 'truck' : kind] || VSPEC.car;
  TRAFFIC.cars.push(v);
  return v;
}
function takeBay(kind) {
  const free = TRAFFIC.bays[kind].filter(b => !b.taken);
  if (!free.length) return null;
  free[0].taken = true; return free[0];
}
function spawnThroughTraffic(direction) {
  const model = VehicleArt.CAR_MODELS[(Math.random() * VehicleArt.CAR_MODELS.length) | 0];
  const v = makeVehicle('car', { model, highwayTraffic: true, state: 'out' });
  const y = highwayLaneY(direction), margin = v.L / 2 + 24;
  const start = direction > 0 ? -margin : WORLD_W + margin, end = direction > 0 ? WORLD_W + margin : -margin;
  v.path = [{ x: start, y }, { x: end, y }];
  v.pi = 1; v.x = start; v.y = y; v.ang = direction > 0 ? 0 : Math.PI;
  v.v = v.spec.cruise * 0.68; v.on = true; v.alpha = 0;
}
function spawnHighwayArrival(direction) {
  if (!TRAFFIC.highway) return false;
  const bay = takeBay('car');
  if (!bay) return false;
  const model = VehicleArt.CAR_MODELS[(Math.random() * VehicleArt.CAR_MODELS.length) | 0];
  const v = makeVehicle('car', {
    model, gate: TRAFFIC.highway.gate, arriveAt: S.min, departAt: S.min + 24 + Math.random() * 12,
    bay, highwayTraffic: true, highwayEntry: { direction },
  });
  return true;
}
function updateHighwayTraffic() {
  if (!TRAFFIC.highway || S.min < tmin(6, 30) || S.min >= tmin(20) || S.min < TRAFFIC.highwayAt) return;
  const direction = TRAFFIC.highwayDir;
  TRAFFIC.highwayDir = -direction;
  if (!(Math.random() < 0.25 && spawnHighwayArrival(direction))) spawnThroughTraffic(direction);
  TRAFFIC.highwayAt = S.min + 10 + Math.random() * 6;
}
function buildTraffic() {
  TRAFFIC.cars = []; TRAFFIC.busRoutes = null; TRAFFIC.bays = { car: [], bus: [] };
  TRAFFIC.gates = { main: gateInfo(GATE, WORLD_W, WORLD_H), back: backGateInfo(getBackGate(), WORLD_W, WORLD_H) };
  const M = TRAFFIC.gates.main;
  M.inside = { x: M.exit.x, y: M.exit.y - (!M.freePosition && M.side === 'S' ? 40 : 0) };
  M.outside = M.freePosition
    ? { N: { x: M.exit.x, y: M.exit.y - 60 }, S: { x: M.exit.x, y: M.exit.y + 60 }, E: { x: M.exit.x + 60, y: M.exit.y }, W: { x: M.exit.x - 60, y: M.exit.y } }[M.side]
    : { N: { x: M.exit.x, y: -60 }, S: { x: M.exit.x, y: WORLD_H + 60 }, E: { x: WORLD_W + 60, y: M.exit.y }, W: { x: -60, y: M.exit.y } }[M.side];
  const B = TRAFFIC.gates.back;
  B.outside = { x: B.inside.x + (B.outside.x - B.inside.x) * 2.5, y: B.inside.y + (B.outside.y - B.inside.y) * 2.5 };
  TRAFFIC.highway = findMainHighway();
  TRAFFIC.plans = parkingAreas().map(P => parkingPlan(P, ROADS));
  TRAFFIC.plan = TRAFFIC.plans[0];
  TRAFFIC.drive = TRAFFIC.plans.map(p => lotDriveway(p, ROADS));
  for (const p of TRAFFIC.plans) for (const kind of ['car', 'bus']) {
    for (const bay of p.bays[kind]) { bay.plan = p; TRAFFIC.bays[kind].push(bay); }
  }
  // Connect gates to roads that can actually reach the parking entrance.
  const G = TRAFFIC.graph = buildRoadGraph();
  for (const p of TRAFFIC.plans) p.node = attachToRoads(G, p.entry, 110);
  TRAFFIC.nLot = TRAFFIC.plan.node;
  for (const gt of [M, B]) {
    const connectedRoads = roadComponentFromAccess(G, TRAFFIC.nLot);
    const i = attachToRoads(G, gt.inside, 120, connectedRoads);
    const o = G.node(gt.outside.x, gt.outside.y);
    G.link(o, i, 120, false);
    gt.nOut = o;
  }
  TRAFFIC.busStops = findBusStops(G, 50);
  { const cb = BUILDINGS.find(b => /canteen/i.test(b.name || '') || b.id === 'canteen'); const d = cb && doorInfo(cb);
    const q = d ? splitRoadAt(G, d, 50, 420) : null; TRAFFIC.canteenStop = q === null ? null : { name: cb.name, b: cb, door: { x: d.x, y: d.y }, node: q }; }
  TRAFFIC.vnav = true;

  const sunday = weekday(S.day) === 6, now = S.min;
  TRAFFIC.highwayAt = Math.max(now + 2, tmin(6, 45));
  TRAFFIC.highwayDir = 1;
  const id = (k) => npcs.find(n => n.id === k);
  for (const n of npcs) if (n.commuter) {
    n.vehicle = null; n.arrived = false; n.boarded = false; n.spawnInZone = false; n.spawnAt = null;
    n.leaveAt = 99; n.classB = null; n.inClass = false; n.busStop = null;
    const dayIndex = n.kind === 'day' ? Number(n.id.slice(3)) : -1;
    n.walkingDayScholar = !sunday && n.kind === 'day' && dayIndex % 5 === 0;
    n.busRider = n.commuter && !n.walkingDayScholar && (/^bus\d/.test(n.id) || ['student16', 'student17', 'student18', 'student19'].includes(n.id));
    if (n.walkingDayScholar) {
      n.walkArrivalAt = tmin(7, 35) + (dayIndex % 6) * 5;
      n.walkLeaveAt = tmin(17, 10) + (dayIndex % 6) * 5;
      n.leaveAt = n.walkLeaveAt / 60;
    }
    n.walkArrivalDone = false; n.walkRoute = null; n.walkTarget = null;
  }
  const ride = (v, people, driver) => {
    for (const p of people) if (p) { v.people.push(p); p.vehicle = v; p.leaveAt = (v.departAt - (v.kind === 'bus' ? 50 : 20)) / 60; }
    v.driver = driver || null;
  };
  const { main, back } = TRAFFIC.gates;
  // Keep overnight display cars only when the lot has spare capacity.
  const staticCars = TRAFFIC.bays.car.length >= 11 ? 2 : 0;
  for (let i = 0; i < staticCars; i++) {
    const list = TRAFFIC.bays.car, bay = list[list.length - 1 - i]; if (!bay || bay.taken) break; bay.taken = true;
    makeVehicle('car', { state: 'parked', static: true, bay, x: bay.cx, y: bay.cy, ang: bay.ang, model: i ? 'suv' : 'sedan' });
  }
  // staff cars
  const cars = [['librarian', 7, 40, back, 22, 10], ['prof', 8, 10, main, 18, 0]];
  ['staff0', 'staff1', 'staff2', 'staff3'].forEach((k, i) => cars.push([k, 7, 50 + i * 15, i % 2 ? back : main, 17, 10 + i * 10]));
  for (const [k, ah, am, gate, dh, dm] of cars) {
    const n = id(k); if (!n || (sunday && k !== 'librarian')) continue;
    const bay = takeBay('car');
    const v = makeVehicle('car', { gate, arriveAt: tmin(ah, am), departAt: tmin(dh, dm), bay, dropOff: !bay, model: k === 'prof' ? 'sedan' : undefined });
    if (gate === main && TRAFFIC.highway) v.highwayEntry = { direction: v.id % 2 ? 1 : -1 };
    ride(v, [n], n);
  }
  // two students come by car / taxi: dropped off in the lot, they walk out of the gate in the evening
  if (!sunday) ['student16', 'student17'].forEach((k, i) => {
    const n = id(k); if (!n || n.vehicle) return;
    const bay = takeBay('car');
    const v = makeVehicle('car', { model: i ? 'taxi' : 'hatch', gate: i ? back : main, arriveAt: tmin(8, 20 + i * 25), departAt: tmin(17, 0), bay, dropOff: !bay });
    if (v.gate === main && TRAFFIC.highway) v.highwayEntry = { direction: i % 2 ? -1 : 1 };
    ride(v, [n]); n.busRider = false;
  });
  // college buses between 8:30 and 9:15, leaving one bus bay for the canteen truck, riders shared out between them
  if (!sunday) {
    const pax = npcs.filter(n => n.commuter && n.busRider && !n.vehicle);
    const busBays = TRAFFIC.bays.bus.length;
    const nBus = Math.max(1, Math.min(10, busBays > 1 ? busBays - 1 : busBays)), per = Math.ceil(pax.length / nBus);
    for (let i = 0; i < nBus; i++) {
      const bay = takeBay('bus');
      const v = makeVehicle('bus', { gate: TRAFFIC.busStops && TRAFFIC.busStops.length ? back : (i % 2 ? back : main), arriveAt: tmin(8, 30) + i * 4.5, departAt: tmin(16, 30) + i * 4.5, bay, dropOff: !bay });
      ride(v, pax.slice(i * per, i * per + per));
      assignBusStops(v);
    }
  }
  if (!sunday) {
    const tb = takeBay('bus');
    makeVehicle('bus', { model: 'truck', gate: back, arriveAt: tmin(10, 30), departAt: tmin(11, 10), bay: tb, dropOff: !tb });
  }
  { const pb = takeBay('car'); const v = makeVehicle('car', { model: 'police', gate: main, arriveAt: tmin(13, 0), departAt: tmin(13, 35), bay: pb, dropOff: !pb });
    if (TRAFFIC.highway) v.highwayEntry = { direction: 1 }; }

  // loading a save in the middle of the day: put everything where it should be by now
  for (const v of TRAFFIC.cars) {
    if (v.static) continue;
    if (v.dropOff && now >= v.arriveAt) { v.state = 'gone'; for (const p of v.people) { p.arrived = true; p.spawnInZone = true; if (now / 60 >= p.leaveAt) p.boarded = true; } continue; }
    if (now >= v.arriveAt && now < v.departAt + 70) {
      v.state = 'parked'; v.x = v.bay.cx; v.y = v.bay.cy; v.ang = v.bay.ang; v.unloadT = 99;
      for (const p of v.people) { p.arrived = true; p.spawnInZone = true; if (now / 60 >= p.leaveAt) p.boarded = true; }
    } else if (now >= v.departAt + 70) { v.state = 'gone'; for (const p of v.people) { p.arrived = true; p.boarded = true; } }
  }
}
function assignBusStops(v) {
  const T = TRAFFIC, stops = T.busStops || [];
  if (!stops.length || !v.gate) return;
  const plan = v.bay && v.bay.plan || T.plan, lotNode = plan.node;
  T.busRoutes = T.busRoutes || new Map();
  const key = `${v.gate.nOut}:${lotNode}`;
  if (!T.busRoutes.has(key)) T.busRoutes.set(key, planBusRoute(T.graph, v.gate.nOut, stops, lotNode, Math.max(50, v.W + 2)));
  v.busRoute = T.busRoutes.get(key);
  if (!v.busRoute) return;
  const h = v.arriveAt / 60 + 0.25, hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  for (const p of v.people) {
    // most riders have morning lectures in one of the department blocks: dropped at that block, they go to class
    p.skipClass = (hash(p.id + S.day) % 100) < 25;
    if (!p.skipClass) { const st = stops[hash(p.id) % stops.length]; p.busStop = st.node; p.classB = st.b; continue; }
    p.classB = null;
    let z = null; try { z = (p.sched && p.sched(h + (p.jit || 0))) || p.stayZone; } catch (e) { z = null; }
    const zr = z && ZONES[z], tx = zr ? zr.x + zr.w / 2 : stops[stops.length - 1].door.x, ty = zr ? zr.y + zr.h / 2 : stops[stops.length - 1].door.y;
    let best = null, bd = Infinity;
    for (const st of stops) { const d = Math.hypot(st.door.x - tx, st.door.y - ty); if (d < bd) { bd = d; best = st; } }
    p.busStop = best.node;
  }
}
const vehicleDoor = (v) => v && v.bay && !v.dropOff ? { x: v.bay.aisle.x, y: v.bay.aisle.y } : GATE_EXIT;   // auto / taxi riders walk out of the gate

// ── routes ──
function arrivalPath(v) {
  const T = TRAFFIC, plan = v.bay && v.bay.plan || T.plan, Ln = plan.lines;
  if (v.delivery) return v.busRoute ? busRoadPath(v) : null;   // there and straight back out of the gate
  if (v.kind === 'bus' && !v.bay) {
    const inbound = (v.busRoute && busRoadPath(v)) || roadPath(T.graph, v.gate.nOut, plan.node, v.W + 2, v.W / 2);
    const outbound = roadPath(T.graph, plan.node, v.gate.nOut, v.W + 2, v.W / 2);
    return inbound && outbound ? [...inbound.slice(0, -1), ...outbound.slice(1)] : null;
  }
  const road = (v.busRoute && busRoadPath(v)) || roadPath(T.graph, v.gate.nOut, plan.node, v.W + 2, v.W / 2); if (!road) return null;
  const pts = road.slice(0, -1).map(p => ({ ...p }));
  const lot = Ln.loop.map((p, i) => ({ ...p, slow: i < 2, mid: i >= 2 }));   // crawl through the entrance, brisk up the aisle
  let path;
  if (v.dropOff) {   // stop by the in lane, let people out, then round the loop and out again
    const drop = Ln.inAt(150);
    path = [...pts, { ...lot[0] }, { ...lot[1] }, { x: drop.x, y: drop.y, slow: true, stop: 2.5, drop: true }, ...lot.slice(2), ...exitPath(v, plan.aisle.Vc - 160)];
  } else {
    const enter = v.bay.enter, v0 = Ln.vOf(enter[0]);
    // in-lane bays: straight up the in lane and in; out-lane bays: round the loop first
    const loop = v.bay.loc.noseUp ? lot.filter((p, i) => i < 2 && Ln.vOf(p) < v0 - 10)
      : lot.filter((p, i) => i < lot.length - 1 || (!v.bay.direct && Ln.vOf(p) > v0 + 10));
    path = [...pts, ...loop, ...enter.map((p, i) => ({ ...p, slow: !(v.bay.direct && i === 0), mid: v.bay.direct && i === 0 }))];
  }
  if (!v.highwayEntry || !T.highway) return path;
  const direction = v.highwayEntry.direction, laneY = highwayLaneY(direction);
  const margin = v.L / 2 + 24, startX = direction > 0 ? -margin : WORLD_W + margin;
  const turnX = T.highway.gate.outside.x - direction * Math.max(110, v.spec.Rmin * 1.8);
  const gatePoint = path[0];
  if (v.dropOff) {
    const last = path[path.length - 1], endX = direction > 0 ? WORLD_W + margin : -margin;
    path = [...path, { x: last.x, y: laneY }, { x: endX, y: laneY }];
  }
  return [{ x: startX, y: laneY }, { x: turnX, y: laneY }, { x: gatePoint.x, y: laneY }, ...path];
}
function exitPath(v, fromV, plan = v.bay && v.bay.plan || TRAFFIC.plan) {
  const T = TRAFFIC, Ln = plan.lines;
  const lane = [];
  for (let s = fromV - 80; s > 60; s -= 160) lane.push({ ...Ln.outAt(s), mid: true });
  const road = roadPath(T.graph, plan.node, v.gate.nOut, v.W + 2, v.W / 2) || [];
  return [...lane, ...Ln.exit.map(p => ({ ...p, slow: true })), ...road.slice(1)];
}
function departurePath(v) {
  const b = v.bay, plan = b.plan;
  // near-parallel bays: drive out forwards if nothing is parked in the bay ahead, else reverse out
  let path;
  if (b.leaveFwd) {
    const list = plan.bays[b.kind], i = list.indexOf(b), ahead = list[i - 1];
    const blocked = ahead && TRAFFIC.cars.some(o => o !== v && o.on && o.bay === ahead && o.state === 'parked');
    if (!blocked) path = [...b.leaveFwd.map(p => ({ ...p, slow: true })), ...exitPath(v, b.vLaneFwd)];
  }
  if (!path) {
    const rev = b.leave.map(p => ({ ...p, rev: true, slow: true }));
    if (b.loc.noseUp) {   // backed out pointing up the lot: carry on up the in lane, round the loop and out
      const Ln = plan.lines, A = plan.aisle;
      const loop = Ln.loop.slice(2).map((p, i) => ({ ...p, mid: true })).filter((p, i) => i > 0 || Ln.vOf(p) > b.vLane + 30);
      path = [...rev, ...loop, ...exitPath(v, A.Vc - 150, plan)];
    } else path = [...rev, ...exitPath(v, b.vLane, plan)];
  }
  if (!v.highwayEntry || !TRAFFIC.highway) return path;
  const direction = v.highwayEntry.direction, laneY = highwayLaneY(direction), last = path[path.length - 1];
  const endX = direction > 0 ? WORLD_W + v.L / 2 + 24 : -v.L / 2 - 24;
  return [...path, { x: last.x, y: laneY }, { x: endX, y: laneY }];
}
// Round off the corners of a forward route into arcs the vehicle can actually drive (radius ≈ its turning circle),
// so long vehicles start turning early instead of overshooting a sharp corner. Bay manoeuvres, reversing and stop
// points are left exactly as they are.
function filletPath(P, R) {
  const fixed = (p) => p.rev || p.stop || p.drop || p.slow;
  // drop points in the middle of a straight line (same flags as the next point), so corners get the room they need
  const Q = [P[0]];
  for (let i = 1; i < P.length - 1; i++) {
    const a = Q[Q.length - 1], b = P[i], c = P[i + 1];
    const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x), l = Math.hypot(b.x - a.x, b.y - a.y) * Math.hypot(c.x - b.x, c.y - b.y);
    if (!fixed(b) && !b.mid === !c.mid && !b.slow === !c.slow && l > 0 && Math.abs(cr) / l < 0.03 && (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y) > 0) continue;
    Q.push(b);
  }
  Q.push(P[P.length - 1]);
  const out = [Q[0]];
  let used = 0;   // how much of the incoming segment the previous arc already took
  for (let i = 1; i < Q.length - 1; i++) {
    const a = Q[i - 1], b = Q[i], c = Q[i + 1];
    const l1 = Math.hypot(b.x - a.x, b.y - a.y), l2 = Math.hypot(c.x - b.x, c.y - b.y);
    if (fixed(b) || fixed(c) && c.rev || l1 < 1 || l2 < 1) { out.push(b); used = 0; continue; }
    const d1x = (b.x - a.x) / l1, d1y = (b.y - a.y) / l1, d2x = (c.x - b.x) / l2, d2y = (c.y - b.y) / l2;
    const th = Math.acos(Math.max(-1, Math.min(1, d1x * d2x + d1y * d2y)));
    if (th < 0.12 || th > 2.6) { out.push(b); used = 0; continue; }
    const nextCorner = i + 1 < Q.length - 1 && !fixed(c);
    let t = Math.min(R * Math.tan(th / 2), (l1 - used) * 0.95, l2 * (nextCorner ? 0.5 : 0.95));
    if (t < 4) { out.push(b); used = 0; continue; }
    const r = t / Math.tan(th / 2), sgn = Math.sign(d1x * d2y - d1y * d2x);
    const sx = b.x - d1x * t, sy = b.y - d1y * t, cx = sx - d1y * r * sgn, cy = sy + d1x * r * sgn;
    const a0 = Math.atan2(sy - cy, sx - cx), n = Math.max(2, Math.ceil(r * th / 14));
    for (let k = 0; k <= n; k++) {
      const an = a0 + sgn * th * k / n;
      out.push({ x: cx + Math.cos(an) * r, y: cy + Math.sin(an) * r, mid: b.mid, arc: true });
    }
    used = t;
  }
  out.push(Q[Q.length - 1]);
  return out;
}
function startRoute(v, out) {
  const raw = out ? departurePath(v) : arrivalPath(v);
  const axl = v.L * (v.kind === 'bus' ? 0.24 : 0);   // the rear axle must be able to follow the arc, too
  const path = raw && raw.length > 2 ? filletPath(raw, Math.hypot(v.spec.Rmin, axl) * 1.12) : raw;
  if (!path || path.length < 2) { v.state = 'gone'; return; }
  if (!out) {
    v.x = path[0].x; v.y = path[0].y; v.ang = Math.atan2(path[1].y - path[0].y, path[1].x - path[0].x); v.v = v.spec.cruise * 0.6;
  } else v.v = 0;
  const full = [{ x: v.x, y: v.y, rev: path[0].rev }];
  for (const p of path) { const q = full[full.length - 1]; if (Math.hypot(p.x - q.x, p.y - q.y) < 1.5 && !!p.rev === !!q.rev && !p.stop) continue; full.push(p); }
  v.path = full;
  v.pi = 1; v.state = out ? 'out' : 'in'; v.holdT = 0; v._parkedSort = false;
}

// ── shapes ──

// A vehicle's footprint is its exact rotated rectangle (L × W, centred on x, y, facing ang).
// Oriented-box overlap by the separating-axis test.
function obbOverlap(ax, ay, aa, al, aw, bx, by, ba, bl, bw) {
  const dx = bx - ax, dy = by - ay, c1 = Math.cos(aa), s1 = Math.sin(aa), c2 = Math.cos(ba), s2 = Math.sin(ba);
  const cu = Math.abs(c1 * c2 + s1 * s2), cv = Math.abs(s1 * c2 - c1 * s2);
  if (Math.abs(dx * c1 + dy * s1) > al + bl * cu + bw * cv) return false;
  if (Math.abs(-dx * s1 + dy * c1) > aw + bl * cv + bw * cu) return false;
  if (Math.abs(dx * c2 + dy * s2) > bl + al * cu + aw * cv) return false;
  if (Math.abs(-dx * s2 + dy * c2) > bw + al * cv + aw * cu) return false;
  return true;
}
const vehHit = (a, x, y, ang, b) => obbOverlap(x, y, ang, a.L / 2, a.W / 2, b.x, b.y, b.ang, b.L / 2, b.W / 2);
// Signed distance from a point to a box (negative inside).
function boxDist(cx, cy, ang, hl, hw, px, py) {
  const dx = px - cx, dy = py - cy, ca = Math.cos(ang), sa = Math.sin(ang);
  const ex = Math.abs(dx * ca + dy * sa) - hl, ey = Math.abs(-dx * sa + dy * ca) - hw;
  return Math.hypot(Math.max(ex, 0), Math.max(ey, 0)) + Math.min(Math.max(ex, ey), 0);
}
const PERSON_R = 9;   // a person's footprint (feet), world px
const personGap = (v, p) => boxDist(v.x, v.y, v.ang, v.L / 2, v.W / 2, p.x, p.y) - PERSON_R;
function vehicleRect(v) {
  const ca = Math.abs(Math.cos(v.ang)), sa = Math.abs(Math.sin(v.ang)), w = v.L * ca + v.W * sa, h = v.L * sa + v.W * ca;
  return { x: v.x - w / 2, y: v.y - h / 2, w, h };
}
function pointOnPavedVehicleSurface(px, py) {
  if (ROADS.some(r => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h)) return true;
  if (typeof parkingAreas === 'function') return parkingAreas().some(p => px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h);
  return false;
}
function vehicleOnPavedSurface(v, x, y, ang) {
  // Check the oriented footprint itself, not just its centre.  Parking lots are
  // the sole allowed exception to the ROAD requirement.
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let iy = -3; iy <= 3; iy++) for (let ix = -3; ix <= 3; ix++) {
    const px = x + ca * (ix * v.L / 6) - sa * (iy * v.W / 6);
    const py = y + sa * (ix * v.L / 6) + ca * (iy * v.W / 6);
    if (px < 0 || px > WORLD_W || py < 0 || py > WORLD_H) continue;
    if (!pointOnPavedVehicleSurface(px, py)) return false;
  }
  return true;
}
// Every vehicle on the campus is solid for the player and people walking — parked or moving.
// (fx, fy) = where the walker is now: someone already touching a vehicle may always step away from it.
function vehicleBlocks(x, y, fx, fy) {
  for (const v of TRAFFIC.cars) {
    if (!v.on || v.alpha < 0.5) continue;
    if (Math.abs(x - v.x) > v.L / 2 + 20 || Math.abs(y - v.y) > v.L / 2 + 20) continue;
    const d = boxDist(v.x, v.y, v.ang, v.L / 2, v.W / 2, x, y);
    if (d >= PERSON_R) continue;
    if (fx !== undefined && d > boxDist(v.x, v.y, v.ang, v.L / 2, v.W / 2, fx, fy)) continue;
    return true;
  }
  return false;
}
// Would the vehicle at pose (x, y, ang) touch anything it isn't already touching? Returns the blocker.
// This is the hard rule: a give-way only relaxes the cautious look-ahead, never this.
function poseBlocked(v, x, y, ang, people) {
  if (!vehicleOnPavedSurface(v, x, y, ang)) return { offroad: true };
  for (const m of MEDIANS) {
    if (obbOverlap(x, y, ang, v.L / 2, v.W / 2, m.x + m.w / 2, m.y + m.h / 2, 0, m.w / 2, m.h / 2)) return { median: m };
  }
  for (const o of TRAFFIC.cars) {
    if (o === v || !o.on || o.state === 'gone' || o.alpha <= 0) continue;
    if (ghosting(v, o)) continue;
    const lim = (v.L + o.L) / 2 + 4;
    if (Math.abs(o.x - x) > lim || Math.abs(o.y - y) > lim) continue;
    if (vehHit(v, x, y, ang, o) && !vehHit(v, v.x, v.y, v.ang, o)) return { veh: o };
  }
  for (const p of people) {
    if (Math.abs(p.x - x) > v.L / 2 + 12 || Math.abs(p.y - y) > v.L / 2 + 12) continue;
    if (boxDist(x, y, ang, v.L / 2, v.W / 2, p.x, p.y) < PERSON_R && boxDist(v.x, v.y, v.ang, v.L / 2, v.W / 2, p.x, p.y) >= PERSON_R) return p.me ? { me: true } : { npc: p };
  }
  return null;
}
function ghosting(v, o) {
  if (v.ghostOf !== o) return false;
  const clearance = (v.L + o.L) / 2 + 120;
  if (v.ghostT > 0 || Math.hypot(v.x - o.x, v.y - o.y) <= clearance) return true;
  v.ghostOf = null;
  return false;
}
// ── path following ──
// Group = the run of points driven the same way (forwards or reversing), ending early at a stop point.
function groupEnd(P, i) {
  let j = i;
  while (j < P.length - 1 && !P[j].stop && !!P[j + 1].rev === !!P[i].rev) j++;
  return j;
}
// Walk `dist` along the path from the vehicle's projection on segment i, never past the group end.
function walkPath(P, i, ge, x, y, dist) {
  const a = P[i - 1], b = P[i], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / l2));
  let px = a.x + dx * t, py = a.y + dy * t, k = i, left = dist;
  for (;;) {
    const q = P[k], d = Math.hypot(q.x - px, q.y - py);
    if (d >= left) return { x: px + (q.x - px) * left / d, y: py + (q.y - py) * left / d, end: false };
    left -= d; px = q.x; py = q.y;
    if (k >= ge) {   // past the end of the group: carry on straight along its last direction, so the target stays ahead
      const pp = P[ge - 1] || q, dx = q.x - pp.x, dy = q.y - pp.y, l = Math.hypot(dx, dy);
      return l > 0.5 ? { x: q.x + dx / l * left, y: q.y + dy / l * left, end: true, left, ex: q.x, ey: q.y } : { x: q.x, y: q.y, end: true, left };
    }
    k++;
  }
}
// Distance still to drive to the group end, measured along the route (projected onto the current segment), so a
// vehicle a little to one side of the line still knows when it has reached — or passed — a stop. Negative = passed.
function remaining(P, i, ge, x, y) {
  const a = P[i - 1] || P[i], b = P[i], sx = b.x - a.x, sy = b.y - a.y, l = Math.hypot(sx, sy);
  let d = l > 0.5 ? ((b.x - x) * sx + (b.y - y) * sy) / l : Math.hypot(b.x - x, b.y - y);
  for (let k = i + 1; k <= ge; k++) d += Math.hypot(P[k].x - P[k - 1].x, P[k].y - P[k - 1].y);
  return d;
}

function updateTraffic(dt) {
  if (!TRAFFIC.cars.length || !TRAFFIC.vnav) return;
  dt = Math.min(dt, 0.05);
  const now = S.min;
  updateHighwayTraffic();
  const people = [{ x: S.x, y: S.y, me: true }, ...npcs.filter(n => n.visible)];
  for (const v of TRAFFIC.cars) {
    if (v.static) { v.on = true; v.state = 'parked'; }
    else {
      if (v.state === 'pending') {   // wait outside until the gate entrance is clear
        if (now >= v.arriveAt && gateClear(v)) startRoute(v, false); else { v.on = false; continue; }
      }
      if (v.state === 'gone') { v.on = false; continue; }
      if (v.state === 'parked') {
        v.on = true; v.v = 0; v.rev = false; v.braking = false;
        // let people out one by one
        if (v.unloadT < 99) { v.unloadT += dt; const k = Math.floor(v.unloadT / 0.6); v.people.forEach((p, i) => { if (i <= k && !p.arrived) { p.arrived = true; p.spawnAt = vehicleDoor(v); } }); if (k >= v.people.length) v.unloadT = 99; }
        // time to go, everyone is back in (or it's very late), and the lane behind is clear?
        if (now >= v.departAt && (v.people.every(p => p.boarded) || now >= v.departAt + 70)) {
          v.people.forEach(p => { p.boarded = true; if (p.visible && !onScreen(p)) p.visible = false; });
          if (laneClearToLeave(v)) startRoute(v, true);
        }
      }
      if (v.state === 'in' || v.state === 'out') stepVehicle(v, dt, people);
    }
    separatePeople(v, people);
    if (v.state === 'parked' && v._parkedSort) continue;
    const r = vehicleRect(v); v.sortY = r.y + r.h; v.rx = v.x; v.ry = v.y;
    if (v.state === 'parked') v._parkedSort = true;
  }
  if (TRAFFIC.cars.length > 40) TRAFFIC.cars = TRAFFIC.cars.filter(v => !v.highwayTraffic || v.state !== 'gone');
}
// Nobody may stand inside a vehicle: anyone touching one (e.g. appearing next to it) is moved just clear of it.
// Where people step out: beside the door on the kerb (left) side — front door for buses, rear seat for cars —
// sliding along the vehicle (then trying the other side) until it's open, walkable ground clear of the vehicle.
function alightPoint(v) {
  const ca = Math.cos(v.ang), sa = Math.sin(v.ang), fwd0 = v.kind === 'bus' ? v.L / 2 - 22 : -10;
  const at = (fwd, side) => ({ x: v.x + ca * fwd + sa * side, y: v.y + sa * fwd - ca * side });
  for (const sd of [1, -1]) for (const extra of [15, 24, 34]) for (const df of [0, -25, -50, 25, -80, -110]) {
    const fwd = Math.max(-v.L / 2 + 10, Math.min(v.L / 2 - 10, fwd0 + df)), p = at(fwd, sd * (v.W / 2 + extra));
    if (!blocked(p.x, p.y) && reachable(p.x, p.y) && personGap(v, p) > 3) return p;
  }
  return at(fwd0, v.W / 2 + 15);
}
function separatePeople(v, people) {
  if (!v.on || v.state === 'gone' || v.alpha < 0.5) return;
  const ca = Math.cos(v.ang), sa = Math.sin(v.ang), hl = v.L / 2, hw = v.W / 2, R = PERSON_R + 0.5;
  for (const p of people) {
    if (Math.abs(p.x - v.x) > hl + R || Math.abs(p.y - v.y) > hl + R) continue;
    const dx = p.x - v.x, dy = p.y - v.y, lx = dx * ca + dy * sa, ly = -dx * sa + dy * ca;
    if (boxDist(v.x, v.y, v.ang, hl, hw, p.x, p.y) >= PERSON_R) continue;
    const cands = [];
    const cx = Math.max(-hl, Math.min(hl, lx)), cy = Math.max(-hw, Math.min(hw, ly));
    if (cx !== lx || cy !== ly) { const d = Math.hypot(lx - cx, ly - cy) || 1; cands.push([cx + (lx - cx) / d * R, cy + (ly - cy) / d * R]); }
    // out through each side, cheapest first
    for (const [ox, oy, cost] of [[lx, hw + R, hw + R - ly], [lx, -hw - R, hw + R + ly], [hl + R, ly, hl + R - lx], [-hl - R, ly, hl + R + lx]].sort((a, b) => a[2] - b[2])) cands.push([ox, oy]);
    for (const [ox, oy] of cands) {
      const nx = v.x + ox * ca - oy * sa, ny = v.y + ox * sa + oy * ca;
      if (blocked(nx, ny)) continue;
      if (p.me) { S.x = nx; S.y = ny; }
      p.x = nx; p.y = ny;
      break;
    }
  }
}
function gateClear(v) {
  const o0 = v.gate.outside;
  return !TRAFFIC.cars.some(o => o !== v && o.on && o.state !== 'gone' && Math.hypot(o.x - o0.x, o.y - o0.y) < (v.L + o.L) / 2 + 30);
}
// Don't start reversing out while something is driving down the lane right behind.
function laneClearToLeave(v) {
  const q = v.bay.leave[v.bay.leave.length - 1];
  for (const o of TRAFFIC.cars) {
    if (o === v || !o.on || o.state === 'parked' || o.state === 'gone') continue;
    if (Math.hypot(o.x - q.x, o.y - q.y) < v.L + o.L / 2 + 40) return false;
  }
  return true;
}
function stepVehicle(v, dt, people) {
  v.on = true;
  const P = v.path, sp = v.spec;
  if (v.holdT > 0 || v.unloading) {   // stopped at a drop-off point / bus stop
    v.holdT -= dt; v.v = 0; v.braking = true; v.rev = false;
    if (!v.unloading) v.unloading = { t: 0, list: v.people.filter(p => !p.arrived && (v.atStop == null || p.busStop === v.atStop)) };
    const U = v.unloading; U.t += dt;
    const k = Math.floor(U.t / 0.7), ca = Math.cos(v.ang), sa = Math.sin(v.ang);
    // out of the door: buses at the front left (kerb side), cars beside the rear seat
    if (!U.door) U.door = alightPoint(v);
    U.list.forEach((p, i) => { if (i <= k && !p.arrived) { p.arrived = true; p.spawnAt = { x: U.door.x + (Math.random() - 0.5) * 10, y: U.door.y + (Math.random() - 0.5) * 10 }; } });
    // wait until everyone is out and has stepped well clear of the vehicle (or ~10 s at most)
    const clear = U.list.every(p => p.arrived && (!p.visible ? U.t > U.list.length * 0.7 + 1.2 : personGap(v, p) > 26));
    if (v.holdT > 0 || k < U.list.length || (!clear && U.t < 10 + U.list.length * 0.7)) return;
    v.holdT = 0; v.unloading = null; v.atStop = null;
  }
  if (v.pi >= P.length) return finishRoute(v);
  let ge = groupEnd(P, v.pi);
  const rev = !!P[v.pi].rev; v.rev = rev;
  // advance along the group while the vehicle has passed segment ends
  for (;;) {
    const a = P[v.pi - 1], b = P[v.pi], dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1;
    const t = ((v.x - a.x) * dx + (v.y - a.y) * dy) / l2;
    if (v.pi < ge && (t >= 1 || Math.hypot(b.x - v.x, b.y - v.y) < Math.max(10, sp.Ld * 0.5))) v.pi++; else break;
  }
  const toEnd = remaining(P, v.pi, ge, v.x, v.y);
  // reached the end of this group: stop point / change of direction / end of route
  if (toEnd < 4 || (toEnd < 12 && Math.abs(v.v) < 6)) {
    const q = P[ge];
    if (ge >= P.length - 1) { v.x = q.x; v.y = q.y; return finishRoute(v); }
    v.v = 0; v.pi = ge + 1;
    if (q.stop) { v.holdT = q.stop; v.unloadT = 0; v.atStop = q.busStop ?? null; v.unloading = null; q.stop = 0; }
    return;
  }
  // steering: pure pursuit on a carrot point ahead along the route, limited by the turning radius
  const Ld = rev ? Math.max(18, v.L * 0.45) : Math.max(sp.Ld, Math.abs(v.v) * 0.42);
  const moveA = rev ? v.ang + Math.PI : v.ang;
  // pure pursuit from the rear axle (the point the body turns about): target Ld ahead of the axle along the route
  const axl = v.L * (v.kind === 'bus' ? 0.24 : 0), rpx = v.x - Math.cos(v.ang) * axl, rpy = v.y - Math.sin(v.ang) * axl;
  const c = walkPath(P, v.pi, ge, rpx, rpy, Ld);
  const alpha = wrapA(Math.atan2(c.y - rpy, c.x - rpx) - moveA);
  let kappa = 2 * Math.sin(alpha) / Math.max(8, Math.hypot(c.x - rpx, c.y - rpy));
  kappa = Math.max(-1 / sp.Rmin, Math.min(1 / sp.Rmin, kappa));
  // final metres into a bay: settle exactly onto the bay's angle
  const settle = v.state === 'in' && v.bay && ge === P.length - 1 && toEnd < v.L * 0.4 ? wrapA(v.bay.ang - v.ang) * Math.min(1, dt * 3) : 0;

  // speed: cruise, slow in the lot / reversing / in tight turns, brake for the end of the group and for anything ahead
  let want = P[v.pi].slow ? sp.lot : P[v.pi].mid ? sp.lot * 2.1 : sp.cruise;
  if (rev) want = Math.min(want, 42);
  want *= Math.max(0.32, 1 - Math.abs(alpha) * 0.85);
  want = Math.min(want, Math.sqrt(2 * sp.dec * 0.55 * Math.max(0, toEnd - 2)) + 4);
  const gap = lookAhead(v, P, ge, people, rev);
  if (gap < Infinity) want = Math.min(want, gap <= 8 ? 0 : Math.sqrt(2 * sp.dec * 0.7 * (gap - 8)));
  const prev = v.v;
  v.v += Math.max(-sp.dec * dt, Math.min(sp.acc * dt, want - v.v));
  if (want === 0 && v.v < 3) v.v = 0;
  v.braking = v.v < prev - 1 || (v.v < 2 && gap < Infinity);
  // stuck behind someone?
  if (v.v < 6) {
    v.stopT += dt;
    const bl = v.blocker;
    if (bl && bl.me && v.stopT > 1.2 && !v.beeped && onScreen({ x: v.x, y: v.y }, 0)) { v.beeped = true; floaters.push({ x: v.x, y: v.y - 50, text: 'BEEP BEEP!', color: '#ffd60a', t: 1.4 }); }
    else if (bl && bl.npc && v.stopT > 0.6 && !(performance.now() - (bl.npc.nudgeAt || 0) < 2500)) {
      // someone is standing in the road: they step aside to the nearer kerb
      const n = bl.npc, ca = Math.cos(moveA), sa = Math.sin(moveA), side = Math.sign((n.x - v.x) * -sa + (n.y - v.y) * ca) || 1;
      // a spot clear of the vehicle's path, off the road if there is one (their side first)
      const lat = (n.x - v.x) * -sa + (n.y - v.y) * ca;
      let p = null;
      for (const sd of [side, -side]) for (const k of [v.W / 2 + 40, v.W / 2 + 75, v.W / 2 + 120]) {
        if (p) break;
        const off = sd * k - lat, x = n.x - sa * off, y = n.y + ca * off;
        if (!blocked(x, y) && !onRoad(x, y) && reachable(x, y)) p = { x, y };
      }
      if (!p) p = nearestFree(n.x - sa * side * (v.W / 2 + 60), n.y + ca * side * (v.W / 2 + 60));
      leaveGroup(n);
      setNpcTarget(n, p.x, p.y); n.wait = 0; n.freeze = 0; n.nudgeAt = performance.now(); n.gather = null;
    } else if (bl && bl.veh) {
      v.blockT += dt;
      // two vehicles waiting on each other for a while: the later one gives way to the other
      if (v.blockT > 6 && bl.veh.blocker && bl.veh.blocker.veh === v && v.id > bl.veh.id) { bl.veh.ghostT = 1.2; bl.veh.ghostOf = v; v.blockT = 0; TRAFFIC.ghosts = (TRAFFIC.ghosts || 0) + 1; logGhost(v, bl.veh); }
      // last resort, should never be needed: wedged against a parked vehicle for a long time
      else if (v.blockT > 10 && bl.veh.state === 'parked') { v.ghostT = 1.5; v.ghostOf = bl.veh; v.blockT = 0; TRAFFIC.ghosts = (TRAFFIC.ghosts || 0) + 1; logGhost(v, bl.veh); }
    }
  } else { v.stopT = 0; v.blockT = 0; if (v.v > 30) v.beeped = false; }
  if (v.ghostT > 0) v.ghostT -= dt;
  // move — the body pivots about its rear axle, so the tail follows inside a turn instead of swinging out
  // (that is how a real bus clears the lane beside it) — and never into another vehicle or a person
  const s = v.v * dt;
  if (s > 0 || settle) {
    const ax = axl, ca = Math.cos(v.ang), sa = Math.sin(v.ang), dir = rev ? -1 : 1;
    const rx = v.x - ca * ax + ca * s * dir, ry = v.y - sa * ax + sa * s * dir;
    const na = wrapA(v.ang + kappa * s + settle), nx = rx + Math.cos(na) * ax, ny = ry + Math.sin(na) * ax;
    const hit = poseBlocked(v, nx, ny, na, people);
    if (hit) { v.v = 0; v.braking = true; v.blocker = hit; }
    else { v.ang = na; v.x = nx; v.y = ny; }
  }
  // fade in/out beyond the gate
  const outside = Math.max(-v.x, -v.y, v.x - WORLD_W, v.y - WORLD_H);
  v.alpha = outside > 0 ? Math.max(0, 1 - outside / 50) : 1;
}
// Record of the rare give-way deadlock breaks (for debugging traffic layouts).
function logGhost(a, b) {
  const d = (v) => ({ id: v.id, m: v.model, st: v.state, x: Math.round(v.x), y: Math.round(v.y), ang: +v.ang.toFixed(2), rev: !!v.rev, pi: v.pi, next: v.path ? v.path.slice(v.pi, v.pi + 3).map(p => [Math.round(p.x), Math.round(p.y), p.rev ? 'R' : '']) : null, by: v.blocker && v.blocker.veh ? v.blocker.veh.id : null });
  const L = (TRAFFIC.ghostLog = TRAFFIC.ghostLog || []); if (L.length < 50) L.push({ t: Math.round(S.min), a: d(a), b: d(b) });
}
function finishRoute(v) {
  v.v = 0; v.path = null; v.rev = false;
  if (v.state === 'in' && v.bay && !v.dropOff) { v.state = 'parked'; v.x = v.bay.cx; v.y = v.bay.cy; v.ang = v.bay.ang; v.unloadT = 0; v._parkedSort = false; }
  else { v.state = 'gone'; v.on = false; if (v.bay) v.bay.taken = null; }
}
// Distance the vehicle can still drive along its route before touching another vehicle or a person.
// Distance the vehicle can still drive along its route before its exact footprint would touch another
// vehicle or a person. The footprint is swept along the route, turning with it.
function lookAhead(v, P, ge, people, rev) {
  v.blocker = null;
  const spd = Math.abs(v.v), reach = spd * spd / (2 * v.spec.dec) + 44;
  const hl = v.L / 2 + 2, hw = v.W / 2 + (P[v.pi].slow ? 0.5 : 1);
  const others = [];
  for (const o of TRAFFIC.cars) {
    if (o === v || !o.on || o.state === 'gone' || o.alpha <= 0) continue;
    if (ghosting(v, o)) continue;
    const dx = o.x - v.x, dy = o.y - v.y, lim = reach + (v.L + o.L) / 2 + 10;
    if (dx * dx + dy * dy > lim * lim) continue;
    if (vehHit(v, v.x, v.y, v.ang, o)) continue;   // already touching (e.g. after a give-way): the move guard handles it
    others.push(o);
  }
  const peeps = people.filter(p => Math.abs(p.x - v.x) < reach + v.L && Math.abs(p.y - v.y) < reach + v.L
    && boxDist(v.x, v.y, v.ang, v.L / 2, v.W / 2, p.x, p.y) >= PERSON_R);
  if (!others.length && !peeps.length) return Infinity;
  let pathA = null;
  for (let s = 4; s <= reach; s += 7) {
    const q = walkPath(P, v.pi, ge, v.x, v.y, s);
    if (q.end && q.ex !== undefined) { q.x = q.ex; q.y = q.ey; }   // it stops at the end point, never beyond
    // the body turns from its current heading towards the route's direction over about half its length
    const qn = q.end ? null : walkPath(P, v.pi, ge, v.x, v.y, s + 8);
    if (qn && Math.hypot(qn.x - q.x, qn.y - q.y) > 1) { const mv = Math.atan2(qn.y - q.y, qn.x - q.x); pathA = rev ? mv + Math.PI : mv; }
    const turn = pathA === null ? 0 : wrapA(pathA - v.ang), lim = s / v.spec.Rmin;   // can't turn tighter than its turning circle
    const ang = v.ang + Math.max(-lim, Math.min(lim, turn));
    for (const o of others) {
      if (obbOverlap(q.x, q.y, ang, hl, hw, o.x, o.y, o.ang, o.L / 2, o.W / 2)) { v.blocker = { veh: o }; return s - 4; }
      if (o.rev && o.path && o.pi < o.path.length) {   // keep clear of the spot a vehicle is reversing into
        const tgt = o.path[groupEnd(o.path, o.pi)];
        if (boxDist(q.x, q.y, ang, hl, hw, tgt.x, tgt.y) < o.L / 2) { v.blocker = { veh: o }; return s - 4; }
      }
    }
    for (const p of peeps) {
      if (boxDist(q.x, q.y, ang, hl, hw, p.x, p.y) < PERSON_R + 4) { v.blocker = p.me ? { me: true } : { npc: p }; return s - 4; }
    }
    if (q.end) break;
  }
  return Infinity;
}

// ── drawing ──
function drawVehicle(g, v, dark) {
  if (!v.on || v.alpha <= 0) return;
  const moving = v.state === 'in' || v.state === 'out';
  g.save(); g.globalAlpha = v.alpha;
  VehicleArt.draw(g, v.model, v.color, v.x, v.y, v.ang);
  // brake lights / reversing lights
  const ca = Math.cos(v.ang), sa = Math.sin(v.ang), bx = v.x - ca * (v.L / 2 - 1), by = v.y - sa * (v.L / 2 - 1);
  if (moving && (v.braking || v.rev || dark > 0.3)) {
    const col = v.rev ? '255,255,240' : '255,40,40', k = v.braking || v.rev ? 0.75 : 0.35;
    for (const sd of [-1, 1]) {
      const lx = bx - sa * sd * (v.W / 2 - 4), ly = by + ca * sd * (v.W / 2 - 4);
      const gr = g.createRadialGradient(lx, ly, 0, lx, ly, 12);
      gr.addColorStop(0, `rgba(${col},${k})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(lx - 12, ly - 12, 24, 24); g.globalCompositeOperation = 'source-over';
    }
  }
  if (moving && dark > 0.3) {   // headlight beams at night
    const ca = Math.cos(v.ang), sa = Math.sin(v.ang), fx = v.x + ca * (v.L / 2 + 30), fy = v.y + sa * (v.L / 2 + 30);
    const gr = g.createRadialGradient(fx, fy, 0, fx, fy, 56);
    gr.addColorStop(0, `rgba(255,240,170,${0.5 * dark})`); gr.addColorStop(1, 'rgba(255,240,170,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(fx - 56, fy - 56, 112, 112);
  }
  g.restore();
}
