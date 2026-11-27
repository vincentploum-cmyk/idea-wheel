// The board's calibration, stored (lib/nhl-data/calibration-pure.js has the fit): learned from the season's graded runs
// whenever the season's scorecard is built — the History tab's first grade, the morning refresh in the background —
// and read with the slate by Best bets and the shuffle. Until the site has stored one, the seed fitted on the scorecard
// export of 2026-10-30 (Oct 8–29, `tools/predictors/calibration-seed.mjs`) stands in. The same calibration is never
// written twice: a write drops every build kept per store state (lib/memo.js).
import { readJson, writeJson } from '../nhl-store';
import { calibrationOf } from './calibration-pure';
import { learnWeights, boardWeightsOf, DEFAULT_WEIGHTS } from './board-weights-pure';
import SEED from './seed/calibration.json';
import { opponentShotMult, shotSpreadLambda } from '../../components/nhl/model-core';

export const CALIBRATION_PATH = 'data/scorecard/calibration.json';

// λ shots changed twice on 2026-11-27 (components/nhl/model-core.js): a tough opponent's cut softened (opponentShotMult) and
// the published λ pulled toward the middle (shotSpreadLambda). The calibration is learned from the season's stored runs and
// applied to tonight's λ, so a run saved before either change is read as the model makes it now — else the fit, learned on
// the wider λ, would pull the new λ in a second time. The cut is replayed from the row's defMult and shot tier on slates
// before 2026-11-27 (its raw ratio recovered from the cut as it was); the spread on every run without lambdaSRaw (the rows
// the model writes since). The scorecard still grades every run as it was computed.
const SHOT_DAMP = { elite: 1.0, good: 0.82, average: 0.64, weak: 0.48 };
export const CUT_CHANGED = '2026-11-27';
export function lambdaSNow(m, date) {
  let lam = m?.lambdaS;
  if (lam == null || !(lam > 0)) return lam ?? null;
  if (m.lambdaSRaw != null) return lam;
  const d = m.defMult; const damp = SHOT_DAMP[m.shotLevel];
  if (date && date < CUT_CHANGED && d > 0 && d < 1 && damp) {
    const raw = Math.max(0.55, 1 - (1 - d) / Math.max(0.9, 1.12 - 0.18 * damp));
    lam *= Math.max(0.58, opponentShotMult(raw, damp)) / d;
  }
  return Math.round(shotSpreadLambda(lam) * 1000) / 1000;
}

/** A graded scorecard row (gradeRow) as the fit reads it: the night, the run's λ, the study's that morning, what he got. */
export const fitRow = (r) => ({ date: r.date ?? null, lamS: lambdaSNow(r.m, r.date), lamG: r.m?.lambdaG ?? null, studyS: r.study?.lamS ?? null, studyG: r.study?.lamG ?? null, sog: r.actual?.sog ?? 0, g: r.actual?.g ?? 0 });

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
