// The board's calibration, stored (lib/nhl-data/calibration-pure.js has the fit): learned from the season's graded runs
// whenever the season's scorecard is built — the History tab's first grade, the morning refresh in the background —
// and read with the slate by Best bets and the shuffle. Until the site has stored one, the seed fitted on the scorecard
// export of 2026-10-30 (Oct 8–29, `tools/predictors/calibration-seed.mjs`) stands in. The same calibration is never
// written twice: a write drops every build kept per store state (lib/memo.js).
import { readJson, writeJson } from '../nhl-store';
import { calibrationOf } from './calibration-pure';
import { learnWeights, boardWeightsOf, DEFAULT_WEIGHTS } from './board-weights-pure';
import SEED from './seed/calibration.json';

export const CALIBRATION_PATH = 'data/scorecard/calibration.json';

/** A graded scorecard row (gradeRow) as the fit reads it: the night, the run's λ, the study's that morning, what he got. */
export const fitRow = (r) => ({ date: r.date ?? null, lamS: r.m?.lambdaS ?? null, lamG: r.m?.lambdaG ?? null, studyS: r.study?.lamS ?? null, studyG: r.study?.lamG ?? null, sog: r.actual?.sog ?? 0, g: r.actual?.g ?? 0 });

/**
 * The board's weights now (the study's share in shots and in goals): the server env when set, else the share the stored
 * calibration learned from the graded nights (lib/nhl-data/board-weights-pure.js), else the defaults.
 */
export const boardWeights = (cal = null, env = process.env) => boardWeightsOf(cal, env);

/** The calibration the board reads: the stored one, else the seed. */
export async function loadCalibration() {
  const stored = await readJson(CALIBRATION_PATH).catch(() => null);
  return stored?.reads ? stored : SEED;
}

const sameFits = (a, b) => !!a && !!b && a.games === b.games && JSON.stringify(a.weights) === JSON.stringify(b.weights) && JSON.stringify(a.reads) === JSON.stringify(b.reads)
  && JSON.stringify(a.learned?.stats ?? null) === JSON.stringify(b.learned?.stats ?? null);

/**
 * Learn from a season's graded rows which read the board should print (the study's share per stat, walked forward with
 * the calibration on top, the board moving only when another share beats the one it is on) and the calibration at those
 * weights, and store both (the stored one comes back when it says the same). The env's share, when set, is the one fitted.
 */
export async function saveCalibration(rows, { from = null, to = null } = {}) {
  if (!rows?.length) return null;
  const fitRows = rows.map(fitRow);
  const cur = await readJson(CALIBRATION_PATH).catch(() => null);
  const learned = learnWeights(fitRows, { defaults: cur?.learned?.stats ? cur.weights : DEFAULT_WEIGHTS });
  const weights = boardWeightsOf({ weights: learned.weights, learned }, process.env);
  const next = { ...calibrationOf(fitRows, { w: weights.w, wG: weights.wG }, { from, to }), learned, weightsFrom: weights.from };
  if (sameFits(cur, next)) return cur;
  await writeJson(CALIBRATION_PATH, { ...next, source: 'graded runs' });
  return next;
}
