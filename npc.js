// Shared NPC brain; behaviour is tuned by each nation's profile (aggressive, defensive, opportunist) and the game difficulty.
export class Npc {
  static prof(g, id) { return g.profiles?.[id] || 'opportunist'; }
  static reinforce(g, id) {
    const b = g.owned(id).sort((x, y) => y.soldiers - x.soldiers)[0];
    return { to: b.iso, n: g.pending, why: `stacking all ${g.pending} on ${b.name}, my strongest nation, for one decisive force` };
  }
  static plan(g, id) {
    const p = Npc.prof(g, id), mine = g.owned(id).sort((x, y) => y.soldiers - x.soldiers), top = mine[0];
    const foes = g.countries.filter(c => c.owner !== id), extra = mine.slice(1).filter(c => c.soldiers > 1);
    const rate = (pw, f) => ({ f, edge: pw - 1 - f.soldiers, gain: Math.max(2, Math.floor(f.base / 2)) });
    if (g.difficulty === 'easy' && Math.random() < 0.4 && top.soldiers >= 2) {
      const f = foes[Math.floor(Math.random() * foes.length)];
      return { transfers: [], attack: { from: top.iso, to: f.iso, why: `easy mode: a hasty attack on ${f.name} without checking the odds` }, skipWhy: '' };
    }
    const score = r => p === 'aggressive' ? r.edge + r.gain * 2 : p === 'defensive' ? r.edge * 3 + r.gain : r.edge * 2 + r.gain + (r.f.owner === g.human ? 2 : 0);
    const best = pw => foes.map(f => rate(pw, f)).sort((a, b) => score(b) - score(a))[0];
    const ok = r => r && (p === 'aggressive' ? r.edge >= 0 : p === 'defensive' ? r.edge >= 2 : (r.edge >= 1 || (r.edge >= 0 && r.gain >= 3)));
    let transfers = [], r = best(top.soldiers);
    if (!ok(r)) {
      r = null;
      if (extra.length) {
        const r2 = best(top.soldiers + extra.reduce((s, c) => s + c.soldiers - 1, 0));
        if (ok(r2)) { r = r2; transfers = extra.map(c => ({ from: c.iso, to: top.iso, n: c.soldiers - 1, why: `consolidating ${c.name}'s spare soldiers into ${top.name} to make an attack viable` })); }
      }
    }
    return { transfers, attack: r && { from: top.iso, to: r.f.iso, why: `${p} style: attacking ${r.f.name} (${r.f.soldiers} defenders) from ${top.name}; victory garrisons ${r.gain} soldiers` }, skipWhy: `${p} style: no target worth the risk, so I am saving soldiers` };
  }
  static carryOn(g, id) {
    const p = Npc.prof(g, id), a = g.c(g.attack.from), d = g.c(g.attack.to), pw = a.soldiers - 1;
    const need = p === 'aggressive' ? d.soldiers - 1 : p === 'defensive' ? d.soldiers + 1 : d.soldiers;
    return pw >= need || d.soldiers === 1
      ? { go: true, why: `${pw} attackers vs ${d.soldiers} defenders, pressing on` }
      : { go: false, why: `outgunned ${pw} vs ${d.soldiers}, cutting losses` };
  }
}
