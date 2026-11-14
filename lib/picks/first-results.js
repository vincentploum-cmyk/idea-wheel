// The first-scorer picks' track record, shared by the three sports (Vincent, 2026-11-14: "the season track record for
// all three": the NBA's first basket, the NHL's first goal, the NFL's first touchdown). Each tab already says who
// scored first once the game is stored; this is what our own list was worth over the season: how often the top pick
// scored it, how often the scorer was in our top three or five, whether the stated chances landed, and the games one
// by one. A night's list must be the one a reader had that morning (built from the games before it): each sport's
// store rebuilds it so and keeps the graded night (`{ version, date, games: [entry] }`), and this module only grades
// and adds up. Pure.

export const FIRST_RESULTS_VERSION = 1;
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * One game graded. `candidates`: [{ name, team, p, hit }] (any order; `hit` true on the one who scored first, when he
 * is on the list), `scorer`: { name, team } or null when nobody did (a game without a touchdown). →
 * { id, date, game, n, scorer, rank (his place on our list, 1 = the top; null when he was not on it), said (the chance
 *   we gave him), top: the first three of our list [{ name, team, p, hit }], cands: [[p, 0 | 1] …] for the calibration }
 * or null without a list or a result to grade.
 */
export function gradeFirst({ id, date, game, candidates, scorer }) {
  const list = [...(candidates || [])].filter((c) => c && Number.isFinite(Number(c.p))).sort((a, b) => b.p - a.p);
  if (!list.length || !scorer?.name) return null;
  const at = list.findIndex((c) => c.hit === true);
  return {
    id, date, game, n: list.length,
    scorer: { name: scorer.name, team: scorer.team || null },
    rank: at < 0 ? null : at + 1, said: at < 0 ? null : r3(list[at].p),
    top: list.slice(0, 3).map((c) => ({ name: c.name, team: c.team || null, p: r3(c.p), hit: c.hit === true })),
    cands: list.map((c) => [r3(c.p), c.hit === true ? 1 : 0]),
  };
}

export const FIRST_BANDS = [[0, 0.03], [0.03, 0.06], [0.06, 0.09], [0.09, 0.12], [0.12, 0.16], [0.16, 0.2], [0.2, 1.01]];

/**
 * The record over graded games (entries of gradeFirst, any order): { games, listed (the scorer was on our list),
 * top1 / top3 / top5: { n, hits, rate, said (what the list said such a pick was worth), random (a pick drawn from the
 * list at random) }, ranks: { 1, 2, 3, '4-5', '6+', off }, meanRank, perGame (candidates a game), bands: [{ lo, hi, n,
 * said, landed }] over every candidate, first / last (dates) }.
 */
export function summarizeFirst(entries) {
  const es = (entries || []).filter(Boolean);
  const games = es.length;
  const topK = (k) => {
    const hits = es.filter((e) => e.rank != null && e.rank <= k).length;
    return {
      n: games, hits, rate: games ? r3(hits / games) : null,
      said: games ? r3(mean(es.map((e) => e.cands.slice(0, k).reduce((a, c) => a + (c[0] || 0), 0)))) : null,
      random: games ? r3(mean(es.map((e) => Math.min(k, e.n) / e.n))) : null,
    };
  };
  const ranks = { 1: 0, 2: 0, 3: 0, '4-5': 0, '6+': 0, off: 0 };
  for (const e of es) ranks[e.rank == null ? 'off' : e.rank <= 3 ? e.rank : e.rank <= 5 ? '4-5' : '6+'] += 1;
  const all = es.flatMap((e) => e.cands);
  const bands = FIRST_BANDS.map(([lo, hi]) => {
    const rows = all.filter((c) => c[0] >= lo && c[0] < hi);
    return { lo, hi: Math.min(hi, 1), n: rows.length, said: rows.length ? r3(mean(rows.map((c) => c[0]))) : null, landed: rows.length ? r3(mean(rows.map((c) => c[1]))) : null };
  }).filter((b) => b.n);
  const dates = es.map((e) => e.date).filter(Boolean).sort();
  const ranked = es.filter((e) => e.rank != null);
  return {
    games, listed: ranked.length, top1: topK(1), top3: topK(3), top5: topK(5), ranks,
    meanRank: ranked.length ? Math.round(mean(ranked.map((e) => e.rank)) * 10) / 10 : null,
    perGame: games ? Math.round(mean(es.map((e) => e.n)) * 10) / 10 : null,
    bands, first: dates[0] || null, last: dates[dates.length - 1] || null,
  };
}

/** A stored night is good to read when it is this version's and carries its games. */
export const firstNightUsable = (file) => !!file && file.version === FIRST_RESULTS_VERSION && Array.isArray(file.games);

/**
 * The payload a tab reads: the stored nights ([{ date, games }], any order) added up, the games newest first.
 * `missing` = the nights still to grade (the next loads fill them), `what` = 'first basket' | 'first goal' | 'first touchdown'.
 */
export function firstResultsPayload({ what, season = null, nights, missing = 0, errors = [] }) {
  const entries = (nights || []).flatMap((n) => n.games || []);
  const log = [...entries].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : String(a.game).localeCompare(String(b.game)))).map(({ cands, ...e }) => e);
  return { what, season, nights: (nights || []).filter((n) => (n.games || []).length).length, missing, errors: errors.slice(0, 5), summary: summarizeFirst(entries), log };
}
