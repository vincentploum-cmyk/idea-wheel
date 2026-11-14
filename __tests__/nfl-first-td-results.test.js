import { describe, expect, test, jest, beforeEach } from '@jest/globals';

// The First TD picks' season record (lib/nfl/first-td-results.js) behind a Map for the store: a week's games graded
// (a game without a touchdown, a scorer off our list), the leak-free inputs of a replayed week, the stored file and the
// season's payload with its backfill limit.
const mockStored = new Map();
jest.mock('../lib/nhl-store', () => ({
  readJson: async (path) => mockStored.get(path) ?? null,
  writeJson: async (path, value) => { mockStored.set(path, value); },
  listNames: async (prefix) => [...new Set([...mockStored.keys()].filter((p) => p.startsWith(`${prefix}/`)).map((p) => p.slice(prefix.length + 1).split('/')[0]))],
  memoizeByInputs: (load, compute) => async (...args) => compute(...(await load(...args))),
}));

const { gradeFirstTdGames, replayInputs, buildFirstTdWeek, firstTdResults, firstTdPath, FIRST_TD_REPLAY, FIRST_TD_BACKFILL } = require('../lib/nfl/first-td-results');
const { FIRST_RESULTS_VERSION } = require('../lib/picks/first-results');

const W9 = { season: 2026, week: 9, type: 2 };
const W8 = { season: 2026, week: 8, type: 2 };
const base = { season: 2026, type: 'REG', passYds: 0, passTd: 0, passAtt: 0, passCmp: 0, passInt: 0, rushAtt: 0, rushYds: 0, rushTd: 0, rec: 0, recYds: 0, recTd: 0, tgt: 0, retTd: 0 };
const withTd = (g) => ({ ...g, td: g.rushTd + g.recTd + g.retTd });
// Ten games before the week (Oct 3 … Oct 30) and the week's own row (Nov 1), which a pull taken after the game carries.
const dates = ['2026-11-01', ...Array.from({ length: 10 }, (_, i) => `2026-10-${String(30 - i * 3).padStart(2, '0')}`)];
const logs = (f, own) => dates.map((date, i) => withTd({ ...base, date, opp: 'ARI', gameId: `g-${date}`, ...(i === 0 ? own : f(i)) }));
const player = (id, name, team, pos, games, extra = {}) => ({ id, name, key: name.toLowerCase(), team, pos, games, props: [{ market: 'anytime_td', line: 0.5, odds: 120, isMain: true }], ...extra });
const defense = (tag) => ({ count: 4, tag,
  league: { RB: { td: 0.9, rushYds: 100 }, WR: { td: 0.8, recYds: 160 }, TE: { td: 0.45, recYds: 47 }, QB: { passYds: 235 } },
  totals: { LAR: { for: { td: 2.8 }, against: { td: 2.2 } }, SEA: { for: { td: 2.5 }, against: { td: 2.9 } }, PHI: { for: { td: 2.6 }, against: { td: 2.1 } }, DAL: { for: { td: 2.3 }, against: { td: 2.6 } } },
  leagueFor: { td: 2.4 },
  teams: Object.fromEntries(['SEA', 'LAR', 'PHI', 'DAL'].map((t) => [t, { RB: { td: 0.9, rushYds: 100 }, WR: { recYds: 160, td: 0.8 }, TE: { td: 0.45, recYds: 47 }, QB: { passYds: 235 } }])),
  ranks: {} });
