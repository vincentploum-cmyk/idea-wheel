import { describe, expect, test } from '@jest/globals';
import { laborDay, week1Start, weekByRule, calendarWindows, weekForDate, shiftWeek, weekFromFileName, seasonOfDate, weekLabel } from '../lib/nfl/week';

describe('NFL weeks', () => {
  test('the kickoff rule: the Thursday after Labor Day, weeks running Wednesday to Tuesday', () => {
    expect(laborDay(2026)).toBe('2026-09-07');
    expect(laborDay(2025)).toBe('2025-09-01');
    expect(week1Start(2026)).toBe('2026-09-09');
    expect(weekByRule('2026-09-10')).toMatchObject({ season: 2026, week: 1, type: 2 });
    expect(weekByRule('2026-09-15')).toMatchObject({ week: 1 });
    expect(weekByRule('2026-09-16')).toMatchObject({ week: 2 });
    // ESPN called 2026-10-19 week 6.
    expect(weekByRule('2026-10-19')).toMatchObject({ season: 2026, week: 6, type: 2, start: '2026-10-14', end: '2026-10-20' });
    expect(weekByRule('2027-01-05')).toMatchObject({ week: 17, type: 2 });
    expect(weekByRule('2027-01-10')).toMatchObject({ week: 18, type: 2 });
    expect(weekByRule('2027-01-13')).toMatchObject({ week: 1, type: 3 });
    expect(weekByRule('2027-02-10')).toMatchObject({ week: 4, type: 3 });
    expect(weekByRule('2026-08-01')).toMatchObject({ season: 2026, type: 1 });
    expect(seasonOfDate('2027-02-10')).toBe(2026);
    expect(seasonOfDate('2027-03-10')).toBe(2027);
  });
  test('ESPN’s calendar gives the windows and wins over the rule', () => {
    const cal = [
      { label: 'Preseason', entries: [{ label: 'Preseason Week 1', value: '2', startDate: '2026-08-13T07:00Z', endDate: '2026-08-20T06:59Z' }] },
      { label: 'Regular Season', entries: [{ label: 'Week 1', value: '1', startDate: '2026-09-06T07:00Z', endDate: '2026-09-16T06:59Z' }, { label: 'Week 2', value: '2', startDate: '2026-09-16T07:00Z', endDate: '2026-09-23T06:59Z' }] },
      { label: 'Postseason', entries: [{ label: 'Wild Card', value: '1', startDate: '2027-01-13T08:00Z', endDate: '2027-01-20T07:59Z' }] },
    ];
    const w = calendarWindows(cal, 2026);
    expect(w).toEqual([
      { season: 2026, type: 1, week: 2, label: 'Preseason Week 1', start: '2026-08-13', end: '2026-08-20' },
      { season: 2026, type: 2, week: 1, label: 'Week 1', start: '2026-09-06', end: '2026-09-16' },
      { season: 2026, type: 2, week: 2, label: 'Week 2', start: '2026-09-16', end: '2026-09-23' },
      { season: 2026, type: 3, week: 1, label: 'Wild Card', start: '2027-01-13', end: '2027-01-20' },
    ]);
    // Week 1 opens on the Sunday before kickoff in ESPN's calendar; the rule would still say preseason.
    expect(weekForDate('2026-09-07', w)).toMatchObject({ week: 1, type: 2, label: 'Week 1' });
    expect(weekForDate('2026-09-17', w)).toMatchObject({ week: 2 });
    expect(weekForDate('2026-10-19', w)).toMatchObject({ week: 6 }); // off the calendar: the rule
  });
  test('shifting and labels', () => {
    expect(shiftWeek({ season: 2026, week: 18, type: 2 }, 1)).toEqual({ season: 2026, week: 1, type: 3 });
    expect(shiftWeek({ season: 2026, week: 1, type: 3 }, -1)).toEqual({ season: 2026, week: 18, type: 2 });
    expect(shiftWeek({ season: 2026, week: 1, type: 2 }, -1)).toEqual({ season: 2026, week: 1, type: 2 });
    expect(weekLabel({ week: 7, type: 2 })).toBe('Week 7');
    expect(weekLabel({ week: 4, type: 3 })).toBe('Super Bowl');
  });
  test('file names', () => {
    expect(weekFromFileName('anytime-td-wk7.csv')).toEqual({ week: 7 });
    expect(weekFromFileName('Week 12 props.xlsx')).toEqual({ week: 12 });
    expect(weekFromFileName('props-2026-10-19.csv')).toEqual({ date: '2026-10-19' });
    expect(weekFromFileName('props_20261019.csv')).toEqual({ date: '2026-10-19' });
    expect(weekFromFileName('W7-2026.csv')).toEqual({ week: 7, season: 2026 });
    expect(weekFromFileName('sheet.csv')).toEqual({});
  });
});
