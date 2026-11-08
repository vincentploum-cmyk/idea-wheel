// PropFinder's starters against ours (Vincent, 2026-11-08: "compare their starters against ours"). The Defensive
// Matchups route lists, per game, side and position, the starter the side's defense faces tonight (`starterSource:
// "lineup"`); ours are RotoWire's five per team (lib/nba/rotowire.js, the cocktail's `lineup`) with the slot RotoWire
// gives each, and the spot the board reads his matchup at (`envPos`, lib/picks/board.js envPosFor). Per team: whether
// the five are the same players, who is in one five only (with what that would do to his role on the board: a player
// who started under half of his last ten and is in PropFinder's five alone is a promotion the board does not make), and
// for the players in both, PropFinder's slot against RotoWire's and the board's. Pure: the store feeds it.
import { normName } from '../nhl-data/names';

const r3 = (v) => Math.round(v * 1000) / 1000;

/**
 * rows: readDefensiveMatchups(answer).rows ({ team, opp, pos, starters [{ name, team, position, lineupStatus }] });
 * lineups: the board's `lineups` ({ teams: { ABBR: { status, starters [{ pos, name }] } } }); board: the board (games[].sides).
 * → { teams: [{ team, opp, rotowireStatus, theirs [{ name, slot, position, lineupStatus }], ours [{ name, pos }], sameFive,
 *   onlyTheirs [{ name, slot, role, share }], onlyOurs [{ name, pos, role, share }], slots [{ name, theirs, rotowire, board }] }],
 *   summary { teams, compared, sameFive, inBoth, onlyTheirs, onlyOurs, slotVsRotowire { same, of }, slotVsBoard { same, of },
 *   theirPromotions, theirDemotions } }.
 */
export function startersCheck({ rows = [], lineups = null, board = null } = {}) {
  // The board's players by team and key: his spot, his role and starts share off the lineup read.
  const boardBy = {};
  for (const g of board?.games || []) for (const [team, side] of Object.entries(g.sides || {})) {
    for (const p of side?.players || []) (boardBy[team] ||= new Map()).set(p.key || normName(p.player), p);
  }
  // PropFinder's five per attacking team: the starters each defense faces, by the starter's own team (else the side's opponent).
  const theirsBy = {}; const oppOf = {};
  for (const r of rows) {
    for (const s of r.starters || []) {
      const team = s.team || r.opp;
      if (!team) continue;
      oppOf[team] = r.team;
      const list = (theirsBy[team] ||= []);
      if (!list.some((x) => normName(x.name) === normName(s.name))) list.push({ name: s.name, slot: r.pos || null, position: s.position || null, lineupStatus: s.lineupStatus ?? null });
    }
  }
  const teams = [];
  const sum = { teams: 0, compared: 0, sameFive: 0, inBoth: 0, onlyTheirs: 0, onlyOurs: 0, slotVsRotowire: { same: 0, of: 0 }, slotVsBoard: { same: 0, of: 0 }, theirPromotions: 0, theirDemotions: 0 };
  for (const team of [...new Set([...Object.keys(theirsBy), ...Object.keys(lineups?.teams || {})])].sort()) {
    const theirs = theirsBy[team] || [];
    const rw = lineups?.teams?.[team] || null;
    const ours = (rw?.starters || []).map((s) => ({ name: s.name, pos: s.pos || null }));
    sum.teams++;
    if (!theirs.length || !ours.length) { teams.push({ team, opp: oppOf[team] || null, rotowireStatus: rw?.status || null, theirs, ours, sameFive: null, onlyTheirs: [], onlyOurs: [], slots: [] }); continue; }
    sum.compared++;
    const bp = boardBy[team] || new Map();
    const roleOf = (name) => { const p = bp.get(normName(name)); return { role: p?.lineup?.role ?? null, share: p?.lineup?.share ?? null }; };
    const ourKeys = new Map(ours.map((o) => [normName(o.name), o]));
    const theirKeys = new Map(theirs.map((t) => [normName(t.name), t]));
    const onlyTheirs = theirs.filter((t) => !ourKeys.has(normName(t.name))).map((t) => ({ name: t.name, slot: t.slot, ...roleOf(t.name) }));
    const onlyOurs = ours.filter((o) => !theirKeys.has(normName(o.name))).map((o) => ({ name: o.name, pos: o.pos, ...roleOf(o.name) }));
    const slots = theirs.filter((t) => ourKeys.has(normName(t.name))).map((t) => ({ name: t.name, theirs: t.slot, rotowire: ourKeys.get(normName(t.name)).pos, board: bp.get(normName(t.name))?.envPos ?? null }));
    const sameFive = !onlyTheirs.length && !onlyOurs.length;
    if (sameFive) sum.sameFive++;
    sum.inBoth += slots.length; sum.onlyTheirs += onlyTheirs.length; sum.onlyOurs += onlyOurs.length;
    for (const s of slots) {
      if (s.theirs && s.rotowire) { sum.slotVsRotowire.of++; if (s.theirs === s.rotowire) sum.slotVsRotowire.same++; }
      if (s.theirs && s.board) { sum.slotVsBoard.of++; if (s.theirs === s.board) sum.slotVsBoard.same++; }
    }
    // A player PropFinder starts who started under half of his recent games: the board would promote him on their five.
    sum.theirPromotions += onlyTheirs.filter((x) => x.share != null && x.share < 0.5).length;
    // A regular starter RotoWire has and PropFinder does not: their five would demote him.
    sum.theirDemotions += onlyOurs.filter((x) => x.share != null && x.share >= 0.5).length;
    teams.push({ team, opp: oppOf[team] || null, rotowireStatus: rw?.status || null, theirs, ours, sameFive, onlyTheirs, onlyOurs, slots });
  }
  sum.slotVsRotowire.share = sum.slotVsRotowire.of ? r3(sum.slotVsRotowire.same / sum.slotVsRotowire.of) : null;
  sum.slotVsBoard.share = sum.slotVsBoard.of ? r3(sum.slotVsBoard.same / sum.slotVsBoard.of) : null;
  return { teams, summary: sum };
}
