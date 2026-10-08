import { describe, expect, test } from '@jest/globals';
import { dispatchLinesWorkflow, githubDispatchConfigured } from '../lib/nhl-data/github-dispatch';
import { nextHop, WINDOW_BEFORE_MIN, WINDOW_AFTER_MIN, HOP_MIN } from '../lib/nhl-data/lines-chain';

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

describe('the warm-up chain', () => {
  const t0 = Date.parse('2026-10-08T02:00:00Z'); // EDM @ ANA, 10 PM ET
  const games = [{ startTimeUTC: '2026-10-08T02:00:00Z', away: 'EDM', home: 'ANA' }, { startTimeUTC: '2026-10-07T23:00:00Z', away: 'PIT', home: 'WSH' }];

  test('hands on while a game starts within the window, with the hop budget counting down', () => {
    const r = nextHop(games, t0 - 56 * 60000, 8); // the 9:04 PM run
    expect(r).toMatchObject({ hop: true, sleepSec: HOP_MIN * 60, hopsLeft: 7 });
    expect(r.game).toMatch(/EDM@ANA/);
  });

  test('still hands on just after puck drop, then stops', () => {
    expect(nextHop(games, t0 + (WINDOW_AFTER_MIN - 1) * 60000, 3).hop).toBe(true);
    expect(nextHop(games, t0 + (WINDOW_AFTER_MIN + 1) * 60000, 3).hop).toBe(false);
  });

  test('a quiet afternoon or a spent budget ends the chain', () => {
    expect(nextHop(games, t0 - (WINDOW_BEFORE_MIN + 1) * 60000, 8)).toMatchObject({ hop: false });
    expect(nextHop(games, t0 - 30 * 60000, 0)).toMatchObject({ hop: false, reason: 'no hops left' });
    expect(nextHop([], t0, 8).hop).toBe(false);
  });
});
