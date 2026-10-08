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
import { seasonYearOf, blendRates, project, shotsAllowed, pickGame, notesFor } from './picks-pure';

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
        if (!rates) continue;
        const proj = project(rates, { home: p.venue === 'H', oppShotsAllowed: opp?.sog || allowed.league || 27 });
        cands.push({
          id: p.id, name: p.name, team: p.team, opp: p.opp, venue: p.venue, pos: p.pos, line: p.line ?? null, carried: !!p.carried,
          ...proj, rates: { n: rates.n, base: rates.base, sog: r2(rates.sog), g: r2(rates.g), curSog: rates.curSog == null ? null : r2(rates.curSog), curG: rates.curG == null ? null : r2(rates.curG), baseSog: rates.baseSog == null ? null : r2(rates.baseSog), baseG: rates.baseG == null ? null : r2(rates.baseG) },
          oppRank: opp?.rank ?? null, oppSog: opp?.sog ?? null,
          model: p.model ? { p3s: p.model.p3s ?? null, p1g: p.model.p1g ?? null } : null,
        });
      }
    }
    return { id: g.id, away: g.away, home: g.home, startTimeUTC: g.startTimeUTC, final: !!g.log?.score, score: g.log?.score || null, ...pickGame(cands), skaters: cands.length };
  });
  return {
    date, games, allowed: { league: allowed.league, teamCount: allowed.teamCount },
    notes: notesFor(games, allowed, lineups.total ? lineups : null),
    modelRun: slate.modelRun, gamesStored: slate.gamesStored,
  };
}
