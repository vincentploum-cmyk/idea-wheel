// The week's projections (Vincent, 2026-11-01: "I don't care about edge. I want us to write a script based on the data
// from propfinder and the cheat sheet. That is how we can come to the projected yards / TD candidates per game"): per
// game and per player, what the board expects him to gain and how likely he is to score — no price, no edge. Pure: the
// NFL binding runs it on every built board (lib/nfl/picks.js `projections`), `tools/nfl-projections.mjs` prints it.
//
// Yards (passing, rushing, receiving): the board's projection — his rate from PropFinder's logs (the season blended with
// his last ten, the without-teammate split and the vacated lift in) × the opponent's table at his depth-chart slot (the
// cheat sheet's tile beside PropFinder's when the sheet has one) — `ranges[market]` on the side player, with the quartiles
// of his range and the heights he clears at 60 / 45 / 30% off his ladder (`marks`). The book's main line and the cheat
// sheet's line ride beside it, never into it.
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

export const TD_PER_POINT = 0.105;   // offensive touchdowns per point scored (NFL: about 2.4 a team-game on 23 points)
export const H1_SHARE = 0.5;         // the share of a game's touchdowns scored before the half
export const RATE_K = 4;             // his games this season before his own touchdown rate counts half
export const RATE_WEIGHTS = { season: 0.6, l5: 0.4 };
export const TEAM_CLAMP = [0.6, 1.6];
export const POS_CLAMP = [0.7, 1.4];
export const SKILL = ['QB', 'RB', 'WR', 'TE'];
/** A touchdown chance under this is no candidate (a pocket passer's rushing touchdown): off the touchdown boards and lists. */
export const TD_MIN = 0.03;
/** How many rows each board shows (Vincent's lists), and per game per team. */
export const SHOWN = { td: 10, firstHalfTd: 8, receiving: 8, rushing: 6, passing: 4, teTd: 3 };
export const PER_GAME = { passing: 1, rushing: 2, receiving: 3, td: 4 };
/** The chances the ladder marks are read at: likely, lean, stretch. */
export const MARK_AT = [0.6, 0.45, 0.3];
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

/** The heights a ladder clears at MARK_AT: [{ at, line, mark, p }], the highest rung at each chance. */
export function marksOf(rungs) {
  const out = [];
  for (const at of MARK_AT) {
    const r = [...(rungs || [])].filter((x) => x.p != null && x.p >= at).sort((a, b) => b.line - a.line)[0];
    if (r && !out.some((x) => x.line === r.line)) out.push({ at, line: r.line, mark: markOf(r.line), p: r.p });
  }
  return out;
}

/**
 * The projections for a built board.
 *   board: lib/picks/board.js buildBoard's output (games with `sides`, `odds`)
 *   pf: the slate's PropFinder file ({ data: { players, defense } }), results: the stored box scores by game id
 *   helpers: { logAverages, actualFor, statOf } from the NFL binding (board.js stays out of this file: it reaches the store)
 * → { games: [...], boards: { td, firstHalfTd, receiving, rushing, passing, teTd }, perTouch, constants }
 */
