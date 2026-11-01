(() => {
'use strict';
// ---------- Grundopsætning ----------
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const stage = document.getElementById('stage');
const W = 960, H = 540, PW = 960, GUT = 20, GROUND = 468;
const INK = '#16131c', PAPER = '#fbfaff';
const TINTS = ['#d8ecff', '#ffe0ee', '#e6defd', '#dcf6e7', '#fff1c9', '#ffe3d2'];
const NAMES = ['Skyskoven', 'Bobletårnet', 'Slikmarkedet', 'Regnbuebroen', 'Månebyen', 'Monstermosen'];
const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
let scale = 1;

function resize() {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.max(1, Math.round(r.width * dpr));
  cv.height = Math.max(1, Math.round(r.height * dpr));
  scale = cv.width / W;
}
new ResizeObserver(resize).observe(cv);
resize();

const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Screentone-mønster (prikker), som i rigtig manga
const toneCanvas = document.createElement('canvas');
toneCanvas.width = toneCanvas.height = 8;
{ const t = toneCanvas.getContext('2d'); t.fillStyle = 'rgba(22,19,28,.28)'; t.beginPath(); t.arc(4, 4, 1.4, 0, 7); t.fill(); }
const tone = ctx.createPattern(toneCanvas, 'repeat');

// ---------- Gem / hent ----------
const SAVE_KEY = 'mangacorn-v1';
let save = { coins: 0, owned: [], worn: [], best: 1 };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && typeof s === 'object') save = Object.assign(save, s); } catch (e) {}
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

// kind 'look' = pynt man kan tage af og på. kind 'boost' = superkraft, der altid virker, når den er købt.
// slot: ting med samme slot kan ikke bæres samtidig (fx krone og blomsterkrans).
const ITEMS = [
  { id: 'bow', name: 'Rød sløjfe', price: 8, kind: 'look', desc: 'Sidder fint i manken.' },
  { id: 'socks', name: 'Stribede sokker', price: 10, kind: 'look', desc: 'Lyserøde striber på alle fire ben.' },
  { id: 'headband', name: 'Ninja-pandebånd', price: 12, kind: 'look', desc: 'Båndene flagrer, når du løber.' },
  { id: 'glasses', name: 'Stjernebriller', price: 15, kind: 'look', desc: 'Superseje solbriller.' },
  { id: 'wreath', name: 'Blomsterkrans', price: 18, kind: 'look', slot: 'head', desc: 'Små blomster rundt om hornet.' },
  { id: 'scarf', name: 'Halstørklæde', price: 22, kind: 'look', desc: 'Blødt og blåt og vifter i vinden.' },
  { id: 'cape', name: 'Heltekappe', price: 25, kind: 'look', desc: 'Blafrer, når du løber.' },
  { id: 'glitter', name: 'Glimmerhorn', price: 30, kind: 'look', desc: 'Hornet glimter i alle regnbuens farver.' },
  { id: 'rainbow', name: 'Regnbuemanke', price: 35, kind: 'look', desc: 'Manken skifter farve hele tiden.' },
  { id: 'crown', name: 'Guldkrone', price: 50, kind: 'look', slot: 'head', desc: 'Til den helt store mangahelt.' },
  { id: 'heart', name: 'Ekstra hjerte', price: 40, kind: 'boost', desc: 'Start hvert kapitel med 4 hjerter.' },
  { id: 'magnet', name: 'Møntmagnet', price: 45, kind: 'boost', desc: 'Mønter i nærheden flyver hen til dig.' },
  { id: 'bubble', name: 'Bobleskjold', price: 55, kind: 'boost', desc: 'En boble tager det første slag i hvert kapitel.' },
  { id: 'wings', name: 'Skyvinger', price: 60, kind: 'boost', desc: 'Dobbelthop i alle kapitler.' },
  { id: 'clover', name: 'Firkløver', price: 80, kind: 'boost', desc: 'Monstre giver 4 mønter i stedet for 2.' },
];

