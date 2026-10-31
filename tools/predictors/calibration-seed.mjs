// The board's calibration from a scorecard export (`/api/nhl/data/scorecard?from=…&rows=1`, signed in), the same fit
// the site makes from its graded runs (lib/nhl-data/calibration-pure.js): written as the seed the site reads until its
// own season scorecard has stored one, and checked first on games the fit never saw (fitted before `--holdout`, read on
// and after it) so the calibrated chance is shown to land where it says.
//
//   node --import ./tools/audit/register.mjs tools/predictors/calibration-seed.mjs <export.json> \
//     [--holdout YYYY-MM-DD] [--w 0] [--wG 1] [--out lib/nhl-data/seed/calibration.json]
import fs from 'node:fs';
import { calibrationOf, calibratedChance, readsOf, calibrate } from '../../lib/nhl-data/calibration-pure.js';
import { poissonAtLeast } from '../../lib/nhl-data/picks-pure.js';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const file = process.argv[2];
const holdout = arg('--holdout'); const out = arg('--out');
const weights = { w: Number(arg('--w', 0)), wG: Number(arg('--wG', 1)) };
const j = JSON.parse(fs.readFileSync(file, 'utf8'));
const rows = (j.rows || []).map((r) => ({ date: r.date, lamS: r.lambdaS, lamG: r.lambdaG, studyS: r.studyS, studyG: r.studyG, sog: r.sog, g: r.g }));
if (!rows.length) { console.error('no rows: export with ?rows=1'); process.exit(2); }
const pct = (v) => (v == null || Number.isNaN(v) ? '—' : `${Math.round(v * 100)}%`);

function check(cal, test, read, stat, height, bands) {
  const list = test.map((r) => ({ lam: readsOf(r, weights)[read][stat], y: (Number(r[stat]) || 0) >= height })).filter((x) => x.lam > 0)
    .map((x) => ({ ...x, raw: poissonAtLeast(x.lam, height), cal: calibratedChance(cal.reads[read], stat, x.lam, height) }));
  const line = (key) => bands.map(([lo, hi]) => {
    const m = list.filter((x) => x[key] >= lo && x[key] < hi);
    return m.length ? `${Math.round(lo * 100)}–${Math.round(Math.min(hi, 1) * 100)}%: said ${pct(m.reduce((s, x) => s + x[key], 0) / m.length)}, landed ${pct(m.filter((x) => x.y).length / m.length)} (${m.length})` : null;
  }).filter(Boolean).join(' · ');
  console.log(`  ${stat === 'sog' ? `${height}+ SOG` : `${height}+ goal`} (${read})`);
  console.log(`    as stated  ${line('raw')}`);
  console.log(`    calibrated ${line('cal')}`);
}

if (holdout) {
  const fit = rows.filter((r) => r.date < holdout); const test = rows.filter((r) => r.date >= holdout);
  const cal = calibrationOf(fit, weights, { from: fit[0]?.date, to: holdout });
  console.log(`fitted on ${fit.length} graded games before ${holdout}, read on ${test.length} from it:`);
  check(cal, test, 'board', 'sog', 3, [[0.4, 0.5], [0.5, 0.6], [0.6, 0.7], [0.7, 1.01]]);
  check(cal, test, 'board', 'sog', 4, [[0.2, 0.3], [0.3, 0.4], [0.4, 0.5], [0.5, 1.01]]);
  check(cal, test, 'board', 'g', 1, [[0.2, 0.3], [0.3, 0.4], [0.4, 1.01]]);
}
const dates = rows.map((r) => r.date).sort();
const cal = calibrationOf(rows, weights, { from: dates[0], to: dates[dates.length - 1], at: j.builtAt || undefined });
for (const read of ['board', 'study']) {
  for (const stat of ['sog', 'g']) {
    const fits = Object.entries(cal.reads[read][stat]).filter(([, f]) => f).map(([k, f]) => `${k}+ a ${f.a} b ${f.b} (${f.n} games; 50%→${pct(calibrate(f, 0.5))}, 70%→${pct(calibrate(f, 0.7))}, 80%→${pct(calibrate(f, 0.8))})`);
    console.log(`${read} ${stat}: ${fits.join(' | ') || 'too few games'}`);
  }
}
if (out) { fs.writeFileSync(out, JSON.stringify({ ...cal, source: 'seed', export: file.split('/').pop() })); console.log('written', out); }
