import { describe, expect, test, jest, beforeEach } from '@jest/globals';

// EDM @ NYI, 2026-10-31: the workflow posted the GameDayTweets pages (EDM's tweet stored), then called the full
// lineup read, whose own GameDayTweets reads the server cannot make (Cloudflare, 403); the read started from nothing
// and wrote the errors over the posted tweet, so the rink fell back to PropFinder's depth chart. And NHL.com's game
// carried two "game-preview" stories, the club site's (the Islanders' lines alone, under a bare "PROJECTED LINEUP")
// listed first.

const mockFiles = new Map();
jest.mock('../lib/nhl-store', () => ({
  ...jest.requireActual('../lib/nhl-store'),
  readJson: async (p) => (mockFiles.has(p) ? JSON.parse(mockFiles.get(p)) : null),
  writeJson: async (p, v) => { mockFiles.set(p, JSON.stringify(v)); },
}));
const mockSchedule = [{ id: 2026020220, away: 'EDM', home: 'NYI', startTimeUTC: '2026-10-31T18:00:00Z', state: 'FUT' }];
let mockPreview = null;
jest.mock('../lib/nhl-data/api', () => ({
  fetchSchedule: async () => mockSchedule,
  fetchPreview: async () => mockPreview,
  fetchBoxscore: async () => null,
  fetchPlayByPlay: async () => null,
  isFinal: () => false,
}));
jest.mock('../lib/nhl-data/gamedaytweets', () => ({
  ...jest.requireActual('../lib/nhl-data/gamedaytweets'),
  fetchTeamLines: async (abbr) => { throw new Error(`gamedaytweets answered 403 for ${abbr} (cloudflare challenge)`); },
}));
jest.mock('../lib/nhl-data/rosters', () => ({ loadPlayers: async () => ({ players: {} }), updateRosters: async () => null }));
// Daily Faceoff's pages (the fallback for lines) are not this test's subject: no page is asked for.
const mockDfAsked = [];
jest.mock('../lib/nhl-data/dailyfaceoff', () => ({
  ...jest.requireActual('../lib/nhl-data/dailyfaceoff'),
  fetchDfLines: async (abbrs, at) => { mockDfAsked.push(abbrs); return Object.fromEntries(abbrs.map((a) => [a, { error: `403 for ${a}`, fetchedAt: at }])); },
}));
jest.mock('../lib/nhl-data/rotowire', () => ({ ...jest.requireActual('../lib/nhl-data/rotowire'), refreshRotowire: async () => ({ ok: false, skipped: 'test' }) }));
const mockSnapped = [];
jest.mock('../lib/nhl-data/positions', () => ({
  ...jest.requireActual('../lib/nhl-data/positions'),
  snapshotPositions: async (date, schedule, lineups) => { mockSnapped.push(lineups); return { date }; },
}));
jest.mock('../lib/nhl-data/autorun', () => ({ autoRunModel: async () => ({ ran: false, skipped: 'test' }) }));
jest.mock('../lib/nhl-data/propfinder-api', () => ({ pullPropfinder: async () => null, ensurePropfinderSlate: async () => null, propfinderConfigured: () => false, PF_PULL_META: 'x' }));
jest.mock('../lib/nhl-data/picks', () => ({ buildPicks: async () => { throw new Error('not in this test'); } }));

const { ingestLineups, keepPreview } = require('../lib/nhl-data/ingest');
const { previewLineupTeams } = require('../lib/nhl-data/lineups');
const { confirmsSameLines } = require('../lib/nhl-data/gamedaytweets');

const DATE = '2026-10-31';
const PATH = `data/lineups/${DATE}.json`;
const EDM_TWEET = { players: { 'leon draisaitl': { name: 'Leon Draisaitl', id: 8477934, pos: 'RW', line: 1 } }, forwards: 4, pairs: 3, matched: 17, meta: { source: 'gamedaytweets', handle: 'Bob_Stauffer', date: '2026-10-30', at: '2026-10-30T16:16:59.265Z', fetchedAt: '2026-10-31T18:01:06Z', via: 'github' } };
const NHL_PREVIEW_MD = '## **OILERS (9-2-2) at ISLANDERS (7-4-2)**\n\n**Oilers projected lineup**\n\nVasily Podkolzin -- Connor McDavid -- Leon Draisaitl\n\n**Islanders projected lineup**\n\nSimon Holmstrom -- Bo Horvat -- Kyle Palmieri\n\n**Status report**';
const CLUB_PREVIEW_MD = '### **PROJECTED LINEUP**\n\nSimon Holmström – Bo Horvat – Kyle Palmieri\n\nIlya Sorokin';

beforeEach(() => { mockFiles.clear(); mockSnapped.length = 0; mockPreview = null; });

