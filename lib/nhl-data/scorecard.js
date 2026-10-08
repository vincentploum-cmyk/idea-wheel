// The scorecard: what the model said before each game against what the box score
// says happened. Every saved run carries its projections per player (λ shots / goals,
// the 3+/4+/5+ SOG, 1+/2+ goal and 1+/2+ point probabilities, the gate, the best-bet
// market); every stored game carries each skater's shots, goals and assists. A game
// is graded against the newest run saved before its puck drop, so a run saved after
// the fact never counts. Beside the model, the same player-games score the plain
// "window" predictors the question keeps coming back to — a skater's own last 5 / 10 /
// 15 stored games and season to date, and PropFinder's L5 and season per-game rates
// as the run saw them — so the model, the windows and the two sources can be compared
// on identical rows. Descriptive only: nothing here feeds the model.
import { listRuns, getRunResults, readJson, runsRevision } from '../nhl-store';
import { gamesPath } from './ingest';
import { positionsPath } from './positions';
import { loadRows } from './build';
import { modelKey } from './model-runs';
import { teamAbbrFromText } from './teams';
import { addDays, todayET } from './util';
import { bestBetLabel, poissonAtLeast } from '../../components/nhl/model-core';

/** The markets a run prices, with the box-score stat and threshold that settle them. */
export const MARKETS = [
  { key: 's3', label: '3+ SOG', prob: 'p3s', stat: 'sog', min: 3 },
  { key: 's4', label: '4+ SOG', prob: 'p4s', stat: 'sog', min: 4 },
  { key: 's5', label: '5+ SOG', prob: 'p5s', stat: 'sog', min: 5 },
  { key: 'g1', label: '1+ goal', prob: 'p1g', stat: 'g', min: 1 },
  { key: 'g2', label: '2+ goals', prob: 'p2g', stat: 'g', min: 2 },
  { key: 'p1', label: '1+ point', prob: 'p1p', stat: 'pts', min: 1 },
  { key: 'p2', label: '2+ points', prob: 'p2p', stat: 'pts', min: 2 },
];
const MARKET = Object.fromEntries(MARKETS.map((m) => [m.key, m]));
// bestBetLabel's keys → market keys.
const BEST_KEY = { shots3: 's3', shots4: 's4', shots5: 's5', goal: 'g1', goals2: 'g2', point1: 'p1', points2: 'p2' };

/** Probability buckets for the calibration table. */
export const BUCKETS = [
  { key: 'b0', label: 'under 20%', lo: 0, hi: 0.2 },
  { key: 'b20', label: '20–30%', lo: 0.2, hi: 0.3 },
  { key: 'b30', label: '30–40%', lo: 0.3, hi: 0.4 },
  { key: 'b40', label: '40–50%', lo: 0.4, hi: 0.5 },
  { key: 'b50', label: '50–60%', lo: 0.5, hi: 0.6 },
  { key: 'b60', label: '60–70%', lo: 0.6, hi: 0.7 },
  { key: 'b70', label: '70–80%', lo: 0.7, hi: 0.8 },
  { key: 'b80', label: '80% and up', lo: 0.8, hi: 1.01 },
];

/**
 * The predictors compared on shots and goals. `model` is the run's λ; `own*` are the
 * skater's stored games before the game (L5 / L10 / L15 need the full window, the
 * season needs three games); `pf*` are PropFinder's per-game rates in the run's inputs.
 */
export const PREDICTORS = [
  { key: 'model', label: 'Model λ', source: 'model' },
  { key: 'own5', label: 'Own L5', source: 'own', n: 5 },
  { key: 'own10', label: 'Own L10', source: 'own', n: 10 },
  { key: 'own15', label: 'Own L15', source: 'own', n: 15 },
  { key: 'ownSeason', label: 'Own season', source: 'own', n: null },
  { key: 'pf5', label: 'PropFinder L5', source: 'propfinder' },
  { key: 'pfSeason', label: 'PropFinder season', source: 'propfinder' },
];
const OWN_SEASON_MIN = 3;

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const pos = (v) => (num(v) > 0 ? Number(v) : null);
const round = (v, d = 3) => (v == null || !Number.isFinite(v) ? null : +v.toFixed(d));
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/** The season id (20252026) a date belongs to: seasons run July → June. */
export function seasonOf(date) {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const start = m >= 7 ? y : y - 1;
  return `${start}${start + 1}`;
}

