// One shared strategy for all NPCs: consolidate, attack only with an edge, stop when outgunned.
export class Npc {
  static reinforce(g, id) {
    const b = g.owned(id).sort((x, y) => y.soldiers - x.soldiers)[0];
    return { to: b.iso, n: g.pending, why: `stacking all ${g.pending} on ${b.name}, my strongest nation, for one decisive force` };
  }
  static plan(g, id) {
    const mine = g.owned(id).sort((x, y) => y.soldiers - x.soldiers), top = mine[0];
    const foes = g.countries.filter(c => c.owner !== id), extra = mine.slice(1).filter(c => c.soldiers > 1);
    const rate = (pw, f) => ({ f, edge: pw - 1 - f.soldiers, gain: Math.max(2, Math.floor(f.base / 2)) });
    const best = pw => foes.map(f => rate(pw, f)).sort((a, b) => (b.edge * 2 + b.gain) - (a.edge * 2 + a.gain))[0];
    const ok = r => r && (r.edge >= 1 || (r.edge >= 0 && r.gain >= 3));
    let transfers = [], r = best(top.soldiers);
    if (!ok(r)) {
      r = null;
      if (extra.length) {
        const r2 = best(top.soldiers + extra.reduce((s, c) => s + c.soldiers - 1, 0));
        if (ok(r2)) { r = r2; transfers = extra.map(c => ({ from: c.iso, to: top.iso, n: c.soldiers - 1, why: `consolidating ${c.name}'s spare soldiers into ${top.name} to make an attack viable` })); }
      }
    }
    return { transfers, attack: r && { from: top.iso, to: r.f.iso, why: `attacking ${r.f.name} (${r.f.soldiers} defenders) from ${top.name}; victory garrisons ${r.gain} soldiers` }, skipWhy: 'no target where my dice odds beat the defenders, so I am saving soldiers' };
  }
  static carryOn(g) {
    const a = g.c(g.attack.from), d = g.c(g.attack.to), pw = a.soldiers - 1;
    return pw >= d.soldiers || d.soldiers === 1
      ? { go: true, why: `${pw} attackers vs ${d.soldiers} defenders, pressing on` }
      : { go: false, why: `outgunned ${pw} vs ${d.soldiers}, cutting losses` };
  }
}
