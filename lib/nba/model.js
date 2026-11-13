// The NBA's learned read (Vincent, 2026-11-13: "put in some REAL effort to improve our accuracy";
// docs/audits/2026-11-13-nba-model.md): gradient-boosted trees per stat on what a player's own logs and his teammates'
// say before a game, blended into the board's projection (lib/picks/board.js, the cocktail's `model`). Pure: the features
// here are the ones the trees were trained on — the replay (tools/audit/nba-audit.mjs --features) writes them with this
// very function and tools/audit/nba_model_fit.py fits on that file, so the site and the training cannot drift apart.
//
// What is in it (each group measured, docs/audits/2026-11-13-nba-model.md): his production a minute at four memories, his
// minutes, his last three / ten / season and their spread; tonight's role (in the five or not, his minutes in that role);
// and the teammates — who he usually plays beside against who plays tonight, weighted by what they produce, the absences
// (`out_*`) and the returns (`back_*`) apart. The opponent, pace, the book's spread and total, rest and home added nothing
// on top and are left to the board's own matchup.

export const MODEL_STATS = ['pts', 'reb', 'ast', 'tpm'];
const K = ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'tov', 'fga', 'fgm', 'tpa', 'fta', 'ftm'];
const HLS = [3, 8, 20, 50];
const WIN = ['pts', 'reb', 'ast', 'tpm', 'fga', 'tpa', 'min'];
const MATE = ['pts', 'reb', 'ast', 'fga', 'tpa', 'min'];
// A team's night, to put a teammate's production on one scale (league figures, fixed: a ratio, not a read).
const NORM = { pts: 113, reb: 44, ast: 26, fga: 89, tpa: 37, min: 240 };
const HISTORY = 60; const MEMORY = 20; const MATE_MIN = 12;