/** What a graded row keeps of a run's result row. */
export function compactRow(r) {
  if (!r || !r.name) return null;
  const best = bestBetLabel(r);
  return {
    name: r.name,
    team: teamAbbrFromText(r.team) || String(r.team || '').toUpperCase(),
    pos: r.pos || null,
    line: num(r.todayLine),
    gate: r.gateOpen == null ? null : !!r.gateOpen,
    signal: num(r.signalScore),
    attack: num(r.attackScore),
    lambdaS: num(r.lambdaS),
    lambdaG: num(r.lambdaG),
    lambdaP: num(r.lambdaP),
    p3s: num(r.p3s), p4s: num(r.p4s), p5s: num(r.p5s),
    p1g: num(r.p1g), p2g: num(r.p2g),
    p1p: num(r.p1p), p2p: num(r.p2p),
    best: best?.key ? { market: BEST_KEY[best.key] || null, label: best.label, prob: num(best.prob) } : null,
    // PropFinder's rates as the run saw them (0 means "not in the file": a skater with
    // no shots over five games is not a rate we can score).
    pf5: { sog: pos(r.shotsL5), g: pos(r.goalsL5) },
    pfSeason: { sog: pos(r.shotsSeason), g: pos(r.goalsSeason) },
  };
}

/** A run's result rows → Map(modelKey → compact row). */
export function indexRun(rows) {
  const out = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const c = compactRow(r);
    if (c) out.set(modelKey(c.team, c.name), c);
  }
  return out;
}

/**
 * The run that stood when the puck dropped: the newest of `runs` (one slate date,
 * any order) created before `startTimeUTC`. Without a start time the game is taken
 * to start before 1 am ET the next day, so a run saved the morning after never counts.
 */
export function runForGame(runs, startTimeUTC, date) {
  const cutoff = Date.parse(startTimeUTC || '') || Date.parse(`${addDays(date, 1)}T05:00:00Z`);
  let best = null;
  for (const r of runs || []) {
    const at = Date.parse(r?.createdAt || '');
    if (!Number.isFinite(at) || at >= cutoff) continue;
    if (!best || at > Date.parse(best.createdAt)) best = r;
  }
  return best;
}

/**
 * A skater's own windows before `date`: `history` is his stored games in date order
 * ({ date, sog, g }). L5 / L10 / L15 are the last N games (across seasons: "last
 * five games" in October are last season's); the season window is this season only.
 */
export function ownWindows(history, date) {
  const before = (history || []).filter((h) => h.date < date);
  const avg = (list) => (list.length ? { sog: mean(list.map((h) => h.sog || 0)), g: mean(list.map((h) => h.g || 0)), n: list.length } : null);
  const last = (n) => (before.length >= n ? avg(before.slice(-n)) : null);
  const season = seasonOf(date);
  const thisSeason = before.filter((h) => seasonOf(h.date) === season);
  return {
    own5: last(5),
    own10: last(10),
    own15: last(15),
    ownSeason: thisSeason.length >= OWN_SEASON_MIN ? avg(thisSeason) : null,
  };
}

/** Value of a predictor on a graded row for `stat` ('sog' | 'g'), or null. */
export function predictorValue(row, key, stat) {
  if (key === 'model') return stat === 'sog' ? row.m.lambdaS : row.m.lambdaG;
  if (key === 'pf5' || key === 'pfSeason') return row.m[key]?.[stat] ?? null;
  return row.own?.[key]?.[stat] ?? null;
}

/** One graded player-game. */
export function gradeRow({ date, gameId, m, s, own }) {
  const pts = (s.g || 0) + (s.a || 0);
  return {
    date, gameId,
    name: s.name, id: s.id ?? null, team: s.team, opp: s.opp, venue: s.venue,
    pos: s.pos || m.pos || null,
    line: s.line ?? null,
    slot: s.pos && s.line ? `${s.pos}${s.line}` : null,
    actual: { sog: s.sog || 0, g: s.g || 0, a: s.a || 0, pts, toi: s.toi ?? null },
    m,
    own,
  };
}

