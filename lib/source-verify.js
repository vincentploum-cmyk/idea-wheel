// lib/source-verify.js
// Turn the web-search citations (real URLs the search returned) into VERIFIED
// sources: fetch each one server-side and confirm it actually resolves. A source
// the model invented, or a dead link, comes back verified:false. This is what
// makes "evidence reviewed" a real, checkable number instead of a model's claim.

const round = (n) => Math.round(n);

export async function verifySource(url, { timeoutMs = 4000, fetchImpl = fetch } = {}) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { url, verified: false, status: 0, reason: 'invalid_url' };
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    return { url, verified: false, status: 0, reason: 'bad_protocol' };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IdeaReels source-check)' },
    });
    return { url, verified: res.status >= 200 && res.status < 400, status: res.status };
  } catch (err) {
    return { url, verified: false, status: 0, reason: err?.name === 'AbortError' ? 'timeout' : 'unreachable' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Verify a batch of citations concurrently. Returns [{url, title, verified, status}].
 */
export async function verifySources(citations = [], { limit = 8, timeoutMs = 4000, fetchImpl = fetch } = {}) {
  const list = (Array.isArray(citations) ? citations : []).filter((c) => c && c.url).slice(0, limit);
  return Promise.all(list.map(async (c) => {
    const v = await verifySource(c.url, { timeoutMs, fetchImpl });
    return { url: c.url, title: String(c.title || '').slice(0, 160), verified: v.verified, status: v.status };
  }));
}

export function summarizeSources(sources = []) {
  const list = Array.isArray(sources) ? sources : [];
  const verified = list.filter((s) => s?.verified).length;
  return { total: list.length, verified, unverified: round(list.length - verified) };
}
