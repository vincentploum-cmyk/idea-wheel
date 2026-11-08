// PropFinder's NFL cheat-sheet pages kept whole on the pull (Vincent, 2026-11-08: "we need to use all these cheat sheets to
// determine matchups"; the Role Matchups route read off the site: https://api.propfinder.app/NFL/role-matchups?season=2026).
import { describe, expect, test } from '@jest/globals';
import { fetchSamples } from '../lib/nfl/propfinder-nfl';

describe('NFL PropFinder pages', () => {
  const ROLE = { season: 2026, week: 9, seasonType: 'REG', window: 'season', statsSeason: 2026, generatedAtUtc: '2026-11-08T14:46:50Z', roles: [{ role: 'WR1' }, { role: 'WR2' }] };
  test("the role matchups are read every pull with the season filled in, kept whole, and sampled for Data sources", async () => {
    const asked = [];
    const get = async (path) => { asked.push(path); if (path.startsWith('/NFL/role-matchups')) return ROLE; throw new Error('404'); };
    const out = await fetchSamples({ slateAbbrs: [], byAbbr: {}, at: '2026-11-08T14:00:00Z', season: 2026, week: 10, get, env: {} });
    expect(asked).toEqual(['/NFL/role-matchups?season=2026', '/NFL/coverage/receiver-splits?season=2026', '/NFL/td-matchups?teamWindow=Season2026&playerYear=2026',
      '/NFL/td-matchups?teamWindow=Season2026&playerYear=2026&allSplitTypes=true&skipSplits=true', '/NFL/wr-cb-matchups?season=2026&week=10',
      '/NFL/team-share?position=All&period=Full&season=2026&count=season', '/NFL/milestones?category=receivingYards', '/NFL/rushing/slate-board?season=2026']);
    expect(out.roleMatchups).toMatchObject({ path: '/NFL/role-matchups?season=2026', error: null, keys: ['season', 'week', 'seasonType', 'window', 'statsSeason', 'generatedAtUtc', 'roles'] });
    expect(out.roleMatchups.data).toBe(ROLE);
    expect(out.roleMatchups.sample).toContain('"roles"');
  });
  test('a page that answers an error is a note on the pull, never a throw', async () => {
    const out = await fetchSamples({ slateAbbrs: [], byAbbr: {}, at: '2026-11-08T14:00:00Z', season: 2026, get: async () => { throw new Error('PropFinder 401'); }, env: {} });
    expect(out.roleMatchups).toMatchObject({ error: 'PropFinder 401', sample: null });
    expect(out.roleMatchups.data).toBeUndefined();
    expect(Object.keys(out)).toEqual(['roleMatchups', 'coverageReceiverSplits', 'tdMatchups', 'tdMatchupsAllSplits', 'wrCbMatchups', 'teamShare', 'milestonesReceivingYards', 'rushingSlateBoard']);
    // Without a week the week's route is not asked (a 'no week' note).
    expect(out.wrCbMatchups.error).toBe('no week');
  });
  test('the env still names extra routes to sample (not kept)', async () => {
    const out = await fetchSamples({ slateAbbrs: [], byAbbr: {}, at: '2026-11-08T14:00:00Z', season: 2026, get: async () => [{ a: 1 }], env: { PROPFINDER_NFL_SAMPLE_PATHS: 'wrcb=/NFL/x' } });
    expect(out.roleMatchups.data).toEqual([{ a: 1 }]);
    expect(out.wrcb).toMatchObject({ path: '/NFL/x', count: 1, keys: ['a'] });
    expect(out.wrcb.data).toBeUndefined();
  });
});
