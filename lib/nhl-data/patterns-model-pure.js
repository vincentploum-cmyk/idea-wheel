// The Patterns tab's 3+ SOG model (Vincent, 2026-11-12: "add the model for 3+ SOG", after the season backtest had a
// model on every figure ahead of the rules on that line): a logistic regression and gradient-boosted trees on the
// same figures the rules read (patterns-pure.js, plus his position), averaged. Fitted offline by
// tools/predictors/patterns_model.py on every skater-game through `builtThrough` and shipped as patterns-model.json;
// this file only scores it, so the site needs no training. Pure: shared by the site, the tests and the parity check.

const sigmoid = (z) => 1 / (1 + Math.exp(-z));

/** His figures in the model's order: a missing or non-finite figure is null (the regression fills it, the trees route it). */
export function modelInputs(f, model) {
  return model.feats.map((k) => {
    if (k.startsWith('pos_')) return f.pos === k.slice(4) ? 1 : 0;
    const v = f[k];
    if (v == null || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  });
}

/** The regression's chance: median-filled, standardised, clipped at ±6 spreads, as fitted. */
export function lrChance(x, lr) {
  let z = lr.intercept;
  for (let i = 0; i < x.length; i++) {
    const v = x[i] == null ? lr.med[i] : x[i];
    const s = Math.max(-6, Math.min(6, (v - lr.mu[i]) / lr.sd[i]));
    z += lr.coef[i] * s;
  }
  return sigmoid(z);
}

/** The trees' chance: each tree a node list, [feature, threshold, missing goes left, left, right] or [leaf value]. */
export function gbChance(x, gb) {
  let raw = gb.baseline;
  for (const tree of gb.trees) {
    let n = 0;
    while (tree[n].length > 1) {
      const [fi, thr, missLeft, left, right] = tree[n];
      const v = x[fi];
      n = v == null ? (missLeft ? left : right) : v <= thr ? left : right;
    }
    raw += tree[n][0];
  }
  return sigmoid(raw);
}

/** His chance at the model's line (3+ SOG): the two halves averaged. Null without a model or a game behind him. */
export function modelChance(f, model) {
  if (!model?.feats || !f?.gp) return null;
  const x = modelInputs(f, model);
  return (lrChance(x, model.lr) + gbChance(x, model.gb)) / 2;
}

/**
 * The model on the games after its fit (`model.builtThrough`), each row scored as it stood: its calls at or over
 * `bar` (the line's), how many landed and what it said, and the same at 60%. `table` rows carry `m` (the chance,
 * scored by patternTable's `score`) and `o` (what he got).
 */
export function modelRecord(table, model, bar) {
  const after = model?.builtThrough || '';
  const y = `y_${model?.mark || 's3'}`;
  const rows = (table || []).filter((r) => r.date > after && r.m != null);
  const tally = (lo) => {
    const calls = rows.filter((r) => r.m >= lo);
    return { picks: calls.length, landed: calls.reduce((s, r) => s + (r.o[y] || 0), 0), said: calls.length ? Math.round((calls.reduce((s, r) => s + r.m, 0) / calls.length) * 1000) / 1000 : null };
  };
  return { after, from: rows[0]?.date || null, to: rows[rows.length - 1]?.date || null, games: rows.length, calls: tally(bar), strong: tally(0.6) };
}