export function nflProjections(board, { pf = null, results = {}, season, sheetDefense = null, helpers }) {
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
    const fromLine = pts != null ? r2(pts * TD_PER_POINT) : null;
    const tonight = fromTable != null && fromLine != null ? r2((fromTable + fromLine) / 2) : fromTable ?? fromLine;
    const factor = own > 0 && tonight != null ? r3(clamp(tonight / own, TEAM_CLAMP)) : 1;
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
        const parts = Object.entries(RATE_WEIGHTS).filter(([w]) => tdAvg[w] != null);
        const rate = parts.length ? parts.reduce((s, [w, x]) => s + tdAvg[w] * x, 0) / parts.reduce((s, [, x]) => s + x, 0) : null;
        const n = logs.filter(thisSeason).length;
        const carries = sp.ranges?.rush_att?.exp ?? logAverages(logs, { season, field: 'rushAtt' }).season ?? 0;
        const targets = sp.pos === 'QB' ? 0 : sp.ranges?.targets?.exp ?? logAverages(logs, { season, field: 'tgt' }).season ?? 0;
        const touches = r1((carries || 0) + (targets || 0));
        const prior = perTouch[sp.pos] != null ? perTouch[sp.pos] * touches : null;
        const own = rate == null ? prior : prior == null ? rate : (n * rate + RATE_K * prior) / (n + RATE_K);
        const cellPos = sp.envPos && allowed?.rows?.[sp.envPos]?.td ? sp.envPos : allowed?.rows?.[sp.pos]?.td ? sp.pos : null;
        const cell = cellPos ? allowed.rows[cellPos].td : null;
        const mf = cell ? matchupOf(cell, allowed?.league?.[cellPos]?.td ?? null, allowed?.count || 32).factor : null;
        const posShift = mf != null ? r3(clamp(allFactor ? mf / allFactor : mf, POS_CLAMP)) : 1;
        const lambda = own != null ? r3(own * teamTd.factor * posShift) : null;
        const td = lambda != null && (touches > 0 || rate > 0) ? {
          lambda, p: r3(1 - Math.exp(-lambda)), p1h: r3(1 - Math.exp(-H1_SHARE * lambda)),
          rate: r3(rate), l5: tdAvg.l5, season: tdAvg.season, n, touches, carries: r1(carries), targets: r1(targets), prior: r3(prior), own: r3(own),
          teamFactor: teamTd.factor, posShift, spot: cell ? { pos: cellPos, rank: cell.rankBlend ?? cell.rank ?? null, value: cell.value ?? null, count: allowed?.count || null } : null,
          actual: gotOf('anytime_td'), actual1h: gotOf('first_half_td'),
        } : null;
        // Yards.
        const yards = {};
        for (const market of ['pass_yds', 'rush_yds', 'rec_yds']) {
          const range = sp.ranges?.[market];
          if (range?.exp == null || !(range.exp > 0)) continue;
          const stat = { pass_yds: 'passYds', rush_yds: 'rushYds', rec_yds: 'recYds' }[market];
          const c = sp.envPos ? allowed?.rows?.[sp.envPos]?.[stat] : null;
          const sheet = (sp.plays || []).find((x) => x.market === market && x.onSheet) || null;
          const actual = gotOf(market);
          const marks = marksOf(sp.ladders?.[market]).map((m) => ({ ...m, hit: actual == null ? null : actual > m.line }));
          yards[market] = {
            exp: range.exp, floor: range.floor, ceiling: range.ceiling, rate: range.rate ?? null, matchup: range.matchup ?? null, matchupFrom: range.matchupFrom?.from || null,
            line: range.line ?? null, sheetLine: sheet?.line ?? null, marks, actual,
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
      const top = (list, n) => list.slice(0, n);
      // The defense's weak spots (the cheat sheet's snapshot) with the players they open up on this side: the pass → the
      // quarterback, the run → the lead back, the outside zones → WR1 / WR2, the middle → the tight end and the slot.
      const def = sheetDefense?.teams?.[opp] || null;
      const attack = def ? def.weak.slice(0, ATTACK_MAX).map((w) => {
        const recBy = (ok) => rows.filter((r) => r.yards.rec_yds && ok(r)).sort((a, b) => b.yards.rec_yds.exp - a.yards.rec_yds.exp);
        const outside = (r) => r.pos === 'WR' && (!r.slot || /^WR[12]$/.test(r.slot));
        const middle = (r) => r.pos === 'TE' || r.slot === 'WR3';
        const list = w.key === 'passYds' ? rows.filter((r) => r.yards.pass_yds).sort((a, b) => b.yards.pass_yds.exp - a.yards.pass_yds.exp).slice(0, 1)
          : w.key === 'rushYds' || w.key === 'rushYpp' ? rows.filter((r) => r.yards.rush_yds && r.pos === 'RB').sort((a, b) => b.yards.rush_yds.exp - a.yards.rush_yds.exp).slice(0, 1)
            : /M$/.test(w.key) ? recBy(middle).slice(0, 2)
              : w.key.startsWith('short') ? recBy((r) => outside(r) || r.pos === 'RB').slice(0, 2) : recBy(outside).slice(0, 2);
        return { ...w, ids: list.map((r) => r.id) };
      }) : [];
      const byYards = (market) => rows.filter((r) => r.yards[market]).sort((a, b) => b.yards[market].exp - a.yards[market].exp);
      teams[team] = {
        team, opp, venue: side.venue, teamTd,
        // The defense it faces as the cheat sheet's snapshot reads it (lib/nfl/snapshot.js): its weak and strong spots.
        defense: def ? { of: opp, weak: def.weak, strong: def.strong, style: def.style, coverage: def.coverage, printed: def.printed, attack } : null,
        passing: top(byYards('pass_yds'), PER_GAME.passing).map((r) => r.id),
        rushing: top(byYards('rush_yds'), PER_GAME.rushing).map((r) => r.id),
        receiving: top(byYards('rec_yds'), PER_GAME.receiving).map((r) => r.id),
        td: top(rows.filter((r) => r.td && r.td.p >= TD_MIN).sort((a, b) => b.td.p - a.td.p), PER_GAME.td).map((r) => r.id),
      };
    }
    games.push({ id: g.id, away: g.away, home: g.home, date: g.date || null, final: !!g.final, state: g.state || null, awayScore: g.awayScore ?? null, homeScore: g.homeScore ?? null, odds: g.odds || null, teams });
  }
  const tdRows = all.filter((r) => r.td && r.td.p >= TD_MIN).sort((a, b) => b.td.p - a.td.p || a.player.localeCompare(b.player));
  const yardRows = (market, pos = null) => all.filter((r) => r.yards[market] && (!pos || pos.includes(r.pos))).sort((a, b) => b.yards[market].exp - a.yards[market].exp || a.player.localeCompare(b.player));
  const ids = (list) => list.map((r) => r.id);
  return {
    rows: Object.fromEntries(all.map((r) => [r.id, r])),
    games,
    boards: {
      td: ids(tdRows),
      firstHalfTd: ids([...tdRows].sort((a, b) => b.td.p1h - a.td.p1h || a.player.localeCompare(b.player))),
      receiving: ids(yardRows('rec_yds', ['WR', 'TE', 'RB'])),
      rushing: ids(yardRows('rush_yds')),
      passing: ids(yardRows('pass_yds', ['QB'])),
      teTd: ids(tdRows.filter((r) => r.pos === 'TE')),
    },
    perTouch,
    sheetDirection: sheetDefense?.direction || null,
    constants: { TD_PER_POINT, H1_SHARE, RATE_K, RATE_WEIGHTS, MARK_AT },
  };
}
