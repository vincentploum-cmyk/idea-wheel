// Matchup finder for one slate date: every skater dressing tonight, with what
// the opposing defense allows to their (frozen) position at that venue, and a
// simple edge for shots and goals. Descriptive only — the model's own math is
// untouched and lives in the Best bets tab.
import { readJson } from '../nhl-store';
import { loadRows } from './build';
import { defenseByPosition, playerBaselines, DEF_POS } from './defense';
import { positionsPath } from './positions';
import { lineupsPath } from './ingest';
import { fetchSchedule } from './api';
import { loadPlayers } from './rosters';
import { normName } from './names';
import { loadMoneyPuck } from './moneypuck';

const r2 = (v) => +v.toFixed(2);
const pct = (v) => Math.round(v * 100);

/** Games on a date: the frozen snapshot if we have one, else the live schedule. */
async function gamesFor(date) {
  const snap = await readJson(positionsPath(date));
  if (snap?.games && Object.keys(snap.games).length) {
    return Object.entries(snap.games).map(([id, g]) => ({ id: Number(id), ...g }));
  }
  const lineups = await readJson(lineupsPath(date));
  if (lineups?.games?.length) return lineups.games.map((g) => ({ id: g.gameId, away: g.away, home: g.home, teams: null }));
  const schedule = await fetchSchedule(date, { quick: true }).catch(() => []);
  return schedule.map((g) => ({ id: g.id, away: g.away, home: g.home, startTimeUTC: g.startTimeUTC, teams: null }));
}

/** Edge of a defense vs the league for one position/venue/metric, as a ratio (1.10 = allows 10% more). */
function edge(defense, opp, venue, pos, metric) {
  const t = defense.teams[opp]?.[venue]?.[pos];
  const lg = defense.league[venue]?.[pos]?.[metric];
  if (!t || !t.gp || !lg) return null;
  return { allowed: t[metric], league: lg, ratio: r2(t[metric] / lg), rank: defense.ranks[opp]?.[venue]?.[pos]?.[metric] ?? null, gp: t.gp };
}

export function scoreSkater(base, venue, oppSog, oppG, oppScf) {
  // Player's own rate at this venue (falls back to all games when thin), times the defense ratio.
  const own = base?.[venue]?.gp >= 5 ? base[venue] : base?.all;
  if (!own?.gp) return null;
  const projSog = r2(own.sog * (oppSog?.ratio ?? 1));
  const projG = r2(own.g * (oppG?.ratio ?? 1));
  return {
    gp: own.gp, sog: own.sog, g: own.g, iscf: own.iscf, toi: own.toi,
    l5Sog: base.l5?.sog ?? null,
    form: base.form || null,
    hit: base.hit,
    projSog, projG,
    shotEdge: oppSog ? pct(oppSog.ratio - 1) : null,
    goalEdge: oppG ? pct(oppG.ratio - 1) : null,
    chanceEdge: oppScf ? pct(oppScf.ratio - 1) : null,
    // Ranking keys: volume × matchup.
    shotScore: r2(projSog * (1 + (oppScf ? (oppScf.ratio - 1) / 4 : 0))),
    goalScore: r2(projG * (1 + (oppScf ? (oppScf.ratio - 1) / 2 : 0))),
  };
}

export async function buildSlate(date, { window = 20, lastN = 10 } = {}) {
  const [games, rows, ref, mp] = await Promise.all([gamesFor(date), loadRows(date), loadPlayers(), loadMoneyPuck().catch(() => ({ teams: null, games: null }))]);
  const season = defenseByPosition(rows);
  const recent = defenseByPosition(rows, { lastN });
  const baselines = playerBaselines(rows, { window });
  const rosterByTeam = {};
  for (const p of Object.values(ref.players)) {
    if (!p.onRoster || p.excluded || !p.team) continue;
    (rosterByTeam[p.team] = rosterByTeam[p.team] || {})[normName(p.name)] = p;
  }
  const idByName = {};
  for (const [id, b] of Object.entries(baselines)) idByName[`${b.team}|${normName(b.name)}`] = Number(id);

  const out = games.map((g) => {
    const sides = [[g.away, g.home, 'A'], [g.home, g.away, 'H']].map(([team, opp, venue]) => {
      const defVenue = venue === 'A' ? 'H' : 'A';
      const snap = g.teams?.[team];
      const players = snap?.players || Object.fromEntries(Object.entries(rosterByTeam[team] || {}).map(([k, p]) => [k, { name: p.name, id: p.id, pos: p.pos, line: null, team, inLineup: false }]));
      const skaters = Object.values(players)
        .filter((p) => DEF_POS.includes(p.pos))
        .map((p) => {
          const id = p.id ?? rosterByTeam[team]?.[normName(p.name)]?.id ?? idByName[`${team}|${normName(p.name)}`] ?? null;
          const base = id != null ? baselines[id] : null;
          const oppSog = edge(season, opp, defVenue, p.pos, 'sog');
          const oppG = edge(season, opp, defVenue, p.pos, 'g');
          const oppScf = edge(season, opp, defVenue, p.pos, 'iscf');
          const oppSogL10 = edge(recent, opp, 'ALL', p.pos, 'sog');
          return {
            id, name: p.name, team, opp, venue, pos: p.pos, line: p.line ?? null, inLineup: p.inLineup !== false,
            vs: { sog: oppSog, g: oppG, iscf: oppScf, sogL10: oppSogL10 },
            ...(scoreSkater(base, venue, oppSog, oppG, oppScf) || { gp: 0 }),
          };
        })
        .sort((a, b) => (b.shotScore || 0) - (a.shotScore || 0));
      // The defense card: what `opp` allows at `defVenue` to each position.
      const defense = Object.fromEntries([...DEF_POS, 'All'].map((pos) => [pos, {
        season: season.teams[opp]?.[defVenue]?.[pos] || null,
        rank: season.ranks[opp]?.[defVenue]?.[pos] || null,
        l10: recent.teams[opp]?.ALL?.[pos] || null,
        l10Rank: recent.ranks[opp]?.ALL?.[pos] || null,
      }]));
      return { team, opp, venue, source: snap?.source || 'roster', frozen: !!g.frozen, skaters, defense };
    });
    return { id: g.id, away: g.away, home: g.home, startTimeUTC: g.startTimeUTC || null, frozen: !!g.frozen, capturedAt: g.capturedAt || null, sides };
  });

  const all = out.flatMap((g) => g.sides.flatMap((s) => s.skaters.filter((p) => p.gp >= 5 && p.inLineup)));
  return {
    date,
    games: out,
    league: season.league,
    teamCount: season.teamCount,
    gamesStored: rows.length ? new Set(rows.map((r) => r.gameId)).size : 0,
    moneypuck: mp.teams ? { updatedAt: mp.teams.updatedAt, year: mp.teams.year, situations: mp.teams.situations, ranks: mp.teams.ranks, byVenue: mp.games?.byVenue || null, venueRanks: mp.games?.ranks || null } : null,
    top: {
      shots: [...all].sort((a, b) => b.shotScore - a.shotScore).slice(0, 15),
      goals: [...all].sort((a, b) => b.goalScore - a.goalScore).slice(0, 15),
    },
  };
}