function calls(rows, market) {
  const def = MARKET[market];
  const out = [];
  for (const r of rows) {
    const p = r.m[def.prob];
    if (p == null) continue;
    out.push({ p, hit: r.actual[def.stat] >= def.min ? 1 : 0, r });
  }
  return out;
}

function score(list) {
  if (!list.length) return { n: 0, avg: null, hit: null, brier: null, logLoss: null };
  const n = list.length;
  const clampP = (p) => Math.min(0.999, Math.max(0.001, p));
  return {
    n,
    avg: round(mean(list.map((c) => c.p))),
    hit: round(mean(list.map((c) => c.hit))),
    brier: round(mean(list.map((c) => (c.p - c.hit) ** 2)), 4),
    logLoss: round(mean(list.map((c) => -(c.hit ? Math.log(clampP(c.p)) : Math.log(1 - clampP(c.p))))), 4),
  };
}

function groupScore(list, keyOf) {
  const groups = {};
  for (const c of list) {
    const k = keyOf(c.r);
    if (!k) continue;
    (groups[k] ||= []).push(c);
  }
  return Object.fromEntries(Object.entries(groups).map(([k, l]) => [k, score(l)]));
}

/** One market over the graded rows: overall, by bucket, by gate, by position, by line slot, best-bet calls. */
export function marketReport(rows, market) {
  const list = calls(rows, market);
  return {
    ...MARKET[market],
    ...score(list),
    buckets: BUCKETS.map((b) => ({ ...b, ...score(list.filter((c) => c.p >= b.lo && c.p < b.hi)) })),
    gate: { open: score(list.filter((c) => c.r.m.gate === true)), closed: score(list.filter((c) => c.r.m.gate === false)) },
    byPos: groupScore(list, (r) => r.pos),
    bySlot: groupScore(list, (r) => r.slot),
    best: score(list.filter((c) => c.r.m.best?.market === market)),
  };
}

/**
 * The Model tab's boards, replayed per slate: the five shots plays (gate open, 4+ SOG ≥ 40%
 * or 3+ SOG ≥ 60%, by 4+/5+ odds and play score) and the five goal plays (1+ G ≥ 18%,
 * by 1+/2+ odds), graded on 3+ SOG, 4+ SOG and 1+ G.
 */
export function boardPicks(rows) {
  const byDate = {};
  for (const r of rows) (byDate[r.date] ||= []).push(r);
  const shots = [];
  const goals = [];
  for (const list of Object.values(byDate)) {
    shots.push(...list
      .filter((r) => r.m.gate && ((r.m.p4s || 0) >= 0.4 || (r.m.p3s || 0) >= 0.6))
      .sort((a, b) => ((b.m.p4s || 0) * 100 + (b.m.p5s || 0) * 60 + (b.m.attack || 0)) - ((a.m.p4s || 0) * 100 + (a.m.p5s || 0) * 60 + (a.m.attack || 0)))
      .slice(0, 5));
    goals.push(...list
      .filter((r) => (r.m.p1g || 0) >= 0.18)
      .sort((a, b) => ((b.m.p1g || 0) * 100 + (b.m.p2g || 0) * 70 + (b.m.attack || 0) * 0.35) - ((a.m.p1g || 0) * 100 + (a.m.p2g || 0) * 70 + (a.m.attack || 0) * 0.35))
      .slice(0, 5));
  }
  const on = (list, market) => score(calls(list, market));
  return {
    shots: { n: shots.length, s3: on(shots, 's3'), s4: on(shots, 's4') },
    goals: { n: goals.length, g1: on(goals, 'g1') },
  };
}

/**
 * The predictors on one stat, each on its own rows and all on the rows every predictor
 * covers (the fair comparison; a predictor with no rows yet — the season windows in
 * October — is left out of that requirement rather than emptying the table). MAE and
 * bias are in shots / goals per game; `brier` scores the Poisson odds each predictor
 * implies for 3+ SOG (shots) or 1+ goal (goals).
 */
