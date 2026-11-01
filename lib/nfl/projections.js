// The week's projections (Vincent, 2026-11-01: "I don't care about edge. I want us to write a script based on the data
// from propfinder and the cheat sheet. That is how we can come to the projected yards / TD candidates per game"): per
// game and per player, what the board expects him to gain and how likely he is to score — no price, no edge. Pure: the
// NFL binding runs it on every built board (lib/nfl/picks.js `projections`), `tools/nfl-projections.mjs` prints it.
//
// Yards (passing, rushing, receiving): the board's projection — his rate from PropFinder's logs (the season blended with
// his last ten, the without-teammate split and the vacated lift in) × the opponent's table at his depth-chart slot (the
// cheat sheet's tile beside PropFinder's when the sheet has one) — `ranges[market]` on the side player, with the quartiles
// × tonight's game script (`scriptOf`: the book's total against the team's usual scoring, the spread's lean to the run or
// the pass), read as a floor, a projection and a ceiling (his 20th and 80th percentile tonight, his own spread scaled with
// the script). The book's main line and the cheat sheet's line ride beside it, never into it.
//
// Touchdowns, from the team down:
//   1. the team's touchdowns tonight (`teamTd`): its own touchdowns a game this season (PropFinder's team row) through the
//      opponent's touchdowns allowed (the league's average as the base, damped as every matchup is, envFactor), and the
//      book's game total and spread (ESPN's line: the team's implied points × TD_PER_POINT), the two averaged when both
//      exist; `teamFactor` = that over its own touchdowns a game (TEAM_CLAMP);
//   2. his own scoring rate: his touchdowns a game (rushing + receiving + returns; season 0.6, last five 0.4), pulled
//      toward his volume — his projected carries + targets tonight × his position's touchdowns per touch across the pull —
//      at n / (n + RATE_K) on his games this season, so a touchdown-heavy start on little volume reads short of its rate
//      and a role that grew tonight (an out teammate's carries) reads in;
//   3. where the defense gives them up (`posShift`): the opponent's touchdowns allowed at his spot over what it allows in
//      all (POS_CLAMP), so a run defense leaking to backs moves the backs, not the team twice.
//   λ = rate × teamFactor × posShift; P(anytime) = 1 − e^(−λ); P(first half) = 1 − e^(−H1_SHARE · λ).
// A player out tonight is left off; "if active" / "if role confirmed" ride beside a name (roleOf).
import { matchupOf, envFactor } from '../picks/projection';

// The constants below were searched on 2025's weeks 4–18 and checked unchanged on 2026's weeks 1–7 (tools/audit/nfl-audit.mjs,
// docs/audits/2026-11-01-nfl-backtest.md; Vincent, 2026-11-01: "yes do the backtest and optimize it").
export const TD_PER_POINT = 0.105;   // offensive touchdowns per point scored (NFL: about 2.4 a team-game on 23 points)
export const H1_SHARE = 0.48;        // the share of his expected touchdowns before the half (searched: 0.48, 1H Brier 0.0865 → 0.0852)
export const RATE_K = 16;            // his games this season before his own touchdown rate counts half (4 before: his volume knows more)
export const RATE_WEIGHTS = { season: 0.6, l5: 0.4 };
export const TEAM_CLAMP = [0.6, 1.6];
// Where the defense gives its touchdowns up (the position against its overall) read nothing on top of the team's figure:
// off ([1, 1]; [0.7, 1.4] before).
export const POS_CLAMP = [1, 1];
export const SKILL = ['QB', 'RB', 'WR', 'TE'];
/** The weak spots a side's card names, with the players each opens up. */
export const ATTACK_MAX = 4;

const r1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);
const r2 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100);
const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);
const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));
const surname = (name) => String(name || '').trim().split(/\s+/).slice(-1)[0] || String(name || '');

/** "100+" for o99.5, "o100" for a whole line. */
export const markOf = (line) => (line == null ? '—' : Number.isInteger(line) ? `o${line}` : `${Math.ceil(line)}+`);

