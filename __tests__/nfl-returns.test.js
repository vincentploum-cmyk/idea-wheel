// A teammate back (lib/nfl/returns.js; docs/audits/2026-11-15-nfl-model.md): a back who carried the load while the starter was
// out is read toward what he did in the games they shared — down only, at half strength, a real load only, the return known.
import { describe, expect, test } from '@jest/globals';
import { backFactor, backText, BACK } from '../lib/nfl/returns';
import { makeBuild, buildBoard as plainBuild } from '../lib/nfl/picks';

const base = { season: 2026, type: 'REG', passYds: 0, passTd: 0, passAtt: 0, passCmp: 0, passInt: 0, rushAtt: 0, rushYds: 0, rushTd: 0, rec: 0, recYds: 0, recTd: 0, tgt: 0, retTd: 0, td: 0 };
// Nine weeks: the starter plays weeks 1–3 and week 9, the second back carries the load in weeks 4–8.
const WEEKS = ['2026-09-13', '2026-09-20', '2026-09-27', '2026-10-04', '2026-10-11', '2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08'];
const OPP = ['TEN', 'GB', 'DET', 'CHI', 'CLE', 'NE', 'MIA', 'LV', 'KC'];
const row = (i, f) => ({ ...base, date: WEEKS[i], opp: OPP[i], ...f });
const SECOND = WEEKS.map((_, i) => row(i, i >= 3 && i <= 7 ? { rushAtt: 18, rushYds: 100 } : { rushAtt: 6, rushYds: 20 }));
const STARTER = [0, 1, 2, 8].map((i) => row(i, { rushAtt: 16, rushYds: 70 }));
const args = { logs: SECOND, market: 'rush_yds', pos: 'RB', season: 2026, date: '2026-11-15', depth: 2 };

