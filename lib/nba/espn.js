// ESPN's public NBA feeds: a date's schedule with scores, and the finished games' box scores
// the board grades its picks against. Pure parsing is separate from the fetches.
import { getJson } from '../picks/http';
import { teamAbbrFromText } from './teams';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

/** The season a date belongs to, as its start year (2026 for 2026-27; ESPN labels that season 2027). */
export function seasonOfDate(date) {
  const [y, m] = String(date).split('-').map(Number);
  return m >= 9 ? y : y - 1;
}

/** The date's games from a scoreboard payload: [{ id, date, away, home, state, final, awayScore, homeScore, detail, odds, preseason }]. */
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
      preseason: e.season?.type === 1 || undefined,
    });
  }
  games.sort((x, y) => String(x.date).localeCompare(String(y.date)) || x.away.localeCompare(y.away));
  return { games, seasonYear: j?.season?.year ?? j?.events?.[0]?.season?.year ?? null };
}

/** The games of one ET date. */
export async function fetchDay(date) {
  const j = await getJson(`${SITE}/scoreboard?dates=${String(date).replace(/-/g, '')}&limit=50`);
  if (!j) return null;
  return { ...parseScoreboard(j), fetchedAt: new Date().toISOString() };
}

const n = (v) => { const x = Number(String(v ?? '').split('-')[0]); return Number.isFinite(x) ? x : 0; };
const dash = (v, i) => { const parts = String(v ?? '').split('-'); const x = Number(parts[i]); return Number.isFinite(x) ? x : 0; };

/** The combined stats a line settles: pra, pr, pa, ra, stocks, double-double, triple-double. */
export function derived(p) {
  const tens = [p.pts, p.reb, p.ast, p.stl, p.blk].filter((v) => v >= 10).length;
  return { ...p, pra: p.pts + p.reb + p.ast, pr: p.pts + p.reb, pa: p.pts + p.ast, ra: p.reb + p.ast, stlBlk: p.stl + p.blk, dd: tens >= 2 ? 1 : 0, td3: tens >= 3 ? 1 : 0 };
}

/**
 * A finished game's player lines from its summary: { id, away, home, final, awayScore, homeScore,
 * players: [{ espnId, name, team, pos, played, min, pts, reb, ast, tpm, tpa, fgm, fga, ftm, fta, stl, blk, tov,
 * oreb, dreb, pf, pra, pr, pa, ra, stlBlk, dd, td3 }] }. A player who did not play keeps played: false.
 */
export function parseSummary(j) {
  const comp = j?.header?.competitions?.[0];
  const sides = comp?.competitors || [];
  const side = (ha) => sides.find((c) => c.homeAway === ha);
  const away = teamAbbrFromText(side('away')?.team?.abbreviation); const home = teamAbbrFromText(side('home')?.team?.abbreviation);
  const st = comp?.status?.type || {};
  const players = [];
  for (const t of j?.boxscore?.players || []) {
    const team = teamAbbrFromText(t.team?.abbreviation);
    for (const s of t.statistics || []) {
      const keys = s.keys || [];
      const at = (stats, key) => { const i = keys.indexOf(key); return i >= 0 ? stats[i] : undefined; };
      for (const a of s.athletes || []) {
        const v = a.stats || [];
        const played = !a.didNotPlay && v.length > 0;
        const base = {
          espnId: a.athlete?.id ? String(a.athlete.id) : null, name: a.athlete?.displayName || '', team, pos: a.athlete?.position?.abbreviation || null, played, starter: !!a.starter,
          min: n(at(v, 'minutes')), pts: n(at(v, 'points')), reb: n(at(v, 'rebounds')), ast: n(at(v, 'assists')),
          fgm: dash(at(v, 'fieldGoalsMade-fieldGoalsAttempted'), 0), fga: dash(at(v, 'fieldGoalsMade-fieldGoalsAttempted'), 1),
          tpm: dash(at(v, 'threePointFieldGoalsMade-threePointFieldGoalsAttempted'), 0), tpa: dash(at(v, 'threePointFieldGoalsMade-threePointFieldGoalsAttempted'), 1),
          ftm: dash(at(v, 'freeThrowsMade-freeThrowsAttempted'), 0), fta: dash(at(v, 'freeThrowsMade-freeThrowsAttempted'), 1),
          stl: n(at(v, 'steals')), blk: n(at(v, 'blocks')), tov: n(at(v, 'turnovers')), oreb: n(at(v, 'offensiveRebounds')), dreb: n(at(v, 'defensiveRebounds')), pf: n(at(v, 'fouls')),
        };
        players.push(derived(base));
      }
    }
  }
  return {
    id: String(j?.header?.id || ''), away, home, final: !!st.completed, state: st.state || null, detail: st.shortDetail || st.detail || '',
    awayScore: Number(side('away')?.score ?? 0), homeScore: Number(side('home')?.score ?? 0), players,
    opening: parseOpening(j),
  };
}

