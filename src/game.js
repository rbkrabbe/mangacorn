(() => {
'use strict';
// ---------- Grundopsætning ----------
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
const stage = document.getElementById('stage');
const W = 960, H = 540, PW = 960, GUT = 20, GROUND = 468;
// Havet: vandoverfladen ligger i samme højde som jorden, og havbunden ligger langt nede.
// Kameraet glider ned, når man dykker.
const SURF = GROUND, SEA_FLOOR = 880, SEA_BOTTOM = 900;
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
let save = { coins: 0, owned: [], worn: [], best: 1, friends: [], players: 1, tail: false };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && typeof s === 'object') save = Object.assign(save, s); } catch (e) {}
if (!Array.isArray(save.friends)) save.friends = [];
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

// ---------- Venner (andre mangacorns) ----------
// Man møder én ven i hvert kapitel. Når man har mødt en ven, flytter den ind i Mangaby.
// pal = farverne på vennen, looks = pynt fra butikken som vennen har på, roof = farven på vennens tag i byen.
const FRIENDS = [
  { id: 'pip', name: 'Pip', looks: ['scarf'], roof: '#5ccf8a',
    pal: { body: '#e6fbef', back: '#cdeedd', hoof: '#7fcfa3', muzzle: '#f3fff8', ear: '#ffd0e4', horn: '#d9dee8', mane: ['#5ccf8a', '#9be8b8', '#2fae6e', '#c8f5dc'], iris: '#2fae6e' },
    hello: 'Hej! Jeg hedder Pip!', lines: ['Velkommen hjem!', 'Jeg elsker sølvmønter!', 'Har du set en Blobbo?'] },
  { id: 'luna', name: 'Luna', looks: ['glitter'], roof: '#4a5bd1',
    pal: { body: '#eee8ff', back: '#d9cff7', hoof: '#7b6cc4', muzzle: '#f7f3ff', ear: '#ffd0e4', horn: '#cfe4ff', mane: ['#4a5bd1', '#8ea0ff', '#2f3a96', '#c8d2ff'], iris: '#3a4fd8' },
    hello: 'Jeg er Luna. Hej hej!', lines: ['Mit horn kan glimte!', 'Stjernerne er så flotte', 'Godnat, Tordenpust!'] },
  { id: 'kiko', name: 'Kiko', looks: ['headband'], roof: '#ff8a3d',
    pal: { body: '#fff1e3', back: '#f6dcc4', hoof: '#e0925a', muzzle: '#fff8f0', ear: '#ffc3a8', horn: '#ffd23f', mane: ['#ff8a3d', '#ffc06b', '#ff5e3a', '#ffe0b0'], iris: '#d9601e' },
    hello: 'Kiko her! Ninja-hop!', lines: ['Hyah! Ninja-hop!', 'Jeg træner hver dag!', 'KAPOW er mit yndlingsord!'] },
  { id: 'bobbi', name: 'Bobbi', looks: ['wreath'], roof: '#ffcf3f',
    pal: { body: '#fffbe0', back: '#f5edbd', hoof: '#e4c043', muzzle: '#fffef3', ear: '#ffc3dd', horn: '#ff9ecb', mane: ['#ff7eb6', '#ffd23f', '#ff4f9a', '#fff0a8'], iris: '#e8457f' },
    hello: 'Hejsa! Jeg er Bobbi!', lines: ['Se mine blomster!', 'Jeg har plantet en have!', 'Du er min bedste ven!'] },
  { id: 'nova', name: 'Nova', looks: ['cape', 'glasses'], roof: '#7cc6ff',
    pal: { body: '#e4f4ff', back: '#c9e4f7', hoof: '#5aa8f0', muzzle: '#f3faff', ear: '#ffc3dd', horn: '#ffd23f', mane: ['#a78bfa', '#7cc6ff', '#7a4dff', '#d6c8ff'], iris: '#1f8fd6' },
    hello: 'Nova på vej! Zoom!', lines: ['Jeg er en superhelt!', 'Til undsætning!', 'Min kappe er den bedste!'] },
];
const FR = Object.fromEntries(FRIENDS.map(f => [f.id, f]));

// ---------- Lyd (lille synth, starter efter første klik/tast) ----------
let actx = null, muted = false;
function initAudio() {
  // iPad/iPhone starter lyden på pause, indtil man rører skærmen, så den vækkes her
  if (actx) { if (actx.state === 'suspended') actx.resume().catch(() => {}); return; }
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
  splash() { noise(.25, .12); beep(240, .2, 'sine', .05, 120); },
  swim() { beep(420, .09, 'sine', .04, 720); },
  blow() { beep(300, .18, 'sine', .04, 600); },
  hello() { [784, 988, 1175].forEach((f, i) => beep(f, .1, 'sine', .06, 0, i * .08)); },
  door() { beep(520, .1, 'triangle', .06, 0); beep(780, .14, 'triangle', .06, 0, .09); },
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
  storm: () => 'To Tordenpust i luften!',
  trio: () => 'Tre Blobboer på række!',
  spiky: () => 'Piggi har pigge! Hop over den',
  ghost: () => 'Bøh! Et lille spøgelse følger efter dig',
  bubbler: () => 'Boblo puster bobler. Hop på dem!',
  island: () => 'En lille ø midt i havet…',
  mountain: () => 'Et kæmpe bjerg! Gå over toppen',
  hills: () => 'Bakke op og bakke ned',
  sea: () => save.tail ? 'Hop i vandet med din havfruehale!' : 'Dyk ned i havet!',
  star: () => 'En regnbuestjerne gør dig uovervindelig',
  feather: () => 'En sky-fjer giver dobbelthop',
  goal: () => 'Løb videre til næste side!',
  friend: n => save.friends.includes(friendFor(n)) ? `Der er ${FR[friendFor(n)].name}!` : 'Hvem er det? En ny ven!',
};
const friendFor = n => FRIENDS[(n - 1) % FRIENDS.length].id;

function buildLevel(n) {
  let seq;
  if (n === 1) seq = ['start', 'coins', 'steps', 'blob', 'star', 'goal'];
  else if (n === 2) seq = ['start', 'coins', 'feather', 'mountain', 'blob', 'bats', 'twoblob', 'goal'];
  else {
    // Sværhedsgrad: jo højere kapitel, jo flere svære paneler og jo færre power-ups.
    const pool = ['blob', 'steps', 'bats', 'twoblob', 'bats', 'twoblob', 'blob', 'feather', 'star'];
    if (n < 7) pool.push('coins', 'coins');
    if (n < 6) pool.push('star');
    if (n >= 4) pool.push('storm');
    if (n >= 6) pool.push('storm');
    if (n >= 5) pool.push('trio');
    if (n >= 7) pool.push('trio');
    // nye monstre: Piggi fra kapitel 3, Bøh fra kapitel 4, Boblo fra kapitel 5
    if (n >= 3) pool.push('spiky');
    if (n >= 4) pool.push('ghost');
    if (n >= 5) pool.push('bubbler');
    if (n >= 4) pool.push('sea');
    pool.push('mountain', 'hills');
    seq = ['start'];
    const mids = 3 + Math.min(n, 7);
    let prev = '';
    for (let i = 0; i < mids; i++) { let t; do t = pick(pool); while (t === prev); seq.push(t); prev = t; }
    // det kapitel, hvor et nyt monster dukker op første gang, har det med for sikkert
    const debut = { 3: 'spiky', 4: 'ghost', 5: 'bubbler' }[n];
    if (debut && !seq.includes(debut)) seq[2] = debut;
    seq.push('goal');
  }
  // en ven står i et panel midt i kapitlet
  seq.splice(n === 1 ? 2 : Math.ceil(seq.length / 2), 0, 'friend');
  // havfrue-øen: fra kapitel 3, indtil man har fået havfruehalen
  if (n >= 3 && !save.tail) seq.splice(seq.length - 1, 0, 'island');
  const L = { panels: [], coins: [], monsters: [], plats: [], items: [], friends: [], doors: [], houses: [], deco: [], seas: [], hills: [], mermaid: null, goal: 0, width: seq.length * PW, n };
  seq.forEach((type, p) => {
    const x = p * PW + GUT, w = PW - 2 * GUT;
    const sea = type === 'island' || type === 'sea';
    const bg = type === 'start' || sea ? 'sky' : type === 'goal' ? 'burst' : ['speed', 'tone', 'sky', 'burst'][(p + n) % 4];
    const deco = { lines: [], rays: [], clouds: [] };
    for (let i = 0; i < 46; i++) deco.lines.push({ x: rand(-200, w), y: rand(40, GROUND - 16), len: rand(90, 380), lw: rand(1, 2.6) });
    for (let i = 0; i < 110; i++) deco.rays.push({ a: i / 110 * Math.PI * 2 + rand(-.01, .01), r: rand(190, 280), wd: rand(.004, .013) });
    for (let i = 0; i < 3; i++) deco.clouds.push({ x: rand(60, w - 170), y: rand(80, 210), s: rand(.8, 1.4) });
    if (sea) deco.weeds = [0, 1, 2, 3, 4, 5].map(i => ({ x: 200 + i * 95 + rand(-20, 20), h: rand(50, 110) }));
    L.panels.push({ x, w, type, bg, deco, sea, caption: CAPTIONS[type](n) });
    fillPanel(L, type, x, n);
  });
  return L;
}

