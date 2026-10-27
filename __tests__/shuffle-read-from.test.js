import { describe, expect, test } from '@jest/globals';
import { readFromOf } from '../lib/picks/shuffle';
import { readFromOf as nhlReadFromOf } from '../lib/nhl-data/shuffle-pure';

describe('the read the shuffle opens on', () => {
  test('the tab pressed this session, else the scorecard’s best, else the base read', () => {
    expect(readFromOf(null, null)).toBe('blend');
    expect(readFromOf(null, { best: null, n: 40 })).toBe('blend');   // no verdict yet
    expect(readFromOf(null, { best: 'l10' })).toBe('l10');            // the verdict
    expect(readFromOf('season', { best: 'l10' })).toBe('season');     // the user's pick wins
    expect(readFromOf('l10', { best: 'l10' })).toBe('l10');
    expect(readFromOf('nope', { best: 'l10' })).toBe('l10');          // not a read: the verdict
    expect(readFromOf(null, { best: 'own5' })).toBe('blend');         // a verdict that is not a read: the base
    expect(readFromOf(null, { failed: true })).toBe('blend');
  });
  test('the NHL panel the same, the board’s λ as the base', () => {
    expect(nhlReadFromOf(null, null)).toBe('model');
    expect(nhlReadFromOf(null, { best: null, n: 20 })).toBe('model');
    expect(nhlReadFromOf(null, { best: 'study' })).toBe('study');
    expect(nhlReadFromOf('l5', { best: 'study' })).toBe('l5');
    expect(nhlReadFromOf(null, { best: 'blend' })).toBe('model');    // not one of the shuffle's reads
  });
});
