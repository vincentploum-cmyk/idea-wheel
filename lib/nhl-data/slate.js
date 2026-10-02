// Matchup finder for one slate date: every skater dressing tonight, with what
// the opposing defense allows to their position at that venue, and a
// simple edge for shots and goals. Descriptive only — the model's own math is
// untouched and lives in the Best bets tab.
import { readJson } from '../nhl-store';
import { loadRows } from './build';
import { defenseByPosition, playerBaselines, DEF_POS } from './defense';
import { positionsPath, lastLineupPath, fillFromLastLineup, slotLabel } from './positions';

// Sort key for the position log: forward lines first (LW, C, RW within a line), then the pairs; no slot last.
const POS_ORDER = { LW: 0, C: 1, RW: 2, D: 3 };
const slotOrder = (s) => (s.line ? (s.pos === 'D' ? 100 + s.line * 10 : s.line * 10 + (POS_ORDER[s.pos] ?? 9)) : 999);
import { lineupsPath, gamesPath } from './ingest';
import { fetchSchedule } from './api';
import { loadPlayers } from './rosters';
import { normName } from './names';
import { loadMoneyPuck } from './moneypuck';
import { loadPropfinder, loadOpponentTables, propfinderAllowed, propfinderDefenseTabs } from './propfinder';
import { seasonYear } from './propfinder-csv';
import { latestModelRun, modelKey } from './model-runs';
import { teamVerdict } from './verdict';

const r2 = (v) => +v.toFixed(2);
const pct = (v) => Math.round(v * 100);

/** Games on a date: the stored snapshot if we have one, else the live schedule. */
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

// Stored games say something about a defense once it has this many at the venue;
// before that, PropFinder's last-season per-position table stands in.
const MIN_DEF_GAMES = 10;

