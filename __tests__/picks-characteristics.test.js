import { describe, expect, test } from '@jest/globals';
import { levelOf, splitTraits, joinAnd } from '../lib/picks/levels';
import { shareTrait } from '../lib/picks/characteristics';
import { teamCharacteristics as nba, gameCharacteristics as nbaGame } from '../lib/nba/characteristics';
import { teamCharacteristics as nfl } from '../lib/nfl/characteristics';
import { buildBoard } from '../lib/nba/picks';

// A league of fourteen filler teams close to the average plus the teams with a character (the NBA's
// seventeen: the top four very, 5–6 strong, 12–13 weak, 14–17 very weak; the NFL's sixteen).
const fillers = (make) => Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`T${String(i).padStart(2, '0')}`, make(i)]));
const meanOf = (totals, side) => {
  const out = {};
  for (const key of new Set(Object.values(totals).flatMap((t) => Object.keys(t[side] || {})))) {
    if (['gp', 'season', 'held', 'prior', 'priorSeason', 'lastN'].includes(key)) continue;
    const v = Object.values(totals).map((t) => t[side]?.[key]).filter((x) => x != null);
    out[key] = v.reduce((s, x) => s + x, 0) / v.length;
  }
  return out;
};
const keys = (list) => list.map((x) => x.key);

