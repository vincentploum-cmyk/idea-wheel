// The public-feed GET the boards share (ESPN). ESPN answers 403 to a user agent that carries a
// URL (checked 2026-10-19: "Mozilla/5.0 (ideareels; +https://ideareels.io)" is refused, a browser
// string is served), so the requests go out as a browser.
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', Accept: 'application/json' };

export async function getJson(url, { tries = 3, timeoutMs = 12000 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 500 * (i + 1)));
    }
  }
  throw lastErr;
}
