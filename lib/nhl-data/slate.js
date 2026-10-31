// Matchup finder for one slate date: every skater dressing tonight, with what
// the opposing defense allows to their position at that venue, and a
// simple edge for shots and goals. Descriptive only — the model's own math is
// untouched and lives in the Best bets tab.
import { readJson, dataRevision } from '../nhl-store';
import { asyncMemo, memoByRows } from '../memo';
import { loadRows } from './build';
import { defenseByPosition, defenseBySlot, playerBaselines, firstGoalsAllowed, defenseVsTeam, rankAmong, DEF_POS } from './defense';
import { slotBoard, linesOf } from './defense-board';
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
import { PF_INJURIES_PATH } from './propfinder-api';
import { seasonYear, defaultDefenseTab, spotFromTab } from './propfinder-csv';
import { latestModelRun, modelKey } from './model-runs';
import { withBoardModel } from './board-reads';
import { boardPlays, playMarket, playTier } from '../../components/nhl/model-core';
import { teamVerdict, h2hTotals, gameTotalRead } from './verdict';
import { matchupProfile, teamRates } from './matchup-profile';
import { loadShotpropz } from './shotpropz';
import { loadGoalieRows } from './goalies';
import { goalieBook, likelyStarter } from './goalies-pure';
import { PF_GOALIE_PROPS_PATH, savesLineFor } from './goalie-props';
import { seasonYearOf, blendRates, formOf, isSoftThird, seasonSplit } from './picks-pure';

const r2 = (v) => +v.toFixed(2);
const pct = (v) => Math.round(v * 100);

/** Games on a date: the stored snapshot if we have one, else the live schedule. */
export async function gamesFor(date) {
  const snap = await readJson(positionsPath(date));
  if (snap?.games && Object.keys(snap.games).length) {
    return Object.entries(snap.games).map(([id, g]) => ({ id: Number(id), ...g }));
  }
  const lineups = await readJson(lineupsPath(date));
  if (lineups?.games?.length) return lineups.games.map((g) => ({ id: g.gameId, away: g.away, home: g.home, teams: null }));
  const schedule = await fetchSchedule(date, { quick: true }).catch(() => []);
  return schedule.map((g) => ({ id: g.id, away: g.away, home: g.home, startTimeUTC: g.startTimeUTC, teams: null }));
}

// Stored games say something about a defense once it has this many at the venue; before that,
// PropFinder's per-position table stands in (the newest snapshot: this season's once pulled).
const MIN_DEF_GAMES = 10;

/**
 * Edge of a defense vs the league for one position and metric, as a ratio (1.10 = allows 10% more):
 * PropFinder's per-position season table first (`pf`, the table above the rink on the tab it opens
 * on, so the skater table's Opp S/G and edges and the slate's matchup read sit on the same table as
 * the ice, the flags and the shuffle; Vincent, 2026-10-27 — until then the stored venue table led
 * once it had 10 games), else the stored table at the venue (`thin` under MIN_DEF_GAMES).
 */