/** The spread's favourite and points as ESPN writes it ("KC -2.5", "EVEN", "PK"): { team, pts } or null. */
export function spreadOf(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  if (/^(even|pk|pick)/i.test(s)) return { team: null, pts: 0 };
  const m = s.match(/^([A-Z]{2,4})\s*([+-]?\d+(?:\.\d+)?)$/i);
  if (!m) return null;
  const pts = Math.abs(Number(m[2]));
  return Number.isFinite(pts) ? { team: m[1].toUpperCase(), pts } : null;
}

/** A team's implied points from the game total and the spread (the favourite total/2 + spread/2), null without a total. */
export function impliedPoints(odds, team) {
  const total = Number(odds?.total);
  if (!(total > 0)) return null;
  const sp = spreadOf(odds?.spread);
  if (!sp) return r1(total / 2);
  if (!sp.team) return r1(total / 2);
  return r1(total / 2 + (sp.team === team ? 1 : -1) * (sp.pts / 2));
}

/**
 * The words beside a name: [{ kind: 'active' | 'role', word, why }]. 'active' when he is a game-time decision; 'role'
 * when his read leans on a teammate out — his without-teammate split, else the production the out players left him
 * (`own[stat].lift`).
 */
export function roleOf(sp, stats = []) {
  const out = [];
  if (sp?.health === 'DTD') out.push({ kind: 'active', word: 'if active', why: `${sp.injury || 'Listed'}${sp.injuryDetail ? `: ${sp.injuryDetail}` : ''} — a game-time decision` });
  const wo = sp?.without || null;
  if (wo?.names?.length) {
    out.push({ kind: 'role', word: 'if role confirmed', why: `${wo.names.join(', ')} out: his read leans on his ${wo.n} game${wo.n === 1 ? '' : 's'} without ${wo.names.length > 1 ? 'them' : 'him'} (${Math.round((wo.weight || 0) * 100)}% of the way)` });
    return out;
  }
  for (const stat of stats) {
    const lift = sp?.own?.[stat]?.lift;
    if (!(lift > 0)) continue;
    const who = (sp.own[stat].liftFrom || []).map((n) => surname(typeof n === 'string' ? n : n?.name)).join(', ');
    out.push({ kind: 'role', word: 'if role confirmed', why: `${who || 'A teammate'} out: the production left behind lifts his rate (+${r1(lift)} ${stat} a game)` });
    break;
  }
  return out;
}

/** A touchdown chance's word (Vincent, 2026-11-01): strong from 45%, lean from 30%, thin under that. */
export const TD_TIERS = { strong: 0.45, lean: 0.3 };
export const tdTier = (p) => (p == null ? null : p >= TD_TIERS.strong ? 'strong' : p >= TD_TIERS.lean ? 'lean' : 'thin');
/** A touchdown chance under this is no candidate on the lists. */
export const LIST_TD_MIN = 0.05;

/**
 * Tonight's game script on a side's yards (Vincent, 2026-11-01: "based on today's matchup and the player's skill, and
 * today's script, this is the floor and this is the ceiling"), from the book's total and spread as ESPN carries them:
 *   volume — the points the book expects of the team over its own scoring this season (its touchdowns a game over
 *            TD_PER_POINT), at `volume` = half the way (yards follow points less than one for one), 0.85–1.15;
 *   run / pass — the favourite leans on the run as the game goes, the underdog throws: + `rush` a point of spread on the
 *            run and − `pass` on the pass for the favourite, the other way for the underdog, 0.9–1.1.
 * Set by hand, not measured (no NFL season has been replayed here); the hovers spell each factor out.
 */
