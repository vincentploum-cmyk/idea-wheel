import { describe, expect, test } from '@jest/globals';
import { levelOf, ratioRanks, shotProfiles, teamCharacteristics, LEVEL_TEXT } from '../lib/nhl-data/characteristics';
import { rowObj } from '../lib/nhl-data/ingest';

// CBJ @ PHI as the Matchups tab read it on 2026-10-27: PHI tight at home at every position but
// loosening over its last ten, a low-volume offense that has finished hot behind poor goaltending;
// CBJ average on the road, leaking to centres and defensemen, conceding the first goal often, slow.
const pos = (rank, sog = 7) => ({ season: { gp: 20, sog, g: 0.8 }, rank: { sog: rank, g: rank }, teamCount: 32 });
const fg = (games, allowed, rank) => ({ games, allowed, share: +(allowed / games).toFixed(2), rank, teamCount: 32, league: 0.5, bySlot: {} });
const phiDef = { All: { season: { gp: 53, sog: 25.9, g: 2.79 }, rank: { sog: 27, g: 24 }, teamCount: 32, l10: { gp: 10, sog: 28.7 }, l10Rank: { sog: 9 }, source: 'games', firstGoal: fg(13, 5, 20) }, LW: pos(24), C: pos(25), RW: pos(22), D: pos(25) };
const cbjDef = { All: { season: { gp: 40, sog: 28.8, g: 3.12 }, rank: { sog: 14, g: 18 }, teamCount: 32, l10: { gp: 10, sog: 26.7 }, l10Rank: { sog: 20 }, source: 'games', firstGoal: fg(12, 7, 4) }, LW: pos(27), C: pos(11, 8.2), RW: pos(15), D: pos(11, 9.1) };
const filler = Object.fromEntries(['NYR', 'NJD', 'BOS', 'PIT', 'TOR', 'MTL', 'OTT', 'BUF', 'DET', 'FLA'].map((t) => [t, { gp: 12, sf60: 28, xgf60: 3.16, xga60: 3.0, gf60: 3.0, ga60: 3.0, hdsf60: 10, hdsa60: 10, cfPct: 50, pace60: 108 }]));
const mp = {
  teams: 32,
  situations: { all: { ...filler, PHI: { gp: 12, sf60: 21.4, xgf60: 1.67, xga60: 4.23, gf60: 2.0, ga60: 4.5, hdsf60: 7.1, hdsa60: 11.2, cfPct: 49.1, pace60: 119.1 }, CBJ: { gp: 12, sf60: 23.0, xgf60: 2.75, xga60: 2.91, gf60: 2.5, ga60: 2.6, hdsf60: 9.8, hdsa60: 10.4, cfPct: 50.3, pace60: 95.0 } } },
  ranks: { all: { PHI: { sf60: 22, xgf60: 24, xga60: 25, hdsf60: 30, hdsa60: 20, cfPct: 18, pace60: 5 }, CBJ: { sf60: 19, xgf60: 16, xga60: 15, hdsf60: 14, hdsa60: 13, cfPct: 12, pace60: 24 } } },
};
const keys = (list) => list.map((x) => x.key);

