import { describe, expect, test } from '@jest/globals';
import { parseCsv, summarize, rankTeams, splitByVenue, toAbbr, mpYear } from '../lib/nhl-data/moneypuck';

const CSV = `team,season,name,position,situation,games_played,xGoalsPercentage,corsiPercentage,fenwickPercentage,iceTime,xGoalsFor,xGoalsAgainst,goalsFor,goalsAgainst,shotsOnGoalFor,shotsOnGoalAgainst,shotAttemptsFor,shotAttemptsAgainst,highDangerShotsFor,highDangerShotsAgainst,highDangerxGoalsFor,highDangerxGoalsAgainst
TOR,2025,TOR,Team Level,5on5,10,0.55,0.52,0.51,28800,20,16,18,14,240,220,440,406,90,70,12,9
TOR,2025,TOR,Team Level,all,10,0.54,0.51,0.5,36000,30,25,28,24,330,300,600,560,120,100,18,14
T.B,2025,T.B,Team Level,5on5,10,0.48,0.49,0.5,28800,17,19,15,17,225,235,420,436,80,95,10,13
`;

describe('moneypuck', () => {
  test('csv parses with numbers and MoneyPuck abbreviations map to ours', () => {
    const rows = parseCsv(CSV);
    expect(rows).toHaveLength(3);
    expect(rows[0].games_played).toBe(10);
    expect(toAbbr(rows[2].team)).toBe('TBL');
    expect(toAbbr('LAK')).toBe('LAK');
    expect(toAbbr('XXX')).toBeNull();
    expect(mpYear(new Date('2026-09-25T00:00:00Z'))).toBe(2026);
    expect(mpYear(new Date('2026-03-01T00:00:00Z'))).toBe(2025);
  });
  test('summary is per 60 on seconds of ice time', () => {
    const s = summarize(parseCsv(CSV)[0]);
    expect(s).toMatchObject({ gp: 10, minutes: 480, xgfPct: 55, cfPct: 52, xgf60: 2.5, xga60: 2, sf60: 30, sa60: 27.5, hdsa60: 8.75 });
  });
  test('ranks: high metrics descending, low metrics ascending', () => {
    const rows = parseCsv(CSV).filter((r) => r.situation === '5on5');
    const by = { '5on5': Object.fromEntries(rows.map((r) => [toAbbr(r.team), summarize(r)])) };
    const r = rankTeams(by);
    expect(r['5on5'].TOR.xgfPct).toBe(1);
    expect(r['5on5'].TBL.xgfPct).toBe(2);
    expect(r['5on5'].TOR.xga60).toBe(1); // allows fewer
  });
  test('game logs split by venue', () => {
    const g = (gameId, home_or_away, xGoalsAgainst) => ({ team: 'TOR', situation: '5on5', gameId, home_or_away, iceTime: 2880, xGoalsFor: 2, xGoalsAgainst, goalsFor: 1, goalsAgainst: 1, shotsOnGoalFor: 25, shotsOnGoalAgainst: 20, shotAttemptsFor: 45, shotAttemptsAgainst: 40, highDangerShotsFor: 9, highDangerShotsAgainst: 7, highDangerxGoalsFor: 1, highDangerxGoalsAgainst: 1, unblockedShotAttemptsFor: 30, unblockedShotAttemptsAgainst: 28 });
    const v = splitByVenue([g(1, 'HOME', 1), g(2, 'HOME', 3), g(3, 'AWAY', 4)]);
    expect(v['5on5'].H.TOR).toMatchObject({ gp: 2, xga60: 2.5 });
    expect(v['5on5'].A.TOR).toMatchObject({ gp: 1, xga60: 5 });
  });
});
