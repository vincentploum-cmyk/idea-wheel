// PropFinder's roster status on the NFL board (2026-11-02, after week 8: the rushing, receiving and touchdown lists carried
// players who were not on the team's active roster — 25 of the 28 listed rushers who never played, 69 of 79 receivers,
// 149 of 176 touchdown names: Zack Moss on Cincinnati off a 2024 log, Amari Cooper on Las Vegas, James Conner on IR —
// because the board read the ESPN injury feed alone and never PropFinder's own `status`; docs/audits/2026-11-02-nfl-rushing.md).
// Pure, no store import.
//
// Every pulled NFL player carries `status`: ACT (the active roster), PRA (practice squad), OFF_ROSTER, IR, IRD (IR,
// designated to return), PRA_IR, PUP, NON (non-football injury), SUS, EXE. Of the week-8 players who played, every one
// but a handful of practice-squad call-ups was ACT.

/** Not on the active roster tonight: injured reserve and its kin, the practice squad, off the roster. */
export const ROSTER_OFF = { IR: 'injured reserve', IRD: 'injured reserve (designated to return)', PRA_IR: 'practice squad, injured reserve', PUP: 'physically unable to perform', NON: 'non-football injury', SUS: 'suspended', EXE: 'exempt list', OFF_ROSTER: 'off the roster', PRA: 'practice squad' };
const OUT_WORDS = new Set(['Out', 'Doubtful', 'IR', 'LTIR', 'Suspended', 'PUP', 'NFI']);

/**
 * The pull without the players PropFinder lists off the active roster (ROSTER_OFF): they leave the board — no row, no
 * list, no ladder. A player the injury feed (or an override) already has out stays as he was, so the out lists, the
 * without splits and the vacated lifts read exactly what they read before. Leaving them off, not marking them out, is the
 * measured choice: marked out, they handed their share to the teammates through the vacated lifts (VACATED_SHARE, never
 * checked on the NFL), which on week 8 moved 116 receivers (Kelce 57 → 74 yards) and read receiving 23.5 → 23.9 a player,
 * rushing 26.6 → 25.9 — one week, both ways, nothing a replay can check (the stored pulls have no status history).
 * `data.rosterStatus` = { dropped, by: { STATUS: n } }; a status the map does not name (ACT, none) is left as it is.
 */
export function applyRosterStatus(pf) {
  const players = pf?.data?.players;
  if (!players?.length) return pf;
  const by = {}; let dropped = 0;
  const next = players.filter((p) => {
    const s = p.status ? String(p.status).toUpperCase() : null;
    if (!s || !ROSTER_OFF[s] || OUT_WORDS.has(p.injury || '')) return true;
    by[s] = (by[s] || 0) + 1; dropped++;
    return false;
  });
  if (!dropped) return pf;
  return { ...pf, data: { ...pf.data, players: next, rosterStatus: { dropped, by } } };
}
