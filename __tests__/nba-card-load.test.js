import { describe, expect, test, jest } from '@jest/globals';

// The NBA player card loads fast (2026-11-05: a cold open waited ~9 s on some 150 reads, one after the other): the card's
// payload reads no past night, the opponent's games come in their own request (`part=vs`), each past night is read once
// and kept until a write under its date.
const files = new Map(); // path → JSON string
const reads = [];
const store = {
  async list(prefix) {
    const names = new Set();
    for (const p of files.keys()) if (p.startsWith(`${prefix}/`)) names.add(p.slice(prefix.length + 1).split('/')[0]);
    return { data: [...names].map((name) => ({ name })), error: null };
  },
  async download(path) {
    reads.push(path);
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

const nhlStore = require('../lib/nhl-store');
const nba = require('../lib/nba/store');

const put = (p, v) => files.set(p, JSON.stringify(v));
const line = (name, team, pts) => ({ name, team, pos: 'G', min: 30, pts, reb: 4, ast: 3, tpm: 2, tpa: 5, fga: 12, played: true });
const NIGHTS = [['2026-10-25', 'MIA', 'ORL'], ['2026-10-27', 'ORL', 'NYK'], ['2026-10-29', 'ATL', 'BOS']];
for (const [date, away, home] of NIGHTS) {
  const id = `g-${date}`;
  put(`nba/${date}/schedule.json`, { games: [{ id, date: `${date}T23:00:00Z`, away, home, final: true }], fetchedAt: `${date}T12:00:00Z` });
  put(`nba/${date}/results/${id}.json`, { id, final: true, away, home, awayScore: 100, homeScore: 98, players: [line(`Guard ${away}`, away, 20), line(`Guard ${home}`, home, 18)] });
  put(`nba/${date}/propfinder.json`, { at: `${date}T12:00:00Z`, data: { players: [{ key: `guard ${away.toLowerCase()}`, pos: 'PG' }, { key: `guard ${home.toLowerCase()}`, pos: 'SG' }], depth: {} } });
}
// Tonight BOS at ORL, the same game kept on two later nights for the memo checks.
for (const date of ['2026-11-04', '2026-11-03', '2026-11-02']) {
  put(`nba/${date}/schedule.json`, { games: [{ id: `t-${date}`, date: `${date}T23:00:00Z`, away: 'BOS', home: 'ORL', final: false }], fetchedAt: new Date().toISOString() });
  put(`nba/${date}/propfinder.json`, { at: `${date}T12:00:00Z`, data: { players: [{ id: 1, key: 'guard bos', name: 'Guard BOS', team: 'BOS', pos: 'SG', games: [], props: [] }], depth: {} } });
}
const SLATE = { date: '2026-11-04' };

describe('the NBA player card’s load', () => {
  test('the card’s payload reads no past night; the opponent’s games come with part=vs', async () => {
    const card = await nba.playerFor(SLATE, 'guard bos');
    expect(card).toMatchObject({ opp: 'ORL', venue: 'A' });
    expect(card.vsPosition).toBeUndefined();
    expect(reads.filter((p) => !p.startsWith(`nba/${SLATE.date}/`) && !p.startsWith('nba/meta/'))).toEqual([]);
    const { vsPosition } = await nba.vsPositionCard(SLATE, 'guard bos');
    // ORL's two games before tonight: MIA's guard and NYK's, placed by those nights' pulls.
    expect(vsPosition).toMatchObject({ opp: 'ORL', games: 2 });
    expect(vsPosition.rows.map((r) => [r.name, r.pos, r.pts])).toEqual([['Guard NYK', 'SG', 18], ['Guard MIA', 'PG', 20]]);
    expect(await nba.vsPositionCard(SLATE, 'nobody')).toBeNull();
  });
  test('a past night is read once, and again after a write under its date', async () => {
    const memoOf = () => nba.vsPositionCard({ date: '2026-11-03' }, 'guard bos');   // another date: the per-opponent memo starts empty
    reads.length = 0;
    expect((await memoOf()).vsPosition.games).toBe(2);
    expect(reads.filter((p) => /results|propfinder/.test(p) && !/2026-11-0[34]/.test(p))).toEqual([]);   // every night kept from the first read
    const path = 'nba/2026-10-27/results/g-2026-10-27.json';
    const r = JSON.parse(files.get(path));
    await nhlStore.writeJson(path, { ...r, players: [line('Guard ORL', 'ORL', 20), line('Guard NYK', 'NYK', 31)] });
    reads.length = 0;
    const { vsPosition } = await nba.vsPositionCard({ date: '2026-11-02' }, 'guard bos');
    expect(reads.filter((p) => p.includes('results/'))).toEqual([]);   // the write was remembered: no download, yet the new line reads
    expect(vsPosition.rows.find((x) => x.name === 'Guard NYK').pts).toBe(31);
  });
});
