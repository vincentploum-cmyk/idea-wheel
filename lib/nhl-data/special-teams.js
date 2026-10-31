// Special teams in the numbers (Vincent, 2026-10-31: "if a team allows a lot of penalties, the other
// team gets a lot of extra minutes on the ice … I bet it has an impact on shots / goals prediction").
// From ShotPropz's team boards (lib/nhl-data/shotpropz.js: the power plays a team draws and gives a
// game, its PP% and PK%, all games, season to date) this module reads, for one side of a game:
//   - the power plays it should get tonight and the ones it will have to kill: the league's rate × its
//     own rate × the opponent's, each as a ratio to the league shrunk toward 1 at gp / (gp + K) and
//     raised to the elasticity the box scores fitted (0.46 own, 0.42 the opponent; the forecast beats the
//     league rate on the check season);
//   - what that is worth: inside a game a power play is worth a shot (+0.99) and a kill costs seven
//     tenths of one (−0.71); in goals the count barely moves (+0.06 a power play: power-play goals
//     replace even-strength ones, and the trailing team draws the penalties);
//   - and where it lands. Measured on 2025-26's team-games and checked on 2026-27
//     (docs/audits/2026-10-31-nhl-special-teams-and-score.md, section C), the opponent's discipline moves a
//     team's shots and goals by NOTHING on top of its own volume and what the opponent allows: the shots
//     a leaky kill gives up are already in the opponent's shots-allowed table, which every read on the
//     board carries. So the team's total is left alone (`teamWeight` 0) and the read is a redistribution
//     inside the team: the extra power-play shots and goals the forecast expects go to the skaters by
//     their power-play slot (the first line and pair carry the units) and the same amount comes off
//     everyone evenly, so a first-unit forward against an undisciplined opponent reads a little higher and
//     the fourth line a little lower, the side's sum unchanged. Extra kills move the other way.
// The skater's own rate already carries his team's power play; what is new tonight is the opponent.
// Pure, no store import: the shuffle and the picks panel are bundled by the client.
import { spzCell } from './shotpropz-pure';

/** The fit (tools/audit/nhl_special_teams.py; 2025-26 fitted, 2026-27 checked; the JSON at the end of its report). */
export const ST = {
  /** Games before a team's drawn / given rate counts half against the league's (the best check-season deviance of 0 / 5 / 10 / 20 / 40). */
  K: 10,
  /** Kills (power plays against) before a team's kill leak counts half. */
  K_KILL: 40,
  /** log E[power plays tonight] = log L + drawn · log(own drawn / L) + opponentGives · log(opp given / L). */
  elasticity: { drawn: 0.4596, opponentGives: 0.4211 },
  /** What one power play is worth inside a game: shots and goals for, and the cost of one killed (OLS on 3,052 team-games of both seasons). */
  worth: { shotsPerPP: 0.99, shotsPerPK: -0.7078, goalsPerPP: 0.0616, goalsPerPK: 0.0562 },
  /** The league's conversion: the power-play goals a power play is worth to the units it is handed to. */
  conv: 0.212,
  /**
   * The share of the mechanical team-level change (the forecast's extra power plays × their worth) put on the team's total:
   * 0, as measured — on top of own volume × the opponent's allowed table the coefficient on it was 0.25 (z 0.2) for shots and
   * −0.46 (z −1.1) for goals, nothing of it showing (section C). 1 would add the whole mechanical change.
   */
  teamWeight: 0,
  /** The share of the extra power-play shots and goals moved inside the team to its power-play units (1 = the mechanical amount). */
  redistribute: 1,
  /** The league's figures when a board is missing: power plays a game. */
  league: { ppo: 3.2 },
};

/**
 * Each skater's share of his team's power-play time by line slot: forwards on the first line and the
 * first pair carry the first unit, the second line and pair the second; the fourth line kills penalties.
 * A skater without a slot in the lineup (a bare roster) reads the middle of his group.
 */
export const PP_WEIGHTS = { F: { 1: 1.0, 2: 0.65, 3: 0.3, 4: 0.05, null: 0.5 }, D: { 1: 0.8, 2: 0.35, 3: 0.05, null: 0.4 } };

/** The power-play weight of a skater at `pos` on line / pair `line` (null without a slot). */
export function ppWeight(pos, line) {
  const group = pos === 'D' ? PP_WEIGHTS.D : PP_WEIGHTS.F;
  const key = line == null ? 'null' : Math.min(Math.max(1, Number(line) || 1), pos === 'D' ? 3 : 4);
  return group[key] ?? group.null;
}

