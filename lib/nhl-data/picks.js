// Tonight's picks: the best shots play and the best goal play in every game, from the
// predictor study's rules (docs/shots-goals-predictors.md, sections 2, 5, 9, 10). Each
// skater dressing tonight gets a Poisson rate for shots and for goals from his own stored
// games (this season blended with last season's base at n / (n + 18) for shots and
// n / (n + 40) for goals), his shot attempts and scoring chances, home ice, and what the
// opponent has allowed this season. The rates were fitted on the whole of 2025-26
// (tools/predictors/picks.py, refit with log features; 40,967 skater-games) and are
// carried here as fixed coefficients. Descriptive only: the model's own math is untouched.
import { buildSlate } from './slate';
import { loadRows } from './build';
import { seasonYearOf, blendRates, project, fromModel, shotsAllowed, pickGame, notesFor } from './picks-pure';

export * from './picks-pure';

const r2 = (v) => +v.toFixed(2);
const POS = ['C', 'LW', 'RW', 'D'];

/** The board for a date. */
export async function buildPicks(date) {
  const [slate, rows] = await Promise.all([buildSlate(date), loadRows(date)]);
  const season = seasonYearOf(date);
  const cur = {}; const prev = {};
  for (const r of rows) {
    if (r.playerId == null || !POS.includes(r.pos)) continue;
    ((seasonYearOf(r.date) === season ? cur : prev)[r.playerId] ||= []).push(r);
  }
  const allowed = shotsAllowed(rows.filter((r) => seasonYearOf(r.date) === season));
  // With a saved run for the date the board is the model's: its λ and probabilities, and only
  // the skaters it projected. Without one, the study's rates stand in.
  const source = slate.modelRun ? 'model' : 'study';
  const lineups = { total: 0, carried: 0 };
  const games = slate.games.map((g) => {
    const cands = [];
    for (const side of g.sides) {
      lineups.total += 1;
      lineups[side.source] = (lineups[side.source] || 0) + 1;
      lineups.carried += side.carried?.count || 0;
      const opp = allowed.teams[side.opp];
      for (const p of side.skaters) {
        if (!p.inLineup || p.id == null) continue;
        const rates = blendRates(cur[p.id] || [], prev[p.id] || []);
        const study = rates ? project(rates, { home: p.venue === 'H', oppShotsAllowed: opp?.sog || allowed.league || 27 }) : null;
        const proj = source === 'model' ? fromModel(p.model, study) : study;
        if (!proj) continue;
        cands.push({
          id: p.id, name: p.name, team: p.team, opp: p.opp, venue: p.venue, pos: p.pos, line: p.line ?? null, carried: !!p.carried,
          ...proj, source,
          rates: rates ? { n: rates.n, base: rates.base, sog: r2(rates.sog), g: r2(rates.g), curSog: rates.curSog == null ? null : r2(rates.curSog), curG: rates.curG == null ? null : r2(rates.curG), baseSog: rates.baseSog == null ? null : r2(rates.baseSog), baseG: rates.baseG == null ? null : r2(rates.baseG) } : null,
          oppRank: opp?.rank ?? null, oppSog: opp?.sog ?? null,
        });
      }
    }
    return { id: g.id, away: g.away, home: g.home, startTimeUTC: g.startTimeUTC, final: !!g.log?.score, score: g.log?.score || null, ...pickGame(cands), skaters: cands.length };
  });
  return {
    date, source, games, allowed: { league: allowed.league, teamCount: allowed.teamCount },
    notes: notesFor(games, allowed, lineups.total ? lineups : null),
    modelRun: slate.modelRun, gamesStored: slate.gamesStored,
  };
}
