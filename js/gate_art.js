'use strict';
// ─────────────────────────────────────────────────────────────
//  MVSR main gate, drawn in code in the game's comic style.
//  Replica of the real entrance: two big pillars with sloped caps, the
//  "M.V.S.R. ENGINEERING COLLEGE" beam, a centre pillar, two grille gates,
//  the Matrusri Education Society sign with a hedge, and curved side walls.
//  Shared by the game (art.js) and the Map Editor.
// ─────────────────────────────────────────────────────────────
const GATE_PAL = {
  ink: '#1b1b1b', dark: '#4f5560', darkHi: '#666c78', darkLo: '#3c4049', cap: '#ece8e0', capLo: '#c9c4ba',
  beam: '#3a3e47', beamHi: '#555a65', text: '#f4f1de', grille: '#dfe1e5', bar: '#7d828b', stone: '#a29d93',
  sign: '#262938', hedge: ['#2f7a3a', '#3f8f3a', '#52a35a'], tree: ['#2d6a4f', '#40916c', '#386641'],
};

const GATE_MAIN_IMAGE = new Image();
GATE_MAIN_IMAGE.onload = () => { if (typeof draw === 'function') draw(); };
GATE_MAIN_IMAGE.src = 'assets/gate_main.png';

// Front view. Drawn in a 443 × 150 design box (ground line at y = 150), centred on cx with its base on baseY.
function drawGateFront(g, cx, baseY, width = 400, alpha = 1) {
  if (GATE_MAIN_IMAGE.complete && GATE_MAIN_IMAGE.naturalWidth) {
    const height = width * GATE_MAIN_IMAGE.naturalHeight / GATE_MAIN_IMAGE.naturalWidth;
    g.save();
    g.globalAlpha *= alpha;
    g.drawImage(GATE_MAIN_IMAGE, cx - width / 2, baseY - height, width, height);
    g.restore();
    return;
  }

  const s = width / 443, P = GATE_PAL;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(cx - 221.5 * s, baseY - 150 * s); g.scale(s, s);
  g.lineJoin = 'round'; g.lineWidth = 2.2; g.strokeStyle = P.ink;
  const box = (x, y, w, h, fill) => { g.fillStyle = fill; g.fillRect(x, y, w, h); g.strokeRect(x, y, w, h); };
  const blob = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke(); };

  // shadow on the ground, so it sits in the world instead of floating
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath();
  g.moveTo(4, 150); g.lineTo(439, 150); g.lineTo(452, 160); g.lineTo(16, 160); g.closePath(); g.fill();

  // trees growing behind the side walls
  for (const [x, y, r, i] of [[10, 78, 24, 0], [30, 96, 18, 1], [8, 108, 16, 2], [433, 78, 24, 0], [413, 96, 18, 1], [435, 108, 16, 2]]) blob(x, y, r, P.tree[i]);

  // low curved side walls that join the boundary wall
  g.fillStyle = P.cap;
  g.beginPath(); g.moveTo(-6, 150); g.lineTo(-6, 112); g.quadraticCurveTo(12, 108, 24, 122); g.lineTo(24, 150); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(449, 150); g.lineTo(449, 112); g.quadraticCurveTo(431, 108, 419, 122); g.lineTo(419, 150); g.closePath(); g.fill(); g.stroke();

  // grille gates (behind the centre sign), arched tops, vertical bars
  const gate = (x0, x1, flip) => {
    const mid = (x0 + x1) / 2;
    g.fillStyle = P.grille;
    g.beginPath(); g.moveTo(x0, 148); g.lineTo(x0, flip ? 104 : 98); g.quadraticCurveTo(mid, 86, x1, flip ? 98 : 104); g.lineTo(x1, 148); g.closePath(); g.fill(); g.stroke();
    g.save(); g.clip();
    g.strokeStyle = P.bar; g.lineWidth = 1.3;
    for (let x = x0 + 5; x < x1; x += 6) { g.beginPath(); g.moveTo(x, 86); g.lineTo(x, 148); g.stroke(); }
    g.lineWidth = 2; for (const y of [110, 128, 142]) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
    g.restore();
  };
  gate(70, 206, false); gate(238, 373, true);

  // big pillars with lit and shaded edges and a plinth
  const pillar = (x) => {
    box(x, 30, 46, 120, P.dark);
    g.fillStyle = P.darkHi; g.fillRect(x + 1, 31, 7, 118);
    g.fillStyle = P.darkLo; g.fillRect(x + 38, 31, 7, 118);
    box(x - 4, 138, 54, 12, P.darkLo);
  };
  pillar(22); pillar(375);

  // centre pillar under the beam
  box(204, 56, 35, 50, P.dark); g.fillStyle = P.darkHi; g.fillRect(205, 57, 5, 48);

  // top slab and sloped white caps over the pillars
  box(24, 24, 395, 9, P.cap);
  g.fillStyle = P.cap;
  g.beginPath(); g.moveTo(8, 32); g.lineTo(80, 32); g.lineTo(80, 24); g.lineTo(8, 12); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(363, 32); g.lineTo(435, 32); g.lineTo(435, 12); g.lineTo(363, 24); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = P.capLo; g.fillRect(9, 28, 70, 3); g.fillRect(364, 28, 70, 3);

  // the name beam
  box(30, 33, 383, 24, P.beam);
  g.strokeStyle = P.beamHi; g.lineWidth = 1.2; g.strokeRect(34, 36, 375, 18);
  g.fillStyle = P.text; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'bold 15px Georgia, "Times New Roman", serif';
  if ('letterSpacing' in g) g.letterSpacing = '2.5px';
  g.fillText('M.V.S.R. ENGINEERING COLLEGE', 222, 46);
  if ('letterSpacing' in g) g.letterSpacing = '0px';

  // Matrusri sign on its stone base, hedge in front
  g.strokeStyle = P.ink; g.lineWidth = 2.2;
  box(150, 126, 143, 22, P.stone);
  box(156, 101, 131, 26, P.sign);
  g.strokeStyle = P.cap; g.lineWidth = 1; g.strokeRect(159, 104, 125, 20);
  g.fillStyle = P.text; g.font = 'bold 8.5px "Comic Neue", "Trebuchet MS", sans-serif';
  g.fillText('MATRUSRI EDUCATION SOCIETY', 222, 114.5);
  g.strokeStyle = P.ink; g.lineWidth = 2;
  for (let i = 0; i < 12; i++) blob(154 + i * 12.3, 143 + (i % 2) * 2, 8 + (i % 3), P.hedge[i % 3]);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.restore();
}