function fillPanel(L, type, ox, n) {
  // d = sværhedsgrad. Den stiger med kapitlet, men stopper ved kapitel 12, så spillet ikke bliver umuligt.
  const d = Math.min(n, 12);
  const C = (x, y) => L.coins.push({ x: ox + x, y, ph: Math.random() * 6, taken: false });
  const P = (x, y, w) => L.plats.push({ x: ox + x, y, w });
  // fra kapitel 4 kan nogle Blobboer hoppe (de er lyserøde)
  const B = (x0, x1) => L.monsters.push({ type: 'blob', x: ox + (x0 + x1) / 2, y: GROUND, min: ox + x0, max: ox + x1, vx: (70 + d * 12) * (Math.random() < .5 ? -1 : 1), alive: true, t: Math.random() * 6,
    hop: n >= 4 && Math.random() < Math.min(.15 * (n - 3), .6), hopT: rand(.8, 2), vy: 0 });
  const F = (x0, x1, y) => L.monsters.push({ type: 'bat', x: ox + (x0 + x1) / 2, y, base: y, min: ox + x0, max: ox + x1, vx: 90 + d * 12, alive: true, t: Math.random() * 6,
    amp: 40 + Math.min(d, 10) * 4, freq: 3 + d * .12 });
  // Piggi: går på jorden og kan ikke hoppes på. Bøh: svæver efter enhjørningen. Boblo: puster bobler.
  const S = (x0, x1) => L.monsters.push({ type: 'spiky', x: ox + (x0 + x1) / 2, y: GROUND, min: ox + x0, max: ox + x1, vx: (55 + d * 8) * (Math.random() < .5 ? -1 : 1), alive: true, t: Math.random() * 6 });
  const Gh = (x0, x1, y) => L.monsters.push({ type: 'ghost', x: ox + (x0 + x1) / 2, y, base: y, min: ox + x0, max: ox + x1, vx: 0, speed: 50 + d * 7, alive: true, t: Math.random() * 6 });
  const Q = (x, y) => L.monsters.push({ type: 'bubbler', x: ox + x, y, base: y, min: ox + x, max: ox + x, vx: 0, alive: true, t: Math.random() * 6, cd: 1.2, d });
  const I = (kind, x, y) => L.items.push({ kind, x: ox + x, y, taken: false });
  const V = (id, x) => L.friends.push(newFriend(id, ox + x));
  switch (type) {
    case 'start': for (let i = 0; i < 5; i++) C(480 + i * 60, 432 - Math.sin(i / 4 * Math.PI) * 70); break;
    case 'coins': P(280, 360, 220); for (let i = 0; i < 4; i++) C(310 + i * 52, 326); for (let i = 0; i < 4; i++) C(620 + i * 60, 440); if (n > 1) B(560, 900); break;
    case 'steps': P(180, 390, 170); P(410, 310, 170); P(640, 230, 170); C(265, 356); C(495, 276); C(725, 196); C(725, 146); if (n > 2) B(80, 900); break;
    case 'blob': B(260, 880); for (let i = 0; i < 5; i++) C(480 + i * 45, 362 - Math.sin(i / 4 * Math.PI) * 40); if (n > 3) F(100, 800, 250); break;
    case 'twoblob': B(60, 400); B(520, 900); P(380, 330, 170); C(420, 296); C(465, 296); C(510, 296); break;
    case 'bats': P(200, 350, 180); C(250, 316); C(290, 316); C(330, 316); F(420, 880, 300); C(600, 440); C(660, 440); C(720, 440); break;
    case 'star': P(370, 330, 190); I('star', 465, 300); C(150, 440); C(210, 440); if (n > 1) B(600, 900); break;
    case 'feather': I('feather', 260, 430); P(560, 300, 150); P(740, 170, 150); C(635, 266); C(815, 136); C(815, 90); if (n >= 3 && (n < 8 || Math.random() < .5)) I('heart', 635, 236); break;
    case 'storm': P(330, 360, 200); C(380, 326); C(430, 326); C(480, 326); F(100, 520, 220); F(440, 880, 330); C(700, 440); C(760, 440); break;
    case 'spiky': S(300, 880); P(420, 330, 170); C(460, 296); C(505, 296); C(550, 296); C(150, 440); C(210, 440); if (n >= 6) B(60, 300); break;
    case 'ghost': Gh(120, 880, 330); P(220, 360, 180); C(260, 326); C(310, 326); C(360, 326); for (let i = 0; i < 4; i++) C(560 + i * 60, 440); break;
    case 'bubbler': Q(790, GROUND - 46); P(300, 330, 180); C(340, 296); C(390, 296); C(440, 296); C(160, 440); C(560, 440); break;
    case 'mountain': {
      // et stort bjerg med sne og et flag på toppen. pts er bjergets kant fra venstre mod højre.
      const pts = [[100, GROUND], [290, 330], [420, 200], [510, 200], [640, 330], [830, GROUND]];
      L.hills.push({ kind: 'mountain', pts: pts.map(([x, y]) => [ox + x, y]), x0: ox + 100, x1: ox + 830, peak: { x: ox + 465, y: 200 }, reached: false });
      for (const lx of [200, 260, 330, 380, 465, 550, 600, 670, 730]) C(lx, hillY(pts, lx) - 46);
      P(560, 120, 130); C(600, 86); C(650, 86);
      if (n >= 3) B(600, 820);
      if (n >= 5) S(110, 400);
      break;
    }
    case 'hills': {
      const pts = [[60, GROUND], [210, 360], [330, 370], [440, GROUND], [520, GROUND], [660, 320], [780, 330], [880, GROUND]];
      L.hills.push({ kind: 'hills', pts: pts.map(([x, y]) => [ox + x, y]), x0: ox + 60, x1: ox + 880 });
      for (const lx of [150, 230, 300, 480, 600, 680, 760]) C(lx, hillY(pts, lx) - 46);
      if (n >= 3) B(440, 900);
      if (n >= 4) F(150, 800, 220);
      break;
    }
    case 'island': {
      // havet går fra x 170 til 750; øen ligger midt i, og muslingen med havfruehalen ligger på bunden
      L.seas.push({ x0: ox + 170, x1: ox + 750, floor: SEA_FLOOR });
      L.plats.push({ x: ox + 360, y: 404, w: 190, kind: 'island' });
      L.mermaid = { x: ox + 650, y: SURF + 90, state: 'hidden', t: 0, say: null, queue: [], ix0: ox + 360, ix1: ox + 550, shell: { x: ox + 640, y: SEA_FLOOR - 24 } };
      C(90, 440); C(415, 370); C(495, 370);
      C(240, 560); C(255, 640); C(280, 720); C(320, 800); C(560, 820); C(600, 740);
      break;
    }
    case 'sea':
      L.seas.push({ x0: ox + 170, x1: ox + 750, floor: SEA_FLOOR });
      L.plats.push({ x: ox + 380, y: 404, w: 150, kind: 'island' });
      for (let i = 0; i < 6; i++) C(240 + i * 85, 560 + Math.sin(i / 5 * Math.PI) * 220);
      C(430, 370); C(480, 370);
      if (n >= 5) Q(560, 640);
      break;
    case 'trio': B(40, 320); B(330, 610); B(620, 900); P(140, 320, 160); P(560, 320, 160); C(190, 286); C(240, 286); C(610, 286); C(660, 286); break;
    case 'friend': V(friendFor(n), 640); P(180, 350, 200); C(220, 316); C(280, 316); C(340, 316); C(440, 440); C(500, 440); break;
    case 'goal': L.goal = ox + 700; C(300, 440); C(360, 440); C(420, 440); if (n > 2) F(100, 600, 280); break;
  }
  // fra kapitel 5 kan der komme et ekstra Tordenpust i de rolige paneler
  if (n >= 5 && ['coins', 'steps', 'star', 'feather'].includes(type) && Math.random() < Math.min(.12 * (n - 4), .6)) F(120, 860, rand(200, 280));
}

function newFriend(id, x) {
  return { id, x, hy: 0, hv: 0, face: -1, cool: 0, say: null, queue: [], gave: false, ph: Math.random() * 9 };
}

// ---------- Mangaby: den lille by mellem kapitlerne ----------
const TOWN_CAPTIONS = ['Velkommen til Mangaby!', 'Her bor dine venner', 'Ud på eventyr igen!'];
function buildTown() {
  const L = { panels: [], coins: [], monsters: [], plats: [], items: [], friends: [], doors: [], houses: [], deco: [], seas: [], hills: [], mermaid: null, goal: 0, width: 3 * PW, n: 1, town: true };
  for (let p = 0; p < 3; p++) {
    const x = p * PW + GUT, w = PW - 2 * GUT;
    const deco = { lines: [], rays: [], clouds: [] };
    for (let i = 0; i < 3; i++) deco.clouds.push({ x: rand(60, w - 170), y: rand(80, 150), s: rand(.7, 1.1) });
    L.panels.push({ x, w, type: 'town', bg: 'sky', deco, caption: TOWN_CAPTIONS[p] });
  }
  // panel 1: velkomstskilt og butikken
  L.deco.push({ kind: 'welcome', x: GUT + 230 });
  L.deco.push({ kind: 'lamp', x: GUT + 440 });
  L.houses.push({ kind: 'shop', x: GUT + 520, w: 300, hgt: 190, roof: '#ff6fae' });
  L.doors.push({ x: GUT + 670, kind: 'shop' });
  // panel 2 og 3: vennernes huse
  const spots = [PW + GUT + 50, PW + GUT + 350, PW + GUT + 650, 2 * PW + GUT + 50, 2 * PW + GUT + 350];
  FRIENDS.forEach((f, i) => {
    const hx = spots[i], met = save.friends.includes(f.id);
    L.houses.push({ kind: 'friend', id: f.id, met, x: hx, w: 220, hgt: 165, roof: met ? f.roof : '#b8b4c6' });
    if (met) L.friends.push(newFriend(f.id, hx + 186));
  });
  L.deco.push({ kind: 'lamp', x: 2 * PW + GUT + 640 });
  L.goal = 2 * PW + GUT + 680; L.goalText = `KAPITEL ${save.best}`;
  return L;
}

// ---------- Spiltilstand ----------
let state = 'title', chapter = save.best, level = buildLevel(chapter), player, players = [], cam = { x: 0, y: 0, shake: 0 };
let fx = [], particles = [], runCoins = 0, bops = 0, time = 0, speech = null, endTimer = 0, newFriendId = null, nearDoor = null, gotTail = false;
const ACC = 2600, MAXV = 330, FRICT = 2400, G = 2200, JV = 820;

// Spiller 2 er en lyseblå enhjørning, så man kan se forskel.
const P2_PAL = { body: '#ffffff', back: '#e2ebf7', hoof: '#8fb8e6', muzzle: '#f2f8ff', ear: '#ffc3dd', horn: '#ffd23f', mane: ['#7cc6ff', '#9ff0d2', '#4aa8f0', '#d8f3ff'], iris: '#1f8fd6' };
function newPlayer(x, idx = 0) {
  const extra = save.owned.includes('heart') ? 1 : 0;
  return { idx, out: false, x, y: GROUND, vx: 0, vy: 0, face: 1, onGround: true, jumps: 0, coyote: 0, buffer: 0,
    hearts: 3 + extra, maxHearts: 3 + extra, inv: 0, star: 0, feather: false, dbl: save.owned.includes('wings'), walk: 0, squash: 0,
    shield: save.owned.includes('bubble'), magnet: save.owned.includes('magnet') };
}
// Laver én eller to spillere, alt efter hvad der er valgt på forsiden.
function makePlayers(x) {
  players = [newPlayer(x, 0)];
  if (save.players === 2) players.push(newPlayer(Math.max(GUT + 40, x - 70), 1));
  player = players[0];
}
makePlayers(level.panels[0].x + 100);
const active = () => players.filter(p => !p.out);
// den spiller, der er tættest på x (bruges af monstre og venner)
function nearestPlayer(x) {
  let best = null;
  for (const p of active()) if (!best || Math.abs(p.x - x) < Math.abs(best.x - x)) best = p;
  return best || player;
}

function seaAt(x) { for (const sz of level.seas || []) if (x > sz.x0 && x < sz.x1) return sz; return null; }
// Højden af en bakke/et bjerg i punktet x (punkterne er hjørnerne på bjergets kant)
function hillY(pts, x) {
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
    if (x >= ax && x <= bx) return ay + (by - ay) * (x - ax) / (bx - ax);
  }
  return GROUND;
}
function groundAt(x) {
  const sz = seaAt(x); if (sz) return sz.floor;
  for (const h of level.hills || []) if (x > h.x0 && x < h.x1) return hillY(h.pts, x);
  return GROUND;
}

