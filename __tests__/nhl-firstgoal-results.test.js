import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const mockStored = new Map();
const mockRuns = new Map(); // id → { manifest, results }
jest.mock('../lib/nhl-store', () => ({
  ...jest.requireActual('../lib/nhl-store'),
  readJson: async (path) => mockStored.get(path) ?? null,
  writeJson: async (path, value) => { mockStored.set(path, value); },
  listNames: async (prefix) => (prefix === 'runs' ? [...mockRuns.keys()] : []),
  getRun: async (id) => mockRuns.get(id)?.manifest ?? null,
  getRunResults: async (id) => mockRuns.get(id)?.results ?? null,
}));

const { gradeFirstGoalNight, firstGoalResults, firstGoalResultsPath, runBefore, candidatesAsOf, FIRST_GOAL_BACKFILL } = require('../lib/nhl-data/firstgoal-results');
const { FIRST_RESULTS_VERSION, firstNightUsable } = require('../lib/picks/first-results');
const { rowsPath, gamesPath, rowObj } = require('../lib/nhl-data/ingest');
const { positionsPath } = require('../lib/nhl-data/positions');

const TODAY = '2026-11-14';
// Two teams, two forwards and a defenseman a side. Ids: NJD 1 2 3, PHI 11 12 13.
const SKATERS = [[1, 'Jack Hughes', 'NJD', 'C'], [2, 'Jesper Bratt', 'NJD', 'RW'], [3, 'Luke Hughes', 'NJD', 'D'], [11, 'Travis Konecny', 'PHI', 'RW'], [12, 'Sean Couturier', 'PHI', 'C'], [13, 'Travis Sanheim', 'PHI', 'D']];
const HOME = 'NJD';
/** A game's rows: `scorer` scored the first goal (and a goal). */
const gameRows = (date, gameId, scorer) => SKATERS.map(([id, name, team, pos]) => [date, gameId, id, name, team, team === 'NJD' ? 'PHI' : 'NJD', team === HOME ? 'H' : 'A', pos, 18, id === scorer ? 1 : 0, 0, 3, 0, 0, 4, 3, 3, 1, 0, 'W', 'lineup', pos, 1, id === scorer ? 1 : 0, 1, 1, 1, 0, 0]);
const gameRecord = (date, id, scorer) => ({
  id, date, away: { abbrev: 'PHI', score: 1 }, home: { abbrev: 'NJD', score: 2 },
  skaters: SKATERS.map(([sid, name, team, pos]) => ({ id: sid, name, team, pos })),
  firstGoal: scorer ? { playerId: scorer, name: SKATERS.find((s) => s[0] === scorer)[1], team: SKATERS.find((s) => s[0] === scorer)[2], period: 1, time: '03:10' } : null,
});
const lineup = (team, extra = {}) => ({ source: 'lineup', meta: {}, players: Object.fromEntries(SKATERS.filter((s) => s[2] === team).map(([id, name, , pos]) => [name.toLowerCase(), { name, id, pos, line: 1 }])), ...extra });
const snapshot = (date, id, teams = { PHI: lineup('PHI'), NJD: lineup('NJD') }) => ({ date, games: { [id]: { away: 'PHI', home: 'NJD', startTimeUTC: `${date}T23:00:00Z`, teams } } });

// The season so far: Hughes (1) scored the first goal on the 6th and the 8th; the graded nights are the 10th
// (Konecny, 11, scored first), the 11th (Hughes) and the 12th (Bratt, 2).
const NIGHTS = [['2026-11-10', 2026020110, 11], ['2026-11-11', 2026020111, 1], ['2026-11-12', 2026020112, 2]];
function seed({ nights = NIGHTS } = {}) {
  mockStored.clear(); mockRuns.clear();
  const rows = [...gameRows('2026-11-06', 2026020106, 1), ...gameRows('2026-11-08', 2026020108, 1)];
  for (const [date, id, scorer] of nights) {
    rows.push(...gameRows(date, id, scorer));
    mockStored.set(gamesPath(date), { date, games: [gameRecord(date, id, scorer)] });
    mockStored.set(positionsPath(date), snapshot(date, id));
  }
  mockStored.set(rowsPath('20262027'), { season: 20262027, updatedAt: `seed-${Math.random()}`, rows });
  mockStored.set(rowsPath('20252026'), { season: 20252026, updatedAt: 'prev', rows: [] });
}

beforeEach(() => seed());

