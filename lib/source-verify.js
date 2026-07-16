// lib/source-verify.js
// Turn the web-search citations (real URLs the search returned) into VERIFIED
// sources: fetch each one server-side and confirm it actually resolves. A source
// the model invented, or a dead link, comes back verified:false. This is what
// makes "evidence reviewed" a real, checkable number instead of a model's claim.

const round = (n) => Math.round(n);

// Fetch a page once and return whether it resolved plus its stripped text body.
async function fetchPage(url, { timeoutMs = 5000, fetchImpl = fetch, maxChars = 500000, wantText = false } = {}) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return { reachable: false, status: 0, reason: 'invalid_url', text: '' };
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    return { reachable: false, status: 0, reason: 'bad_protocol', text: '' };
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
    const reachable = res.status >= 200 && res.status < 400;
    let text = '';
    if (reachable && wantText && typeof res.text === 'function') {
      const raw = (await res.text()).slice(0, maxChars);
      text = raw
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .toLowerCase();
    }
    return { reachable, status: res.status, text };
  } catch (err) {
    return { reachable: false, status: 0, reason: err?.name === 'AbortError' ? 'timeout' : 'unreachable', text: '' };
  } finally {
    clearTimeout(timer);
  }
}

export async function verifySource(url, opts = {}) {
  const page = await fetchPage(url, opts);
  return { url, verified: page.reachable, status: page.status, reason: page.reason };
}

// Extract the significant number tokens from a claim (≥2 chars, or a decimal),
// so "$1.2 billion, ~8%/yr" → ["1.2"] and "about 30,000 firms" → ["30000"].
export function claimNeedles(text) {
  const raw = String(text || '').match(/\d[\d,]*\.?\d*/g) || [];
  const out = [];
  for (const tok of raw) {
    const clean = tok.replace(/,/g, '');
    if (!Number.isFinite(Number(clean))) continue;
    // Keep decimals (e.g. "1.2 billion") always; require ≥2 digits & ≥10 for
    // plain integers so single-digit noise ("8%") is dropped.
    if (clean.includes('.') || (clean.replace('.', '').length >= 2 && Number(clean) >= 10)) out.push(clean);
  }
  return [...new Set(out)];
}

/**
 * CONTENT verification: fetch the page and confirm the claim's number actually
 * appears in its text. "verified" here means the figure is really on the page,
 * not just that the page loads. reachable-but-no-match ⇒ contentMatch:false.
 */
export async function verifyClaim(url, claimText, opts = {}) {
  const page = await fetchPage(url, { ...opts, wantText: true });
  if (!page.reachable) return { url, reachable: false, contentMatch: false, status: page.status };
  const body = page.text.replace(/,/g, '');
  const needles = claimNeedles(claimText);
  const contentMatch = needles.length > 0 && needles.some((n) => body.includes(n));
  return { url, reachable: true, contentMatch, status: page.status, needles };
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

/**
 * Bind a set of claims to a set of sources: fetch each source ONCE, build a text
 * corpus, then check each claim's numbers against it. Returns
 * [{claim, verified, sourceUrl}] — verified only when the claim's figure really
 * appears on one of the pages. Efficient: N fetches, not N×M.
 */
export async function verifyClaimsAgainstSources(claims = [], urls = [], { limit = 6, timeoutMs = 5000, fetchImpl = fetch } = {}) {
  const list = (Array.isArray(urls) ? urls : [])
    .filter((u) => typeof u === 'string' && /^https?:\/\//.test(u))
    .slice(0, limit);
  const pages = await Promise.all(list.map(async (url) => {
    const p = await fetchPage(url, { timeoutMs, fetchImpl, wantText: true });
    return { url, reachable: p.reachable, body: (p.text || '').replace(/,/g, '') };
  }));
  const usable = pages.filter((p) => p.reachable && p.body);
  return (Array.isArray(claims) ? claims : []).map((claim) => {
    const needles = claimNeedles(claim);
    if (!needles.length) return { claim, verified: false, sourceUrl: '' };
    const hit = usable.find((p) => needles.some((n) => p.body.includes(n)));
    return { claim, verified: Boolean(hit), sourceUrl: hit ? hit.url : '' };
  });
}

export function summarizeSources(sources = []) {
  const list = Array.isArray(sources) ? sources : [];
  const verified = list.filter((s) => s?.verified).length;
  return { total: list.length, verified, unverified: round(list.length - verified) };
}
