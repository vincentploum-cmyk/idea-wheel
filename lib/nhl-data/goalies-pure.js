// Goalies: the saves a team's goalie makes, from the stored box scores. The game records have carried
// every goalie's line since the first ingest (lib/nhl-data/game.js: shots against, saves, goals
// against, the starter flag, the decision); this module indexes them per season (the rows file
// lib/nhl-data/goalies.js writes), reads each team's goalies and its likely starter tonight, and
// projects the saves — the shots the opponent is expected to put on him × his save percentage —
// with the chance of 25 / 30 / 35 saves for the Best bets Saves table. Vincent, 2026-10-31: "record
// the saves as part of the box scores … they should be listed as a best bet if it's applicable".
// Pure: no store import (the Best bets panel reads the rows this builds).
import { seasonYearOf } from './picks-pure';

export const GOALIE_ROW_FIELDS = ['date', 'gameId', 'playerId', 'name', 'team', 'opp', 'venue', 'toi', 'sa', 'ga', 'sv', 'starter', 'decision'];
export const goalieRowsPath = (season) => `data/goalie-rows/${season}.json`;
/** The league's save percentage a goalie's own is shrunk toward, and the shots behind it before his own leads. */
export const LEAGUE_SV = 0.9;
export const SV_K = 150;
/** The spread of a goalie's saves around the projection (the shots he faces swing by about six a night). */
export const SAVES_SD = 6;
/** The Saves table's marks (the chance of 25+, 30+, 35+ saves) and the one a play is called on. */
export const SAVES_MARKS = [25, 30, 35];
export const SAVES_LEAD = 30;
/** A goalie is a saves play from this chance of SAVES_LEAD saves. */
export const SAVES_FLOOR = 0.5;
/** The team's recent games the likely starter is read from. */
export const STARTER_WINDOW = 10;

/** A game record's goalies as rows (GOALIE_ROW_FIELDS order), the opponent from the other side. */
export function goalieRowsOf(game) {
  const opp = (team) => (team === game.away?.abbrev ? game.home?.abbrev : game.away?.abbrev) || null;
  return (game.goalies || []).map((g) => [game.date, game.id, g.id, g.name, g.team, opp(g.team), g.venue, g.toi ?? 0, g.sa ?? 0, g.ga ?? 0, g.sv ?? 0, g.starter ? 1 : 0, g.decision || null]);
}

/** A row as an object. */
export function goalieRowObj(r) {
  const o = {};
  GOALIE_ROW_FIELDS.forEach((k, i) => { o[k] = r[i]; });
  return o;
}

const r3 = (v) => +Number(v).toFixed(3);
const r1 = (v) => +Number(v).toFixed(1);
const sum = (list, k) => list.reduce((s, r) => s + (Number(r[k]) || 0), 0);

/** A goalie's save percentage, his own shrunk toward the league's at shots / (shots + SV_K). */
export const shrunkSv = (sv, sa, league = LEAGUE_SV) => (sa > 0 ? r3((sv + league * SV_K) / (sa + SV_K)) : league);

/**
 * Every team's goalies this season from the rows (objects), the games before `through` (the slate
 * date: a stored game of the same date is tonight's, not a prior): { teams: { ABBR: { goalies: [...],
 * lastGame, games } }, league: { sv, sa, pct } }. Each goalie: id, name, team, gp (appearances), starts,
 * sa, sv, ga, pct (raw), svPct (shrunk), savesPerStart, last (his last appearance), lastStart, l5
 * (his last five starts' saves and shots), startsRecent (starts in the team's last STARTER_WINDOW games).
 * Last season's rows stand in for a team without a game this season (`held`).
 */
export function goalieBook(rows, season, { through = null } = {}) {
  const inSeason = (y) => rows.filter((r) => seasonYearOf(r.date) === y && (!through || r.date < through));
  let use = inSeason(season); let held = false;
  const byTeamCur = new Set(use.map((r) => r.team));
  const prevRows = inSeason(season - 1);
  // A team without a game yet reads last season's goalies.
  const prevTeams = new Set(prevRows.map((r) => r.team).filter((t) => !byTeamCur.has(t)));
  if (prevTeams.size) { use = [...use, ...prevRows.filter((r) => prevTeams.has(r.team))]; held = true; }
  const league = { sv: sum(inSeason(season), 'sv'), sa: sum(inSeason(season), 'sa') };
  const leaguePct = league.sa >= 2000 ? r3(league.sv / league.sa) : LEAGUE_SV;
  const teams = {};
  for (const r of use) {
    const t = (teams[r.team] ||= { team: r.team, games: new Map(), goalies: {}, held: prevTeams.has(r.team) });
    const g = t.games.get(r.gameId) || { gameId: r.gameId, date: r.date, starter: null };
    if (Number(r.starter) === 1) g.starter = r.playerId;
    t.games.set(r.gameId, g);
    const k = (t.goalies[r.playerId] ||= { id: r.playerId, name: r.name, team: r.team, rows: [] });
    k.rows.push(r);
  }
  const out = {};
  for (const [abbr, t] of Object.entries(teams)) {
    const games = [...t.games.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.gameId - b.gameId));
    const recent = games.slice(-STARTER_WINDOW);
    const goalies = Object.values(t.goalies).map((k) => {
      const played = k.rows.filter((r) => Number(r.toi) > 0 || Number(r.sa) > 0).sort((a, b) => (a.date < b.date ? -1 : 1));
      const starts = k.rows.filter((r) => Number(r.starter) === 1).sort((a, b) => (a.date < b.date ? -1 : 1));
      const sa = sum(played, 'sa'); const sv = sum(played, 'sv'); const ga = sum(played, 'ga');
      const l5 = starts.slice(-5);
      return {
        id: k.id, name: k.name, team: abbr, gp: played.length, starts: starts.length, sa, sv, ga,
        pct: sa > 0 ? r3(sv / sa) : null, svPct: shrunkSv(sv, sa, leaguePct),
        savesPerStart: starts.length ? r1(sum(starts, 'sv') / starts.length) : null,
        last: played.length ? played[played.length - 1].date : null, lastStart: starts.length ? starts[starts.length - 1].date : null,
        l5: l5.length ? { starts: l5.length, sv: r1(sum(l5, 'sv') / l5.length), sa: r1(sum(l5, 'sa') / l5.length), pct: sum(l5, 'sa') > 0 ? r3(sum(l5, 'sv') / sum(l5, 'sa')) : null } : null,
        startsRecent: recent.filter((g) => g.starter === k.id).length,
      };
    }).sort((a, b) => b.starts - a.starts || b.gp - a.gp);
    out[abbr] = { team: abbr, goalies, games: games.length, lastGame: games.length ? games[games.length - 1].date : null, lastStarter: games.length ? games[games.length - 1].starter : null, held: t.held };
  }
  return { teams: out, league: { ...league, pct: leaguePct }, season, held };
}

