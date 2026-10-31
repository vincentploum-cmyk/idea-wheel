// What other players at his position did against tonight's opponent (Vincent, 2026-10-31: "on the individual player
// card, I need to see what other players in the same position did"): PropFinder's opposing-players view, from the
// season's stored box scores. ESPN's box scores place a player only as G / F / C, so the positions come from the
// stored PropFinder pulls — the roster position, the depth chart's slot first (as the board's envPosFor reads him) —
// and a player no pull knows keeps ESPN's group, shown at both positions it covers (G → PG and SG, F → SF and PF).
// Server-side: normName reaches the store's roster module. The card filters the rows by position tab itself.
import { normName } from '../nhl-data/names';

import { POS_TABS, atPosition, vsPositionSummary } from './vs-position-pure';

export { POS_TABS, atPosition, vsPositionSummary };
const SLOT_POS = { G: 'SG', F: 'SF' };

/**
 * The position book from the pulls: key → { pos, from, depth }. PropFinder's depth chart slot (PG … C) places a
 * player first, as the board reads his environment; his roster position otherwise (G → SG, F → SF).
 */
export function positionBook(pulls) {
  const book = {};
  for (const pull of pulls || []) {
    for (const p of pull?.data?.players || []) {
      if (!p?.key || !p.pos || book[p.key]) continue;
      book[p.key] = { pos: SLOT_POS[p.pos] || p.pos, from: 'propfinder' };
    }
    for (const slots of Object.values(pull?.data?.depth || {})) {
      for (const [slot, list] of Object.entries(slots || {})) {
        if (!POS_TABS.includes(slot)) continue;
        for (const x of list || []) {
          if (!x?.key) continue;
          const cur = book[x.key];
          if (!cur || cur.from !== 'depth' || (x.depth || 99) < (cur.depth || 99)) book[x.key] = { pos: slot, from: 'depth', depth: x.depth ?? null };
        }
      }
    }
  }
  return book;
}

/**
 * Every player who faced `opp` in the stored results before `through` (the slate's date: tonight's game is the one the
 * card is about), his position from the book (ESPN's group when the pulls do not know him), his line that night.
 * `mine` = { key } marks the card's own player. Newest game first, the most minutes first inside a game.
 */
export function vsPositionRows(results, { opp, through = null, book = {}, mine = null }) {
  const rows = [];
  for (const r of results || []) {
    if (!r?.final || !opp || (r.away !== opp && r.home !== opp)) continue;
    if (through && !(String(r.date) < through)) continue;
    const team = r.away === opp ? r.home : r.away;
    const venue = r.home === team ? 'H' : 'A';
    const own = venue === 'H' ? r.homeScore : r.awayScore; const theirs = venue === 'H' ? r.awayScore : r.homeScore;
    const result = own == null || theirs == null ? null : own > theirs ? 'W' : own < theirs ? 'L' : null;
    for (const p of r.players || []) {
      if (p.team !== team || p.played === false || !(Number(p.min) > 0)) continue;
      const key = normName(p.name);
      const b = book[key] || null;
      rows.push({
        date: r.date, gameId: r.id, team, venue, result, score: own != null && theirs != null ? `${own}–${theirs}` : null,
        espnId: p.espnId ?? null, key, name: p.name, pos: b ? b.pos : p.pos || null, posFrom: b ? b.from : 'espn', starter: !!p.starter,
        min: p.min ?? null, pts: p.pts ?? null, reb: p.reb ?? null, ast: p.ast ?? null, tpm: p.tpm ?? null, tpa: p.tpa ?? null, fga: p.fga ?? null, fta: p.fta ?? null,
        pra: p.pra ?? null, stl: p.stl ?? null, blk: p.blk ?? null, tov: p.tov ?? null,
        mine: !!(mine && (mine.key === key || (mine.espnId != null && String(mine.espnId) === String(p.espnId)))),
      });
    }
  }
  return rows.sort((a, b) => String(b.date).localeCompare(String(a.date)) || (b.min || 0) - (a.min || 0) || a.name.localeCompare(b.name));
}
