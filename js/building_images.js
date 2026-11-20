'use strict';
// ─────────────────────────────────────────────────────────────
//  Pictures uploaded in the Map Editor for each building:
//    b.img.roof  – the roof seen from above
//    b.img.front – the front wall
//  Each picture is stretched to fit its part of the building, so a plain rectangular photo/drawing works.
//  Shared by the game (art.js) and the Map Editor.
// ─────────────────────────────────────────────────────────────
const BIMG_CACHE = {};
function buildingImage(src) {
  if (!src) return null;
  let im = BIMG_CACHE[src];
  if (!im) {
    im = BIMG_CACHE[src] = new Image();
    im.onload = () => { if (typeof window.onBuildingImage === 'function') window.onBuildingImage(); };
    im.src = src;
  }
  return im.complete && im.naturalWidth ? im : null;
}
const bpic = (b, part) => buildingImage(b && b.img && b.img[part]);

const picRect = (g, im, r) => g.drawImage(im, r.x, r.y, r.w, r.h);

// Draw every uploaded picture of a building in world coordinates (used by the editor preview).
function paintBuildingPictures(g, b) {
  if (!b.img) return;
  const P = buildingParts(b), front = bpic(b, 'front'), roof = bpic(b, 'roof');
  if (front) picRect(g, front, P.wallR);
  if (roof) picRect(g, roof, P.roofR);
}
