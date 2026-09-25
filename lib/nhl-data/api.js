// Thin clients for the free public NHL endpoints the automation uses.
const WEB = 'https://api-web.nhle.com/v1';
const FORGE = 'https://forge-dapi.d3.nhle.com/v2/content/en-us';
const UA = { 'User-Agent': 'Mozilla/5.0 (nhl-model; +https://ideareels.io)', Accept: 'application/json' };

async function getJson(url, { tries = 3, timeoutMs = 8000 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA, cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastErr;
}

const scheduleMemo = new Map(); // date → { at, day }
const SCHEDULE_MEMO_MS = 10 * 60 * 1000;

/** Games scheduled on one date (YYYY-MM-DD); regular season + playoffs by default (1 = preseason).
 *  `quick` answers from a 10-minute memo and gives up fast, for request paths a page load waits on. */
export async function fetchSchedule(date, { types = [2, 3], quick = false } = {}) {
  const hit = scheduleMemo.get(date);
  let j;
  if (hit && Date.now() - hit.at < SCHEDULE_MEMO_MS) j = hit.day;
  else {
    j = await getJson(`${WEB}/schedule/${date}`, quick ? { tries: 1, timeoutMs: 3000 } : {});
    scheduleMemo.set(date, { at: Date.now(), day: j });
  }
  const day = (j?.gameWeek || []).find((d) => d.date === date);
  return (day?.games || [])
    .filter((g) => types.includes(g.gameType))
    .map((g) => ({
      id: g.id,
      season: g.season,
      gameType: g.gameType,
      date,
      startTimeUTC: g.startTimeUTC,
      state: g.gameState, // FUT, PRE, LIVE, CRIT, FINAL, OFF
      away: g.awayTeam?.abbrev,
      home: g.homeTeam?.abbrev,
    }));
}

export const isFinal = (state) => state === 'OFF' || state === 'FINAL';

/** League standings (all teams, with conference/division and splits). */
export const fetchStandings = () => getJson(`${WEB}/standings/now`);

/** Scoring leaders: { points: [...], goals: [...], assists: [...] }. */
export const fetchLeaders = (categories = ['points', 'goals', 'assists'], limit = 30) =>
  getJson(`${WEB}/skater-stats-leaders/current?categories=${categories.join(',')}&limit=${limit}`);

export const fetchBoxscore = (id) => getJson(`${WEB}/gamecenter/${id}/boxscore`);
export const fetchPlayByPlay = (id) => getJson(`${WEB}/gamecenter/${id}/play-by-play`);

/** NHL.com game preview story (holds the projected lineups). */
export async function fetchPreview(gameId) {
  const list = await getJson(`${FORGE}/stories?tags.slug=gameid-${gameId}&$limit=20`);
  const item = (list?.items || []).find((i) => /game-preview/.test(i.slug || ''));
  if (!item) return null;
  const story = await getJson(`${FORGE}/stories/${item.slug}`);
  if (!story) return null;
  const markdown = (story.parts || [])
    .filter((p) => p.type === 'markdown' && typeof p.content === 'string')
    .map((p) => p.content)
    .join('\n\n');
  return { slug: item.slug, title: story.title, updated: story.lastUpdatedDate || story.contentDate, markdown };
}