export function predictorReport(rows, stat) {
  const min = stat === 'sog' ? 3 : 1;
  const one = (list, key) => {
    const pairs = list.map((r) => ({ v: predictorValue(r, key, stat), a: r.actual[stat] })).filter((x) => x.v != null);
    if (!pairs.length) return { key, n: 0, mae: null, bias: null, rmse: null, avg: null, actual: null, brier: null, hit: null, prob: null };
    const hits = pairs.map((x) => (x.a >= min ? 1 : 0));
    const probs = pairs.map((x) => poissonAtLeast(x.v, min));
    return {
      key,
      n: pairs.length,
      mae: round(mean(pairs.map((x) => Math.abs(x.v - x.a)))),
      bias: round(mean(pairs.map((x) => x.v - x.a))),
      rmse: round(Math.sqrt(mean(pairs.map((x) => (x.v - x.a) ** 2)))),
      avg: round(mean(pairs.map((x) => x.v))),
      actual: round(mean(pairs.map((x) => x.a))),
      brier: round(mean(probs.map((p, i) => (p - hits[i]) ** 2)), 4),
      prob: round(mean(probs)),
      hit: round(mean(hits)),
    };
  };
  const each = PREDICTORS.map((p) => ({ ...p, ...one(rows, p.key) }));
  const active = PREDICTORS.filter((p) => each.find((e) => e.key === p.key).n > 0);
  const common = rows.filter((r) => active.every((p) => predictorValue(r, p.key, stat) != null));
  return {
    stat,
    market: stat === 'sog' ? '3+ SOG' : '1+ goal',
    each,
    common: { n: common.length, covered: active.map((p) => p.key), predictors: PREDICTORS.map((p) => ({ ...p, ...one(common, p.key) })) },
  };
}

/** Per slate: what was graded and how the headline markets did. */
export function slateReport(rows, meta) {
  const byDate = {};
  for (const r of rows) (byDate[r.date] ||= []).push(r);
  return Object.keys({ ...meta, ...byDate }).sort().reverse().map((date) => {
    const list = byDate[date] || [];
    const m = meta[date] || {};
    const sog = predictorReport(list, 'sog').each.find((p) => p.key === 'model');
    return {
      date,
      games: m.games ?? new Set(list.map((r) => r.gameId)).size,
      graded: new Set(list.map((r) => r.gameId)).size,
      players: list.length,
      missing: m.missing || 0,
      runs: m.runs || [],
      s3: score(calls(list, 's3')),
      s4: score(calls(list, 's4')),
      g1: score(calls(list, 'g1')),
      p1: score(calls(list, 'p1')),
      sogMae: sog?.mae ?? null,
      sogBias: sog?.bias ?? null,
    };
  });
}

/** The whole report over graded rows (+ per-date meta from the loader). */
export function summarize(rows, meta = {}, range = {}) {
  const dates = new Set(rows.map((r) => r.date));
  return {
    from: range.from || null,
    to: range.to || null,
    builtAt: new Date().toISOString(),
    slates: dates.size,
    games: new Set(rows.map((r) => `${r.date}|${r.gameId}`)).size,
    players: rows.length,
    missing: Object.values(meta).reduce((s, m) => s + (m.missing || 0), 0),
    markets: MARKETS.map((m) => marketReport(rows, m.key)),
    picks: boardPicks(rows),
    predictors: { sog: predictorReport(rows, 'sog'), g: predictorReport(rows, 'g') },
    bySlate: slateReport(rows, meta),
  };
}