// ---------- Input ----------
const keys = {}; const touches = [{ left: false, right: false, jump: false }, { left: false, right: false, jump: false }], touch = touches[0];
const jumpQueued = [false, false];
const JUMPKEYS = [' ', 'arrowup', 'w'];
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  initAudio();
  if (state === 'play' && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
  if ((k === 'p' || k === 'escape') && (state === 'play' || state === 'pause')) { togglePause(); return; }
  if (state === 'play' && nearDoor && ['arrowdown', 's', 'enter'].includes(k)) { e.preventDefault(); enterDoor(); return; }
  if (JUMPKEYS.includes(k) && !e.repeat && state === 'play') jumpQueued[players.length > 1 && k === 'arrowup' ? 1 : 0] = true;
  keys[k] = true;
});
addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (state === 'play') togglePause(); });
stage.addEventListener('touchstart', () => { if (!stage.classList.contains('touch-on')) { stage.classList.add('touch-on'); if (typeof refreshLabels === 'function' && state === 'title') refreshLabels(); } initAudio(); }, { passive: true });
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k, pi = Number(b.dataset.p || 0), t = touches[pi];
  const on = e => { e.preventDefault(); initAudio(); t[k] = true; b.classList.add('on'); if (k === 'jump') jumpQueued[pi] = true; try { b.setPointerCapture(e.pointerId); } catch (_) {} };
  const off = () => { t[k] = false; b.classList.remove('on'); };
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
// Hvilke taster styrer hvilken spiller. Med én spiller virker alle taster.
function controls(p) {
  if (players.length < 2) return { left: keys.arrowleft || keys.a || touch.left, right: keys.arrowright || keys.d || touch.right, held: keys[' '] || keys.arrowup || keys.w || touch.jump, down: keys.arrowdown || keys.s };
  if (p.idx === 0) return { left: keys.a || touch.left, right: keys.d || touch.right, held: keys[' '] || keys.w || touch.jump, down: keys.s };
  return { left: keys.arrowleft || touches[1].left, right: keys.arrowright || touches[1].right, held: keys.arrowup || touches[1].jump, down: keys.arrowdown };
}

function update(dt) {
  const L = level;
  if (endTimer > 0) { endTimer -= dt; if (endTimer <= 0) gameOver(); }
  for (const p of players) { if (p.out) updateOut(p, dt); else updatePlayer(p, dt); }
  updateWorld(dt);
}

// En spiller, der har mistet alle hjerter, svæver i en boble efter den anden spiller.
// Hopper den anden ind i boblen, er spilleren reddet med ét hjerte.
function updateOut(p, dt) {
  const buddy = nearestPlayer(p.x);
  if (buddy === p || buddy.out) return;
  const tx = buddy.x - buddy.face * 80, ty = buddy.y - 120 + Math.sin(time * 3) * 8;
  p.x += (tx - p.x) * Math.min(1, dt * 2.5); p.y += (ty - p.y) * Math.min(1, dt * 2.5);
  p.vx = 0; p.vy = 0; p.onGround = false; p.walk += 0;
  jumpQueued[p.idx] = false;
  if (endTimer <= 0 && Math.hypot(buddy.x - p.x, (buddy.y - 34) - (p.y - 50)) < 64) {
    p.out = false; p.hearts = 1; p.inv = 2; p.vy = -300; sfx.power();
    burst(p.x, p.y - 100, 'REDDET!', { size: .7, fill: '#fff4b8', color: '#ff6fae', life: .9 });
    sparkle(p.x, p.y - 50, 18, ['#ffffff', '#cfe8ff', '#ff9ecb'], 320);
  }
}

function updatePlayer(p, dt) {
  const L = level, { left, right, held, down } = controls(p);
  if (jumpQueued[p.idx]) { p.buffer = .13; jumpQueued[p.idx] = false; } else p.buffer -= dt;

  // i vandet? Så svømmer man: man synker langsomt, og hop er et svømmetag op
  const sz = seaAt(p.x), wet = !!sz && p.y > SURF + 6;
  if (wet && !p.wet) {
    if (p.vy > 150) { burst(p.x, SURF - 20, 'PLASK!', { size: .5, fill: '#dff3ff', color: '#3a8fe0', life: .6 }); sfx.splash(); }
    for (let i = 0; i < 10; i++) particles.push({ x: p.x + rand(-30, 30), y: SURF, vx: rand(-120, 120), vy: rand(-320, -120), life: .6, t: 0, c: '#bfe6ff', size: rand(5, 9) });
  }
  p.wet = wet;
  const fins = wet && save.tail;

  const dir = (right ? 1 : 0) - (left ? 1 : 0);
  const maxv = MAXV * (p.star > 0 ? 1.3 : 1) * (wet ? (fins ? 1.15 : .65) : 1);
  if (endTimer > 0) { /* frosset mens "Åh nej" vises */ }
  else if (dir) { p.vx += dir * ACC * dt; p.face = dir; }
  else { const f = FRICT * dt; p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f; }
  p.vx = clamp(p.vx, -Math.max(maxv, Math.abs(p.vx) * .98), Math.max(maxv, Math.abs(p.vx) * .98));
  if (Math.abs(p.vx) > maxv && dir) p.vx = clamp(p.vx, -maxv, maxv);

  p.coyote = p.onGround ? .1 : p.coyote - dt;
  if (wet) {
    if (p.buffer > 0 && endTimer <= 0) {
      // svømmetag. Tæt på overfladen hopper man helt op af vandet
      p.vy = p.y < SURF + 50 ? -JV * .8 : -(fins ? 470 : 340); p.buffer = 0; sfx.swim();
      for (let i = 0; i < 4; i++) particles.push({ x: p.x + rand(-20, 20), y: p.y - rand(20, 60), vx: rand(-20, 20), vy: rand(-80, -30), life: .9, t: 0, c: '#ffffff', size: rand(5, 9), bub: true });
    }
    p.vy = Math.min(p.vy + G * .22 * dt, down ? 360 : 140);
    if (Math.random() < dt * 2) particles.push({ x: p.x + p.face * 40, y: p.y - 60, vx: 0, vy: -60, life: 1.2, t: 0, c: '#ffffff', size: rand(4, 7), bub: true });
  } else if (p.buffer > 0 && endTimer <= 0) {
    if (p.coyote > 0) { p.vy = -JV; p.onGround = false; p.coyote = 0; p.jumps = 1; p.buffer = 0; sfx.jump(); }
    else if ((p.dbl || p.feather) && p.jumps < 2) { p.vy = -JV * .92; p.jumps = 2; p.buffer = 0; sfx.jump2();
      sparkle(p.x, p.y - 10, 10, ['#ffffff', '#cfe8ff', '#ffd6ea'], 200); }
  }
  if (!wet) {
    if (!held && p.vy < -250) p.vy += G * dt * 1.4;
    p.vy = Math.min(p.vy + G * dt, 1400);
  }

  const prevY = p.y, wasGround = p.onGround;
  p.x += p.vx * dt; p.y += p.vy * dt;
  p.x = clamp(p.x, GUT + 34, L.width - GUT - 34);
  // under vandet kan man ikke svømme ind i klipperne på siderne
  if (sz && p.y > SURF + 12) p.x = clamp(p.x, sz.x0 + 26, sz.x1 - 26);
  p.onGround = false;
  const land = yy => { p.y = yy; if (!wasGround && p.vy > 450) p.squash = .2; p.vy = 0; p.onGround = true; };
  const gy = groundAt(p.x);
  if (p.y >= gy) land(gy);
  // går man ned ad en bakke, bliver man på jorden i stedet for at hoppe ned i små trin
  else if (wasGround && p.vy >= 0 && !wet && gy - p.y < 24) land(gy);
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
}

function updateWorld(dt) {
  const L = level, p = nearestPlayer(cam.x + W / 2);
  // monstre
  for (const m of L.monsters) {
    if (!m.alive) continue;
    m.t += dt;
    m.x += m.vx * dt;
    if (m.x < m.min) { m.x = m.min; m.vx = Math.abs(m.vx); }
    if (m.x > m.max) { m.x = m.max; m.vx = -Math.abs(m.vx); }
    if (m.type === 'bat') m.y = m.base + Math.sin(m.t * m.freq) * m.amp;
    const p = nearestPlayer(m.x);
    if (m.type === 'ghost') {
      // Bøh svæver langsomt hen mod enhjørningen, når den er tæt på
      const dx = p.x - m.x;
      m.vx = Math.abs(dx) < 520 && Math.abs(dx) > 6 ? Math.sign(dx) * m.speed : 0;
      m.y = m.base + Math.sin(m.t * 2.2) * 26 + (p.y - 60 - m.base) * .25;
    }
    if (m.type === 'bubbler') {
      m.y = m.base + Math.sin(m.t * 2) * 6;
      m.cd -= dt;
      if (m.cd <= 0 && Math.abs(p.x - m.x) < 760) {
        const dir = Math.sign(p.x - m.x) || -1;
        L.monsters.push({ type: 'bubble', x: m.x + dir * 34, y: m.y + 4, base: m.y + 4, min: -1e9, max: 1e9, vx: dir * (150 + m.d * 9), alive: true, t: 0, life: 4.5 });
        m.cd = Math.max(1.5, 3.1 - m.d * .13); sfx.blow();
      }
    }
    if (m.type === 'bubble') {
      m.y = m.base + Math.sin(m.t * 5) * 7; m.life -= dt;
      if (m.life <= 0 || m.x < 0 || m.x > L.width || (m.y > SURF && !seaAt(m.x) && L.seas.length)) { m.alive = false; continue; }
    }
    if (m.hop) {
      const gy = groundAt(m.x);
      m.hopT -= dt;
      if (m.hopT <= 0 && m.y >= gy - 1) { m.vy = -640; m.hopT = rand(1.4, 2.4); }
      m.vy += G * dt; m.y = Math.min(gy, m.y + m.vy * dt); if (m.y >= gy) m.vy = 0;
    } else if (m.type === 'blob' || m.type === 'spiky') m.y = groundAt(m.x);
    const my = m.type === 'blob' ? m.y - 28 : m.type === 'spiky' ? m.y - 26 : m.y;
    const r = { blob: 30, bat: 24, spiky: 32, ghost: 28, bubbler: 26, bubble: 15 }[m.type];
    if (endTimer > 0) continue;
    for (const q of active()) {
      if (!m.alive) break;
      if (Math.abs(m.x - q.x) < 26 + r * .8 && Math.abs(my - (q.y - 34)) < 30 + r * .8) {
        const stomp = q.vy > 60 && q.y - 8 < my;
        if (q.star > 0) defeat(m, my);
        else if (stomp && m.type !== 'spiky') { defeat(m, my); q.vy = -JV * .68; q.jumps = 1; q.onGround = false; }
        else if (q.inv <= 0) { hurt(m, q); if (m.type === 'bubble') m.alive = false; }
      }
    }
  }
  // venner
  for (const f of L.friends) updateFriend(f, dt);
  if (L.mermaid) updateMermaid(L.mermaid, dt);
  // på toppen af bjerget
  for (const h of L.hills) if (h.peak && !h.reached && active().some(q => q.onGround && Math.abs(q.x - h.peak.x) < 50 && q.y <= h.peak.y + 2)) {
    h.reached = true; sfx.win(); runCoins += 3; floatText(h.peak.x, h.peak.y - 150, '+3');
    burst(h.peak.x, h.peak.y - 120, 'TOPPEN!', { size: .7, fill: '#ffffff', color: '#ff6fae', life: 1.1 });
    sparkle(h.peak.x, h.peak.y - 60, 20, ['#ffffff', '#ff9ecb', '#ffd23f', '#7cc6ff'], 320);
  }
  // døre i byen
  const door = L.doors.find(d => active().some(q => Math.abs(q.x - d.x) < 60 && q.onGround)) || null;
  if (door !== nearDoor) { nearDoor = door; $('enterWrap').hidden = !door; }
  // mål
  if (L.goal && endTimer <= 0 && active().some(q => q.x > L.goal)) { if (L.town) startChapter(save.best); else chapterDone(); return; }

  // kamera glider fra panel til panel og følger den spiller, der er længst fremme.
  // Er den anden spiller blevet tilbage, bliver den trukket med ind i det nye panel.
  const lead = active().reduce((a, b) => (b.x > a.x ? b : a), active()[0] || player);
  const panelX = Math.floor(lead.x / PW) * PW;
  for (const q of active()) {
    if (q !== lead && q.x < panelX + GUT) {
      q.x = panelX + GUT + 60; q.y = GROUND; q.vx = 0; q.vy = 0; q.onGround = true;
      sparkle(q.x, q.y - 40, 12, ['#ffffff', '#cfe8ff', '#ffd6ea'], 220);
    }
  }
  const target = clamp(panelX, 0, L.width - W);
  // når man dykker, glider kameraet ned under vandet
  const deep = active().filter(q => seaAt(q.x) && q.y > SURF);
  const ty = deep.length ? clamp(Math.max(...deep.map(q => q.y)) - 330, 0, SEA_BOTTOM + 20 - H) : 0;
  cam.y += (ty - cam.y) * Math.min(1, dt * 5);
  cam.x += (target - cam.x) * Math.min(1, dt * 7);
  cam.shake = Math.max(0, cam.shake - dt * 40);
  if (speech) { speech.t -= dt; if (speech.t <= 0) speech = null; }
}

