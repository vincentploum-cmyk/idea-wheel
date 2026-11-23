// Do skaters' shots against defenses similar to tonight's opponent predict tonight's shots, over his own rate and the
// opponent's shots allowed? Leak-free: every read on a date is built from games before it, within the season.
const fs = require('fs'); const path = require('path');
const dir = process.argv[2]; const MIN_GP = +process.argv[3] || 15; const SEED = +process.argv[4] || 0;
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
const grp = (p) => (p === 'D' ? 'D' : 'F');
let rnd = SEED; const rand = () => { rnd = (rnd * 16807 + 11) % 2147483647; return rnd / 2147483647; };
// team allowed accumulators: per team { gp, sa, ca, sca, toF, nF, toD, nD }
const T = {}; const tm = (t) => (T[t] ??= { gp: 0, sa: 0, ca: 0, sca: 0, toF: 0, nF: 0, toD: 0, nD: 0 });
const P = {}; // player id -> list of { opp, sog }
const rows = [];
for (const f of files) {
  const day = JSON.parse(fs.readFileSync(path.join(dir, f)));
  const games = (day.games || []).filter((g) => g.gameType === 2);
  if (!games.length) continue;
  // this morning's team profiles
  const teams = Object.entries(T).filter(([, v]) => v.gp >= 5);
  const prof = {};
  if (teams.length >= 20) {
    const lg = (k) => teams.reduce((s, [, v]) => s + v[k], 0) / teams.reduce((s, [, v]) => s + v.gp, 0);
    const L = { sa: lg('sa'), ca: lg('ca'), sca: lg('sca') };
    const lgF = teams.reduce((s, [, v]) => s + v.toF, 0) / teams.reduce((s, [, v]) => s + v.nF, 0);
    const lgD = teams.reduce((s, [, v]) => s + v.toD, 0) / teams.reduce((s, [, v]) => s + v.nD, 0);
    const vals = teams.map(([t, v]) => [t, { sa: v.sa / v.gp, ca: v.ca / v.gp, sca: v.sca / v.gp, F: v.toF / v.nF, D: v.toD / v.nD }]);
    const sd = (k) => { const m = vals.reduce((s, [, x]) => s + x[k], 0) / vals.length; return Math.sqrt(vals.reduce((s, [, x]) => s + (x[k] - m) ** 2, 0) / vals.length) || 1; };
    const SD = { sa: sd('sa'), ca: sd('ca'), sca: sd('sca') };
    const tierOf = (k) => { const sorted = [...vals].sort((a, b) => a[1][k] - b[1][k]); const out = {}; sorted.forEach(([t], i) => { out[t] = Math.floor((3 * i) / sorted.length); }); return out; };
    const tSA = tierOf('sa'); const tF = tierOf('F'); const tD = tierOf('D');
    for (const [t, x] of vals) {
      const near = vals.filter(([u]) => u !== t).map(([u, y]) => [u, Math.hypot((x.sa - y.sa) / SD.sa, (x.ca - y.ca) / SD.ca, (x.sca - y.sca) / SD.sca)]).sort((a, b) => a[1] - b[1]).slice(0, 8).map(([u]) => u);
      prof[t] = { oppF: x.F / lgF, oppD: x.D / lgD, oppSA: x.sa / L.sa, tierSA: tSA[t], tierF: tF[t], tierD: tD[t], near: new Set(near) };
    }
  }
  for (const g of games) {
    for (const s of g.skaters || []) {
      const hist = P[s.id] || [];
      const pr = prof[s.opp];
      if (pr && hist.length >= MIN_GP) {
        const G = grp(s.pos);
        const R = hist.reduce((a, h) => a + h.sog, 0) / hist.length;
        const posTier = G === 'D' ? 'tierD' : 'tierF';
        const sim = (pred) => { const h = hist.filter((x) => prof[x.opp] && pred(prof[x.opp], x.opp)); return { n: h.length, s: h.length ? h.reduce((a, x) => a + x.sog, 0) / h.length : null }; };
        rows.push({
          date: day.date, sog: s.sog, R, n: hist.length, opp: G === 'D' ? pr.oppD : pr.oppF, home: s.venue === 'H' ? 1 : 0,
          tier: sim((p) => p.tierSA === pr.tierSA), posT: sim((p) => p[posTier] === pr[posTier]), near: sim((p, o) => pr.near.has(o) || o === s.opp),
        });
      }
    }
  }
  // then add today's games to history
  for (const g of games) {
    for (const side of ['home', 'away']) {
      const team = g[side].abbrev; const other = g[side === 'home' ? 'away' : 'home'].abbrev;
      const v = tm(other); // `other` allowed what `team` did
      const sk = (g.skaters || []).filter((s) => s.team === team);
      v.gp++; v.sa += g[side].sog; v.ca += sk.reduce((a, s) => a + (s.icf || 0), 0); v.sca += sk.reduce((a, s) => a + (s.iscf || 0), 0);
      for (const s of sk) { if (grp(s.pos) === 'D') { v.toD += s.sog; v.nD++; } else { v.toF += s.sog; v.nF++; } }
    }
    for (const s of g.skaters || []) (P[s.id] ??= []).push({ opp: SEED ? null : s.opp, sog: s.sog, realOpp: s.opp });
  }
  if (SEED) { // permutation null: shuffle which opponent each past game was against, within the player
    for (const h of Object.values(P)) { const o = h.map((x) => x.realOpp); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } h.forEach((x, i) => { x.opp = o[i]; }); }
  }
}
fs.writeFileSync(process.argv[5] || '/dev/null', JSON.stringify(rows));
console.error(dir, 'rows', rows.length);
