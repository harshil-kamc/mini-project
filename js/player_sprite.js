'use strict';
// Animated main-character sprite, loaded as per-frame PNGs from assets/characters/<animation>/NN.png (104x84 frames, feet at the cell bottom).
// Animations: idle(7) · walk_down(8) · walk_up(8) · walk_left(8) · walk_right(8). Portrait: assets/characters/portrait_player.png.
const PLAYER_SPRITE = (() => {
  const ROOT = 'assets/characters';
  const anim = { idle: 'idle', down: 'walk_down', up: 'walk_up', left: 'walk_left', right: 'walk_right' };
  const frames = { idle: 7, down: 8, up: 8, left: 8, right: 8 };
  const P = { cw: 104, ch: 84, frames, ready: false, portrait: ROOT + '/portrait_player.png', img: {} };
  let pending = 0;
  for (const key in anim) {
    P.img[key] = [];
    for (let i = 1; i <= frames[key]; i++) {
      const im = new Image();
      pending++;
      // Mark ready once every frame has settled; drawing skips any frame that failed to load.
      im.onload = im.onerror = () => { if (--pending === 0) P.ready = true; };
      im.src = `${ROOT}/${anim[key]}/${String(i).padStart(2, '0')}.png`;
      P.img[key].push(im);
    }
  }
  return P;
})();