// Side view for a gate on the east or west wall: pillars as tall blocks, the beam seen from above.
function drawGateSide(g, gi, alpha = 1) {
  const P = GATE_PAL, east = gi.side === 'E', [p1, p2] = gi.pillars, HGT = 110;
  g.save(); g.globalAlpha *= alpha; g.lineJoin = 'round'; g.strokeStyle = P.ink; g.lineWidth = 2.5;
  const block = (b, hgt, front, top) => {
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(b.x + 8, b.y + b.h - 6, b.w, 12);
    g.fillStyle = front; g.fillRect(b.x, b.y + b.h - hgt, b.w, hgt); g.strokeRect(b.x, b.y + b.h - hgt, b.w, hgt);
    g.fillStyle = top; g.fillRect(b.x, b.y - hgt, b.w, b.h); g.strokeRect(b.x, b.y - hgt, b.w, b.h);
  };
  // grille gates along the wall line
  const gx = p1.x + p1.w / 2 - 4;
  g.fillStyle = P.grille; g.fillRect(gx, p1.y + p1.h, 8, p2.y - p1.y - p1.h); g.strokeRect(gx, p1.y + p1.h, 8, p2.y - p1.y - p1.h);
  g.strokeStyle = P.bar; g.lineWidth = 1.2;
  for (let y = p1.y + p1.h + 6; y < p2.y; y += 6) { g.beginPath(); g.moveTo(gx, y); g.lineTo(gx + 8, y); g.stroke(); }
  g.strokeStyle = P.ink; g.lineWidth = 2.5;
  // the sign block in the middle, a hedge beside it
  const my = (p1.y + p2.y + p2.h) / 2;
  const sb = { x: east ? gx - 34 : gx + 12, y: my - 40, w: 22, h: 80 };
  for (let i = 0; i < 6; i++) { g.fillStyle = P.hedge[i % 3]; g.beginPath(); g.arc(east ? sb.x - 8 : sb.x + sb.w + 8, sb.y + 8 + i * 13, 8, 0, 7); g.fill(); g.stroke(); }
  block(sb, 34, P.stone, P.sign);
  block(p1, HGT, P.dark, P.cap); block(p2, HGT, P.dark, P.cap);
  // the beam across the pillar tops, with the college name along it
  const bx = p1.x + 6, bw = p1.w - 12, by = p1.y - HGT - 6, bh = p2.y + p2.h - p1.y + 12;
  g.fillStyle = P.beam; g.fillRect(bx, by, bw, bh); g.strokeRect(bx, by, bw, bh);
  g.save(); g.translate(bx + bw / 2, by + bh / 2); g.rotate(east ? Math.PI / 2 : -Math.PI / 2);
  g.fillStyle = P.text; g.font = 'bold 18px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('M.V.S.R. ENGINEERING COLLEGE', 0, 1);
  g.restore();
  g.restore();
}