// ---------- Lyd (lille synth, starter efter første klik/tast) ----------
let actx = null, muted = false;
function initAudio() {
  if (actx) return;
  try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { actx = null; }
}
function beep(f, d, type = 'square', vol = .05, slide = 0, delay = 0) {
  if (muted || !actx) return;
  const t0 = actx.currentTime + delay;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + d);
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + d);
  o.connect(g).connect(actx.destination); o.start(t0); o.stop(t0 + d + .02);
}
function noise(d, vol) {
  if (muted || !actx) return;
  const len = Math.floor(actx.sampleRate * d), buf = actx.createBuffer(1, len, actx.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = actx.createBufferSource(), g = actx.createGain(); s.buffer = buf; g.gain.value = vol;
  s.connect(g).connect(actx.destination); s.start();
}
const sfx = {
  coin() { beep(1320, .07, 'square', .035); beep(1980, .12, 'square', .035, 0, .06); },
  jump() { beep(380, .16, 'square', .035, 760); },
  jump2() { beep(620, .16, 'triangle', .05, 1240); },
  pop() { beep(900, .14, 'sine', .07, 260); noise(.08, .06); },
  kapow() { noise(.28, .18); beep(180, .28, 'sawtooth', .07, 55); },
  hurt() { beep(320, .32, 'sawtooth', .05, 90); },
  power() { [660, 880, 1100, 1320].forEach((f, i) => beep(f, .12, 'square', .04, 0, i * .07)); },
  win() { [523, 659, 784, 1047].forEach((f, i) => beep(f, .2, 'triangle', .07, 0, i * .12)); },
};

// ---------- Baner (kapitler bygget af paneler) ----------
const CAPTIONS = {
  start: n => `Kapitel ${n}: ${NAMES[(n - 1) % NAMES.length]}`,
  coins: () => 'Sølvmønter med skyer! Saml dem!',
  steps: () => 'Hop op ad skyerne',
  blob: () => 'Pas på, en Blobbo! Hop på hovedet af den',
  twoblob: () => 'To Blobboer?!',
  bats: () => 'Et Tordenpust flyver rundt…',
  star: () => 'En regnbuestjerne gør dig uovervindelig',
  feather: () => 'En sky-fjer giver dobbelthop',
  goal: () => 'Løb videre til næste side!',
};

function buildLevel(n) {
  let seq;
  if (n === 1) seq = ['start', 'coins', 'steps', 'blob', 'star', 'goal'];
  else if (n === 2) seq = ['start', 'coins', 'feather', 'blob', 'bats', 'twoblob', 'goal'];
  else {
    const pool = ['coins', 'blob', 'steps', 'bats', 'star', 'twoblob', 'feather', 'bats', 'twoblob', 'blob'];
    seq = ['start'];
    const mids = 3 + Math.min(n, 5);
    let prev = '';
    for (let i = 0; i < mids; i++) { let t; do t = pick(pool); while (t === prev); seq.push(t); prev = t; }
    seq.push('goal');
  }
  const L = { panels: [], coins: [], monsters: [], plats: [], items: [], goal: 0, width: seq.length * PW, n };
  seq.forEach((type, p) => {
    const x = p * PW + GUT, w = PW - 2 * GUT;
    const bg = type === 'start' ? 'sky' : type === 'goal' ? 'burst' : ['speed', 'tone', 'sky', 'burst'][(p + n) % 4];
    const deco = { lines: [], rays: [], clouds: [] };
    for (let i = 0; i < 46; i++) deco.lines.push({ x: rand(-200, w), y: rand(40, GROUND - 16), len: rand(90, 380), lw: rand(1, 2.6) });
    for (let i = 0; i < 110; i++) deco.rays.push({ a: i / 110 * Math.PI * 2 + rand(-.01, .01), r: rand(190, 280), wd: rand(.004, .013) });
    for (let i = 0; i < 3; i++) deco.clouds.push({ x: rand(60, w - 170), y: rand(80, 210), s: rand(.8, 1.4) });
    L.panels.push({ x, w, type, bg, deco, caption: CAPTIONS[type](n) });
    fillPanel(L, type, x, n);
  });
  return L;
}

function fillPanel(L, type, ox, n) {
  const C = (x, y) => L.coins.push({ x: ox + x, y, ph: Math.random() * 6, taken: false });
  const P = (x, y, w) => L.plats.push({ x: ox + x, y, w });
  const B = (x0, x1) => L.monsters.push({ type: 'blob', x: ox + (x0 + x1) / 2, y: GROUND, min: ox + x0, max: ox + x1, vx: (70 + n * 10) * (Math.random() < .5 ? -1 : 1), alive: true, t: Math.random() * 6 });
  const F = (x0, x1, y) => L.monsters.push({ type: 'bat', x: ox + (x0 + x1) / 2, y, base: y, min: ox + x0, max: ox + x1, vx: 90 + n * 10, alive: true, t: Math.random() * 6 });
  const I = (kind, x, y) => L.items.push({ kind, x: ox + x, y, taken: false });
  switch (type) {
    case 'start': for (let i = 0; i < 5; i++) C(480 + i * 60, 432 - Math.sin(i / 4 * Math.PI) * 70); break;
    case 'coins': P(280, 360, 220); for (let i = 0; i < 4; i++) C(310 + i * 52, 326); for (let i = 0; i < 4; i++) C(620 + i * 60, 440); if (n > 1) B(560, 900); break;
    case 'steps': P(180, 390, 170); P(410, 310, 170); P(640, 230, 170); C(265, 356); C(495, 276); C(725, 196); C(725, 146); if (n > 2) B(80, 900); break;
    case 'blob': B(260, 880); for (let i = 0; i < 5; i++) C(480 + i * 45, 362 - Math.sin(i / 4 * Math.PI) * 40); if (n > 3) F(100, 800, 250); break;
    case 'twoblob': B(60, 400); B(520, 900); P(380, 330, 170); C(420, 296); C(465, 296); C(510, 296); break;
    case 'bats': P(200, 350, 180); C(250, 316); C(290, 316); C(330, 316); F(420, 880, 300); C(600, 440); C(660, 440); C(720, 440); break;
    case 'star': P(370, 330, 190); I('star', 465, 300); C(150, 440); C(210, 440); if (n > 1) B(600, 900); break;
    case 'feather': I('feather', 260, 430); P(560, 300, 150); P(740, 170, 150); C(635, 266); C(815, 136); C(815, 90); if (n >= 3) I('heart', 635, 236); break;
    case 'goal': L.goal = ox + 700; C(300, 440); C(360, 440); C(420, 440); if (n > 2) F(100, 600, 280); break;
  }
}

// ---------- Spiltilstand ----------
let state = 'title', chapter = save.best, level = buildLevel(chapter), player, cam = { x: 0, shake: 0 };
let fx = [], particles = [], runCoins = 0, bops = 0, time = 0, speech = null, endTimer = 0;
const ACC = 2600, MAXV = 330, FRICT = 2400, G = 2200, JV = 820;

function newPlayer(x) {
  const extra = save.owned.includes('heart') ? 1 : 0;
  return { x, y: GROUND, vx: 0, vy: 0, face: 1, onGround: true, jumps: 0, coyote: 0, buffer: 0,
    hearts: 3 + extra, maxHearts: 3 + extra, inv: 0, star: 0, feather: false, dbl: save.owned.includes('wings'), walk: 0, squash: 0,
    shield: save.owned.includes('bubble'), magnet: save.owned.includes('magnet') };
}
player = newPlayer(level.panels[0].x + 100);

// ---------- Input ----------
const keys = {}; const touch = { left: false, right: false, jump: false }; let jumpQueued = false;
const JUMPKEYS = [' ', 'arrowup', 'w'];
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  initAudio();
  if (state === 'play' && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
  if ((k === 'p' || k === 'escape') && (state === 'play' || state === 'pause')) { togglePause(); return; }
  if (JUMPKEYS.includes(k) && !e.repeat && state === 'play') jumpQueued = true;
  keys[k] = true;
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'play') togglePause(); });
stage.addEventListener('touchstart', () => stage.classList.add('touch-on'), { passive: true });
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k;
  const on = e => { e.preventDefault(); initAudio(); touch[k] = true; b.classList.add('on'); if (k === 'jump') jumpQueued = true; try { b.setPointerCapture(e.pointerId); } catch (_) {} };
  const off = () => { touch[k] = false; b.classList.remove('on'); };
  b.addEventListener('pointerdown', on);
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => b.addEventListener(ev, off));
});

// ---------- Effekter ----------
function burst(x, y, text, opts = {}) {
  const jit = []; for (let i = 0; i < 28; i++) jit.push(rand(.85, 1.15));
  fx.push({ kind: 'burst', x, y, text, t: 0, life: opts.life || .9, size: opts.size || 1, rot: rand(-.25, .25), jit,
    fill: opts.fill || '#ffe14a', color: opts.color || '#ff3b5c' });
}
function floatText(x, y, text) { fx.push({ kind: 'float', x, y, text, t: 0, life: .8 }); }
function sparkle(x, y, n, colors, speed = 260) {
  for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), s = rand(speed * .4, speed);
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: rand(.35, .7), t: 0, c: pick(colors), size: rand(4, 8), star: Math.random() < .5 }); }
}

