// First Basket (Vincent's ask, 2026-10-27, after PropFinder's First Basket page): who scores the
// first field goal of each game tonight. Pure over the slate's files and the season's stored
// results: the starters from PropFinder's depth chart (the five at depth 1, the nba.com starter
// flag first; the five most-played pulled players when the pull carries no chart), the players
// out left aside; each starter's chance = his team's chance of the first basket × his share of it.
//
//   P(team) = P(first possession) × FIRST_POSSESSION_EDGE + (1 − P(first possession)) × (1 − FIRST_POSSESSION_EDGE)
//     P(first possession): the starting centre's jump-ball record this season (won / jumped, two
//     halves added, `TIP_K`), the team's own tip record standing in, half without either.
//   share: his first-shot share this season (his team's first shots he took, n / (n + SHARE_K)) over
//     his field-goal-attempt share among tonight's five starters × his finishing against theirs
//     (field-goal %, damped FINISH_WEIGHT); the five shares normalised.
//   The own record: his first baskets over his starts this season, blended in at n / (n + OWN_K).
//
// The chance carries its fair price and, when the pull has a price on him (`firstBasket` on the
// player, lib/picks/propfinder.js), the book's with the edge. Once the game is stored, who scored
// first, the first points and the tip are on the game and the candidates are graded. The season's
// record (`firstBasketRecord`) is read off the stored results' `opening` (lib/nba/espn.js
// parseOpening); results stored before 2026-10-27 lack it until the tab's backfill reads them again.
import { isOut } from '../picks/injuries';
import { ownRate } from '../picks/projection';
import { fairOdds, impliedProb } from '../nfl/odds';
import { normName } from '../nhl-data/names';

/** The share of first baskets scored by the team with first possession (the league runs about 57%). */
export const FIRST_POSSESSION_EDGE = 0.57;
export const TIP_K = 4;      // the centre's jump record: (won + 2) / (jumped + 4)
export const SHARE_K = 6;    // his first-shot share: n first shots of the team's n + 6
export const OWN_K = 10;     // his own first-basket rate's weight: starts / (starts + 10)
export const FINISH_WEIGHT = 0.5;

const r3 = (v) => Math.round(v * 1000) / 1000;
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);

/**
 * The season's first-basket record off the stored results ([{ id, away, home, final, players, opening }]):
 * per player (by ESPN id, with his name and team) his starts, first baskets, first points and first
 * shots, his jump balls (jumped / won); per team its games with an opening on record, tips won, first
 * baskets scored and conceded, first points. `results` are the stored box scores of the season's slates.
 */
export function firstBasketRecord(results) {
  const players = {}; const teams = {};
  const P = (id, name, team) => (players[id] ||= { espnId: id, name: name || null, team: team || null, starts: 0, fb: 0, fp: 0, firstShots: 0, jumps: 0, jumpsWon: 0 });
  const T = (abbr) => (teams[abbr] ||= { team: abbr, games: 0, tips: 0, tipsWon: 0, fb: 0, fbConceded: 0, fp: 0, possessionFirstFb: 0 });
  let games = 0; let possessionScoredFirst = 0; let withBoth = 0;
  for (const r of results || []) {
    const o = r?.opening;
    if (!r?.final || !o) continue;
    games++;
    for (const abbr of [r.away, r.home]) if (abbr) T(abbr).games++;
    for (const p of r.players || []) if (p.starter && p.played && p.espnId) { const x = P(p.espnId, p.name, p.team); x.starts++; if (p.team) x.team = p.team; }
    if (o.tip?.team) {
      for (const abbr of [r.away, r.home]) if (abbr) { T(abbr).tips++; if (abbr === o.tip.team) T(abbr).tipsWon++; }
      for (const j of o.tip.jumpers || []) if (j?.espnId) { const x = P(j.espnId, j.name); x.jumps++; }
      const winner = (o.tip.jumpers || []).find((j) => j?.espnId && (r.players || []).some((p) => p.espnId === j.espnId && p.team === o.tip.team));
      if (winner) P(winner.espnId, winner.name).jumpsWon++;
    }
    if (o.firstBasket?.espnId) {
      const x = P(o.firstBasket.espnId, o.firstBasket.name, o.firstBasket.team); x.fb++;
      if (o.firstBasket.team) { T(o.firstBasket.team).fb++; const other = o.firstBasket.team === r.away ? r.home : r.away; if (other) T(other).fbConceded++; }
      if (o.tip?.team) { withBoth++; if (o.tip.team === o.firstBasket.team) { possessionScoredFirst++; T(o.tip.team).possessionFirstFb++; } }
    }
    if (o.firstPoints?.espnId) { P(o.firstPoints.espnId, o.firstPoints.name, o.firstPoints.team).fp++; if (o.firstPoints.team) T(o.firstPoints.team).fp++; }
    for (const s of Object.values(o.firstShot || {})) if (s?.espnId) P(s.espnId, s.name, s.team).firstShots++;
  }
  return { games, players, teams, possessionEdge: withBoth ? { games: withBoth, share: r3(possessionScoredFirst / withBoth) } : null };
}

