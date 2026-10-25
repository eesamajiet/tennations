import { COUNTRIES, soldiersFor } from './data.js';
const d6 = () => 1 + Math.floor(Math.random() * 6);
const shuffle = a => [...a].sort(() => Math.random() - .5);
export class Country { constructor(o) { Object.assign(this, o); } }
export class Game {
  constructor(st) { Object.assign(this, st); this.countries = st.countries.map(c => new Country(c)); }
  static create(humanIso, ownerUid, ownerName) {
    const me = COUNTRIES.find(c => c[1] === humanIso);
    const picks = [me, ...shuffle(COUNTRIES.filter(c => c[1] !== humanIso)).slice(0, 9)];
    const countries = picks.map(([name, iso, pop]) => ({ name, iso, pop, base: soldiersFor(pop), soldiers: soldiersFor(pop), owner: iso }));
    const g = new Game({ ownerUid, ownerName, human: humanIso, countries, order: shuffle(countries.map(c => c.iso)), turn: 0, round: 1, pending: 0, attack: null, attackUsed: false, turnStarted: false, lastBattle: null, winner: null, status: 'playing', log: [], created: Date.now() });
    g.say(`New game. ${g.nm(g.cur())} was drawn to move first.`);
    return g;
  }
  c(id) { return this.countries.find(c => c.iso === id); }
  nm(id) { return this.c(id).name; }
  cur() { return this.order[this.turn]; }
  owned(id) { return this.countries.filter(c => c.owner === id); }
  say(text, t = 'sys') { this.log.push({ t, text, r: this.round }); if (this.log.length > 150) this.log.shift(); }
  beginTurn() {
    this.turnStarted = true; this.attackUsed = false; this.attack = null;
    this.pending = this.round >= 2 ? 2 * this.owned(this.cur()).length : 0;
    this.say(`Round ${this.round}: ${this.nm(this.cur())} to play${this.pending ? `, receives ${this.pending} soldiers` : ''}.`);
  }
  place(id, n) {
    const c = this.c(id);
    if (c.owner !== this.cur()) throw new Error('That country is not yours.');
    if (n > this.pending) throw new Error('No reinforcements left.');
    c.soldiers += n; this.pending -= n;
  }
  transfer(from, to, n) {
    const a = this.c(from), b = this.c(to), me = this.cur();
    if (this.attack) throw new Error('Cannot transfer during an attack.');
    if (a.owner !== me || b.owner !== me || a === b) throw new Error('Pick two different countries you control.');
    if (!(n >= 1) || a.soldiers - n < 1) throw new Error('A country must keep at least 1 soldier.');
    a.soldiers -= n; b.soldiers += n;
    this.say(`${a.name} moved ${n} soldier(s) to ${b.name}.`);
  }
  startAttack(from, to) {
    const a = this.c(from), d = this.c(to);
    if (this.attackUsed) throw new Error('One attack per turn.');
    if (this.pending > 0) throw new Error('Place your new soldiers first.');
    if (a.owner !== this.cur() || d.owner === this.cur()) throw new Error('Invalid attack.');
    if (a.soldiers < 2) throw new Error('Need at least 2 soldiers to attack.');
    this.attack = { from, to }; this.attackUsed = true;
  }
  stopAttack() { this.attack = null; }
  rollRound() {
    const a = this.c(this.attack.from), d = this.c(this.attack.to), me = this.cur();
    const n = Math.min(a.soldiers - 1, d.soldiers), A = [], B = []; let aLoss = 0, dLoss = 0;
    for (let i = 0; i < n; i++) { A.push(d6()); B.push(d6()); if (A[i] > B[i]) dLoss++; else if (A[i] < B[i]) aLoss++; }
    a.soldiers -= aLoss; d.soldiers -= dLoss;
    let outcome = 'continue', gain = 0;
    if (d.soldiers <= 0) {
      const prev = d.owner; gain = Math.max(2, Math.floor(d.base / 2));
      d.owner = me; d.soldiers = gain; this.attack = null; outcome = 'conquered';
      if (!this.owned(prev).length) this.say(`${this.nm(prev)} is eliminated.`);
      this.checkEnd(prev);
    } else if (a.soldiers <= 1) { this.attack = null; outcome = 'failed'; }
    this.lastBattle = { from: a.iso, to: d.iso, A, B, aLoss, dLoss, outcome, gain };
    this.say(`${a.name} vs ${d.name}: attacker lost ${aLoss}, defender lost ${dLoss}${outcome === 'conquered' ? `. ${d.name} conquered, ${gain} soldiers garrisoned` : outcome === 'failed' ? `. Attack failed, ${a.name} is down to 1` : ''}.`, 'battle');
    return this.lastBattle;
  }
  checkEnd(prev) {
    const mine = this.owned(this.cur());
    if (mine.length === this.countries.length) { this.status = 'over'; this.winner = this.cur(); }
    else if (prev === this.human && !this.owned(prev).length) {
      this.status = 'over'; this.winner = this.countries.reduce((b, c) => this.owned(c.owner).length > this.owned(b).length ? c.owner : b, this.cur());
    }
    if (this.status === 'over') this.say(this.winner === this.human ? 'You conquered the world!' : `Game over. ${this.nm(this.winner)} leads.`);
  }
  endTurn() {
    if (this.attack) throw new Error('Roll or stop the attack first.');
    if (this.pending > 0) { const b = this.owned(this.cur()).sort((x, y) => y.soldiers - x.soldiers)[0]; this.place(b.iso, this.pending); }
    do { this.turn = (this.turn + 1) % this.order.length; if (this.turn === 0) this.round++; } while (!this.owned(this.cur()).length);
    this.turnStarted = false; this.attackUsed = false; this.attack = null;
  }
}