// ---------- Opdatering ----------
function update(dt) {
  const p = player, L = level;
  time += 0;
  const left = keys.arrowleft || keys.a || touch.left, right = keys.arrowright || keys.d || touch.right;
  const held = keys[' '] || keys.arrowup || keys.w || touch.jump;
  if (jumpQueued) { p.buffer = .13; jumpQueued = false; } else p.buffer -= dt;

  if (endTimer > 0) { endTimer -= dt; if (endTimer <= 0) gameOver(); }

  const dir = (right ? 1 : 0) - (left ? 1 : 0);
  const maxv = MAXV * (p.star > 0 ? 1.3 : 1);
  if (endTimer > 0) { /* frosset mens "Åh nej" vises */ }
  else if (dir) { p.vx += dir * ACC * dt; p.face = dir; }
  else { const f = FRICT * dt; p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f; }
  p.vx = clamp(p.vx, -Math.max(maxv, Math.abs(p.vx) * .98), Math.max(maxv, Math.abs(p.vx) * .98));
  if (Math.abs(p.vx) > maxv && dir) p.vx = clamp(p.vx, -maxv, maxv);

  p.coyote = p.onGround ? .1 : p.coyote - dt;
  if (p.buffer > 0 && endTimer <= 0) {
    if (p.coyote > 0) { p.vy = -JV; p.onGround = false; p.coyote = 0; p.jumps = 1; p.buffer = 0; sfx.jump(); }
    else if ((p.dbl || p.feather) && p.jumps < 2) { p.vy = -JV * .92; p.jumps = 2; p.buffer = 0; sfx.jump2();
      sparkle(p.x, p.y - 10, 10, ['#ffffff', '#cfe8ff', '#ffd6ea'], 200); }
  }
  if (!held && p.vy < -250) p.vy += G * dt * 1.4;
  p.vy = Math.min(p.vy + G * dt, 1400);

  const prevY = p.y, wasGround = p.onGround;
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.x = clamp(p.x, GUT + 34, L.width - GUT - 34);
  p.onGround = false;
  const land = yy => { p.y = yy; if (!wasGround && p.vy > 450) p.squash = .2; p.vy = 0; p.onGround = true; };
  if (p.y >= GROUND) land(GROUND);
  for (const pl of L.plats) {
    if (p.vy >= 0 && prevY <= pl.y + 1 && p.y >= pl.y && p.x + 18 > pl.x && p.x - 18 < pl.x + pl.w) land(pl.y);
  }
  if (p.onGround) p.jumps = 0;
  p.walk += Math.abs(p.vx) * dt * .055;
  p.squash = Math.max(0, p.squash - dt * 1.2);
  p.inv = Math.max(0, p.inv - dt);
  if (p.star > 0) { p.star -= dt; if (Math.random() < .6) particles.push({ x: p.x - p.face * 30, y: p.y - rand(10, 60), vx: -p.face * 40, vy: rand(-30, 30), life: .5, t: 0, c: `hsl(${(time * 300) % 360} 95% 65%)`, size: rand(4, 7), star: true }); }

  // mønter
  const pcx = p.x, pcy = p.y - 38;
  for (const c of L.coins) {
    if (c.taken) continue;
    if (p.magnet && Math.hypot(c.x - pcx, c.y - pcy) < 200) { const k = Math.min(1, dt * 5); c.x += (pcx - c.x) * k; c.y += (pcy - c.y) * k; }
    if (Math.hypot(c.x - pcx, c.y - pcy) < 42) { c.taken = true; runCoins++; sfx.coin(); floatText(c.x, c.y - 10, '+1'); sparkle(c.x, c.y, 6, ['#ffffff', '#d5d9e2', '#a9b0bf'], 160); }
  }
  // power-ups
  for (const it of L.items) {
    if (it.taken) continue;
    if (Math.hypot(it.x - pcx, it.y - pcy) < 46) {
      it.taken = true; sfx.power();
      if (it.kind === 'star') { p.star = 8; burst(it.x, it.y - 30, 'ZOOM!', { fill: '#bff0ff', color: '#7a4dff' }); }
      if (it.kind === 'feather') { p.feather = true; burst(it.x, it.y - 30, 'SWOOSH!', { fill: '#ffffff', color: '#3a8fe0' }); }
      if (it.kind === 'heart') { p.hearts = Math.min(p.maxHearts + 1, p.hearts + 1); p.maxHearts = Math.max(p.maxHearts, p.hearts); burst(it.x, it.y - 30, 'JUBII!', { fill: '#ffd6ea', color: '#ff3b5c' }); }
      sparkle(it.x, it.y, 16, ['#ff7eb6', '#ffd23f', '#7cc6ff', '#a78bfa'], 300);
    }
  }
  // monstre
  for (const m of L.monsters) {
    if (!m.alive) continue;
    m.t += dt;
    m.x += m.vx * dt;
    if (m.x < m.min) { m.x = m.min; m.vx = Math.abs(m.vx); }
    if (m.x > m.max) { m.x = m.max; m.vx = -Math.abs(m.vx); }
    if (m.type === 'bat') m.y = m.base + Math.sin(m.t * 3) * 40;
    const my = m.type === 'blob' ? m.y - 28 : m.y, r = m.type === 'blob' ? 30 : 24;
    if (endTimer > 0) continue;
    if (Math.abs(m.x - p.x) < 26 + r * .8 && Math.abs(my - (p.y - 34)) < 30 + r * .8) {
      if (p.star > 0) defeat(m, my);
      else if (p.vy > 60 && p.y - 8 < my) { defeat(m, my); p.vy = -JV * .68; p.jumps = 1; p.onGround = false; }
      else if (p.inv <= 0) hurt(m);
    }
  }
  // mål
  if (L.goal && p.x > L.goal && endTimer <= 0) { chapterDone(); return; }

  // kamera glider fra panel til panel
  const target = clamp(Math.floor(p.x / PW) * PW, 0, L.width - W);
  cam.x += (target - cam.x) * Math.min(1, dt * 7);
  cam.shake = Math.max(0, cam.shake - dt * 40);
  if (speech) { speech.t -= dt; if (speech.t <= 0) speech = null; }
}

function defeat(m, my) {
  m.alive = false; bops++;
  burst(m.x, my - 20, pick(['KAPOW!', 'KAPOW!', 'BAM!', 'POW!']));
  if (!reduceMotion) cam.shake = 12;
  const gain = save.owned.includes('clover') ? 4 : 2;
  runCoins += gain; floatText(m.x + 40, my - 60, '+' + gain);
  sparkle(m.x, my, 16, ['#ffe14a', '#ff7eb6', '#ffffff', '#a78bfa'], 340);
  sfx.kapow();
}
function hurt(m) {
  const p = player;
  if (p.shield) {
    p.shield = false; p.inv = 1.2; sfx.pop();
    p.vx = (p.x < m.x ? -1 : 1) * 380; p.vy = -460; p.onGround = false;
    burst(p.x, p.y - 80, 'PLOP!', { size: .7, fill: '#dff3ff', color: '#3a8fe0', life: .6 });
    sparkle(p.x, p.y - 50, 18, ['#ffffff', '#cfe8ff', '#9fd3ff'], 320);
    return;
  }
  p.hearts--; p.inv = 1.5; sfx.hurt();
  p.vx = (p.x < m.x ? -1 : 1) * 420; p.vy = -520; p.onGround = false;
  burst(p.x, p.y - 80, 'AU!', { size: .7, fill: '#cfe8ff', color: '#2b6fd6', life: .6 });
  if (!reduceMotion) cam.shake = 7;
  if (p.hearts <= 0) endTimer = .9;
}

function tickEffects(dt) {
  for (const f of fx) f.t += dt;
  fx = fx.filter(f => f.t < f.life);
  for (const q of particles) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 600 * dt; }
  particles = particles.filter(q => q.t < q.life);
}

// ---------- Tegning ----------
function starPath(c, x, y, R, r, n = 5, rot = -Math.PI / 2) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, rr = i % 2 ? r : R; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath();
}
function heartPath(c, x, y, s) {
  c.beginPath(); c.moveTo(x, y + s * .3);
  c.bezierCurveTo(x, y - s * .15, x - s * .6, y - s * .15, x - s * .6, y + s * .25);
  c.bezierCurveTo(x - s * .6, y + s * .6, x - s * .1, y + s * .78, x, y + s);
  c.bezierCurveTo(x + s * .1, y + s * .78, x + s * .6, y + s * .6, x + s * .6, y + s * .25);
  c.bezierCurveTo(x + s * .6, y - s * .15, x, y - s * .15, x, y + s * .3); c.closePath();
}
// Tegn flere figurer som én silhuet: blæk-omrids først, så fyld ovenpå
function blob2(c, shapes, fill, lw = 3) {
  c.strokeStyle = INK; c.lineWidth = lw * 2; c.lineJoin = 'round';
  for (const s of shapes) { c.beginPath(); s(c); c.stroke(); }
  c.fillStyle = fill;
  for (const s of shapes) { c.beginPath(); s(c); c.fill(); }
}
const circ = (x, y, r) => c => c.arc(x, y, r, 0, Math.PI * 2);
const ell = (x, y, rx, ry, rot = 0) => c => c.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);

function cloud(c, x, y, s, fill = '#fff', lw = 1.4) {
  blob2(c, [circ(x - 7 * s, y + 2 * s, 5.5 * s), circ(x, y - 2.5 * s, 7 * s), circ(x + 7 * s, y + 2 * s, 5.5 * s), ell(x, y + 3.5 * s, 10 * s, 4.5 * s)], fill, lw);
}

function drawCoin(c, x, y, r, t, ph) {
  const sx = Math.max(.18, Math.abs(Math.cos(t * 2.6 + ph)));
  c.save(); c.translate(x, y); c.scale(sx, 1);
  const g = c.createRadialGradient(-r * .35, -r * .4, 1, 0, 0, r);
  g.addColorStop(0, '#ffffff'); g.addColorStop(.55, '#d5d9e2'); g.addColorStop(1, '#9aa1b0');
  c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fillStyle = g; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.arc(0, 0, r * .76, 0, Math.PI * 2); c.lineWidth = 1.5; c.strokeStyle = '#7f8697'; c.stroke();
  if (sx > .45) { c.strokeStyle = '#6f7687'; cloud(c, 0, 0, r * .062, '#ffffff', 1.1); }
  c.restore();
}