const pull = (at) => ({ at, data: {
  players: [
    player('p1', 'Kyren Williams', 'LAR', 'RB', logs((i) => ({ rushAtt: 18, rushYds: 85, rushTd: i % 3 === 2 ? 0 : 1, rec: 3, recYds: 20, tgt: 4 }), { rushAtt: 20, rushYds: 110, rushTd: 3 })),
    player('p2', 'Puka Nacua', 'LAR', 'WR', logs((i) => ({ rec: 8, recYds: 100, recTd: i % 4 === 0 ? 1 : 0, tgt: 11 }), { rec: 9, recYds: 130, recTd: 1, tgt: 12 }), { status: 'IR', injury: 'Out' }),
    player('p3', 'Zach Charbonnet', 'SEA', 'RB', logs((i) => ({ rushAtt: 14, rushYds: 60, rushTd: i % 2 }), { rushAtt: 15, rushYds: 70, rushTd: 0 })),
    player('p4', 'CeeDee Lamb', 'DAL', 'WR', logs((i) => ({ rec: 7, recYds: 90, recTd: i % 2, tgt: 10 }), { rec: 6, recYds: 80, recTd: 0, tgt: 9 })),
    player('p5', 'Saquon Barkley', 'PHI', 'RB', logs((i) => ({ rushAtt: 20, rushYds: 95, rushTd: i % 3 === 0 ? 0 : 1 }), { rushAtt: 22, rushYds: 60, rushTd: 0 })),
  ],
  defense: defense('this pull'), depth: {}, injuries: { rows: [{ id: 'p2', name: 'Puka Nacua', key: 'puka nacua', team: 'LAR', pos: 'WR', status: 'Out' }] },
} });
const GAMES = [
  { id: 'g1', date: '2026-11-01T21:25Z', away: 'LAR', home: 'SEA', final: true, state: 'post', awayScore: 27, homeScore: 20, odds: { spread: 'SEA -3', total: 47.5 } },
  { id: 'g2', date: '2026-11-01T18:00Z', away: 'DAL', home: 'PHI', final: true, state: 'post', awayScore: 6, homeScore: 3 },
];
const line = (name, team, firstTd = 0) => ({ name, team, ...base, firstTd });
const RESULTS = {
  // The first touchdown is Nacua's; the other game had none.
  g1: { id: 'g1', final: true, firstTd: { name: 'Puka Nacua', team: 'LAR' }, players: [line('Kyren Williams', 'LAR'), line('Puka Nacua', 'LAR', 1), line('Zach Charbonnet', 'SEA')] },
  g2: { id: 'g2', final: true, firstTd: null, players: [line('CeeDee Lamb', 'DAL'), line('Saquon Barkley', 'PHI')] },
};
const seedWeek = (wk, key, { at, games = GAMES, results = RESULTS } = {}) => {
  mockStored.set(`nfl/2026/${key}/schedule.json`, { slate: wk, games, fetchedAt: '2026-11-03T14:00:00Z' });
  for (const [id, r] of Object.entries(results)) mockStored.set(`nfl/2026/${key}/results/${id}.json`, r);
  if (at) mockStored.set(`nfl/2026/${key}/propfinder.json`, pull(at));
};
const noFetch = async () => { throw new Error('no network in the test'); };

beforeEach(() => mockStored.clear());

describe('a week’s games graded', () => {
  const row = (id, player, team, game, pFirst, extra = {}) => ({ id, player, key: player.toLowerCase(), team, game, td: { p: 0.3, pFirst }, ...extra });
  const board = { projections: {
    rows: Object.fromEntries([row('a', 'Kyren Williams', 'LAR', 'g1', 0.12), row('b', 'Puka Nacua', 'LAR', 'g1', 0.09), row('c', 'Zach Charbonnet', 'SEA', 'g1', 0.07), row('q', 'Backup Passer', 'SEA', 'g1', 0.01, { backup: true }),
      row('d', 'CeeDee Lamb', 'DAL', 'g2', 0.1), row('e', 'Saquon Barkley', 'PHI', 'g2', 0.14), row('f', 'Jalen Hurts', 'PHI', 'g3', 0.11)].map((r) => [r.id, r])),
    games: [{ id: 'g1', away: 'LAR', home: 'SEA', date: '2026-11-01T21:25Z' }, { id: 'g2', away: 'DAL', home: 'PHI', date: '2026-11-01T18:00Z' }, { id: 'g3', away: 'NYG', home: 'PHI', date: '2026-11-03T01:15Z' }, { id: 'g4', away: 'BUF', home: 'MIA', date: '2026-11-01T18:00Z' }],
  } };
  test('the scorer’s place on our list, a game without a touchdown, a scorer off the list, a game not stored', () => {
    const results = { ...RESULTS, g3: { id: 'g3', final: true, firstTd: { name: 'Giants Defense', team: 'NYG' }, players: [line('Jalen Hurts', 'PHI')] } };
    const { entries, skipped } = gradeFirstTdGames({ wk: W9, board, results, asOf: 'replay' });
    expect(entries.map((e) => e.id)).toEqual(['g1', 'g3']);
    expect(entries[0]).toMatchObject({ id: 'g1', date: '2026-11-01', game: 'LAR @ SEA', n: 3, scorer: { name: 'Puka Nacua', team: 'LAR' }, rank: 2, said: 0.09, week: 9, label: 'Week 9', asOf: 'replay' });
    expect(entries[0].top.map((c) => [c.name, c.hit])).toEqual([['Kyren Williams', false], ['Puka Nacua', true], ['Zach Charbonnet', false]]);
    expect(entries[0].cands).toEqual([[0.12, 0], [0.09, 1], [0.07, 0]]);   // the backup quarterback is on no list
    // The Monday game is dated in ET; its scorer (a defense) was not on our list.
    expect(entries[1]).toMatchObject({ id: 'g3', date: '2026-11-02', rank: null, said: null, n: 1, scorer: { name: 'Giants Defense', team: 'NYG' } });
    expect(skipped).toEqual([{ id: 'g2', game: 'DAL @ PHI', why: 'no touchdown' }, { id: 'g4', game: 'BUF @ MIA', why: 'no stored result' }]);
  });
  test('the list is the touchdown list when the build carries one', () => {
    const withLists = { projections: { ...board.projections, games: [{ ...board.projections.games[0], lists: { td: ['b', 'a'] } }] } };
    const { entries } = gradeFirstTdGames({ wk: W9, board: withLists, results: RESULTS });
    expect(entries[0]).toMatchObject({ n: 2, rank: 2 });
  });
});

