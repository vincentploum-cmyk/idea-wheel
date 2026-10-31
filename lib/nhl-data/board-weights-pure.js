// The most accurate chance the board can print for shots and for goals (Vincent, 2026-10-31: "I need to have the most
// accurate % for both shots and goals"): which read the board's λ should be — the run's λ, the study's, or a blend of
// the two — is learned from the site's own graded nights, per stat, instead of being set by hand on the server. For
// every candidate share of the study (0 = the run's λ alone, 1 = the study's alone, a quarter step between) the season is
// walked forward night by night: the calibration (lib/nhl-data/calibration-pure.js) is fitted at that share on the
// nights before, the night's skaters are read through it at the bars' floors and the rung above (3+ and 4+ SOG, 1+ and
// 2+ goals), and the Brier of those chances is pooled over every night after the first `warmNights`. The share with
// the lowest Brier is the board's — once `minNights` nights and `minRows` chances are behind the verdict, and only when
// it beats the share the board is on by `margin` (a tie keeps the board where it is, so it never flips on noise). The
// server env (`NHL_PICKS_STUDY_WEIGHT`, `NHL_PICKS_STUDY_WEIGHT_GOALS`) overrides the verdict when set. The model's math
// is untouched: the run's λ stays the run's; this only decides whose λ the printed chance is read off.
// Pure: the panels name the verdict from the board's payload.
import { poissonAtLeast } from './picks-pure';
import { fitHeight, calibratedChance } from './calibration-pure';

export const SHARES = [0, 0.25, 0.5, 0.75, 1];
export const DEFAULT_WEIGHTS = { w: 0, wG: 1 };     // the board before the verdict: the run's shots, the study's goals (2026-10-27)
export const LEARN = { warmNights: 6, minNights: 8, minRows: 1500, margin: 0.0005 };
export const SCORED = { sog: [3, 4], g: [1, 2] };    // the heights the verdict is scored on: the bars' floors and the rung above
const FIT_HEIGHTS = { sog: [1, 2, 3, 4], g: [1, 2] }; // the calibration a scored chance needs (never above the rung below)
const r4 = (v) => (v == null ? null : Math.round(v * 10000) / 10000);

const lamOf = (r, stat) => (stat === 'sog' ? [r.lamS, r.studyS] : [r.lamG, r.studyG]);
/** A row the comparison can use: both λ on record for the stat (a blend needs both). */
export function usableFor(r, stat) { const [a, b] = lamOf(r, stat); return a > 0 && b > 0 && Number.isFinite(Number(r[stat])); }
/** The board's λ at a share of the study. */
export function lamAt(r, stat, k) { const [a, b] = lamOf(r, stat); return (1 - k) * a + k * b; }

/** The calibration of one stat at one share, fitted on `rows`: { [height]: fit | null }. */
function fitStat(rows, stat, k) {
  const fits = {};
  for (const h of FIT_HEIGHTS[stat]) fits[h] = fitHeight(rows.map((r) => [poissonAtLeast(lamAt(r, stat, k), h), r[stat] >= h ? 1 : 0]));
  return fits;
}

/**
 * One share walked forward over the season: each night after the first `warmNights` read through the calibration fitted
 * on the nights before it, at the scored heights. `rows` carry { date, lamS, lamG, studyS, studyG, sog, g } and are
 * usable for the stat. { brier, n (chances scored), nights (scored) }.
 */
export function walkForward(rows, stat, k, { warmNights = LEARN.warmNights } = {}) {
  const byNight = new Map();
  for (const r of rows) { if (!byNight.has(r.date)) byNight.set(r.date, []); byNight.get(r.date).push(r); }
  const nights = [...byNight.keys()].sort();
  const hist = [];
  let sum = 0; let n = 0; let scored = 0;
  nights.forEach((date, i) => {
    const night = byNight.get(date);
    if (i >= warmNights) {
      const cal = { [stat]: fitStat(hist, stat, k) };
      for (const r of night) {
        const lam = lamAt(r, stat, k);
        for (const h of SCORED[stat]) { const p = calibratedChance(cal, stat, lam, h); sum += (p - (r[stat] >= h ? 1 : 0)) ** 2; n += 1; }
      }
      scored += 1;
    }
    hist.push(...night);
  });
  return { brier: n ? r4(sum / n) : null, n, nights: scored };
}

/**
 * The verdict: per stat the share the board should read at, with every share's walk-forward score and why the share was
 * kept or moved. `defaults` is where the board is now (the stored verdict, else DEFAULT_WEIGHTS): the board moves only
 * when another share beats it by `margin`, and never before `minNights` scored nights and `minRows` chances.
 * { weights: { w, wG }, at, from, to, rows, stats: { sog | g: { share, from (the incumbent), best, reason, scores } } }.
 */
