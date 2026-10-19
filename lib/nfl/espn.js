// ESPN's public NFL feeds: the week's schedule with scores, and the finished games' box
// scores the board grades its picks against. Pure parsing is separate from the fetches.
import { calendarWindows } from './week';
import { teamAbbrFromText } from './teams';
import { getJson } from '../picks/http';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

/** The week's games from a scoreboard payload: [{ id, date, away, home, state, final, awayScore, homeScore, detail, odds }]. */
export function parseScoreboard(j) {
  const games = [];
  for (const e of j?.events || []) {
    const comp = e.competitions?.[0];
    if (!comp) continue;
    const side = (ha) => comp.competitors?.find((c) => c.homeAway === ha);
    const away = side('away'); const home = side('home');
    const a = teamAbbrFromText(away?.team?.abbreviation) || teamAbbrFromText(away?.team?.displayName);
    const h = teamAbbrFromText(home?.team?.abbreviation) || teamAbbrFromText(home?.team?.displayName);
    if (!a || !h) continue;
    const st = e.status?.type || comp.status?.type || {};
    const odds = comp.odds?.[0];
    games.push({
      id: String(e.id), date: e.date, away: a, home: h,
      state: st.state || 'pre', final: !!st.completed, detail: st.shortDetail || st.detail || '',
      awayScore: st.state === 'pre' ? null : Number(away?.score ?? 0), homeScore: st.state === 'pre' ? null : Number(home?.score ?? 0),
      odds: odds ? { spread: odds.details || null, total: odds.overUnder ?? null } : null,
    });
  }
  games.sort((x, y) => String(x.date).localeCompare(String(y.date)) || x.away.localeCompare(y.away));
  return {
    season: j?.season?.year ?? null, type: j?.season?.type ?? null, week: j?.week?.number ?? null,
    byes: (j?.week?.teamsOnBye || []).map((t) => teamAbbrFromText(t.abbreviation)).filter(Boolean),
    games,
  };
}

/** Schedule + scores of one week (seasontype 2 regular, 3 postseason), with the season calendar. */
export async function fetchWeek(season, week, type = 2) {
  const j = await getJson(`${SITE}/scoreboard?week=${week}&seasontype=${type}&year=${season}&limit=100`);
  if (!j) return null;
  return { ...parseScoreboard(j), calendar: calendarWindows(j.leagues?.[0]?.calendar, season), fetchedAt: new Date().toISOString() };
}

/** Today's scoreboard (what ESPN thinks the current week is). */
export async function fetchCurrentWeek() {
  const j = await getJson(`${SITE}/scoreboard?limit=100`);
  if (!j) return null;
  return { ...parseScoreboard(j), calendar: calendarWindows(j.leagues?.[0]?.calendar, j?.season?.year), fetchedAt: new Date().toISOString() };
}

const n = (v) => { const x = Number(String(v ?? '').split('/')[0]); return Number.isFinite(x) ? x : 0; };
const slash = (v, i) => { const parts = String(v ?? '').split('/'); const x = Number(parts[i]); return Number.isFinite(x) ? x : 0; };

/** The scorer of a touchdown play's text: "J.K. Dobbins 4 Yd Rush (Wil Lutz Kick)" → "J.K. Dobbins". */
export function tdScorer(text) {
  const m = String(text || '').match(/^(.+?)\s+\d+\s*Yd\b/i);
  if (m) return m[1].trim();
  const m2 = String(text || '').match(/^(.+?)\s+(?:Rush|Pass|Run|Reception|Return|Fumble|Interception)/i);
  return m2 ? m2[1].trim() : null;
}

/**
 * A finished game's player lines from its summary: { id, final, away, home, awayScore, homeScore,
 * players: [{ espnId, name, team, passCmp, passAtt, passYds, passTd, passInt, passLong?, rushAtt, rushYds, rushTd,
 * rushLong, rec, recYds, recTd, recLong, tgt, retTd, td, firstTd }], firstTd: { name, team } }.
 * Touchdowns are read from the box score (rushing + receiving + return) with the scoring plays'
 * order giving the game's first scorer.
 */