describe('the lineup read keeps what it cannot re-read', () => {
  test('a full read (no window) keeps the posted tweets when its own GameDayTweets reads are refused', async () => {
    mockPreview = { slug: 'edmonton-oilers-new-york-islanders-game-preview-october-31-2026', updated: '2026-10-30T17:17:51.35Z', markdown: NHL_PREVIEW_MD };
    mockFiles.set(PATH, JSON.stringify({ date: DATE, fetchedAt: '2026-10-31T17:00:00Z', games: [], gdt: { EDM: EDM_TWEET } }));
    const r = await ingestLineups(DATE);
    const stored = JSON.parse(mockFiles.get(PATH));
    expect(stored.gdt.EDM.players).toEqual(EDM_TWEET.players);
    expect(stored.gdt.EDM.meta.handle).toBe('Bob_Stauffer');
    expect(stored.gdt.NYI.error).toMatch(/403/); // a team with nothing stored records the refusal
    expect(mockSnapped[0].gdt.EDM.players).toBeTruthy(); // the snapshot is taken on the kept tweet
    expect(r.gamedaytweets).toBe(1);
  });

  test('a re-read preview without a lineup keeps the lines read earlier', async () => {
    const earlier = { gameId: 2026020220, away: 'EDM', home: 'NYI', slug: 's', updated: '2026-10-30T17:17:51.35Z', fetchedAt: '2026-10-31T12:00:00Z', rows: ['Oilers projected lineup', 'A -- B -- C'] };
    mockFiles.set(PATH, JSON.stringify({ date: DATE, games: [earlier], gdt: {} }));
    mockPreview = null; // the story is gone, or the page has moved on
    await ingestLineups(DATE, { settle: true });
    const g = JSON.parse(mockFiles.get(PATH)).games[0];
    expect(g.rows).toEqual(earlier.rows);
    expect(g.reread.rows).toBe(0);
  });

  test("keepPreview: the lines' own times — first seen as they stand, and revised — not the page's moving stamp", () => {
    const rows = (rw) => ['Ducks projected lineup', `Leo Carlsson -- Troy Terry -- ${rw}`, 'Senators projected lineup', 'Brady Tkachuk -- Tim Stutzle -- Drake Batherson'];
    const first = keepPreview(null, { gameId: 1, rows: rows('Frank Vatrano'), updated: '2026-04-18T15:00:00Z' });
    expect(first.linesAt).toEqual({ ANA: '2026-04-18T15:00:00Z', OTT: '2026-04-18T15:00:00Z' });
    expect(first.revisedAt).toEqual({ ANA: null, OTT: null });
    // The page re-stamped with the same lines: nothing moves.
    const same = keepPreview(first, { gameId: 1, rows: [...rows('Frank Vatrano'), 'Injuries: none'], updated: '2026-04-18T19:00:00Z' });
    expect(same.linesAt).toEqual(first.linesAt);
    expect(same.revisedAt).toEqual({ ANA: null, OTT: null });
    // The Ducks' right wing changes: a revision for ANA alone.
    const revised = keepPreview(same, { gameId: 1, rows: rows('Cutter Gauthier'), updated: '2026-04-18T21:00:00Z' });
    expect(revised.revisedAt).toEqual({ ANA: '2026-04-18T21:00:00Z', OTT: null });
    expect(revised.linesAt).toEqual({ ANA: '2026-04-18T21:00:00Z', OTT: '2026-04-18T15:00:00Z' });
    // A later re-read without a change keeps the revision time.
    expect(keepPreview(revised, { gameId: 1, rows: rows('Cutter Gauthier'), updated: '2026-04-18T22:00:00Z' }).revisedAt.ANA).toBe('2026-04-18T21:00:00Z');
  });
  test('keepPreview: a re-read with lines replaces the entry, one without keeps it', () => {
    const prev = { gameId: 1, rows: ['x'], updated: 'a' };
    expect(keepPreview(prev, { gameId: 1, rows: ['y'], updated: 'b' }).rows).toEqual(['y']);
    expect(keepPreview(prev, { gameId: 1, rows: [], error: 'boom', fetchedAt: 'now' })).toMatchObject({ rows: ['x'], reread: { error: 'boom', fetchedAt: 'now' } });
    expect(keepPreview(null, { gameId: 1, rows: [] }).rows).toEqual([]);
  });
});

describe('which preview story', () => {
  test("NHL.com's preview names both teams' lineups, a club site's names none", () => {
    expect(previewLineupTeams(NHL_PREVIEW_MD)).toBe(2);
    expect(previewLineupTeams(CLUB_PREVIEW_MD)).toBe(0);
  });

  test('fetchPreview takes the story naming the teams over the one listed first', async () => {
    const { fetchPreview } = jest.requireActual('../lib/nhl-data/api');
    const realFetch = global.fetch;
    const stories = {
      'game-preview-islanders-vs-oilers-oct-31-2026': CLUB_PREVIEW_MD,
      'edmonton-oilers-new-york-islanders-game-preview-october-31-2026': NHL_PREVIEW_MD,
    };
    global.fetch = async (url) => {
      const json = url.includes('stories?')
        ? { items: [{ slug: 'edmonton-oilers-new-york-islanders-game-recap-october-31-2026' }, ...Object.keys(stories).map((slug) => ({ slug }))] }
        : { title: 't', lastUpdatedDate: '2026-10-31T16:43:10Z', parts: [{ type: 'markdown', content: stories[url.split('/stories/')[1]] }] };
      return { ok: true, status: 200, json: async () => json };
    };
    try {
      const p = await fetchPreview(2026020220);
      expect(p.slug).toBe('edmonton-oilers-new-york-islanders-game-preview-october-31-2026');
      expect(p.teams).toBe(2);
    } finally { global.fetch = realFetch; }
  });
});

test('"the same winning lineup" confirms the lines before it', () => {
  expect(confirmsSameLines('The #Oilers will continue with the same winning lineup as they open a back-to-back set this afternoon on Long Island. https://t.co/vJRNC8U5Aw')).toBe(true);
});