// Measured: on top of his rate and the matchup the book's total and spread move no yards projection for the better (2025:
// the pooled miss 0.9825 of the shipped read with no script, 0.9916 at the first cut's 0.5 / 0.012 / 0.008; 2026 weeks
// 1–7: 0.9626 against 0.9739), so the script carries no weight on the yards; the line still feeds the touchdowns.
export const SCRIPT = { volume: 0, rush: 0, pass: 0, volumeClamp: [0.85, 1.15], splitClamp: [0.9, 1.1] };
export function scriptOf(odds, team, ownTd, { SCRIPT: S = SCRIPT, TD_PER_POINT: TPP = TD_PER_POINT } = {}) {
  const pts = impliedPoints(odds, team);
  const sp = spreadOf(odds?.spread);
  const signed = sp ? (sp.team == null ? 0 : sp.team === team ? sp.pts : -sp.pts) : null;
  const usual = ownTd > 0 ? ownTd / TPP : null;
  const volume = pts != null && usual ? r3(clamp(1 + S.volume * (pts / usual - 1), S.volumeClamp)) : 1;
  const rush = signed != null ? r3(clamp(1 + S.rush * signed, S.splitClamp)) : 1;
  const pass = signed != null ? r3(clamp(1 - S.pass * signed, S.splitClamp)) : 1;
  const words = [];
  if (pts != null) words.push(`${r1(pts)} points implied${usual ? ` against its usual ${r1(usual)}` : ''}`);
  if (signed) words.push(signed > 0 ? `favoured by ${Math.abs(signed)}` : `${Math.abs(signed)}-point underdog`);
  return { points: pts, usual: usual ? r1(usual) : null, spread: signed, volume, rush, pass, from: pts != null || signed != null ? 'line' : null, words };
}

/** The script's factor on a market: the volume, then the run or the pass (receptions and receiving yards ride the pass). */
export const scriptFactor = (script, market) => (script ? r3(script.volume * (market === 'rush_yds' ? script.rush : script.pass)) : 1);

/** The floor and the ceiling read off his distribution tonight: his 20th and 80th percentile (a bad day, a good day). */
export const RANGE_Z = 0.8416;
/** Per market the floor's and the ceiling's distance from the projection in his spreads ([below, above]). */
// Fitted: the distances that put a fifth of 2025's games under the floor and a fifth over the ceiling (a game's yards run
// longer above the projection than below it, so the floor sits further down than the ceiling sits up).
export const RANGE = { pass_yds: [1.04, 0.848], rush_yds: [0.942, 0.927], rec_yds: [0.998, 0.896], receptions: [1.076, 0.909] };
/** The book's implied points' share in the team's touchdowns tonight (the rest its own rate through the defense; 0.5 before). */
export const LINE_WEIGHT = 0.25;
/** The touchdown chance recalibrated to what the same stated chance landed: σ(a + b · logit(p)); identity by default. */
// Fitted on 2025 (the stated chance ran high at the top, low at the bottom): 45%+ said 54%, landed 45% before.
export const TD_CAL = { a: -0.1671, b: 0.8573 };
const logit = (p) => Math.log(p / (1 - p));
export const tdCalibrated = (p, cal = TD_CAL) => (p == null || !cal || (cal.a === 0 && cal.b === 1) ? p : 1 / (1 + Math.exp(-(cal.a + cal.b * logit(Math.min(0.999, Math.max(0.001, p)))))));
/** Every constant `nflProjections` reads; the audit (tools/audit/nfl-audit.mjs) passes others as `params`. */
export const PARAMS = { TD_PER_POINT, H1_SHARE, RATE_K, RATE_WEIGHTS, TEAM_CLAMP, POS_CLAMP, SCRIPT, RANGE, LINE_WEIGHT, TD_CAL };

/**
 * The projections for a built board.
 *   board: lib/picks/board.js buildBoard's output (games with `sides`, `odds`)
 *   pf: the slate's PropFinder file ({ data: { players, defense } }), results: the stored box scores by game id
 *   helpers: { logAverages, actualFor, statOf } from the NFL binding (board.js stays out of this file: it reaches the store)
 * → { rows (by id), games: [{ …, teams: { ABBR: { teamTd, defense } }, lists }], lists: { td, receiving, rushing }, perTouch,
 *     sheetDirection, constants }
 */
