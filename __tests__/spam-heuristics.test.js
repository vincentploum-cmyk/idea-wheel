import { honeypotTripped, submittedTooFast, looksLikeSpam } from '../lib/spam-heuristics.js';

describe('honeypotTripped', () => {
  test('empty website field passes', () => {
    expect(honeypotTripped({ website: '' })).toBe(false);
    expect(honeypotTripped({})).toBe(false);
  });
  test('any content in website field trips it', () => {
    expect(honeypotTripped({ website: 'https://spam.com' })).toBe(true);
    expect(honeypotTripped({ website: '  x  ' })).toBe(true);
  });
  test('non-string ignored', () => {
    expect(honeypotTripped({ website: 42 })).toBe(false);
  });
});

describe('submittedTooFast', () => {
  test('absent timestamp accepts', () => {
    expect(submittedTooFast({})).toBe(false);
  });
  test('sub-1500ms submit trips', () => {
    expect(submittedTooFast({ formLoadedAt: Date.now() - 300 })).toBe(true);
  });
  test('normal-speed submit passes', () => {
    expect(submittedTooFast({ formLoadedAt: Date.now() - 10_000 })).toBe(false);
  });
});

describe('looksLikeSpam', () => {
  test('URL shortener in message', () => {
    expect(looksLikeSpam('hello check this out https://bit.ly/xyz')).toBe(true);
  });
  test('spam keywords', () => {
    expect(looksLikeSpam('buy viagra now')).toBe(true);
    expect(looksLikeSpam('bitcoin mining rig for sale')).toBe(true);
  });
  test('normal message passes', () => {
    expect(looksLikeSpam('Hi, love your product. Question about credits.')).toBe(false);
  });
  test('empty passes', () => {
    expect(looksLikeSpam('')).toBe(false);
    expect(looksLikeSpam(null)).toBe(false);
  });
});