/** Compact rows for an export (`?rows=1`). */
export function exportRows(rows) {
  return rows.map((r) => ({
    date: r.date, game: r.gameId, name: r.name, team: r.team, opp: r.opp, venue: r.venue, pos: r.pos, slot: r.slot,
    sog: r.actual.sog, g: r.actual.g, a: r.actual.a, pts: r.actual.pts,
    lambdaS: r.m.lambdaS, lambdaG: r.m.lambdaG, p3s: r.m.p3s, p4s: r.m.p4s, p5s: r.m.p5s, p1g: r.m.p1g, p2g: r.m.p2g, p1p: r.m.p1p, p2p: r.m.p2p,
    gate: r.m.gate, signal: r.m.signal, attack: r.m.attack, best: r.m.best?.label || null, bestProb: r.m.best?.prob ?? null,
    own5: round(r.own?.own5?.sog, 2), own10: round(r.own?.own10?.sog, 2), own15: round(r.own?.own15?.sog, 2), ownSeason: round(r.own?.ownSeason?.sog, 2),
    own5G: round(r.own?.own5?.g, 2), own10G: round(r.own?.own10?.g, 2), own15G: round(r.own?.own15?.g, 2), ownSeasonG: round(r.own?.ownSeason?.g, 2),
    pf5: r.m.pf5.sog, pf5G: r.m.pf5.g, pfSeason: r.m.pfSeason.sog, pfSeasonG: r.m.pfSeason.g,
  }));
}

/** Default range: the season `to` belongs to, from September 1. */
export function defaultFrom(to) {
  return `${seasonOf(to).slice(0, 4)}-09-01`;
}

const MEMO_MS = 10 * 60 * 1000;
const memo = new Map(); // from|to → { at, rev, value }

/**
 * Grade every stored game in [from, to] that has a run saved before its puck drop.
 * Returns { rows, meta, from, to } — `rows` are gradeRow() records, `meta` per date
 * { games, missing, runs }. Memoised ten minutes per range, dropped when a run is
 * saved or deleted on this server.
 */
export async function gradeRange({ from, to } = {}) {
  const end = to || todayET();
  const start = from || defaultFrom(end);
  const key = `${start}|${end}`;
  const hit = memo.get(key);
  if (hit && hit.rev === runsRevision() && Date.now() - hit.at < MEMO_MS) return hit.value;

  const manifests = (await listRuns(400)).filter((r) => r?.hasResults && r.slateDate && r.slateDate >= start && r.slateDate <= end);
  const byDate = {};
  for (const r of manifests) (byDate[r.slateDate] ||= []).push(r);
  const dates = Object.keys(byDate).sort();

  // Every skater's stored games up to `end`, in date order, for the own-window baselines.
  const history = {};
  if (dates.length) {
    for (const r of await loadRows(addDays(end, 1))) (history[r.playerId] ||= []).push({ date: r.date, sog: r.sog || 0, g: r.g || 0 });
  }

  const rows = [];
  const meta = {};
  const indexes = new Map(); // run id → Map(modelKey → compact row)
  for (const date of dates) {
    const file = await readJson(gamesPath(date));
    if (!file?.games?.length) continue;
    const positions = await readJson(positionsPath(date));
    const m = { games: file.games.length, missing: 0, runs: [] };
    for (const game of file.games) {
      const run = runForGame(byDate[date], positions?.games?.[game.id]?.startTimeUTC || null, date);
      if (!run) continue;
      if (!m.runs.includes(run.id)) m.runs.push(run.id);
      let idx = indexes.get(run.id);
      if (!idx) {
        idx = indexRun(await getRunResults(run.id));
        indexes.set(run.id, idx);
      }
      const teams = [game.away?.abbrev, game.home?.abbrev];
      const box = new Map();
      for (const s of game.skaters || []) box.set(modelKey(s.team, s.name), s);
      for (const [k, c] of idx) {
        if (!teams.includes(c.team)) continue;
        const s = box.get(k);
        if (!s) { m.missing += 1; continue; }
        rows.push(gradeRow({ date, gameId: game.id, m: c, s, own: ownWindows(history[s.id], date) }));
      }
    }
    meta[date] = m;
  }
  const value = { rows, meta, from: start, to: end };
  memo.set(key, { at: Date.now(), rev: runsRevision(), value });
  return value;
}

/** The report for a range. */
export async function buildScorecard(opts = {}) {
  const { rows, meta, from, to } = await gradeRange(opts);
  const out = summarize(rows, meta, { from, to });
  if (opts.rows) out.rows = exportRows(rows);
  return out;
}