/** The five starters of a side: the depth chart's (the nba.com starter flag, then depth 1 per slot), else the five most-played pulled players; the out left aside. */
export function startersOf(team, pfPlayers, depth) {
  const byKey = new Map(pfPlayers.filter((p) => p.team === team).map((p) => [p.key, p]));
  const minutes = (p) => ownRate({ l5: avg(p.games.slice(0, 5), 'min'), l10: avg(p.games.slice(0, 10), 'min'), season: avg(p.games.slice(0, 20), 'min') }) || 0;
  const picked = [];
  const slots = depth?.[team] || null;
  if (slots) {
    const flagged = []; const firsts = [];
    for (const [slot, list] of Object.entries(slots)) for (const x of list || []) {
      const p = byKey.get(x.key);
      if (!p || isOut(p.injury)) continue;
      if (x.starter === true || x.starter === 1) flagged.push({ p, slot });
      else if (x.depth === 1) firsts.push({ p, slot });
    }
    for (const x of [...flagged, ...firsts]) if (!picked.some((y) => y.p.key === x.p.key) && picked.length < 5) picked.push(x);
  }
  if (picked.length < 5) {
    const rest = [...byKey.values()].filter((p) => !isOut(p.injury) && !picked.some((y) => y.p.key === p.key) && p.games?.length).sort((a, b) => minutes(b) - minutes(a));
    for (const p of rest) { if (picked.length >= 5) break; picked.push({ p, slot: null }); }
  }
  return picked.map((x) => ({ ...x, minutes: r1(minutes(x.p)), source: x.slot ? 'depth' : 'minutes' }));
}

