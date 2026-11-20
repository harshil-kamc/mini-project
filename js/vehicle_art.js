'use strict';
// ─────────────────────────────────────────────────────────────
//  High-resolution top-down vehicles, drawn as vector art (SVG) for this game and rasterised
//  once at 4× so they stay crisp at any zoom and can rotate smoothly to any angle.
//  Every model faces +x (to the right). Sizes are in world pixels.
//
//  VehicleArt.get(model, color) → { img, L, W }  (img: canvas, or null until ready)
//  VehicleArt.draw(g, model, color, x, y, angle, opts) → draws with a soft ground shadow
// ─────────────────────────────────────────────────────────────
const VehicleArt = (() => {
  const RS = 4;   // raster scale

  // ── colour helpers ──
  const hex2 = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
  const toHex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const shade = (h, k) => { const [r, g, b] = hex2(h); return k >= 0 ? toHex(r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k) : toHex(r * (1 + k), g * (1 + k), b * (1 + k)); };
  let uid = 0;

  // A paint gradient across the car's width: darker flanks, bright centre line — reads as a curved panel from above.
  const paint = (id, c, hi = 0.28) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${shade(c, -0.45)}"/><stop offset="0.14" stop-color="${shade(c, -0.08)}"/>
    <stop offset="0.42" stop-color="${shade(c, hi)}"/><stop offset="0.58" stop-color="${shade(c, hi)}"/>
    <stop offset="0.86" stop-color="${shade(c, -0.08)}"/><stop offset="1" stop-color="${shade(c, -0.45)}"/></linearGradient>`;
  const glass = (id) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#3c5d7e"/><stop offset="0.45" stop-color="#16263a"/><stop offset="0.55" stop-color="#0d1828"/><stop offset="1" stop-color="#22394f"/></linearGradient>`;
  const gloss = (id) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0.35">
    <stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.32"/><stop offset="0.6" stop-color="#fff" stop-opacity="0"/></linearGradient>`;

  // Rounded rectangle with separate front (right) and rear (left) corner radii.
  function body(x0, y0, L, W, rf, rr) {
    const x1 = x0 + L, y1 = y0 + W;
    return `M${x0 + rr},${y0} L${x1 - rf},${y0} Q${x1},${y0} ${x1},${y0 + rf} L${x1},${y1 - rf} Q${x1},${y1} ${x1 - rf},${y1} L${x0 + rr},${y1} Q${x0},${y1} ${x0},${y1 - rr} L${x0},${y0 + rr} Q${x0},${y0} ${x0 + rr},${y0} Z`;
  }
  const rect = (x, y, w, h, r, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" ${extra}/>`;
  const wrap = (L, W, pad, inner, rs = RS) => `<svg xmlns="http://www.w3.org/2000/svg" width="${(L + pad * 2) * rs}" height="${(W + pad * 2) * rs}" viewBox="${-L / 2 - pad} ${-W / 2 - pad} ${L + pad * 2} ${W + pad * 2}">${inner}</svg>`;

  // ── Passenger cars: sedan, hatchback, SUV, taxi, police ──
  function car(o) {
    const { L, W, color } = o, i = ++uid, h = L / 2, w = W / 2;
    const P = `p${i}`, G = `g${i}`, S = `s${i}`, R = `r${i}`;
    const roofC = o.roof || color;
    // longitudinal layout (fractions of L from the rear)
    const ws0 = o.ws0 ?? 0.56, ws1 = o.ws1 ?? 0.7, rw0 = o.rw0 ?? 0.16, rw1 = o.rw1 ?? 0.27;
    const X = (f) => -h + L * f;
    const gW = W * 0.8, rW = W * 0.66;
    let s = `<defs>${paint(P, color)}${paint(R, roofC, 0.35)}${glass(G)}${gloss(S)}</defs>`;
    // tyres peeking out from under the body
    for (const fx of [0.2, 0.78]) for (const sy of [-1, 1]) s += rect(X(fx) - 5.5, sy < 0 ? -w - 0.9 : w - 3.5, 11, 4.4, 1.6, '#15171b');
    // body
    s += `<path d="${body(-h, -w, L, W, W * (o.rf ?? 0.36), W * (o.rr ?? 0.26))}" fill="url(#${P})" stroke="rgba(0,0,0,0.55)" stroke-width="0.7"/>`;
    // bumper shading front / rear
    s += `<path d="M${h - 2.2},${-w + 4} Q${h},0 ${h - 2.2},${w - 4}" stroke="rgba(0,0,0,0.25)" stroke-width="1.2" fill="none"/>`;
    s += `<path d="M${-h + 2},${-w + 4} Q${-h},0 ${-h + 2},${w - 4}" stroke="rgba(0,0,0,0.3)" stroke-width="1.2" fill="none"/>`;
    // hood creases
    s += `<path d="M${X(ws1) + 2},${-W * 0.22} L${h - 4},${-W * 0.17} M${X(ws1) + 2},${W * 0.22} L${h - 4},${W * 0.17}" stroke="rgba(0,0,0,0.18)" stroke-width="0.6"/>`;
    // glasshouse (all windows), then the roof on top of it
    s += rect(X(rw0), -gW / 2, X(ws1) - X(rw0), gW, W * 0.2, `url(#${G})`, 'stroke="rgba(0,0,0,0.6)" stroke-width="0.5"');
    s += rect(X(rw1), -rW / 2, X(ws0) - X(rw1), rW, W * 0.16, `url(#${R})`, 'stroke="rgba(0,0,0,0.35)" stroke-width="0.5"');
    // window pillars (B-pillar) on each side
    const bx = (X(rw1) + X(ws0)) / 2 + 2;
    s += `<path d="M${bx},${-gW / 2} L${bx},${-rW / 2} M${bx},${gW / 2} L${bx},${rW / 2}" stroke="${shade(roofC, -0.35)}" stroke-width="1.6"/>`;
    // gloss sweep over roof & glass
    s += rect(X(rw0), -gW / 2, X(ws1) - X(rw0), gW, W * 0.2, `url(#${S})`);
    // mirrors
    for (const sy of [-1, 1]) s += `<ellipse cx="${X(ws1) - 3}" cy="${sy * (w + 1.2)}" rx="2.6" ry="1.6" fill="${shade(color, -0.25)}" stroke="rgba(0,0,0,0.5)" stroke-width="0.4"/>`;
    // head & tail lights
    for (const sy of [-1, 1]) {
      s += `<path d="M${h - 1.2},${sy * (w - 3)} L${h - 4.6},${sy * (w - 2.2)} L${h - 4.6},${sy * (w - 8.5)} L${h - 1.6},${sy * (w - 8.5)} Z" fill="#fff8de" stroke="rgba(0,0,0,0.35)" stroke-width="0.4"/>`;
      s += rect(-h + 0.6, sy > 0 ? w - 9 : -w + 2, 2.6, 7, 1, '#d6242f', 'stroke="rgba(0,0,0,0.35)" stroke-width="0.4"');
    }
    if (o.extra) s += o.extra({ L, W, h, w, X, rW });
    return wrap(L, W, 3, s);
  }

  // ── MVSR college bus, seen from above: curved cream roof, coloured livery skirt, side window bands with
  //    pillars, split wrap-round windscreen with wipers, roof AC with fans, escape hatches, rear roof ladder,
  //    "rabbit-ear" mirrors, and head / indicator / tail lights. Rasterised at a higher scale than the cars. ──
  function bus(o) {
    const { L, W } = o, i = ++uid, h = L / 2, w = W / 2, c = o.color || '#f2b705', roof = o.roofColor || '#f6f3ea';
    const P = `p${i}`, R = `r${i}`, G = `g${i}`, S = `s${i}`, A = `a${i}`, E = `e${i}`;
    const dk = shade(c, -0.35), X = (f) => -h + L * f;
    let s = `<defs>${paint(P, c, 0.18)}${glass(G)}${gloss(S)}
      <linearGradient id="${R}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${shade(roof, -0.22)}"/><stop offset="0.12" stop-color="${shade(roof, -0.06)}"/>
        <stop offset="0.45" stop-color="${roof}"/><stop offset="0.55" stop-color="${roof}"/>
        <stop offset="0.88" stop-color="${shade(roof, -0.06)}"/><stop offset="1" stop-color="${shade(roof, -0.22)}"/></linearGradient>
      <linearGradient id="${A}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#b9c0c8"/><stop offset="0.5" stop-color="#e3e7eb"/><stop offset="1" stop-color="#aeb6bf"/></linearGradient>
      <linearGradient id="${E}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#000" stop-opacity="0.16"/><stop offset="0.06" stop-color="#000" stop-opacity="0"/>
        <stop offset="0.94" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.12"/></linearGradient></defs>`;
    // tyres: single front axle, dual rear axle
    for (const sy of [-1, 1]) {
      s += rect(X(0.82) - 6.5, sy < 0 ? -w - 1.1 : w - 3.6, 13, 4.7, 2, '#141518');
      s += rect(X(0.26) - 12, sy < 0 ? -w - 1.1 : w - 3.6, 24, 4.7, 2, '#141518');
      s += `<line x1="${X(0.26)}" y1="${sy * (w - 1)}" x2="${X(0.26)}" y2="${sy * (w + 1)}" stroke="#2c2e33" stroke-width="0.8"/>`;
    }
    // rabbit-ear mirrors (arms reach forward past the nose)
    for (const sy of [-1, 1]) {
      s += `<path d="M${h - 7},${sy * (w - 0.5)} Q${h - 1},${sy * (w + 3.4)} ${h + 2.6},${sy * (w + 2.2)}" stroke="#1d1f23" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
      s += `<ellipse cx="${h + 2.8}" cy="${sy * (w + 1.6)}" rx="1.5" ry="2.6" fill="#22252a" stroke="#000" stroke-width="0.3"/>`;
      s += `<ellipse cx="${h + 3.2}" cy="${sy * (w + 1.6)}" rx="0.6" ry="1.8" fill="#6d8aa6" opacity="0.8"/>`;
    }
    // hull + livery skirt (shows along both flanks)
    s += `<path d="${body(-h, -w, L, W, 5.5, 3)}" fill="url(#${P})" stroke="rgba(0,0,0,0.65)" stroke-width="0.8"/>`;
    // side window bands with window pillars
    for (const sy of [-1, 1]) {
      const y0 = sy < 0 ? -w + 1.3 : w - 5.1;
      s += rect(X(0.05), y0, X(0.9) - X(0.05), 3.8, 1, `url(#${G})`, 'stroke="rgba(0,0,0,0.5)" stroke-width="0.35"');
      for (let x = X(0.05) + 11; x < X(0.9) - 3; x += 11) s += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y0 + 3.8}" stroke="${shade(c, -0.1)}" stroke-width="1.3"/>`;
      // passenger door (front, kerb side) shown as a framed gap in the windows
      if (sy < 0) s += rect(X(0.83), y0 - 0.2, 9, 4.2, 0.8, '#1a222c', `stroke="${dk}" stroke-width="0.6"`);
      // reflective line along the window band
      s += `<line x1="${X(0.06)}" y1="${y0 + 0.9}" x2="${X(0.88)}" y2="${y0 + 0.9}" stroke="#fff" stroke-opacity="0.22" stroke-width="0.5"/>`;
    }
    // wrap-round windscreen, split in two, with wipers and a sun visor strip
    s += `<path d="M${h - 9},${-w + 2} L${h - 3},${-w + 3.2} Q${h - 0.6},0 ${h - 3},${w - 3.2} L${h - 9},${w - 2} Q${h - 7.2},0 ${h - 9},${-w + 2} Z" fill="url(#${G})" stroke="rgba(0,0,0,0.7)" stroke-width="0.5"/>`;
    s += `<line x1="${h - 8.2}" y1="0" x2="${h - 1.4}" y2="0" stroke="${shade(c, -0.3)}" stroke-width="1"/>`;
    for (const sy of [-1, 1]) s += `<line x1="${h - 3.4}" y1="${sy * 1.5}" x2="${h - 6.6}" y2="${sy * (w - 5)}" stroke="#0b0c0e" stroke-width="0.55" stroke-linecap="round"/>`;
    s += `<path d="M${h - 7},${-w + 4} Q${h - 4.2},${-w * 0.2} ${h - 3.4},${-w * 0.05}" stroke="#fff" stroke-opacity="0.35" stroke-width="0.7" fill="none"/>`;
    // rear window
    s += `<path d="M${-h + 0.9},${-w + 4.5} Q${-h - 0.2},0 ${-h + 0.9},${w - 4.5} L${-h + 3},${w - 4.8} L${-h + 3},${-w + 4.8} Z" fill="url(#${G})" stroke="rgba(0,0,0,0.6)" stroke-width="0.4"/>`;
    // roof (curved: darker towards the gutters) with rain gutters
    const r0 = -h + 3.6, r1 = h - 9.6, rw = W - 9.6;
    s += rect(r0, -rw / 2, r1 - r0, rw, 3, `url(#${R})`, 'stroke="rgba(0,0,0,0.35)" stroke-width="0.5"');
    for (const sy of [-1, 1]) s += `<line x1="${r0 + 2}" y1="${sy * (rw / 2 - 0.6)}" x2="${r1 - 1}" y2="${sy * (rw / 2 - 0.6)}" stroke="rgba(0,0,0,0.28)" stroke-width="0.5"/>`;
    // livery stripes along the roof edges and a coloured front cap / destination board
    for (const sy of [-1, 1]) s += rect(r0 + 4, sy < 0 ? -rw / 2 + 1.4 : rw / 2 - 2.8, r1 - r0 - 8, 1.4, 0.6, c, 'opacity="0.9"');
    s += rect(r1 - 7, -rw / 2 + 0.6, 6.4, rw - 1.2, 2, `url(#${P})`, 'stroke="rgba(0,0,0,0.3)" stroke-width="0.4"');
    s += rect(r1 - 5.6, -rw / 2 + 4, 3.2, rw - 8, 0.6, '#14161a');
    s += `<text x="${r1 - 4}" y="0" transform="rotate(90 ${r1 - 4} 0)" font-family="Arial, sans-serif" font-weight="700" font-size="2.4" text-anchor="middle" dominant-baseline="middle" fill="#ffb627">MVSR · NADERGUL</text>`;
    // roof panel seams
    for (let x = r0 + 10; x < r1 - 8; x += 10.5) s += `<line x1="${x}" y1="${-rw / 2 + 3}" x2="${x}" y2="${rw / 2 - 3}" stroke="rgba(0,0,0,0.075)" stroke-width="0.6"/>`;
    for (const sy of [-1, 1]) s += `<line x1="${r0 + 3}" y1="${sy * (rw / 2 - 4.4)}" x2="${r1 - 8}" y2="${sy * (rw / 2 - 4.4)}" stroke="rgba(255,255,255,0.45)" stroke-width="0.5"/>`;
    // roof-top AC unit: housing, louvres and two condenser fans
    const ax0 = X(0.36), ax1 = X(0.6), aw = rw - 9;
    s += rect(ax0 + 0.8, -aw / 2 + 0.9, ax1 - ax0, aw, 2.6, 'rgba(0,0,0,0.18)');
    s += rect(ax0, -aw / 2, ax1 - ax0, aw, 2.6, `url(#${A})`, 'stroke="rgba(0,0,0,0.45)" stroke-width="0.5"');
    for (let x = ax0 + 3; x < ax1 - 2; x += 2.2) for (const sy of [-1, 1]) s += `<line x1="${x}" y1="${sy * (aw / 2 - 1.2)}" x2="${x}" y2="${sy * (aw / 2 - 3.6)}" stroke="rgba(0,0,0,0.25)" stroke-width="0.5"/>`;
    for (const fx of [0.33, 0.67]) {
      const cx = ax0 + (ax1 - ax0) * fx;
      s += `<circle cx="${cx}" cy="0" r="${aw * 0.26}" fill="#59616b" stroke="rgba(0,0,0,0.5)" stroke-width="0.4"/>`;
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; s += `<line x1="${cx}" y1="0" x2="${cx + Math.cos(a) * aw * 0.23}" y2="${Math.sin(a) * aw * 0.23}" stroke="#2c3036" stroke-width="0.9" stroke-linecap="round"/>`; }
      s += `<circle cx="${cx}" cy="0" r="0.9" fill="#c9ced4"/>`;
    }
    // escape hatches (front and rear) with grab handles
    for (const fx of [0.1, 0.74]) {
      const hx = X(fx);
      s += rect(hx - 5 + 0.6, -5 + 0.7, 10, 10, 1.4, 'rgba(0,0,0,0.15)');
      s += rect(hx - 5, -5, 10, 10, 1.4, '#e4e7ea', 'stroke="rgba(0,0,0,0.45)" stroke-width="0.5"');
      s += rect(hx - 3.6, -3.6, 7.2, 7.2, 0.8, 'none', 'stroke="rgba(0,0,0,0.18)" stroke-width="0.5"');
      s += `<line x1="${hx - 2}" y1="0" x2="${hx + 2}" y2="0" stroke="#e63946" stroke-width="0.9" stroke-linecap="round"/>`;
    }
    // college name painted on the roof, between the rear hatch and the AC
    if (o.label) s += `<text x="${(X(0.1) + 5 + ax0) / 2}" y="0.3" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="7.6" letter-spacing="0.6" text-anchor="middle" dominant-baseline="middle" fill="${dk}" opacity="0.9">${o.label}</text>`;
    // rear roof ladder
    for (const sy of [-1, 1]) s += `<line x1="${-h + 0.8}" y1="${sy * 3.4}" x2="${-h + 9}" y2="${sy * 3.4}" stroke="#3a3d42" stroke-width="0.8" stroke-linecap="round"/>`;
    for (let x = -h + 2; x <= -h + 8.5; x += 2.2) s += `<line x1="${x}" y1="-3.4" x2="${x}" y2="3.4" stroke="#3a3d42" stroke-width="0.6"/>`;
    // gloss + end shading over the roof
    s += rect(r0, -rw / 2, r1 - r0, rw, 3, `url(#${S})`);
    s += rect(r0, -rw / 2, r1 - r0, rw, 3, `url(#${E})`);
    // lights: headlights, indicators, tail and reversing lights
    for (const sy of [-1, 1]) {
      s += rect(h - 2.3, sy > 0 ? w - 6.4 : -w + 2.4, 2, 4, 0.8, '#fff8de', 'stroke="rgba(0,0,0,0.4)" stroke-width="0.3"');
      s += rect(h - 2.1, sy > 0 ? w - 2.4 : -w + 1, 1.6, 1.4, 0.5, '#ffa31a');
      s += rect(-h + 0.3, sy > 0 ? w - 6.8 : -w + 2.2, 1.8, 4.6, 0.7, '#d6242f', 'stroke="rgba(0,0,0,0.4)" stroke-width="0.3"');
      s += rect(-h + 0.4, sy > 0 ? w - 8.6 : -w + 6.8, 1.5, 1.6, 0.5, '#f1f1f1');
    }
    return wrap(L, W, 6, s, 6);
  }


  // ── Delivery truck: cab + cargo box ──
  function truck(o) {
    const { L, W } = o, i = ++uid, h = L / 2, w = W / 2, cab = o.color || '#2f6fb3';
    const P = `p${i}`, B = `b${i}`, G = `g${i}`, S = `s${i}`;
    let s = `<defs>${paint(P, cab)}${paint(B, '#f3f4f6', 0.3)}${glass(G)}${gloss(S)}</defs>`;
    for (const fx of [0.12, 0.3, 0.85]) for (const sy of [-1, 1]) s += rect(-h + L * fx - 6, sy < 0 ? -w - 1 : w - 3.8, 12, 4.8, 2, '#15171b');
    const cabL = L * 0.27;
    s += `<path d="${body(h - cabL, -w + 1, cabL, W - 2, 7, 2)}" fill="url(#${P})" stroke="rgba(0,0,0,0.6)" stroke-width="0.7"/>`;
    s += `<path d="M${h - 9},${-w + 3.5} L${h - 3},${-w + 5} Q${h - 1.5},0 ${h - 3},${w - 5} L${h - 9},${w - 3.5} Z" fill="url(#${G})"/>`;
    s += rect(h - cabL + 3, -w + 5, cabL - 13, W - 10, 3, shade(cab, 0.15), 'stroke="rgba(0,0,0,0.3)" stroke-width="0.5"');
    s += `<path d="${body(-h, -w, L - cabL - 2, W, 2, 2)}" fill="url(#${B})" stroke="rgba(0,0,0,0.55)" stroke-width="0.7"/>`;
    s += rect(-h + 4, -w + 3, L - cabL - 10, 3.5, 1, o.stripe || '#e63946');
    s += rect(-h + 4, w - 6.5, L - cabL - 10, 3.5, 1, o.stripe || '#e63946');
    for (let x = -h + 10; x < h - cabL - 6; x += 10) s += `<line x1="${x}" y1="${-w + 8}" x2="${x}" y2="${w - 8}" stroke="rgba(0,0,0,0.08)" stroke-width="0.8"/>`;
    s += rect(-h, -w, L - cabL - 2, W, 2, `url(#${S})`);
    for (const sy of [-1, 1]) { s += rect(h - 2.2, sy > 0 ? w - 7 : -w + 2.5, 1.8, 4.5, 0.8, '#fff8de'); s += rect(-h + 0.2, sy > 0 ? w - 6 : -w + 1.5, 1.6, 4.5, 0.6, '#d6242f'); }
    return wrap(L, W, 3, s);
  }

  // ── Auto-rickshaw: teardrop body, single front wheel, canvas canopy ──
  function auto(o) {
    const { L, W } = o, i = ++uid, h = L / 2, w = W / 2, c = o.color || '#2e9e4f', top = o.top || '#f5c518';
    const P = `p${i}`, T = `t${i}`, G = `g${i}`, S = `s${i}`;
    let s = `<defs>${paint(P, c)}${paint(T, top, 0.3)}${glass(G)}${gloss(S)}</defs>`;
    s += rect(h - 9, -2.2, 9, 4.4, 1.6, '#15171b');
    for (const sy of [-1, 1]) s += rect(-h + 5, sy < 0 ? -w : w - 4, 10, 4, 1.6, '#15171b');
    s += `<path d="M${-h + 2},${-w + 1} L${h * 0.25},${-w + 1} Q${h},${-w * 0.45} ${h - 1},0 Q${h},${w * 0.45} ${h * 0.25},${w - 1} L${-h + 2},${w - 1} Q${-h},${w - 1} ${-h},${w - 4} L${-h},${-w + 4} Q${-h},${-w + 1} ${-h + 2},${-w + 1} Z" fill="url(#${P})" stroke="rgba(0,0,0,0.6)" stroke-width="0.7"/>`;
    s += `<path d="M${h * 0.32},${-w * 0.62} Q${h * 0.62},0 ${h * 0.32},${w * 0.62} L${h * 0.18},${w * 0.66} Q${h * 0.42},0 ${h * 0.18},${-w * 0.66} Z" fill="url(#${G})"/>`;
    s += `<path d="M${-h + 1.5},${-w + 2.2} L${h * 0.2},${-w + 2.5} Q${h * 0.36},0 ${h * 0.2},${w - 2.5} L${-h + 1.5},${w - 2.2} Q${-h - 0.5},0 ${-h + 1.5},${-w + 2.2} Z" fill="url(#${T})" stroke="rgba(0,0,0,0.45)" stroke-width="0.6"/>`;
    for (let k = 1; k < 4; k++) s += `<line x1="${-h + 1.5 + k * (h * 1.2 / 4)}" y1="${-w + 3}" x2="${-h + 1.5 + k * (h * 1.2 / 4)}" y2="${w - 3}" stroke="rgba(0,0,0,0.12)" stroke-width="0.8"/>`;
    s += `<path d="M${-h + 1.5},${-w + 2.2} L${h * 0.2},${-w + 2.5} Q${h * 0.36},0 ${h * 0.2},${w - 2.5} L${-h + 1.5},${w - 2.2} Z" fill="url(#${S})"/>`;
    s += `<circle cx="${h - 3}" cy="0" r="1.8" fill="#fff8de" stroke="rgba(0,0,0,0.4)" stroke-width="0.4"/>`;
    return wrap(L, W, 3, s);
  }

  // ── Scooter and bicycle (rider is drawn by the game on top) ──
  function scooter(o) {
    const { L, W } = o, i = ++uid, h = L / 2, w = W / 2, c = o.color || '#d62839', P = `p${i}`;
    let s = `<defs>${paint(P, c, 0.35)}</defs>`;
    s += rect(h - 9, -2, 9, 4, 1.5, '#15171b'); s += rect(-h, -2, 9, 4, 1.5, '#15171b');
    s += `<path d="M${-h + 4},${-w + 2} L${h * 0.35},${-w + 3} Q${h - 3},0 ${h * 0.35},${w - 3} L${-h + 4},${w - 2} Q${-h + 1},0 ${-h + 4},${-w + 2} Z" fill="url(#${P})" stroke="rgba(0,0,0,0.6)" stroke-width="0.6"/>`;
    s += `<ellipse cx="${-h * 0.25}" cy="0" rx="${h * 0.42}" ry="${w * 0.48}" fill="#26272c" stroke="rgba(0,0,0,0.5)" stroke-width="0.4"/>`;
    s += `<ellipse cx="${-h * 0.32}" cy="${-w * 0.15}" rx="${h * 0.22}" ry="${w * 0.14}" fill="#fff" opacity="0.18"/>`;
    s += `<line x1="${h * 0.42}" y1="${-w - 1}" x2="${h * 0.42}" y2="${w + 1}" stroke="#2b2d33" stroke-width="1.6" stroke-linecap="round"/>`;
    for (const sy of [-1, 1]) s += `<circle cx="${h * 0.5}" cy="${sy * (w + 0.6)}" r="1.3" fill="#9aa3ad"/>`;
    s += `<circle cx="${h - 2.5}" cy="0" r="1.6" fill="#fff8de"/>`;
    return wrap(L, W, 3, s);
  }
  function bicycle(o) {
    const { L, W } = o, h = L / 2, w = W / 2, c = o.color || '#2a9d8f';
    let s = '';
    s += rect(h - 12, -1.4, 12, 2.8, 1.3, '#1a1b1f'); s += rect(-h, -1.4, 12, 2.8, 1.3, '#1a1b1f');
    s += `<line x1="${-h + 6}" y1="0" x2="${h - 6}" y2="0" stroke="${c}" stroke-width="2.4" stroke-linecap="round"/>`;
    s += `<line x1="${h * 0.42}" y1="${-w}" x2="${h * 0.42}" y2="${w}" stroke="#2b2d33" stroke-width="1.5" stroke-linecap="round"/>`;
    s += rect(-h * 0.45, -2, 7, 4, 1.8, '#26272c');
    return wrap(L, W, 3, s);
  }

  // ── Catalogue ──
  const CAR_PAINTS = ['#eef1f5', '#c3c9d1', '#24272d', '#b3222b', '#2456a6', '#5d646d', '#6e1f2b', '#e7e2d6', '#1f6f5c'];
  const carOf = (L, W, color, extra = {}) => (c) => car({ L, W, color: c || color, ...extra });
  const MODELS = {
    sedan:  { L: 80, W: 34, src: 'assets/vehicles/parkingfury/sedan.png',  make: carOf(80, 34, '#a8adb2') },
    hatch:  { L: 66, W: 33, src: 'assets/vehicles/parkingfury/hatch.png',  make: carOf(66, 33, '#3a8fc4', { ws0: 0.5, ws1: 0.66, rw0: 0.1, rw1: 0.2, rf: 0.36, rr: 0.32 }) },
    suv:    { L: 84, W: 37, src: 'assets/vehicles/parkingfury/suv.png',    make: carOf(84, 37, '#c9c4a6', { ws0: 0.6, ws1: 0.72, rw0: 0.06, rw1: 0.13, rr: 0.2, extra: ({ X, rW }) => `<path d="M${X(0.14)},${-rW / 2 + 2.2} L${X(0.58)},${-rW / 2 + 2.2} M${X(0.14)},${rW / 2 - 2.2} L${X(0.58)},${rW / 2 - 2.2}" stroke="#1d1f23" stroke-width="1.3" stroke-linecap="round"/>` }) },
    taxi:   { L: 78, W: 34, src: 'assets/vehicles/parkingfury/taxi.png',   make: () => car({ L: 78, W: 34, color: '#f5c518', roof: '#f5c518', extra: ({ X }) => `<rect x="${X(0.36)}" y="-3.2" width="8" height="6.4" rx="1.2" fill="#1d1f23"/><text x="${X(0.36) + 4}" y="1.6" font-family="Arial" font-weight="700" font-size="3.6" text-anchor="middle" fill="#f5c518">TAXI</text>` }) },
    police: { L: 80, W: 34, src: 'assets/vehicles/parkingfury/police.png', make: () => car({ L: 80, W: 34, color: '#f3f4f6', roof: '#f3f4f6', extra: ({ X }) => `<rect x="${X(0.38)}" y="-9" width="5" height="18" rx="1.5" fill="#1d1f23"/><rect x="${X(0.38) + 0.8}" y="-8" width="3.4" height="7.5" rx="1" fill="#e63946"/><rect x="${X(0.38) + 0.8}" y="0.5" width="3.4" height="7.5" rx="1" fill="#2a6ff0"/>` }) },
    van:    { L: 84, W: 37, src: 'assets/vehicles/parkingfury/van.png',    make: carOf(84, 37, '#d8d2b8', { ws0: 0.72, ws1: 0.84, rw0: 0.03, rw1: 0.08, rf: 0.42, rr: 0.14 }) },
    truck:  { L: 104, W: 38, src: 'assets/vehicles/parkingfury/truck.png', make: (c) => truck({ L: 104, W: 38, color: c || '#b08050' }) },
    bus:    { L: 146, W: 35, pad: 6, make: (c) => bus({ L: 146, W: 35, color: c || '#1f5fa8', label: 'MVSR' }) },
    car2:   { L: 80, W: 34, src: 'assets/vehicles/parkingfury/car2.png',   make: carOf(80, 34, '#3a7fb0') },
    car3:   { L: 80, W: 34, src: 'assets/vehicles/parkingfury/car3.png',   make: carOf(80, 34, '#a32a34') },
    car4:   { L: 78, W: 34, src: 'assets/vehicles/parkingfury/car4.png',   make: carOf(78, 34, '#b0302a') },
    car5:   { L: 80, W: 34, src: 'assets/vehicles/parkingfury/car5.png',   make: carOf(80, 34, '#2b2d33') },
    car6:   { L: 78, W: 34, src: 'assets/vehicles/parkingfury/car6.png',   make: carOf(78, 34, '#d8c23a') },
    car7:   { L: 82, W: 35, src: 'assets/vehicles/parkingfury/car7.png',   make: carOf(82, 35, '#6a6d70') },
    car8:   { L: 84, W: 37, src: 'assets/vehicles/parkingfury/car8.png',   make: carOf(84, 37, '#6f8f6a') },
    car9:   { L: 82, W: 35, src: 'assets/vehicles/parkingfury/car9.png',   make: carOf(82, 35, '#b58aa8') },
    car10:  { L: 80, W: 34, src: 'assets/vehicles/parkingfury/car10.png',  make: carOf(80, 34, '#a02828') },
    car11:  { L: 84, W: 37, src: 'assets/vehicles/parkingfury/car11.png',  make: carOf(84, 37, '#3f8fa8') },
    car12:  { L: 80, W: 34, src: 'assets/vehicles/parkingfury/car12.png',  make: carOf(80, 34, '#c8c6a8') },
    car13:  { L: 84, W: 37, src: 'assets/vehicles/parkingfury/car13.png',  make: carOf(84, 37, '#4a5a66') },
  };
  // Sprites are authored at the sizes above; everything on screen is drawn 1.3x so vehicles read clearly larger than people.
  const SCALE = 1.3;
  const CAR_MODELS = ['sedan', 'hatch', 'suv', 'car2', 'car3', 'car4', 'car5', 'car6', 'car7', 'car8', 'car9', 'car10', 'car11', 'car12', 'car13'];
  function makeShadow(L, W) {
    const m = 6, s = 2, c = document.createElement('canvas');
    c.width = Math.ceil((L + m * 2) * s); c.height = Math.ceil((W + m * 2) * s);
    const g = c.getContext('2d');
    g.filter = `blur(${3 * s}px)`; g.fillStyle = '#000';
    g.beginPath();
    if (g.roundRect) g.roundRect(m * s, m * s, L * s, W * s, Math.min(L, W) * 0.3 * s);
    else g.rect(m * s, m * s, L * s, W * s);
    g.fill(); g.filter = 'none';
    return c;
  }
  const cache = new Map();
  function get(model, color) {
    const m = MODELS[model] || MODELS.sedan, key = model + '|' + (m.src ? '' : (color || ''));
    let e = cache.get(key);
    if (!e) {
      const L = m.L * SCALE, W = m.W * SCALE;
      e = { img: null, L, W, shadow: makeShadow(L, W) };
      cache.set(key, e);
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0);
        // mipmaps: half / quarter size copies, so a zoomed-out view doesn't shrink a big sprite every frame
        const mips = [c];
        for (let k = 0; k < 2 && mips[k].width > 96; k++) {
          const p = mips[k], h = document.createElement('canvas'); h.width = Math.ceil(p.width / 2); h.height = Math.ceil(p.height / 2);
          const hg = h.getContext('2d'); hg.imageSmoothingEnabled = true; hg.imageSmoothingQuality = 'high'; hg.drawImage(p, 0, 0, h.width, h.height); mips.push(h);
        }
        e.mips = mips; e.img = c;
      };
      const svg = () => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(m.make(color));
      if (m.src) {
        im.onerror = () => { im.onerror = null; im.src = svg(); };
        im.src = m.src;
      } else {
        im.src = svg();
      }
    }
    return e;
  }
  // Draw centred at (x, y), facing `ang` radians. opts: { alpha, shadow (0..1) }
  function draw(g, model, color, x, y, ang, opts = {}) {
    const e = get(model, color); if (!e.img) return false;
    const pad = ((MODELS[model] || MODELS.sedan).pad || 3) * SCALE, dw = e.L + pad * 2, dh = e.W + pad * 2;
    g.save(); g.translate(x, y);
    if (opts.shadow !== 0) {
      const m = 6;
      g.save(); g.translate(5, 7); g.rotate(ang);
      g.globalAlpha = 0.3 * (opts.shadow ?? 1);
      g.drawImage(e.shadow, -(e.L + m * 2) / 2, -(e.W + m * 2) / 2, e.L + m * 2, e.W + m * 2);
      g.restore();
    }
    g.rotate(ang); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'medium';
    // smallest mipmap that still has at least ~1.2 image pixels per screen pixel
    let im = e.img;
    if (e.mips && g.getTransform) { const m = g.getTransform(), need = Math.hypot(m.a, m.b) * dw * 1.2; for (const c of e.mips) if (c.width >= need) im = c; }
    g.drawImage(im, -dw / 2, -dh / 2, dw, dh);
    g.restore();
    return true;
  }
  // warm the common models up front
  function preload() { for (const m of CAR_MODELS) get(m, ''); for (const m of ['taxi', 'police', 'van', 'truck']) get(m, ''); get('bus', ''); }
  return { get, draw, preload, MODELS, CAR_PAINTS, CAR_MODELS, SCALE, size: (m) => { const e = MODELS[m] || MODELS.sedan; return { L: e.L * SCALE, W: e.W * SCALE }; } };
})();
VehicleArt.preload();
