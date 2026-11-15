// The NFL's learned read (Vincent, 2026-11-15: "build us the best nfl prediction model for tds, rushing yards, receiving
// yards and passing yards"; docs/audits/2026-11-15-nfl-model.md): gradient-boosted trees per market on what a player's own
// PropFinder logs say before a game, the game's line and the board's own read, blended into the board's projection
// (lib/nfl/projections.js, `PARAMS.MODEL`). Pure: the features here are the ones the trees were trained on — the replay
// (tools/audit/nfl-pf-audit.mjs --features) writes them with this very function and tools/audit/nfl_model_fit.py fits on that
// file, so the site and the training cannot drift apart. The tree walker is the NBA's (lib/nba/model.js).
import { predictTrees } from '../nba/model.js';

export { predictTrees };
export const MODEL_MARKETS = ['rec_yds', 'rush_yds', 'receptions', 'td'];
// What a log row carries (lib/nfl/propfinder-nfl.js FIELDS); the sparse ones (shares, red zone, air yards) read 0 when absent.
const K = ['passAtt', 'passCmp', 'passYds', 'passTd', 'rushAtt', 'rushYds', 'rushTd', 'tgt', 'rec', 'recYds', 'recTd', 'td', 'tgtShare', 'rushShare', 'rzTgt', 'rzAtt', 'passRzAtt', 'airYds', 'yac', 'passAirYds', 'sacked'];
const HLS = [2, 5, 12, 30];
const WIN = ['recYds', 'rushYds', 'passYds', 'tgt', 'rec', 'rushAtt', 'passAtt', 'td'];
const HISTORY = 40;
const RECENT_DAYS = 24;

