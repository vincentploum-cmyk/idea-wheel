// Thin clients for the free public NHL endpoints the automation uses.
const WEB = 'https://api-web.nhle.com/v1';
const FORGE = 'https://forge-dapi.d3.nhle.com/v2/content/en-us';
const UA = { 'User-Agent': 'Mozilla/5.0 (nhl-model; +https://ideareels.io)', Accept: 'application/json' };

async function getJson(url, { tries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA, cache: 'no-store' });
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

/** Games scheduled on one date (YYYY-MM-DD), regular season + playoffs only. */
export async function fetchSchedule(date) {
  const j = await getJson(`${WEB}/schedule/${date}`);
  const day = (j?.gameWeek || []).find((d) => d.date === date);
  return (day?.games || [])
    .filter((g) => g.gameType === 2 || g.gameType === 3)
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
