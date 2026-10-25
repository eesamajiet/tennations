import { COUNTRIES, flag } from './data.js';
import { Game } from './engine.js';
import { Npc } from './npc.js';
import { Commentator } from './ai.js';
import * as store from './store.js';
const $ = s => document.querySelector(s), app = $('#app'), who = $('#who');
const COLORS = ['#b5382d', '#2f6fa8', '#c8a24a', '#7a4fa0', '#2e8b6a', '#d17a22', '#8c8c3a', '#a84f78', '#4a6d7c', '#6b4a2f'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const die = n => '⚀⚁⚂⚃⚄⚅'[n - 1];
let user = null, gameId = new URLSearchParams(location.search).get('g'), game = null, unsub = null, ff = false, running = false, msg = '', sel = {};
const isOwner = () => user && game && game.ownerUid === user.uid;
const persist = now => store.save(gameId, game, now);
const col = id => COLORS[game.countries.findIndex(c => c.iso === id)];
const pick = (v, l) => l.some(c => c.iso === v) ? v : l[0]?.iso;

store.onAuth(async u => {
  user = u; who.innerHTML = u ? `${esc(u.displayName || u.email)} <button data-act="out">Sign out</button>` : '';
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
function render() {
  const note = msg ? `<p class="banner">${esc(msg)}</p>` : '';
  if (!game) {
    app.innerHTML = note + (user ? `<section class="panel"><h2>New game</h2><div class="row"><select id="pick" aria-label="Your country">${COUNTRIES.map(c => `<option value="${c[1]}" ${c[1] === 'za' ? 'selected' : ''}>${c[0]}</option>`)}</select><button data-act="new">Start game</button></div></section><section class="panel"><h2>Your games</h2><div id="mine">Loading…</div></section>` : authForm());
    if (user) store.mine(user.uid).then(l => { const el = $('#mine'); if (el) el.innerHTML = l.length ? l.map(x => `<div class="row"><button data-act="open" data-id="${x.id}">Open</button>${esc(x.countries.find(c => c.iso === x.human).name)}, round ${x.round}, ${x.status}</div>`).join('') : 'No games yet.'; });
    return;
  }
  const g = game, cur = g.cur();
  const over = g.status === 'over' ? `<p class="banner">${g.winner === g.human ? 'You conquered the world!' : `Game over. ${esc(g.nm(g.winner))} leads.`}</p>` : '';
  const tiles = g.countries.map(c => `<div class="tile ${c.owner === cur && g.status === 'playing' ? 'turn' : ''}" style="--c:${col(c.owner)}"><img src="${flag(c.iso)}" alt=""><b>${esc(c.name)}</b><span class="n">${c.soldiers}</span><small>${c.owner === c.iso ? 'own territory' : 'held by ' + esc(g.nm(c.owner))}${c.iso === g.human ? ' (you)' : ''}</small>${isOwner() && cur === g.human && g.pending > 0 && c.owner === g.human ? `<button data-act="add" data-id="${c.iso}">+1</button>` : ''}</div>`).join('');
  const b = g.lastBattle;
  const battle = b ? `<h2>${esc(g.nm(b.from))} attacks ${esc(g.nm(b.to))}</h2>` + b.A.map((a, i) => `<div class="dice"><span class="${a > b.B[i] ? 'win' : a < b.B[i] ? 'lose' : ''}">${die(a)}</span> vs <span class="${b.B[i] > a ? 'win' : b.B[i] < a ? 'lose' : ''}">${die(b.B[i])}</span></div>`).join('') + `<p>Attacker lost ${b.aLoss}, defender lost ${b.dLoss}.</p>` : '<p>No battles yet.</p>';
  const log = [...g.log].reverse().map(l => `<p class="${l.t}">${esc(l.text)}</p>`).join('');
  app.innerHTML = note + over + `<div class="layout"><div><p>Round ${g.round}. ${esc(g.nm(cur))} is playing.</p><div class="board">${tiles}</div><section class="panel">${battle}</section></div><div><section class="panel">${controls()}<div class="row"><button data-act="ff" aria-pressed="${ff}">${ff ? 'Normal speed' : 'Fast-forward NPCs'}</button><button data-act="copy">Copy share link</button><button data-act="home">All games</button></div></section>${user ? '' : authForm()}<section class="panel log"><h2>Log</h2>${log}</section></div></div>`;
}
function controls() {
  const g = game;
  if (!isOwner()) return `<p>${user ? 'You are watching this game live.' : 'You are watching live. Sign in to start your own game.'}</p>`;
  if (g.status !== 'playing') return '';
  if (g.cur() !== g.human) return '<p>NPCs are playing…</p>';
  const own = g.owned(g.human), foes = g.countries.filter(c => c.owner !== g.human);
  const opts = (l, s) => l.map(c => `<option value="${c.iso}" ${c.iso === s ? 'selected' : ''}>${esc(c.name)} (${c.soldiers})</option>`).join('');
  if (g.attack) return `<p>${esc(g.nm(g.attack.from))} (${g.c(g.attack.from).soldiers}) vs ${esc(g.nm(g.attack.to))} (${g.c(g.attack.to).soldiers})</p><div class="row"><button data-act="roll">Roll dice</button><button data-act="stop">Stop attack, end turn</button></div>`;
  if (g.pending > 0) return `<p>Place ${g.pending} new soldiers with the +1 buttons.</p>`;
  const atk = own.filter(c => c.soldiers >= 2);
  sel.from = pick(sel.from, atk); sel.to = pick(sel.to, foes); sel.tf = pick(sel.tf, own); sel.tt = pick(sel.tt, own.filter(c => c.iso !== sel.tf));
  return `<h2>Your turn</h2><div class="row"><select data-k="from" aria-label="Attack from">${opts(atk, sel.from)}</select><select data-k="to" aria-label="Target">${opts(foes, sel.to)}</select><button data-act="attack" ${g.attackUsed || !atk.length ? 'disabled' : ''}>Attack</button></div>` +
    (own.length > 1 ? `<div class="row"><select data-k="tf" aria-label="Transfer from">${opts(own, sel.tf)}</select><select data-k="tt" aria-label="Transfer to">${opts(own.filter(c => c.iso !== sel.tf), sel.tt)}</select><input data-k="n" type="number" min="1" value="${sel.n || 1}" style="width:70px" aria-label="Soldiers"><button data-act="transfer">Transfer</button></div>` : '') +
    `<div class="row"><button data-act="end">End turn</button></div>`;
}
async function round(now) {
  const r = game.rollRound(); persist(now); render();
  Commentator.say(game, r).then(t => { game.say(t, 'ai'); persist(); render(); });
  return r;
}
async function npcTurn() {
  const g = game, id = g.cur(), name = g.nm(id), wait = () => sleep(ff ? 150 : 1200);
  const step = async (t, tx) => { g.say(`${name}: ${tx}`, t); persist(); render(); await wait(); };
  if (!g.turnStarted) g.beginTurn();
  if (g.pending > 0) { const p = Npc.reinforce(g, id); g.place(p.to, p.n); await step('decision', p.why); }
  const plan = Npc.plan(g, id);
  for (const t of plan.transfers) { g.transfer(t.from, t.to, t.n); await step('decision', t.why); }
  if (plan.attack) {
    await step('decision', plan.attack.why); g.startAttack(plan.attack.from, plan.attack.to);
    while (g.attack) {
      const c = Npc.carryOn(g);
      if (!c.go) { g.stopAttack(); await step('decision', c.why); break; }
      await round(false); await wait();
    }
  } else await step('decision', plan.skipWhy);
  if (g.status === 'playing') g.endTurn();
  persist();
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
app.addEventListener('change', e => { const k = e.target.dataset.k; if (k) { sel[k] = e.target.value; if (k === 'tf') render(); } });
document.addEventListener('click', async e => {
  const a = e.target.dataset?.act; if (!a) return;
  msg = '';
  try {
    if (a === 'out') return store.signOut();
    if (a === 'signin') await store.signIn($('#email').value, $('#pw').value);
    if (a === 'signup') await store.signUp($('#email').value, $('#pw').value, $('#dn').value);
    if (a === 'new') { game = Game.create($('#pick').value, user.uid, user.displayName || user.email); gameId = await store.create(game); history.pushState(null, '', '?g=' + gameId); render(); return loop(); }
    if (a === 'open') { gameId = e.target.dataset.id; history.pushState(null, '', '?g=' + gameId); return store.onAuth && location.reload(); }
    if (a === 'home') { location.href = location.pathname; return; }
    if (a === 'ff') ff = !ff;
    if (a === 'copy') { await navigator.clipboard.writeText(location.href); msg = 'Share link copied.'; }
    if (isOwner() && game.cur() === game.human && game.status === 'playing') {
      if (a === 'add') { game.place(e.target.dataset.id, 1); persist(true); }
      if (a === 'attack') { game.startAttack(sel.from, sel.to); game.say(`You attack ${game.nm(sel.to)} from ${game.nm(sel.from)}.`, 'decision'); persist(true); }
      if (a === 'roll') await round(true);
      if (a === 'stop') { game.stopAttack(); game.say('You stopped the attack.', 'decision'); return endHuman(); }
      if (a === 'transfer') { game.transfer(sel.tf, sel.tt, +sel.n || 1); persist(true); }
      if (a === 'end') return endHuman();
    }
  } catch (err) { msg = err.message; }
  render();
});
