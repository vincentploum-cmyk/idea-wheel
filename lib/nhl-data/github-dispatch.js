// Ask GitHub to run the pre-game lineups workflow now. GitHub's cron is a lottery (the
// twice-hourly schedule fired twice on 2026-10-07), so "Refresh lines" on the Matchups tab
// starts a run on demand: the runner's Chrome fetches the GameDayTweets pages the site's own
// server is refused, posts them to /api/nhl/data/lineups/gdt, and the run keeps re-dispatching
// itself: every 15 minutes from 60 minutes before each puck drop until the lineups are in
// (tools/lines-chain.mjs). Needs GITHUB_DISPATCH_TOKEN in
// the server env: a fine-grained token for this repo with Actions: read and write.
const API = 'https://api.github.com';
export const WORKFLOW_FILE = 'nhl-lineups.yml';

export function githubDispatchConfigured(env = process.env) {
  return Boolean(env.GITHUB_DISPATCH_TOKEN);
}

export function githubRepo(env = process.env) {
  return env.GITHUB_REPO || 'vincentploum-cmyk/idea-wheel';
}

/**
 * workflow_dispatch for nhl-lineups.yml. `due` limits the NHL.com reads to games starting
 * within that many minutes (blank = all games on the date); `chain` is how many self-dispatched
 * hops the run may add (waits for a window, 15-minute reads inside one). Returns { ok, at, repo } or { ok: false, skipped | error }.
 */
export async function dispatchLinesWorkflow({ date, due = null, chain = 40, fetchImpl = globalThis.fetch, env = process.env } = {}) {
  if (!githubDispatchConfigured(env)) return { ok: false, skipped: 'GITHUB_DISPATCH_TOKEN is not configured on the server' };
  const repo = githubRepo(env);
  const inputs = { date: date || '', due: due ? String(due) : '', chain: String(chain) };
  let res;
  try {
    res = await fetchImpl(`${API}/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'nhl-model (+https://ideareels.io)',
      },
      body: JSON.stringify({ ref: env.GITHUB_DISPATCH_REF || 'main', inputs }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    return { ok: false, error: `GitHub unreachable: ${err?.message || err}` };
  }
  if (res.status === 204) return { ok: true, at: new Date().toISOString(), repo, inputs };
  const body = await res.text().catch(() => '');
  let detail = body;
  try { detail = JSON.parse(body)?.message || body; } catch { /* plain text */ }
  return { ok: false, error: `GitHub answered ${res.status}${detail ? `: ${String(detail).slice(0, 160)}` : ''}` };
}