describe('the inputs of a replayed week hold nothing its games taught', () => {
  test('a pull taken after the games: logs cut, no status, no line, no pages, the week before’s table', () => {
    const prior = { at: '2026-10-27T13:33:00Z', data: { players: [], defense: defense('the week before'), depth: { LAR: { RB: [{ key: 'kyren williams', depth: 1 }] } } } };
    const [b, ...rest] = replayInputs({ games: GAMES, pull: pull('2026-11-03T14:33:00Z'), digest: { at: '2026-11-03T14:33:00Z' }, prior });
    expect(rest).toEqual([]);
    expect(b).toMatchObject({ asOf: 'replay', table: 'the week before', pages: false });
    expect(b.pf.matchups).toBeUndefined();
    expect(b.pf.data.defense.tag).toBe('the week before');
    expect(b.pf.data.depth.LAR).toBeDefined();
    expect(b.pf.data.injuries.rows).toEqual([]);
    for (const p of b.pf.data.players) {
      expect(p.games.some((g) => g.date >= '2026-11-01')).toBe(false);
      expect(p.games).toHaveLength(10);
      expect(p).toMatchObject({ status: null, injury: null, props: [] });
    }
    expect(b.games.every((g) => g.final === false && g.awayScore === null && g.state === 'pre')).toBe(true);
    expect(b.games[0].odds).toEqual({ spread: 'SEA -3', total: 47.5 });
  });
  test('no table when the week before’s pull is missing or ran after the first kickoff', () => {
    expect(replayInputs({ games: GAMES, pull: pull('2026-11-03T14:33:00Z') })[0]).toMatchObject({ table: 'none', pf: { data: { defense: null } } });
    const late = { at: '2026-11-02T13:33:00Z', data: { players: [], defense: defense('late') } };
    expect(replayInputs({ games: GAMES, pull: pull('2026-11-03T14:33:00Z'), prior: late })[0].pf.data.defense).toBeNull();
  });
  test('a pull taken before the games is the board’s own read, its pages when the digest is that pull’s; a pull between two games splits the week', () => {
    const [b] = replayInputs({ games: GAMES, pull: pull('2026-10-31T13:33:00Z'), digest: { at: '2026-10-31T13:33:00Z', teams: {} } });
    expect(b).toMatchObject({ asOf: 'pull', table: 'this pull', pages: true });
    expect(b.pf.matchups).toEqual({ at: '2026-10-31T13:33:00Z', teams: {} });
    expect(b.pf.data.players[1]).toMatchObject({ status: 'IR', injury: 'Out' });
    expect(b.pf.data.players[0].games).toHaveLength(10);
    expect(replayInputs({ games: GAMES, pull: pull('2026-10-31T13:33:00Z'), digest: { at: 'another pull' } })[0]).toMatchObject({ pages: false });
    const split = replayInputs({ games: GAMES, pull: pull('2026-11-01T19:00:00Z') });
    expect(split.map((x) => [x.asOf, x.games.map((g) => g.id)])).toEqual([['pull', ['g1']], ['replay', ['g2']]]);
    expect(replayInputs({ games: GAMES, pull: null })).toEqual([]);
  });
});