function updateFriend(f, dt) {
  const fr = FR[f.id], p = nearestPlayer(f.x);
  f.hv -= G * dt; f.hy += f.hv * dt; if (f.hy <= 0) { f.hy = 0; f.hv = 0; }
  f.cool -= dt;
  f.face = p.x < f.x ? -1 : 1;
  if (f.say) { f.say.t -= dt; if (f.say.t <= 0) f.say = f.queue.length ? { text: f.queue.shift(), t: 2.2 } : null; }
  if (Math.abs(p.x - f.x) > 170 || f.cool > 0) return;
  f.cool = 7; f.hv = 520; sfx.hello(); speech = null;
  sparkle(f.x, GROUND - 90, 8, ['#ffffff', fr.pal.mane[0], fr.pal.mane[1]], 180);
  if (level.town) { f.say = { text: pick(fr.lines), t: 2.6 }; f.queue = []; return; }
  if (f.gave) { f.say = { text: pick(fr.lines), t: 2.6 }; return; }
  // første gang i kapitlet: vennen giver en gave
  f.gave = true;
  const isNew = !save.friends.includes(f.id), gift = isNew ? 5 : 3;
  runCoins += gift; floatText(f.x, GROUND - 150, '+' + gift);
  burst(f.x, GROUND - 170, 'GAVE!', { size: .6, fill: '#fff4b8', color: '#ff6fae', life: .8 });
  if (isNew) { save.friends.push(f.id); newFriendId = f.id; persist(); }
  f.say = { text: isNew ? fr.hello : `Hej igen! Det er ${fr.name}!`, t: 2.2 };
  f.queue = isNew ? ['Her er en gave til dig!', 'Besøg mig i Mangaby!'] : ['Her er en gave til dig!'];
}

// Havfruen Marina: dukker op, når man står på øen eller hopper i vandet,
// og fortæller, at havfruehalen ligger i muslingen på bunden.
function updateMermaid(mm, dt) {
  mm.t += dt;
  const act = active();
  if (mm.state === 'hidden' && act.some(q => (q.onGround && q.y < SURF - 20 && q.x > mm.ix0 && q.x < mm.ix1) || q.wet)) {
    mm.state = 'up'; sfx.hello(); speech = null;
    mm.say = { text: 'Hej! Jeg er Marina, havfruen!', t: 2.4 };
    mm.queue = ['Dyk ned og find havfruehalen!', 'Den ligger i den lyserøde musling!'];
  }
  const ty = mm.state === 'hidden' ? SURF + 90 : SURF + 6 + Math.sin(mm.t * 2) * 5;
  mm.y += (ty - mm.y) * Math.min(1, dt * 3);
  if (mm.say) { mm.say.t -= dt; if (mm.say.t <= 0) mm.say = mm.queue.length ? { text: mm.queue.shift(), t: 2.6 } : null; }
  // muslingen på bunden
  const sh = mm.shell;
  if (!save.tail && act.some(q => Math.hypot(q.x - sh.x, (q.y - 34) - sh.y) < 64)) {
    save.tail = true; gotTail = true; persist(); sfx.win();
    burst(sh.x, sh.y - 90, 'HAVFRUEHALE!', { size: .75, fill: '#c8fff6', color: '#7a4dff', life: 1.4 });
    sparkle(sh.x, sh.y - 30, 26, ['#3fd6c6', '#8a6cff', '#ff9ecb', '#ffffff'], 360);
    mm.state = 'up'; mm.say = { text: 'Sådan! Nu har du en havfruehale!', t: 2.6 }; mm.queue = ['Den kommer frem, når du er i vandet!'];
  }
}

function defeat(m, my) {
  if (m.type === 'bubble') {
    m.alive = false; sfx.pop();
    burst(m.x, my - 10, 'POP!', { size: .45, fill: '#dff3ff', color: '#3a8fe0', life: .5 });
    sparkle(m.x, my, 8, ['#ffffff', '#cfe8ff', '#9fd3ff'], 220);
    return;
  }
  m.alive = false; bops++;
  burst(m.x, my - 20, pick(['KAPOW!', 'KAPOW!', 'BAM!', 'POW!']));
  if (!reduceMotion) cam.shake = 12;
  const gain = save.owned.includes('clover') ? 4 : 2;
  runCoins += gain; floatText(m.x + 40, my - 60, '+' + gain);
  sparkle(m.x, my, 16, ['#ffe14a', '#ff7eb6', '#ffffff', '#a78bfa'], 340);
  sfx.kapow();
}
function hurt(m, p = player) {
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
  if (p.hearts <= 0) {
    p.out = true; p.star = 0;
    if (!active().length) endTimer = .9;
    else burst(p.x, p.y - 130, 'HJÆLP!', { size: .55, fill: '#ffffff', color: '#2b6fd6', life: .9 });
  }
}

function tickEffects(dt) {
  for (const f of fx) f.t += dt;
  fx = fx.filter(f => f.t < f.life);
  for (const q of particles) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += (q.bub ? -30 : 600) * dt; if (q.bub && q.y < SURF + 4) q.t = q.life; }
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
  if (pn.sea) { drawSeaPanel(pn); return; }
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
  const sq = Math.sin(m.t * 8) * .06, dir = Math.sign(nearestPlayer(m.x).x - m.x) || 1;
  ctx.save(); ctx.translate(m.x, m.y); ctx.scale(1 + sq, 1 - sq);
  ctx.beginPath(); ctx.moveTo(-34, 0); ctx.bezierCurveTo(-38, -42, -20, -58, 0, -58); ctx.bezierCurveTo(20, -58, 38, -42, 34, 0); ctx.closePath();
  const g = ctx.createLinearGradient(0, -58, 0, 0);
  if (m.hop) { g.addColorStop(0, '#ffd6ea'); g.addColorStop(1, '#ff8cc0'); } else { g.addColorStop(0, '#dccdff'); g.addColorStop(1, '#a98cf7'); }
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
  const fl = Math.sin(m.t * 14) * .5, dir = Math.sign(nearestPlayer(m.x).x - m.x) || 1;
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

