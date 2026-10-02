import { describe, expect, test } from '@jest/globals';
import { firstGoalRecord, firstGoalScore, candidate, LEAGUE_FG_RATE } from '../lib/nhl-data/firstgoal';
import { rowObj } from '../lib/nhl-data/ingest';

const row = (date, gameId, pid, fg) => rowObj([date, gameId, pid, `P${pid}`, 'NJD', 'PHI', 'H', 'C', 15, fg, 0, 3, 0, 0, 3, 3, 3, 1, 0, 'W', 'lineup', 'C', 1, fg]);

describe('first-goal candidates', () => {
  test('the record counts first goals over games that carry the flag, shrunk toward the league rate', () => {
    const rows = [row('2026-01-01', 1, 1, 1), row('2026-01-03', 2, 1, 0), row('2026-01-05', 3, 1, 1), row('2026-01-05', 3, 2, 0)];
    // A row stored before the column existed carries no flag and is left out of the record.
    const old = rowObj(['2025-12-01', 0, 1, 'P1', 'NJD', 'PHI', 'H', 'C', 15, 1, 0, 3, 0, 0, 3, 3, 3, 1, 0, 'W']);
    const rec = firstGoalRecord([old, ...rows]);
    expect(rec[1]).toMatchObject({ gp: 3, fg: 2, rate: 0.67 });
    expect(rec[1].rateAdj).toBeCloseTo((2 + LEAGUE_FG_RATE * 20) / 23, 2);
    expect(rec[2]).toMatchObject({ gp: 1, fg: 0, rate: 0 });
    expect(firstGoalRecord(rows, { window: 1 })[1]).toMatchObject({ gp: 1, fg: 1 });
  });
  test('the score weighs the model first, then the own rate, the leak and head to head', () => {
    expect(firstGoalScore({ p1g: 0.45, rateAdj: 0.15, leakRatio: 2, h2hGpg: 1 })).toBe(100);
    expect(firstGoalScore({ p1g: 0.2, rateAdj: 0.05, leakRatio: 1, h2hGpg: 0 })).toBe(38);
    expect(firstGoalScore({ p1g: null, rateAdj: 0.15, leakRatio: 1, h2hGpg: 0 })).toBe(70);
    expect(firstGoalScore({})).toBe(15);
    // A stronger leak to the position lifts it; a league-average leak is neutral.
    expect(firstGoalScore({ p1g: 0.3, rateAdj: 0.1, leakRatio: 1.8 })).toBeGreaterThan(firstGoalScore({ p1g: 0.3, rateAdj: 0.1, leakRatio: 1 }));
  });
  test('a slate skater becomes a candidate row with the slot leak and the model odds', () => {
    const side = { defense: { C: { firstGoal: { games: 12, allowed: 5, share: 0.42, league: 0.28, rank: 4, teamCount: 32, bySlot: { C1: 3, C2: 2 } } } } };
    const p = { id: 1, name: 'Jack Hughes', team: 'NJD', opp: 'PHI', venue: 'H', pos: 'C', line: 1, inLineup: true, model: { p1g: 0.41, g: 0.55 }, h2h: { gp: 3, g: 5, gpg: 1.67, hot: true } };
    const c = candidate(p, side, { 1: { gp: 82, fg: 11, rate: 0.13, rateAdj: 0.11 } });
    expect(c).toMatchObject({ slot: 'C1', own: { fg: 11, gp: 82 }, p1g: 0.41, modelled: true });
    expect(c.leak).toMatchObject({ rank: 4, slot: 3, ratio: 1.5 });
    expect(c.score).toBe(firstGoalScore({ p1g: 0.41, rateAdj: 0.11, leakRatio: 1.5, h2hGpg: 1.67 }));
    // No model run: the 1+ goal odds come from the matchup read; scratched players are left out.
    expect(candidate({ ...p, model: null, projG: 0.5 }, side, {})).toMatchObject({ modelled: false, p1g: 0.39 });
    expect(candidate({ ...p, inLineup: false }, side, {})).toBeNull();
  });
});