const dayBefore = (date) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

/**
 * The goalie likely in net for `team` on `date`: the one with the most starts in the team's last
 * STARTER_WINDOW games; on the second night of a back-to-back, when he started last night and the
 * team has another goalie who has started this season, the other. { goalie, reason, b2b, other }
 * or null without goalies.
 */
export function likelyStarter(book, team, date) {
  const t = book?.teams?.[team];
  if (!t?.goalies?.length) return null;
  const byRecent = [...t.goalies].sort((a, b) => b.startsRecent - a.startsRecent || b.starts - a.starts);
  let goalie = byRecent[0];
  const other = byRecent.find((g) => g.id !== goalie.id && g.starts > 0) || null;
  const b2b = !!t.lastGame && t.lastGame === dayBefore(date);
  let reason = `${goalie.startsRecent} of the team's last ${Math.min(STARTER_WINDOW, t.games)} starts`;
  if (b2b && t.lastStarter === goalie.id && other) { goalie = other; reason = `back to back: ${byRecent[0].name.split(' ').slice(-1)[0]} started last night`; }
  else if (b2b && t.lastStarter === goalie.id) reason += ' · back to back, no other starter on record';
  return { goalie, reason, b2b, other: other && other.id !== goalie.id ? other : byRecent[0].id !== goalie.id ? byRecent[0] : null, held: !!t.held };
}

/** Φ, the standard normal CDF, through erf (Abramowitz–Stegun 7.1.26, good to 1.5e-7). */
export function normalCdf(z) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return 0.5 * (1 + (z >= 0 ? erf : -erf));
}

/** The chance of `k` saves or more around a projection of `lam`, a normal with SAVES_SD × the save percentage (the shots swing, the saves with them). */
export function savesChance(lam, k, svPct = LEAGUE_SV) {
  const sd = Math.max(2, SAVES_SD * (svPct || LEAGUE_SV));
  return +Math.max(0, Math.min(1, 1 - normalCdf((k - 0.5 - lam) / sd))).toFixed(3);
}

/**
 * One goalie's row for the Saves table: the shots he is expected to face (`shots`), his save
 * percentage, the projected saves and the chance of each mark. `shotsFrom` names the shots read.
 */
export function savesRow({ team, opp, venue, starter, shots, shotsFrom }) {
  if (!starter?.goalie || shots == null) return null;
  const g = starter.goalie;
  const lam = r1(shots * g.svPct);
  const p = Object.fromEntries(SAVES_MARKS.map((k) => [`p${k}`, savesChance(lam, k, g.svPct)]));
  return {
    id: g.id, name: g.name, team, opp, venue, pos: 'G',
    starter: 'likely', reason: starter.reason, b2b: starter.b2b, other: starter.other ? { id: starter.other.id, name: starter.other.name, starts: starter.other.starts } : null,
    starts: g.starts, gp: g.gp, pct: g.pct, svPct: g.svPct, savesPerStart: g.savesPerStart, l5: g.l5, held: !!starter.held,
    shots: r1(shots), shotsFrom, lam, ...p,
  };
}

/** The Saves table of a game: the rows by the projection, a row under SAVES_FLOOR at SAVES_LEAD marked `under`. */
export function pickSaves(rows) {
  return rows.filter(Boolean).sort((a, b) => b.lam - a.lam).map((r) => ({ ...r, under: r[`p${SAVES_LEAD}`] < SAVES_FLOOR }));
}

/**
 * A finished game grades the rows: the goalie's own line from the stored game's goalies as `actual`
 * ({ sv, sa, ga, starter }); when another goalie started, `actual` is his line with `played: false` on
 * the row and `startedBy` his name, so the table says the read was on the wrong man.
 */
export function withSavesActuals(rows, goalies) {
  if (!goalies) return rows;
  return rows.map((r) => {
    const own = goalies.find((g) => g.id === r.id);
    if (own && (own.sa > 0 || own.starter)) return { ...r, actual: { sv: own.sv, sa: own.sa, ga: own.ga, starter: !!own.starter } };
    const who = goalies.find((g) => g.team === r.team && g.starter) || goalies.filter((g) => g.team === r.team).sort((a, b) => b.sa - a.sa)[0] || null;
    return { ...r, actual: who ? { sv: who.sv, sa: who.sa, ga: who.ga, starter: !!who.starter } : null, played: false, startedBy: who?.name || null };
  });
}