// Piggi: et lille pindsvin. Origo = mellem fødderne.
function drawSpiky(m) {
  const dir = Math.sign(m.vx) || 1, bob = Math.abs(Math.sin(m.t * 10)) * 3;
  ctx.save(); ctx.translate(m.x, m.y - bob); ctx.scale(dir * 1.25, 1.25);
  ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
  for (const fx of [-14, 12]) { ctx.beginPath(); ctx.ellipse(fx, -3 + bob * .5, 8, 5, 0, 0, 7); ctx.fillStyle = '#c08457'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke(); }
  // pigge på ryggen
  ctx.beginPath();
  const n = 9;
  for (let i = 0; i <= n * 2; i++) {
    const a = Math.PI * (1.02 + .86 * i / (n * 2)), rr = i % 2 ? 46 : 30;
    ctx.lineTo(-6 + Math.cos(a) * rr * 1.05, -18 + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fillStyle = '#b06fd8'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  ctx.save(); ctx.clip(); ctx.globalAlpha = .4; ctx.fillStyle = tone; ctx.fillRect(-60, -70, 120, 70); ctx.restore();
  // krop og ansigt
  ctx.beginPath(); ctx.ellipse(4, -18, 30, 19, 0, 0, 7); ctx.fillStyle = '#ffe2c4'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(34, -17, 4.5, 0, 7); ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); ctx.ellipse(18, -24, 6.5, 8.5, 0, 0, 7); ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); ctx.ellipse(18.5, -21.5, 4.5, 5.5, 0, 0, 7); ctx.fillStyle = '#7a4dff'; ctx.fill();
  ctx.beginPath(); ctx.arc(16, -27, 2.4, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(22, -12); ctx.quadraticCurveTo(26, -9, 29, -12); ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,111,174,.55)'; ctx.beginPath(); ctx.ellipse(10, -12, 5, 3, 0, 0, 7); ctx.fill();
  ctx.restore();
}
// Bøh: et lille spøgelse med tungen ude. Origo = midten.
function drawGhost(m) {
  const dir = Math.sign(nearestPlayer(m.x).x - m.x) || 1, w = Math.sin(m.t * 6) * 3;
  ctx.save(); ctx.translate(m.x, m.y); ctx.scale(1.2, 1.2); ctx.globalAlpha = .93;
  ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
  ctx.beginPath(); ctx.moveTo(-26, 22); ctx.lineTo(-26, -4); ctx.arc(0, -4, 26, Math.PI, 0); ctx.lineTo(26, 22);
  for (let i = 0; i < 4; i++) { const x0 = 26 - i * 13; ctx.quadraticCurveTo(x0 - 6.5, 30 + (i % 2 ? -w : w), x0 - 13, 22); }
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -30, 0, 28); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e3dcff');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  ctx.globalAlpha = 1;
  for (const ex of [-9, 9]) {
    ctx.beginPath(); ctx.ellipse(ex + dir * 3, -6, 5.5, 8, 0, 0, 7); ctx.fillStyle = INK; ctx.fill();
    ctx.beginPath(); ctx.arc(ex + dir * 3 - 2, -9, 2.2, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
  }
  ctx.beginPath(); ctx.ellipse(dir * 3, 8, 6, 4, 0, 0, Math.PI); ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); ctx.ellipse(dir * 3, 11, 3.5, 4, 0, 0, 7); ctx.fillStyle = '#ff7eb6'; ctx.fill(); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = 'rgba(255,111,174,.5)'; ctx.beginPath(); ctx.ellipse(-17 + dir * 2, 4, 5, 3, 0, 0, 7); ctx.ellipse(17 + dir * 2, 4, 5, 3, 0, 0, 7); ctx.fill();
  ctx.restore();
}
// Boblo: en rund pustefisk. Pusten kinderne op lige før den puster en boble.
function drawBubbler(m) {
  const dir = Math.sign(nearestPlayer(m.x).x - m.x) || -1, puff = m.cd < .35 ? 1.12 : 1;
  ctx.save(); ctx.translate(m.x, m.y); ctx.scale(dir * puff, puff);
  ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
  // hale og finner
  ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(-42, -14 + Math.sin(m.t * 8) * 3); ctx.lineTo(-42, 14 - Math.sin(m.t * 8) * 3); ctx.closePath();
  ctx.fillStyle = '#ffb4d6'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6, -24); ctx.quadraticCurveTo(2, -40, 12, -24); ctx.closePath(); ctx.fill(); ctx.stroke();
  // krop
  ctx.beginPath(); ctx.arc(0, 0, 27, 0, 7);
  const g = ctx.createRadialGradient(-8, -10, 4, 0, 0, 28); g.addColorStop(0, '#d7fbf8'); g.addColorStop(1, '#7fdcd6');
  ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  for (const [sx, sy] of [[-12, 12], [-4, 18], [-16, 2]]) { ctx.beginPath(); ctx.arc(sx, sy, 2.2, 0, 7); ctx.fillStyle = '#45b3ab'; ctx.fill(); }
  // øje
  ctx.beginPath(); ctx.ellipse(8, -7, 6.5, 8.5, 0, 0, 7); ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); ctx.ellipse(8.5, -4.5, 4.5, 5.5, 0, 0, 7); ctx.fillStyle = '#1f8fd6'; ctx.fill();
  ctx.beginPath(); ctx.arc(6, -10, 2.4, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
  // spidse læber
  ctx.beginPath(); ctx.ellipse(26, 6, 5, 6, 0, 0, 7); ctx.fillStyle = '#ff7eb6'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(27, 6, 2, 3, 0, 0, 7); ctx.fillStyle = INK; ctx.fill();
  ctx.fillStyle = 'rgba(255,111,174,.55)'; ctx.beginPath(); ctx.ellipse(12, 8, 5, 3, 0, 0, 7); ctx.fill();
  ctx.restore();
}
function drawBubbleShot(m) {
  ctx.save(); ctx.translate(m.x, m.y);
  ctx.beginPath(); ctx.arc(0, 0, 17, 0, 7); ctx.fillStyle = 'rgba(170,222,255,.7)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, 11, -2.6, -1.4); ctx.lineWidth = 3.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.beginPath(); ctx.arc(6, 6, 2.5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.restore();
}
// Havfruehalen: turkis til lilla med skæl og en lyserød halefinne. Den vifter, når man svømmer.
const TAIL_COLORS = ['#3fd6c6', '#8a6cff'], FIN_COLOR = '#ff9ecb';
function drawMerTail(c, t) {
  const wv = Math.sin(t * 7) * 7;
  c.save(); c.lineJoin = 'round'; c.strokeStyle = INK;
  // halefinne
  c.beginPath(); c.moveTo(-44, -20 + wv * .8);
  c.quadraticCurveTo(-58, -44 + wv, -74, -36 + wv); c.quadraticCurveTo(-62, -24 + wv, -74, -8 + wv);
  c.quadraticCurveTo(-58, -6 + wv, -44, -14 + wv * .8); c.closePath();
  c.fillStyle = FIN_COLOR; c.fill(); c.lineWidth = 3; c.stroke();
  c.beginPath(); c.moveTo(-48, -17 + wv * .8); c.lineTo(-66, -32 + wv); c.moveTo(-48, -17 + wv * .8); c.lineTo(-66, -13 + wv); c.lineWidth = 1.6; c.stroke();
  // selve halen
  c.beginPath(); c.moveTo(24, -36); c.quadraticCurveTo(24, -6, -2, -6);
  c.quadraticCurveTo(-28, -6 + wv * .4, -46, -12 + wv * .8); c.lineTo(-44, -24 + wv * .8);
  c.quadraticCurveTo(-26, -22 + wv * .3, -18, -36); c.closePath();
  const g = c.createLinearGradient(24, -20, -46, -16); g.addColorStop(0, TAIL_COLORS[0]); g.addColorStop(1, TAIL_COLORS[1]);
  c.fillStyle = g; c.fill(); c.lineWidth = 3; c.stroke();
  // skæl
  c.save(); c.clip(); c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = 1.6;
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { c.beginPath(); c.arc(14 - i * 10 + j * 5, -26 + j * 9 + i * 1.2 + (i > 2 ? wv * .3 : 0), 5, .2, Math.PI - .2); c.stroke(); }
  c.restore();
  c.restore();
}
// Muslingen på havbunden. Før man har fået halen, ligger halen og glimter i den.
function drawShell(sh) {
  const x = sh.x, y = sh.y + 24, open = .55 + Math.sin(time * 2) * .08;
  ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.translate(x, y);
  if (!save.tail) {
    const glow = ctx.createRadialGradient(0, -30, 4, 0, -30, 80); glow.addColorStop(0, 'rgba(255,255,255,.9)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, -30, 80, 0, 7); ctx.fill();
  }
  // nederste skal
  ctx.beginPath(); ctx.moveTo(-40, -6); ctx.quadraticCurveTo(0, 12, 40, -6); ctx.quadraticCurveTo(0, -18, -40, -6); ctx.closePath();
  ctx.fillStyle = '#ffb4d6'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  // det, der ligger i muslingen
  if (!save.tail) {
    ctx.save(); ctx.translate(-6, -14); ctx.scale(.55, .55); drawMerTail(ctx, time); ctx.restore();
    starPath(ctx, 18, -40 + Math.sin(time * 4) * 3, 7, 3); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke();
  } else { ctx.beginPath(); ctx.arc(0, -12, 9, 0, 7); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke(); }
  // låget
  ctx.save(); ctx.translate(-38, -8); ctx.rotate(-open);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(38, -40, 78, 0); ctx.quadraticCurveTo(38, -10, 0, 0); ctx.closePath();
  ctx.fillStyle = '#ff9ecb'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  for (const k of [.3, .5, .7]) { ctx.beginPath(); ctx.moveTo(78 * k, -4); ctx.lineTo(39, -26); ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.restore();
  ctx.restore();
}
// Havfruen Marina (chibi-stil). Origo = vandoverfladen ved hendes mave.
function drawMermaid(mm) {
  if (mm.state === 'hidden') return;
  const dir = Math.sign(nearestPlayer(mm.x).x - mm.x) || -1, wv = Math.sin(mm.t * 3) * 5;
  ctx.save(); ctx.translate(mm.x, mm.y); ctx.scale(dir, 1); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK;
  // hale under vandet
  ctx.beginPath(); ctx.moveTo(-14, -6); ctx.quadraticCurveTo(-18, 40, -4 + wv, 70); ctx.lineTo(10 + wv, 68); ctx.quadraticCurveTo(18, 36, 14, -6); ctx.closePath();
  ctx.fillStyle = '#ff9ecb'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2 + wv, 68); ctx.quadraticCurveTo(-20 + wv, 80, -24 + wv, 96); ctx.quadraticCurveTo(0 + wv, 86, 4 + wv, 78); ctx.quadraticCurveTo(10 + wv, 88, 30 + wv, 94); ctx.quadraticCurveTo(24 + wv, 78, 2 + wv, 68);
  ctx.fillStyle = '#ffc6e2'; ctx.fill(); ctx.stroke();
  // langt hår bagved
  ctx.beginPath(); ctx.moveTo(-20, -60); ctx.quadraticCurveTo(-36, -20, -24 + wv * .5, 6); ctx.lineTo(18 + wv * .3, 2); ctx.quadraticCurveTo(26, -30, 18, -62); ctx.closePath();
  ctx.fillStyle = '#ff8fb8'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  // krop med en lilla trøje
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-13, -30, 26, 28, 8) : ctx.rect(-13, -30, 26, 28);
  ctx.fillStyle = '#c9a2ff'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6, -22); ctx.lineTo(6, -22); ctx.lineWidth = 2; ctx.stroke();
  // vinkende arm
  ctx.beginPath(); ctx.moveTo(12, -24); ctx.quadraticCurveTo(26, -34, 28, -48 + Math.sin(mm.t * 6) * 4); ctx.lineWidth = 7; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#ffe0cc'; ctx.stroke(); ctx.strokeStyle = INK;
  // hoved
  ctx.beginPath(); ctx.arc(0, -48, 18, 0, 7); ctx.fillStyle = '#ffe0cc'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  // pandehår
  ctx.beginPath(); ctx.moveTo(-19, -50); ctx.quadraticCurveTo(-14, -72, 6, -68); ctx.quadraticCurveTo(20, -66, 19, -50); ctx.quadraticCurveTo(10, -60, 2, -56); ctx.quadraticCurveTo(-8, -62, -19, -50);
  ctx.fillStyle = '#ff8fb8'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
  // søstjerne i håret
  starPath(ctx, -10, -64, 7, 3.5); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
  // store manga-øjne
  ctx.beginPath(); ctx.ellipse(7, -46, 4.5, 6.5, 0, 0, 7); ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); ctx.ellipse(7.5, -44, 3, 4, 0, 0, 7); ctx.fillStyle = '#3fd6c6'; ctx.fill();
  ctx.beginPath(); ctx.arc(5.8, -48.5, 1.8, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(-5, -46, 4, 6, 0, 0, 7); ctx.fillStyle = INK; ctx.fill();
  ctx.beginPath(); ctx.arc(-6, -48.5, 1.6, 0, 7); ctx.fillStyle = '#fff'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(-1, -36); ctx.quadraticCurveTo(2, -33, 5, -36); ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,111,174,.55)'; ctx.beginPath(); ctx.ellipse(13, -39, 4, 2.5, 0, 0, 7); ctx.ellipse(-11, -39, 4, 2.5, 0, 0, 7); ctx.fill();
  ctx.restore();
}
// Bjerge og bakker i manga-stil: lilla bjerg med sne og flag, grønne bakker med græstotter.
function drawHill(h) {
  const pts = h.pts, mountain = h.kind === 'mountain';
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK;
  const bottom = H - GUT - 3;
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0][0], bottom); for (const [x, y] of pts) ctx.lineTo(x, y); ctx.lineTo(pts[pts.length - 1][0], bottom); ctx.closePath(); };
  path();
  const top = Math.min(...pts.map(q => q[1]));
  const g = ctx.createLinearGradient(0, top, 0, GROUND);
  if (mountain) { g.addColorStop(0, '#d9ccf5'); g.addColorStop(1, '#a995de'); } else { g.addColorStop(0, '#b6efc6'); g.addColorStop(1, '#7fd39b'); }
  ctx.fillStyle = g; ctx.fill();
  ctx.save(); ctx.clip();
  // skygge med screentone på højre side
  ctx.globalAlpha = .45; ctx.fillStyle = tone;
  for (let i = 1; i < pts.length; i++) if (pts[i][1] > pts[i - 1][1]) { ctx.beginPath(); ctx.moveTo(pts[i - 1][0], pts[i - 1][1]); ctx.lineTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[i][0], bottom); ctx.lineTo(pts[i - 1][0], bottom); ctx.fill(); }
  ctx.globalAlpha = 1;
  if (mountain) {
    // snetop med takket kant
    const snow = top + 70;
    ctx.beginPath(); ctx.moveTo(pts[0][0], top - 10);
    for (let x = pts[0][0], i = 0; x <= pts[pts.length - 1][0]; x += 22, i++) ctx.lineTo(x, snow + (i % 2 ? 14 : 0));
    ctx.lineTo(pts[pts.length - 1][0], top - 10); ctx.closePath();
    ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
    // klippestreger
    ctx.strokeStyle = 'rgba(22,19,28,.35)'; ctx.lineWidth = 2;
    for (const [fx, fy, len] of [[.3, .55, 40], [.62, .5, 50], [.75, .75, 36], [.2, .8, 30]]) {
      const x = pts[0][0] + (pts[pts.length - 1][0] - pts[0][0]) * fx, y = top + (GROUND - top) * fy;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len * .4, y + len); ctx.stroke();
    }
  } else {
    ctx.strokeStyle = '#3fae6a'; ctx.lineWidth = 2.5;
    for (let x = pts[0][0] + 30; x < pts[pts.length - 1][0] - 20; x += 46) {
      const y = hillY(pts, x) + 18; ctx.beginPath(); ctx.moveTo(x - 6, y + 6); ctx.lineTo(x - 2, y - 4); ctx.moveTo(x, y + 6); ctx.lineTo(x + 2, y - 6); ctx.moveTo(x + 6, y + 6); ctx.lineTo(x + 7, y - 2); ctx.stroke();
    }
  }
  ctx.restore();
  // kant
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts) ctx.lineTo(x, y);
  ctx.lineWidth = 4; ctx.strokeStyle = INK; ctx.stroke();
  // flag på toppen
  if (h.peak) {
    const fx = h.peak.x + 30, fy = h.peak.y, wv = Math.sin(time * 5) * 4;
    ctx.fillStyle = '#5b5468'; ctx.fillRect(fx - 2.5, fy - 80, 5, 80); ctx.lineWidth = 2; ctx.strokeRect(fx - 2.5, fy - 80, 5, 80);
    ctx.beginPath(); ctx.moveTo(fx + 2, fy - 78); ctx.quadraticCurveTo(fx + 22, fy - 74 + wv, fx + 42, fy - 66 + wv); ctx.lineTo(fx + 2, fy - 54); ctx.closePath();
    ctx.fillStyle = h.reached ? '#ffd23f' : '#ff6fae'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
    starPath(ctx, fx + 16, fy - 66 + wv * .5, 6, 2.6); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 1.4; ctx.stroke();
  }
  ctx.restore();
}