describe('characteristics', () => {
  test('levelOf: the top quarter strong, the top three very, the bottom quarter weak, the bottom three very', () => {
    expect(levelOf(1)).toBe('very'); expect(levelOf(3)).toBe('very'); expect(levelOf(4)).toBe('strong'); expect(levelOf(8)).toBe('strong');
    expect(levelOf(9)).toBeNull(); expect(levelOf(24)).toBeNull();
    expect(levelOf(25)).toBe('weak'); expect(levelOf(29)).toBe('weak'); expect(levelOf(30)).toBe('veryWeak'); expect(levelOf(32)).toBe('veryWeak');
    expect(levelOf(null)).toBeNull();
    expect(LEVEL_TEXT.veryWeak).toBe('Very weak');
  });
  test('ratioRanks: finishing (GF over xGF) and goaltending (GA under xGA) over the teams with ten games', () => {
    const r = ratioRanks(mp);
    expect(r.n).toBe(12);
    expect(r.finishing.PHI).toEqual({ ratio: 1.2, rank: 1 });
    expect(r.finishing.CBJ).toEqual({ ratio: 0.91, rank: 12 });
    expect(r.goaltending.CBJ).toEqual({ ratio: 0.89, rank: 1 });
    expect(r.goaltending.PHI).toEqual({ ratio: 1.06, rank: 12 });
    const thin = { situations: { all: { ...mp.situations.all, PHI: { ...mp.situations.all.PHI, gp: 5 } } } };
    expect(ratioRanks(thin).finishing.PHI).toBeUndefined();
    expect(ratioRanks(null)).toEqual({ n: 0, finishing: {}, goaltending: {} });
  });
  test('PHI at home: strengths and weaknesses most extreme first, with the numbers on each trait', () => {
    const c = teamCharacteristics({ team: 'PHI', venue: 'H', defense: phiDef, mp, ratios: ratioRanks(mp), teamCount: 32 });
    // The quarter rule: goals allowed at #24 (9th best) and the wings at #24 / #22 no longer carry a badge.
    expect(keys(c.strengths)).toEqual(['finishing', 'shotsAgainst', 'holds']);
    expect(c.strengths.map((x) => [x.text, x.level])).toEqual([
      ['Finishing', 'very'], ['Limiting shots at home', 'strong'], ['Holds centres and defensemen at home', 'strong'],
    ]);
    expect(keys(c.weaknesses)).toEqual(['goaltending', 'danger', 'chancesAgainst', 'trend']);
    expect(c.weaknesses.map((x) => [x.text, x.level])).toEqual([
      ['Goaltending', 'veryWeak'], ['High-danger chances', 'veryWeak'], ['Limiting chances', 'weak'], ['Defense loosening over the last ten', 'weak'],
    ]);
    expect(c.strengths[0].detail).toBe('2.00 goals for per 60 on 1.67 expected (×1.20), #1 of 12 · MoneyPuck');
    expect(c.strengths[1].detail).toBe('25.9 shots allowed a game, #27 of 32 most · 53 stored games at home');
    expect(c.weaknesses[3].detail).toBe('28.7 shots allowed a game over its last 10, #9 of 32 most, against #27 on the season at home');
    // Style without a profile: the pace alone.
    expect(c.style).toEqual([{ key: 'pace', kind: 'tempo', text: 'Plays at a fast pace', detail: '119.1 shot attempts both ways per 60, #5 of 32 fastest · MoneyPuck' }]);
  });
  test('CBJ on the road: the positions it leaks to and holds, the first goal it concedes, a slow game', () => {
    const c = teamCharacteristics({ team: 'CBJ', venue: 'A', defense: cbjDef, mp, ratios: ratioRanks(mp), teamCount: 32 });
    expect(c.strengths.map((x) => [x.key, x.text, x.level])).toEqual([
      ['goaltending', 'Goaltending', 'very'], ['holds', 'Holds left wings on the road', 'strong'], ['trend', 'Defense tightening over the last ten', 'strong'],
    ]);
    // Centres and defensemen at #11 sit in the middle half now; the first goal at #4 reads weak, not very.
    expect(c.weaknesses.map((x) => [x.key, x.text, x.level])).toEqual([
      ['finishing', 'Finishing', 'veryWeak'], ['firstGoal', 'Concedes the first goal on the road', 'weak'],
    ]);
    expect(c.weaknesses[1].detail).toBe('conceded the first goal in 7 of 12 games on the road (58%, league 50%), #4 of 32 most');
    // A pace of #24 is the middle half too: no style line for it.
    expect(c.style).toEqual([]);
    const leaky = { ...cbjDef, C: pos(6, 8.2), D: pos(2, 9.1) };
    expect(teamCharacteristics({ team: 'CBJ', venue: 'A', defense: leaky }).weaknesses.find((x) => x.key === 'leaks')).toMatchObject({ text: 'Leaks shots to defensemen and centres on the road', level: 'veryWeak', detail: 'D 9.1 shots a game, #2 of 32 most · C 8.2 shots a game, #6 of 32 most' });
    // A rare-first-goal record reads as a strength with its own words; thin records say nothing.
    const stingy = { ...cbjDef, All: { ...cbjDef.All, firstGoal: fg(12, 2, 30) } };
    expect(teamCharacteristics({ team: 'CBJ', venue: 'A', defense: stingy }).strengths.find((x) => x.key === 'firstGoal')).toMatchObject({ text: 'Rarely concedes the first goal on the road', level: 'very' });
    const thin = { ...cbjDef, All: { ...cbjDef.All, firstGoal: fg(3, 3, 1) } };
    expect(teamCharacteristics({ team: 'CBJ', venue: 'A', defense: thin }).weaknesses.find((x) => x.key === 'firstGoal')).toBeUndefined();
  });
  test('style of play from the shooting profile; nothing at all gives no card', () => {
    const profile = { games: 20, season: 2026, share: { LW: 0.2, C: 0.2, RW: 0.2, D: 0.4 }, line1: 0.6, danger: 0.3, first: { games: 20, scored: 14, share: 0.7 } };
    const league = { share: { LW: 0.25, C: 0.25, RW: 0.25, D: 0.25 }, line1: 0.4, danger: 0.33 };
    const c = teamCharacteristics({ team: 'PHI', venue: 'H', mp, profile, league });
    expect(c.style.map((x) => [x.key, x.text])).toEqual([['pace', 'Plays at a fast pace'], ['point', 'Shots from the point'], ['topline', 'Top line carries the scoring'], ['scoresFirst', 'Scores first more often than not']]);
    expect(c.style[1].detail).toBe('40% of its shots from the defensemen, league 25% · 20 stored games, 2026-27');
    const other = teamCharacteristics({ team: 'CBJ', venue: 'A', profile: { ...profile, share: { LW: 0.35, C: 0.15, RW: 0.35, D: 0.15 }, line1: 0.3, danger: 0.25, first: { games: 20, scored: 6, share: 0.3 } }, league });
    expect(other.style.map((x) => x.key)).toEqual(['wings', 'depth', 'perimeter', 'chases']);
    expect(teamCharacteristics({ team: 'X', venue: 'H' })).toBeNull();
    expect(teamCharacteristics({ team: null })).toBeNull();
  });
  test('shotProfiles: shares by position, the first line’s goals, chances a shot and scoring first, from the team’s own rows', () => {
    // Ten games A vs B this season: A shoots from the point and scores from its first line, B from the wings and its second line.
    const row = (date, gameId, pid, team, opp, venue, pos, g, sog, iscf, line, fg) => rowObj([date, gameId, pid, `P${pid}`, team, opp, venue, pos, 15, g, 0, sog, 0, 0, sog, sog, sog, iscf, 0, 'W', 'lineup', pos, line, fg]);
    const rows = [];
    for (let i = 1; i <= 10; i++) {
      const d = `2026-10-${String(10 + i).padStart(2, '0')}`;
      const aFirst = i <= 7; // A scored first in seven of the ten
      rows.push(
        row(d, i, 1, 'A', 'B', 'H', 'LW', 0, 3, 1, 1, 0), row(d, i, 2, 'A', 'B', 'H', 'C', 1, 2, 1, 1, aFirst ? 1 : 0), row(d, i, 3, 'A', 'B', 'H', 'RW', 0, 2, 1, 1, 0), row(d, i, 4, 'A', 'B', 'H', 'D', 0, 5, 1, 1, 0),
        row(d, i, 5, 'B', 'A', 'A', 'LW', 0, 6, 1, 1, 0), row(d, i, 6, 'B', 'A', 'A', 'C', 0, 2, 1, 1, 0), row(d, i, 7, 'B', 'A', 'A', 'RW', 0, 5, 1, 1, 0), row(d, i, 8, 'B', 'A', 'A', 'D', 0, 1, 1, 1, 0),
        row(d, i, 9, 'B', 'A', 'A', 'LW', 1, 0, 0, 2, aFirst ? 0 : 1),
      );
    }
    const p = shotProfiles(rows, '2026-10-27');
    expect(p.teamCount).toBe(2);
    expect(p.teams.A).toMatchObject({ games: 10, season: 2026, share: { LW: 0.25, C: 0.17, RW: 0.17, D: 0.42 }, line1: 1, danger: 0.33, first: { games: 10, scored: 7, share: 0.7 } });
    expect(p.teams.B).toMatchObject({ games: 10, share: { LW: 0.43, C: 0.14, RW: 0.36, D: 0.07 }, line1: 0, danger: 0.29, first: { games: 10, scored: 3, share: 0.3 } });
    // The league's shares are the teams' means (A and B here).
    expect(p.league).toEqual({ share: { LW: 0.34, C: expect.closeTo(0.155, 1), RW: expect.closeTo(0.265, 1), D: expect.closeTo(0.245, 1) }, line1: 0.5, danger: 0.31 });
    const a = teamCharacteristics({ team: 'A', venue: 'H', profile: p.teams.A, league: p.league });
    expect(a.style.map((x) => x.key)).toEqual(['point', 'topline', 'scoresFirst']);
    const b = teamCharacteristics({ team: 'B', venue: 'A', profile: p.teams.B, league: p.league });
    expect(b.style.map((x) => x.key)).toEqual(['wings', 'depth', 'chases']);
    // Under ten games this season the profile is last season's (a 2027-28 slate reads the 2026-27 rows).
    const few = rows.filter((r) => r.gameId <= 3).map((r) => ({ ...r, gameId: r.gameId + 100, date: r.date.replace('2026-', '2027-') }));
    expect(shotProfiles([...few, ...rows], '2027-10-27').teams.A).toMatchObject({ games: 10, season: 2026 });
    expect(shotProfiles(few, '2027-10-27').teams.A).toMatchObject({ games: 3, season: 2027 });
    expect(shotProfiles([], '2026-10-27')).toEqual({ teams: {}, league: { share: { LW: null, C: null, RW: null, D: null }, line1: null, danger: null }, teamCount: 0 });
  });
});
