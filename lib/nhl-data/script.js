// The game script: how tonight's game is likely to go, in a few sentences written from the
// reads the slate already carries — the game-total read, both team verdicts, the first-goal
// tables and the model's plays (lib/nhl-data/verdict.js, slate.js). The Matchups tab shows
// it above the numbers, which fold under it. Pure functions over one slate game; nothing
// here touches a number.
import { VENUE_TEXT } from './verdict';

const POS_WORD = { LW: 'left wings', C: 'centres', RW: 'right wings', D: 'defensemen' };
const TOTAL_WORD = { high: 'High-scoring', low: 'Low-scoring', average: 'Average scoring' };
const TOTAL_OPEN = { high: 'A high-scoring game is likely', low: 'A low-scoring game is likely', average: 'An average total is likely' };
const TOTAL_TONE = { high: 'is-soft', low: 'is-tough', average: '' };

/** Expected goals one team must hold over the other before the script calls an edge. */
export const EDGE_MARGIN = 0.4;
/** Goals a game one net must give up over the other before it reads as the softer one. */
export const NET_MARGIN = 0.2;
/** A first-goal table needs this many games at the venue before the script reads it. */
export const FG_MIN_GAMES = 5;
/** The share of games conceding the first goal one side must lead by before the script leans. */
export const FG_MARGIN = 0.15;
/** Skaters the matchup read names when there is no model run, per side. */
const READ_SHOOTERS = 2;

const r1 = (v) => Number(v).toFixed(1);
const r2 = (v) => Number(v).toFixed(2);
const pctOf = (v) => `${Math.round(Number(v) * 100)}%`;
const rank = (r) => (r ? ` (#${r})` : '');
const lower = (s) => String(s || '').toLowerCase();