export function nflProjections(board, { pf = null, results = {}, season, sheetDefense = null, helpers, params = null }) {
  const P = { ...PARAMS, ...(params || {}) };
  const { logAverages, actualFor, statOf } = helpers;
  const players = pf?.data?.players || [];
  const defense = pf?.data?.defense || null;
  const byKey = new Map();
  for (const p of players) { const list = byKey.get(p.key) || []; list.push(p); byKey.set(p.key, list); }
  const pfpOf = (key, team) => { const list = byKey.get(key) || []; return list.find((p) => p.team === team) || list[0] || null; };
  const thisSeason = (g) => g.season === season && (g.type === 'REG' || !g.type);

  // Touchdowns per touch by position across the pull's skill players this season: the volume prior behind every rate.
  const perTouch = {};
  for (const pos of SKILL) {
    let td = 0; let touches = 0;
    for (const p of players) {
      if (p.pos !== pos) continue;
      for (const g of p.games || []) if (thisSeason(g)) { td += Number(g.td) || 0; touches += (Number(g.rushAtt) || 0) + (pos === 'QB' ? 0 : Number(g.tgt) || 0); }
    }
    perTouch[pos] = touches >= 50 ? r3(td / touches) : null;
  }

  const leagueTd = defense?.leagueFor?.td ?? null;
  const teamTdOf = (g, team, opp) => {
    const own = defense?.totals?.[team]?.for?.td ?? null;
    const oppAgainst = defense?.totals?.[opp]?.against?.td ?? null;
    const fromTable = own != null ? r2(own * (envFactor(oppAgainst, leagueTd) ?? 1)) : null;
    const pts = impliedPoints(g.odds, team);
    const fromLine = pts != null ? r2(pts * P.TD_PER_POINT) : null;
    const tonight = fromTable != null && fromLine != null ? r2((1 - P.LINE_WEIGHT) * fromTable + P.LINE_WEIGHT * fromLine) : fromTable ?? fromLine;
    const factor = own > 0 && tonight != null ? r3(clamp(tonight / own, P.TEAM_CLAMP)) : 1;
    return { tonight, own, oppAgainst, fromTable, fromLine, points: pts, factor, from: fromTable != null && fromLine != null ? 'both' : fromTable != null ? 'propfinder' : fromLine != null ? 'line' : null };
  };

  const games = [];
  const all = [];
  for (const g of board?.games || []) {
    const result = results?.[g.id] || null;
    const teams = {};
    for (const team of [g.away, g.home]) {
      const side = g.sides?.[team];
      if (!side) continue;
      const opp = side.opp;
      const teamTd = teamTdOf(g, team, opp);
      const script = scriptOf(g.odds, team, teamTd.own, P);
      const allowed = side.allowed || null;
      // The opponent's touchdowns allowed in all as a factor: what posShift divides by.
      const allFactor = envFactor(teamTd.oppAgainst, leagueTd);
      const rows = [];
      for (const sp of side.players || []) {
        if (sp.out || !SKILL.includes(sp.pos)) continue;
        const pfp = pfpOf(sp.key, team);
        const logs = pfp?.games || [];
        if (!logs.length) continue;
        const got = result ? actualFor(result, { key: sp.key, player: sp.player, team }) : undefined;
        const gotOf = (market) => (got === undefined ? undefined : got && got.played !== false ? statOf(got, market) : null);
        // Touchdowns.
        const tdAvg = logAverages(logs, { season, field: 'td' });
        const parts = Object.entries(P.RATE_WEIGHTS).filter(([w]) => tdAvg[w] != null);
        const rate = parts.length ? parts.reduce((s, [w, x]) => s + tdAvg[w] * x, 0) / parts.reduce((s, [, x]) => s + x, 0) : null;
        const n = logs.filter(thisSeason).length;
        const carries = sp.ranges?.rush_att?.exp ?? logAverages(logs, { season, field: 'rushAtt' }).season ?? 0;
        const targets = sp.pos === 'QB' ? 0 : sp.ranges?.targets?.exp ?? logAverages(logs, { season, field: 'tgt' }).season ?? 0;
        const touches = r1((carries || 0) + (targets || 0));
        const prior = perTouch[sp.pos] != null ? perTouch[sp.pos] * touches : null;
        const own = rate == null ? prior : prior == null ? rate : (n * rate + P.RATE_K * prior) / (n + P.RATE_K);
        const cellPos = sp.envPos && allowed?.rows?.[sp.envPos]?.td ? sp.envPos : allowed?.rows?.[sp.pos]?.td ? sp.pos : null;
        const cell = cellPos ? allowed.rows[cellPos].td : null;
        const mf = cell ? matchupOf(cell, allowed?.league?.[cellPos]?.td ?? null, allowed?.count || 32).factor : null;
        const shiftRaw = mf != null ? (allFactor ? mf / allFactor : mf) : null;
        const posShift = shiftRaw != null ? r3(clamp(shiftRaw, P.POS_CLAMP)) : 1;
        const stated = own != null ? own * teamTd.factor * posShift : null;
        // The chance through the touchdown calibration, the expected touchdowns read back off it, the first half's share of them.
        const pTd = stated != null ? r3(tdCalibrated(1 - Math.exp(-stated), P.TD_CAL)) : null;
        const lambda = pTd != null ? r3(-Math.log(1 - Math.min(0.999, pTd))) : null;
        const td = lambda != null && (touches > 0 || rate > 0) ? {
          lambda, p: pTd, p1h: r3(1 - Math.exp(-P.H1_SHARE * lambda)), tier: tdTier(pTd), raw: r3(1 - Math.exp(-stated)),
          rate: r3(rate), l5: tdAvg.l5, season: tdAvg.season, n, touches, carries: r1(carries), targets: r1(targets), prior: r3(prior), own: r3(own),
          teamFactor: teamTd.factor, posShift, shiftRaw: r3(shiftRaw), spot: cell ? { pos: cellPos, rank: cell.rankBlend ?? cell.rank ?? null, value: cell.value ?? null, count: allowed?.count || null } : null,
          actual: gotOf('anytime_td'), actual1h: gotOf('h1_anytime_td'),
        } : null;
        // Yards.
        const yards = {};
        for (const market of ['pass_yds', 'rush_yds', 'rec_yds', 'receptions']) {
          const range = sp.ranges?.[market];
          if (range?.exp == null || !(range.exp > 0)) continue;
          const stat = { pass_yds: 'passYds', rush_yds: 'rushYds', rec_yds: 'recYds', receptions: 'rec' }[market];
          const c = sp.envPos ? allowed?.rows?.[sp.envPos]?.[stat] : null;
          const sheet = (sp.plays || []).find((x) => x.market === market && x.onSheet) || null;
          const actual = gotOf(market);
          // Tonight: his skill × the matchup (the board's projection) × the game script, his spread scaled with it.
          const f = scriptFactor(script, market);
          const sd = sp.ladders?.[market]?.[0]?.sd ?? null;
          const proj = r1(range.exp * f);
          const sdRaw = sd;
          const spread = sd != null ? sd * f : null;
          const dec = market === 'receptions' ? 1 : 0;
          const round = (v) => (dec ? r1(v) : Math.round(v));
          const [zLo, zHi] = P.RANGE[market] || [RANGE_Z, RANGE_Z];
          const floor = spread != null ? round(Math.max(0, proj - zLo * spread)) : null;
          const ceiling = spread != null ? round(proj + zHi * spread) : null;
          yards[market] = {
            proj, floor, ceiling, sd: sdRaw != null ? r2(sdRaw * f) : null, exp: range.exp, script: f, rate: range.rate ?? null, matchup: range.matchup ?? null, matchupFrom: range.matchupFrom?.from || null,
            line: range.line ?? null, sheetLine: sheet?.line ?? null, actual,
            grade: actual == null || floor == null ? null : actual < floor ? 'under' : actual > ceiling ? 'over' : 'inside',
            spot: c ? { pos: sp.envPos, rank: c.rankBlend ?? c.rank ?? null, value: c.value ?? null, count: allowed?.count || null } : null,
          };
        }
        if (!td && !Object.keys(yards).length) continue;
        const row = {
          id: `${sp.key}|${team}`, player: sp.player, key: sp.key, espnId: sp.espnId || got?.espnId || null, team, opp, venue: side.venue, pos: sp.pos, slot: sp.slot || null, depth: sp.depth || null,
          game: g.id, start: g.date || null, final: !!g.final, health: sp.health || null, injury: sp.injury || null,
          onSheet: (sp.plays || []).some((x) => x.onSheet), role: roleOf(sp, ['rushAtt', 'tgt', 'recYds', 'rushYds']), td, yards,
        };
        rows.push(row); all.push(row);
      }
      // The defense's weak spots (the cheat sheet's snapshot) with the players they open up on this side: the pass → the
      // quarterback, the run → the lead back, the outside zones → WR1 / WR2, the middle → the tight end and the slot.
      const def = sheetDefense?.teams?.[opp] || null;
      const attack = def ? def.weak.slice(0, ATTACK_MAX).map((w) => {
        const recBy = (ok) => rows.filter((r) => r.yards.rec_yds && ok(r)).sort((a, b) => b.yards.rec_yds.proj - a.yards.rec_yds.proj);
        const outside = (r) => r.pos === 'WR' && (!r.slot || /^WR[12]$/.test(r.slot));
        const middle = (r) => r.pos === 'TE' || r.slot === 'WR3';
        const list = w.key === 'passYds' ? rows.filter((r) => r.yards.pass_yds).sort((a, b) => b.yards.pass_yds.proj - a.yards.pass_yds.proj).slice(0, 1)
          : w.key === 'rushYds' || w.key === 'rushYpp' ? rows.filter((r) => r.yards.rush_yds && r.pos === 'RB').sort((a, b) => b.yards.rush_yds.proj - a.yards.rush_yds.proj).slice(0, 1)
            : /M$/.test(w.key) ? recBy(middle).slice(0, 2)
              : w.key.startsWith('short') ? recBy((r) => outside(r) || r.pos === 'RB').slice(0, 2) : recBy(outside).slice(0, 2);
        return { ...w, ids: list.map((r) => r.id) };
      }) : [];
      teams[team] = {
        team, opp, venue: side.venue, teamTd, script,
        // The defense it faces as the cheat sheet's snapshot reads it (lib/nfl/snapshot.js): its weak and strong spots.
        defense: def ? { of: opp, weak: def.weak, strong: def.strong, style: def.style, coverage: def.coverage, printed: def.printed, attack } : null,
      };
    }
    const mine = all.filter((r) => r.game === g.id);
    games.push({ id: g.id, away: g.away, home: g.home, date: g.date || null, final: !!g.final, state: g.state || null, awayScore: g.awayScore ?? null, homeScore: g.homeScore ?? null, odds: g.odds || null, teams, lists: listsOf(mine) });
  }
  const lists = listsOf(all);
  return {
    rows: Object.fromEntries(all.map((r) => [r.id, r])),
    games,
    lists,
    perTouch,
    sheetDirection: sheetDefense?.direction || null,
    constants: { ...P, TD_TIERS },
  };
}