// Øen: en sandbanke med en palme
function drawIsland(pl) {
  const x = pl.x, y = pl.y, w = pl.w;
  ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
  // klippe under vandet
  ctx.beginPath(); ctx.moveTo(x + 10, y + 30); ctx.quadraticCurveTo(x + w * .3, SURF + 160, x + w * .4, SEA_FLOOR); ctx.lineTo(x + w * .65, SEA_FLOOR); ctx.quadraticCurveTo(x + w * .75, SURF + 160, x + w - 10, y + 30); ctx.closePath();
  ctx.fillStyle = '#b9a6d9'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  // sand
  ctx.beginPath(); ctx.moveTo(x - 14, SURF + 14); ctx.quadraticCurveTo(x + 4, y + 2, x + 30, y); ctx.lineTo(x + w - 30, y); ctx.quadraticCurveTo(x + w - 4, y + 2, x + w + 14, SURF + 14); ctx.closePath();
  ctx.fillStyle = '#ffe3a8'; ctx.fill(); ctx.save(); ctx.clip(); ctx.globalAlpha = .4; ctx.fillStyle = tone; ctx.fillRect(x - 20, y + 30, w + 40, 60); ctx.restore();
  ctx.lineWidth = 3; ctx.stroke();
  // palme
  const px = x + w * .72;
  ctx.beginPath(); ctx.moveTo(px - 6, y + 2); ctx.quadraticCurveTo(px - 2, y - 60, px + 14, y - 110); ctx.lineTo(px + 24, y - 108); ctx.quadraticCurveTo(px + 8, y - 60, px + 8, y + 2); ctx.closePath();
  ctx.fillStyle = '#c99b6d'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI * (.1 + i * .2) + Math.sin(time * 1.5 + i) * .05;
    ctx.save(); ctx.translate(px + 19, y - 110); ctx.rotate(a);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(30, -18, 62, 8); ctx.quadraticCurveTo(30, -2, 0, 0); ctx.fillStyle = '#5ccf8a'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
    ctx.restore();
  }
  for (const [cx, cy] of [[px + 12, y - 104], [px + 24, y - 100]]) { ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.fillStyle = '#8a5a3c'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
}
// Hav-panelet: himmel, sandstrand i begge sider og dybt vand i midten
function drawSeaPanel(pn) {
  const x = pn.x, y = GUT, w = pn.w, h = SEA_BOTTOM - GUT, d = pn.deco, sz = level.seas.find(s => s.x0 >= x && s.x0 < x + w);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const g = ctx.createLinearGradient(0, y, 0, SURF); g.addColorStop(0, '#d8ecff'); g.addColorStop(1, PAPER);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, SURF - y);
  ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = tone; ctx.beginPath(); ctx.arc(x + w - 120, 110, 54, 0, 7); ctx.fill(); ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x + w - 120, 110, 54, 0, 7); ctx.stroke();
  for (const cl of d.clouds) cloud(ctx, x + cl.x + Math.sin(time * .3 + cl.x) * 10, cl.y, 4.2 * cl.s, '#ffffff', 2);
  // vand
  const wg = ctx.createLinearGradient(0, SURF, 0, SEA_FLOOR); wg.addColorStop(0, '#bfe6ff'); wg.addColorStop(1, '#5d9fe0');
  ctx.fillStyle = wg; ctx.fillRect(sz.x0, SURF, sz.x1 - sz.x0, SEA_BOTTOM - SURF);
  // lysstråler i vandet
  ctx.save(); ctx.globalAlpha = .18; ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 4; i++) { const bx = sz.x0 + 80 + i * 140 + Math.sin(time * .5 + i) * 20; ctx.beginPath(); ctx.moveTo(bx, SURF); ctx.lineTo(bx + 40, SURF); ctx.lineTo(bx + 120, SEA_FLOOR); ctx.lineTo(bx + 60, SEA_FLOOR); ctx.fill(); }
  ctx.restore();
  // tang
  ctx.lineCap = 'round';
  for (const wd of d.weeds) {
    const bx = x + wd.x, sway = Math.sin(time * 1.6 + wd.x) * 10;
    ctx.beginPath(); ctx.moveTo(bx, SEA_FLOOR); ctx.quadraticCurveTo(bx + sway, SEA_FLOOR - wd.h / 2, bx - sway * .5, SEA_FLOOR - wd.h);
    ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#4fbf7f'; ctx.stroke();
  }
  // havbund
  ctx.fillStyle = '#ffe3a8'; ctx.fillRect(sz.x0, SEA_FLOOR, sz.x1 - sz.x0, SEA_BOTTOM - SEA_FLOOR);
  ctx.save(); ctx.globalAlpha = .45; ctx.fillStyle = tone; ctx.fillRect(sz.x0, SEA_FLOOR, sz.x1 - sz.x0, 30); ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sz.x0, SEA_FLOOR); ctx.lineTo(sz.x1, SEA_FLOOR); ctx.stroke();
  // sandstrand og klipper i siderne
  for (const [a, b] of [[x, sz.x0], [sz.x1, x + w]]) {
    ctx.fillStyle = '#ffe3a8'; ctx.fillRect(a, SURF, b - a, SEA_BOTTOM - SURF);
    ctx.save(); ctx.globalAlpha = .4; ctx.fillStyle = tone; ctx.fillRect(a, SURF + 40, b - a, SEA_BOTTOM - SURF); ctx.restore();
    ctx.strokeStyle = 'rgba(22,19,28,.4)'; ctx.lineWidth = 2;
    for (let i = a + 6; i < b - 6; i += 15) { ctx.beginPath(); ctx.moveTo(i, SURF + 7); ctx.lineTo(i + 9, SURF + 17); ctx.stroke(); }
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(sz.x0, GROUND); ctx.lineTo(sz.x0, SEA_FLOOR); ctx.moveTo(sz.x1, SEA_FLOOR); ctx.lineTo(sz.x1, GROUND); ctx.lineTo(x + w, GROUND); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.strokeRect(x, y, w, h);
}
// Et lag vand foran alt, der er under overfladen, plus bølger på toppen
function drawWaterFront(sz) {
  ctx.save();
  ctx.fillStyle = 'rgba(80,160,230,.2)'; ctx.fillRect(sz.x0, SURF + 4, sz.x1 - sz.x0, SEA_FLOOR - SURF - 4);
  ctx.beginPath(); ctx.moveTo(sz.x0, SURF);
  for (let x = sz.x0; x <= sz.x1; x += 10) ctx.lineTo(x, SURF + Math.sin(x * .05 + time * 3) * 3);
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke(); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.stroke();
  ctx.restore();
}
const MONSTER_DRAW = { blob: m => drawBlob(m), bat: m => drawBat(m), spiky: drawSpiky, ghost: drawGhost, bubbler: drawBubbler, bubble: drawBubbleShot };

