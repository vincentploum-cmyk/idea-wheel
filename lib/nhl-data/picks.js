// Tonight's picks: the best shots play and the best goal play in every game, from the
// predictor study's rules (docs/shots-goals-predictors.md, sections 2, 5, 9, 10, 13). Each
// skater dressing tonight gets a Poisson rate for shots and for goals from his own stored
// games this season (`blendRates`, the name kept: this season's rate from his fifth game, last
// season's regular season until then; last season's playoff rows are not loaded, `loadRows`), his
// shot attempts, scoring chances and ice time, home ice, back-to-back, and what the opponent allows
// per skater at his position this season (`positionAllowed`; last season's regular season only until
// a team's first game). Vincent's call, 2026-10-27, twice over: this season's rate, this season's
// table; the study's blends stay in docs/shots-goals-predictors.md and in no number. The
// rates were fitted on 2024-25 + 2025-26 (tools/predictors/replay.py; 92,490 skater-games)
// and are carried here as fixed coefficients. Descriptive only: the model's own math is untouched.
import { buildSlate } from './slate';
import { loadRows } from './build';
import { dataRevision, readJson } from '../nhl-store';
import { asyncMemo } from '../memo';
import { seasonYearOf, blendRates, project, fromModel, blendProjection, formOf, isSoftThird, seasonSplit, isBackToBack, pickGame, notesFor, withActuals, studyWeight, studyWeightGoals, poissonAtLeast } from './picks-pure';
import { skaterRow, trimDefenseTabs } from './shuffle-pure';
import { calibrateProjection, calibrationFits } from './calibration-pure';
import { loadCalibration } from './calibration';
import { defaultDefenseTab } from './propfinder-csv';
import { loadShotpropz, spzCell } from './shotpropz';
import { specialTeamsRead, splitSpecialTeams, withSpecialTeams } from './special-teams';
import { gameScore, sumSkaters } from './score';
import { teamRates } from './matchup-profile';
import { scoresPath } from './scores-store';

export * from './picks-pure';

/**
 * The shuffle for a date: every skater of every game with his λ shots / goals, his own windows and
 * the opponent's rank at his position (lib/nhl-data/shuffle-pure.js), and `defense`: each team's
 * PropFinder defense table as the Matchups tab draws it above the rink, keyed by team, which the
 * panel's Matchup column reads on the tab picked.
 */
export async function buildShuffle(date) {
  const board = await buildPicks(date, { withSkaters: true });
  return {
    date: board.date, source: board.source, studyWeight: board.studyWeight, studyWeightGoals: board.studyWeightGoals, modelRun: board.modelRun, calibration: board.calibration,
    games: board.games.map((g) => ({ id: g.id, away: g.away, home: g.home, startTimeUTC: g.startTimeUTC, final: g.final, score: g.score, projected: g.projected, skaters: g.all || [] })),
    defense: Object.assign({}, ...board.games.map((g) => g.defense || {})),
  };
}

const r2 = (v) => +v.toFixed(2);

/** A stored pre-game projection graded against the final: each side's error, the total's, whether the winner was called. */
function gradeStored(stored, g) {
  const fin = g.log.score; const winner = fin.home > fin.away ? g.home : g.away;
  const pHome = stored.win?.[g.home]; const picked = pHome == null ? null : pHome >= 0.5 ? g.home : g.away;
  return { err: { [g.away]: r2(stored.exp[g.away] - fin.away), [g.home]: r2(stored.exp[g.home] - fin.home), total: r2(stored.total - fin.away - fin.home) }, winner, picked, called: picked == null ? null : picked === winner };
}

// The board and the shuffle (the board with every skater's row) are kept per store state like
// the slate: the picks, the shuffle and the status all open on them within a minute of each other.
const picksMemo = asyncMemo({ ttl: 15 * 60 * 1000, max: 6, revision: dataRevision });
const picksInputs = (date) => () => Promise.all([buildSlate(date), loadRows(date), loadCalibration(), loadShotpropz().catch(() => null), readJson(scoresPath(date)).catch(() => null)]);

/** The board for a date; `withSkaters` adds every candidate's shuffle row to each game (`all`). */
export function buildPicks(date, { withSkaters = false } = {}) {
  return picksMemo(`${date}|${withSkaters ? 'all' : 'board'}`, picksInputs(date), (slate, rows, cal, spz, storedScores) => computePicks(date, slate, rows, { withSkaters, cal, spz, storedScores }));
}