describe('the first-goal list graded for a past night', () => {
  test('a night is graded against who scored first, in the stored shape', async () => {
    const night = await gradeFirstGoalNight('2026-11-11', { today: TODAY });
    expect(night).toMatchObject({ version: FIRST_RESULTS_VERSION, date: '2026-11-11', slateGames: 1, withRun: 0, skipped: [] });
    expect(typeof night.builtAt).toBe('string');
    expect(firstNightUsable(night)).toBe(true);
    const [e] = night.games;
    expect(e).toMatchObject({ id: 2026020111, date: '2026-11-11', game: 'PHI @ NJD', n: 6, scorer: { name: 'Jack Hughes', team: 'NJD' } });
    // Hughes scored the first goal of two of the three games before the 11th: the top of the list, and he scored it.
    expect(e.rank).toBe(1);
    expect(e.top[0]).toMatchObject({ name: 'Jack Hughes', team: 'NJD', hit: true });
    expect(e.top).toHaveLength(3);
    // The chances are the scores' shares of the game's total: they add up to 1, and `said` is the scorer's.
    expect(e.cands.reduce((s, c) => s + c[0], 0)).toBeCloseTo(1, 1);
    expect(e.cands.filter((c) => c[1] === 1)).toHaveLength(1);
    expect(e.said).toBe(e.top[0].p);
  });

  test('leak-free: a game does not feed its own list, nor does anything after it', async () => {
    const withAll = await gradeFirstGoalNight('2026-11-10', { today: TODAY });
    // The same night with nothing on file from the 10th on (no rows of the game itself or of the later games).
    const file = mockStored.get(rowsPath('20262027'));
    mockStored.set(rowsPath('20262027'), { ...file, updatedAt: 'cut', rows: file.rows.filter((r) => r[0] < '2026-11-10') });
    const cut = await gradeFirstGoalNight('2026-11-10', { today: TODAY });
    expect(withAll.games).toEqual(cut.games);
    // Konecny scored the first goal on the 10th with none on record before it: not the top pick that morning.
    expect(withAll.games[0].scorer.name).toBe('Travis Konecny');
    expect(withAll.games[0].rank).toBeGreaterThan(1);
    expect(withAll.games[0].top[0].name).toBe('Jack Hughes');
    // The season function's shortcut (today's rows cut to the ones before the date) says the same.
    seed();
    const { loadRows } = require('../lib/nhl-data/build');
    const viaToday = await gradeFirstGoalNight('2026-11-10', { today: TODAY, rows: await loadRows(TODAY) });
    expect(viaToday.games).toEqual(cut.games);
    // Today and later are never graded.
    await expect(gradeFirstGoalNight(TODAY, { today: TODAY })).rejects.toThrow('not a past date');
  });

  test('the own record a candidate carries is the one before the date', () => {
    const rows = [...gameRows('2026-11-06', 1, 1), ...gameRows('2026-11-08', 2, 1)].map(rowObj);
    const list = candidatesAsOf({ game: { away: 'PHI', home: 'NJD', teams: { PHI: lineup('PHI'), NJD: lineup('NJD') } }, rows, date: '2026-11-10' });
    expect(list.find((c) => c.id === 1).own).toMatchObject({ gp: 2, fg: 2 });
    expect(list.find((c) => c.id === 11).own).toMatchObject({ gp: 2, fg: 0 });
    expect(list.reduce((s, c) => s + c.p, 0)).toBeCloseTo(1, 6);
    // A skater the lineup does not dress is not a candidate.
    const out = { PHI: lineup('PHI'), NJD: lineup('NJD') };
    out.NJD.players['jack hughes'] = { ...out.NJD.players['jack hughes'], inLineup: false };
    expect(candidatesAsOf({ game: { away: 'PHI', home: 'NJD', teams: out }, rows, date: '2026-11-10' }).map((c) => c.id)).not.toContain(1);
  });

  test('only a model run saved before the puck drop is read', async () => {
    const run = (id, createdAt, p1g) => mockRuns.set(id, { manifest: { id, slateDate: '2026-11-12', hasResults: true, createdAt }, results: [{ name: 'Travis Sanheim', team: 'PHI', p1g, lambdaG: 0.5 }] });
    // Saved after the game (23:00 UTC): left out, the night reads as if no run existed.
    run('20261113-040000-aaaaaa', '2026-11-13T04:00:00Z', 0.45);
    const late = await gradeFirstGoalNight('2026-11-12', { today: TODAY });
    expect(late.withRun).toBe(0);
    // Saved that afternoon: read, and its 45% for Sanheim lifts him up the list.
    run('20261112-180000-bbbbbb', '2026-11-12T18:00:00Z', 0.45);
    const pre = await gradeFirstGoalNight('2026-11-12', { today: TODAY });
    expect(pre.withRun).toBe(1);
    const said = (night) => night.games[0].top.find((c) => c.name === 'Travis Sanheim')?.p ?? 0;
    expect(said(pre)).toBeGreaterThan(said(late));
    expect(runBefore([{ id: 'a', createdAt: '2026-11-12T10:00:00Z' }, { id: 'b', createdAt: '2026-11-12T18:00:00Z' }, { id: 'c', createdAt: '2026-11-13T01:00:00Z' }], '2026-11-12T23:00:00Z').id).toBe('b');
    expect(runBefore([{ id: 'a', createdAt: '2026-11-12T10:00:00Z' }], null)).toBeNull();
  });

  test('a game without a pre-game lineup or a first goal is skipped; an unstamped night waits', async () => {
    mockStored.set(positionsPath('2026-11-11'), snapshot('2026-11-11', 2026020111, { PHI: lineup('PHI'), NJD: lineup('NJD', { source: 'gamedaytweets', meta: { gdtAt: '2026-11-11T23:40:00Z' } }) }));
    expect((await gradeFirstGoalNight('2026-11-11', { today: TODAY })).skipped).toEqual([{ id: 2026020111, game: 'PHI @ NJD', why: 'lineup read after the puck drop' }]);
    mockStored.delete(positionsPath('2026-11-11'));
    const none = await gradeFirstGoalNight('2026-11-11', { today: TODAY });
    expect(none.games).toEqual([]);
    expect(none.skipped[0].why).toBe('no lineup captured');
    mockStored.set(gamesPath('2026-11-12'), { games: [gameRecord('2026-11-12', 2026020112, null)] });
    expect((await gradeFirstGoalNight('2026-11-12', { today: TODAY })).skipped[0].why).toBe('no first goal');
    const { firstGoal, ...unstamped } = gameRecord('2026-11-10', 2026020110, 11);
    mockStored.set(gamesPath('2026-11-10'), { games: [unstamped] });
    await expect(gradeFirstGoalNight('2026-11-10', { today: TODAY })).rejects.toThrow('not stamped');
    expect(await gradeFirstGoalNight('2026-11-09', { today: TODAY })).toBeNull();
  });
});

