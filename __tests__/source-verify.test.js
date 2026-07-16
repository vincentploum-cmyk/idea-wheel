import { describe, test, expect } from '@jest/globals';
import { verifySource, verifySources, summarizeSources, verifyClaim, claimNeedles, verifyClaimsAgainstSources } from '../lib/source-verify.js';

const fakeFetch = (status) => async () => ({ status });
const fakeFetchBody = (status, body) => async () => ({ status, text: async () => body });

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

describe('claimNeedles', () => {
  test('pulls significant numbers, drops tiny/noisy ones', () => {
    expect(claimNeedles('$1.2 billion in 2024, growing ~8%/yr')).toEqual(['1.2', '2024']);
    expect(claimNeedles('about 30,000 US firms')).toEqual(['30000']);
    expect(claimNeedles('a handful')).toEqual([]);
  });
});

describe('verifyClaim — content-level verification', () => {
  test('number present on the page → contentMatch', async () => {
    const html = '<html><body><h1>Market</h1><p>The market was $1.2 billion in 2024.</p></body></html>';
    const r = await verifyClaim('https://example.com', '$1.2 billion in 2024', { fetchImpl: fakeFetchBody(200, html) });
    expect(r.reachable).toBe(true);
    expect(r.contentMatch).toBe(true);
  });
  test('page loads but the number is absent → no contentMatch', async () => {
    const r = await verifyClaim('https://example.com', '$1.2 billion', { fetchImpl: fakeFetchBody(200, '<p>unrelated page about cats</p>') });
    expect(r.reachable).toBe(true);
    expect(r.contentMatch).toBe(false);
  });
  test('unreachable page → not reachable, no match', async () => {
    const r = await verifyClaim('https://example.com', '$1.2 billion', { fetchImpl: fakeFetch(404) });
    expect(r.reachable).toBe(false);
    expect(r.contentMatch).toBe(false);
  });
  test('matches across comma formatting (30,000 vs 30000)', async () => {
    const r = await verifyClaim('https://example.com', 'about 30,000 firms', { fetchImpl: fakeFetchBody(200, '<p>there are 30,000 firms</p>') });
    expect(r.contentMatch).toBe(true);
  });
});

describe('verifyClaimsAgainstSources — claim→source binding', () => {
  // One page mentions 36,000; the other is unrelated.
  const byUrl = {
    'https://a.com': '<p>firms lose about 36,000 dollars a year to manual onboarding</p>',
    'https://b.com': '<p>nothing numeric of interest here</p>',
  };
  const fetchImpl = async (url) => ({ status: 200, text: async () => byUrl[url] ?? '' });

  test('binds a claim to the page that actually contains its number', async () => {
    const out = await verifyClaimsAgainstSources(
      ['Costs an estimate of $36,000/year per firm', '80% of firms report delays'],
      ['https://a.com', 'https://b.com'],
      { fetchImpl }
    );
    expect(out[0]).toEqual({ claim: 'Costs an estimate of $36,000/year per firm', verified: true, sourceUrl: 'https://a.com' });
    // 80 appears nowhere → unverified, no source
    expect(out[1].verified).toBe(false);
    expect(out[1].sourceUrl).toBe('');
  });

  test('claims with no numbers are never auto-verified', async () => {
    const out = await verifyClaimsAgainstSources(['onboarding is painful'], ['https://a.com'], { fetchImpl });
    expect(out[0].verified).toBe(false);
  });

  test('unreachable sources verify nothing', async () => {
    const dead = async () => ({ status: 500, text: async () => '' });
    const out = await verifyClaimsAgainstSources(['$36,000 per firm'], ['https://a.com'], { fetchImpl: dead });
    expect(out[0].verified).toBe(false);
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