describe('a week built and stored', () => {
  test('the file’s shape; the game without a touchdown skipped; the player the later pull has on IR still on the list', async () => {
    seedWeek(W9, 'w09', { at: '2026-11-03T14:33:00Z' });
    const file = await buildFirstTdWeek(W9, { ensure: noFetch, now: Date.parse('2026-11-05T15:00:00Z') });
    expect(firstTdPath(W9)).toBe('nfl/2026/w09/first-td-results.json');
    expect(mockStored.get('nfl/2026/w09/first-td-results.json')).toBe(file);
    expect(file).toMatchObject({ version: FIRST_RESULTS_VERSION, replay: FIRST_TD_REPLAY, season: 2026, week: 9, type: 2, label: 'Week 9', date: '2026-11-01', builtAt: '2026-11-05T15:00:00.000Z', inputs: [{ asOf: 'replay', table: 'none', pages: false, games: 2 }] });
    expect(file.skipped).toEqual([{ id: 'g2', game: 'DAL @ PHI', why: 'no touchdown' }]);
    expect(file.games).toHaveLength(1);
    const e = file.games[0];
    expect(e).toMatchObject({ id: 'g1', date: '2026-11-01', game: 'LAR @ SEA', scorer: { name: 'Puka Nacua', team: 'LAR' }, week: 9, label: 'Week 9', asOf: 'replay' });
    expect(e.rank).toBeGreaterThanOrEqual(1);
    expect(e.cands.filter((c) => c[1] === 1)).toHaveLength(1);
    expect(e.cands.reduce((s, c) => s + c[0], 0)).toBeLessThan(1);
    // Williams's three touchdowns of the game itself are not in his read: the same list with the game's rows taken off the pull.
    const stored = pull('2026-11-03T14:33:00Z');
    mockStored.set('nfl/2026/w09/propfinder.json', { ...stored, data: { ...stored.data, players: stored.data.players.map((p) => ({ ...p, games: p.games.slice(1) })) } });
    const again = await buildFirstTdWeek(W9, { ensure: noFetch, now: Date.parse('2026-11-05T15:00:00Z') });
    expect(again.games[0].cands).toEqual(e.cands);
  });
  test('a week with no pull is kept empty; finished games without a box score throw and store nothing', async () => {
    seedWeek(W8, 'w08', {});
    const file = await buildFirstTdWeek(W8, { ensure: noFetch });
    expect(file).toMatchObject({ version: FIRST_RESULTS_VERSION, games: [], empty: expect.stringMatching(/no PropFinder pull/) });
    mockStored.clear();
    seedWeek(W9, 'w09', { at: '2026-11-03T14:33:00Z', results: { g1: RESULTS.g1 } });
    let asked = 0;
    await expect(buildFirstTdWeek(W9, { ensure: async () => { asked++; } })).rejects.toThrow(/Week 9: 1 finished game without a stored box score/);
    expect(asked).toBe(1);
    expect(mockStored.has('nfl/2026/w09/first-td-results.json')).toBe(false);
  });
});

describe('the season’s record', () => {
  const entry = (id, date, rank) => ({ id, date, game: 'A @ B', n: 4, scorer: { name: 'X', team: 'A' }, rank, said: rank ? 0.1 : null, top: [{ name: 'Y', team: 'A', p: 0.2, hit: rank === 1 }], cands: [[0.2, rank === 1 ? 1 : 0], [0.1, rank === 2 ? 1 : 0], [0.05, 0], [0.04, 0]], label: 'Week' });
  const stored = (week, games) => ({ version: FIRST_RESULTS_VERSION, replay: FIRST_TD_REPLAY, season: 2026, week, type: 2, date: `2026-10-${10 + week}`, games });
  test('the stored weeks before this one, a backfill limit, the failures kept as missing', async () => {
    // Weeks 5–9 hold data and the date falls in week 9: weeks 5–8 count. Week 5 is stored; 6, 7, 8 are to build.
    for (const k of ['w05', 'w06', 'w07', 'w08', 'w09']) mockStored.set(`nfl/2026/${k}/schedule.json`, { games: [] });
    mockStored.set('nfl/2026/w05/first-td-results.json', stored(5, [entry('a', '2026-10-11', 1), entry('b', '2026-10-11', null)]));
    mockStored.set('nfl/2026/w07/first-td-results.json', { ...stored(7, []), replay: FIRST_TD_REPLAY - 1 });   // another replay: built again
    const calls = [];
    const build = async (wk) => { calls.push(wk.week); if (wk.week === 6) throw new Error('Week 6: 2 finished games without a stored box score'); const f = stored(wk.week, [entry(`w${wk.week}`, `2026-10-${10 + wk.week}`, 2)]); mockStored.set(firstTdPath(wk), f); return f; };
    const date = '2026-11-05';   // week 9 by the kickoff rule (week 1 opens 2026-09-09)
    const p = await firstTdResults({ backfill: 2, date, build });
    expect(calls).toEqual([6, 7]);
    expect(p).toMatchObject({ what: 'first touchdown', season: 2026, nights: 2, missing: 2, errors: ['Week 6: 2 finished games without a stored box score'] });
    expect(p.summary).toMatchObject({ games: 3, listed: 2, top1: { hits: 1, n: 3 }, top3: { hits: 2 } });
    expect(p.log.map((e) => e.id)).toEqual(['w7', 'a', 'b']);
    expect(p.log[0].cands).toBeUndefined();
    // The next call builds what is left (week 6 fails again, week 8 is built); none with a limit of 0.
    const next = await firstTdResults({ backfill: 0, date, build });
    expect(calls).toEqual([6, 7]);
    expect(next.missing).toBe(2);
    const last = await firstTdResults({ date, build });
    expect(FIRST_TD_BACKFILL).toBe(2);
    expect(calls).toEqual([6, 7, 6, 8]);
    expect(last).toMatchObject({ nights: 3, missing: 1 });
    expect(last.summary.games).toBe(4);
  });
});