describe('the picks characteristics (NBA, NFL)', () => {
  const nbaTotals = {
    ...fillers((i) => ({ for: { gp: 12, pts: 113 + i * 0.1, reb: 44 + i * 0.1, ast: 25 + i * 0.1, tpm: 13 + i * 0.05, ftm: 19 + i * 0.1, tov: 13.5 + i * 0.05, stl: 7.5 + i * 0.05, blk: 5 + i * 0.05 }, against: { gp: 12, pts: 114 + i * 0.1, reb: 44 + i * 0.1, ast: 25.5 + i * 0.1, tpm: 13 + i * 0.05, ftm: 19 + i * 0.1, tov: 13.5 + i * 0.05 } })),
    BOS: { for: { gp: 12, pts: 120, reb: 46, ast: 27, tpm: 18, ftm: 18, tov: 12, stl: 9, blk: 6.5 }, against: { gp: 12, pts: 108, reb: 42, ast: 24, tpm: 12, ftm: 20, tov: 15 } },
    NY: { for: { gp: 12, pts: 110, reb: 44, ast: 24, tpm: 12, ftm: 20, tov: 15, stl: 7, blk: 4 }, against: { gp: 12, pts: 118, reb: 46, ast: 28, tpm: 15, ftm: 18, tov: 12 } },
    DET: { for: { gp: 3, held: true, prior: 82, pts: 112, reb: 48, ast: 25, tpm: 10, ftm: 24, tov: 14, stl: 7.6, blk: 5.1 }, against: { gp: 3, held: true, prior: 82, pts: 112, reb: 44, ast: 26, tpm: 13, ftm: 22, tov: 13 } },
  };
  const nbaDefense = {
    count: 16, leagueFor: meanOf(nbaTotals, 'for'), totals: nbaTotals,
    teams: { BOS: { PG: { pts: 26 }, SG: { pts: 22 }, SF: { pts: 23 }, PF: { pts: 21 }, C: { pts: 18 }, G: { pts: 48 } }, NY: { PG: { pts: 22 }, C: { pts: 26 } } },
    ranks: { BOS: { PG: { pts: 2 }, SG: { pts: 8 }, SF: { pts: 7 }, PF: { pts: 9 }, C: { pts: 15 }, G: { pts: 1 } }, NY: { PG: { pts: 12 }, C: { pts: 1 } } },
  };
  test('levels, the split and the words', () => {
    expect([1, 4, 5, 6, 7, 10, 11, 12, 13, 16].map((r) => levelOf(r, 16))).toEqual(['very', 'very', 'strong', 'strong', null, null, 'weak', 'weak', 'veryWeak', 'veryWeak']);
    const { strengths, weaknesses } = splitTraits([{ key: 'a', level: 'strong', rank: 5, n: 16 }, { key: 'b', level: 'very', rank: 1, n: 12 }, { key: 'c', level: 'weak', rank: 11, n: 16 }, { key: 'd', level: 'veryWeak', rank: 12, n: 12 }, null], 16);
    expect(keys(strengths)).toEqual(['b', 'a']);
    expect(keys(weaknesses)).toEqual(['d', 'c']);
    expect(joinAnd(['point guards', 'centres'])).toBe('point guards and centres');
    expect(shareTrait({ key: 'x', value: 0.5, league: 0.4, up: 'Up', down: 'Down', detail: 'd' })).toMatchObject({ key: 'x', text: 'Up' });
    expect(shareTrait({ key: 'x', value: 0.3, league: 0.4, up: 'Up', down: 'Down' })).toMatchObject({ key: 'xLow', text: 'Down' });
    expect(shareTrait({ key: 'x', value: 0.42, league: 0.4, up: 'Up', down: 'Down' })).toBeNull();
    expect(shareTrait({ key: 'x', value: null, league: 0.4, up: 'Up' })).toBeNull();
  });
  test('NBA: a team that scores, defends, keeps the ball and forces turnovers; the positions it leaks to; its style', () => {
    const c = nba({ team: 'BOS', venue: 'H', defense: nbaDefense });
    expect(c).toMatchObject({ team: 'BOS', venue: 'H', tier: 'tight', headline: 'Tight defense', tone: 'is-tough' });
    // Most extreme first; equal ranks keep the config's order (attack, the own-row defense traits, what it gives up, the positions).
    expect(c.strengths.map((x) => [x.key, x.level])).toEqual([
      ['scoring', 'very'], ['playmaking', 'very'], ['threes', 'very'], ['security', 'very'], ['rim', 'very'], ['hands', 'very'], ['ptsAgainst', 'very'], ['rebAgainst', 'very'], ['astAgainst', 'very'], ['tpmAgainst', 'very'], ['forcing', 'very'], ['rebounding', 'very'], ['holds', 'very'],
    ]);
    expect(c.strengths.find((x) => x.key === 'scoring').detail).toBe('120.0 points a game, #1 of 17 · PropFinder, 12 games');
    expect(c.strengths.find((x) => x.key === 'security').detail).toBe('12.0 turnovers a game, #1 of 17 fewest · PropFinder, 12 games');
    expect(c.strengths.find((x) => x.key === 'forcing').detail).toBe('15.0 turnovers a game allowed, #1 of 17 most forced · PropFinder, 12 games');
    expect(c.strengths.find((x) => x.key === 'holds')).toMatchObject({ text: 'Holds centres', detail: 'C 18.0 points a game, #15 of 16 most' });
    expect(c.weaknesses.map((x) => [x.key, x.text, x.level])).toEqual([['line', 'Getting to the line', 'veryWeak'], ['leaks', 'Gives up points to point guards', 'veryWeak'], ['ftmAgainst', 'Keeping opponents off the line', 'weak']]);
    // The G group row is left aside (only the five positions), so "guards" never shows up beside "point guards".
    expect(c.weaknesses[1].detail).toBe('PG 26.0 points a game, #2 of 16 most');
    expect(keys(c.style)).toEqual(['threes']);
    expect(c.style[0]).toMatchObject({ text: 'Lives on the three', kind: 'attack' });
    expect(c.style[0].detail).toMatch(/^45% of its points from threes, league 3\d% · PropFinder$/);
  });
  test('NBA: a leaky, low-scoring team, and a held row reads last season', () => {
    const c = nba({ team: 'NY', venue: 'A', defense: nbaDefense });
    expect(c).toMatchObject({ tier: 'leaky', headline: 'Leaky defense', tone: 'is-soft' });
    // Everything at the bottom of the league, the two at 16 of 17 (rebounding, threes: DET rebounds more, shoots fewer threes) last.
    expect(keys(c.weaknesses)).toEqual(['scoring', 'playmaking', 'security', 'rim', 'hands', 'ptsAgainst', 'rebAgainst', 'astAgainst', 'tpmAgainst', 'forcing', 'leaks', 'rebounding', 'threes']);
    expect(c.strengths.find((x) => x.key === 'ftmAgainst')).toMatchObject({ level: 'very' });
    expect(c.weaknesses.find((x) => x.key === 'leaks')).toMatchObject({ text: 'Gives up points to centres', level: 'veryWeak' });
    expect(c.strengths.find((x) => x.key === 'holds')).toMatchObject({ text: 'Holds point guards', level: 'strong' });
    expect(c.strengths.find((x) => x.key === 'line')).toMatchObject({ text: 'Getting to the line' });
    const d = nba({ team: 'DET', venue: 'H', defense: nbaDefense });
    expect(d.strengths.find((x) => x.key === 'rebounding').detail).toBe("48.0 rebounds a game, #1 of 17 · PropFinder, last season's row until ten games (3 this season)");
    expect(keys(d.style)).toEqual(['threesLow', 'line']);
    expect(d.style.map((x) => x.text)).toEqual(['Scores inside the arc', 'Gets to the line']);
    // Nothing for a team the pull does not carry; nothing without a block.
    expect(nba({ team: 'LAL', venue: 'H', defense: nbaDefense })).toBeNull();
    expect(nba({ team: 'BOS', venue: 'H', defense: null })).toBeNull();
    const g = nbaGame({ away: 'NY', home: 'BOS' }, nbaDefense);
    expect(Object.keys(g)).toEqual(['NY', 'BOS']);
    expect(g.BOS.venue).toBe('H');
    expect(nbaGame({ away: 'LAL', home: 'MIA' }, nbaDefense)).toBeNull();
  });
  test('NFL: the passing and running games, the end zone, takeaways; yards by position; pass-heavy and downfield', () => {
    const totals = {
      ...fillers((i) => ({ for: { gp: 7, passYds: 240 + i, rushYds: 115 + i * 0.5, td: 2.5 + i * 0.02, passInt: 0.8 + i * 0.01, passCmp: 21 + i * 0.1 }, against: { gp: 7, passYds: 240 + i, rushYds: 115 + i * 0.5, td: 2.5 + i * 0.02, passInt: 0.8 + i * 0.01 } })),
      KC: { for: { gp: 7, passYds: 290, rushYds: 95, td: 3.2, passInt: 0.5, passCmp: 22 }, against: { gp: 7, passYds: 270, rushYds: 95, td: 1.8, passInt: 1.2 } },
      BUF: { for: { gp: 7, passYds: 230, rushYds: 150, td: 2.9, passInt: 1.1, passCmp: 23 }, against: { gp: 7, passYds: 230, rushYds: 140, td: 2.6, passInt: 0.6 } },
    };
    const defense = { count: 16, leagueFor: meanOf(totals, 'for'), totals, teams: { KC: { QB: { passYds: 280 }, RB: { rushYds: 90 }, WR: { recYds: 160 }, TE: { recYds: 60 } } }, ranks: { KC: { QB: { passYds: 1 }, RB: { rushYds: 16 }, WR: { recYds: 7 }, TE: { recYds: 9 } } } };
    const c = nfl({ team: 'KC', venue: 'H', defense });
    expect(c).toMatchObject({ tier: 'tight', headline: 'Tight defense' });
    expect(c.strengths.map((x) => [x.key, x.text, x.level])).toEqual([
      ['passing', 'Passing game', 'very'], ['scoring', 'Finding the end zone', 'very'], ['security', 'Ball security', 'very'], ['runDefense', 'Run defense', 'very'], ['redZone', 'Keeping teams out of the end zone', 'very'], ['takeaways', 'Taking the ball away', 'very'], ['holds', 'Holds running backs', 'very'],
    ]);
    expect(c.weaknesses.map((x) => [x.key, x.text, x.level])).toEqual([['running', 'Running game', 'veryWeak'], ['passDefense', 'Pass defense', 'veryWeak'], ['leaks', 'Gives up yards to quarterbacks', 'veryWeak']]);
    expect(c.weaknesses[2].detail).toBe('QB 280.0 yards a game, #1 of 16 most');
    expect(c.style.map((x) => [x.key, x.text])).toEqual([['balance', 'Pass-heavy'], ['downfield', 'Pushes the ball downfield']]);
    const b = nfl({ team: 'BUF', venue: 'A', defense });
    expect(b.style.map((x) => x.text)).toEqual(['Run-heavy', 'Short passing game']);
    expect(b.strengths.find((x) => x.key === 'running')).toMatchObject({ level: 'very' });
    expect(b.weaknesses.find((x) => x.key === 'runDefense')).toMatchObject({ level: 'veryWeak' });
  });
  test('the NBA board carries both teams’ characteristics on every game, nothing without team rows', () => {
    const games = [{ id: 'g1', away: 'NY', home: 'BOS', date: '2026-10-21T23:00:00Z' }];
    const pf = { at: '2026-10-21T14:00:00Z', data: { players: [], defense: nbaDefense } };
    const b = buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf, results: {} });
    expect(b.games[0].characteristics.BOS.headline).toBe('Tight defense');
    expect(b.games[0].characteristics.NY.tier).toBe('leaky');
    const bare = buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf: { ...pf, data: { players: [], defense: { count: 0, teams: {}, ranks: {} } } }, results: {} });
    expect(bare.games[0].characteristics).toBeNull();
    expect(buildBoard({ date: '2026-10-21', season: 2026, games, sheets: [], pf: null, results: {} }).games[0].characteristics).toBeNull();
  });
});
