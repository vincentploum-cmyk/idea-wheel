import { describe, expect, test } from '@jest/globals';
import { dispatchLinesWorkflow, githubDispatchConfigured } from '../lib/nhl-data/github-dispatch';
import { nextHop, linesFound, WINDOW_BEFORE_MIN, WINDOW_AFTER_MIN, HOP_MIN, MAX_SLEEP_SEC } from '../lib/nhl-data/lines-chain';
import { gdtTimes } from '../lib/nhl-data/ingest';

describe('GitHub dispatch of the pre-game lineups run', () => {
  test('without a token the dispatch is skipped, not attempted', async () => {
    let called = false;
    const r = await dispatchLinesWorkflow({ date: '2026-10-07', env: {}, fetchImpl: async () => { called = true; } });
    expect(r.ok).toBe(false);
    expect(r.skipped).toMatch(/GITHUB_DISPATCH_TOKEN/);
    expect(called).toBe(false);
    expect(githubDispatchConfigured({})).toBe(false);
  });

  test('posts workflow_dispatch for nhl-lineups.yml with the date, the window and the hop budget', async () => {
    const calls = [];
    const r = await dispatchLinesWorkflow({
      date: '2026-10-07', due: 150, chain: 8,
      env: { GITHUB_DISPATCH_TOKEN: 'tok', GITHUB_REPO: 'o/r' },
      fetchImpl: async (url, init) => { calls.push({ url, init }); return { status: 204, text: async () => '' }; },
    });
    expect(r.ok).toBe(true);
    expect(calls[0].url).toBe('https://api.github.com/repos/o/r/actions/workflows/nhl-lineups.yml/dispatches');
    expect(calls[0].init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(calls[0].init.body)).toEqual({ ref: 'main', inputs: { date: '2026-10-07', due: '150', chain: '8' } });
  });

  test('a refusal comes back as an error with GitHub\'s message', async () => {
    const r = await dispatchLinesWorkflow({ date: '2026-10-07', env: { GITHUB_DISPATCH_TOKEN: 'tok' }, fetchImpl: async () => ({ status: 403, text: async () => JSON.stringify({ message: 'Resource not accessible by personal access token' }) }) });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/403.*Resource not accessible/);
  });
});

describe('the warm-up chain: every 15 minutes from an hour before puck drop until the lineups are in', () => {
  const min = 60000;
  const t0 = Date.parse('2026-10-08T02:00:00Z'); // EDM @ ANA, 10 PM ET
  const t1 = Date.parse('2026-10-07T23:00:00Z'); // PIT @ WSH, 7 PM ET
  const games = [{ startTimeUTC: '2026-10-08T02:00:00Z', away: 'EDM', home: 'ANA' }, { startTimeUTC: '2026-10-07T23:00:00Z', away: 'PIT', home: 'WSH' }];
  const warmups = { PIT: '2026-10-07T22:40:00Z', WSH: '2026-10-07T22:38:00Z', EDM: '2026-10-08T01:37:52Z', ANA: '2026-10-08T01:37:31Z' };
  const morning = { PIT: '2026-10-07T16:00:00Z', WSH: '2026-10-07T17:10:00Z', EDM: '2026-10-06T16:29:12Z', ANA: '2026-10-07T17:12:06Z' };

  test('lineups are found when both teams have a tweet from the 45 minutes before the start', () => {
    expect(linesFound(games[0], warmups)).toBe(true);
    expect(linesFound(games[0], morning)).toBe(false);                 // the morning skate is not the warm-up
    // An afternoon projected-lines tweet (T-105) is not the warm-up either: the reads go on.
    expect(linesFound(games[0], { ...warmups, EDM: '2026-10-08T00:15:00Z' })).toBe(false);
    expect(linesFound(games[0], { ...warmups, ANA: morning.ANA })).toBe(false); // one team is not enough
    expect(linesFound(games[0], {})).toBe(false);
  });

  test('inside a window without lineups: the next read in 15 minutes', () => {
    const r = nextHop(games, t0 - 56 * min, 40, { ...warmups, EDM: morning.EDM, ANA: morning.ANA }); // the 9:04 PM run last night
    expect(r).toMatchObject({ hop: true, sleepSec: HOP_MIN * 60, hopsLeft: 39 });
    expect(r.why).toMatch(/EDM@ANA/);
  });

  test('a game whose warm-up lines are in is left alone, and the chain ends when every game has them', () => {
    expect(nextHop(games, t1 - 20 * min, 40, warmups).hop).toBe(false);             // PIT@WSH found, EDM@ANA found
    const r = nextHop(games, t1 - 20 * min, 40, { ...warmups, EDM: morning.EDM, ANA: morning.ANA });
    expect(r.hop).toBe(true);
    expect(r.why).toMatch(/waiting for the window of EDM@ANA/);                       // PIT@WSH found: wait for the late game
    expect(r.sleepSec).toBe(Math.round((t0 - WINDOW_BEFORE_MIN * min - (t1 - 20 * min)) / 1000));
  });

  test('before the first window the run waits for it, long waits split into hops', () => {
    const r = nextHop(games, t1 - 8 * 3600000, 40, {});
    expect(r.hop).toBe(true);
    expect(r.sleepSec).toBe(MAX_SLEEP_SEC);
    const r2 = nextHop(games, t1 - 90 * min, 40, {});
    expect(r2.sleepSec).toBe(30 * 60);
  });

  test('inside one window the next read comes sooner when another window opens first', () => {
    const close = [{ startTimeUTC: '2026-10-07T23:00:00Z', away: 'PIT', home: 'WSH' }, { startTimeUTC: '2026-10-07T23:10:00Z', away: 'COL', home: 'WPG' }];
    const r = nextHop(close, t1 - 55 * min, 40, {}); // PIT@WSH window open; COL@WPG opens in 5 minutes
    expect(r.sleepSec).toBe(5 * 60);
  });

  test('the window closes ten minutes after puck drop, and a spent budget ends the chain', () => {
    expect(nextHop(games, t0 + (WINDOW_AFTER_MIN - 1) * min, 40, {}).hop).toBe(true);
    expect(nextHop(games, t0 + (WINDOW_AFTER_MIN + 1) * min, 40, {}).hop).toBe(false);
    expect(nextHop(games, t0 - 30 * min, 0, {})).toMatchObject({ hop: false, reason: 'no hops left' });
    expect(nextHop([], t0, 40, {}).hop).toBe(false);
  });

  test('the site reports each team\'s newest tweet time for the chain', () => {
    const gdt = { ANA: { players: { x: {} }, meta: { at: '2026-10-08T01:37:31Z' } }, COL: { none: true }, EDM: { players: { y: {} }, meta: {} } };
    expect(gdtTimes(gdt)).toEqual({ ANA: '2026-10-08T01:37:31Z', EDM: null });
  });
});
