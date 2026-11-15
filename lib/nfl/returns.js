// A teammate back (Vincent, 2026-11-15, on the Jets' backs — the second back projected over the first after the first's six
// games out: "We should have it incorporated in the projection"; docs/audits/2026-11-15-nfl-model.md). A player's recent
// games read high when a teammate at his position missed them and plays tonight: his figure is pulled toward what he did in
// the games they shared. Down only, at half strength, held to ×0.6: at full strength, or up as well, the rule cost yards on
// the replay; this one was never worse on 2025 or 2026 and took the 15%+ cuts' miss down on both. Pure.
import { activeRow, rowsBefore } from './model';

/** strength: the part of the with-him read's distance taken; floor: the least factor; the samples the rule asks for. */
export const BACK = { strength: 0.5, floor: 0.6, recent: 6, shared: 8, k: 2, minRecent: 3, minMissed: 2, minShared: 2, minVolume: 3, volumeShare: 0.5, volumeHalfLife: 12, awayDays: 60, minMove: 0.05 };
/** market → the log's field, the mate's volume field, the positions the rule reads. */
export const BACK_MARKETS = {
  rush_yds: { stat: 'rushYds', volume: 'rushAtt', pos: ['RB'] },
  rec_yds: { stat: 'recYds', volume: 'tgt', pos: ['WR', 'TE', 'RB'] },
  receptions: { stat: 'rec', volume: 'tgt', pos: ['WR', 'TE', 'RB'] },
};
const n0 = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
// A game is its date and opponent: two players with the same pair were on the same side.
const gameKey = (g) => `${String(g.date).slice(0, 10)}|${g.opp}`;
const dayOf = (d) => Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`) / 86400000;
/** His carries / targets a game at the rule's memory (his last forty active games, the newest counted most). */
function volumeOf(act, field, halfLife) {
  const tail = act.slice(-40); let w = 0; let v = 0;
  for (let i = 0; i < tail.length; i++) { const wi = 0.5 ** ((tail.length - 1 - i) / halfLife); w += wi; v += wi * n0(tail[i][field]); }
  return w > 0 ? v / w : 0;
}

/**
 * The factor on a player's figure for a teammate back, or null.
 *   logs    his PropFinder game rows
 *   mates   the side's other players at his position who play tonight: [{ name, games, doubt, depth }] (`doubt`: listed day to
 *           day; `depth`: his number on the depth chart)
 *   market  rush_yds / rec_yds / receptions; pos his position; depth his own number on the chart; season the slate's; date the game's
 * His recent games = his last six active ones this season (three at least). A mate counts when he carries a real load (three
 * carries / targets a game at a twelve-game memory, and half the player's own), missed two or more of those games and shared at
 * least two of the player's games of this season or the last. The with-him read = the player's average in their last eight
 * shared games, counted with two games of his recent average; its ratio to the recent average, the lowest over the mates, at
 * half strength, never above 1, and nothing under a 5% move. A mate who has not played since his absence counts only when the
 * depth chart has him at or ahead of the player's slot, he is not listed day to day and has been gone 60 days at most.
 */
export function backFactor({ logs, mates, market, pos, season, date = null, depth = null, B = BACK }) {
  const spec = BACK_MARKETS[market];
  if (!B || !spec || !spec.pos.includes(pos) || !mates?.length) return null;
  const act = rowsBefore(logs, date).filter(activeRow).filter((g) => g.season == null || g.season >= season - 1);
  const recent = act.filter((g) => g.season === season).slice(-B.recent);
  if (recent.length < B.minRecent) return null;
  const usual = mean(recent.map((g) => n0(g[spec.stat])));
  if (!(usual > 0)) return null;
  const lastKey = gameKey(recent[recent.length - 1]);
  const mine = volumeOf(rowsBefore(logs, date).filter(activeRow), spec.volume, B.volumeHalfLife);
  let best = null;
  for (const m of mates) {
    const his = rowsBefore(m.games, date).filter(activeRow);
    if (!his.length) continue;
    // A real load: three a game, and half the player's own (a depth man on the roster again moves nobody).
    const load = volumeOf(his, spec.volume, B.volumeHalfLife);
    if (load < B.minVolume || load < B.volumeShare * mine) continue;
    const inGame = new Set(his.map(gameKey));
    const missed = recent.filter((g) => !inGame.has(gameKey(g))).length;
    if (missed < B.minMissed) continue;
    // Back for sure: in the player's latest game already. Else (his first game back) only a man the depth chart has at or
    // ahead of the player's own slot, not listed day to day, gone `awayDays` at most: the roster carries men who are active
    // on paper and do not play.
    if (!inGame.has(lastKey) && (m.doubt || !(m.depth > 0 && depth > 0 && m.depth <= depth) || (date && dayOf(date) - dayOf(his[his.length - 1].date) > B.awayDays))) continue;
    const shared = act.filter((g) => inGame.has(gameKey(g))).slice(-B.shared);
    if (shared.length < B.minShared) continue;
    const withHim = mean(shared.map((g) => n0(g[spec.stat])));
    const read = (shared.length * withHim + B.k * usual) / (shared.length + B.k);
    const ratio = read / usual;
    if (!best || ratio < best.ratio) best = { ratio, mate: m.name || null, shared: shared.length, missed, of: recent.length, withHim, usual };
  }
  if (!best || best.ratio >= 1) return null;
  const factor = Math.round(Math.max(B.floor, 1 + B.strength * (best.ratio - 1)) * 1000) / 1000;
  // A move under `minMove` is noise on the page.
  if (factor > 1 - B.minMove) return null;
  const r1 = (x) => Math.round(x * 10) / 10;
  return { factor, mate: best.mate, shared: best.shared, missed: best.missed, of: best.of, withHim: r1(best.withHim), usual: r1(best.usual) };
}

/** The factor in words, for the hovers: `b` is a row's `back` ({ factor, mate, …, before }). */
export function backText(b, kind = 'yds') {
  if (!b) return '';
  const fmt = (v) => (kind === 'receptions' ? Number(v).toFixed(1) : String(Math.round(v)));
  return `${fmt(b.before)} before ${b.mate || 'a teammate'} back (out for ${b.missed} of his last ${b.of}; ${fmt(b.withHim)} a game in their ${b.shared} together against ${fmt(b.usual)} lately) ×${b.factor.toFixed(2)}`;
}