describe('NFL: a teammate back', () => {
  test('the second back after the starter missed five of his six: toward their shared games, at half strength', () => {
    const b = backFactor({ ...args, mates: [{ name: 'Starter', games: STARTER, depth: 1 }] });
    // His last six: 100 × 5 and 20 → 86.7; their four shared games: 20 a game; counted with two of his recent: (4 × 20 + 2 × 86.7) / 6 = 42.2.
    expect(b).toMatchObject({ mate: 'Starter', missed: 5, of: 6, shared: 4, withHim: 20, usual: 86.7 });
    expect(b.factor).toBeCloseTo(1 + BACK.strength * (42.2 / 86.7 - 1), 2);
    expect(backText({ ...b, before: 61 })).toBe('61 before Starter back (out for 5 of his last 6; 20 a game in their 4 together against 87 lately) ×0.74');
  });
  test('never up, never under the floor, nothing under a 5% move', () => {
    // He did more beside the starter than lately: no factor.
    const up = SECOND.map((g, i) => (i >= 3 && i <= 7 ? { ...g, rushAtt: 6, rushYds: 20 } : { ...g, rushAtt: 18, rushYds: 100 }));
    expect(backFactor({ ...args, logs: up, mates: [{ name: 'Starter', games: STARTER, depth: 1 }] })).toBeNull();
    const zero = SECOND.map((g, i) => (i >= 3 && i <= 7 ? g : { ...g, rushAtt: 1, rushYds: 0 }));
    expect(backFactor({ ...args, logs: zero, mates: [{ name: 'Starter', games: STARTER, depth: 1 }], B: { ...BACK, strength: 1 } }).factor).toBe(BACK.floor);
    const near = SECOND.map((g, i) => (i >= 3 && i <= 7 ? g : { ...g, rushAtt: 16, rushYds: 96 }));
    expect(backFactor({ ...args, logs: near, mates: [{ name: 'Starter', games: STARTER, depth: 1 }] })).toBeNull();
  });
  test('a depth man moves nobody; neither does a man who missed one game, or one they never played beside', () => {
    const scrub = [0, 1, 2, 8].map((i) => row(i, { rushAtt: 2, rushYds: 6 }));
    expect(backFactor({ ...args, mates: [{ name: 'Scrub', games: scrub, depth: 3 }] })).toBeNull();
    const steady = WEEKS.map((_, i) => row(i, { rushAtt: 16, rushYds: 70 })).filter((_, i) => i !== 5);
    expect(backFactor({ ...args, mates: [{ name: 'Steady', games: steady, depth: 1 }] })).toBeNull();
    const stranger = [8].map((i) => row(i, { rushAtt: 16, rushYds: 70 }));
    expect(backFactor({ ...args, mates: [{ name: 'New', games: stranger, depth: 1 }] })).toBeNull();
  });
  test('his first game back: only a man ahead on the chart, not day to day, not gone two months', () => {
    const before = STARTER.slice(0, 3);   // out since week 3, back tonight
    const day = '2026-11-08';
    const mine = SECOND.slice(0, 8);
    const a = { ...args, logs: mine, date: day };
    expect(backFactor({ ...a, mates: [{ name: 'Starter', games: before, depth: 1 }] }).mate).toBe('Starter');
    expect(backFactor({ ...a, mates: [{ name: 'Starter', games: before, depth: 1, doubt: true }] })).toBeNull();
    expect(backFactor({ ...a, mates: [{ name: 'Starter', games: before, depth: 3 }] })).toBeNull();
    expect(backFactor({ ...a, mates: [{ name: 'Starter', games: before, depth: null }] })).toBeNull();
    expect(backFactor({ ...a, date: '2026-12-06', mates: [{ name: 'Starter', games: before, depth: 1 }] })).toBeNull();
  });
  test('other markets and positions: receiving for receivers and backs, nothing for a quarterback', () => {
    expect(backFactor({ ...args, market: 'pass_yds', mates: [{ name: 'Starter', games: STARTER, depth: 1 }] })).toBeNull();
    expect(backFactor({ ...args, pos: 'QB', mates: [{ name: 'Starter', games: STARTER, depth: 1 }] })).toBeNull();
    const wr = WEEKS.map((_, i) => row(i, i >= 3 && i <= 7 ? { tgt: 10, rec: 7, recYds: 90 } : { tgt: 4, rec: 2, recYds: 25 }));
    const one = [0, 1, 2, 8].map((i) => row(i, { tgt: 9, rec: 6, recYds: 80 }));
    expect(backFactor({ ...args, logs: wr, pos: 'WR', market: 'rec_yds', mates: [{ name: 'One', games: one, depth: 1 }] }).factor).toBeLessThan(0.9);
    expect(backFactor({ ...args, logs: wr, pos: 'WR', market: 'receptions', mates: [{ name: 'One', games: one, depth: 1 }] }).factor).toBeLessThan(0.9);
  });
  test('on the board: the row carries the factor and the figure before it; the plain build reads none', () => {
    const players = [
      { id: 'p-2', name: 'Second Back', key: 'second back', team: 'NYJ', pos: 'RB', games: SECOND, props: [] },
      { id: 'p-1', name: 'Starter', key: 'starter', team: 'NYJ', pos: 'RB', games: STARTER, props: [] },
    ];
    const a = { season: 2026, week: 10, games: [{ id: 'g', date: '2026-11-15T18:00Z', away: 'BUF', home: 'NYJ', final: false, state: 'pre', odds: { spread: 'BUF -8.5', total: 50.5 } }], sheets: [], pf: { at: 'a', data: { players, defense: null } }, results: {} };
    const plain = plainBuild(a).projections.rows['second back|NYJ'].yards.rush_yds;
    const fed = makeBuild(undefined, { params: { ROLE_BACK: BACK } })(a).projections.rows;
    const y = fed['second back|NYJ'].yards.rush_yds;
    expect(plain.back).toBeNull();
    expect(y.back).toMatchObject({ mate: 'Starter', before: plain.proj });
    expect(y.proj).toBeCloseTo(plain.proj * y.back.factor, 0);
    expect(y.tiers.strong.mark).toBeLessThanOrEqual(plain.tiers.strong.mark);
    expect(fed['starter|NYJ'].yards.rush_yds.back).toBeNull();
  });
});
