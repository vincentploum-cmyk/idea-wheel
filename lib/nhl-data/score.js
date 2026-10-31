// The predicted score (Vincent, 2026-10-31: "a predicted score based on all the data available, that
// way I can test whether our predictions for goals make sense or not"). Each team's goals tonight are
// read from everything the board already has, blended at the weights the box scores fitted
// (tools/audit/nhl_special_teams.py, section D; 2025-26 fitted, 2026-27 checked;
// docs/audits/2026-10-31-nhl-special-teams-and-score.md):
//   - the skaters: Σ of the dressed skaters' λ goals, the board's own goals read (the study's λ since
//     2026-10-27: his goal rate, chances and shots this season, home ice, the opponent's row at his
//     position), a skater without a read counting the league's figure at his position;
//   - the team: its goals a game and the opponent's goals allowed a game against the league's
//     (ShotPropz's boards, the stored box scores standing in), each shrunk toward the league early;
//   - home ice; and the special teams (lib/nhl-data/special-teams.js: the opponent's power plays given
//     and drawn, its kill).
// From the two λ: the total, each side's chance to win (a Poisson race, a tie split in half: every NHL
// game has a winner) with the fair price, and once the game is stored the score beside it, graded. The
// History tab's scorecard grades every stored pre-game projection (data/scores/<date>.json, written by
// the lineup reads before puck drop) and the run's Σλ per team-game. Pure, no store import.
import { poissonAtLeast, fairOdds, LEAGUE_POS } from './picks-pure';

/** The fit: log λ_team = const + study · log Σλ + ownGf · log(own GF / L) + oppGa · log(opp GA / L) + home + the special-teams terms. */
export const SCORE = {
  /** Games before a team's goals for / against count half against the league's. */
  K: 10,
  // Fitted on 2025-26's 2,452 team-games (tools/audit/nhl_special_teams.py, "study + team reads"): the skaters' sum reads a
  // little low and too wide (its exponent 0.62 and the constant pull it to the league's 3.13 and flatten its spread), the team's
  // own goals a game and the opponent's goals allowed add a little (z 1.4 and 0.7); home ice is already inside the skaters' λ
  // (its own term fitted at +0.3%, left at 0) and the special-teams terms measured nothing (section C, left at 0). Checked on
  // 2026-27's 256 team-games: MAE 1.367 a team against the league's 1.379, the plain own × allowed read's 1.398 and the bare
  // sum's 1.370; the sum rescaled alone read 1.364 there, within noise of this blend, which keeps the team reads because they
  // carry what the sum cannot (the goaltending behind a team's goals allowed). The scorecard grades the stored projections
  // beside both sums, so the question stays open on the site's own nights.
  blend: { const: 0.4481, study: 0.621, ownGf: 0.2138, oppGa: 0.1132, home: 0, oppGives: 0, oppDraws: 0, oppKillLeak: 0 },
  /** The league's goals a team a game when no board says. */
  leagueGoals: 3.1,
};

const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);
const lg = (v) => Math.log(Math.max(v ?? 1, 0.2));

/** P(A scores more than B) + half of P(tie), the two sides Poisson at λa / λb. */
export function winProbability(lamA, lamB, kmax = 20) {
  if (!(lamA > 0) || !(lamB > 0)) return null;
  const pmf = (lam) => { const out = []; let term = Math.exp(-lam); for (let k = 0; k < kmax; k++) { out.push(term); term *= lam / (k + 1); } return out; };
  const a = pmf(lamA); const b = pmf(lamB);
  let win = 0; let tie = 0;
  for (let i = 0; i < kmax; i++) for (let j = 0; j < kmax; j++) { if (i > j) win += a[i] * b[j]; else if (i === j) tie += a[i] * b[j]; }
  return Math.max(0.01, Math.min(0.99, win + tie / 2));
}

/**
 * Σ λ goals over a side's dressed skaters: `skaters` [{ pos, lamG }] with `lamG` null for a skater without a
 * read, who counts the league's figure at his position. { sum, n, read, filled }.
 */
export function sumSkaters(skaters) {
  let sum = 0; let read = 0; let filled = 0;
  for (const s of skaters || []) {
    if (s.lamG > 0) { sum += s.lamG; read += 1; } else { sum += (LEAGUE_POS[s.pos] || LEAGUE_POS.C).g; filled += 1; }
  }
  return { sum: r3(sum), n: read + filled, read, filled };
}