export function learnWeights(rows, { shares = SHARES, learn = LEARN, defaults = DEFAULT_WEIGHTS, at = new Date().toISOString() } = {}) {
  const sorted = (rows || []).filter((r) => r?.date).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const out = { at, from: sorted[0]?.date ?? null, to: sorted[sorted.length - 1]?.date ?? null, rows: sorted.length, learn: { ...learn }, stats: {} };
  for (const [stat, key] of [['sog', 'w'], ['g', 'wG']]) {
    const incumbent = Number.isFinite(Number(defaults?.[key])) ? Number(defaults[key]) : DEFAULT_WEIGHTS[key];
    const usable = sorted.filter((r) => usableFor(r, stat));
    const scores = {};
    for (const k of shares) scores[k] = walkForward(usable, stat, k, learn);
    const enough = shares.every((k) => scores[k].n >= learn.minRows && scores[k].nights >= learn.minNights);
    // The lowest Brier; a tie goes to the board's own share, then to the share nearest it (a tie is no reason to move).
    const order = [...shares].sort((a, b) => Math.abs(a - incumbent) - Math.abs(b - incumbent));
    const best = order.reduce((b, k) => (scores[k].brier != null && (scores[b].brier == null || scores[k].brier < scores[b].brier) ? k : b), order[0]);
    const inc = shares.includes(incumbent) ? scores[incumbent] : null;
    let share = incumbent; let reason;
    if (!enough) reason = `too few graded nights to judge (${Math.min(...shares.map((k) => scores[k].nights))} scored, ${learn.minNights} needed; ${Math.min(...shares.map((k) => scores[k].n))} chances, ${learn.minRows} needed)`;
    else if (best === incumbent) reason = 'the board’s share predicts best';
    else if (inc == null || inc.brier == null) { share = best; reason = 'the board’s share is not among the candidates'; }
    else if (scores[best].brier <= inc.brier - learn.margin) { share = best; reason = `beats the board’s share by ${r4(inc.brier - scores[best].brier)} Brier (the margin is ${learn.margin})`; }
    else reason = `the best share is within the margin of the board’s (${r4(inc.brier - scores[best].brier)} Brier better, ${learn.margin} needed)`;
    out.stats[stat] = { share, from: incumbent, best: enough ? best : null, moved: share !== incumbent, reason, scores: Object.fromEntries(shares.map((k) => [k, scores[k]])) };
  }
  out.weights = { w: out.stats.sog.share, wG: out.stats.g.share };
  return out;
}

const envShare = (v) => { const n = Number(v); return v != null && v !== '' && Number.isFinite(n) && n >= 0 ? Math.min(1, n) : null; };

/**
 * The weights the board reads at now: the server env when it names a share (`NHL_PICKS_STUDY_WEIGHT` for shots,
 * `NHL_PICKS_STUDY_WEIGHT_GOALS` for goals), else the stored verdict's (`cal.weights` when the calibration carries
 * `learned`), else the defaults. `from` says which, per stat.
 */
export function boardWeightsOf(cal, env = process.env) {
  const e = { w: envShare(env?.NHL_PICKS_STUDY_WEIGHT), wG: envShare(env?.NHL_PICKS_STUDY_WEIGHT_GOALS) };
  const learned = cal?.learned?.stats ? cal.weights : null;
  const pick = (key) => (e[key] != null ? [e[key], 'env'] : learned && Number.isFinite(Number(learned[key])) ? [Number(learned[key]), 'learned'] : [DEFAULT_WEIGHTS[key], 'default']);
  const [w, fw] = pick('w'); const [wG, fwG] = pick('wG');
  return { w, wG, from: { w: fw, wG: fwG } };
}

/** The share in words, for the heads: "the run’s λ", "the study’s λ", "the run’s λ blended with the study’s at 50%". */
export function shareText(k) {
  const v = Number(k) || 0;
  if (v <= 0) return 'the run’s λ';
  if (v >= 1) return 'the study’s λ';
  return `the run’s λ blended with the study’s at ${Math.round(v * 100)}%`;
}

/** The verdict in a line for a stat's hover: every share's walk-forward Brier, the board's marked. */
export function verdictText(learned, stat) {
  const s = learned?.stats?.[stat];
  if (!s) return null;
  const label = (k) => (Number(k) <= 0 ? 'run' : Number(k) >= 1 ? 'study' : `${Math.round(k * 100)}% study`);
  const parts = Object.entries(s.scores).map(([k, v]) => `${label(k)} ${v.brier == null ? '—' : v.brier.toFixed(4)}${Number(k) === s.share ? ' ◀' : ''}`);
  const first = Object.values(s.scores)[0];
  return `${stat === 'sog' ? 'Shots' : 'Goals'}, walked forward over ${first?.nights ?? 0} graded nights (${first?.n ?? 0} chances at ${stat === 'sog' ? '3+ and 4+ SOG' : '1+ and 2+ goals'}; lower is better): ${parts.join(' · ')}. ${s.reason}.`;
}