function drawPanel(pn) {
  const x = pn.x, y = GUT, w = pn.w, h = H - 2 * GUT, d = pn.deco;
  const tint = TINTS[(level.n - 1) % TINTS.length];
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = PAPER; ctx.fillRect(x, y, w, h);
  if (pn.bg === 'sky') {
    const g = ctx.createLinearGradient(0, y, 0, GROUND); g.addColorStop(0, tint); g.addColorStop(1, PAPER);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = tone; ctx.beginPath(); ctx.arc(x + w - 120, 110, 54, 0, 7); ctx.fill(); ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x + w - 120, 110, 54, 0, 7); ctx.stroke();
    for (const cl of d.clouds) cloud(ctx, x + cl.x + Math.sin(time * .3 + cl.x) * 10, cl.y, 4.2 * cl.s, '#ffffff', 2);
  } else if (pn.bg === 'speed') {
    ctx.fillStyle = tint; ctx.globalAlpha = .55; ctx.fillRect(x, y, w, h); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(22,19,28,.22)';
    for (const l of d.lines) { ctx.lineWidth = l.lw; ctx.beginPath(); ctx.moveTo(x + l.x, l.y); ctx.lineTo(x + l.x + l.len, l.y); ctx.stroke(); }
  } else if (pn.bg === 'tone') {
    ctx.fillStyle = tint; ctx.fillRect(x, y, w, h);
    ctx.save(); ctx.globalAlpha = .7; ctx.fillStyle = tone; ctx.fillRect(x, y, w, h); ctx.restore();
    const g = ctx.createRadialGradient(x + w * .5, 230, 30, x + w * .5, 230, 420);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.6, 'rgba(255,255,255,.65)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  } else if (pn.bg === 'burst') {
    const g = ctx.createRadialGradient(x + w / 2, 230, 20, x + w / 2, 230, 520);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, tint);
    ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    const cx = x + w / 2, cy = 230, R = 820; ctx.fillStyle = 'rgba(22,19,28,.5)';
    for (const r of d.rays) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(r.a - r.wd) * R, cy + Math.sin(r.a - r.wd) * R);
      ctx.lineTo(cx + Math.cos(r.a) * r.r, cy + Math.sin(r.a) * r.r);
      ctx.lineTo(cx + Math.cos(r.a + r.wd) * R, cy + Math.sin(r.a + r.wd) * R);
      ctx.fill();
    }
  }
  // jorden
  ctx.fillStyle = tint; ctx.fillRect(x, GROUND, w, H);
  ctx.save(); ctx.globalAlpha = .55; ctx.fillStyle = tone; ctx.fillRect(x, GROUND, w, H); ctx.restore();
  ctx.strokeStyle = 'rgba(22,19,28,.55)'; ctx.lineWidth = 2;
  for (let i = 4; i < w; i += 15) { ctx.beginPath(); ctx.moveTo(x + i, GROUND + 7); ctx.lineTo(x + i + 9, GROUND + 17); ctx.stroke(); }
  ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(x + w, GROUND); ctx.stroke();
  ctx.restore();
  // panelramme
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.strokeRect(x, y, w, h);
}

function drawCaption(pn) {
  ctx.font = '700 19px "Zen Maru Gothic", "Trebuchet MS", sans-serif';
  const tw = ctx.measureText(pn.caption).width, bw = tw + 30, bx = pn.x + pn.w / 2 - bw / 2, by = GUT + 14;
  ctx.fillStyle = '#fff'; ctx.fillRect(bx, by, bw, 36);
  ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeRect(bx, by, bw, 36);
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(pn.caption, bx + bw / 2, by + 19);
}

function drawCloudPlat(pl) {
  const { x, y, w } = pl, shapes = [c => c.roundRect ? c.roundRect(x, y + 2, w, 22, 11) : c.rect(x, y + 2, w, 22)];
  const n = Math.max(2, Math.round(w / 26));
  for (let i = 0; i < n; i++) shapes.push(circ(x + 14 + i * (w - 28) / (n - 1), y + 8, 12 + (i % 2) * 2));
  blob2(ctx, shapes, '#ffffff', 2.5);
  ctx.save(); ctx.globalAlpha = .45; ctx.fillStyle = tone; ctx.fillRect(x + 8, y + 14, w - 16, 8); ctx.restore();
}

function drawItem(it) {
  const bob = Math.sin(time * 3 + it.x) * 5, x = it.x, y = it.y + bob;
  ctx.save();
  if (it.kind === 'star') {
    ctx.translate(x, y); ctx.rotate(Math.sin(time * 2) * .2);
    const g = ctx.createLinearGradient(-22, -22, 22, 22);
    for (let i = 0; i <= 4; i++) g.addColorStop(i / 4, `hsl(${(time * 160 + i * 70) % 360} 95% 66%)`);
    starPath(ctx, 0, 0, 24, 11); ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(-4, -1, 2, 3, 0, 0, 7); ctx.ellipse(4, -1, 2, 3, 0, 0, 7); ctx.fill();
  } else if (it.kind === 'feather') {
    ctx.translate(x, y); ctx.rotate(-.6 + Math.sin(time * 2) * .15);
    ctx.beginPath(); ctx.ellipse(0, 0, 10, 26, 0, 0, 7); ctx.fillStyle = '#eef8ff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, -22); ctx.lineWidth = 2; ctx.stroke();
    for (let i = -14; i < 18; i += 7) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(7, i - 6); ctx.moveTo(0, i); ctx.lineTo(-7, i - 6); ctx.lineWidth = 1.2; ctx.stroke(); }
  } else if (it.kind === 'heart') {
    heartPath(ctx, x, y - 14, 30); ctx.fillStyle = '#ff5e9a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  }
  ctx.restore();
}