const REG = (x) => x.type === 'REG' || !x.type;
const n0 = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const gameKey = (x) => String(x.gameId ?? String(x.date).slice(0, 10));
/** His regular-season games played, oldest first, this season and the one before. */
export function playedRows(games, season) {
  return (games || []).filter((x) => REG(x) && n0(x.min) > 0 && x.date && (season == null || x.season == null || x.season >= season - 1))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const posN = (pos) => { const p = String(pos || '').toUpperCase(); return p === 'PG' || p === 'SG' || p === 'G' ? 0 : p === 'C' ? 2 : 1; };

/**
 * The features for one player tonight.
 *   games    his logs (PropFinder's rows: date, gameId, season, type, min, pts, reb, ast, tpm, stl, blk, tov, fga, fgm, tpa, fta,
 *            ftm, starter)
 *   season   the slate's season (the logs' start year)
 *   pos      his position
 *   starter  true / false when tonight's five is known, null to read his usual role
 *   mates    his team's other players: [{ key, playing, games }] (`playing` false = out tonight)
 * Returns { name: number | null } (null = unknown: the trees take their default branch), or null without five games.
 */
export function modelFeatures({ games, season, pos = null, starter = null, mates = [] }) {
  const all = playedRows(games, season).slice(-HISTORY);
  if (all.length < 5) return null;
  const S = all.filter((x) => x.season === season);
  const f = { nSeason: S.length, nAll: all.length, posN: posN(pos) };
  const n = all.length;
  for (const hl of HLS) {
    let wm = 0; let ws = 0; const sums = Object.fromEntries(K.map((k) => [k, 0]));
    for (let i = 0; i < n; i++) {
      const w = 0.5 ** ((n - 1 - i) / hl); const x = all[i];
      wm += w * n0(x.min); ws += w;
      for (const k of K) sums[k] += w * n0(x[k]);
    }
    for (const k of K) f[`pm${hl}_${k}`] = sums[k] / Math.max(wm, 1e-6);
    f[`min${hl}`] = wm / ws;
  }
  for (const k of WIN) {
    const c = all.map((x) => n0(x[k]));
    f[`l3_${k}`] = mean(c.slice(-3)); f[`l10_${k}`] = mean(c.slice(-10)); f[`max10_${k}`] = Math.max(...c.slice(-10));
    const c20 = c.slice(-20); const m20 = mean(c20);
    f[`sd20_${k}`] = n >= 3 ? Math.sqrt(mean(c20.map((v) => (v - m20) ** 2))) : 0;
    f[`s_${k}`] = S.length ? mean(S.map((x) => n0(x[k]))) : null;
  }
  f.last_min = n0(all[n - 1].min);
  // Tonight's role against his role this season (PropFinder's `starter` flag: 1 a start, absent a game off the bench).
  const S10 = S.slice(-10);
  f.startShare = S10.length ? mean(S10.map((x) => (x.starter ? 1 : 0))) : null;
  f.startLast = S.length ? (S[S.length - 1].starter ? 1 : 0) : null;
  const role = starter == null ? (f.startShare == null ? null : f.startShare >= 0.5 ? 1 : 0) : starter ? 1 : 0;
  f.starter = role;
  const inRole = role == null ? [] : S.filter((x) => (x.starter ? 1 : 0) === role).slice(-10);
  f.minRole = inRole.length ? mean(inRole.map((x) => n0(x.min))) : null;
  f.nRole = role == null ? null : Math.min(20, S.filter((x) => (x.starter ? 1 : 0) === role).length);
  // The teammates: his memory is his last twenty games this season; a teammate's share of it is how much of that memory he
  // played in. Out tonight after sharing it = production left on the floor (`out_*`); playing tonight after missing it =
  // production coming back (`back_*`).
  const M = S.slice(-MEMORY);
  for (const k of MATE) { f[`out_${k}`] = null; f[`back_${k}`] = null; }
  f.outTop = null; f.backTop = null;
  if (M.length >= 3) {
    const w = M.map((_, i) => 0.5 ** ((M.length - 1 - i) / 15)); const ws = w.reduce((a, b) => a + b, 0);
    const keys = M.map(gameKey);
    const out = Object.fromEntries(MATE.map((k) => [k, 0])); const back = Object.fromEntries(MATE.map((k) => [k, 0]));
    let outTop = 0; let backTop = 0;
    for (const mate of mates) {
      const Sj = playedRows(mate.games, season).filter((x) => x.season === season);
      if (Sj.length < 2) continue;
      const L = Sj.slice(-MEMORY); const prod = {}; let pw = 0;
      for (const k of MATE) prod[k] = 0;
      for (let i = 0; i < L.length; i++) { const wi = 0.5 ** ((L.length - 1 - i) / 10); pw += wi; for (const k of MATE) prod[k] += wi * n0(L[i][k]); }
      for (const k of MATE) prod[k] /= pw;
      if (prod.min < MATE_MIN) continue;
      const ids = new Set(Sj.map(gameKey));
      let share = 0;
      for (let i = 0; i < keys.length; i++) if (ids.has(keys[i])) share += w[i];
      share /= ws;
      const d = (mate.playing ? 1 : 0) - share;
      if (d < 0) { for (const k of MATE) out[k] += -d * prod[k]; outTop = Math.max(outTop, -d * prod.pts); }
      else if (d > 0) { for (const k of MATE) back[k] += d * prod[k]; backTop = Math.max(backTop, d * prod.pts); }
    }
    for (const k of MATE) { f[`out_${k}`] = out[k] / NORM[k]; f[`back_${k}`] = back[k] / NORM[k]; }
    f.outTop = outTop; f.backTop = backTop;
  }
  return f;
}

/**
 * One stat's trees on a feature object. The model (tools/audit/nba_model_fit.py's export):
 *   { features: [names], trees: [{ f: [feature index per split], t: [thresholds], l: [left], r: [right], d: [1 = unknown goes left],
 *     v: [leaf values] }] } — a child ≥ 0 is a split's index, a child < 0 is leaf −(child + 1); the sum of the leaves is the log of
 *     the projection (LightGBM, Poisson).
 */
export function predictTrees(model, feats) {
  if (!model?.trees?.length || !feats) return null;
  const x = model.features.map((name) => { const v = feats[name]; return v == null || Number.isNaN(v) ? null : Number(v); });
  let s = 0;
  for (const t of model.trees) {
    if (!t.f.length) { s += t.v[0]; continue; }
    let node = 0;
    while (node >= 0) { const v = x[t.f[node]]; node = v == null ? (t.d[node] ? t.l[node] : t.r[node]) : v <= t.t[node] ? t.l[node] : t.r[node]; }
    s += t.v[-node - 1];
  }
  return Math.exp(s);
}

/** Every stat the model carries, for one player: { pts, reb, ast, tpm } (a stat without trees is absent). */
export function modelRead(model, feats) {
  if (!model?.stats || !feats) return null;
  const out = {};
  for (const [stat, m] of Object.entries(model.stats)) { const p = predictTrees(m, feats); if (p != null && Number.isFinite(p)) out[stat] = p; }
  return Object.keys(out).length ? out : null;
}

/**
 * The blend: the board's projection and the model's, the model at `w` (the model's file carries it per stat), the move
 * held to ± `clip` of the board's figure. Returns the factor on the board's projection, or null.
 */
export function modelFactor(model, stat, boardProj, pred, { clip = [0.6, 1.6] } = {}) {
  const w = model?.blend?.[stat] ?? model?.blend?.default ?? 0;
  if (!(w > 0) || !(boardProj > 0) || !(pred > 0)) return null;
  const f = ((1 - w) * boardProj + w * pred) / boardProj;
  return Math.round(Math.max(clip[0], Math.min(clip[1], f)) * 1000) / 1000;
}