// Back gate: two brick pillars with cream caps, a grille slid open against the wall and a small "BACK GATE" sign.
function drawBackGate(g, bi, alpha = 1) {
  const P = GATE_PAL, [p1, p2] = bi.pillars, HGT = 70;
  g.save(); g.globalAlpha *= alpha; g.lineJoin = 'round'; g.strokeStyle = P.ink; g.lineWidth = 2.5;
  const pillar = (b) => {
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(b.x + 6, b.y + b.h - 4, b.w, 10);
    g.fillStyle = '#9b3d2c'; g.fillRect(b.x, b.y + b.h - HGT, b.w, HGT); g.strokeRect(b.x, b.y + b.h - HGT, b.w, HGT);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
    for (let y = b.y + b.h - HGT + 10; y < b.y + b.h; y += 10) { g.beginPath(); g.moveTo(b.x, y); g.lineTo(b.x + b.w, y); g.stroke(); }
    g.strokeStyle = P.ink; g.lineWidth = 2.5;
    g.fillStyle = P.cap; g.fillRect(b.x - 3, b.y - HGT + 2, b.w + 6, b.h); g.strokeRect(b.x - 3, b.y - HGT + 2, b.w + 6, b.h);
  };
  if (bi.horiz) {
    // grille slid open along the wall, to the left of the opening
    const gy = bi.side === 'N' ? 8 : bi.y - 34, gx0 = p1.x - 150;
    g.fillStyle = P.grille; g.fillRect(gx0, gy, 140, 26); g.strokeRect(gx0, gy, 140, 26);
    g.strokeStyle = P.bar; g.lineWidth = 1.2; for (let x = gx0 + 5; x < gx0 + 140; x += 6) { g.beginPath(); g.moveTo(x, gy); g.lineTo(x, gy + 26); g.stroke(); }
    g.strokeStyle = P.ink; g.lineWidth = 2.5;
    pillar(p1); pillar(p2);
    const sx = p1.x + p1.w / 2, sy = p1.y + p1.h - HGT + 18;
    g.fillStyle = P.sign; g.fillRect(sx - 34, sy, 68, 16); g.strokeRect(sx - 34, sy, 68, 16);
    g.fillStyle = P.text; g.font = 'bold 10px "Comic Neue", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BACK GATE', sx, sy + 8.5);
  } else {
    // grille slid open along the wall, above the opening
    const gx = bi.side === 'W' ? 8 : bi.x - 30, gy0 = p1.y - 150;
    g.fillStyle = P.grille; g.fillRect(gx, gy0, 22, 140); g.strokeRect(gx, gy0, 22, 140);
    g.strokeStyle = P.bar; g.lineWidth = 1.2; for (let y = gy0 + 5; y < gy0 + 140; y += 6) { g.beginPath(); g.moveTo(gx, y); g.lineTo(gx + 22, y); g.stroke(); }
    g.strokeStyle = P.ink; g.lineWidth = 2.5;
    pillar(p1); pillar(p2);
    const sx = p2.x + p2.w / 2 + (bi.side === 'W' ? 34 : -34), sy = p2.y - 30;
    g.fillStyle = '#5e3c24'; g.fillRect(sx - 2, sy, 4, 34);
    g.fillStyle = P.sign; g.fillRect(sx - 32, sy - 16, 64, 16); g.strokeRect(sx - 32, sy - 16, 64, 16);
    g.fillStyle = P.text; g.font = 'bold 10px "Comic Neue", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BACK GATE', sx, sy - 7.5);
  }
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.restore();
}

// Draw the gate described by gateInfo() in world coordinates.
function drawGateArt(g, gi, alpha = 1) {
  if (gi.freePosition) {
    if (gi.horiz) drawGateFront(g, gi.x, gi.y, gi.width || 400, alpha);
    else drawGateSide(g, gi, alpha);
    return;
  }
  if (gi.side === 'N') drawGateFront(g, gi.at, 140, gi.width || 400, alpha);
  else if (gi.side === 'S') drawGateFront(g, gi.at, gi.y - 6, gi.width || 400, alpha);
  else drawGateSide(g, gi, alpha);
}