function drawGoal(gx, text = 'VIDERE!') {
  const x = gx + 30, y = GROUND;
  ctx.save();
  ctx.fillStyle = '#c99b6d'; ctx.fillRect(x + 50, y - 120, 12, 120); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeRect(x + 50, y - 120, 12, 120);
  ctx.beginPath(); ctx.moveTo(x - 10, y - 178); ctx.lineTo(x + 124, y - 178); ctx.lineTo(x + 156, y - 149); ctx.lineTo(x + 124, y - 120); ctx.lineTo(x - 10, y - 120); ctx.closePath();
  ctx.fillStyle = '#ffcf3f'; ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
  ctx.font = (text.length > 9 ? '24px' : text.length > 7 ? '28px' : '34px') + ' Bangers, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK;
  ctx.fillText(text, x + 62, y - 147);
  for (let i = 0; i < 3; i++) { const a = time * 2 + i * 2.1; starPath(ctx, x + 70 + Math.cos(a) * 110, y - 150 + Math.sin(a) * 60, 9, 4); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
}

// Huse i Mangaby. Butikken har en stribet markise, vennernes huse har tag i vennens farve.
function drawHouse(h) {
  const x = h.x, w = h.w, top = GROUND - h.hgt, shop = h.kind === 'shop';
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK;
  // væg
  ctx.fillStyle = shop ? '#ffffff' : '#fff8ef'; ctx.fillRect(x, top, w, h.hgt);
  ctx.save(); ctx.globalAlpha = .35; ctx.fillStyle = tone; ctx.fillRect(x + w * .78, top, w * .22, h.hgt); ctx.restore();
  ctx.lineWidth = 3.5; ctx.strokeRect(x, top, w, h.hgt);
  // tag med opadbuede hjørner, som et lille japansk hus
  ctx.beginPath(); ctx.moveTo(x - 26, top + 6); ctx.quadraticCurveTo(x + 4, top - 4, x + w * .22, top - 58);
  ctx.lineTo(x + w * .78, top - 58); ctx.quadraticCurveTo(x + w - 4, top - 4, x + w + 26, top + 6); ctx.closePath();
  ctx.fillStyle = h.roof; ctx.fill();
  ctx.save(); ctx.clip(); ctx.globalAlpha = .45; ctx.fillStyle = tone; ctx.fillRect(x - 30, top - 30, w + 60, 40); ctx.restore();
  ctx.lineWidth = 3.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w * .2, top - 62); ctx.lineTo(x + w * .8, top - 62); ctx.lineWidth = 6; ctx.stroke();
  // dør
  const dx = x + w / 2, dw = 50, dh = 84;
  ctx.beginPath(); ctx.moveTo(dx - dw / 2, GROUND); ctx.lineTo(dx - dw / 2, GROUND - dh + dw / 2); ctx.arc(dx, GROUND - dh + dw / 2, dw / 2, Math.PI, 0); ctx.lineTo(dx + dw / 2, GROUND); ctx.closePath();
  ctx.fillStyle = shop ? '#ff9ecb' : (h.met ? '#c99b6d' : '#a49fb5'); ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
  ctx.beginPath(); ctx.arc(dx + 14, GROUND - 38, 3.5, 0, 7); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
  if (shop) {
    // markise
    const ay = top + 22, n = 10, sw = (w - 20) / n;
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.moveTo(x + 10 + i * sw, ay); ctx.lineTo(x + 10 + (i + 1) * sw, ay); ctx.lineTo(x + 10 + (i + 1) * sw, ay + 26);
      ctx.arc(x + 10 + (i + .5) * sw, ay + 26, sw / 2, 0, Math.PI); ctx.closePath();
      ctx.fillStyle = i % 2 ? '#ffffff' : '#ff6fae'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
    }
    // vinduer med ting
    for (const wx of [x + 22, x + w - 92]) {
      ctx.fillStyle = '#e7f4ff'; ctx.fillRect(wx, top + 76, 70, 60); ctx.lineWidth = 3; ctx.strokeRect(wx, top + 76, 70, 60);
    }
    starPath(ctx, x + 57, top + 106, 16, 7); ctx.fillStyle = '#ffd23f'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke();
    drawCoin(ctx, x + w - 57, top + 106, 15, time, 0);
    // skilt
    ctx.fillStyle = '#ffcf3f'; ctx.fillRect(x + w / 2 - 70, top - 112, 140, 46); ctx.lineWidth = 3.5; ctx.strokeRect(x + w / 2 - 70, top - 112, 140, 46);
    ctx.beginPath(); ctx.moveTo(x + w / 2 - 40, top - 66); ctx.lineTo(x + w / 2 - 40, top - 58); ctx.moveTo(x + w / 2 + 40, top - 66); ctx.lineTo(x + w / 2 + 40, top - 58); ctx.lineWidth = 4; ctx.stroke();
    ctx.font = '36px Bangers, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK;
    ctx.fillText('BUTIK', x + w / 2, top - 87);
  } else {
    // vindue: lys tændt hvis vennen bor her
    const wx = x + 22, wy = top + 34;
    ctx.fillStyle = h.met ? '#fff1a8' : '#8a8698'; ctx.fillRect(wx, wy, 52, 46);
    if (!h.met) { ctx.save(); ctx.globalAlpha = .5; ctx.fillStyle = tone; ctx.fillRect(wx, wy, 52, 46); ctx.restore(); }
    ctx.lineWidth = 3; ctx.strokeRect(wx, wy, 52, 46);
    ctx.beginPath(); ctx.moveTo(wx + 26, wy); ctx.lineTo(wx + 26, wy + 46); ctx.moveTo(wx, wy + 23); ctx.lineTo(wx + 52, wy + 23); ctx.lineWidth = 2.5; ctx.stroke();
    if (h.met) { heartPath(ctx, x + w - 40, top + 50, 22); ctx.fillStyle = FR[h.id].roof; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke(); }
    // navneskilt over døren
    const name = h.met ? FR[h.id].name : '?';
    ctx.font = '700 16px "Zen Maru Gothic", "Trebuchet MS", sans-serif';
    const tw = Math.max(40, ctx.measureText(name).width + 20);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + w / 2 - tw / 2, top + 22, tw, 26); ctx.lineWidth = 2.5; ctx.strokeRect(x + w / 2 - tw / 2, top + 22, tw, 26);
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(name, x + w / 2, top + 36);
  }
  ctx.restore();
}
function drawTownDeco(d) {
  ctx.save(); ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
  if (d.kind === 'lamp') {
    ctx.fillStyle = '#5b5468'; ctx.fillRect(d.x - 4, GROUND - 150, 8, 150); ctx.lineWidth = 2.5; ctx.strokeRect(d.x - 4, GROUND - 150, 8, 150);
    const glow = ctx.createRadialGradient(d.x, GROUND - 162, 4, d.x, GROUND - 162, 50);
    glow.addColorStop(0, 'rgba(255,241,168,.9)'); glow.addColorStop(1, 'rgba(255,241,168,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(d.x, GROUND - 162, 50, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(d.x, GROUND - 162, 15, 0, 7); ctx.fillStyle = '#fff1a8'; ctx.fill(); ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(d.x - 12, GROUND - 176); ctx.lineTo(d.x + 12, GROUND - 176); ctx.lineWidth = 4; ctx.stroke();
  } else if (d.kind === 'welcome') {
    for (const px of [d.x - 90, d.x + 90]) { ctx.fillStyle = '#c99b6d'; ctx.fillRect(px - 6, GROUND - 190, 12, 190); ctx.lineWidth = 3; ctx.strokeRect(px - 6, GROUND - 190, 12, 190); }
    ctx.beginPath(); ctx.moveTo(d.x - 120, GROUND - 220); ctx.lineTo(d.x + 120, GROUND - 220); ctx.lineTo(d.x + 110, GROUND - 160); ctx.lineTo(d.x - 110, GROUND - 160); ctx.closePath();
    ctx.fillStyle = '#ffcf3f'; ctx.fill(); ctx.lineWidth = 4; ctx.stroke();
    ctx.font = '44px Bangers, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 7; ctx.strokeText('MANGABY', d.x, GROUND - 189); ctx.fillStyle = '#ff6fae'; ctx.fillText('MANGABY', d.x, GROUND - 189);
    for (let i = 0; i < 4; i++) { const a = time * 1.5 + i * 1.57; starPath(ctx, d.x + Math.cos(a) * 140, GROUND - 190 + Math.sin(a) * 46, 8, 3.5); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); }
  }
  ctx.restore();
}

function maneColors(rainbow, t) {
  if (rainbow) return [0, 1, 2, 3].map(i => `hsl(${(t * 140 + i * 70) % 360} 92% 72%)`);
  return ['#ff9ecb', '#c9a2ff', '#ff7eb6', '#b4dcff'];
}

// Enhjørningen. Origo = mellem fødderne, kigger mod højre.
const BASE_PAL = { body: '#ffffff', back: '#ebe4f7', hoof: '#c4b2ea', muzzle: '#fff0f7', ear: '#ffc3dd', horn: '#ffd23f', mane: null, iris: '#7a4dff' };
function drawUnicorn(c, p, t, looks, opts = {}) {
  const has = id => looks.includes(id);
  const pal = opts.pal || BASE_PAL;
  const mc = has('rainbow') || !pal.mane ? maneColors(has('rainbow'), t) : pal.mane;
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
  // hale (eller havfruehale i vandet)
  if (opts.tail) drawMerTail(c, t);
  else {
    blob2(c, [circ(-33, -40, 9), circ(-41, -32, 8.5), circ(-39, -21, 7.5)], mc[0], 2.5);
    c.fillStyle = mc[1]; c.beginPath(); c.arc(-41, -32, 5, 0, 7); c.fill();
  }
  // ben
  const leg = (x, ang, front) => {
    const fill = front ? pal.body : pal.back;
    c.save(); c.translate(x, -24); c.rotate(air ? (x > 0 ? -.5 : .5) : ang);
    c.beginPath(); c.roundRect ? c.roundRect(-5, 0, 10, 25, 4) : c.rect(-5, 0, 10, 25); c.fillStyle = fill; c.fill();
    if (has('socks')) { c.fillStyle = front ? '#ff7eb6' : '#e56aa3'; for (const sy of [5, 11]) c.fillRect(-5, sy, 10, 3.5); }
    c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.rect(-5, 18, 10, 7); c.fillStyle = pal.hoof; c.fill(); c.stroke();
    c.restore();
  };
  if (!opts.tail) {
    leg(-19, sw, false); leg(13, -sw, false);
    leg(-9, -sw, true); leg(21, sw, true);
  }
  // krop, hals, hoved, mule som én silhuet
  c.shadowBlur = 0;
  blob2(c, [ell(0, -34, 32, 19), ell(20, -50, 10, 17, -.5), circ(31, -64, 19), ell(45, -56, 11.5, 9.5)], pal.body, 3);
  if (opts.star) { c.shadowBlur = 0; }
  c.fillStyle = pal.muzzle; c.beginPath(); c.ellipse(46, -55, 10, 8, 0, 0, 7); c.fill();
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
  c.beginPath(); c.moveTo(21, -76); c.lineTo(25, -91); c.lineTo(31, -78); c.closePath(); c.fillStyle = pal.body; c.fill(); c.lineWidth = 3; c.stroke();
  c.beginPath(); c.moveTo(24, -78); c.lineTo(25.5, -86); c.lineTo(28.5, -79); c.closePath(); c.fillStyle = pal.ear; c.fill();
  // horn
  c.beginPath(); c.moveTo(29, -80); c.lineTo(43, -108); c.lineTo(38, -78); c.closePath();
  if (has('glitter')) {
    const hg = c.createLinearGradient(30, -78, 43, -108);
    for (let i = 0; i <= 4; i++) hg.addColorStop(i / 4, `hsl(${(t * 160 + i * 75) % 360} 100% 66%)`);
    c.fillStyle = hg;
  } else c.fillStyle = pal.horn;
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
    c.beginPath(); c.ellipse(35.5, -61, 5, 6, 0, 0, 7); c.fillStyle = pal.iris; c.fill();
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
  ctx.save(); ctx.globalAlpha = 1 - k; ctx.font = '30px Bangers, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
  ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeText(f.text, f.x, f.y - k * 50); ctx.fillStyle = '#e8ebf2'; ctx.fillText(f.text, f.x, f.y - k * 50);
  ctx.restore();
}

