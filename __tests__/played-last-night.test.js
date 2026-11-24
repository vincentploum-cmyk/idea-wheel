import { playedLastNight } from '../lib/picks/board';
import { etDayOf } from '../lib/picks/propfinder';

// The back-to-back flag (docs/audits/2026-11-24-nba-top10.md): PropFinder's gameDate is a UTC timestamp, so a 7 pm ET tip
// in winter is dated the next day. Until 2026-11-24 the flag read that date as ET and fired on the team that had played two
// nights ago (2,438 of its 2,652 flags, Oct 21 – Nov 23).
describe('played last night', () => {
  test('the pull keeps the ET night of a UTC timestamp', () => {
    expect(etDayOf('2026-11-21T00:30:00Z')).toBe('2026-11-20');   // 7:30 pm ET on the 20th
    expect(etDayOf('2026-11-20T18:00:00Z')).toBe('2026-11-20');   // 1 pm ET
    expect(etDayOf('2026-11-20')).toBeNull();                      // a bare date: nothing to convert
  });
  test('with the ET night: the day before the slate, nothing else', () => {
    expect(playedLastNight({ date: '2026-11-20', day: '2026-11-19' }, '2026-11-20')).toBe(true);
    expect(playedLastNight({ date: '2026-11-19', day: '2026-11-18' }, '2026-11-20')).toBe(false);   // two nights ago, late tip
  });
  test('an older pull (UTC date only): dated the slate itself is last night, unless it is tonight’s opponent', () => {
    expect(playedLastNight({ date: '2026-11-20', opp: 'NY' }, '2026-11-20', 'BOS')).toBe(true);
    expect(playedLastNight({ date: '2026-11-20', opp: 'BOS' }, '2026-11-20', 'BOS')).toBe(false);   // tonight's early game, pulled late
    expect(playedLastNight({ date: '2026-11-19', opp: 'NY' }, '2026-11-20', 'BOS')).toBe(false);    // the old misread: two nights ago
    expect(playedLastNight(null, '2026-11-20')).toBe(false);
  });
});