function drawBlob(m) {
  const sq = Math.sin(m.t * 8) * .06, dir = Math.sign(player.x - m.x) || 1;
  ctx.save(); ctx.translate(m.x, m.y); ctx.scale(1 + sq, 1 - sq);
  ctx.beginPath(); ctx.moveTo(-34, 0); ctx.bezierCurveTo(-38, -42, -20, -58, 0, -58); ctx.bezierCurveTo(20, -58, 38, -42, 34, 0); ctx.closePath();
  const g = ctx.createLinearGradient(0, -58, 0, 0); g.addColorStop(0, '#dccdff'); g.addColorStop(1, '#a98cf7');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  // lille spire
  ctx.beginPath(); ctx.moveTo(0, -58); ctx.quadraticCurveTo(3, -68, 0, -72); ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(7, -73, 8, 4, -.4, 0, 7); ctx.fillStyle = '#8be0a4'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
  for (const ex of [-12, 12]) {
    ctx.beginPath(); ctx.ellipse(ex, -33, 9.5, 12, 0, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(ex + dir * 2.5, -31, 5.5, 7.5, 0, 0, 7); ctx.fillStyle = INK; ctx.fill();
    ctx.beginPath(); ctx.arc(ex + dir * 2.5 - 2, -35, 2.2, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
  }
  ctx.beginPath(); ctx.moveTo(-6, -14); ctx.quadraticCurveTo(0, -9, 6, -14); ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(1, -12.5); ctx.lineTo(5, -13.5); ctx.lineTo(3.5, -9); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,111,174,.55)'; ctx.beginPath(); ctx.ellipse(-22, -18, 5, 3, 0, 0, 7); ctx.ellipse(22, -18, 5, 3, 0, 0, 7); ctx.fill();
  ctx.restore();
}

function drawBat(m) {
  const fl = Math.sin(m.t * 14) * .5, dir = Math.sign(player.x - m.x) || 1;
  ctx.save(); ctx.translate(m.x, m.y);
  for (const side of [-1, 1]) {
    ctx.save(); ctx.scale(side, 1); ctx.rotate(fl * .6);
    ctx.beginPath(); ctx.moveTo(14, -4); ctx.lineTo(46, -18); ctx.lineTo(42, -2); ctx.lineTo(35, -6); ctx.lineTo(29, 3); ctx.lineTo(20, 2); ctx.closePath();
    ctx.fillStyle = '#7a7898'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke(); ctx.restore();
  }
  ctx.beginPath(); ctx.moveTo(-3, 12); ctx.lineTo(4, 20); ctx.lineTo(-1, 21); ctx.lineTo(5, 30); ctx.lineTo(-5, 20); ctx.lineTo(0, 19); ctx.closePath();
  ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = INK; ctx.stroke();
  blob2(ctx, [circ(-12, 2, 12), circ(0, -6, 15), circ(12, 2, 12), circ(0, 5, 13)], '#a6a8c4', 2.5);
  for (const ex of [-6, 6]) {
    ctx.beginPath(); ctx.ellipse(ex, -2, 5, 6.5, 0, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.arc(ex + dir * 1.6, -1, 3, 0, 7); ctx.fillStyle = INK; ctx.fill();
    ctx.beginPath(); ctx.arc(ex + dir * 1.6 - 1, -2.5, 1.2, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
  }
  ctx.restore();
}

function drawGoal(gx) {
  const x = gx + 30, y = GROUND;
  ctx.save();
  ctx.fillStyle = '#c99b6d'; ctx.fillRect(x + 50, y - 120, 12, 120); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeRect(x + 50, y - 120, 12, 120);
  ctx.beginPath(); ctx.moveTo(x - 10, y - 178); ctx.lineTo(x + 124, y - 178); ctx.lineTo(x + 156, y - 149); ctx.lineTo(x + 124, y - 120); ctx.lineTo(x - 10, y - 120); ctx.closePath();
  ctx.fillStyle = '#ffcf3f'; ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
  ctx.font = '34px Bangers, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK;
  ctx.fillText('VIDERE!', x + 62, y - 147);
  for (let i = 0; i < 3; i++) { const a = time * 2 + i * 2.1; starPath(ctx, x + 70 + Math.cos(a) * 110, y - 150 + Math.sin(a) * 60, 9, 4); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
}

function maneColors(rainbow, t) {
  if (rainbow) return [0, 1, 2, 3].map(i => `hsl(${(t * 140 + i * 70) % 360} 92% 72%)`);
  return ['#ff9ecb', '#c9a2ff', '#ff7eb6', '#b4dcff'];
}

// Enhjørningen. Origo = mellem fødderne, kigger mod højre.
function drawUnicorn(c, p, t, looks, opts = {}) {
  const has = id => looks.includes(id);
  const mc = maneColors(has('rainbow'), t);
  const moving = Math.abs(p.vx) > 20;
  const sw = moving ? Math.sin(p.walk) * (p.onGround ? .55 : .2) : 0;
  const air = !p.onGround;
  c.save(); c.translate(p.x, p.y); c.scale(p.face, 1);
  c.scale(1 + p.squash, 1 - p.squash);
  c.lineJoin = 'round'; c.lineCap = 'round';
  if (opts.star) { c.shadowColor = `hsl(${(t * 300) % 360} 95% 60%)`; c.shadowBlur = 22; }

  if (has('cape')) {
    const fl = Math.sin(t * 10) * (moving ? 6 : 2);
    c.beginPath(); c.moveTo(14, -46); c.quadraticCurveTo(-14, -52, -42, -38 + fl); c.lineTo(-36, -14 + fl * .6); c.quadraticCurveTo(-10, -22, 10, -30); c.closePath();
    c.fillStyle = '#ff4f6d'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
  }
  // hale
  blob2(c, [circ(-33, -40, 9), circ(-41, -32, 8.5), circ(-39, -21, 7.5)], mc[0], 2.5);
  c.fillStyle = mc[1]; c.beginPath(); c.arc(-41, -32, 5, 0, 7); c.fill();
  // ben
  const leg = (x, ang, fill) => {
    c.save(); c.translate(x, -24); c.rotate(air ? (x > 0 ? -.5 : .5) : ang);
    c.beginPath(); c.roundRect ? c.roundRect(-5, 0, 10, 25, 4) : c.rect(-5, 0, 10, 25); c.fillStyle = fill; c.fill();
    if (has('socks')) { c.fillStyle = fill === '#ffffff' ? '#ff7eb6' : '#e56aa3'; for (const sy of [5, 11]) c.fillRect(-5, sy, 10, 3.5); }
    c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.rect(-5, 18, 10, 7); c.fillStyle = '#c4b2ea'; c.fill(); c.stroke();
    c.restore();
  };
  leg(-19, sw, '#ebe4f7'); leg(13, -sw, '#ebe4f7');
  leg(-9, -sw, '#ffffff'); leg(21, sw, '#ffffff');
  // krop, hals, hoved, mule som én silhuet
  c.shadowBlur = 0;
  blob2(c, [ell(0, -34, 32, 19), ell(20, -50, 10, 17, -.5), circ(31, -64, 19), ell(45, -56, 11.5, 9.5)], '#ffffff', 3);
  if (opts.star) { c.shadowBlur = 0; }
  c.fillStyle = '#fff0f7'; c.beginPath(); c.ellipse(46, -55, 10, 8, 0, 0, 7); c.fill();
  c.fillStyle = INK; c.beginPath(); c.arc(51, -57, 1.6, 0, 7); c.fill();
  c.beginPath(); c.moveTo(43, -50); c.quadraticCurveTo(47, -47, 51, -50); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
  // vinger
  if (opts.wings) {
    const fl = Math.sin(t * (air ? 18 : 4)) * .35;
    c.save(); c.translate(-4, -46); c.rotate(-.3 + fl);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-10, -30, -30, -34); c.quadraticCurveTo(-26, -22, -32, -16); c.quadraticCurveTo(-22, -12, -24, -4); c.quadraticCurveTo(-12, -4, 0, 0);
    c.fillStyle = '#eef8ff'; c.fill(); c.lineWidth = 2.5; c.stroke(); c.restore();
  }
  // øre
  c.beginPath(); c.moveTo(21, -76); c.lineTo(25, -91); c.lineTo(31, -78); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.lineWidth = 3; c.stroke();
  c.beginPath(); c.moveTo(24, -78); c.lineTo(25.5, -86); c.lineTo(28.5, -79); c.closePath(); c.fillStyle = '#ffc3dd'; c.fill();
  // horn
  c.beginPath(); c.moveTo(29, -80); c.lineTo(43, -108); c.lineTo(38, -78); c.closePath();
  if (has('glitter')) {
    const hg = c.createLinearGradient(30, -78, 43, -108);
    for (let i = 0; i <= 4; i++) hg.addColorStop(i / 4, `hsl(${(t * 160 + i * 75) % 360} 100% 66%)`);
    c.fillStyle = hg;
  } else c.fillStyle = '#ffd23f';
  c.fill(); c.lineWidth = 3; c.stroke();
  c.lineWidth = 1.8; for (let i = 0; i < 3; i++) { const yy = -84 - i * 7; c.beginPath(); c.moveTo(31 + i * 2.4, yy + 1); c.lineTo(38.5 + i * 1.2, yy - 3); c.stroke(); }
  // manke
  blob2(c, [circ(19, -80, 8.5), circ(13, -70, 10), circ(10, -57, 9.5), circ(10, -45, 8)], mc[0], 2.5);
  c.fillStyle = mc[1]; c.beginPath(); c.arc(13, -70, 5.5, 0, 7); c.fill();
  c.fillStyle = mc[2]; c.beginPath(); c.arc(10, -51, 5, 0, 7); c.fill();
  c.fillStyle = mc[3]; c.beginPath(); c.arc(19, -81, 4, 0, 7); c.fill();
  // stort manga-øje
  const blink = (Math.floor(t * 10) % 37) === 0;
  if (blink) { c.beginPath(); c.moveTo(29, -63); c.quadraticCurveTo(35, -59, 41, -63); c.lineWidth = 3; c.stroke(); }
  else {
    c.beginPath(); c.ellipse(35, -64, 7, 9.5, 0, 0, 7); c.fillStyle = INK; c.fill();
    c.beginPath(); c.ellipse(35.5, -61, 5, 6, 0, 0, 7); c.fillStyle = '#7a4dff'; c.fill();
    c.beginPath(); c.arc(32.5, -68, 2.8, 0, 7); c.fillStyle = '#fff'; c.fill();
    c.beginPath(); c.arc(37.5, -59, 1.4, 0, 7); c.fill();
    c.beginPath(); c.moveTo(40, -71); c.lineTo(45, -75); c.lineWidth = 2.2; c.strokeStyle = INK; c.stroke();
  }
  c.fillStyle = 'rgba(255,111,174,.55)'; c.beginPath(); c.ellipse(40, -52, 5, 3, 0, 0, 7); c.fill();
  // tilbehør
  if (has('bow')) {
    c.save(); c.translate(15, -85); c.rotate(-.3);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-12, -8); c.lineTo(-12, 8); c.closePath(); c.moveTo(0, 0); c.lineTo(12, -8); c.lineTo(12, 8); c.closePath();
    c.fillStyle = '#ff3b5c'; c.fill(); c.lineWidth = 2.2; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.arc(0, 0, 3.5, 0, 7); c.fill(); c.stroke(); c.restore();
  }
  if (has('scarf')) {
    const fl = Math.sin(t * 9) * (moving || air ? 5 : 1.5);
    c.lineJoin = 'round';
    for (const [dy, len] of [[-4, 1], [4, .75]]) {
      c.beginPath(); c.moveTo(12, -52); c.quadraticCurveTo(-2, -54 + dy + fl, -20 * len, -54 + dy * 1.6 + fl * 1.5);
      c.lineTo(-20 * len + 1, -46 + dy * 1.6 + fl * 1.5); c.quadraticCurveTo(-1, -46 + dy + fl * .5, 12, -46); c.closePath();
      c.fillStyle = '#5aa8f0'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
      c.fillStyle = '#ffffff'; c.fillRect(-20 * len + 5, -52 + dy * 1.6 + fl * 1.5, 3, 5);
    }
    c.beginPath(); c.moveTo(10, -53); c.quadraticCurveTo(22, -40, 38, -45); c.lineWidth = 13; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke();
    c.lineWidth = 8; c.strokeStyle = '#7cc0ff'; c.stroke();
    c.beginPath(); c.arc(12, -50, 5.5, 0, 7); c.fillStyle = '#5aa8f0'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
  }
  if (has('headband')) {
    const fl = Math.sin(t * 12) * (moving || air ? 6 : 2);
    c.lineWidth = 2.2; c.strokeStyle = INK;
    for (const [dy, len] of [[-3, 1], [4, .8]]) {
      c.beginPath(); c.moveTo(15, -76); c.quadraticCurveTo(2, -78 + dy + fl, (-14 * len), -76 + dy * 2 + fl * 1.5);
      c.lineTo(-14 * len + 2, -70 + dy * 2 + fl * 1.5); c.quadraticCurveTo(4, -72 + dy + fl * .5, 15, -71); c.closePath();
      c.fillStyle = '#ff3b5c'; c.fill(); c.stroke();
    }
    c.save(); c.beginPath(); c.arc(31, -64, 19.5, 0, 7); c.clip();
    c.translate(31, -64); c.rotate(.12);
    c.fillStyle = '#ff3b5c'; c.fillRect(-26, -16, 52, 7);
    c.beginPath(); c.moveTo(-26, -16); c.lineTo(26, -16); c.moveTo(-26, -9); c.lineTo(26, -9); c.lineWidth = 2.2; c.stroke();
    c.restore();
    c.beginPath(); c.arc(31, -64, 19, 0, 7); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
  }
  if (has('wreath')) {
    const cols = ['#ff7eb6', '#ffd23f', '#ffffff', '#b98cff'];
    for (let i = 0; i < 6; i++) {
      const a = -2.55 + i * .36, fx2 = 31 + Math.cos(a) * 19, fy = -64 + Math.sin(a) * 19;
      c.save(); c.translate(fx2, fy); c.rotate(t * .5 + i);
      if (i % 2) { c.beginPath(); c.ellipse(6, 3, 5, 2.5, .6, 0, 7); c.fillStyle = '#5ccf8a'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = INK; c.stroke(); }
      c.fillStyle = cols[i % cols.length]; c.lineWidth = 1.6; c.strokeStyle = INK;
      for (let k = 0; k < 5; k++) { const pa = k * Math.PI * 2 / 5; c.beginPath(); c.arc(Math.cos(pa) * 3.6, Math.sin(pa) * 3.6, 2.9, 0, 7); c.fill(); c.stroke(); }
      c.beginPath(); c.arc(0, 0, 2.2, 0, 7); c.fillStyle = '#ffcf3f'; c.fill(); c.stroke();
      c.restore();
    }
  }
  if (has('crown')) {
    c.save(); c.translate(33, -82); c.rotate(.18);
    c.beginPath(); c.moveTo(-13, 4); c.lineTo(-15, -10); c.lineTo(-7, -3); c.lineTo(0, -14); c.lineTo(7, -3); c.lineTo(15, -10); c.lineTo(13, 4); c.closePath();
    c.fillStyle = '#ffcf3f'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.moveTo(-13, 0); c.lineTo(13, 0); c.lineWidth = 1.6; c.stroke();
    for (const [gx, col] of [[-7, '#ff3b5c'], [0, '#7cc6ff'], [7, '#5ccf8a']]) { c.beginPath(); c.arc(gx, 2.2, 2, 0, 7); c.fillStyle = col; c.fill(); c.lineWidth = 1.2; c.stroke(); }
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-15, -10, 1.8, 0, 7); c.arc(15, -10, 1.8, 0, 7); c.fill();
    c.beginPath(); c.arc(0, -14, 1.8, 0, 7); c.fill();
    c.restore();
  }
  if (has('glitter')) {
    for (let i = 0; i < 3; i++) {
      const k = (t * 1.3 + i / 3) % 1, s = Math.sin(k * Math.PI) * 5;
      if (s > .5) { starPath(c, [46, 30, 50][i], [-104, -98, -88][i] - k * 6, s, s * .4, 4, 0); c.fillStyle = '#ffffff'; c.fill(); c.lineWidth = 1.4; c.strokeStyle = INK; c.stroke(); }
    }
  }
  if (has('glasses')) {
    starPath(c, 35, -64, 12.5, 6.5); c.fillStyle = 'rgba(42,35,64,.92)'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#ffb800'; c.stroke();
    c.beginPath(); c.moveTo(46, -65); c.lineTo(52, -63); c.strokeStyle = INK; c.lineWidth = 2; c.stroke();
    c.beginPath(); c.moveTo(30, -69); c.lineTo(33, -66); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
  }
  if (opts.bubble) {
    const wob = Math.sin(t * 3) * 2;
    c.beginPath(); c.ellipse(8, -54, 66 + wob, 62 - wob, 0, 0, 7);
    c.fillStyle = 'rgba(160,215,255,.16)'; c.fill(); c.lineWidth = 3; c.strokeStyle = 'rgba(58,143,224,.75)'; c.stroke();
    c.beginPath(); c.ellipse(8, -54, 54, 50, 0, -2.6, -1.9); c.lineWidth = 4; c.strokeStyle = 'rgba(255,255,255,.95)'; c.stroke();
    c.beginPath(); c.arc(-30, -96, 4, 0, 7); c.fillStyle = 'rgba(255,255,255,.95)'; c.fill();
  }
  c.restore();
}

function drawBurstFx(f) {
  const k = f.t / f.life;
  const s = (k < .15 ? (k / .15) * 1.15 : 1.15 - .15 * Math.min(1, (k - .15) / .2)) * f.size;
  ctx.save(); ctx.globalAlpha = k > .7 ? 1 - (k - .7) / .3 : 1;
  ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.scale(s, s);
  const n = 14;
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) { const a = i * Math.PI / n, r = (i % 2 ? 46 : 84) * f.jit[i]; ctx.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * .85); }
  ctx.closePath(); ctx.fillStyle = f.fill; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  ctx.font = '60px Bangers, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 8; ctx.strokeStyle = INK; ctx.strokeText(f.text, 0, 3);
  ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 3);
  ctx.restore();
}
function drawFloat(f) {
  const k = f.t / f.life;
  ctx.save(); ctx.globalAlpha = 1 - k; ctx.font = '30px Bangers, Impact, sans-serif'; ctx.textAlign = 'center';
  ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeText(f.text, f.x, f.y - k * 50); ctx.fillStyle = '#e8ebf2'; ctx.fillText(f.text, f.x, f.y - k * 50);
  ctx.restore();
}

