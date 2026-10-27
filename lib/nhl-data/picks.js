// Tonight's picks: the best shots play and the best goal play in every game, from the
// predictor study's rules (docs/shots-goals-predictors.md, sections 2, 5, 9, 10, 13). Each
// skater dressing tonight gets a Poisson rate for shots and for goals from his own stored
// games (this season blended with last season's base at n / (n + 18) for shots and
// n / (n + 40) for goals), his shot attempts, scoring chances and ice time, home ice,
// back-to-back, and what the opponent allows per skater at his position (this season blended
// into last season's at games / (games + 15) for shots, games / (games + 40) for goals). The
// rates were fitted on 2024-25 + 2025-26 (tools/predictors/replay.py; 92,490 skater-games)
// and are carried here as fixed coefficients. Descriptive only: the model's own math is untouched.
import { buildSlate } from './slate';
import { loadRows } from './build';
import { dataRevision } from '../nhl-store';
import { asyncMemo } from '../memo';
import { seasonYearOf, blendRates, project, fromModel, blendProjection, formOf, isSoftThird, seasonSplit, isBackToBack, pickGame, notesFor, withActuals } from './picks-pure';
import { skaterRow } from './shuffle-pure';

export * from './picks-pure';

/** The shuffle for a date: every skater of every game with his λ shots / goals, his own windows and the opponent's rank at his position (lib/nhl-data/shuffle-pure.js). */
export async function buildShuffle(date) {
  const board = await buildPicks(date, { withSkaters: true });
  return {
    date: board.date, source: board.source, studyWeight: board.studyWeight, modelRun: board.modelRun,
    games: board.games.map((g) => ({ id: g.id, away: g.away, home: g.home, startTimeUTC: g.startTimeUTC, final: g.final, score: g.score, skaters: g.all || [] })),
  };
}

const r2 = (v) => +v.toFixed(2);

/**
 * The study's share in the board's numbers when a run exists: `NHL_PICKS_STUDY_WEIGHT` on the
 * server (0 < w ≤ 1; 0.5 = half model λ, half study λ). Off (0) until the History tab's
 * "Windows and sources" table shows the blend beating the model's λ on the graded games.
 */
export function studyWeight(env = process.env) {
  const w = Number(env.NHL_PICKS_STUDY_WEIGHT);
  return Number.isFinite(w) && w > 0 ? Math.min(1, w) : 0;
}

// The board and the shuffle (the board with every skater's row) are kept per store state like
// the slate: the picks, the shuffle and the status all open on them within a minute of each other.
const picksMemo = asyncMemo({ ttl: 15 * 60 * 1000, max: 6, revision: dataRevision });
const picksInputs = (date) => () => Promise.all([buildSlate(date), loadRows(date)]);

/** The board for a date; `withSkaters` adds every candidate's shuffle row to each game (`all`). */
export function buildPicks(date, { withSkaters = false } = {}) {
  return picksMemo(`${date}|${withSkaters ? 'all' : 'board'}`, picksInputs(date), (slate, rows) => computePicks(date, slate, rows, { withSkaters }));
}

function computePicks(date, slate, rows, { withSkaters }) {
  const season = seasonYearOf(date);
  const { cur, prev, lastGame, allowed, posAllowed } = seasonSplit(rows, season);
  // With a saved run for the date the board is the model's: its λ and probabilities, and only
  // the skaters it projected. Without one, the study's rates stand in.
  const source = slate.modelRun ? 'model' : 'study';
  const weight = source === 'model' ? studyWeight() : 0;
  const lineups = { total: 0, carried: 0 };
  const games = slate.games.map((g) => {
    const cands = [];
    const behind = new Map();   // candidate id → the study's full projection and his rows, for the shuffle
    for (const side of g.sides) {
      lineups.total += 1;
      lineups[side.source] = (lineups[side.source] || 0) + 1;
      lineups.carried += side.carried?.count || 0;
      const opp = allowed.teams[side.opp];
      const b2b = isBackToBack(lastGame, side.team, date);
      for (const p of side.skaters) {
        if (!p.inLineup || p.id == null) continue;
        const rates = blendRates(cur[p.id] || [], prev[p.id] || []);
        const oppPos = posAllowed.read(side.opp, p.pos);
        const study = rates ? project(rates, { home: p.venue === 'H', oppPos, pos: p.pos, b2b }) : null;
        const proj = source === 'model' ? blendProjection(fromModel(p.model, study), study, weight) : study;
        if (!proj) continue;
        if (withSkaters) behind.set(p.id, { study, cur: cur[p.id] || [], prev: prev[p.id] || [] });
        cands.push({
          id: p.id, name: p.name, team: p.team, opp: p.opp, venue: p.venue, pos: p.pos, line: p.line ?? null, carried: !!p.carried,
          ...proj, source,
          rates: rates ? { n: rates.n, base: rates.base, sog: r2(rates.sog), g: r2(rates.g), curSog: rates.curSog == null ? null : r2(rates.curSog), curG: rates.curG == null ? null : r2(rates.curG), baseSog: rates.baseSog == null ? null : r2(rates.baseSog), baseG: rates.baseG == null ? null : r2(rates.baseG) } : null,
          oppRank: opp?.rank ?? null, oppSog: opp?.sog ?? null,
          oppPos: oppPos ? { sog: oppPos.sog, g: oppPos.g, rankSog: oppPos.rankSog ?? null, rankG: oppPos.rankG ?? null, games: oppPos.games, prevGames: oppPos.prevGames, teams: posAllowed.teamCount, softSog: isSoftThird(oppPos.rankSog, posAllowed.teamCount), softG: isSoftThird(oppPos.rankG, posAllowed.teamCount) } : null,
          heat: formOf(cur[p.id] || [], prev[p.id] || [], rates),
          b2b,
        });
      }
    }
    // A stored game grades every row: the skater's box-score shots and goals ride on the candidate.
    const graded = g.log?.score ? withActuals(cands, g.log.skaters) : cands;
    return {
      id: g.id, away: g.away, home: g.home, startTimeUTC: g.startTimeUTC, final: !!g.log?.score, score: g.log?.score || null, ...pickGame(graded), skaters: cands.length,
      ...(withSkaters ? { all: graded.map((c) => skaterRow(c, behind.get(c.id) || {})) } : {}),
    };
  });
  return {
    date, source, studyWeight: weight || null, games, allowed: { league: allowed.league, teamCount: allowed.teamCount, positionTeams: posAllowed.teamCount },
    notes: notesFor(games, allowed, lineups.total ? lineups : null),
    modelRun: slate.modelRun, gamesStored: slate.gamesStored,
  };
}
