import { describe, expect, test } from '@jest/globals';
import { statusOf, isOut, healthOf, parseInjuryReport, gamesPlayed, keyAbsences, withoutGames, blendWithout, withoutWeight, absentByTeam, withoutOf, shortNames, WITHOUT_K, playedShare, vacatedLifts, VACATED_SHARE } from '../lib/picks/injuries';
import { ownRate } from '../lib/picks/projection';

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
  test('the production an out player leaves goes to his active teammates by their own rates, for the share of their games he played', () => {
    const g = (i, extra = {}) => ({ gameId: `g${i}`, season: 2026, type: 'REG', ...extra });
    // The star took part in 6 of the guard's 8 games this season; the guard's two newest were without him.
    const guard = { key: 'guard', games: [g(0), g(1), g(2), g(3), g(4), g(5), g(6), g(7)], own: { ast: { l10: 6, season: 6 }, pts: { l10: 20, season: 20 } } };
    const wing = { key: 'wing', games: [g(0), g(1), g(2), g(3), g(4), g(5), g(6), g(7)], own: { ast: { l10: 2, season: 2 }, pts: { l10: 20, season: 20 } } };
    const star = { key: 'star', name: 'The Star', played: new Set(['g2', 'g3', 'g4', 'g5', 'g6', 'g7']), own: { ast: { l10: 8, season: 8 }, pts: { l10: 25, season: 25 } } };
    expect(playedShare(guard.games, star.played, { season: 2026 })).toBe(0.75);
    expect(playedShare(guard.games, new Set(), { season: 2026 })).toBe(0);
    // Last season's games are not the window once he has a game this season; without one, his last ten are.
    expect(playedShare([g(0), g(1, { season: 2025 })], star.played, { season: 2026 })).toBe(0);
    expect(playedShare([g(2, { season: 2025 }), g(9, { season: 2025 })], star.played, { season: 2026 })).toBe(0.5);
    expect(VACATED_SHARE).toBe(0.6);
    const lifts = vacatedLifts([guard, wing], [star], ownRate, { season: 2026 });
    // 8 assists × 0.75 of the guard's games × 0.6 = 3.6, shared 6 : 2 → 2.7 to the guard, 0.9 to the wing; the points 25 × 0.75 × 0.6 = 11.25 halved.
    expect(lifts.guard.ast).toEqual({ lift: 2.7, from: ['The Star'] });
    expect(lifts.wing.ast).toEqual({ lift: 0.9, from: ['The Star'] });
    expect(lifts.guard.pts.lift).toBeCloseTo(5.63, 2);
    // Two out at once add up; a player out all season (none of their games) hands over nothing; the out player gets no lift himself.
    const other = { key: 'other', name: 'Other', played: new Set(['g0', 'g1']), own: { ast: { season: 4 } } };
    expect(vacatedLifts([guard, wing], [star, other], ownRate, { season: 2026 }).guard.ast).toEqual({ lift: 3.15, from: ['The Star', 'Other'] });
    expect(vacatedLifts([guard], [{ ...star, played: new Set(['x']) }], ownRate, { season: 2026 })).toEqual({});
    expect(vacatedLifts([guard, { ...star, games: guard.games }], [star], ownRate, { season: 2026 }).star).toBeUndefined();
    // No rate of his own for the stat: nothing to share, nothing received.
    expect(vacatedLifts([{ ...wing, own: {} }], [star], ownRate, { season: 2026 })).toEqual({});
    // The lift rides on the windows into the rate every projection reads.
    expect(ownRate({ l10: 6, season: 6, lift: 2.7 })).toBe(8.7);
    expect(ownRate({ season: 6 })).toBe(6);
  });
});