const r2 = (v) => (v == null ? null : Math.round(v * 100) / 100);
const r3 = (v) => (v == null ? null : Math.round(v * 1000) / 1000);
const mean = (table) => { const v = Object.values(table?.teams || {}).map((t) => t.value).filter((x) => Number.isFinite(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };

/** A team's value on a board as a ratio to the league's mean, shrunk toward 1 at gp / (gp + K); { value, gp, rank, n, league, ratio, w } or null. */
export function ratioOf(spz, board, stat, team, { K = ST.K, kills = false } = {}) {
  const c = spzCell(spz, board, stat, team);
  const league = mean(spz?.boards?.[board]?.all?.ytd?.[stat]);
  if (!c || !(league > 0) || !(c.gp >= 1)) return null;
  const n = kills ? c.gp * (spzCell(spz, 'defense', 'ppoa', team)?.value ?? ST.league.ppo) : c.gp;
  const w = n / (n + K);
  const raw = c.value / league;
  return { value: c.value, gp: c.gp, rank: c.rank, n: c.n, league: r3(league), raw: r3(raw), ratio: r3(w * raw + (1 - w)), w: r3(w) };
}

/**
 * The special-teams read for one side: `team` attacking, `opp` defending, from the ShotPropz snapshot
 * (all games, season to date). Null without the boards. Returns
 * { ppFor: { own, oppGives, league, expected, usual, delta }, ppAgainst: { own, oppDraws, league, expected, usual, delta },
 *   kill: { pk, leak } (the opponent's penalty kill), factor: { shots, goals } (on the team's total: 1 at `teamWeight` 0),
 *   mechanical: { shots, goals } (the change the mechanics would put on the total), shift: { shots, goals } (the shots and
 *   power-play goals moved to the power-play units tonight, over the team's usual), text }.
 */
export function specialTeamsRead(spz, team, opp) {
  if (!spz?.boards || !team || !opp) return null;
  const drawn = ratioOf(spz, 'offense', 'ppo', team);
  const given = ratioOf(spz, 'defense', 'ppoa', team);
  const oppDrawn = ratioOf(spz, 'offense', 'ppo', opp);
  const oppGiven = ratioOf(spz, 'defense', 'ppoa', opp);
  if (!drawn && !oppGiven && !oppDrawn && !given) return null;
  const L = drawn?.league ?? oppGiven?.league ?? ST.league.ppo;
  const pow = (r, e) => (r ? Math.pow(r.ratio, e) : 1);
  // The power plays tonight: the league's rate × own drawn^a × opponent gives^b; the same the other way.
  const expFor = L * pow(drawn, ST.elasticity.drawn) * pow(oppGiven, ST.elasticity.opponentGives);
  const expAgainst = L * pow(given, ST.elasticity.drawn) * pow(oppDrawn, ST.elasticity.opponentGives);
  // The usual: the same forecast against an average opponent (ratio 1), so the difference is the opponent's part alone — the
  // team's own rate is already in its skaters' rates, and comparing a shrunk forecast with a raw rate would move every team.
  const usualFor = L * pow(drawn, ST.elasticity.drawn); const usualAgainst = L * pow(given, ST.elasticity.drawn);
  // The opponent's kill: goals allowed per kill against the league's, from its PK% (rank 1 = the softest on ShotPropz).
  const pk = spzCell(spz, 'defense', 'pkPct', opp);
  const pkLeague = mean(spz.boards?.defense?.all?.ytd?.pkPct);
  let kill = null;
  if (pk && pkLeague != null && pk.gp >= 1) {
    const kills = pk.gp * (spzCell(spz, 'defense', 'ppoa', opp)?.value ?? L);
    const w = kills / (kills + ST.K_KILL);
    const raw = Math.max(0.2, (100 - pk.value) / Math.max(1, 100 - pkLeague));
    kill = { pk: pk.value, rank: pk.rank, n: pk.n, league: r2(pkLeague), kills: Math.round(kills), raw: r3(raw), leak: r3(w * raw + (1 - w)), w: r3(w) };
  }
  // What the forecast is worth inside a game, as a team-level change: the extra power plays (over the team's usual) × a power
  // play's worth, and the extra kills × a kill's cost. `mechanical` is that change over the team's usual shots and goals a game
  // (ShotPropz's boards); the factor on the team's total takes `teamWeight` of it (0 as measured: the allowed table has it).
  const dPP = expFor - usualFor; const dPK = expAgainst - usualAgainst;
  const shotsMoved = dPP * ST.worth.shotsPerPP + dPK * ST.worth.shotsPerPK;
  const goalsMoved = dPP * ST.conv * (kill ? kill.leak : 1);
  const sf = spzCell(spz, 'offense', 'sf', team)?.value; const gf = spzCell(spz, 'offense', 'gf', team)?.value;
  const mechanical = { shots: r3(1 + (dPP * ST.worth.shotsPerPP + dPK * ST.worth.shotsPerPK) / (sf > 0 ? sf : 28)), goals: r3(1 + (dPP * ST.worth.goalsPerPP + dPK * ST.worth.goalsPerPK) / (gf > 0 ? gf : 3.1)) };
  const shots = Math.pow(mechanical.shots, ST.teamWeight); const goals = Math.pow(mechanical.goals, ST.teamWeight);
  const f1 = (v) => (v == null ? '—' : Number(v).toFixed(1));
  const f2 = (v) => (v == null ? '—' : Number(v).toFixed(2));
  const ordinal = (r, n) => (r == null ? '' : ` (${r}${r === 1 ? 'st' : r === 2 ? 'nd' : r === 3 ? 'rd' : 'th'} of ${n || 32})`);
  const text = [
    `Power plays tonight: ${team} should get about ${f1(expFor)} (${f1(usualFor)} against an average opponent: it draws ${f1(drawn?.value)} a game${drawn ? ordinal(drawn.rank, drawn.n) : ''}, ${opp} gives ${f1(oppGiven?.value)}${oppGiven ? ordinal(oppGiven.rank, oppGiven.n) : ''}, the league ${f1(L)}) and kill about ${f1(expAgainst)} (${f1(usualAgainst)} usually: it gives ${f1(given?.value)}, ${opp} draws ${f1(oppDrawn?.value)}).`,
    kill ? `${opp}'s penalty kill: ${f1(kill.pk)}% against the league's ${f1(kill.league)}%${ordinal(kill.rank, kill.n).replace(')', ' softest)')}, leaking ${kill.leak}× the league's goals a kill after ${kill.kills} kills.` : null,
    `Inside a game a power play is worth +${f2(ST.worth.shotsPerPP)} shots and a kill ${f2(ST.worth.shotsPerPK)}, so tonight's count moves ${team}'s shots ${shotsMoved >= 0 ? '+' : ''}${f2(shotsMoved)} and its power-play goals ${goalsMoved >= 0 ? '+' : ''}${f2(goalsMoved)} against its usual — moved to its power-play units by slot, the side's total untouched: the opponent's penalties are already in the shots it allows (measured on 2025-26, docs/audits/2026-10-31-nhl-special-teams-and-score.md).`,
  ].filter(Boolean).join(' ');
  return {
    team, opp,
    ppFor: { own: drawn, oppGives: oppGiven, league: r2(L), expected: r2(expFor), usual: r2(usualFor), delta: r2(expFor - usualFor) },
    ppAgainst: { own: given, oppDraws: oppDrawn, league: r2(L), expected: r2(expAgainst), usual: r2(usualAgainst), delta: r2(expAgainst - usualAgainst) },
    kill,
    factor: { shots: r3(shots), goals: r3(goals) },
    mechanical,
    shift: { shots: r3(shotsMoved), goals: r3(goalsMoved) },
    text,
  };
}

/**
 * The special-teams change split over the skaters: `skaters` [{ id, pos, line, lamS, lamG }] (the dressed skaters with a
 * read), `st` from specialTeamsRead. Two parts: the team-level change (Σ λ × (factor − 1), 0 at `teamWeight` 0) shared by
 * power-play weight, and the redistribution — `shift` × `redistribute` moved to the skaters by their power-play weight and
 * the same amount taken off everyone evenly, so a first-unit forward gains what the fourth line and the third pair give up
 * and the side's sum is unchanged (extra kills shift the other way). Returns a Map id → { dS, dG, w, share } (the additive
 * change on his λ shots and goals; `share` his weight's share of the units); an empty Map without a read.
 */
export function splitSpecialTeams(skaters, st) {
  const out = new Map();
  if (!st || !Array.isArray(skaters) || !skaters.length) return out;
  const list = skaters.filter((s) => s && s.id != null && s.lamS > 0);
  if (!list.length) return out;
  const totS = list.reduce((t, s) => t + s.lamS, 0); const totG = list.reduce((t, s) => t + (s.lamG || 0), 0);
  const teamS = totS * ((st.factor?.shots ?? 1) - 1); const teamG = totG * ((st.factor?.goals ?? 1) - 1);
  const moveS = (st.shift?.shots || 0) * ST.redistribute; const moveG = (st.shift?.goals || 0) * ST.redistribute;
  const weights = list.map((s) => ppWeight(s.pos, s.line));
  const sumW = weights.reduce((a, b) => a + b, 0);
  if (!(sumW > 0)) return out;
  const n = list.length;
  list.forEach((s, i) => {
    const share = weights[i] / sumW;
    out.set(s.id, { dS: r3(teamS * share + moveS * (share - 1 / n)), dG: r3(teamG * share + moveG * (share - 1 / n)), w: weights[i], share: r3(share) });
  });
  return out;
}

/**
 * A projection with the special-teams change on it: λ shots and goals moved by `d` ({ dS, dG }), the market tails
 * read again off the new λ, the figures before it kept as `beforeSt` and the change as `st`. The projection back
 * unchanged without a change.
 */
export function withSpecialTeams(proj, d, poissonAtLeast) {
  if (!proj || !d || (!d.dS && !d.dG)) return proj;
  const lamS = Math.max(0.05, proj.lamS + d.dS); const lamG = Math.max(0.01, (proj.lamG || 0) + d.dG);
  const r2b = (v) => Math.round(v * 100) / 100;
  return {
    ...proj,
    lamS: r3(lamS), lamG: r3(lamG),
    p2: r2b(poissonAtLeast(lamS, 2)), p3: r2b(poissonAtLeast(lamS, 3)), p4: r2b(poissonAtLeast(lamS, 4)),
    p1g: r2b(1 - Math.exp(-lamG)),
    beforeSt: { lamS: proj.lamS, lamG: proj.lamG, p3: proj.p3, p4: proj.p4, p1g: proj.p1g },
    st: { dS: d.dS, dG: d.dG, w: d.w, share: d.share },
  };
}
