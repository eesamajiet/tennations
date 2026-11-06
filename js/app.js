import { COUNTRIES, flag, flagBig, soldiersFor } from './data.js?v=5';
import { Game } from './engine.js?v=5';
import { Npc } from './npc.js?v=5';
import { Commentator } from './ai.js?v=5';
import * as store from './store.js?v=5';
const $ = s => document.querySelector(s), app = $('#app'), who = $('#who');
const COLORS = ['#b5382d', '#2f6fa8', '#c8a24a', '#7a4fa0', '#2e8b6a', '#d17a22', '#8c8c3a', '#a84f78', '#4a6d7c', '#6b4a2f'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const die = n => '⚀⚁⚂⚃⚄⚅'[n - 1];
const prevS = {};
let lastKey = '', sound = false, ctx = null, confettiFor = null;
const ROLL = [[220, 0, .05], [330, .07, .05], [260, .14, .05], [400, .21, .05]], WIN = [[392, 0, .12], [523, .12, .12], [659, .24, .25]], LOSE = [[300, 0, .15], [220, .15, .15], [150, .3, .3]];
const HERO = '<section class="hero"><h2>Conquer ten nations.</h2><div class="dicefloat" aria-hidden="true"><span>⚀</span><span>⚃</span><span>⚅</span></div><p>Pick a country, outsmart nine AI rivals and roll your way to world domination. Share a game link and anyone can watch it live.</p></section>';
let user = null, gameId = new URLSearchParams(location.search).get('g'), game = null, unsub = null, ff = false, running = false, msg = '', sel = {};
const isOwner = () => user && game && game.ownerUid === user.uid;
const persist = now => store.save(gameId, game, now);
const col = id => COLORS[game.countries.findIndex(c => c.iso === id)];
const canLeave = () => isOwner() && game.status === 'playing';
const renderWho = () => { who.innerHTML = user ? `${canLeave() ? '<button data-act="leave">🚪 Leave game</button>' : game ? '<button data-act="home">🏠 Home</button>' : ''}${esc(user.displayName || user.email)} <button data-act="out">Sign out</button>` : ''; };
const pick = (v, l) => l.some(c => c.iso === v) ? v : l[0]?.iso;

store.onAuth(async u => {
  user = u; renderWho();
  if (unsub) { unsub(); unsub = null; }
  game = null;
  if (gameId) {
    const raw = await store.get(gameId).catch(() => null);
    if (raw) { game = new Game(raw); if (isOwner()) { render(); return loop(); } unsub = store.watch(gameId, r => { game = new Game(r); render(); }); }
    else msg = 'Game not found.';
  }
  render();
});

function authForm() {
  return `<section class="panel"><h2>Sign in to play</h2><div class="row"><input id="email" type="email" placeholder="Email" aria-label="Email"><input id="pw" type="password" placeholder="Password" aria-label="Password"><input id="dn" placeholder="Display name (sign up)" aria-label="Display name"></div><div class="row"><button data-act="signin">Sign in</button><button data-act="signup">Create account</button></div></section>`;
}

const SORTED = [...COUNTRIES].sort((a, b) => a[0].localeCompare(b[0]));
const fmtPop = m => m >= 1000 ? (m / 1000).toFixed(2) + ' billion' : m >= 1 ? (Math.round(m * 10) / 10) + ' million' : Math.round(m * 1e6).toLocaleString() + ' people';
const prevHtml = iso => { const c = COUNTRIES.find(x => x[1] === iso) || COUNTRIES[0], n = soldiersFor(c[2]); return `<img src="${flagBig(c[1])}" alt=""><div><b>${esc(c[0])}</b><small>Population ${fmtPop(c[2])}</small></div><div class="sold"><strong>${n}</strong><small>starting soldier${n > 1 ? 's' : ''}</small></div>`; };
const tile = (n, l, cls = '') => `<div class="stat ${cls}"><b>${n}</b><span>${l}</span></div>`;
const skel = '<div class="skel"></div><div class="skel"></div>';
const HOW = '<section class="how"><div><i>1</i><b>Pick a nation</b><p>Your population sets your starting army, from 1 to 9 soldiers. Nine random rivals join you.</p></div><div><i>2</i><b>Roll the dice</b><p>Each die is a soldier. Higher roll wins. Take every nation to conquer the world.</p></div><div><i>3</i><b>Share the link</b><p>Anyone with your game link can watch the battle live. Only you can play your turns.</p></div></section>';
let allCache = null, allAt = 0;
const loadAll = async () => { if (!allCache || Date.now() - allAt > 60000) { allCache = await store.all(); allAt = Date.now(); } return allCache; };
function gameCard(x) {
  const h = x.countries.find(c => c.iso === x.human), held = x.countries.filter(c => c.owner === x.human).length, total = x.countries.length;
  const over = x.status === 'over', won = over && x.winner === x.human;
  const st = over ? (won ? ['Won', '#1f7a4d'] : ['Lost', '#b5382d']) : ['In progress', '#c8962e'];
  const when = x.created ? new Date(x.created).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '';
  return `<div class="gcard" style="--st:${st[1]}"><img src="${flagBig(x.human)}" alt=""><div class="gi"><b>${esc(h.name)}</b> <span class="badge">${st[0]}</span><small>Round ${x.round} · ${esc(x.difficulty || 'normal')} NPCs${when ? ' · ' + when : ''}</small><div class="meter" title="${held} of ${total} nations held"><i style="width:${Math.round(held / total * 100)}%"></i></div><small>${held} of ${total} nations held</small></div><button data-act="open" data-id="${x.id}" class="${over ? '' : 'primary'}">${over ? 'View' : 'Continue'}</button></div>`;
}
function render() {
  renderWho();
  const note = msg ? `<p class="banner note">${esc(msg)}</p>` : '';
  if (!game) {
    const opts = SORTED.map(c => `<option value="${c[1]}" ${c[1] === 'za' ? 'selected' : ''}>${esc(c[0])}</option>`).join('');
    const newGame = `<section class="panel newgame"><h2>New game</h2><label class="lbl" for="pick">Choose your nation</label><select id="pick" aria-label="Your country">${opts}</select><div class="pickprev" id="prev">${prevHtml('za')}</div><span class="lbl">NPC difficulty</span><div class="seg" role="radiogroup" aria-label="NPC difficulty"><label><input type="radio" name="diff" value="easy"><span><b>Easy</b><small>Rash attacks</small></span></label><label><input type="radio" name="diff" value="normal" checked><span><b>Normal</b><small>Plays to its style</small></span></label><label><input type="radio" name="diff" value="hard"><span><b>Hard</b><small>+1 soldier a round</small></span></label></div><button class="primary startbtn" data-act="new">⚔ Start game</button></section>`;
    if (!user) { app.innerHTML = note + HERO + '<div class="lobby guest">' + authForm() + HOW + '</div>'; return; }
    app.innerHTML = note + HERO + '<div class="lobby">' + newGame + '<div class="stack"><section class="panel"><h2>Your record</h2><div id="yours" class="statgrid">' + skel + '</div></section><section class="panel"><h2>Your games</h2><div id="mine" class="gamegrid">' + skel + '</div></section><section class="panel"><h2>Platform</h2><div id="stats" class="statgrid">' + skel + '</div></section></div></div>';
    store.mine(user.uid).then(l => {
      const el = $('#mine'), yr = $('#yours'); if (!el) return;
      const fin = l.filter(x => x.status === 'over'), won = fin.filter(x => x.winner === x.human).length, conq = l.reduce((n, x) => n + (x.stats?.[x.human]?.conq || 0), 0);
      const sorted = [...l.filter(x => x.status !== 'over'), ...fin];
      el.innerHTML = sorted.length ? sorted.map(gameCard).join('') : '<p class="empty">No games yet. Pick a nation and start your first campaign.</p>';
      if (yr) yr.innerHTML = tile(l.length, 'Games') + tile(won, 'Won', 'hl') + tile(fin.length - won, 'Lost') + tile(fin.length ? Math.round(won / fin.length * 100) + '%' : '0%', 'Win rate') + tile(conq, 'Conquests');
    }).catch(() => { const el = $('#mine'); if (el) el.innerHTML = '<p class="empty">Could not load your games.</p>'; });
    loadAll().then(showStats).catch(() => { const el = $('#stats'); if (el) el.innerHTML = '<p class="empty">Platform stats unavailable.</p>'; });
    return;
  }
  const g = game, cur = g.cur();
  const over = g.status === 'over' ? `<p class="banner ${g.winner === g.human ? 'won' : 'lost'}">${g.winner === g.human ? 'You won! You conquered the world.' : `You lost. ${esc(g.nm(g.human))} was eliminated by ${esc(g.nm(g.winner))}.`}</p>` : '';
  const tiles = g.countries.map(c => `<div class="tile ${c.owner === cur && g.status === 'playing' ? 'turn' : ''}${prevS[c.iso] !== undefined && prevS[c.iso] !== c.soldiers ? ' bump' : ''}${c.owner !== c.iso ? ' held' : ''}" style="--c:${col(c.owner)}"><div class="flagbar" style="background-image:url(${flagBig(c.iso)})"></div><div class="tinfo"><b>${esc(c.name)}${c.iso === g.human ? '<em>you</em>' : ''}</b><small>${c.owner === c.iso ? (c.iso === g.human ? 'your nation' : 'NPC, ' + (g.profiles?.[c.iso] || 'standard')) : `<img class="mini" src="${flag(c.owner)}" alt="">held by ${esc(g.nm(c.owner))}`}</small></div><div class="pips">${'<i></i>'.repeat(Math.min(c.soldiers, 14))}${c.soldiers > 14 ? '<u>+</u>' : ''}</div><span class="n">${c.soldiers}</span>${isOwner() && cur === g.human && g.pending > 0 && c.owner === g.human ? `<button class="add primary" data-act="add" data-id="${c.iso}">+1</button>` : ''}</div>`).join('');
  g.countries.forEach(c => prevS[c.iso] = c.soldiers);
  const picked = sel.bt !== undefined && sel.bt !== '' ? g.battles?.[+sel.bt] : null;
  const ai = [...g.log].reverse().find(l => l.t === 'ai');
  const battle = battleHtml(picked || g.lastBattle, g) + (ai ? `<div class="bubble">🎙 ${esc(ai.text)}</div>` : '') + replayPicker(g);
  const log = [...g.log].reverse().map(l => `<p class="${l.t}">${esc(l.text)}</p>`).join('');
  const keep = ['#rail', '.logcol .log', '.log-inline'].map(q => $(q)?.scrollTop || 0);
  app.innerHTML = note + over + `<div class="layout"><div><div class="order">${g.order.map(id => `<img class="${id === cur && g.status === 'playing' ? 'on' : ''}${g.owned(id).length ? '' : ' out'}" style="--c:${col(id)}" src="${flag(id)}" alt="${esc(g.nm(id))}" title="${esc(g.nm(id))}">`).join('')}<span>${g.status === 'over' ? 'Game finished.' : `Round ${g.round}. ${esc(g.nm(cur))} is playing.`}${g.status === 'playing' && cur !== g.human ? '<span class="dots"></span>' : ''}</span></div><div class="board">${tiles}</div></div><div class="rail" id="rail"><section class="panel">${controls()}<div class="row"><button data-act="ff" aria-pressed="${ff}">${ff ? '▶ Normal speed' : '⏩ Fast-forward NPCs'}</button><button data-act="copy">🔗 Copy share link</button>${canLeave() ? '<button data-act="leave">🚪 Leave game</button>' : '<button data-act="home">Home</button>'}<button data-act="snd">${sound ? '🔊 Sound on' : '🔇 Sound off'}</button></div></section><section class="panel">${battle}</section><section class="panel log log-inline"><h2>Log</h2>${log}</section>${user ? '' : authForm()}${historyPanel(g)}${statsPanel(g)}</div><div class="logcol"><section class="panel log"><h2>Log</h2>${log}</section></div></div>`;
  ['#rail', '.logcol .log', '.log-inline'].forEach((q, k) => { const el = $(q); if (el) el.scrollTop = keep[k]; });
  afterRender();
}
function controls() {
  const g = game;
  if (!isOwner()) return `<p>${user ? 'You are watching this game live.' : 'You are watching live. Sign in to start your own game.'}</p>`;
  if (g.status !== 'playing') return '';
  if (g.cur() !== g.human) return '<p>NPCs are playing…</p>';
  const own = g.owned(g.human), foes = g.countries.filter(c => c.owner !== g.human);
  const opts = (l, s) => l.map(c => `<option value="${c.iso}" ${c.iso === s ? 'selected' : ''}>${esc(c.name)} (${c.soldiers})</option>`).join('');
  if (g.attack) return `<p>${esc(g.nm(g.attack.from))} (${g.c(g.attack.from).soldiers}) vs ${esc(g.nm(g.attack.to))} (${g.c(g.attack.to).soldiers})</p><div class="row"><button class="primary" data-act="roll">🎲 Roll dice</button><button data-act="stop">🏳 Stop attack, end turn</button></div>`;
  if (g.pending > 0) return `<p>Place ${g.pending} new soldiers with the +1 buttons.</p>`;
  const atk = own.filter(c => c.soldiers >= 2);
  sel.from = pick(sel.from, atk); sel.to = pick(sel.to, foes); sel.tf = pick(sel.tf, own); sel.tt = pick(sel.tt, own.filter(c => c.iso !== sel.tf));
  return `<h2>Your turn</h2><div class="row"><select data-k="from" aria-label="Attack from">${opts(atk, sel.from)}</select><select data-k="to" aria-label="Target">${opts(foes, sel.to)}</select><button class="primary" data-act="attack" ${g.attackUsed || !atk.length ? 'disabled' : ''}>⚔ Attack</button></div>` +
    (own.length > 1 ? `<div class="row"><select data-k="tf" aria-label="Transfer from">${opts(own, sel.tf)}</select><select data-k="tt" aria-label="Transfer to">${opts(own.filter(c => c.iso !== sel.tf), sel.tt)}</select><input data-k="n" type="number" min="1" value="${sel.n || 1}" style="width:70px" aria-label="Soldiers"><button data-act="transfer">➜ Transfer</button></div>` : '') +
    `<div class="row"><button data-act="end">⏭ End turn</button></div>`;
}
function beep(seq) {
  if (!sound) return;
  try { ctx ||= new AudioContext(); seq.forEach(([f, t, d]) => { const o = ctx.createOscillator(), v = ctx.createGain(); o.type = 'square'; o.frequency.value = f; v.gain.value = .04; o.connect(v); v.connect(ctx.destination); o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + d); }); } catch {}
}
function toast(t, a, b) {
  let box = $('#toasts'); if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.append(box); }
  const d = document.createElement('div'); d.className = 'toast'; d.role = 'status';
  d.innerHTML = (a ? `<img src="${flag(a)}" alt="">` : '') + `<span>${esc(t)}</span>` + (b ? `<img src="${flag(b)}" alt="">` : '');
  box.append(d); setTimeout(() => d.remove(), 3400);
}
function afterRender() {
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (game.status === 'over' && confettiFor !== gameId) {
    confettiFor = gameId;
    if (game.winner === game.human) { beep(WIN); if (!calm) for (let i = 0; i < 60; i++) { const c = document.createElement('i'); c.className = 'conf'; c.style.cssText = `left:${Math.random() * 100}vw;background:${COLORS[i % 10]};animation-delay:${Math.random()}s`; document.body.append(c); setTimeout(() => c.remove(), 4500); } } else beep(LOSE);
  }
  const b = game.lastBattle; if (!b || b.n === lastKey) return; lastKey = b.n;
  if (sel.bt !== undefined && sel.bt !== '') return;
  document.querySelectorAll('.die').forEach(d => { const v = +d.dataset.v; let n = 0; const t = setInterval(() => { d.textContent = die(1 + Math.floor(Math.random() * 6)); if (++n > 7) { clearInterval(t); d.textContent = die(v); } }, 70); });
  beep(ROLL);
  if (b.outcome === 'conquered') { toast(`${game.nm(b.from)} conquers ${game.nm(b.to)}!`, b.from, b.to); beep(WIN); }
}
function battleHtml(b, g) {
  if (!b) return '<h2>Battlefield</h2><p>No battles yet. The dice will appear here.</p>';
  const out = b.outcome === 'conquered' ? `${esc(g.nm(b.to))} conquered!` : b.outcome === 'failed' ? 'Attack failed.' : `Attacker lost ${b.aLoss}, defender lost ${b.dLoss}.`;
  const side = id => `<div class="side"><img src="${flagBig(id)}" alt=""><b>${esc(g.nm(id))}</b></div>`;
  return `<div class="duel">${side(b.from)}<span class="vs">VS</span>${side(b.to)}</div>` + b.A.map((a, i) => `<div class="pair"><span class="die ${a > b.B[i] ? 'win' : a < b.B[i] ? 'lose' : ''}" data-v="${a}">${die(a)}</span><span class="vs">vs</span><span class="die ${b.B[i] > a ? 'win' : b.B[i] < a ? 'lose' : ''}" data-v="${b.B[i]}">${die(b.B[i])}</span></div>`).join('') + `<p class="result">${out}</p>`;
}
function replayPicker(g) {
  const l = (g.battles || []).map((x, i) => [x, i]).slice(-20).reverse();
  return l.length ? `<select data-k="bt" aria-label="Replay a battle"><option value="">Latest battle</option>${l.map(([x, i]) => `<option value="${i}" ${String(sel.bt) === String(i) ? 'selected' : ''}>Round ${x.r}: ${esc(g.nm(x.from))} vs ${esc(g.nm(x.to))}</option>`).join('')}</select>` : '';
}
function histHtml(g, i) {
  const h = g.history[+i]; if (!h) return '';
  return `<p>Round ${h.r}, end of ${esc(g.nm(h.p))}'s turn</p><div class="row">${g.countries.map((c, j) => { const [o, n] = Array.isArray(h.s[j]) ? h.s[j] : String(h.s[j]).split(':'); return `<span class="chip" style="--c:${col(o)}">${esc(c.name)} ${n}</span>`; }).join('')}</div>`;
}
function historyPanel(g) {
  const n = (g.history || []).length; if (!n) return '';
  const i = Math.min(sel.hs ?? n - 1, n - 1);
  return `<section class="panel"><h2>History replay</h2><div class="row"><input id="hs" type="range" data-k="hs" min="0" max="${n - 1}" value="${i}" aria-label="Turn"><button data-act="play">Play history</button></div><div id="hist">${histHtml(g, i)}</div></section>`;
}
function statsPanel(g) {
  const rows = g.countries.map(c => { const s = g.stats?.[c.iso] || { conq: 0, kills: 0, lost: 0 }; return `<tr><td>${esc(c.name)}</td><td>${c.iso === g.human ? 'you' : g.profiles?.[c.iso] || ''}</td><td>${s.conq}</td><td>${s.kills}</td><td>${s.lost}</td></tr>`; }).join('');
  return `<section class="panel"><h2>Nation stats</h2><table><tr><th>Nation</th><th>Style</th><th>Conquests</th><th>Kills</th><th>Losses</th></tr>${rows}</table></section>`;
}
function showStats(all) {
  const el = $('#stats'); if (!el) return;
  const fin = all.filter(x => x.status === 'over'), won = fin.filter(x => x.winner === x.human).length, cnt = {};
  all.forEach(x => cnt[x.human] = (cnt[x.human] || 0) + 1);
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0], tc = top && COUNTRIES.find(c => c[1] === top[0]);
  el.innerHTML = tile(all.length, 'Games') + tile(fin.length, 'Finished') + tile(fin.length ? Math.round(won / fin.length * 100) + '%' : '0%', 'Player win rate') + tile(fin.length ? Math.round(fin.reduce((n, x) => n + x.round, 0) / fin.length) : 0, 'Avg rounds') + (tc ? `<div class="stat fav"><img src="${flagBig(tc[1])}" alt=""><b>${esc(tc[0])}</b><span>Most picked</span></div>` : '');
}
async function round(now) {
  const r = game.rollRound(); persist(now); render();
  Commentator.say(game, r).then(t => { game.say(t, 'ai'); persist(); render(); });
  return r;
}
async function npcTurn() {
  const g = game, id = g.cur(), name = g.nm(id), wait = () => sleep(ff ? 150 : 1200);
  const step = async (t, tx) => { g.say(`${name} (${g.profiles?.[id] || 'NPC'}): ${tx}`, t); persist(); render(); await wait(); };
  // Keep rolling until the attack ends. Also used to resume an attack that was saved mid-fight.
  const fight = async () => {
    while (g.attack) {
      const c = Npc.carryOn(g, id);
      if (!c.go) { g.stopAttack(); await step('decision', c.why); break; }
      await round(false); await wait();
    }
  };
  if (!g.turnStarted) g.beginTurn();
  if (g.pending > 0) { const p = Npc.reinforce(g, id); g.place(p.to, p.n); await step('decision', p.why); }
  if (g.attack) {
    // Resumed after a reload while this NPC was mid-attack: carry on with it.
    g.say(`${name}: resuming the attack on ${g.nm(g.attack.to)}.`, 'decision');
    await fight();
  } else if (!g.attackUsed) {
    const plan = Npc.plan(g, id);
    for (const t of plan.transfers) { g.transfer(t.from, t.to, t.n); await step('decision', t.why); }
    if (plan.attack) {
      await step('decision', plan.attack.why); g.startAttack(plan.attack.from, plan.attack.to);
      await fight();
    } else await step('decision', plan.skipWhy);
  }
  // else: this NPC already attacked this turn and the page reloaded before endTurn, so just end it.
  if (g.status === 'playing') g.endTurn();
  persist(true);
}
async function loop() {
  if (running) return; running = true;
  try {
    while (game.status === 'playing') {
      if (game.cur() === game.human) { if (!game.turnStarted) { game.beginTurn(); persist(true); } break; }
      await npcTurn();
    }
  } finally { running = false; render(); }
}
async function endHuman() { game.endTurn(); persist(true); render(); await loop(); }
app.addEventListener('change', e => { if (e.target.id === 'pick') { const pv = $('#prev'); if (pv) pv.innerHTML = prevHtml(e.target.value); return; } const k = e.target.dataset.k; if (k) { sel[k] = e.target.value; if (k === 'tf' || k === 'bt') render(); } });
app.addEventListener('input', e => { if (e.target.dataset.k === 'hs') { sel.hs = +e.target.value; const h = $('#hist'); if (h) h.innerHTML = histHtml(game, sel.hs); } });
const AUTH_MSG = { 'auth/invalid-email': 'Please enter a valid email address (not your display name).', 'auth/missing-email': 'Please enter your email address.', 'auth/missing-password': 'Please enter your password.', 'auth/invalid-credential': 'Wrong email or password. If you have no account yet, press Create account.', 'auth/user-not-found': 'No account with that email. Press Create account.', 'auth/wrong-password': 'Wrong email or password.', 'auth/email-already-in-use': 'That email already has an account. Press Sign in.', 'auth/weak-password': 'Password must be at least 6 characters.', 'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.', 'auth/network-request-failed': 'Network error. Check your connection and try again.' };
const friendly = err => AUTH_MSG[err.code] || err.message;
document.addEventListener('click', async e => {
  const a = e.target.dataset?.act; if (!a) return;
  msg = '';
  try {
    if (a === 'out') return store.signOut();
    if (a === 'signin') await store.signIn($('#email').value.trim(), $('#pw').value);
    if (a === 'signup') await store.signUp($('#email').value.trim(), $('#pw').value, $('#dn').value.trim());
    if (a === 'new') { game = Game.create($('#pick').value, user.uid, user.displayName || user.email, ($('input[name=diff]:checked')?.value || 'normal')); gameId = await store.create(game); history.pushState(null, '', '?g=' + gameId); render(); return loop(); }
    if (a === 'open') { gameId = e.target.dataset.id; history.pushState(null, '', '?g=' + gameId); return store.onAuth && location.reload(); }
    if (a === 'leave') { toast('Saving your game…'); await persist(true); location.href = location.pathname; return; }
    if (a === 'home') { location.href = location.pathname; return; }
    if (a === 'ff') ff = !ff;
    if (a === 'snd') { sound = !sound; beep([[440, 0, .08]]); }
    if (a === 'play') { const n = game.history.length; for (let i = 0; i < n; i++) { sel.hs = i; const s = $('#hs'); if (s) s.value = i; const h = $('#hist'); if (h) h.innerHTML = histHtml(game, i); await sleep(600); } return; }
    if (a === 'copy') { await navigator.clipboard.writeText(location.href); msg = 'Share link copied.'; }
    if (isOwner() && game.cur() === game.human && game.status === 'playing') {
      if (a === 'add') { game.place(e.target.dataset.id, 1); persist(true); }
      if (a === 'attack') { game.startAttack(sel.from, sel.to); game.say(`You attack ${game.nm(sel.to)} from ${game.nm(sel.from)}.`, 'decision'); persist(true); }
      if (a === 'roll') await round(true);
      if (a === 'stop') { game.stopAttack(); game.say('You stopped the attack.', 'decision'); return endHuman(); }
      if (a === 'transfer') { game.transfer(sel.tf, sel.tt, +sel.n || 1); persist(true); }
      if (a === 'end') return endHuman();
    }
  } catch (err) { msg = friendly(err); }
  const keep = ['email', 'dn'].map(i => $('#' + i)?.value || '');
  render();
  ['email', 'dn'].forEach((i, k) => { const el = $('#' + i); if (el && keep[k]) el.value = keep[k]; });
});

addEventListener('pagehide', () => { if (game && gameId && isOwner()) persist(true); });