/** "a, b and c" */
export function joinAnd(items) {
  const list = items.filter(Boolean);
  if (list.length <= 1) return list.join('');
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

/** "centres (#11) and defensemen (#11)" */
const posList = (list) => joinAnd(list.map((p) => `${POS_WORD[p.pos] || p.pos}${rank(p.rank)}`));

/** Last name only, unless two plays on the side share it. */
function nameOf(pl, list) {
  const last = (n) => { const parts = String(n || '').trim().split(' '); return parts.length > 1 ? parts.slice(1).join(' ') : n; };
  const mine = last(pl.name);
  return list.filter((o) => last(o.name) === mine && o.name !== pl.name).length ? pl.name : mine;
}

/** The play's form and soft spot as words: " (hot, soft spot)" or "". */
function flagWords(pl) {
  const f = pl.heat; const o = pl.oppPos; const out = [];
  if (f) {
    if (pl.stat === 'sog' ? f.hotS : f.hotG) out.push('hot');
    else if (pl.stat === 'sog' ? f.coldS : f.coldG) out.push('cold');
  }
  if (o && (pl.stat === 'sog' ? o.softSog : o.softG)) out.push('soft spot');
  return out.length ? ` (${out.join(', ')})` : '';
}

// ── The parts ────────────────────────────────────────────────────────────────

/** Total: the read with its basis (the stored meetings, MoneyPuck) and the pace of the two teams. */
function totalPart({ total, verdicts, away, home }) {
  if (!total) return null;
  const { tier, projected, league, h2h, expected, pace } = total;
  const basis = [];
  if (h2h?.gp) basis.push(h2h.gp === 1 ? `their one stored meeting had ${r1(h2h.avg)} goals` : `the two have averaged ${r1(h2h.avg)} over ${h2h.gp} meetings`);
  if (expected) basis.push(`MoneyPuck makes it ${r1(expected.total)}`);
  const sentences = [`${TOTAL_OPEN[tier] || 'The total reads'}, ${r1(projected)} goals against the league's ${r1(league)}${basis.length ? `: ${joinAnd(basis)}` : ''}.`];
  if (pace) {
    const rk = (team) => rank(verdicts?.[team]?.pace?.rank);
    const fast = [home, away].filter((t) => (t === home ? pace.homeTier : pace.awayTier) === 'fast');
    const slow = [home, away].filter((t) => (t === home ? pace.homeTier : pace.awayTier) === 'slow');
    if (fast.length === 2) sentences.push(`Both play fast (${home}${rk(home)}, ${away}${rk(away)}).`);
    else if (slow.length === 2) sentences.push(`Both play slow (${home}${rk(home)}, ${away}${rk(away)}).`);
    else if (fast.length && slow.length) sentences.push(`${fast[0]} pushes the pace${rk(fast[0])}, ${slow[0]} slows it${rk(slow[0])}.`);
    else if (fast.length) sentences.push(`${fast[0]} pushes the pace${rk(fast[0])}.`);
    else if (slow.length) sentences.push(`${slow[0]} slows the game down${rk(slow[0])}.`);
  }
  return { key: 'total', label: 'Total', tone: TOTAL_TONE[tier] || '', text: sentences.join(' ') };
}

/** Edge: who outscores whom on paper (MoneyPuck's expected goals each way) and who shoots a lot or little. */
function edgePart({ total, verdicts, away, home }) {
  const e = total?.expected;
  const sentences = [];
  let lean = null;
  if (e && e.home != null && e.away != null) {
    const gap = e.home - e.away;
    if (Math.abs(gap) >= EDGE_MARGIN) {
      lean = gap > 0 ? home : away;
      sentences.push(`${lean} has the edge on paper, ${r1(Math.max(e.home, e.away))} expected goals to ${r1(Math.min(e.home, e.away))}.`);
    } else {
      sentences.push(`Even on paper, ${home} ${r1(e.home)} expected goals to ${away}'s ${r1(e.away)}.`);
    }
  }
  // Shot volume: the offense's SF/60 rank in thirds (`offense.tier`, rank 1 = the most shots for).
  const off = (t) => verdicts?.[t]?.offense || null;
  const rk = (t) => (off(t)?.sf60Rank ? `#${off(t).sf60Rank}` : null);
  const high = [home, away].filter((t) => off(t)?.tier === 'leaky');
  const low = [home, away].filter((t) => off(t)?.tier === 'tight');
  const both = (word) => `${word}: ${[home, away].map((t) => `${t} ${rk(t) || '–'}`).join(', ')} in SF/60.`;
  if (high.length === 2) sentences.push(both('Both shoot a lot'));
  else if (low.length === 2) sentences.push(both('Neither shoots much'));
  else if (high.length && low.length) sentences.push(`${high[0]} shoots a lot${rk(high[0]) ? ` (${rk(high[0])} in SF/60)` : ''}, ${low[0]} little${rank(off(low[0]).sf60Rank)}.`);
  else if (high.length) sentences.push(`${high[0]} shoots a lot${rk(high[0]) ? ` (${rk(high[0])} in SF/60)` : ''}.`);
  else if (low.length) sentences.push(`${low[0]} shoots little${rk(low[0]) ? ` (${rk(low[0])} in SF/60)` : ''}.`);
  if (!sentences.length) return null;
  return { key: 'edge', label: 'Edge', tone: '', text: sentences.join(' '), lean };
}

/** One side's shooters: the defense they face at its venue, where it leaks and holds, and its last ten. */
export function shotsSentence(side, v) {
  if (!v?.season || !v.tier) return null;
  const clauses = [];
  if (v.leaks?.length === 4) clauses.push('at every position');
  else if (v.leaks?.length) clauses.push(`softest to ${posList(v.leaks)}`);
  if (v.holds?.length === 4) clauses.push('holding every position');
  else if (v.holds?.length) clauses.push(`tight on ${posList(v.holds)}`);
  const t = v.trend;
  const move = t?.trend === 'loosening' ? `has loosened over its last ten${rank(t.rank)}` : t?.trend === 'tightening' ? `has tightened over its last ten${rank(t.rank)}` : null;
  // A tight defense that has loosened, or a leaky one that has tightened, turns on "but".
  const contrast = move && ((v.tier === 'tight' && t.trend === 'loosening') || (v.tier === 'leaky' && t.trend === 'tightening'));
  let text = `${side.team}'s shooters: ${side.opp} is ${v.tier} ${VENUE_TEXT[v.venue] || ''}`.trim() + `${v.rank ? ` (#${v.rank} SOG allowed)` : ''}`;
  if (clauses.length) text += `, ${clauses.join(', ')}`;
  if (move) text += `${contrast ? ', but it' : '; it'} ${move}`;
  return `${text}.`;
}

function shotsPart({ sides, verdicts }) {
  const texts = sides.map((s) => shotsSentence(s, verdicts?.[s.opp])).filter(Boolean);
  if (!texts.length) return null;
  const faced = sides.map((s) => verdicts?.[s.opp]?.tier).filter(Boolean);
  const tone = faced.length === 2 && faced.every((t) => t === 'leaky') ? 'is-soft' : faced.length === 2 && faced.every((t) => t === 'tight') ? 'is-tough' : '';
  return { key: 'shots', label: 'Shots', tone, text: texts.join(' ') };
}

/** Goals: the softer net (goals a game allowed at the venue) and who concedes the first goal more. */
function goalsPart({ sides }) {
  const sentences = [];
  // Each side faces the opponent's goals allowed at the opponent's venue (its defense object describes the opponent).
  const faces = sides.map((s) => {
    const all = s.defense?.All;
    if (!all?.season?.gp || all.season.g == null) return null;
    return { team: s.team, opp: s.opp, g: all.season.g, rank: all.rank?.g ?? null, where: VENUE_TEXT[s.venue === 'A' ? 'H' : 'A'] };
  });
  const say = (f) => `${f.opp}'s ${r2(f.g)} ${f.where}${rank(f.rank)}`;
  if (faces[0] && faces[1]) {
    const [a, b] = faces;
    const softer = a.g - b.g >= NET_MARGIN ? a : b.g - a.g >= NET_MARGIN ? b : null;
    const firmer = softer === a ? b : a;
    if (softer) sentences.push(`The softer net is ${softer.opp}'s, ${r2(softer.g)} goals a game allowed ${softer.where}${rank(softer.rank)} against ${say(firmer)}.`);
    else sentences.push(`Both nets give up about the same: ${say(a)}, ${say(b)}.`);
  } else if (faces[0] || faces[1]) {
    const f = faces[0] || faces[1];
    sentences.push(`${f.opp} gives up ${r2(f.g)} goals a game ${f.where}${rank(f.rank)}.`);
  }
  // The first goal: how often each opponent has conceded it at its venue this season.
  const fg = sides.map((s) => {
    const f = s.defense?.All?.firstGoal;
    if (!f || f.games < FG_MIN_GAMES) return null;
    return { team: s.team, opp: s.opp, allowed: f.allowed, games: f.games, share: f.share, rank: f.rank ?? null, venue: s.venue === 'A' ? 'home' : 'road' };
  });
  const first = (f, again = false) => `${f.opp} ${again ? '' : 'has conceded it '}in ${f.allowed} of ${f.games} ${f.venue} games${rank(f.rank)}`;
  if (fg[0] && fg[1]) {
    const lean = fg[0].share - fg[1].share >= FG_MARGIN ? fg[0] : fg[1].share - fg[0].share >= FG_MARGIN ? fg[1] : null;
    sentences.push(`First goal: ${first(fg[0])}, ${first(fg[1], true)}${lean ? `, so the lean is ${lean.team} to score first` : ', no lean either way'}.`);
  } else if (fg[0] || fg[1]) {
    sentences.push(`First goal: ${first(fg[0] || fg[1])}.`);
  }
  if (!sentences.length) return null;
  return { key: 'goals', label: 'Goals', tone: '', text: sentences.join(' ') };
}

/** Plays: the model's plays per side (the strip above each rink), or the matchup read's volume shooters without a run. */
function playsPart({ sides }) {
  if (sides.some((s) => s.plays)) {
    const bits = sides.map((s) => {
      const list = [...(s.plays?.shots || []), ...(s.plays?.goals || [])];
      if (!list.length) return `${s.team}: nothing clears the floor`;
      return `${s.team}: ${list.map((pl) => `${nameOf(pl, list)}${flagWords(pl)} ${pl.market} ${pctOf(pl.prob)}`).join(', ')}`;
    });
    return { key: 'plays', label: 'Plays', tone: '', text: `${bits.join('; ')}.` };
  }
  const bits = sides.map((s) => {
    const top = (s.skaters || []).filter((p) => p.inLineup !== false && (p.gp || 0) >= 5 && p.projSog != null).sort((a, b) => (b.shotScore || 0) - (a.shotScore || 0)).slice(0, READ_SHOOTERS);
    return top.length ? `${s.team}: ${top.map((p) => `${nameOf(p, top)} ${r1(p.projSog)} SOG`).join(', ')}` : null;
  }).filter(Boolean);
  if (!bits.length) return null;
  return { key: 'plays', label: 'Plays', tone: '', text: `No model run for this slate yet; by the matchup read the volume shooters are ${bits.join('; ')}.` };
}

/** Result, once the game is stored: the score against the read, the first goal, and how the plays went. */
function resultPart({ log, total, sides, away, home }) {
  if (!log?.score) return null;
  const n = (Number(log.score.away) || 0) + (Number(log.score.home) || 0);
  let text = `Final ${away} ${log.score.away}–${log.score.home} ${home}, ${n} goals`;
  if (total?.projected != null) text += `, ${n > total.projected ? 'over' : n < total.projected ? 'under' : 'on'} the ${r1(total.projected)} read`;
  if (log.firstGoal?.team) text += `; first goal ${log.firstGoal.team}${log.firstGoal.name ? ` (${log.firstGoal.name})` : ''}`;
  const byKey = {};
  for (const r of log.skaters || []) { if (r.id != null) byKey[`id:${r.id}`] = r; byKey[`nm:${r.team}|${lower(r.name)}`] = r; }
  let hit = 0; let graded = 0;
  for (const s of sides) {
    for (const pl of [...(s.plays?.shots || []), ...(s.plays?.goals || [])]) {
      const a = (pl.id != null && byKey[`id:${pl.id}`]) || byKey[`nm:${s.team}|${lower(pl.name)}`];
      if (!a) continue;
      graded += 1;
      if ((Number(a[pl.stat]) || 0) >= pl.min) hit += 1;
    }
  }
  if (graded) text += `; the plays went ${hit} of ${graded}`;
  return { key: 'result', label: 'Result', tone: '', text: `${text}.` };
}

/**
 * The script for one slate game ({ away, home, total, verdicts, sides, log } as buildSlate shapes
 * it): { headline, lean, parts: [{ key, label, tone, text }] }, or null when there is nothing to
 * say. Parts in reading order: total, edge, shots, goals, plays, and the result once the game is
 * stored; each is left out when the slate lacks what it reads.
 */
export function gameScript(game) {
  if (!game?.away || !game?.home) return null;
  const sides = game.sides || [];
  const ctx = { ...game, sides, verdicts: game.verdicts || {} };
  const total = totalPart(ctx);
  const edge = edgePart(ctx);
  const parts = [total, edge, shotsPart(ctx), goalsPart(ctx), playsPart(ctx), resultPart(ctx)].filter(Boolean);
  if (!parts.length) return null;
  const lean = edge?.lean || null;
  const headline = [TOTAL_WORD[game.total?.tier] || null, lean ? `${lean} has the edge` : game.total?.expected ? 'even on paper' : null].filter(Boolean).join(' · ') || 'Game script';
  return { headline, lean, tone: TOTAL_TONE[game.total?.tier] || '', parts: parts.map(({ lean: _l, ...p }) => p) };
}
