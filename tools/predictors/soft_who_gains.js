// Soft defenses (most shots allowed to the position, season to date that morning): who gains, and when it gets softer.
const fs = require('fs'); const path = require('path');
const dirs = process.argv.slice(2);
const grp = (p) => (p === 'D' ? 'D' : 'F');
const out = [];
for (const dir of dirs) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const T = {}; const tm = (t) => (T[t] ??= { gp: 0, toF: 0, nF: 0, toD: 0, nD: 0, sf: 0, last: null });
  const P = {};
  for (const f of files) {
    const day = JSON.parse(fs.readFileSync(path.join(dir, f)));
    const games = (day.games || []).filter((g) => g.gameType === 2); if (!games.length) continue;
    const teams = Object.entries(T).filter(([, v]) => v.gp >= 10);
    const prof = {};
    if (teams.length >= 28) {
      const lgF = teams.reduce((s, [, v]) => s + v.toF, 0) / teams.reduce((s, [, v]) => s + v.nF, 0);
      const lgD = teams.reduce((s, [, v]) => s + v.toD, 0) / teams.reduce((s, [, v]) => s + v.nD, 0);
      const lgSF = teams.reduce((s, [, v]) => s + v.sf, 0) / teams.reduce((s, [, v]) => s + v.gp, 0);
      for (const G of ['F', 'D']) {
        const r = teams.map(([t, v]) => [t, G === 'F' ? v.toF / v.nF / lgF : v.toD / v.nD / lgD]).sort((a, b) => b[1] - a[1]);
        r.forEach(([t, x], i) => { (prof[t] ??= {})[G] = { rank: i + 1, ratio: x }; });
      }
      for (const [t, v] of teams) prof[t].pace = v.sf / v.gp / lgSF;
    }
    for (const g of games) {
      const ds = (t) => { const l = T[t]?.last; return l ? Math.round((new Date(day.date) - new Date(l)) / 864e5) : 9; };
      for (const s of g.skaters || []) {
        const h = P[s.id] || []; const pr = prof[s.opp];
        if (pr && h.length >= 10) {
          const G = grp(s.pos); const season = h.reduce((a, x) => a + x.sog, 0) / h.length; const l10 = h.slice(-10).reduce((a, x) => a + x.sog, 0) / 10;
          const toi = h.slice(-10).reduce((a, x) => a + x.toi, 0) / 10; const pp = h.reduce((a, x) => a + (x.ppSog || 0), 0) / Math.max(1, h.reduce((a, x) => a + x.sog, 0));
          out.push({ season: dir.includes('2025') ? 2025 : 2026, G, pos: s.pos, sog: s.sog, R: 0.6 * season + 0.4 * l10, rank: pr[G].rank, ratio: pr[G].ratio, oppB2B: ds(s.opp) === 1 ? 1 : 0, ownB2B: ds(s.team) === 1 ? 1 : 0, home: s.venue === 'H' ? 1 : 0, toi, pp, oppPace: pr.pace ?? 1, ownPace: prof[s.team]?.pace ?? 1 });
        }
      }
    }
    for (const g of games) {
      for (const side of ['home', 'away']) {
        const team = g[side].abbrev; const other = g[side === 'home' ? 'away' : 'home'].abbrev;
        const v = tm(other); v.gp++;
        tm(team).sf += g[side].sog;
        for (const s of (g.skaters || []).filter((x) => x.team === team)) { if (grp(s.pos) === 'D') { v.toD += s.sog; v.nD++; } else { v.toF += s.sog; v.nF++; } }
      }
      tm(g.home.abbrev).last = day.date; tm(g.away.abbrev).last = day.date;
      for (const s of g.skaters || []) (P[s.id] ??= []).push({ sog: s.sog, toi: s.toi || 0, ppSog: s.ppSog || 0 });
    }
  }
}
const rows = out.filter((r) => r.R >= 0.5);
const pois = (m, k) => { let c = 0, t = Math.exp(-m); for (let j = 0; j < k; j++) { c += t; t *= m / (j + 1); } return 1 - c; };
// league-wide normaliser: actual / own rate overall (own rate runs slightly off overall)
const norm = rows.reduce((a, r) => a + r.sog, 0) / rows.reduce((a, r) => a + r.R, 0);
const tab = (title, keyF, order) => {
  const B = {}; for (const r of rows) { const k = keyF(r); if (k == null) continue; const b = (B[k] ??= { n: 0, a: 0, e: 0, h3: 0, e3: 0, h4: 0, e4: 0, h5: 0, e5: 0 }); const m = r.R * norm; b.n++; b.a += r.sog; b.e += m; b.h3 += r.sog >= 3; b.e3 += pois(m, 3); b.h4 += r.sog >= 4; b.e4 += pois(m, 4); b.h5 += r.sog >= 5; b.e5 += pois(m, 5); }
  console.log('\n' + title); for (const k of order || Object.keys(B).sort()) { const b = B[k]; if (!b) continue; const p = (x) => (x / b.n * 100).toFixed(1); console.log(`  ${k.padEnd(34)} n ${String(b.n).padStart(6)}  shots ×${(b.a / b.e).toFixed(3)}  3+ ${p(b.e3)}→${p(b.h3)}  4+ ${p(b.e4)}→${p(b.h4)}  5+ ${p(b.e5)}→${p(b.h5)}`); }
};