/** A minimum projection before a player is on the yards lists (a fullback's 4 yards is noise). */
export const LIST_YDS_MIN = 10;
/**
 * The three lists of the Matchups tab and the slate tabs (Vincent, 2026-11-01): touchdowns (every skill player from
 * LIST_TD_MIN, the likeliest first), receiving (receivers, tight ends and backs, the projected yards first) and rushing
 * (backs and quarterbacks, the projected yards first). { td, receiving, rushing } of row ids.
 */
export function listsOf(rows) {
  const ids = (list) => list.map((r) => r.id);
  const by = (market) => (a, b) => b.yards[market].proj - a.yards[market].proj || a.player.localeCompare(b.player);
  return {
    td: ids(rows.filter((r) => r.td && r.td.p >= LIST_TD_MIN).sort((a, b) => b.td.p - a.td.p || a.player.localeCompare(b.player))),
    receiving: ids(rows.filter((r) => ['WR', 'TE', 'RB'].includes(r.pos) && r.yards.rec_yds?.proj >= LIST_YDS_MIN).sort(by('rec_yds'))),
    rushing: ids(rows.filter((r) => ['RB', 'QB'].includes(r.pos) && r.yards.rush_yds?.proj >= LIST_YDS_MIN).sort(by('rush_yds'))),
  };
}
