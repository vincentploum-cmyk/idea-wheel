// The board's calibration, stored (lib/nhl-data/calibration-pure.js has the fit): learned from the season's graded runs
// whenever the season's scorecard is built — the History tab's first grade, the morning refresh in the background —
// and read with the slate by Best bets and the shuffle. Until the site has stored one, the seed fitted on the scorecard
// export of 2026-10-30 (Oct 8–29, `tools/predictors/calibration-seed.mjs`) stands in. The same calibration is never
// written twice: a write drops every build kept per store state (lib/memo.js).
import { readJson, writeJson } from '../nhl-store';
import { calibrationOf } from './calibration-pure';
import { studyWeight, studyWeightGoals } from './picks-pure';
import SEED from './seed/calibration.json';

export const CALIBRATION_PATH = 'data/scorecard/calibration.json';

/** A graded scorecard row (gradeRow) as the fit reads it: the run's λ, the study's that morning, what he got. */
export const fitRow = (r) => ({ lamS: r.m?.lambdaS ?? null, lamG: r.m?.lambdaG ?? null, studyS: r.study?.lamS ?? null, studyG: r.study?.lamG ?? null, sog: r.actual?.sog ?? 0, g: r.actual?.g ?? 0 });

/** The board's weights now (the study's share in shots and in goals). */
export const boardWeights = (env = process.env) => ({ w: studyWeight(env), wG: studyWeightGoals(env) });

/** The calibration the board reads: the stored one, else the seed. */
export async function loadCalibration() {
  const stored = await readJson(CALIBRATION_PATH).catch(() => null);
  return stored?.reads ? stored : SEED;
}

const sameFits = (a, b) => !!a && !!b && a.games === b.games && JSON.stringify(a.weights) === JSON.stringify(b.weights) && JSON.stringify(a.reads) === JSON.stringify(b.reads);

/** Learn the calibration from a season's graded rows and store it (the stored one comes back when it says the same). */
export async function saveCalibration(rows, { from = null, to = null } = {}) {
  if (!rows?.length) return null;
  const next = calibrationOf(rows.map(fitRow), boardWeights(), { from, to });
  const cur = await readJson(CALIBRATION_PATH).catch(() => null);
  if (sameFits(cur, next)) return cur;
  await writeJson(CALIBRATION_PATH, { ...next, source: 'graded runs' });
  return next;
}
