'use strict';
// Hand-drawn portraits. The four friends have happy / sad / angry faces (sprites by judas la carotte); you, Prof. Lakshmi,
// Coach Mahesh and Mr. Sharma have one AI-generated portrait each in the same soft hand-drawn style. Others keep the drawn portraits.
const PORTRAIT_MOODS = { priya: ['happy', 'sad', 'angry'], sana: ['happy', 'sad', 'angry'], arjun: ['happy', 'sad', 'angry'], ravi: ['happy', 'sad', 'angry'],
  player: ['happy'], prof: ['happy'], coach: ['happy'], librarian: ['happy'] };
const FRIEND_ART = Object.keys(PORTRAIT_MOODS);
const portraitFile = (who, p) => { const ms = PORTRAIT_MOODS[who], m = moodOf(p); return `assets/itch/friends/${who}_${ms.includes(m) ? m : ms[0]}.png`; };
function moodOf(p) {
  if (p.mood) return p.mood;
  const t = p.text || '';
  if (/\bugh\b|STILL|GO!|I SAW|no excuses|marks deducted|!!/i.test(t)) return 'angry';
  if (/\blost\b|sorry|😭|\blose\b|next year|worrying|incomplete|missed/i.test(t)) return 'sad';
  return 'happy';
}
// ─────────────────────────────────────────────────────────────
//  Comic-book dialogue system.
//  Comic.play(panels, onDone) shows panels sequentially, three per page.
//  Panel shapes:
//    { who: 'ravi', text: '…' }                       speech with portrait
//    { who, text, options: [{ label, act, after }] }   choice; act() may return more panels
//    { scene: 'dawn', art: '🏫', sfx: 'BRRING!', caption: '…' }
//    { narr: '…' }                                     narration caption box
//    newPage: true on any panel forces a fresh page
// ─────────────────────────────────────────────────────────────

const Comic = (() => {
  const root = document.getElementById('comic');
  const page = document.getElementById('comic-page');
  let queue = [], onDone = null, after = [], count = 0, typing = null, current = null, open = false;
  let lookFor = () => CHARS.player;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function play(panels, done) {
    queue = panels.filter(Boolean);
    onDone = done || null;
    after = [];
    open = true;
    root.classList.remove('hidden');
    fresh();
    next();
  }

  function fresh() { page.innerHTML = ''; count = 0; }

  function next() {
    if (typing) { typing.finish(); return; }
    if (current && current.options) return;
    if (!queue.length) { close(); return; }
    const p = queue.shift();
    current = p;
    if (count >= 3 || p.newPage) fresh();
    const panel = build(p);
    page.appendChild(panel);
    count++;
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add('in')));
  }

  function typewrite(target, text, done) {
    let i = 0;
    const tick = setInterval(() => {
      i += 2;
      target.textContent = text.slice(0, i);
      if (i >= text.length) finish();
    }, 22);
    function finish() { clearInterval(tick); target.textContent = text; typing = null; done && done(); }
    typing = { finish };
  }

  function build(p) {
    const tilt = (Math.random() * 2 - 1).toFixed(2);
    if (p.scene) {
      const d = el('div', `panel scene bg-${p.scene}`);
      d.style.setProperty('--tilt', tilt + 'deg');
      if (p.art) { const ic = typeof Icons !== 'undefined' && Icons.fromEmoji(p.art); d.appendChild(el('div', 'art', ic ? Icons.svg(ic) : p.art)); }
      if (p.sfx) d.appendChild(el('div', 'sfx', p.sfx));
      if (p.caption) d.appendChild(el('div', 'caption', typeof Icons !== 'undefined' ? Icons.iconize(p.caption) : p.caption));
      return d;
    }
    if (p.narr) {
      const d = el('div', 'panel narr');
      d.style.setProperty('--tilt', tilt + 'deg');
      d.appendChild(el('div', 'caption', typeof Icons !== 'undefined' ? Icons.iconize(p.narr) : p.narr));
      return d;
    }
    const isPlayer = p.who === 'player';
    const L = isPlayer ? lookFor() : CHARS[p.who];
    const d = el('div', `panel speech ${isPlayer ? 'right' : 'left'}`);
    d.style.setProperty('--tilt', tilt + 'deg');
    const por = el('div', 'portrait');
    const img = new Image();
    if (FRIEND_ART.includes(p.who)) { img.src = portraitFile(p.who, p); img.className = 'hand'; }   // hand-drawn portrait
    else img.src = Portraits.get(p.who, L);
    por.appendChild(img);
    d.appendChild(por);
    const bub = el('div', 'bubble');
    bub.appendChild(el('div', 'name', isPlayer ? (L.name || 'You') : L.name));
    const txt = el('div', 'text');
    bub.appendChild(txt);
    d.appendChild(bub);
    const showOpts = () => {
      if (!p.options) return;
      const box = el('div', 'opts');
      p.options.forEach((o, i) => {
        const b = el('button', 'opt' + (o.disabled ? ' disabled' : ''), `<kbd>${i + 1}</kbd> ${o.label}${o.disabled ? ` <small>(${o.disabled})</small>` : ''}`);
        b.onclick = (ev) => { ev.stopPropagation(); choose(i); };
        box.appendChild(b);
      });
      bub.appendChild(box);
    };
    typewrite(txt, p.text || '', showOpts);
    return d;
  }

  function choose(i) {
    if (!current || !current.options || typing) return;
    const o = current.options[i];
    if (!o || o.disabled) return;
    const box = page.querySelector('.panel:last-child .opts');
    if (box) box.querySelectorAll('button').forEach((b, k) => { b.disabled = true; if (k === i) b.classList.add('chosen'); });
    current = null;
    const more = o.act ? o.act() : null;
    if (o.after) after.push(o.after);
    if (Array.isArray(more) && more.length) queue = more.filter(Boolean).concat(queue);
    next();
  }

  function close() {
    open = false; current = null;
    root.classList.add('hidden');
    page.innerHTML = '';
    const cb = onDone, aft = after;
    onDone = null; after = [];
    cb && cb();
    aft.forEach(f => f());
  }

  function key(e) {
    if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') { e.preventDefault(); next(); }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9 && current && current.options) choose(n - 1);
  }

  root.addEventListener('click', () => next());

  return { play, key, isOpen: () => open, setLook(fn) { lookFor = fn; } };
})();