/**
 * One team's goals tonight. `side` = { team, opp, home, skaters: { sum, n, read, filled } (sumSkaters), own: { gf, gp } (its goals a
 * game, games), opp: { ga, gp } (the opponent's goals allowed a game), league (goals a team a game), st (specialTeamsRead), from }.
 * Returns { exp, parts: { skaters, own, opp, home, st }, text }.
 */
export function teamGoals(side) {
  const b = SCORE.blend;
  const L = side.league > 0 ? side.league : SCORE.leagueGoals;
  const shrink = (value, gp) => { if (!(value > 0) || !(gp >= 1)) return 1; const w = gp / (gp + SCORE.K); return w * (value / L) + (1 - w); };
  const own = shrink(side.own?.gf, side.own?.gp); const opp = shrink(side.opp?.ga, side.opp?.gp);
  const st = side.st || null;
  const sum = side.skaters?.sum > 0 ? side.skaters.sum : L;
  const logLam = b.const + b.study * lg(sum) + b.ownGf * Math.log(own) + b.oppGa * Math.log(opp) + b.home * (side.home ? 1 : 0)
    + b.oppGives * Math.log(st?.ppFor?.oppGives?.ratio ?? 1) + b.oppDraws * Math.log(st?.ppAgainst?.oppDraws?.ratio ?? 1) + b.oppKillLeak * Math.log(st?.kill?.leak ?? 1);
  const exp = Math.exp(logLam);
  const f2 = (v) => (v == null ? '—' : Number(v).toFixed(2));
  const parts = {
    skaters: { sum: r2(sum), n: side.skaters?.n ?? null, read: side.skaters?.read ?? null, filled: side.skaters?.filled ?? null },
    own: { gf: r2(side.own?.gf), gp: side.own?.gp ?? null, ratio: r3(own), from: side.own?.from || null },
    opp: { ga: r2(side.opp?.ga), gp: side.opp?.gp ?? null, ratio: r3(opp), from: side.opp?.from || null },
    home: !!side.home, league: r2(L),
    st: st ? { shots: st.factor.shots, goals: st.factor.goals, oppGives: st.ppFor?.oppGives?.ratio ?? null, oppDraws: st.ppAgainst?.oppDraws?.ratio ?? null, killLeak: st.kill?.leak ?? null } : null,
  };
  const stPart = st ? Math.exp(b.oppGives * Math.log(parts.st.oppGives ?? 1) + b.oppDraws * Math.log(parts.st.oppDraws ?? 1) + b.oppKillLeak * Math.log(parts.st.killLeak ?? 1)) : 1;
  const text = `${side.team}: ${f2(exp)} goals — its skaters' λ add up to ${f2(sum)}${side.skaters?.filled ? ` (${side.skaters.filled} without a read, at the league's figure)` : ''}; it scores ${side.own?.gf != null ? `${f2(side.own.gf)} a game over ${side.own.gp ?? '?'} (${r2(own)}× the league after the early-season shrink)` : 'no team read'}, ${side.opp?.team || 'the opponent'} allows ${side.opp?.ga != null ? `${f2(side.opp.ga)} (${r2(opp)}×)` : 'no read'}${side.home ? ', home ice' : ''}${st && Math.abs(stPart - 1) >= 0.0005 ? `, special teams ×${stPart.toFixed(3)}` : ''}.`;
  return { exp: r2(exp), parts, text };
}

/**
 * The game's predicted score. `game` = { away, home, sides: { [team]: side (teamGoals input) }, moneypuck: { away, home, total } | null
 * (the game-total read's expected goals, a comparison on the hover), final: { away, home } | null (the stored score) }.
 * Returns { away, home, exp: { [team]: goals }, total, win: { [team]: p }, fair: { [team]: price }, headline, title, parts: { [team] }, text,
 * final: { score, err: { [team], total }, winner, called } | null } or null without both sides.
 */
export function gameScore(game) {
  const { away, home, sides } = game || {};
  if (!away || !home || !sides?.[away] || !sides?.[home]) return null;
  const a = teamGoals({ ...sides[away], team: away, home: false }); const h = teamGoals({ ...sides[home], team: home, home: true });
  const pHome = winProbability(h.exp, a.exp); const pAway = pHome == null ? null : 1 - pHome;
  const total = r1(a.exp + h.exp);
  const f1 = (v) => (v == null ? '—' : Number(v).toFixed(1));
  const headline = `${away} ${f1(a.exp)} – ${f1(h.exp)} ${home}`;
  const mp = game.moneypuck || null;
  const title = [
    `Projected score ${headline} · ${f1(total)} goals · ${home} wins ${Math.round((pHome ?? 0.5) * 100)}% (${fairOdds(pHome)}), ${away} ${Math.round((pAway ?? 0.5) * 100)}% (${fairOdds(pAway)}).`,
    a.text, h.text,
    mp?.total != null ? `MoneyPuck's expected goals read ${away} ${f1(mp.away)} – ${f1(mp.home)} ${home} (${f1(mp.total)}), a comparison only.` : null,
    'The blend: the skaters’ λ goals added up, the team’s goals a game, the opponent’s goals allowed, home ice and the special teams, at the weights fitted on 2025-26’s box scores (docs/audits/2026-10-31-nhl-special-teams-and-score.md).',
  ].filter(Boolean).join(' ');
  let fin = null;
  if (game.final && game.final.away != null && game.final.home != null) {
    const winner = game.final.home > game.final.away ? home : away;
    const picked = pHome >= 0.5 ? home : away;
    fin = {
      score: { [away]: game.final.away, [home]: game.final.home }, total: game.final.away + game.final.home,
      err: { [away]: r2(a.exp - game.final.away), [home]: r2(h.exp - game.final.home), total: r2(total - game.final.away - game.final.home) },
      winner, picked, called: picked === winner,
    };
  }
  return {
    away, home, exp: { [away]: a.exp, [home]: h.exp }, total, win: { [away]: r3(pAway), [home]: r3(pHome) }, fair: { [away]: fairOdds(pAway), [home]: fairOdds(pHome) },
    headline, title, parts: { [away]: a.parts, [home]: h.parts }, text: `${a.text} ${h.text}`, moneypuck: mp, final: fin,
    // The chance of each total line, for the hover and the tests: P(total ≥ k) off the two λ.
    totals: Object.fromEntries([5, 6, 7].map((k) => [k, r3(poissonAtLeast(a.exp + h.exp, k))])),
  };
}

/**
 * Projected scores graded against the stored finals: `pairs` [{ away, home, exp: { [team] }, final: { away, home } }] →
 * { n, team: { bias, mae, rmse }, total: { projected, actual, bias, mae }, winner: { called, n, brier, homeSaid, homeWon } }.
 */
export function gradeScores(pairs) {
  const list = (pairs || []).filter((p) => p?.exp && p.final && p.final.away != null && p.final.home != null && p.exp[p.away] != null && p.exp[p.home] != null);
  if (!list.length) return { n: 0 };
  const te = []; const tot = []; const win = [];
  for (const p of list) {
    te.push(p.exp[p.away] - p.final.away, p.exp[p.home] - p.final.home);
    tot.push({ proj: p.exp[p.away] + p.exp[p.home], act: p.final.away + p.final.home });
    const pHome = winProbability(p.exp[p.home], p.exp[p.away]);
    if (pHome != null) win.push({ p: pHome, won: p.final.home > p.final.away ? 1 : 0 });
  }
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return {
    n: list.length,
    team: { n: te.length, bias: r3(mean(te)), mae: r3(mean(te.map(Math.abs))), rmse: r3(Math.sqrt(mean(te.map((e) => e * e)))) },
    total: { projected: r2(mean(tot.map((t) => t.proj))), actual: r2(mean(tot.map((t) => t.act))), bias: r3(mean(tot.map((t) => t.proj - t.act))), mae: r3(mean(tot.map((t) => Math.abs(t.proj - t.act)))) },
    winner: win.length ? { n: win.length, called: r3(mean(win.map((w) => ((w.p >= 0.5 ? 1 : 0) === w.won ? 1 : 0)))), brier: r3(mean(win.map((w) => (w.p - w.won) ** 2))), homeSaid: r3(mean(win.map((w) => w.p))), homeWon: r3(mean(win.map((w) => w.won))) } : null,
  };
}
