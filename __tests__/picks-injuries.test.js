import { describe, expect, test } from '@jest/globals';
import { statusOf, isOut, healthOf, parseInjuryReport, gamesPlayed, keyAbsences, withoutGames, blendWithout, withoutWeight, absentByTeam, withoutOf, shortNames, WITHOUT_K } from '../lib/picks/injuries';

describe('PropFinder injury report', () => {
  test('statuses read into one spelling, as the site maps them', () => {
    expect(statusOf('out')).toBe('Out');
    expect(statusOf('Out')).toBe('Out');
    expect(statusOf('O')).toBe('Out');
    expect(statusOf('day-to-day')).toBe('DTD');
    expect(statusOf('Day To Day')).toBe('DTD');
    expect(statusOf('injured reserve')).toBe('IR');
    expect(statusOf('ir')).toBe('IR');
    expect(statusOf(12)).toBe('IR');
    expect(statusOf('Long-Term Injured Reserve')).toBe('LTIR');
    expect(statusOf('questionable')).toBe('Questionable');
    expect(statusOf('GTD')).toBe('GTD');
    expect(statusOf('non-football injury')).toBe('NFI');
    expect(statusOf('out', 'Knee - probable')).toBe('Probable');   // the detail's word wins (PropFinder's own rule)
    expect(statusOf('sidelined')).toBe('Sidelined');
    expect(statusOf('')).toBeNull();
    expect(statusOf(null)).toBeNull();
    for (const s of ['Out', 'doubtful', 'IR', 'LTIR', 'Suspended', 'PUP']) expect(isOut(s)).toBe(true);
    for (const s of ['Questionable', 'GTD', 'DTD', 'Probable', 'Active', null]) expect(isOut(s)).toBe(false);
  });
  test('health in one word: In / DTD / Out', () => {
    for (const s of [null, '', 'Active', 'ACT', 'Available', 'healthy']) expect(healthOf(s)).toBe('In');
    for (const s of ['Day-To-Day', 'day to day', 'DTD', 'Questionable', 'Q', 'Probable', 'GTD', 'game-time decision']) expect(healthOf(s)).toBe('DTD');
    for (const s of ['Out', 'out', 'O', 'Doubtful', 'IR', 'injured reserve', 'LTIR', 'Suspended', 'PUP', 'NFI']) expect(healthOf(s)).toBe('Out');
    expect(healthOf('Out', 'probable to return')).toBe('DTD');   // a detail naming probable / questionable sets the status, PropFinder's own rule
    expect(healthOf('Something new')).toBe('DTD');   // an unknown status is listed, not out
  });
  test('the games payload’s report (a JSON string) and the per-team list', () => {
    const teamOf = (id) => ({ 1: 'BOS', 2: 'NY' }[id] || null);
    const report = JSON.stringify({ data: [
      { team: { id: 1 }, player: { id: 'p1', name: 'Jayson Tatum', position: 'SF' }, status: 'out', type: 'Achilles' },
      { team: { id: 2 }, player: { id: 'p9', name: 'Josh Hart', position: 'SG' }, status: 'questionable', type: 'back' },
      { team: { id: 3 }, player: { id: 'p5', name: 'Nobody Known' }, status: 'day-to-day' },
      null, 'junk', { team: { id: 1 }, player: { id: 'p0' }, status: 'out' },
    ] });
    expect(parseInjuryReport(report, { teamOf })).toEqual([
      { id: 'p1', name: 'Jayson Tatum', key: 'jayson tatum', team: 'BOS', pos: 'SF', status: 'Out', detail: 'Achilles', date: null },
      { id: 'p9', name: 'Josh Hart', key: 'josh hart', team: 'NY', pos: 'SG', status: 'Questionable', detail: 'back', date: null },
      { id: 'p5', name: 'Nobody Known', key: 'nobody known', team: null, pos: null, status: 'DTD', detail: null, date: null },
    ]);
    expect(parseInjuryReport(JSON.parse(report), { teamOf })).toHaveLength(3);   // the parsed object reads the same
    expect(parseInjuryReport('not json')).toEqual([]);
    expect(parseInjuryReport(null)).toEqual([]);
    expect(parseInjuryReport({ data: 'nope' })).toEqual([]);
    // The per-team route's shape: a flat player with status, description, position, date.
    const perTeam = [{ id: 44, name: 'Jaylen Brown', status: 'Out', description: 'hamstring; questionable for Friday', position: 'SG', date: '2026-10-27' }];
    expect(parseInjuryReport(perTeam, { team: 'BOS' })).toEqual([{ id: '44', name: 'Jaylen Brown', key: 'jaylen brown', team: 'BOS', pos: 'SG', status: 'Questionable', detail: 'hamstring; questionable for Friday', date: '2026-10-27' }]);
  });
});