const avg = (list, f) => { const v = (list || []).map((g) => Number(g?.[f])).filter((x) => Number.isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };

/**
 * One game's candidates: both sides' starters with their chance of the first basket, from the record
 * and the pull ({ players, depth }); the actual opening once the game is stored.
 */
export function gameCandidates(g, { pfPlayers, depth, record, result = null }) {
  const sides = [g.away, g.home].map((team) => {
    const opp = team === g.away ? g.home : g.away;
    const starters = startersOf(team, pfPlayers, depth);
    const rate = (p, f) => ownRate({ l5: avg(p.games.slice(0, 5), f), l10: avg(p.games.slice(0, 10), f), season: avg(p.games.slice(0, 20), f) }) || 0;
    const rows = starters.map(({ p, slot, minutes, source }) => {
      // PropFinder's ids are not ESPN's: the record is joined by name (the pull's key is normName of the name).
      const own = Object.values(record?.players || {}).find((x) => x.name && normName(x.name) === p.key && (!x.team || x.team === team)) || null;
      const fga = rate(p, 'fga'); const fgm = rate(p, 'fgm');
      return { p, slot, minutes, source, own, fga, fgPct: fga > 0 ? fgm / fga : null };
    });
    const sumFga = rows.reduce((s, r) => s + r.fga, 0);
    const avgPct = rows.filter((r) => r.fgPct != null).length ? rows.filter((r) => r.fgPct != null).reduce((s, r) => s + r.fgPct, 0) / rows.filter((r) => r.fgPct != null).length : null;
    const teamRec = record?.teams?.[team] || null;
    const teamFirstShots = teamRec?.games || 0;
    // The tip: the starting centre's jump record, the team's standing in, half without either.
    const centre = rows.find((r) => r.slot === 'C') || rows.find((r) => /C/.test(r.p.pos || '')) || null;
    const jumps = centre?.own && centre.own.jumps ? centre.own : null;
    const pTipC = jumps ? (jumps.jumpsWon + TIP_K / 2) / (jumps.jumps + TIP_K) : null;
    const pTipT = teamRec?.tips ? (teamRec.tipsWon + TIP_K / 2) / (teamRec.tips + TIP_K) : null;
    const pTip = pTipC ?? pTipT ?? 0.5;
    const edge = record?.possessionEdge?.games >= 40 ? record.possessionEdge.share : FIRST_POSSESSION_EDGE;
    const pTeam = r3(pTip * edge + (1 - pTip) * (1 - edge));
    // His share: the attempts share among the starters × his finishing, moved toward his first-shot share.
    const raw = rows.map((r) => {
      const attShare = sumFga > 0 ? r.fga / sumFga : 1 / Math.max(1, rows.length);
      const finish = r.fgPct != null && avgPct ? 1 + FINISH_WEIGHT * (r.fgPct / avgPct - 1) : 1;
      const model = attShare * finish;
      const n = r.own?.firstShots || 0;
      const empShare = teamFirstShots > 0 ? n / teamFirstShots : null;
      const w = teamFirstShots > 0 ? teamFirstShots / (teamFirstShots + SHARE_K) : 0;
      return { ...r, attShare: r3(attShare), finish: r3(finish), modelShare: r3(model), empShare: empShare == null ? null : r3(empShare), shareW: r3(w), share: empShare == null ? model : w * empShare + (1 - w) * model };
    });
    const total = raw.reduce((s, r) => s + r.share, 0) || 1;
    const cands = raw.map((r) => {
      const share = r.share / total;
      const modelP = pTeam * share;
      const starts = r.own?.starts || 0;
      const ownRate_ = starts ? r.own.fb / starts : null;
      const wOwn = starts / (starts + OWN_K);
      const p = r3(ownRate_ == null ? modelP : wOwn * ownRate_ + (1 - wOwn) * modelP);
      const book = r.p.firstBasket || null;
      const implied = book?.odds != null ? impliedProb(book.odds) : null;
      return {
        key: r.p.key, name: r.p.name, team, opp, venue: team === g.home ? 'H' : 'A', pos: r.p.pos || null, slot: r.slot, source: r.source, minutes: r.minutes,
        espnId: r.own?.espnId || null, health: r.p.injury || null,
        fga: r1(r.fga), fgPct: r.fgPct == null ? null : r3(r.fgPct), attShare: r.attShare, finish: r.finish, firstShots: r.own?.firstShots || 0, empShare: r.empShare, share: r3(share),
        own: { starts, fb: r.own?.fb || 0, fp: r.own?.fp || 0, rate: ownRate_ == null ? null : r3(ownRate_), weight: r3(wOwn) },
        tip: { p: r3(pTip), from: pTipC != null ? 'centre' : pTipT != null ? 'team' : 'none', centre: centre?.p.name || null, jumps: jumps ? { won: jumps.jumpsWon, of: jumps.jumps } : null, team: teamRec?.tips ? { won: teamRec.tipsWon, of: teamRec.tips } : null },
        pTeam, modelP: r3(modelP), p, fair: fairOdds(p), odds: book?.odds ?? null, book: book?.book || null, books: book?.books || 0, implied: implied == null ? null : r3(implied), edge: implied == null ? null : r3(p - implied),
        score: Math.round(p * 100 * 4),   // 0–100: a 25% chance tops the scale
        hit: null,
      };
    });
    return { team, opp, pTeam, pTip: r3(pTip), tipFrom: pTipC != null ? 'centre' : pTipT != null ? 'team' : 'none', lineup: cands.some((c) => c.source === 'depth') ? 'depth' : 'minutes', candidates: cands };
  });
  const actual = result?.final && result.opening ? result.opening : null;
  const all = sides.flatMap((s) => s.candidates);
  if (actual?.firstBasket) for (const c of all) c.hit = !!(c.espnId && actual.firstBasket.espnId === c.espnId) || (!c.espnId && !!actual.firstBasket.name && normName(actual.firstBasket.name) === c.key);
  return { id: g.id, date: g.date, away: g.away, home: g.home, final: !!g.final, score: result?.final ? { away: result.awayScore, home: result.homeScore } : null, sides, candidates: all.sort((a, b) => b.p - a.p), actual };
}

/** The whole slate: every game's candidates and the record's reach. */
export function buildFirstBasketBoard({ slate, games, pf, results = {}, record }) {
  const pfPlayers = pf?.data?.players || [];
  const depth = pf?.data?.depth || null;
  const out = (games || []).map((g) => gameCandidates(g, { pfPlayers, depth, record, result: results?.[g.id] || null }));
  return {
    date: slate.date, games: out, count: out.reduce((s, g) => s + g.candidates.length, 0),
    recorded: record?.games || 0, possessionEdge: record?.possessionEdge || null, edgeUsed: record?.possessionEdge?.games >= 40 ? record.possessionEdge.share : FIRST_POSSESSION_EDGE,
    pulledAt: pf?.at || null, priced: pfPlayers.filter((p) => p.firstBasket).length,
  };
}