function edge(defense, opp, venue, pos, metric, pf = null) {
  const a = pf ? propfinderAllowed(pf, opp, pos) : null;
  if (a && a.season[metric] != null && a.league[metric]) {
    return { allowed: a.season[metric], league: a.league[metric], ratio: r2(a.season[metric] / a.league[metric]), rank: a.rank[metric] ?? null, gp: a.season.gp, source: 'propfinder', seasonLabel: a.seasonLabel };
  }
  const t = defense.teams[opp]?.[venue]?.[pos];
  const lg = defense.league[venue]?.[pos]?.[metric];
  if (!t || !t.gp || !lg) return null;
  return { allowed: t[metric], league: lg, ratio: r2(t[metric] / lg), rank: defense.ranks[opp]?.[venue]?.[pos]?.[metric] ?? null, gp: t.gp, source: 'games', thin: t.gp < MIN_DEF_GAMES };
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

/**
 * Each skater's stored games against each opponent: { "<playerId>|<OPP>": { gp, g, sog } }
 * over the rows loaded for the date (this season and last).
 */
/**
 * The strip above a rink: the saved run's plays for this team, by the Best bets boards' rule
 * (`boardPlays` in model-core), two shots plays and two goal plays at most, lineup skaters only.
 * Null when no run covers the slate; empty lists when none clears the floor.
 */
export function sidePlays(skaters, hasRun, n = 2) {
  if (!hasRun) return null;
  const rows = (skaters || [])
    .filter((p) => p.inLineup !== false && p.model)
    .map((p) => ({ p, gateOpen: p.model.gateOpen, p3s: p.model.p3s, p4s: p.model.p4s, p5s: p.model.p5s, p1g: p.model.p1g, p2g: p.model.p2g, attackScore: p.model.attack }));
  const picks = boardPlays(rows, n);
  const play = (kind) => (r) => {
    const m = playMarket(r, kind);
    // The run's own figure for the market when the board's read is printed over it (`model.run`, lib/nhl-data/board-reads.js).
    const run = r.p.model?.run || null;
    const runProb = run ? (m.stat === 'g' ? run.p1g : m.min === 4 ? run.p4s : run.p3s) ?? null : null;
    return { id: r.p.id ?? null, name: r.p.name, number: r.p.number ?? null, pos: r.p.pos, line: r.p.line ?? null, opp: r.p.opp ?? null, kind, market: m.label, prob: m.prob, runProb, board: r.p.model?.board || null, stat: m.stat, min: m.min, tier: playTier(r.attackScore), attack: r.attackScore ?? null, heat: r.p.heat ?? null, oppPos: r.p.oppPos ?? null, spot: r.p.spot ?? null };
  };
  return { shots: picks.shots.map(play('shots')), goals: picks.goals.map(play('goals')) };
}

/**
 * The slate with the board's reads printed over the run's figures (lib/nhl-data/board-reads.js, `boardReadsOf` on
 * `buildPicks(date, { withSkaters: true })`): every skater's `model` carries the board's λ and chances with the run's
 * own under `model.run`, and each side's plays strip is picked again on the printed figures, so a rink chip, the
 * strip above it, the first-goal board and Best bets say one number for one skater. The slate itself is built
 * before the picks (the picks read it), so the overlay is applied where the slate is served or read on.
 */
export function slateWithBoardReads(slate, reads) {
  if (!slate?.games || !reads) return slate;
  const covered = new Set();
  const overlay = (p) => {
    if (!p?.model) return p;
    const key = modelKey(p.team, p.name);
    const read = reads[key];
    if (!read) return p;
    covered.add(key);
    return { ...p, model: withBoardModel(p.model, read) };
  };
  const games = slate.games.map((g) => ({
    ...g,
    sides: g.sides.map((side) => {
      const skaters = side.skaters.map(overlay);
      return { ...side, skaters, plays: side.plays ? sidePlays(skaters, true) : side.plays };
    }),
  }));
  const top = slate.top ? { shots: slate.top.shots.map(overlay), goals: slate.top.goals.map(overlay) } : slate.top;
  return { ...slate, games, top, boardReads: { skaters: covered.size } };
}

export function h2hByOpponent(rows) {
  return memoByRows(rows, 'h2hByOpponent', () => {
    const out = {};
    for (const r of rows) {
      if (r.playerId == null || !r.opp) continue;
      const k = `${r.playerId}|${r.opp}`;
      const acc = (out[k] = out[k] || { gp: 0, g: 0, sog: 0 });
      acc.gp += 1;
      acc.g += Number(r.g) || 0;
      acc.sog += Number(r.sog) || 0;
    }
    return out;
  });
}

/**
 * The rink's head-to-head mark: a skater who scores more than a goal a game on this
 * opponent, over 2+ games, or 2+ goals in the one game stored (both: goals > games).
 */
export function h2hHot(h) {
  return !!h && h.gp >= 1 && h.g > h.gp;
}

/**
 * The shots version: a skater who fires at this opponent, four or more shots a game over 2+
 * meetings, or five or more in the one meeting stored.
 */
export function h2hShotsHot(h) {
  return !!h && h.gp >= 1 && (h.gp >= 2 ? h.sog / h.gp >= 4 : h.sog >= 5);
}

/**
 * The league-wide tables every side's defense object is read from, once per build: the stored
 * season / last-10 / last-5 tables by position, the first goals allowed, and PropFinder's
 * per-position tables (the season one and the windows) that stand in while a venue table is thin.
 * `season` (a start year, the slate's) keeps the season tables to that season's rows: the stored
 * rows span two seasons and a Season table is this season's (the last-N windows roll across the
 * boundary, the head to head counts every meeting); without it every row counts.
 */
export function defenseTablesFor(rows, pf = null, { lastN = 10, season = null } = {}) {
  return {
    rows,
    season: defenseByPosition(rows, { season }), recent: defenseByPosition(rows, { lastN }), recent5: defenseByPosition(rows, { lastN: 5 }),
    firstGoals: firstGoalsAllowed(rows, { season }), firstGoalsL10: firstGoalsAllowed(rows, { lastN: 10 }),
    pfPos: pf?.opponentsByPos && Object.keys(pf.opponentsByPos).length ? pf.opponentsByPos : null,
    pfWin: pf?.opponentsByPosWindow || {},
  };
}

/**
 * What `opp` allows at `defVenue` to each position and in all: a side's defense object (the
 * table the rink is tinted by, the verdicts and the characteristics read), keyed by position +
 * All, each with the season table at the venue (`season`, `rank`, `source`; PropFinder's table,
 * this season's once pulled, standing in under MIN_DEF_GAMES games), the first goals given up, the last
 * 10 and the rink's windows. `tables` from defenseTablesFor(); `vs` = the team facing it, for the
 * head-to-head windows (null on the team page, where there is no opponent).
 */
export function opponentDefense(opp, defVenue, tables, vs = null) {
  const { season, recent, recent5, firstGoals, firstGoalsL10, pfPos, pfWin, rows } = tables;
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
  // First goals `opp` gives up at this venue, to each position and line slot (and over its last 10 games anywhere).
  const fgAt = (table, venue, pos) => {
    const t = table.teams[opp]?.[venue];
    if (!t?.games) return null;
    const own = pos === 'All' ? { n: t.allowed, share: t.share } : t.byPos[pos];
    const bySlot = pos === 'All' ? t.bySlot : Object.fromEntries(Object.entries(t.bySlot).filter(([k]) => k.replace(/\d+$/, '') === pos));
    return { games: t.games, allowed: own.n, share: own.share, rank: table.ranks[opp]?.[venue]?.[pos] || null, teamCount: table.teamCount, league: table.league[venue]?.[pos] ?? null, bySlot };
  };
  // Head to head: what `opp` allowed to each position in its stored meetings with `vs`, by
  // its venue; coloured by where that sits among the league's season values at that venue.
  const vsTeam = vs ? defenseVsTeam(rows, opp, vs) : null;
  const h2hAt = (venue, pos) => {
    const own = vsTeam?.[venue]?.[pos];
    if (!own?.gp) return null;
    const leagueVals = (metric) => Object.keys(season.teams).map((a) => season.teams[a]?.[venue]?.[pos]?.gp ? season.teams[a][venue][pos][metric] : null);
    return { season: own, rank: { sog: rankAmong(own.sog, leagueVals('sog')), g: rankAmong(own.g, leagueVals('g')), iscf: rankAmong(own.iscf, leagueVals('iscf')) }, source: 'h2h', teamCount: season.teamCount, h2h: { gp: own.gp, vs } };
  };
  return Object.fromEntries([...DEF_POS, 'All'].map((pos) => {
    const at = pick(season, defVenue, pos, MIN_DEF_GAMES) || { season: null, rank: null, source: 'games' };
    return [pos, {
      ...at,
      firstGoal: fgAt(firstGoals, defVenue, pos), firstGoalL10: fgAt(firstGoalsL10, 'ALL', pos),
      l10: recent.teams[opp]?.ALL?.[pos] || null, l10Rank: recent.ranks[opp]?.ALL?.[pos] || null,
      // The rink's toggle: what `opp` allows at home, away, over its last 5 and last 10 games.
      windows: pos === 'All' ? null : {
        home: pick(season, 'H', pos, MIN_DEF_GAMES), away: pick(season, 'A', pos, MIN_DEF_GAMES),
        l5: pick(recent5, 'ALL', pos, 5, 'l5'), l10: pick(recent, 'ALL', pos, 10, 'l10'),
        l5home: pick(recent5, 'H', pos, 5, 'l5home'), l5away: pick(recent5, 'A', pos, 5, 'l5away'),
        h2hhome: h2hAt('H', pos), h2haway: h2hAt('A', pos),
      },
    }];
  }));
}

/** The slate's MoneyPuck block from loadMoneyPuck(): the season table with its ranks, the venue splits once the game logs are stored. */
export function moneypuckBlock(mp) {
  return mp?.teams ? { updatedAt: mp.teams.updatedAt, year: mp.teams.year, teams: mp.teams.teams || Object.keys(mp.teams.situations?.all || {}).length, situations: mp.teams.situations, ranks: mp.teams.ranks, byVenue: mp.games?.byVenue || null, venueRanks: mp.games?.ranks || null } : null;
}

// The slate is what every NHL tab reads first (the Matchups rinks, the picks, the shuffle, the
// first-goal board, the Defense tab's matchup reads): built once per store state and shared.
// Dropped on any write through the store, when a stored file or the rows change identity (a run
// saved through another module instance, a file re-read after its cache expired) or after the TTL.
const slateMemo = asyncMemo({ ttl: 15 * 60 * 1000, max: 6, revision: dataRevision });
const slateInputs = (date) => () => Promise.all([loadRows(date), readJson(positionsPath(date)), readJson(lineupsPath(date)), readJson(gamesPath(date)), latestModelRun(date), loadGoalieRows(date).catch(() => null), readJson(PF_GOALIE_PROPS_PATH).catch(() => null)]);

export function buildSlate(date, { window = 20, lastN = 10 } = {}) {
  return slateMemo(`${date}|${window}|${lastN}`, slateInputs(date), () => computeSlate(date, { window, lastN }));
}

async function computeSlate(date, { window, lastN }) {
  const [games, rows, ref, mp, stored, pf, model, injuries, shotpropz, goalieRows, goalieProps] = await Promise.all([gamesFor(date), loadRows(date), loadPlayers(), loadMoneyPuck().catch(() => ({ teams: null, games: null })), readJson(gamesPath(date)), loadPropfinder().catch(() => ({ opponentsByPos: null })), latestModelRun(date), readJson(PF_INJURIES_PATH).catch(() => null), loadShotpropz().catch(() => null), loadGoalieRows(date).catch(() => []), readJson(PF_GOALIE_PROPS_PATH).catch(() => null)]);
  // Every team's goalies this season from the stored box scores, the games before the date (lib/nhl-data/goalies-pure.js).
  const goalies = goalieBook(goalieRows || [], seasonYearOf(date), { through: date });
  // The book's saves lines from PropFinder's pull, when it was made for this slate (lib/nhl-data/goalie-props.js).
  const savesProps = goalieProps?.date === date ? goalieProps : null;
  const tables = defenseTablesFor(rows, pf, { lastN, season: seasonYearOf(date) });
  const { season, recent, pfPos } = tables;
  // The PropFinder table above each rink (the opponent's defense): this season's, plus last season's as its own tab once this season's exist.
  const pfSeason = pf.opponents?.season ?? Object.values(pfPos || {})[0]?.season ?? null;
  const pfPrev = pfSeason && pfSeason >= seasonYear() ? await loadOpponentTables(pfSeason - 1).catch(() => null) : null;
  const storedById = Object.fromEntries((stored?.games || []).map((g) => [g.id, g]));
  const baselines = playerBaselines(rows, { window });
  const h2h = h2hByOpponent(rows);
  // The Best bets flags: each skater's stored games this season and last (his form going in) and the
  // blended per-skater position tables (`oppPos`, the study's environment, what its λ reads), the same
  // reads as lib/nhl-data/picks.js. The soft-spot flag itself reads `spot` (below): PropFinder's table
  // above the rink on the tab it opens on, so the green rink beside a name and the ice agree.
  const { cur: curByPlayer, prev: prevByPlayer, posAllowed } = seasonSplit(rows, seasonYearOf(date));
  const byPlayer = { cur: curByPlayer, prev: prevByPlayer };
  const flagsOf = (id, opp, pos) => {
    const cur = id != null ? byPlayer.cur[id] || [] : []; const prev = id != null ? byPlayer.prev[id] || [] : [];
    const rates = id != null ? blendRates(cur, prev) : null;
    const o = posAllowed.read(opp, pos);
    return {
      heat: rates ? formOf(cur, prev, rates) : null,
      oppPos: o ? { sog: o.sog, g: o.g, rankSog: o.rankSog ?? null, rankG: o.rankG ?? null, teams: posAllowed.teamCount, softSog: isSoftThird(o.rankSog, posAllowed.teamCount), softG: isSoftThird(o.rankG, posAllowed.teamCount) } : null,
    };
  };
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
  // PropFinder's injury report (pulled live with the slate, data/propfinder/injuries.json): status and detail per skater, by team and name.
  const injOf = {};
  for (const r of injuries?.rows || []) if (r.team && r.key) injOf[`${r.team}|${r.key}`] = r;
  const injuryOf = (team, name) => { const r = injOf[`${team}|${normName(name)}`]; return r ? { injury: r.status, injuryDetail: r.detail || null } : { injury: null, injuryDetail: null }; };

  const moneypuck = moneypuckBlock(mp);
  // The profile card's rink-side read, once a slate: every team's own shots and goals a game from the rows.
  const rates = teamRates(rows, seasonYearOf(date));
  // The Defense tab's by-line table (what each team gives up to the LW1, the C2, the D2 … per skater at the slot a
  // game, this season's stored games at both venues, ranked 1 = the most), read once a slate for every rink: each
  // side carries its opponent's row as `lines`, so the chips' slot badges and the head's softest line read it.
  const slotTable = defenseBySlot(rows, { season: seasonYearOf(date) });
  const lineBoards = { sog: slotBoard(slotTable, { metric: 'sog' }), g: slotBoard(slotTable, { metric: 'g' }) };
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
      // The PropFinder table above the rink (the opponent's defense) and the tab it opens on: the soft-spot flag's read.
      const propfinder = propfinderDefenseTabs(pf, opp, pfPrev, { rows });
      const spotTab = defaultDefenseTab(propfinder?.tabs || []);
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
          // His stored games against tonight's opponent, and whether he scores on them (the rink's mark).
          const vs = id != null ? h2h[`${id}|${opp}`] || null : null;
          return {
            id, number, name: p.name, team, opp, venue, pos: p.pos, line: p.line ?? null, inLineup: p.inLineup !== false, carried: !!p.carried, carriedFrom: p.carriedFrom || null, ...injuryOf(team, p.name),
            h2h: vs ? { gp: vs.gp, g: vs.g, sog: vs.sog, gpg: r2(vs.g / vs.gp), spg: r2(vs.sog / vs.gp), hot: h2hHot(vs), shotsHot: h2hShotsHot(vs) } : null,
            // What the latest saved model run said about this player (null until a run exists for the date).
            model: model?.players?.[modelKey(team, p.name)] || null,
            ...flagsOf(id, opp, p.pos),
            spot: spotTab ? spotFromTab(spotTab, p.pos) : null,
            vs: { sog: oppSog, g: oppG, iscf: oppScf, sogL10: oppSogL10 },
            ...(scoreSkater(base, venue, oppSog, oppG, oppScf) || { gp: 0 }),
          };
        })
        .sort((a, b) => (b.shotScore || 0) - (a.shotScore || 0));
      // The defense card: what `opp` allows at `defVenue` to each position (PropFinder's last-season
      // table standing in under MIN_DEF_GAMES games, so the cards and rink bands still read).
      const defense = opponentDefense(opp, defVenue, tables, team);
      // The goalie likely in net tonight (the most starts over the team's last ten, the other on a back-to-back) with his season line.
      const starter = likelyStarter(goalies, team, date);
      const goalie = starter ? { ...starter.goalie, reason: starter.reason, b2b: starter.b2b, held: starter.held, other: starter.other ? { id: starter.other.id, name: starter.other.name, starts: starter.other.starts, svPct: starter.other.svPct } : null, prop: savesLineFor(savesProps, starter.goalie, team) } : null;
      return { team, opp, venue, source: snap?.source || 'roster', sourceMeta: snap?.meta || null, carried, skaters, defense, propfinder, lines: linesOf(lineBoards, opp), plays: sidePlays(skaters, !!model), goalie };
    });
    // Finished game: the position log — what each skater did, at which pre-game
    // position, and which defense bucket (opponent × venue × position) it fed.
    const rec = storedById[g.id];
    const log = rec ? {
      score: { away: rec.away.score, home: rec.home.score },
      firstGoal: rec.firstGoal || null,
      // The goalies' lines (shots against, saves, goals against, who started): the Saves reads grade on them.
      goalies: (rec.goalies || []).map((k) => ({ id: k.id, name: k.name, team: k.team, venue: k.venue, toi: k.toi, sa: k.sa, ga: k.ga, sv: k.sv, starter: !!k.starter, decision: k.decision || null })),
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
    // High- or low-scoring? The stored meetings between the two and MoneyPuck's expected goals and pace.
    const meetings = h2hTotals(rows, g.away, g.home);
    const total = gameTotalRead({ away: g.away, home: g.home, h2h: meetings, mp: moneypuck });
    const base = { id: g.id, away: g.away, home: g.home, sides, verdicts, total, log };
    // The matchup profile under the game head (lib/nhl-data/matchup-profile.js): the two teams side by side, five
    // rows at tonight's venue from ShotPropz's boards, the rink's tables and PropFinder's standing in.
    const profile = matchupProfile({ game: base, rates, pfTeams: pf.teams || null, shotpropz });
    return { ...base, startTimeUTC: g.startTimeUTC || null, capturedAt: g.capturedAt || null, profile, log };
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
    shotpropz: shotpropz ? { updatedAt: shotpropz.updatedAt, pageUpdated: shotpropz.pageUpdated || null, year: shotpropz.year, pages: shotpropz.pages, failed: shotpropz.failed?.length || 0 } : null,
    top: {
      shots: [...all].sort((a, b) => b.shotScore - a.shotScore).slice(0, 15),
      goals: [...all].sort((a, b) => b.goalScore - a.goalScore).slice(0, 15),
    },
  };
}