describe('without-teammate splits', () => {
  const row = (gameId, pts, min = 30) => ({ gameId: String(gameId), date: `2026-10-${String(gameId).padStart(2, '0')}`, season: 2026, type: 'REG', pts, min });
  // Brown's ten games, newest first; Tatum took part in the first six (g1–g6) and sat g7–g10.
  const brown = { id: 'b', name: 'Jaylen Brown', key: 'jaylen brown', team: 'BOS', games: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((g) => row(g, g >= 7 ? 30 : 22)) };
  const tatum = { id: 't', name: 'Jayson Tatum', key: 'jayson tatum', team: 'BOS', games: [...[6, 5, 4, 3, 2, 1].map((g) => row(g, 28)), row(7, 0, 0)] };
  test('a teammate’s games played are his rows with minutes', () => {
    expect([...gamesPlayed(tatum)].sort()).toEqual(['1', '2', '3', '4', '5', '6']);   // a 0-minute row is not a game played
    expect(gamesPlayed({ games: [{ pts: 3 }] }).size).toBe(0);
    expect(gamesPlayed({ games: [{ gameId: 'x', pts: 3 }] }).size).toBe(1);   // a sport without minutes: any row
  });
  test('key absences are regulars; the split is the games without them', () => {
    const absent = [{ ...tatum, status: 'Out' }, { id: 'x', name: 'Deep Reserve', key: 'deep reserve', status: 'Out', games: [row(1, 2)] }];
    const key = keyAbsences(brown.games, absent);
    expect(key.map((a) => [a.name, a.together, a.of])).toEqual([['Jayson Tatum', 6, 10]]);
    expect(withoutGames(brown.games, key).map((g) => g.gameId)).toEqual(['10', '9', '8', '7']);
    expect(withoutGames(brown.games, [])).toEqual([]);
    expect(keyAbsences(brown.games, absent, { minShare: 0.7 })).toEqual([]);
    expect(keyAbsences([{ pts: 1 }], absent)).toEqual([]);   // rows without a gameId say nothing
  });
  test('the blend moves the season read toward the split by its games', () => {
    expect(blendWithout(0.5, 0.9, 8)).toBe(0.7);   // 8 / (8 + 8): half way
    expect(blendWithout(0.5, 0.9, 0)).toBe(0.5);
    expect(blendWithout(null, 0.9, 4)).toBe(0.9);
    expect(blendWithout(0.5, null, 4)).toBe(0.5);
    expect(withoutWeight(8)).toBe(0.5);
    expect(withoutWeight(0)).toBe(0);
    expect(WITHOUT_K).toBe(8);
  });
  test('per team the players out tonight, and a player’s split against them', () => {
    const pf = { data: {
      players: [brown, tatum, { id: 'h', name: 'Jrue Holiday', key: 'jrue holiday', team: 'BOS', injury: 'Doubtful', games: [row(10, 10), row(9, 10)] }],
      injuries: { rows: [
        { id: 't', name: 'Jayson Tatum', key: 'jayson tatum', team: 'BOS', status: 'Out', detail: 'Achilles' },
        { id: 'q', name: 'Josh Hart', key: 'josh hart', team: 'NY', status: 'Questionable', detail: null },
        { id: 'z', name: 'Not Pulled', key: 'not pulled', team: 'NY', status: 'Out', detail: null },
      ] },
    } };
    const absent = absentByTeam(pf);
    expect(absent.BOS.map((a) => [a.name, a.status, a.played.size])).toEqual([['Jayson Tatum', 'Out', 6], ['Jrue Holiday', 'Doubtful', 2]]);   // the pull's own flag counts too
    expect(absent.NY.map((a) => [a.name, a.played.size])).toEqual([['Not Pulled', 0]]);   // no logs in the pull: counts for nobody's split
    const wo = withoutOf(brown, absent.BOS);
    expect(wo.absent.map((a) => a.name)).toEqual(['Jayson Tatum']);   // Holiday took part in two of ten: not a key absence
    expect(wo.absent[0].played).toBeUndefined();
    expect(wo.n).toBe(4);
    expect(wo.games.map((g) => g.pts)).toEqual([30, 30, 30, 30]);
    expect(withoutOf(tatum, absent.BOS)).toBeNull();   // his own absence is not his split
    expect(withoutOf(brown, absent.NY)).toBeNull();
    expect(withoutOf(brown, [])).toBeNull();
    expect(withoutOf({ ...brown, games: brown.games.slice(0, 4) }, absent.BOS)).toBeNull();   // every logged game already without him
    expect(withoutOf({ ...brown, games: [...brown.games.slice(0, 1), ...brown.games.slice(4)] }, absent.BOS)).toBeNull();   // one game without him: under WITHOUT_MIN
    expect(shortNames([{ name: 'Jayson Tatum' }, { name: 'Jaylen Brown' }])).toEqual(['Tatum', 'Brown']);
    expect(shortNames([{ name: 'Jayson Tatum' }, { name: 'Jaxon Tatum' }])).toEqual(['J. Tatum', 'J. Tatum']);
  });
});