/** Edge of a defense vs the league for one position/venue/metric, as a ratio (1.10 = allows 10% more). */
function edge(defense, opp, venue, pos, metric, pf = null) {
  const t = defense.teams[opp]?.[venue]?.[pos];
  const lg = defense.league[venue]?.[pos]?.[metric];
  if (t?.gp >= MIN_DEF_GAMES && lg) {
    return { allowed: t[metric], league: lg, ratio: r2(t[metric] / lg), rank: defense.ranks[opp]?.[venue]?.[pos]?.[metric] ?? null, gp: t.gp, source: 'games' };
  }
  const a = pf ? propfinderAllowed(pf, opp, pos) : null;
  if (a && a.season[metric] != null && a.league[metric]) {
    return { allowed: a.season[metric], league: a.league[metric], ratio: r2(a.season[metric] / a.league[metric]), rank: a.rank[metric] ?? null, gp: a.season.gp, source: 'propfinder', seasonLabel: a.seasonLabel };
  }
  if (!t || !t.gp || !lg) return null;
  return { allowed: t[metric], league: lg, ratio: r2(t[metric] / lg), rank: defense.ranks[opp]?.[venue]?.[pos]?.[metric] ?? null, gp: t.gp, source: 'games' };
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
  const [games, rows, ref, mp, stored, pf, model] = await Promise.all([gamesFor(date), loadRows(date), loadPlayers(), loadMoneyPuck().catch(() => ({ teams: null, games: null })), readJson(gamesPath(date)), loadPropfinder().catch(() => ({ opponentsByPos: null })), latestModelRun(date)]);
  const pfPos = pf.opponentsByPos && Object.keys(pf.opponentsByPos).length ? pf.opponentsByPos : null;
  // The PropFinder table above each rink (the opponent's defense): this season's, plus last season's as its own tab once this season's exist.
  const pfSeason = pf.opponents?.season ?? Object.values(pfPos || {})[0]?.season ?? null;
  const pfPrev = pfSeason && pfSeason >= seasonYear() ? await loadOpponentTables(pfSeason - 1).catch(() => null) : null;
  const pfWin = pf.opponentsByPosWindow || {};
  const storedById = Object.fromEntries((stored?.games || []).map((g) => [g.id, g]));
  const season = defenseByPosition(rows);
  const recent = defenseByPosition(rows, { lastN });
  const recent5 = defenseByPosition(rows, { lastN: 5 });
  const baselines = playerBaselines(rows, { window });
  const rosterByTeam = {};
  for (const p of Object.values(ref.players)) {
    if (!p.onRoster || p.excluded || !p.team) continue;
    (rosterByTeam[p.team] = rosterByTeam[p.team] || {})[normName(p.name)] = p;
  }
  // Teams without a snapshot yet draw their last known lineup instead of a bare roster.
  const noSnap = [...new Set(games.filter((g) => !g.teams).flatMap((g) => [g.away, g.home]))];
  const lastOf = Object.fromEntries(await Promise.all(noSnap.map(async (abbr) => [abbr, await readJson(lastLineupPath(abbr)).catch(() => null)])));
  const idByName = {};
  for (const [id, b] of Object.entries(baselines)) idByName[`${b.team}|${normName(b.name)}`] = Number(id);

  const moneypuck = mp.teams ? { updatedAt: mp.teams.updatedAt, year: mp.teams.year, teams: mp.teams.teams || Object.keys(mp.teams.situations?.all || {}).length, situations: mp.teams.situations, ranks: mp.teams.ranks, byVenue: mp.games?.byVenue || null, venueRanks: mp.games?.ranks || null } : null;
  const out = games.map((g) => {
    const sides = [[g.away, g.home, 'A'], [g.home, g.away, 'H']].map(([team, opp, venue]) => {
      const defVenue = venue === 'A' ? 'H' : 'A';
      const snap = g.teams?.[team];
      let players = snap?.players;
      let carried = snap?.carried || null;
      if (!players) {
        const roster = Object.fromEntries(Object.entries(rosterByTeam[team] || {}).map(([k, p]) => [k, { name: p.name, id: p.id, pos: p.pos, line: null, team, inLineup: false }]));
        const filled = fillFromLastLineup(roster, roster, lastOf[team]);
        players = filled.players;
        carried = filled.carried ? { count: filled.carried, date: lastOf[team]?.date || null, source: lastOf[team]?.source || null } : null;
      }
      const skaters = Object.values(players)
        .filter((p) => DEF_POS.includes(p.pos))
        .map((p) => {
          const id = p.id ?? rosterByTeam[team]?.[normName(p.name)]?.id ?? idByName[`${team}|${normName(p.name)}`] ?? null;
          const base = id != null ? baselines[id] : null;
          const number = (id != null ? ref.players[id]?.number : null) ?? rosterByTeam[team]?.[normName(p.name)]?.number ?? null;
          const oppSog = edge(season, opp, defVenue, p.pos, 'sog', pfPos);
          const oppG = edge(season, opp, defVenue, p.pos, 'g', pfPos);
          const oppScf = edge(season, opp, defVenue, p.pos, 'iscf', pfPos);
          const oppSogL10 = edge(recent, opp, 'ALL', p.pos, 'sog');
          return {
            id, number, name: p.name, team, opp, venue, pos: p.pos, line: p.line ?? null, inLineup: p.inLineup !== false, carried: !!p.carried, carriedFrom: p.carriedFrom || null,
            // What the latest saved model run said about this player (null until a run exists for the date).
            model: model?.players?.[modelKey(team, p.name)] || null,
            vs: { sog: oppSog, g: oppG, iscf: oppScf, sogL10: oppSogL10 },
            ...(scoreSkater(base, venue, oppSog, oppG, oppScf) || { gp: 0 }),
          };
        })
        .sort((a, b) => (b.shotScore || 0) - (a.shotScore || 0));
      // The defense card: what `opp` allows at `defVenue` to each position.
      // Thin venue tables (fewer than MIN_DEF_GAMES games) fall back to PropFinder's
      // last-season per-position table, so the cards and rink bands still read.
      // One window of a defense table (venue split or last-N), PropFinder standing in while thin.
      const pick = (table, key, pos, minGames, win = null) => {
        const own = table.teams[opp]?.[key]?.[pos] || null;
        const rank = table.ranks[opp]?.[key]?.[pos] || null;
        if (pos === 'All' || own?.gp >= minGames) return own?.gp ? { season: own, rank, source: 'games', teamCount: table.teamCount } : null;
        // A last-N window prefers PropFinder's matching table (l5home → l5home, then l5), then its full season.
        const fb = [win, win && win.replace(/(home|away)$/, '')].filter(Boolean).map((k) => propfinderAllowed(pfWin[k], opp, pos)).find(Boolean) || propfinderAllowed(pfPos, opp, pos);
        if (fb) return { season: fb.season, rank: fb.rank, source: 'propfinder', seasonLabel: fb.seasonLabel, teamCount: fb.teamCount, storedGames: own?.gp || 0 };
        return own?.gp ? { season: own, rank, source: 'games', teamCount: table.teamCount, thin: true } : null;
      };
      const defense = Object.fromEntries([...DEF_POS, 'All'].map((pos) => {
        const at = pick(season, defVenue, pos, MIN_DEF_GAMES) || { season: null, rank: null, source: 'games' };
        return [pos, {
          ...at,
          l10: recent.teams[opp]?.ALL?.[pos] || null, l10Rank: recent.ranks[opp]?.ALL?.[pos] || null,
          // The rink's toggle: what `opp` allows at home, away, over its last 5 and last 10 games.
          windows: pos === 'All' ? null : {
            home: pick(season, 'H', pos, MIN_DEF_GAMES), away: pick(season, 'A', pos, MIN_DEF_GAMES),
            l5: pick(recent5, 'ALL', pos, 5, 'l5'), l10: pick(recent, 'ALL', pos, 10, 'l10'),
            l5home: pick(recent5, 'H', pos, 5, 'l5home'), l5away: pick(recent5, 'A', pos, 5, 'l5away'),
          },
        }];
      }));
      return { team, opp, venue, source: snap?.source || 'roster', sourceMeta: snap?.meta || null, carried, skaters, defense, propfinder: propfinderDefenseTabs(pf, opp, pfPrev) };
    });
    // Finished game: the position log — what each skater did, at which pre-game
    // position, and which defense bucket (opponent × venue × position) it fed.
    const rec = storedById[g.id];
    const log = rec ? {
      score: { away: rec.away.score, home: rec.home.score },
      skaters: rec.skaters.map((s) => ({
        id: s.id, name: s.name, team: s.team, opp: s.opp, venue: s.venue, pos: s.pos, boxPos: s.boxPos ?? s.pos, posSource: s.posSource || 'box',
        line: s.line ?? null, slot: slotLabel(s.pos, s.line),
        toi: s.toi, g: s.g, a: s.a, sog: s.sog, icf: s.icf, iscf: s.iscf, ihdcf: s.ihdcf,
        bucket: { team: s.opp, venue: s.venue === 'A' ? 'H' : 'A', pos: s.pos },
      // Line by line (LW1 C1 RW1, LW2 …, then the pairs); skaters without a slot last, by shots.
      })).sort((a, b) => a.team.localeCompare(b.team) || slotOrder(a) - slotOrder(b) || b.sog - a.sog),
    } : null;
    // Each side's defense object describes its opponent, so a team's own verdict reads the other side's.
    const verdicts = Object.fromEntries(sides.map((s, i) => [s.team, teamVerdict({ team: s.team, venue: s.venue, defense: sides[1 - i].defense, teamCount: season.teamCount, mp: moneypuck })]));
    return { id: g.id, away: g.away, home: g.home, startTimeUTC: g.startTimeUTC || null, capturedAt: g.capturedAt || null, sides, verdicts, log };
  });

  const all = out.flatMap((g) => g.sides.flatMap((s) => s.skaters.filter((p) => p.gp >= 5 && p.inLineup)));
  return {
    date,
    games: out,
    league: season.league,
    teamCount: season.teamCount,
    gamesStored: rows.length ? new Set(rows.map((r) => r.gameId)).size : 0,
    modelRun: model ? { id: model.id, createdAt: model.createdAt, label: model.label, players: model.count, source: model.source || null } : null,
    moneypuck,
    top: {
      shots: [...all].sort((a, b) => b.shotScore - a.shotScore).slice(0, 15),
      goals: [...all].sort((a, b) => b.goalScore - a.goalScore).slice(0, 15),
    },
  };
}