export function parseSummary(j) {
  const comp = j?.header?.competitions?.[0];
  const sides = comp?.competitors || [];
  const side = (ha) => sides.find((c) => c.homeAway === ha);
  const away = teamAbbrFromText(side('away')?.team?.abbreviation); const home = teamAbbrFromText(side('home')?.team?.abbreviation);
  const st = comp?.status?.type || {};
  const byId = new Map();
  const get = (team, a) => {
    const key = String(a.athlete?.id || a.athlete?.displayName);
    if (!byId.has(key)) byId.set(key, { espnId: a.athlete?.id ? String(a.athlete.id) : null, name: a.athlete?.displayName || '', team, pos: a.athlete?.position?.abbreviation || null, passCmp: 0, passAtt: 0, passYds: 0, passTd: 0, passInt: 0, rushAtt: 0, rushYds: 0, rushTd: 0, rushLong: 0, rec: 0, recYds: 0, recTd: 0, recLong: 0, tgt: 0, retTd: 0, played: true });
    return byId.get(key);
  };
  for (const t of j?.boxscore?.players || []) {
    const team = teamAbbrFromText(t.team?.abbreviation);
    for (const s of t.statistics || []) {
      const keys = s.keys || [];
      const at = (stats, key) => { const i = keys.indexOf(key); return i >= 0 ? stats[i] : undefined; };
      for (const a of s.athletes || []) {
        const p = get(team, a);
        const v = a.stats || [];
        if (s.name === 'passing') {
          p.passCmp = slash(at(v, 'completions/passingAttempts'), 0); p.passAtt = slash(at(v, 'completions/passingAttempts'), 1);
          p.passYds = n(at(v, 'passingYards')); p.passTd = n(at(v, 'passingTouchdowns')); p.passInt = n(at(v, 'interceptions'));
        } else if (s.name === 'rushing') {
          p.rushAtt = n(at(v, 'rushingAttempts')); p.rushYds = n(at(v, 'rushingYards')); p.rushTd = n(at(v, 'rushingTouchdowns')); p.rushLong = n(at(v, 'longRushing'));
        } else if (s.name === 'receiving') {
          p.rec = n(at(v, 'receptions')); p.recYds = n(at(v, 'receivingYards')); p.recTd = n(at(v, 'receivingTouchdowns')); p.recLong = n(at(v, 'longReception')); p.tgt = n(at(v, 'receivingTargets'));
        } else if (s.name === 'kickReturns') p.retTd += n(at(v, 'kickReturnTouchdowns'));
        else if (s.name === 'puntReturns') p.retTd += n(at(v, 'puntReturnTouchdowns'));
        else if (s.name === 'defensive') p.retTd += n(at(v, 'defensiveTouchdowns'));
        else if (s.name === 'interceptions') p.retTd += n(at(v, 'interceptionTouchdowns'));
      }
    }
  }
  const players = [...byId.values()].map((p) => ({ ...p, td: p.rushTd + p.recTd + p.retTd, rushRecYds: p.rushYds + p.recYds, passRushYds: p.passYds + p.rushYds, firstTd: 0 }));
  let firstTd = null;
  for (const play of j?.scoringPlays || []) {
    if ((play.type?.abbreviation || play.scoringType?.abbreviation) !== 'TD') continue;
    const name = tdScorer(play.text);
    if (!name) continue;
    firstTd = { name, team: teamAbbrFromText(play.team?.abbreviation) };
    const hit = players.find((p) => p.name === name && p.team === firstTd.team) || players.find((p) => p.name === name);
    if (hit) hit.firstTd = 1;
    break;
  }
  return {
    id: String(j?.header?.id || ''), away, home, final: !!st.completed, state: st.state || null, detail: st.shortDetail || st.detail || '',
    awayScore: Number(side('away')?.score ?? 0), homeScore: Number(side('home')?.score ?? 0), players, firstTd,
  };
}

export async function fetchSummary(eventId) {
  const j = await getJson(`${SITE}/summary?event=${encodeURIComponent(eventId)}`);
  return j ? parseSummary(j) : null;
}

/** ESPN's headshot for a player id (the box score gives the ids). */
export const headshotUrl = (espnId) => (espnId ? `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png` : '');