const n0 = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
const POS_N = { QB: 0, RB: 1, WR: 2, TE: 3 };
const tdOf = (g) => (g.td != null ? n0(g.td) : n0(g.rushTd) + n0(g.recTd) + n0(g.retTd));
const val = (g, k) => (k === 'td' ? tdOf(g) : n0(g[k]));
/** A row he did something in (a rostered week without a snap is a row of zeros). */
export const activeRow = (g) => n0(g.passAtt) + n0(g.rushAtt) + n0(g.tgt) + n0(g.rec) > 0 || n0(g.recYds) !== 0 || n0(g.rushYds) !== 0 || n0(g.passYds) !== 0 || tdOf(g) > 0;
const dayOf = (d) => Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`) / 86400000;

/** His games before `before` (a date; none = all), oldest first: regular season and playoffs. */
export function rowsBefore(games, before = null) {
  const day = before ? String(before).slice(0, 10) : null;
  return (games || []).filter((x) => x?.date && (!day || String(x.date).slice(0, 10) < day) && (!x.type || x.type === 'REG' || x.type === 'PST'))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/**
 * The features for one player's game.
 *   games    his logs (PropFinder's rows: date, season, type, the box-score fields, tgtShare, rushShare, rzTgt, rzAtt, airYds, yac …)
 *   season   the slate's season (the logs' start year)
 *   pos      QB / RB / WR / TE
 *   date     the game's date (rows on or after it are left out)
 *   ctx      { home: bool | null, points: his team's implied points, total, spread: his team's (− = favoured), depth: his slot's number,
 *              board: { rec_yds, rush_yds, pass_yds, receptions: the board's projections, td: its chance, m_rec, m_rush, m_pass: its
 *              matchup factors } (`b_*`: in the training file for the study, read by no tree), team: teamFigures()'s answer for his side }
 * Returns { name: number | null } (null = unknown: the trees take their default branch), or null without three active games.
 */
export function modelFeatures({ games, season, pos, date = null, ctx = {} }) {
  const rows = rowsBefore(games, date);
  const act = rows.filter(activeRow).slice(-HISTORY);
  if (act.length < 3) return null;
  const n = act.length;
  const S = act.filter((x) => x.season === season);
  const f = { posN: POS_N[pos] ?? null, nAll: n, nSeason: S.length };
  for (const hl of HLS) {
    let ws = 0; const sums = Object.fromEntries(K.map((k) => [k, 0]));
    for (let i = 0; i < n; i++) { const w = 0.5 ** ((n - 1 - i) / hl); ws += w; for (const k of K) sums[k] += w * val(act[i], k); }
    for (const k of K) f[`e${hl}_${k}`] = sums[k] / ws;
    // What he makes of a look, at this memory: yards a target, a carry, an attempt; his catch rate.
    f[`e${hl}_ypt`] = sums.tgt > 0 ? sums.recYds / sums.tgt : null;
    f[`e${hl}_ypc`] = sums.rushAtt > 0 ? sums.rushYds / sums.rushAtt : null;
    f[`e${hl}_ypa`] = sums.passAtt > 0 ? sums.passYds / sums.passAtt : null;
    f[`e${hl}_catch`] = sums.tgt > 0 ? sums.rec / sums.tgt : null;
    // His team's volume those games, read off his own shares (targets ÷ his target share).
    let tw = 0; let tt = 0; let cw = 0; let ct = 0;
    for (let i = 0; i < n; i++) {
      const w = 0.5 ** ((n - 1 - i) / hl); const x = act[i];
      if (n0(x.tgtShare) > 0 && n0(x.tgt) > 0) { tw += w; tt += w * (n0(x.tgt) / n0(x.tgtShare)); }
      if (n0(x.rushShare) > 0 && n0(x.rushAtt) > 0) { cw += w; ct += w * (n0(x.rushAtt) / n0(x.rushShare)); }
    }
    f[`e${hl}_teamTgt`] = tw > 0 ? tt / tw : null;
    f[`e${hl}_teamRush`] = cw > 0 ? ct / cw : null;
  }
  for (const k of WIN) {
    const c = act.map((x) => val(x, k));
    const c10 = c.slice(-10); const m10 = mean(c10);
    f[`l3_${k}`] = mean(c.slice(-3)); f[`max10_${k}`] = Math.max(...c10); f[`min5_${k}`] = Math.min(...c.slice(-5));
    f[`sd10_${k}`] = Math.sqrt(mean(c10.map((v) => (v - m10) ** 2)));
    f[`s_${k}`] = S.length ? mean(S.map((x) => val(x, k))) : null;
    f[`last_${k}`] = c[n - 1];
  }
  // How often he has been in the game lately (a rostered week of zeros is a row), and how long since his last one.
  const tail = rows.slice(-10);
  f.act5 = mean(rows.slice(-5).map((x) => (activeRow(x) ? 1 : 0)));
  f.act10 = mean(tail.map((x) => (activeRow(x) ? 1 : 0)));
  f.lastActive = activeRow(rows[rows.length - 1]) ? 1 : 0;
  f.daysSince = date ? Math.min(400, dayOf(date) - dayOf(act[n - 1].date)) : null;
  // Tonight.
  f.home = ctx.home == null ? null : ctx.home ? 1 : 0;
  f.points = ctx.points ?? null; f.total = ctx.total ?? null; f.spread = ctx.spread ?? null;
  f.depth = ctx.depth ?? null;
  const b = ctx.board || {};
  for (const k of ['rec_yds', 'rush_yds', 'pass_yds', 'receptions', 'td', 'm_rec', 'm_rush', 'm_pass']) f[`b_${k}`] = b[k] ?? null;
  const t = ctx.team || {};
  for (const k of ['tgt', 'rushAtt', 'recYds', 'rushYds', 'qbPassYds', 'qbPassAtt', 'qbN']) f[`t_${k}`] = t[k] ?? null;
  // His part of what his side's players have been getting (their five-game memories summed).
  f.sh_tgt = t.tgt > 0 ? f.e5_tgt / t.tgt : null;
  f.sh_rush = t.rushAtt > 0 ? f.e5_rushAtt / t.rushAtt : null;
  f.sh_recYds = t.recYds > 0 ? f.e5_recYds / t.recYds : null;
  return f;
}

/**
 * His side's figures tonight, from the logs of the players on it (the out ones left off by the caller): what they have been
 * getting between them (each one's five-game memory of his active games, summed; a man without a game in 24 days left off), and the starting quarterback's passing.
 *   players  [{ pos, games, backup }] (`backup` true = a quarterback not starting)
 */
export function teamFigures(players, date = null) {
  const out = { tgt: 0, rushAtt: 0, recYds: 0, rushYds: 0, qbPassYds: null, qbPassAtt: null, qbN: null };
  let qb = null;
  for (const p of players || []) {
    const act = rowsBefore(p.games, date).filter(activeRow).slice(-HISTORY);
    if (act.length < 1) continue;
    // On the side now: a game inside the last 24 days (a bye is 14), so a man gone for weeks does not pad the sums.
    if (date && dayOf(date) - dayOf(act[act.length - 1].date) > RECENT_DAYS) continue;
    const e = {}; let ws = 0;
    for (const k of ['tgt', 'rushAtt', 'recYds', 'rushYds', 'passYds', 'passAtt']) e[k] = 0;
    for (let i = 0; i < act.length; i++) { const w = 0.5 ** ((act.length - 1 - i) / 5); ws += w; for (const k of Object.keys(e)) e[k] += w * n0(act[i][k]); }
    for (const k of Object.keys(e)) e[k] /= ws;
    for (const k of ['tgt', 'rushAtt', 'recYds', 'rushYds']) out[k] += e[k];
    if (p.pos === 'QB' && !p.backup) {
      const starts = act.filter((x) => n0(x.passAtt) >= 10);
      const last = starts.length ? String(starts[starts.length - 1].date) : '';
      if (!qb || last > qb.last) qb = { last, yds: e.passYds, att: e.passAtt, n: starts.length };
    }
  }
  if (qb) { out.qbPassYds = qb.yds; out.qbPassAtt = qb.att; out.qbN = Math.min(40, qb.n); }
  return out;
}

/**
 * Every market the model carries for his position: { rec_yds, rush_yds, receptions: the figure, td: a chance } (a market the
 * trees were not fitted for at his position is absent). Yards: the trees' sum is the log of the mean, put on the board's
 * scale by the file's line (`cal`); touchdowns: the log-odds.
 */
export function modelRead(model, feats, pos = null) {
  if (!model?.stats || !feats) return null;
  const out = {};
  for (const [stat, m] of Object.entries(model.stats)) {
    if (pos && m.pos && !m.pos.includes(pos)) continue;
    const p = predictTrees(m, feats);
    if (p == null || !Number.isFinite(p)) continue;
    out[stat] = m.link === 'logit' ? p / (1 + p) : m.cal ? Math.max(0, m.cal[0] + m.cal[1] * p) : p;
  }
  return Object.keys(out).length ? out : null;
}

const logit = (p) => { const q = Math.min(0.999, Math.max(0.001, p)); return Math.log(q / (1 - q)); };
/**
 * The blend of the board's figure and the model's, the model at the file's weight for the market (a chance is blended on
 * its log-odds), or null when the file carries no weight for it.
 */
export function modelBlend(model, stat, boardFigure, pred) {
  const w = model?.blend?.[stat] ?? 0;
  if (!(w > 0) || boardFigure == null || pred == null || !Number.isFinite(pred)) return null;
  if (model.stats?.[stat]?.link === 'logit') return 1 / (1 + Math.exp(-((1 - w) * logit(boardFigure) + w * logit(pred))));
  return (1 - w) * boardFigure + w * pred;
}

/**
 * The blend in words, for the hovers: `m` is a row's `model` ({ pred, before }), `kind` 'td' for a chance, 'receptions' for one
 * decimal, yards otherwise.
 */
export function modelText(m, kind = 'yds') {
  if (!m || m.pred == null || m.before == null) return '';
  const fmt = (v) => (kind === 'td' ? `${Math.round(v * 100)}%` : kind === 'receptions' ? Number(v).toFixed(1) : String(Math.round(v)));
  return `the board's ${fmt(m.before)} blended with the learned read's ${fmt(m.pred)}`;
}
