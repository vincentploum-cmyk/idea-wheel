import { describe, expect, test, jest } from '@jest/globals';

// Vincent, 2026-11-14: "the season track record" of the first-basket picks. Each night is graded from what was on
// record before it (the record of the nights before, the night's own pull), stored once, then added up.
const files = new Map(); // path → JSON string
const store = {
  async list(prefix) {
    const names = new Set();
    for (const p of files.keys()) if (p.startsWith(`${prefix}/`)) names.add(p.slice(prefix.length + 1).split('/')[0]);
    return { data: [...names].map((name) => ({ name })), error: null };
  },
  async download(path) {
    if (!files.has(path)) return { data: null, error: new Error('not found') };
    const text = files.get(path);
    return { data: { text: async () => String(text), size: text.length }, error: null };
  },
  async upload(path, body) { files.set(path, await body.text()); return { data: { path }, error: null }; },
  async remove(paths) { for (const p of paths) files.delete(p); return { data: null, error: null }; },
};
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
jest.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [] }) }));
jest.mock('@supabase/ssr', () => ({ createServerClient: () => ({}) }));
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({ storage: { getBucket: async () => ({ data: { name: 'nhl-model' } }), from: () => store } }) }));

const nba = require('../lib/nba/store');

const put = (p, v) => files.set(p, JSON.stringify(v));
const five = (team) => ['A', 'B', 'C', 'D', 'E'].map((n, i) => ({ name: `${team} ${n}`, key: `${team.toLowerCase()} ${n.toLowerCase()}`, espnId: `${team}${i}`, team, pos: i === 4 ? 'C' : 'G', i }));
const log = (fga) => [0, 1, 2, 3, 4].map((k) => ({ gameId: `x${k}`, date: `2026-10-0${k + 1}`, season: 2026, type: 'REG', min: 32, fga, fgm: fga / 2, pts: fga }));
// Three nights of MIA @ ORL. The first basket: MIA A, MIA A, then ORL E (the least likely name on the list).
const NIGHTS = [['2026-10-25', 'MIA0', 'MIA'], ['2026-10-27', 'MIA0', 'MIA'], ['2026-10-29', 'ORL4', 'ORL']];
for (const [date, scorerId, scorerTeam] of NIGHTS) {
  const id = `g-${date}`;
  const players = [...five('MIA'), ...five('ORL')];
  const scorer = players.find((p) => p.espnId === scorerId);
  put(`nba/${date}/schedule.json`, { games: [{ id, date: `${date}T23:00:00Z`, away: 'MIA', home: 'ORL', final: true }], fetchedAt: `${date}T12:00:00Z` });
  put(`nba/${date}/results/${id}.json`, {
    id, final: true, away: 'MIA', home: 'ORL', awayScore: 100, homeScore: 98,
    players: players.map((p) => ({ name: p.name, team: p.team, espnId: p.espnId, starter: true, played: true, min: 32, pts: 10, q1Pts: 3 })),
    opening: { tip: { team: 'MIA', jumpers: [{ espnId: 'MIA4', name: 'MIA E' }, { espnId: 'ORL4', name: 'ORL E' }] }, firstBasket: { espnId: scorer.espnId, name: scorer.name, team: scorerTeam, kind: '2' }, firstPoints: null, firstShots: {} },
  });
  // The night's pull: MIA A takes the most shots, the centres the fewest.
  put(`nba/${date}/propfinder.json`, { at: `${date}T15:00:00Z`, data: { players: players.map((p) => ({ id: p.key, name: p.name, key: p.key, team: p.team, pos: p.pos, games: log(18 - 3 * p.i), props: [] })), depth: null } });
}

describe('one night graded as it stood that morning', () => {
  test('the first night has no record behind it; the third has the two before it and not itself', async () => {
    const all = [];
    for (const [date] of NIGHTS) all.push({ date, ...JSON.parse(files.get(`nba/${date}/results/g-${date}.json`)) });
    const first = await nba.gradeFirstBasketNight('2026-10-25', all);
    expect(first).toMatchObject({ version: 1, date: '2026-10-25', slateGames: 1, recordGames: 0, latePull: false, noPull: false });
    expect(first.games).toHaveLength(1);
    expect(first.games[0]).toMatchObject({ game: 'MIA @ ORL', n: 10, scorer: { name: 'MIA A', team: 'MIA' }, rank: 1 });
    const third = await nba.gradeFirstBasketNight('2026-10-29', all);
    expect(third.recordGames).toBe(2);                         // the 25th and the 27th, never the 29th
    expect(third.games[0].scorer.name).toBe('ORL E');
    expect(third.games[0].rank).toBeGreaterThan(5);            // a centre taking the fewest shots, on the team that lost both tips
    expect(third.games[0].top[0]).toMatchObject({ name: 'MIA A', hit: false });
  });
  test('a pull taken after the first tip is marked; a night not yet whole is not graded', async () => {
    const all = NIGHTS.map(([date]) => ({ date, ...JSON.parse(files.get(`nba/${date}/results/g-${date}.json`)) }));
    const pull = JSON.parse(files.get('nba/2026-10-27/propfinder.json'));
    put('nba/2026-10-27/propfinder.json', { ...pull, at: '2026-10-28T03:00:00Z' });
    expect((await nba.gradeFirstBasketNight('2026-10-27', all)).latePull).toBe(true);
    put('nba/2026-10-27/propfinder.json', pull);
    put('nba/2026-10-31/schedule.json', { games: [{ id: 'g-live', date: '2026-10-31T23:00:00Z', away: 'MIA', home: 'ORL', final: false }] });
    expect(await nba.gradeFirstBasketNight('2026-10-31', all)).toBeNull();
    files.delete('nba/2026-10-31/schedule.json');
  });
});

describe('the season\'s record', () => {
  test('a load grades a few nights and stores them; the next load reads them and grades the rest', async () => {
    const a = await nba.firstBasketResults('2026-11-01', { backfill: 2 });
    expect(a).toMatchObject({ what: 'first basket', season: 2026, nights: 2, built: 2, missing: 1 });
    expect(files.has(nba.firstBasketResultsPath('2026-10-25'))).toBe(true);
    expect(files.has(nba.firstBasketResultsPath('2026-10-29'))).toBe(false);
    const b = await nba.firstBasketResults('2026-11-01', { backfill: 2 });
    expect(b).toMatchObject({ nights: 3, built: 1, missing: 0 });
    expect(b.summary.games).toBe(3);
    expect(b.summary.top1).toMatchObject({ n: 3, hits: 2 });    // MIA A twice, then the ORL centre
    expect(b.log.map((e) => e.date)).toEqual(['2026-10-29', '2026-10-27', '2026-10-25']);
    expect(b.log[0].cands).toBeUndefined();
    const c = await nba.firstBasketResults('2026-11-01', { backfill: 0 });
    expect(c).toMatchObject({ nights: 3, built: 0, missing: 0 });
    // a night on or after "today" is never graded
    expect((await nba.firstBasketResults('2026-10-27', { backfill: 5 })).summary.games).toBe(1);
  });
});