function drawSpeech(p) {
  if (!speech) return;
  const x = p.x + 30, y = p.y - 150;
  ctx.save(); ctx.font = '700 20px "Zen Maru Gothic", "Trebuchet MS", sans-serif';
  const tw = ctx.measureText(speech.text).width;
  ctx.beginPath(); ctx.ellipse(x + tw / 2, y, tw / 2 + 26, 28, 0, 0, 7);
  ctx.moveTo(x + 6, y + 22); ctx.lineTo(x - 6, y + 50); ctx.lineTo(x + 22, y + 24);
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x + tw / 2, y, tw / 2 + 24, 26, 0, 0, 7); ctx.fill();
  ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(speech.text, x, y + 1);
  ctx.restore();
}

function drawHUD() {
  const p = player;
  ctx.save();
  for (let i = 0; i < p.maxHearts; i++) {
    heartPath(ctx, 48 + i * 36, 34, 28); ctx.fillStyle = i < p.hearts ? '#ff5e9a' : '#ffffff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  }
  drawCoin(ctx, 48, 92, 15, time, 0);
  ctx.font = '32px Bangers, Impact, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const txt = String(save.coins + runCoins);
  ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeText(txt, 72, 94); ctx.fillStyle = '#fff'; ctx.fillText(txt, 72, 94);
  let y = 126;
  if (p.star > 0) {
    ctx.fillStyle = '#fff'; ctx.fillRect(34, y, 124, 12); const g = ctx.createLinearGradient(34, 0, 158, 0);
    for (let i = 0; i <= 5; i++) g.addColorStop(i / 5, `hsl(${(time * 200 + i * 60) % 360} 95% 62%)`);
    ctx.fillStyle = g; ctx.fillRect(34, y, 124 * p.star / 8, 12); ctx.lineWidth = 2.5; ctx.strokeRect(34, y, 124, 12); y += 26;
  }
  ctx.font = '700 14px "Zen Maru Gothic", sans-serif'; ctx.fillStyle = INK;
  if (p.dbl || p.feather) { ctx.fillText('Dobbelthop', 36, y + 6); y += 20; }
  if (p.shield) { ctx.fillText('Bobleskjold', 36, y + 6); }
  ctx.restore();
}

function draw() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  const sx = cam.shake ? rand(-cam.shake, cam.shake) : 0, sy = cam.shake ? rand(-cam.shake, cam.shake) : 0;
  ctx.save(); ctx.translate(-Math.round(cam.x) + sx, sy);
  const L = level, vis = pn => pn.x + pn.w > cam.x - 40 && pn.x < cam.x + W + 40;
  for (const pn of L.panels) if (vis(pn)) drawPanel(pn);
  // tynd sti over mellemrummet mellem panelerne
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
  for (let i = 1; i < L.panels.length; i++) { const gx = i * PW - GUT; ctx.beginPath(); ctx.moveTo(gx, GROUND); ctx.lineTo(gx + 2 * GUT, GROUND); ctx.stroke(); }
  ctx.setLineDash([]);
  const near = o => o.x > cam.x - 80 && o.x < cam.x + W + 80;
  for (const pl of L.plats) if (pl.x + pl.w > cam.x - 40 && pl.x < cam.x + W + 40) drawCloudPlat(pl);
  if (L.goal) drawGoal(L.goal);
  for (const c of L.coins) if (!c.taken && near(c)) drawCoin(ctx, c.x, c.y + Math.sin(time * 3 + c.ph) * 3, 15, time, c.ph);
  for (const it of L.items) if (!it.taken && near(it)) drawItem(it);
  for (const m of L.monsters) if (m.alive && near(m)) (m.type === 'blob' ? drawBlob : drawBat)(m);
  // fartstreger bag enhjørningen
  const p = player;
  if (Math.abs(p.vx) > 270) {
    ctx.strokeStyle = 'rgba(22,19,28,.5)'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) { const yy = p.y - 22 - i * 16, x0 = p.x - p.face * (46 + i * 6); ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 - p.face * (30 + i * 10), yy); ctx.stroke(); }
  }
  ctx.save();
  if (p.inv > 0 && Math.floor(time * 20) % 2) ctx.globalAlpha = .35;
  drawUnicorn(ctx, p, time, save.worn, { wings: p.dbl || p.feather, star: p.star > 0, bubble: p.shield });
  ctx.restore();
  for (const q of particles) {
    ctx.save(); ctx.globalAlpha = 1 - q.t / q.life; ctx.fillStyle = q.c;
    if (q.star) { starPath(ctx, q.x, q.y, q.size, q.size * .45); ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(q.x, q.y, q.size * .5, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  for (const pn of L.panels) if (vis(pn)) drawCaption(pn);
  drawSpeech(p);
  for (const f of fx) (f.kind === 'burst' ? drawBurstFx : drawFloat)(f);
  ctx.restore();
  if (state === 'play' || state === 'pause') drawHUD();
}

// ---------- Skærme og flow ----------
const $ = id => document.getElementById(id);
const screens = { title: $('scrTitle'), done: $('scrDone'), over: $('scrOver'), pause: $('scrPause'), shop: $('scrShop') };
function show(name) { for (const k in screens) screens[k].hidden = k !== name; }
function refreshLabels() {
  $('titleCoins').textContent = save.coins;
  $('btnPlay').textContent = `Spil kapitel ${save.best}`;
  $('btnShopGo').textContent = `Spil kapitel ${save.best}`;
}
function goTitle() { state = 'title'; refreshLabels(); show('title'); }

function startChapter(n) {
  initAudio();
  chapter = n; level = buildLevel(n); player = newPlayer(level.panels[0].x + 100);
  cam.x = 0; cam.shake = 0; runCoins = 0; bops = 0; fx = []; particles = []; endTimer = 0;
  speech = { text: n === 1 ? 'Lad os gå!' : pick(['Videre!', 'Nyt kapitel!', 'Mere eventyr!']), t: 2.4 };
  for (const k in keys) keys[k] = false;
  state = 'play'; show(null);
  cv.focus?.();
}
function chapterDone() {
  state = 'done'; sfx.win();
  save.coins += runCoins; save.best = Math.max(save.best, chapter + 1); persist();
  $('doneText').textContent = `Du samlede ${runCoins} sølvmønter${bops ? ` og lavede ${bops} × KAPOW` : ''}. Nu har du ${save.coins} mønter i alt.`;
  $('btnNext').textContent = `Kapitel ${chapter + 1}`;
  show('done');
}
function gameOver() {
  state = 'over';
  save.coins += runCoins; persist();
  $('overText').textContent = runCoins ? `Monstrene fik dig denne gang. Du beholder dine ${runCoins} mønter fra kapitlet.` : 'Monstrene fik dig denne gang. Prøv at hoppe på dem ovenfra!';
  show('over');
}
function togglePause() {
  if (state === 'play') { state = 'pause'; show('pause'); $('btnResume').focus(); }
  else if (state === 'pause') { state = 'play'; show(null); }
}

// Butik
let shopReturn = 'title';
function openShop(from) { shopReturn = from; state = 'shop'; renderShop(); refreshLabels(); show('shop'); }
function renderShop() {
  $('shopCoins').textContent = save.coins;
  const grid = $('shopGrid'); grid.innerHTML = '';
  const groups = [['Pynt', 'look'], ['Superkræfter', 'boost']];
  for (const [title, kind] of groups) {
  const head = document.createElement('h3'); head.className = 'shophead'; head.textContent = title; grid.append(head);
  for (const it of ITEMS.filter(i => i.kind === kind).sort((a, b) => a.price - b.price)) {
    const owned = save.owned.includes(it.id), worn = save.worn.includes(it.id);
    const card = document.createElement('div'); card.className = 'card' + (worn ? ' worn' : '');
    const pc = document.createElement('canvas'); pc.width = 240; pc.height = 180;
    const h = document.createElement('h3'); h.textContent = it.name;
    const d = document.createElement('p'); d.textContent = it.desc;
    const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (owned ? ' alt' : ''); b.id = 'shop-' + it.id;
    if (!owned) { b.textContent = `Køb · ${it.price}`; b.disabled = save.coins < it.price; b.onclick = () => buy(it); }
    else if (it.kind === 'look') { b.textContent = worn ? 'Tag af' : 'Tag på'; b.onclick = () => toggleWear(it); }
    else { b.textContent = 'Aktiv'; b.disabled = true; }
    card.append(pc, h, d, b); grid.append(card);
    drawPreview(pc, it);
  }
  }
}
function drawPreview(pc, it) {
  const c = pc.getContext('2d');
  c.fillStyle = '#f3f0fb'; c.fillRect(0, 0, 240, 180);
  c.save(); c.globalAlpha = .5; c.fillStyle = c.createPattern(toneCanvas, 'repeat'); c.fillRect(0, 130, 240, 50); c.restore();
  c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 130); c.lineTo(240, 130); c.stroke();
  if (it.id === 'heart') { heartPath(c, 120, 40, 90); c.fillStyle = '#ff5e9a'; c.fill(); c.lineWidth = 4; c.strokeStyle = INK; c.stroke(); return; }
  if (it.id === 'magnet') { drawMagnetPreview(c); return; }
  if (it.id === 'clover') { drawCloverPreview(c); return; }
  const looks = it.kind === 'look' ? [it.id] : [];
  c.save(); c.translate(120, 130); c.scale(1.25, 1.25); c.translate(-120, -130);
  drawUnicorn(c, { x: 108, y: 130, vx: 0, face: 1, onGround: true, walk: 0, squash: 0 }, time, looks, { wings: it.id === 'wings', bubble: it.id === 'bubble' });
  c.restore();
}
function drawMagnetPreview(c) {
  c.save(); c.translate(84, 82); c.rotate(-.35);
  c.lineCap = 'butt';
  c.beginPath(); c.arc(0, 0, 30, Math.PI * .5, Math.PI * 1.5); c.lineWidth = 26; c.strokeStyle = INK; c.stroke();
  c.beginPath(); c.arc(0, 0, 30, Math.PI * .5, Math.PI * 1.5); c.lineWidth = 20; c.strokeStyle = '#ff3b5c'; c.stroke();
  for (const sy of [-30, 30]) {
    c.fillStyle = '#ff3b5c'; c.fillRect(0, sy - 10, 18, 20); c.fillStyle = '#e8ebf2'; c.fillRect(18, sy - 10, 14, 20);
    c.lineWidth = 3; c.strokeStyle = INK; c.strokeRect(0, sy - 10, 32, 20); c.beginPath(); c.moveTo(18, sy - 10); c.lineTo(18, sy + 10); c.stroke();
  }
  c.restore();
  c.strokeStyle = INK; c.lineWidth = 2.5; c.lineCap = 'round';
  for (const [x, y] of [[150, 52], [176, 90], [158, 120]]) { c.beginPath(); c.moveTo(x - 14, y); c.lineTo(x - 30, y); c.stroke(); }
  drawCoin(c, 168, 52, 13, time, 0); drawCoin(c, 196, 90, 13, time, 1.5); drawCoin(c, 176, 120, 13, time, 3);
}
function drawCloverPreview(c) {
  c.save(); c.translate(104, 76);
  c.beginPath(); c.moveTo(0, 8); c.quadraticCurveTo(6, 40, -6, 56); c.lineWidth = 5; c.strokeStyle = INK; c.stroke();
  c.lineWidth = 3; c.strokeStyle = '#3bb06e'; c.stroke();
  for (let i = 0; i < 4; i++) {
    c.save(); c.rotate(i * Math.PI / 2 + Math.PI / 4);
    c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-26, -18, -16, -44, 0, -30); c.bezierCurveTo(16, -44, 26, -18, 0, 0);
    c.fillStyle = '#5ccf8a'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); c.restore();
  }
  c.beginPath(); c.arc(0, 0, 4, 0, 7); c.fillStyle = '#3bb06e'; c.fill();
  c.restore();
  drawCoin(c, 168, 62, 15, time, 0);
  c.font = '30px Bangers, Impact, sans-serif'; c.textAlign = 'center'; c.lineWidth = 6; c.strokeStyle = INK; c.strokeText('×2', 172, 108); c.fillStyle = '#ffcf3f'; c.fillText('×2', 172, 108);
}
function wear(it) {
  save.worn = save.worn.filter(id => { const o = ITEMS.find(x => x.id === id); return !(it.slot && o && o.slot === it.slot); });
  save.worn.push(it.id);
}
function buy(it) {
  if (save.coins < it.price) return;
  save.coins -= it.price; save.owned.push(it.id);
  if (it.kind === 'look') wear(it);
  persist(); sfx.power(); renderShop(); $('shop-' + it.id)?.focus();
}
function toggleWear(it) {
  if (save.worn.includes(it.id)) save.worn = save.worn.filter(x => x !== it.id); else wear(it);
  persist(); renderShop(); $('shop-' + it.id)?.focus();
}

$('btnPlay').onclick = () => startChapter(save.best);
$('btnShopFromTitle').onclick = () => openShop('title');
$('btnNext').onclick = () => startChapter(chapter + 1);
$('btnShopFromDone').onclick = () => openShop('done');
$('btnRetry').onclick = () => startChapter(chapter);
$('btnShopFromOver').onclick = () => openShop('over');
$('btnResume').onclick = () => togglePause();
$('btnHome').onclick = () => goTitle();
$('btnShopGo').onclick = () => startChapter(save.best);
$('btnShopHome').onclick = () => goTitle();
$('btnPause').onclick = () => { initAudio(); if (state === 'play' || state === 'pause') togglePause(); };
$('btnMute').onclick = () => { initAudio(); muted = !muted; $('btnMute').textContent = muted ? 'Lyd: fra' : 'Lyd: til'; };

// ---------- Løkke ----------
let last = performance.now();
function frame(now) {
  const dt = Math.min(.033, (now - last) / 1000); last = now;
  time += dt;
  if (state === 'play') { update(dt); tickEffects(dt); }
  else if (state === 'title') { player.walk += 0; }
  draw();
  requestAnimationFrame(frame);
}
refreshLabels();
show('title');
requestAnimationFrame(frame);
})();