function drawSpeech(p) {
  if (speech) drawBubble(p.x, p.y, speech.text);
}
// Taleboble over en figur, der står i (fx0, fy). Boblen vender om, hvis den ellers ville gå ud over kanten.
function drawBubble(fx0, fy, text) {
  ctx.save(); ctx.font = '700 20px "Zen Maru Gothic", "Trebuchet MS", sans-serif';
  const tw = ctx.measureText(text).width;
  const left = fx0 - cam.x + 30 + tw + 30 > W - 10;
  const x = left ? fx0 - 30 - tw : fx0 + 30, y = fy - 150, tip = left ? x + tw : x;
  const d = left ? -1 : 1;
  ctx.beginPath(); ctx.ellipse(x + tw / 2, y, tw / 2 + 26, 28, 0, 0, 7);
  ctx.moveTo(tip + 6 * d, y + 22); ctx.lineTo(tip - 6 * d, y + 50); ctx.lineTo(tip + 22 * d, y + 24);
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(x + tw / 2, y, tw / 2 + 24, 26, 0, 0, 7); ctx.fill();
  ctx.fillStyle = INK; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1);
  ctx.restore();
}
function drawFriend(f) {
  const fr = FR[f.id];
  drawUnicorn(ctx, { x: f.x, y: GROUND - f.hy, vx: 0, face: f.face, onGround: f.hy <= 0, walk: 0, squash: 0 }, time + f.ph, fr.looks, { pal: fr.pal });
  // navneskilt på jorden
  ctx.save(); ctx.font = '700 15px "Zen Maru Gothic", "Trebuchet MS", sans-serif';
  const tw = ctx.measureText(fr.name).width + 18;
  ctx.fillStyle = '#fff'; ctx.fillRect(f.x - tw / 2, GROUND + 12, tw, 24); ctx.lineWidth = 2.5; ctx.strokeStyle = INK; ctx.strokeRect(f.x - tw / 2, GROUND + 12, tw, 24);
  ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(fr.name, f.x, GROUND + 25);
  ctx.restore();
}

function drawPlayer(p) {
  const pal = p.idx ? P2_PAL : undefined;
  if (p.out) {
    // ude: svæver i en boble og venter på at blive reddet
    ctx.save(); ctx.globalAlpha = .55;
    drawUnicorn(ctx, { ...p, vx: 0, onGround: true, squash: 0 }, time, save.worn, { pal, bubble: true });
    ctx.restore();
    ctx.save(); ctx.font = '700 16px "Zen Maru Gothic", "Trebuchet MS", sans-serif'; ctx.textAlign = 'center';
    ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.strokeText('Hop ind i boblen!', p.x, p.y - 128);
    ctx.fillStyle = INK; ctx.fillText('Hop ind i boblen!', p.x, p.y - 128); ctx.restore();
    return;
  }
  // fartstreger bag enhjørningen
  if (Math.abs(p.vx) > 270) {
    ctx.strokeStyle = 'rgba(22,19,28,.5)'; ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) { const yy = p.y - 22 - i * 16, x0 = p.x - p.face * (46 + i * 6); ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 - p.face * (30 + i * 10), yy); ctx.stroke(); }
  }
  ctx.save();
  if (p.inv > 0 && Math.floor(time * 20) % 2) ctx.globalAlpha = .35;
  drawUnicorn(ctx, p, time, save.worn, { pal, wings: p.dbl || p.feather, star: p.star > 0, bubble: p.shield, tail: p.wet && save.tail });
  ctx.restore();
}

function drawHUD() {
  const p = player, two = players.length > 1;
  ctx.save();
  if (!level.town) players.forEach((q, row) => {
    const y = 34 + row * 38, x0 = two ? 78 : 48;
    if (two) {
      // lille nummerskilt i spillerens manke-farve
      ctx.beginPath(); ctx.arc(44, y - 2, 14, 0, 7); ctx.fillStyle = (q.idx ? P2_PAL.mane : maneColors(false, 0))[0]; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
      ctx.font = '22px Bangers, Impact, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.fillText(String(q.idx + 1), 44, y - 1);
    }
    for (let i = 0; i < q.maxHearts; i++) {
      heartPath(ctx, x0 + i * 36, y, 28); ctx.fillStyle = i < q.hearts ? '#ff5e9a' : '#ffffff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke();
    }
  });
  ctx.lineJoin = 'round';
  const cy = level.town ? 40 : 92 + (two ? 38 : 0);
  drawCoin(ctx, 48, cy, 15, time, 0);
  ctx.font = '32px Bangers, Impact, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const txt = String(save.coins + runCoins);
  ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeText(txt, 72, cy + 2); ctx.fillStyle = '#fff'; ctx.fillText(txt, 72, cy + 2);
  if (level.town) { ctx.restore(); return; }
  let y = cy + 34;
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
  ctx.save(); ctx.translate(-Math.round(cam.x) + sx, -Math.round(cam.y) + sy);
  const L = level, vis = pn => pn.x + pn.w > cam.x - 40 && pn.x < cam.x + W + 40;
  for (const pn of L.panels) if (vis(pn)) drawPanel(pn);
  // tynd sti over mellemrummet mellem panelerne
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.setLineDash([6, 6]);
  for (let i = 1; i < L.panels.length; i++) { const gx = i * PW - GUT; ctx.beginPath(); ctx.moveTo(gx, GROUND); ctx.lineTo(gx + 2 * GUT, GROUND); ctx.stroke(); }
  ctx.setLineDash([]);
  const near = o => o.x > cam.x - 80 && o.x < cam.x + W + 80;
  const nearW = (x, w) => x + w > cam.x - 60 && x < cam.x + W + 60;
  for (const d of L.deco) if (nearW(d.x - 160, 320)) drawTownDeco(d);
  for (const h of L.houses) if (nearW(h.x - 30, h.w + 60)) drawHouse(h);
  for (const h of L.hills) if (nearW(h.x0, h.x1 - h.x0)) drawHill(h);
  for (const pl of L.plats) if (pl.x + pl.w > cam.x - 40 && pl.x < cam.x + W + 40) (pl.kind === 'island' ? drawIsland : drawCloudPlat)(pl);
  if (L.goal) drawGoal(L.goal, L.goalText);
  for (const c of L.coins) if (!c.taken && near(c)) drawCoin(ctx, c.x, c.y + Math.sin(time * 3 + c.ph) * 3, 15, time, c.ph);
  for (const it of L.items) if (!it.taken && near(it)) drawItem(it);
  for (const f of L.friends) if (near(f)) drawFriend(f);
  if (L.mermaid && near(L.mermaid)) { drawShell(L.mermaid.shell); drawMermaid(L.mermaid); }
  for (const m of L.monsters) if (m.alive && near(m)) MONSTER_DRAW[m.type](m);
  const p = player;
  for (const q of [...players].reverse()) drawPlayer(q);
  for (const sz of L.seas) if (nearW(sz.x0, sz.x1 - sz.x0)) drawWaterFront(sz);
  for (const q of particles) {
    ctx.save(); ctx.globalAlpha = 1 - q.t / q.life; ctx.fillStyle = q.c;
    if (q.bub) { ctx.beginPath(); ctx.arc(q.x, q.y, q.size * .6, 0, 7); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke(); }
    else if (q.star) { starPath(ctx, q.x, q.y, q.size, q.size * .45); ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = INK; ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(q.x, q.y, q.size * .5, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  for (const pn of L.panels) if (vis(pn)) drawCaption(pn);
  drawSpeech(p);
  for (const f of L.friends) if (f.say && near(f)) drawBubble(f.x, GROUND - f.hy, f.say.text);
  if (L.mermaid && L.mermaid.say) drawBubble(L.mermaid.x, L.mermaid.y - 40, L.mermaid.say.text);
  for (const f of fx) (f.kind === 'burst' ? drawBurstFx : drawFloat)(f);
  ctx.restore();
  if (state === 'play' || state === 'pause') drawHUD();
}

// ---------- Skærme og flow ----------
const $ = id => document.getElementById(id);
const screens = { title: $('scrTitle'), done: $('scrDone'), over: $('scrOver'), pause: $('scrPause'), shop: $('scrShop') };
function show(name) { for (const k in screens) screens[k].hidden = k !== name; if (name) $('enterWrap').hidden = true; }
function refreshLabels() {
  $('titleCoins').textContent = save.coins;
  $('btnPlay').textContent = `Spil kapitel ${save.best}`;
  $('btnShopGo').textContent = `Spil kapitel ${save.best}`;
  const two = save.players === 2;
  $('btnPlayers').textContent = two ? '2 spillere' : '1 spiller';
  $('btnPlayers').setAttribute('aria-pressed', String(two));
  const touchScreen = stage.classList.contains('touch-on') || (window.matchMedia && matchMedia('(pointer:coarse)').matches);
  stage.classList.toggle('two', two);
  $('titleHint').textContent = touchScreen
    ? (two ? 'Spiller 1 bruger knapperne til venstre, spiller 2 knapperne til højre' : 'Brug knapperne på skærmen for at gå og hoppe')
    : (two ? 'Spiller 1: A D og W · Spiller 2: ← → og ↑ · P for pause' : '← → for at gå · Mellemrum for at hoppe · P for pause');
}
function goTitle() { state = 'title'; refreshLabels(); show('title'); }

function resetRun() {
  cam.x = 0; cam.y = 0; cam.shake = 0; runCoins = 0; bops = 0; fx = []; particles = []; endTimer = 0; newFriendId = null; gotTail = false;
  nearDoor = null; $('enterWrap').hidden = true;
  for (const k in keys) keys[k] = false;
  jumpQueued[0] = jumpQueued[1] = false;
}
function startChapter(n) {
  initAudio();
  chapter = n; level = buildLevel(n); makePlayers(level.panels[0].x + 100);
  resetRun();
  speech = { text: n === 1 ? 'Lad os gå!' : pick(['Videre!', 'Nyt kapitel!', 'Mere eventyr!']), t: 2.4 };
  state = 'play'; show(null);
  cv.focus?.();
}
function startTown() {
  initAudio();
  level = buildTown(); makePlayers(level.panels[0].x + 100);
  resetRun();
  speech = { text: save.friends.length ? 'Hjem til Mangaby!' : 'Hvem bor mon her?', t: 2.4 };
  state = 'play'; show(null);
  cv.focus?.();
}
function enterDoor() {
  if (!nearDoor) return;
  sfx.door(); nearDoor = null; $('enterWrap').hidden = true;
  openShop('town');
}
function chapterDone() {
  state = 'done'; sfx.win();
  save.coins += runCoins; save.best = Math.max(save.best, chapter + 1); persist();
  $('doneText').textContent = `Du samlede ${runCoins} sølvmønter${bops ? ` og lavede ${bops} × KAPOW` : ''}. Nu har du ${save.coins} mønter i alt.` +
    (newFriendId ? ` ${FR[newFriendId].name} er flyttet ind i Mangaby!` : '') + (gotTail ? ' Du fik en havfruehale!' : '') + ' Næste kapitel bliver lidt sværere!';
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
  else if (state === 'pause') { state = 'play'; show(null); $('enterWrap').hidden = !nearDoor; }
}

// Butik
let shopReturn = 'title';
function openShop(from) {
  shopReturn = from; state = 'shop'; renderShop(); refreshLabels();
  $('btnShopHome').textContent = from === 'town' ? 'Tilbage til byen' : 'Forsiden';
  show('shop');
}
function closeShop() {
  if (shopReturn !== 'town') { goTitle(); return; }
  // tilbage til byen, lige foran butiksdøren (nye ting virker med det samme)
  makePlayers(player.x); for (const k in keys) keys[k] = false;
  state = 'play'; show(null); cv.focus?.();
}
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
$('btnShopHome').onclick = () => closeShop();
$('btnTownFromTitle').onclick = () => startTown();
$('btnPlayers').onclick = () => { save.players = save.players === 2 ? 1 : 2; persist(); refreshLabels(); };
$('btnTownFromDone').onclick = () => startTown();
$('btnEnter').onclick = () => enterDoor();
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
