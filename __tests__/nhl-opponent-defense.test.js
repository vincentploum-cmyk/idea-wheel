import { describe, expect, test } from '@jest/globals';
import { defenseTablesFor, opponentDefense, moneypuckBlock } from '../lib/nhl-data/slate';
import { rowObj } from '../lib/nhl-data/ingest';

// Twelve NJD home games against NYR (ten) and BOS (two), one skater a position a side, so NJD's
// home table clears MIN_DEF_GAMES and the away table stays empty.
const row = (date, gameId, pid, team, opp, venue, pos, g, sog, line, fg) => rowObj([date, gameId, pid, `P${pid}`, team, opp, venue, pos, 15, g, 0, sog, 0, 0, sog, sog, sog, 1, 0, 'W', 'lineup', pos, line, fg]);
const rows = [];
for (let i = 1; i <= 12; i++) {
  const d = `2026-10-${String(i + 1).padStart(2, '0')}`;
  const vs = i <= 10 ? 'NYR' : 'BOS';
  rows.push(
    row(d, i, 1, 'NJD', vs, 'H', 'LW', 0, 3, 1, 0), row(d, i, 2, 'NJD', vs, 'H', 'C', 1, 2, 1, i % 2 ? 1 : 0), row(d, i, 3, 'NJD', vs, 'H', 'RW', 0, 2, 1, 0), row(d, i, 4, 'NJD', vs, 'H', 'D', 0, 2, 1, 0),
    row(d, i, 11, vs, 'NJD', 'A', 'LW', 0, 4, 1, 0), row(d, i, 12, vs, 'NJD', 'A', 'C', 1, 5, 1, i % 2 ? 0 : 1), row(d, i, 13, vs, 'NJD', 'A', 'RW', 0, 3, 1, 0), row(d, i, 14, vs, 'NJD', 'A', 'D', 0, 2, 1, 0),
  );
}

describe('a side’s defense object (opponentDefense)', () => {
  test('the season table at the venue by position, the first goals, the last ten and the windows', () => {
    const tables = defenseTablesFor(rows, null);
    const d = opponentDefense('NJD', 'H', tables, 'NYR');
    expect(Object.keys(d).sort()).toEqual(['All', 'C', 'D', 'LW', 'RW']);
    // What NJD allows at home: 14 shots a game in all, 5 of them to centres, 1 goal a game.
    expect(d.All).toMatchObject({ source: 'games', season: { gp: 12, sog: 14, g: 1 }, rank: { sog: 1, g: 1 } });
    expect(d.C).toMatchObject({ source: 'games', season: { gp: 12, sog: 5 }, rank: { sog: 1 } });
    expect(d.All.windows).toBeNull();
    expect(d.LW.windows).toMatchObject({ home: { season: { gp: 12, sog: 4 }, source: 'games' }, away: null, h2hhome: { source: 'h2h', h2h: { gp: 10, vs: 'NYR' } }, h2haway: null });
    expect(d.LW.windows.l5.season.gp).toBe(5);
    // The first goal: NJD conceded it in six of the twelve home games, all to centres.
    expect(d.All.firstGoal).toMatchObject({ games: 12, allowed: 6, share: 0.5, bySlot: { C1: 6 } });
    expect(d.C.firstGoal).toMatchObject({ allowed: 6, share: 0.5 });
    expect(d.LW.firstGoal).toMatchObject({ allowed: 0 });
    expect(d.All.l10).toMatchObject({ gp: 10, sog: 14 });
    expect(d.All.l10Rank).toMatchObject({ sog: 1 });
    // No opponent (the team page): the head-to-head windows stay empty, everything else reads the same.
    const alone = opponentDefense('NJD', 'H', tables);
    expect(alone.LW.windows.h2hhome).toBeNull();
    expect(alone.All).toEqual(d.All);
  });
  test('the season tables count the slate’s season alone; the last-N windows roll across the boundary', () => {
    // The same games a season earlier on top: without a season every row counts, with one only its rows do.
    const older = rows.map((r) => ({ ...r, gameId: r.gameId + 1000, date: r.date.replace('2026-', '2025-') }));
    const all = defenseTablesFor([...older, ...rows], null);
    const one = defenseTablesFor([...older, ...rows], null, { season: 2026 });
    expect(all.season.teams.NJD.H.C.gp).toBe(2 * defenseTablesFor(rows, null).season.teams.NJD.H.C.gp);
    expect(one.season.teams.NJD.H.C.gp).toBe(defenseTablesFor(rows, null).season.teams.NJD.H.C.gp);
    expect(one.firstGoals.teams.NJD?.H?.games || 0).toBe(defenseTablesFor(rows, null).firstGoals.teams.NJD?.H?.games || 0);
    expect(one.recent.teams.NJD.ALL.C.gp).toBe(all.recent.teams.NJD.ALL.C.gp);
  });
  test('a venue with no stored games reads empty, and a thin one falls back to PropFinder’s table', () => {
    const tables = defenseTablesFor(rows, null);
    const away = opponentDefense('NJD', 'A', tables);
    expect(away.All).toMatchObject({ season: null, rank: null, source: 'games' });
    expect(away.LW.season).toBeNull();
    // Nine home games is under the floor: PropFinder's last-season table stands in by position, never for All.
    const pf = { opponentsByPos: { LW: { season: 2025, teams: { NJD: { gp: 82, sog: 8.1, g: 0.9, sc: 7 }, BOS: { gp: 82, sog: 6.1, g: 0.7, sc: 5 } }, ranks: { NJD: { sog: 1, g: 1, sc: 1 }, BOS: { sog: 2, g: 2, sc: 2 } } } } };
    const thin = defenseTablesFor(rows.filter((r) => r.gameId <= 9), pf);
    const d = opponentDefense('NJD', 'H', thin);
    expect(d.All).toMatchObject({ source: 'games', season: { gp: 9 } });
    expect(d.LW).toMatchObject({ source: 'propfinder', seasonLabel: '2025-26', storedGames: 9, season: { gp: 82, sog: 8.1 }, rank: { sog: 1 }, teamCount: 2 });
    expect(d.C).toMatchObject({ source: 'games', thin: true, season: { gp: 9 } });
  });
  test('moneypuckBlock: the season table with its ranks, the venue splits when stored, null without a table', () => {
    const mp = { teams: { updatedAt: 'x', year: 2026, situations: { all: { NJD: { sf60: 30 } } }, ranks: { all: { NJD: { sf60: 1 } } } }, games: { byVenue: { all: { H: {} } }, ranks: { all: { H: {} } } } };
    expect(moneypuckBlock(mp)).toEqual({ updatedAt: 'x', year: 2026, teams: 1, situations: mp.teams.situations, ranks: mp.teams.ranks, byVenue: mp.games.byVenue, venueRanks: mp.games.ranks });
    expect(moneypuckBlock({ teams: null, games: null })).toBeNull();
    expect(moneypuckBlock(null)).toBeNull();
  });
});
