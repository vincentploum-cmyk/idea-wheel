// Poisson fits: log λ = b0 + log R + b1 log opp + b2 home [+ g · log(S*/R)], S* = his rate vs similar defenses shrunk at k.
const fs = require('fs'); const rows = JSON.parse(fs.readFileSync(process.argv[2])); const label = process.argv[3] || '';
const K = 10; const lg = Math.log;
function fit(X, y, off) { const p = X[0].length; let b = new Array(p).fill(0);
  for (let it = 0; it < 40; it++) { const g = new Array(p).fill(0); const H = Array.from({ length: p }, () => new Array(p).fill(0));
    for (let i = 0; i < y.length; i++) { const z = off[i] + X[i].reduce((s, x, j) => s + x * b[j], 0); const m = Math.exp(z); const e = m - y[i]; for (let j = 0; j < p; j++) { g[j] += e * X[i][j]; for (let k = 0; k < p; k++) H[j][k] += m * X[i][j] * X[i][k]; } }
    for (let j = 0; j < p; j++) H[j][j] += 1e-6;
    const A = H.map((r, i) => [...r, g[i]]); for (let c = 0; c < p; c++) { let pv = c; for (let r = c + 1; r < p; r++) if (Math.abs(A[r][c]) > Math.abs(A[pv][c])) pv = r; [A[c], A[pv]] = [A[pv], A[c]]; for (let r = 0; r < p; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let q = c; q <= p; q++) A[r][q] -= f * A[c][q]; } }
    b = b.map((v, j) => v - A[j][p] / A[j][j]); }
  // standard errors from the Hessian at the end
  const H = Array.from({ length: p }, () => new Array(p).fill(0)); for (let i = 0; i < y.length; i++) { const m = Math.exp(off[i] + X[i].reduce((s, x, j) => s + x * b[j], 0)); for (let j = 0; j < p; j++) for (let k = 0; k < p; k++) H[j][k] += m * X[i][j] * X[i][k]; }
  // invert H (small)
  const n = p; const A = H.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]); for (let c = 0; c < n; c++) { let pv = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[pv][c])) pv = r; [A[c], A[pv]] = [A[pv], A[c]]; const d = A[c][c]; for (let q = 0; q < 2 * n; q++) A[c][q] /= d; for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c]; for (let q = 0; q < 2 * n; q++) A[r][q] -= f * A[c][q]; } }
  return { b, se: b.map((_, j) => Math.sqrt(A[j][n + j])) };
}
const dev = (X, y, off, b) => 2 * y.reduce((s, yi, i) => { const m = Math.exp(off[i] + X[i].reduce((a, x, j) => a + x * b[j], 0)); return s + (yi > 0 ? yi * lg(yi / m) : 0) - (yi - m); }, 0);
const ok = rows.filter((r) => r.R > 0.05);
const y = ok.map((r) => r.sog); const off = ok.map((r) => lg(r.R));
const base = (r) => [1, lg(r.opp), r.home];
const shr = (r, key) => { const s = r[key]; const v = s.n ? (s.n * s.s + K * r.R) / (s.n + K) : r.R; return lg(Math.max(v, 0.05) / r.R); };
// 5-fold CV by date
const dates = [...new Set(ok.map((r) => r.date))].sort(); const fold = (r) => dates.indexOf(r.date) % 5;
function cv(feat) { let d = 0; for (let k = 0; k < 5; k++) { const tr = ok.map((r, i) => i).filter((i) => fold(ok[i]) !== k); const te = ok.map((r, i) => i).filter((i) => fold(ok[i]) === k); const { b } = fit(tr.map((i) => feat(ok[i])), tr.map((i) => y[i]), tr.map((i) => off[i])); d += dev(te.map((i) => feat(ok[i])), te.map((i) => y[i]), te.map((i) => off[i]), b); } return d; }
const d0 = cv(base); const null0 = dev(ok.map(() => [0]), y, off, [0]);
console.log(`${label}: ${ok.length} skater-games, mean sog ${(y.reduce((a, b) => a + b, 0) / y.length).toFixed(2)}`);
const fb = fit(ok.map(base), y, off); console.log(`  base: opponent coef ${fb.b[1].toFixed(3)} ± ${fb.se[1].toFixed(3)}, home ${fb.b[2].toFixed(3)}`);
for (const [key, name] of [['tier', 'same third of shots allowed'], ['posT', 'same third of shots allowed to his position'], ['near', '8 most similar defenses (shots, attempts, chances allowed)']]) {
  const feat = (r) => [...base(r), shr(r, key)];
  const f = fit(ok.map(feat), y, off); const dcv = cv(feat);
  const avgN = ok.reduce((a, r) => a + r[key].n, 0) / ok.length;
  console.log(`  + vs ${name}: coef ${f.b[3].toFixed(3)} ± ${f.se[3].toFixed(3)} (z ${(f.b[3] / f.se[3]).toFixed(1)}), CV deviance change ${(dcv - d0).toFixed(1)} (negative = better), avg games vs similar ${avgN.toFixed(1)}`);
}
// buckets: his rate vs similar defenses against his overall rate -> actual / expected (base model)
const fB = fit(ok.map(base), y, off).b;
for (const key of ['posT', 'near']) {
  const B = {}; for (let i = 0; i < ok.length; i++) { const r = ok[i]; const s = r[key]; if (s.n < 5) continue; const q = s.s / r.R; const k = q < 0.8 ? '<0.8×' : q < 0.95 ? '0.8–0.95×' : q < 1.05 ? '0.95–1.05×' : q < 1.2 ? '1.05–1.2×' : '1.2×+'; const m = Math.exp(off[i] + base(r).reduce((a, x, j) => a + x * fB[j], 0)); (B[k] ??= { n: 0, a: 0, e: 0, h3: 0, p3: 0 }); const o = B[k]; o.n++; o.a += r.sog; o.e += m; o.h3 += r.sog >= 3 ? 1 : 0; let c = 0, t = Math.exp(-m); for (let j = 0; j < 3; j++) { c += t; t *= m / (j + 1); } o.p3 += 1 - c; }
  console.log(`  buckets (${key}, 5+ games vs similar): ` + ['<0.8×', '0.8–0.95×', '0.95–1.05×', '1.05–1.2×', '1.2×+'].filter((k) => B[k]).map((k) => `${k} n${B[k].n} shots ${(B[k].a / B[k].e).toFixed(3)}× expected, 3+ ${(B[k].h3 / B[k].n * 100).toFixed(1)}% vs ${(B[k].p3 / B[k].n * 100).toFixed(1)}%`).join(' | '));
}