describe('the season record', () => {
  test('grades `backfill` nights a call (the newest first), stores them and counts the rest as missing', async () => {
    expect(FIRST_GOAL_BACKFILL).toBe(3);
    const first = await firstGoalResults({ backfill: 1, today: TODAY });
    // Five dates hold rows; the 6th and the 8th have no stored game file here, so they stay to grade.
    expect(first).toMatchObject({ what: 'first goal', season: 2026, nights: 1, built: 1, missing: 4, errors: [] });
    expect(first.log.map((e) => e.date)).toEqual(['2026-11-12']);
    expect(first.log[0].cands).toBeUndefined();
    const file = mockStored.get(firstGoalResultsPath('2026-11-12'));
    expect(firstGoalResultsPath('2026-11-12')).toBe('data/firstgoal/results/2026-11-12.json');
    expect(file).toMatchObject({ version: FIRST_RESULTS_VERSION, date: '2026-11-12' });
    expect(file.games[0].cands).toHaveLength(6);
    expect(mockStored.has(firstGoalResultsPath('2026-11-11'))).toBe(false);

    const second = await firstGoalResults({ backfill: 5, today: TODAY });
    expect(second).toMatchObject({ nights: 3, built: 2, missing: 2 });
    expect(second.summary).toMatchObject({ games: 3, listed: 3, first: '2026-11-10', last: '2026-11-12' });
    expect(second.summary.top1.hits).toBe(1); // Hughes on the 11th
    expect(second.log.map((e) => e.date)).toEqual(['2026-11-12', '2026-11-11', '2026-11-10']);
    // Stored nights are read, not built again.
    const builtAt = mockStored.get(firstGoalResultsPath('2026-11-12')).builtAt;
    expect(builtAt).toBe(file.builtAt);
    expect((await firstGoalResults({ backfill: 0, today: TODAY })).built).toBe(0);
  });

  test('a night that fails is named in errors and does not stop the others', async () => {
    const { firstGoal, ...unstamped } = gameRecord('2026-11-12', 2026020112, 2);
    mockStored.set(gamesPath('2026-11-12'), { games: [unstamped] });
    const res = await firstGoalResults({ backfill: 3, today: TODAY });
    expect(res.errors).toEqual(['2026-11-12: first goals not stamped yet']);
    expect(res).toMatchObject({ nights: 2, built: 2, missing: 3 });
    expect(mockStored.has(firstGoalResultsPath('2026-11-12'))).toBe(false);
  });
});
