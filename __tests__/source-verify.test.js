import { describe, test, expect } from '@jest/globals';
import { verifySource, verifySources, summarizeSources } from '../lib/source-verify.js';

const fakeFetch = (status) => async () => ({ status });

describe('verifySource', () => {
  test('200 resolves → verified', async () => {
    expect((await verifySource('https://example.com', { fetchImpl: fakeFetch(200) })).verified).toBe(true);
  });
  test('301 (redirect followed) → verified', async () => {
    expect((await verifySource('https://example.com', { fetchImpl: fakeFetch(301) })).verified).toBe(true);
  });
  test('404 → not verified', async () => {
    const r = await verifySource('https://example.com/missing', { fetchImpl: fakeFetch(404) });
    expect(r.verified).toBe(false);
    expect(r.status).toBe(404);
  });
  test('invalid URL → not verified', async () => {
    expect((await verifySource('not a url', { fetchImpl: fakeFetch(200) })).reason).toBe('invalid_url');
  });
  test('non-http protocol → not verified', async () => {
    expect((await verifySource('ftp://x.com', { fetchImpl: fakeFetch(200) })).reason).toBe('bad_protocol');
  });
  test('network throw → unreachable, not verified', async () => {
    const throwing = async () => { throw new Error('boom'); };
    expect((await verifySource('https://example.com', { fetchImpl: throwing })).verified).toBe(false);
  });
});

describe('verifySources + summary', () => {
  test('verifies a batch and caps at limit', async () => {
    const citations = Array.from({ length: 12 }, (_, i) => ({ url: `https://s${i}.com`, title: `S${i}` }));
    const out = await verifySources(citations, { limit: 5, fetchImpl: fakeFetch(200) });
    expect(out.length).toBe(5);
    expect(out.every((s) => s.verified)).toBe(true);
  });
  test('summarize counts verified vs total', () => {
    const s = summarizeSources([{ verified: true }, { verified: false }, { verified: true }]);
    expect(s).toEqual({ total: 3, verified: 2, unverified: 1 });
  });
  test('drops citations without a url', async () => {
    const out = await verifySources([{ title: 'no url' }, { url: 'https://ok.com' }], { fetchImpl: fakeFetch(200) });
    expect(out.length).toBe(1);
  });
});