/** A team's goals a game and the games behind it for the score: ShotPropz's board (all games, season to date), the stored box scores standing in. */
function teamGoalsRead(spz, rates, team, board, stat) {
  const c = spzCell(spz, board, stat, team);
  if (c && c.gp >= 1) return { [stat]: c.value, gp: c.gp, from: 'shotpropz' };
  const own = rates?.teams?.[team];
  if (own && !own.held && own.gp >= 1) return { [stat]: own.g, gp: own.gp, from: 'stored' };
  return null;
}

export function computePicks(date, slate, rows, { withSkaters, cal = null, spz = null, storedScores = null }) {
  const season = seasonYearOf(date);
  const { cur, prev, lastGame, allowed, posAllowed } = seasonSplit(rows, season);
  // The team reads behind the predicted score when ShotPropz has no board: each team's own goals a game from the rows.
  const rates = teamRates(rows, season);
  const leagueGoals = (() => { const t = spz?.boards?.offense?.all?.ytd?.gf?.teams; const v = t ? Object.values(t).map((x) => x.value) : []; return v.length >= 10 ? v.reduce((a, b) => a + b, 0) / v.length : rates?.league?.g || null; })();
  // With a saved run for the date the board is the model's: its λ and probabilities, and only
  // the skaters it projected. Without one, the study's rates stand in.
  const source = slate.modelRun ? 'model' : 'study';
  const weight = source === 'model' ? studyWeight() : 0;
  const weightG = source === 'model' ? studyWeightGoals() : 0;
  // The chances printed are calibrated to what the same stated chance has landed this season (lib/nhl-data/calibration.js):
  // the board's read with a run, the study's without one; a calibration learned at other weights is another read, left off.
  const calRead = source === 'model' ? 'board' : 'study';
  const calOn = !!cal?.reads?.[calRead] && (source !== 'model' || calibrationFits(cal, { w: weight, wG: weightG }));
  const lineups = { total: 0, carried: 0 };
  // The team-level read behind the notes (the softest spots, the environment plays): PropFinder's All
  // row on the tab the rink opens on, per team on the slate; the stored team totals when none has one.
  const pfTeams = {}; let pfCount = 0;
  const games = slate.games.map((g) => {
    const cands = [];
    const behind = new Map();   // candidate id → the study's full projection and his rows, for the shuffle
    const scoreSides = {};      // team → the predicted score's inputs
    for (const side of g.sides) {
      lineups.total += 1;
      lineups[side.source] = (lineups[side.source] || 0) + 1;
      lineups.carried += side.carried?.count || 0;
      const opp = allowed.teams[side.opp];
      const spotTab = defaultDefenseTab(side.propfinder?.tabs || []);
      const all = spotTab?.rows?.All;
      const pfAll = all?.sog != null && all.ranks?.sog ? { games: all.gp ?? null, sog: all.sog, rank: all.ranks.sog } : null;
      if (pfAll) { pfTeams[side.opp] = pfAll; pfCount = Math.max(pfCount, spotTab.count || 0); }
      const oppRead = pfAll || opp;
      const b2b = isBackToBack(lastGame, side.team, date);
      // The special teams tonight (lib/nhl-data/special-teams.js): the opponent's power plays given and drawn and its kill,
      // a factor on the side's shots and goals split over the skaters by their power-play slot, before the calibration.
      const st = specialTeamsRead(spz, side.team, side.opp);
      const reads = [];
      const dressed = [];       // every dressed skater, for the predicted score (a skater without a read counts the league's figure)
      for (const p of side.skaters) {
        if (!p.inLineup || p.id == null) continue;
        const rates = blendRates(cur[p.id] || [], prev[p.id] || []);
        const oppPos = posAllowed.read(side.opp, p.pos);
        const study = rates ? project(rates, { home: p.venue === 'H', oppPos, pos: p.pos, b2b }) : null;
        const read = source === 'model' ? blendProjection(fromModel(p.model, study), study, weight, weightG) : study;
        dressed.push({ pos: p.pos, lamG: read?.lamG ?? null });
        if (!read) continue;
        reads.push({ p, rates, oppPos, study, read });
      }
      const split = splitSpecialTeams(reads.map(({ p, read }) => ({ id: p.id, pos: p.pos, line: p.line ?? null, lamS: read.lamS, lamG: read.lamG })), st);
      scoreSides[side.team] = {
        team: side.team, opp: side.opp, skaters: sumSkaters(dressed), st,
        own: teamGoalsRead(spz, rates, side.team, 'offense', 'gf'), oppAllowed: teamGoalsRead(spz, rates, side.opp, 'defense', 'ga'), league: leagueGoals,
      };
      for (const { p, rates, oppPos, study, read } of reads) {
        const withSt = withSpecialTeams(read, split.get(p.id), poissonAtLeast);
        const proj = calOn ? calibrateProjection(withSt, cal, calRead) : withSt;
        if (!proj) continue;
        if (withSkaters) behind.set(p.id, { study, cur: cur[p.id] || [], prev: prev[p.id] || [] });
        cands.push({
          id: p.id, name: p.name, team: p.team, opp: p.opp, venue: p.venue, pos: p.pos, line: p.line ?? null, carried: !!p.carried,
          ...proj, source,
          // The side's special-teams read rides on every candidate (the hovers; the shuffle row keeps it as `stTeam`).
          stTeam: st ? { factor: st.factor, shift: st.shift, ppFor: { expected: st.ppFor.expected, usual: st.ppFor.usual }, ppAgainst: { expected: st.ppAgainst.expected, usual: st.ppAgainst.usual }, text: st.text } : null,
          rates: rates ? { n: rates.n, base: rates.base, sog: r2(rates.sog), g: r2(rates.g), curSog: rates.curSog == null ? null : r2(rates.curSog), curG: rates.curG == null ? null : r2(rates.curG), baseSog: rates.baseSog == null ? null : r2(rates.baseSog), baseG: rates.baseG == null ? null : r2(rates.baseG) } : null,
          oppRank: oppRead?.rank ?? null, oppSog: oppRead?.sog ?? null,
          // The study's environment (what its λ reads) and, beside it, the soft-spot flag's read: PropFinder's table on the tab the rink opens on.
          spot: p.spot ?? null,
          oppPos: oppPos ? { sog: oppPos.sog, g: oppPos.g, rankSog: oppPos.rankSog ?? null, rankG: oppPos.rankG ?? null, games: oppPos.games, prevGames: oppPos.prevGames, held: !!oppPos.held, teams: posAllowed.teamCount, softSog: isSoftThird(oppPos.rankSog, posAllowed.teamCount), softG: isSoftThird(oppPos.rankG, posAllowed.teamCount) } : null,
          heat: formOf(cur[p.id] || [], prev[p.id] || [], rates),
          b2b,
        });
      }
    }
    // A stored game grades every row: the skater's box-score shots and goals ride on the candidate.
    const graded = g.log?.score ? withActuals(cands, g.log.skaters) : cands;
    // The predicted score (lib/nhl-data/score.js): the two sides' skaters added up, the team reads, home ice and the special
    // teams; the pre-game projection stored before puck drop (data/scores/<date>.json) stands beside it once the game is final.
    const sidesIn = Object.fromEntries(g.sides.map((side) => { const sc = scoreSides[side.team]; return [side.team, sc ? { ...sc, opp: sc.oppAllowed ? { ...sc.oppAllowed, team: side.opp } : null } : null]; }));
    const live = gameScore({ away: g.away, home: g.home, sides: sidesIn, moneypuck: g.total?.expected ? { away: g.total.expected.away, home: g.total.expected.home, total: g.total.expected.total } : null, final: g.log?.score || null });
    const stored = storedScores?.games?.[g.id] || null;
    const projected = live ? { ...live, stored: stored ? { at: stored.at, exp: stored.exp, total: stored.total, win: stored.win, headline: stored.headline, title: stored.title, final: g.log?.score ? gradeStored(stored, g) : null } : null } : null;
    return {
      id: g.id, away: g.away, home: g.home, startTimeUTC: g.startTimeUTC, final: !!g.log?.score, score: g.log?.score || null, projected, ...pickGame(graded), skaters: cands.length,
      // The shuffle's rows, and each side's opponent's PropFinder table (the one above the rink on Matchups) keyed by the defending team.
      ...(withSkaters ? { all: graded.map((c) => skaterRow(c, behind.get(c.id) || {})), defense: Object.fromEntries(g.sides.map((side) => [side.opp, trimDefenseTabs(side.propfinder)])) } : {}),
    };
  });
  const forNotes = Object.keys(pfTeams).length ? { teams: pfTeams, teamCount: pfCount || allowed.teamCount, league: allowed.league, source: 'propfinder' } : { ...allowed, source: 'games' };
  return {
    date, source, studyWeight: weight || null, studyWeightGoals: weightG || null, games, allowed: { league: allowed.league, teamCount: allowed.teamCount, positionTeams: posAllowed.teamCount, notesFrom: forNotes.source },
    notes: notesFor(games, forNotes, lineups.total ? lineups : null),
    modelRun: slate.modelRun, gamesStored: slate.gamesStored,
    calibration: calOn ? { read: calRead, at: cal.at, from: cal.from, to: cal.to, games: cal.games, source: cal.source || null, fits: cal.reads[calRead] } : null,
  };
}
