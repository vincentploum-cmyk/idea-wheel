import { describe, expect, test } from '@jest/globals';
import { tabOf } from '../components/site/hash-tab';

const NHL = ['teams', 'matchups', 'defense', 'firstgoal', 'model', 'shuffle', 'league', 'history'];

describe('the hash tabs', () => {
  test('the hash names the tab, a team deep link keeps its tab, anything else is the default', () => {
    expect(tabOf('#shuffle', NHL, 'matchups')).toBe('shuffle');
    expect(tabOf('#teams/BUF', NHL, 'matchups')).toBe('teams');
    expect(tabOf('', NHL, 'matchups')).toBe('matchups');
    expect(tabOf('#nope', NHL, 'matchups')).toBe('matchups');
    expect(tabOf(undefined, NHL, 'matchups')).toBe('matchups');
  });
  test('the NFL and NBA boards open on Best plays and carry a Shuffle tab', () => {
    const keys = ['board', 'shuffle'];
    expect(tabOf('', keys, 'board')).toBe('board');
    expect(tabOf('#shuffle', keys, 'board')).toBe('shuffle');
    expect(tabOf('#model', keys, 'board')).toBe('board');
  });
});
