// Does a tired defense (the defending team on the 2nd night of a back-to-back) give up more shots than the skater's rate
// and its shots-allowed table say? Vincent, 2026-11-23: "Test the tired defense effect for NHL shots"
// (docs/audits/2026-11-23-nhl-tired-defense.md). Leak-free: every read on a date from that season's games before it.
//   node tools/predictors/tired_defense.js .nhl-data/predictors/2024/games .nhl-data/predictors/2025/games .nhl-data/predictors/2026/games
const fs = require('fs'); const path = require('path');
const grp = (p) => (p === 'D' ? 'D' : 'F');
const lg = Math.log;
function rowsOf(dir) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  const T = {}; const tm = (t) => (T[t] ??= { gp: 0, toF: 0, nF: 0, toD: 0, nD: 0, dates: [] });
  const P = {}; const rows = [];
  for (const f of files) {
    const day = JSON.parse(fs.readFileSync(path.join(dir, f)));
    const games = (day.games || []).filter((g) => g.gameType === 2); if (!games.length) continue;
    const teams = Object.entries(T).filter(([, v]) => v.gp >= 10);
    const lgF = teams.reduce((s, [, v]) => s + v.toF, 0) / Math.max(1, teams.reduce((s, [, v]) => s + v.nF, 0));
    const lgD = teams.reduce((s, [, v]) => s + v.toD, 0) / Math.max(1, teams.reduce((s, [, v]) => s + v.nD, 0));
    const rest = (t) => { const d = T[t]?.dates; if (!d?.length) return 9; return Math.round((new Date(day.date) - new Date(d[d.length - 1])) / 864e5); };
    const threeInFour = (t) => { const d = T[t]?.dates || []; return d.filter((x) => (new Date(day.date) - new Date(x)) / 864e5 <= 3).length >= 2; };
    for (const g of games) {
      for (const s of g.skaters || []) {
        const h = P[s.id] || []; const v = T[s.opp];
        if (!v || v.gp < 10 || h.length < 10 || teams.length < 28) continue;
        const G = grp(s.pos);
        const season = h.reduce((a, x) => a + x.sog, 0) / h.length; const l10 = h.slice(-10).reduce((a, x) => a + x.sog, 0) / 10;
        const R = 0.6 * season + 0.4 * l10; if (R < 0.3) continue;
        const opp = G === 'D' ? v.toD / v.nD / lgD : v.toF / v.nF / lgF;
        const oppRest = rest(s.opp); const ownRest = rest(s.team);
        rows.push({ date: day.date, sog: s.sog, R, opp, home: s.venue === 'H' ? 1 : 0, oppB2B: oppRest === 1 ? 1 : 0, ownB2B: ownRest === 1 ? 1 : 0, opp3in4: threeInFour(s.opp) ? 1 : 0, oppRested: oppRest >= 3 ? 1 : 0, oppHome: s.venue === 'A' ? 1 : 0, G });
      }
    }
    for (const g of games) {
      for (const side of ['home', 'away']) {
        const team = g[side].abbrev; const other = g[side === 'home' ? 'away' : 'home'].abbrev;
        const v = tm(other); v.gp++;
        for (const s of (g.skaters || []).filter((x) => x.team === team)) { if (grp(s.pos) === 'D') { v.toD += s.sog; v.nD++; } else { v.toF += s.sog; v.nF++; } }
      }
      tm(g.home.abbrev).dates.push(day.date); tm(g.away.abbrev).dates.push(day.date);
      for (const s of g.skaters || []) (P[s.id] ??= []).push({ sog: s.sog });
    }
  }
  return rows;
}
function fit(X, y, off) {
  const p = X[0].length; let b = new Array(p).fill(0);
  const solve = (H, g) => { const n = g.length; const A = H.map((r, i) => [...r, g[i]]); for (let c = 0; c < n; c++) { let pv = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[pv][c])) pv = r; [A[c], A[pv]] = [A[pv], A[c]]; for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let q = c; q <= n; q++) A[r][q] -= f * A[c][q]; } } return A.map((r, i) => r[n] / r[i]); };
  let H;
  for (let it = 0; it < 30; it++) {
    const g = new Array(p).fill(0); H = Array.from({ length: p }, () => new Array(p).fill(0));
    for (let i = 0; i < y.length; i++) { const m = Math.exp(off[i] + X[i].reduce((s, x, j) => s + x * b[j], 0)); const e = m - y[i]; for (let j = 0; j < p; j++) { g[j] += e * X[i][j]; for (let k = 0; k < p; k++) H[j][k] += m * X[i][j] * X[i][k]; } }
    const d = solve(H, g); b = b.map((v, j) => v - d[j]); if (Math.max(...d.map(Math.abs)) < 1e-10) break;
  }
  const se = b.map((_, j) => { const e = new Array(p).fill(0); e[j] = 1; return Math.sqrt(solve(H, e)[j]); });
  return { b, se };
}
const dev = (X, y, off, b) => 2 * y.reduce((s, yi, i) => { const m = Math.exp(off[i] + X[i].reduce((a, x, j) => a + x * b[j], 0)); return s + (yi > 0 ? yi * lg(yi / m) : 0) - (yi - m); }, 0);
function cvGain(rows, featA, featB) {
  const dates = [...new Set(rows.map((r) => r.date))].sort(); const fold = new Map(dates.map((d, i) => [d, i % 5]));
  let dA = 0; let dB = 0; const y = rows.map((r) => r.sog); const off = rows.map((r) => lg(r.R));
  for (let k = 0; k < 5; k++) {
    const tr = []; const te = []; rows.forEach((r, i) => (fold.get(r.date) === k ? te : tr).push(i));
    for (const [feat, acc] of [[featA, 'A'], [featB, 'B']]) {
      const { b } = fit(tr.map((i) => feat(rows[i])), tr.map((i) => y[i]), tr.map((i) => off[i]));
      const d = dev(te.map((i) => feat(rows[i])), te.map((i) => y[i]), te.map((i) => off[i]), b);
      if (acc === 'A') dA += d; else dB += d;
    }
  }
  return ((dB - dA) / rows.length) * 1000;   // deviance change per 1,000 skater-games (negative = better)
}
const base = (r) => [1, lg(r.opp), r.home, r.ownB2B];
const withTired = (r) => [...base(r), r.oppB2B];
const pois = (m, k) => { let c = 0, t = Math.exp(-m); for (let j = 0; j < k; j++) { c += t; t *= m / (j + 1); } return 1 - c; };
const all = [];
for (const dir of process.argv.slice(2)) {
  const rows = rowsOf(dir); const label = path.basename(path.dirname(dir));
  all.push(...rows.map((r) => ({ ...r, season: label })));
  const y = rows.map((r) => r.sog); const off = rows.map((r) => lg(r.R));
  const f = fit(rows.map(withTired), y, off);
  const nb = rows.filter((r) => r.oppB2B).length;
  console.log(`\n${label}-${+label + 1 - 2000}: ${rows.length} skater-games, ${nb} against a defense on a back-to-back (${(nb / rows.length * 100).toFixed(1)}%)`);
  console.log(`  coefficients: opp table ${f.b[1].toFixed(3)} ± ${f.se[1].toFixed(3)}, home ${f.b[2].toFixed(3)} ± ${f.se[2].toFixed(3)}, his own B2B ${f.b[3].toFixed(3)} ± ${f.se[3].toFixed(3)}, defense on B2B ${f.b[4].toFixed(3)} ± ${f.se[4].toFixed(3)} (×${Math.exp(f.b[4]).toFixed(3)}, z ${(f.b[4] / f.se[4]).toFixed(1)})`);
  console.log(`  cross-validated deviance change from adding it: ${cvGain(rows, base, withTired).toFixed(2)} per 1,000 (negative = better)`);
}
// pooled, the splits
const y = all.map((r) => r.sog); const off = all.map((r) => lg(r.R));
const F = fit(all.map(withTired), y, off);
console.log(`\nPooled ${all.length}: defense on B2B ${F.b[4].toFixed(3)} ± ${F.se[4].toFixed(3)} (×${Math.exp(F.b[4]).toFixed(3)}, z ${(F.b[4] / F.se[4]).toFixed(1)}); CV ${cvGain(all, base, withTired).toFixed(2)} per 1,000`);
const split = (name, feat) => { const f = fit(all.map(feat), y, off); console.log(`  ${name}: ` + f.b.slice(4).map((v, j) => `×${Math.exp(v).toFixed(3)} (z ${(v / f.se[4 + j]).toFixed(1)})`).join(' · ')); };
split('defense on B2B at home · on the road', (r) => [...base(r), r.oppB2B * r.oppHome, r.oppB2B * (1 - r.oppHome)]);
split('defense on B2B, his team rested · both on B2B', (r) => [...base(r), r.oppB2B * (1 - r.ownB2B), r.oppB2B * r.ownB2B]);
split('defense 3 games in 4 nights (beside B2B)', (r) => [...base(r), r.oppB2B, r.opp3in4]);
split('defense rested 3+ days', (r) => [...base(r), r.oppB2B, r.oppRested]);
split('defense on B2B for forwards · defensemen', (r) => [...base(r), r.oppB2B * (r.G === 'F' ? 1 : 0), r.oppB2B * (r.G === 'D' ? 1 : 0)]);
split('defense on B2B, soft table (top third) · rest', (r) => [...base(r), r.oppB2B * (r.opp >= 1.05 ? 1 : 0), r.oppB2B * (r.opp < 1.05 ? 1 : 0)]);
// what the bars do (expected from the base fit, without the term)
const fb = fit(all.map(base), y, off).b;
for (const [name, flt] of [['defense on B2B', (r) => r.oppB2B], ['defense rested', (r) => !r.oppB2B]]) {
  const R = all.map((r, i) => [r, i]).filter(([r]) => flt(r)); let a = 0, e = 0, h3 = 0, e3 = 0, h4 = 0, e4 = 0;
  for (const [r, i] of R) { const m = Math.exp(off[i] + base(r).reduce((s, x, j) => s + x * fb[j], 0)); a += r.sog; e += m; h3 += r.sog >= 3; e3 += pois(m, 3); h4 += r.sog >= 4; e4 += pois(m, 4); }
  console.log(`  ${name}: shots ×${(a / e).toFixed(3)} of expected · 3+ ${(e3 / R.length * 100).toFixed(1)}% expected → ${(h3 / R.length * 100).toFixed(1)}% · 4+ ${(e4 / R.length * 100).toFixed(1)}% → ${(h4 / R.length * 100).toFixed(1)}% (n ${R.length})`);
}