/** The player a play's text names: "Davion Mitchell makes two point shot (…)" → Davion Mitchell. */
const actorOf = (text) => { const m = String(text || '').match(/^(.+?)\s+(makes|misses|vs\.|defensive|offensive|shooting|personal|turnover|bad pass|lost ball|traveling|blocks|steals)/i); return m ? m[1].trim() : null; };

/**
 * The opening of the game from ESPN's plays (First Basket, Vincent's ask of 2026-10-27): the tip
 * (the two jumpers and who gained possession, by team), the first basket (the first field goal:
 * scorer, team, 2 or 3 points), the first points (a free throw counts), and each team's first shot
 * (who took it, made or missed). Null without plays (a summary fetched before tip-off, or an old
 * stored one: the tab's backfill reads the summary again). Ids are ESPN's.
 */
export function parseOpening(j) {
  const plays = Array.isArray(j?.plays) ? j.plays : null;
  if (!plays?.length) return null;
  const abbrOf = {};
  for (const c of j?.header?.competitions?.[0]?.competitors || []) if (c.team?.id) abbrOf[String(c.team.id)] = teamAbbrFromText(c.team.abbreviation);
  const team = (p) => (p?.team?.id != null ? abbrOf[String(p.team.id)] || null : null);
  // The box score names every id: a play's participants are not in the text's order (the jump ball
  // lists the home jumper first whatever the text says, seen 2026-10-26), so names come by id.
  const nameOf = {};
  for (const t of j?.boxscore?.players || []) for (const s of t.statistics || []) for (const a of s.athletes || []) if (a.athlete?.id) nameOf[String(a.athlete.id)] = a.athlete.displayName || null;
  const who = (p, i = 0) => { const id = p?.participants?.[i]?.athlete?.id != null ? String(p.participants[i].athlete.id) : null; return { espnId: id, name: (id && nameOf[id]) || (i === 0 ? actorOf(p?.text) : null) }; };
  const clock = (p) => p?.clock?.displayValue || null;
  const out = { tip: null, firstBasket: null, firstPoints: null, firstShot: {} };
  for (const p of plays) {
    if (p?.period?.number != null && p.period.number !== 1) break;
    const type = String(p?.type?.text || '');
    if (!out.tip && /jump ?ball/i.test(type)) {
      const m = String(p.text || '').match(/^(.+?)\s+vs\.?\s+(.+?)\s*\((.+?)\s+gains possession\)/i);
      const j0 = who(p, 0); const j1 = who(p, 1); const j2 = who(p, 2);
      out.tip = { team: team(p), jumpers: [{ espnId: j0.espnId, name: j0.name || m?.[1] || null }, { espnId: j1.espnId, name: j1.name || m?.[2] || null }], possession: { espnId: j2.espnId, name: j2.name || m?.[3] || null }, clock: clock(p) };
      continue;
    }
    const t = team(p);
    if (p?.shootingPlay && t && !out.firstShot[t]) out.firstShot[t] = { ...who(p), team: t, made: !!p.scoringPlay && Number(p.scoreValue) >= 2, clock: clock(p) };
    if (p?.scoringPlay) {
      const v = Number(p.scoreValue) || 0;
      if (!out.firstPoints) out.firstPoints = { ...who(p), team: t, kind: v >= 2 ? `${v}` : 'FT', clock: clock(p) };
      if (v >= 2 && !out.firstBasket) out.firstBasket = { ...who(p), team: t, kind: `${v}`, assist: p.participants?.[1]?.athlete?.id != null ? String(p.participants[1].athlete.id) : null, clock: clock(p) };
    }
    if (out.tip && out.firstBasket && out.firstPoints && Object.keys(out.firstShot).length >= 2) break;
  }
  return out;
}

export async function fetchSummary(eventId) {
  const j = await getJson(`${SITE}/summary?event=${encodeURIComponent(eventId)}`);
  return j ? parseSummary(j) : null;
}

/** ESPN's headshot for a player id (the box score gives the ids). */
export const headshotUrl = (espnId) => (espnId ? `https://a.espncdn.com/i/headshots/nba/players/full/${espnId}.png` : '');