const rel = (title, keyF) => {
  const B = {}; for (const r of rows) { const k = keyF(r); if (k == null) continue; const t = r.rank <= 6 ? 'soft' : r.rank >= 27 ? 'tough' : r.rank >= 11 && r.rank <= 22 ? 'mid' : null; if (!t) continue; const b = ((B[k] ??= {})[t] ??= { n: 0, a: 0, e: 0, h3: 0, h4: 0 }); b.n++; b.a += r.sog; b.e += r.R; b.h3 += r.sog >= 3; b.h4 += r.sog >= 4; }
  console.log('\n' + title + '   (shots vs his rate, soft-6 / middle / tough-6 → soft over middle; 3+ hit soft vs middle)');
  for (const k of Object.keys(B).sort()) { const x = B[k]; if (!x.soft || !x.mid) continue; const f = (b) => b.a / b.e; console.log(`  ${k.padEnd(28)} n soft ${String(x.soft.n).padStart(5)}  ${f(x.soft).toFixed(3)} / ${f(x.mid).toFixed(3)} / ${x.tough ? f(x.tough).toFixed(3) : '-'}  → ×${(f(x.soft) / f(x.mid)).toFixed(3)}   3+ ${(x.soft.h3 / x.soft.n * 100).toFixed(1)}% vs ${(x.mid.h3 / x.mid.n * 100).toFixed(1)}%   4+ ${(x.soft.h4 / x.soft.n * 100).toFixed(1)}% vs ${(x.mid.h4 / x.mid.n * 100).toFixed(1)}%`); }
};
const vol = (r) => (r.R < 1.5 ? '1. under 1.5' : r.R < 2.5 ? '2. 1.5-2.5' : r.R < 3.5 ? '3. 2.5-3.5' : '4. 3.5+');
rel('His volume', vol);
rel('Defending team on a back-to-back', (r) => (r.oppB2B ? 'defense on B2B' : 'defense rested'));
rel('Home / away', (r) => (r.home ? 'home' : 'away'));
rel('His team volume', (r) => (r.ownPace >= 1.06 ? 'high' : r.ownPace <= 0.94 ? 'low' : 'middle'));
rel('Role', (r) => (r.G === 'D' ? (r.toi >= 21 ? 'D top pair' : 'D other') : r.toi >= 17 ? 'F top line' : r.toi >= 14 ? 'F middle' : 'F bottom'));
rel('Everyone', () => 'all');
