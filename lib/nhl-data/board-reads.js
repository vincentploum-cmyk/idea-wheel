// One number per skater across the site (Vincent, 2026-10-31: "how can I trust our website if I see these
// conflicts" — the Model tab's dashboard said McDavid 61% for a goal and Draisaitl 56% for 4+ shots while Best
// bets, on the same page, said 30% and 36%: the dashboard printed the run's own figures as stated, Best bets the
// board's — the study's goal read since 2026-10-27, every chance calibrated since 2026-10-30). The board's read
// of every skater (`buildPicks(date, { withSkaters: true })`, the shuffle's payload) is keyed by the model's own
// key here so the Model tab's rows, the rinks' chips and plays strips and the first-goal board can print the
// figure Best bets prints, the run's own kept beside it as `run` for the hovers. The model's math is untouched:
// the run's rows are saved as the run computed them; only what is printed moves.
// Pure: the Model tab (a client bundle) overlays its rows with it.
import { poissonAtLeast } from './picks-pure';
import { calibratedChance } from './calibration-pure';
import { modelKey } from './model-key';

const r2 = (v) => (v == null || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * 100) / 100);
const cap = (v, lim) => (v == null ? null : lim == null ? v : Math.min(v, lim));

/**
 * A skater's chance at a height off his λ: through the board's calibration when the payload carries one (the
 * figure the shuffle prints at that height), else the Poisson tail; never above the chance one height lower.
 */
function chanceAt(fits, stat, lam, height, below) {
  if (!(lam > 0)) return 0;
  const p = fits ? calibratedChance(fits, stat, lam, height) : poissonAtLeast(lam, height);
  return cap(r2(p), below);
}

/**
 * The board's reads from the picks payload built with every skater (`g.all` on `buildPicks(…, { withSkaters: true })`,
 * `g.skaters` on the shuffle's): { [modelKey]: { id, name, team, opp, lamS, lamG, p2, p3, p4, p5, p1g, p2g, raw,
 * calibrated, source } }. `p2` … `p1g` are the board's own figures (calibrated where the board is); `p5` and `p2g`
 * are read off the same λ through the same calibration, so the Model tab's 5+ and 2+ goal columns print what the
 * shuffle prints at those heights. `raw` holds the figures as stated when the board is calibrated. Null without games.
 */
export function boardReadsOf(payload) {
  if (!payload?.games?.length) return null;
  const fits = payload.calibration?.fits || null;
  const reads = {};
  for (const g of payload.games) {
    for (const row of g.all || g.skaters || []) {
      if (!row?.key) continue;
      const ch = row.chances || {};
      const lamS = row.lamS > 0 ? row.lamS : null; const lamG = row.lamG >= 0 ? row.lamG : null;
      const p2 = r2(ch.p2); const p3 = r2(ch.p3); const p4 = r2(ch.p4); const p1g = r2(ch.p1g);
      const raw = ch.raw ? {
        p2: r2(ch.raw.p2), p3: r2(ch.raw.p3), p4: r2(ch.raw.p4), p1g: r2(ch.raw.p1g),
        p5: lamS ? cap(r2(poissonAtLeast(lamS, 5)), r2(ch.raw.p4)) : null, p2g: lamG != null ? cap(r2(poissonAtLeast(lamG, 2)), r2(ch.raw.p1g)) : null,
      } : null;
      reads[row.key] = {
        id: row.id ?? null, name: row.name, team: row.team, opp: row.opp ?? null,
        lamS, lamG,
        p2, p3, p4, p5: lamS ? chanceAt(fits, 'sog', lamS, 5, p4) : null,
        p1g, p2g: lamG != null ? chanceAt(fits, 'g', lamG, 2, p1g) : null,
        raw, calibrated: ch.calibrated || null, source: row.source || payload.source || null,
      };
    }
  }
  return Object.keys(reads).length ? reads : null;
}

/** What the reads payload says about itself, for the heads and notes: the run, the calibration, how many skaters it covers. */
export function boardReadsMeta(payload, reads) {
  if (!payload) return null;
  return {
    date: payload.date || null, source: payload.source || null, modelRun: payload.modelRun || null,
    studyWeight: payload.studyWeight ?? null, studyWeightGoals: payload.studyWeightGoals ?? null,
    calibration: payload.calibration ? { read: payload.calibration.read, games: payload.calibration.games ?? null, from: payload.calibration.from ?? null, to: payload.calibration.to ?? null, at: payload.calibration.at ?? null } : null,
    skaters: reads ? Object.keys(reads).length : 0,
  };
}

/**
 * A slate skater's compact model object (`indexModelRows`) with the board's read printed over it: λ shots and goals
 * and every chance the rink reads (2+ … 5+ SOG, 1+ / 2+ G) are the board's; the run's own stay under `run`; the
 * gate, the attack score, the line and the flame — the run's selection inputs — stay the run's.
 */
export function withBoardModel(model, read) {
  if (!model || !read) return model;
  return {
    ...model,
    sog: read.lamS ?? model.sog, g: read.lamG ?? model.g,
    p2s: read.p2 ?? model.p2s, p3s: read.p3 ?? model.p3s, p4s: read.p4 ?? model.p4s, p5s: read.p5 ?? model.p5s,
    p1g: read.p1g ?? model.p1g, p2g: read.p2g ?? model.p2g,
    board: { calibrated: read.calibrated || null, source: read.source || null },
    run: model.run || { sog: model.sog ?? null, g: model.g ?? null, p2s: model.p2s ?? null, p3s: model.p3s ?? null, p4s: model.p4s ?? null, p5s: model.p5s ?? null, p1g: model.p1g ?? null, p2g: model.p2g ?? null },
  };
}

/**
 * The Model tab's result rows with the board's read printed over them: λ shots / goals, 2+ … 5+ SOG and 1+ / 2+ G
 * are the board's figures for every row the reads cover (keyed by team + name, any spelling of the team), the
 * run's own kept under `run`; a row the board has no read for (a skater not dressed tonight) stays as the run
 * stated it, marked `board: null`. The rows come back as they were when there are no reads.
 */
export function withBoardRows(rows, reads) {
  if (!Array.isArray(rows) || !reads) return rows;
  return rows.map((r) => {
    if (!r?.name) return r;
    const read = reads[modelKey(r.team, r.name)];
    if (!read) return r.board === undefined ? { ...r, board: null } : r;
    const run = r.run || { lambdaS: r.lambdaS ?? null, lambdaG: r.lambdaG ?? null, p2s: r.p2s ?? null, p3s: r.p3s ?? null, p4s: r.p4s ?? null, p5s: r.p5s ?? null, p1g: r.p1g ?? null, p2g: r.p2g ?? null };
    return {
      ...r,
      lambdaS: read.lamS ?? run.lambdaS, lambdaG: read.lamG ?? run.lambdaG,
      p2s: read.p2 ?? run.p2s, p3s: read.p3 ?? run.p3s, p4s: read.p4 ?? run.p4s, p5s: read.p5 ?? run.p5s,
      p1g: read.p1g ?? run.p1g, p2g: read.p2g ?? run.p2g,
      board: { calibrated: read.calibrated || null, source: read.source || null },
      run,
    };
  });
}

/** How many of the rows carry the board's read, for the head note. */
export function boardCoverage(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return { rows: list.length, read: list.filter((r) => r?.board).length };
}
