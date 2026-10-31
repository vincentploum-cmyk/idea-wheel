// The game profile of an NBA game, the firsthalfscore.com layout (Vincent, 2026-10-30: "replace the characteristics
// with a summary from PropFinder and cheat sheet data like we have for firsthalfscore.com"): one row per aspect, the
// two teams side by side, each cell a rating word with the figures under it. Built on the board from the pull's team
// rows (`totals[ABBR].for` the team's own per-game row, `.against` what it gives up, `.l10` its last ten; ranked here
// over the teams in the pull), the sides' allowed tables (what the team gives up to each position, PropFinder's rank
// with the cheat sheet's tile beside it, `rankBlend` the two together: the matchup the projections read) and the sheet's
// named players. Pure; nothing here touches a number on the board.
//
// Drawn as two views of five rows each (Vincent, 2026-10-31, of the seventeen rows: "This is way too much. I need only 5
// rows. Maybe add an offense / defense toggle"): the attack (scoring, threes, rebounding, assists, free throws) and the
// defense (points allowed with its last ten, and the positions it gives points, rebounds, assists and threes to). Each
// cell a word and one short figure (`short`); the full reading rides on the hover (`text`).
import { levelOf } from '../picks/levels';
import { POS_WORD } from './characteristics';

export const WORD = { very: 'Elite', strong: 'Strong', average: 'Average', weak: 'Weak', veryWeak: 'Very weak' };
const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const r1 = (v) => (v == null ? '—' : Number(v).toFixed(1));
const pct = (v) => `${Math.round(v * 100)}%`;

/** Rank 1 = the best: the highest figure, or the lowest when `low`. Ties share the better rank. */
function rankIn(values, mine, low = false) {
  if (mine == null) return null;
  const have = values.filter((v) => v != null);
  if (!have.length) return null;
  return { rank: have.filter((v) => (low ? v < mine : v > mine)).length + 1, n: have.length };
}
const cell = (level, word, text, extra = {}) => ({ level: level || 'average', word: word || WORD[level || 'average'], text, ...extra });
const ranked = (r, text, v) => (r ? cell(levelOf(r.rank, r.n), null, `${r.rank}${suffix(r.rank)} / ${r.n} · ${text}`, { short: `${r1(v)} a game · ${r.rank}${suffix(r.rank)}` }) : null);
const suffix = (n) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const src = (row) => (row?.held ? 'last season’s row' : row?.gp ? `${row.gp} games` : 'this season');

/** The team's own rows ranked over the league: the attack. */
const ATTACK = [
  ['scoring', 'pts', 'points'],
  ['threes', 'tpm', 'threes'],
  ['rebounding', 'reb', 'rebounds'],
  ['playmaking', 'ast', 'assists'],
  ['line', 'ftm', 'free throws'],
];
const LEAKS = [['leaksPts', 'pts'], ['leaksReb', 'reb'], ['leaksAst', 'ast'], ['leaksTpm', 'tpm']];

/** One team's cells, keyed by aspect. `oppSide` is the opponent's entry on the board game (its `allowed` is what this team gives up). */
export function teamProfile({ team, defense, oppSide }) {
  const totals = defense?.totals || {};
  const mine = totals[team] || null;
  const abbrs = Object.keys(totals);
  const out = {};
  if (mine?.for) {
    for (const [key, stat, unit] of ATTACK) {
      const v = mine.for[stat];
      const r = rankIn(abbrs.map((a) => totals[a]?.for?.[stat] ?? null), v);
      if (r) out[key] = ranked(r, `${r1(v)} ${unit} a game${stat === 'tpm' && mine.for.pts ? ` · ${pct((v * 3) / mine.for.pts)} of its points` : ''} · ${src(mine.for)}`, v);
    }
  }
  if (mine?.against?.pts != null) {
    const v = mine.against.pts;
    const r = rankIn(abbrs.map((a) => totals[a]?.against?.pts ?? null), v, true);   // allowing less is better
    if (r) out.ptsAgainst = ranked(r, `${r1(v)} points allowed a game · ${src(mine.against)}`, v);
    // The last ten against the season on points allowed, over the teams with a last-ten row: on the same cell.
    const l10 = mine.l10?.against?.pts ?? null;
    if (l10 != null) {
      const l10Of = (a) => totals[a]?.l10?.against?.pts ?? null;
      const withL10 = abbrs.filter((a) => l10Of(a) != null);
      const now = rankIn(withL10.map(l10Of), l10, true);
      const season = rankIn(withL10.map((a) => totals[a]?.against?.pts ?? null), mine.against.pts, true);
      if (out.ptsAgainst && now && season && now.n >= 10) {
        const drift = season.rank - now.rank;
        const trend = drift >= 5 ? 'tightening' : drift <= -5 ? 'loosening' : null;
        out.ptsAgainst.trend = trend;
        out.ptsAgainst.text += ` · last ${mine.l10.against.gp || 10}: ${r1(l10)} allowed, ${now.rank}${suffix(now.rank)} of ${now.n}${trend ? `, ${trend}` : ''}`;
        if (trend) out.ptsAgainst.short += ` · ${trend}`;
      }
    }
  }
  // What it gives up to each position: the opponent side's allowed table (PropFinder's rank, the cheat sheet's tile
  // beside it, rankBlend the two: the matchup the projections read). The soft positions named, the sheet's say with them.
  const allowed = oppSide?.allowed || null;
  if (allowed?.rows) {
    const n = allowed.count || 30;
    const soft = Math.ceil(n / 3); const tough = n - soft;
    for (const [key, stat] of LEAKS) {
      const cells = POSITIONS.map((pos) => { const c = allowed.rows[pos]?.[stat]; const rank = c?.rankBlend ?? c?.rank ?? null; return rank ? { pos, rank, pf: c.rank ?? null, sheet: c.sheet ?? null, value: c.value ?? null } : null; }).filter(Boolean);
      if (!cells.length) continue;
      const leaks = cells.filter((c) => c.rank <= soft).sort((a, b) => a.rank - b.rank);
      const holds = cells.filter((c) => c.rank > tough);
      const best = Math.min(...cells.map((c) => c.rank));
      const level = leaks.length >= 3 || best <= 3 ? 'veryWeak' : leaks.length ? 'weak' : holds.length >= 3 ? 'very' : holds.length ? 'strong' : 'average';
      const word = leaks.length ? (leaks.length === cells.length ? 'Every position' : leaks.map((c) => c.pos).join(', ')) : holds.length === cells.length ? 'Holds every position' : holds.length ? 'Holds' : 'Average';
      const named = (leaks.length ? leaks : [...cells].sort((a, b) => a.rank - b.rank).slice(0, 2));
      const text = named.map((c) => `${c.pos} #${c.rank}${c.sheet != null && c.pf != null ? ` (PropFinder #${c.pf}, sheet #${c.sheet})` : allowed.from === 'sheet' ? ' (sheet)' : ''}`).join(' · ') + ` of ${n}` + (leaks.length ? '' : ' · nothing in the soft third');
      // The word names the positions; the figure is their ranks in the same order (the softest one's when it holds).
      const short = leaks.length ? `${leaks.map((c) => `#${c.rank}`).join(' · ')} of ${n}` : `softest ${named[0].pos} #${named[0].rank}`;
      out[key] = cell(level, word, text, { from: allowed.from || 'propfinder', short });
    }
  }
  return Object.keys(out).length ? out : null;
}

/** The two views and their five rows each: [key, label, hover]. */
export const GROUPS = [
  ['offense', 'Offense', [
    ['scoring', 'Scoring', 'Points a game, ranked over the league (PropFinder’s team row)'],
    ['threes', 'Threes', 'Threes made a game, ranked, with the share of its points from threes'],
    ['rebounding', 'Rebounding', 'Rebounds a game, ranked'],
    ['playmaking', 'Assists', 'Assists a game, ranked'],
    ['line', 'Free throws', 'Free throws made a game, ranked'],
  ]],
  ['defense', 'Defense', [
    ['ptsAgainst', 'Points allowed', 'Points allowed a game, 1st = the fewest; its last ten beside the season (tightening or loosening at five ranks’ drift)'],
    ['leaksPts', 'Points to', 'The positions it gives up the most points to: PropFinder’s rank with the cheat sheet’s tile, blended (the matchup the projections read); 1 = the most'],
    ['leaksReb', 'Rebounds to', 'The positions it gives up the most rebounds to (the same read)'],
    ['leaksAst', 'Assists to', 'The positions it gives up the most assists to (the same read)'],
    ['leaksTpm', 'Threes to', 'The positions it gives up the most threes to (the same read)'],
  ]],
];
/** Every row in the views' order. */
export const ROWS = GROUPS.flatMap(([, , rows]) => rows);

/** How far the game's pace and total stand from the league's before they read fast / slow, high / low. */
export const PACE_EDGE = 1.5;    // possessions a game, the two teams' mean against the league's
export const TOTAL_EDGE = 5;     // points, the book's total against twice the league's points a game

/**
 * The game script (Vincent, 2026-10-31: "I need to know the game script. Will it be a fast paced game or not"): the two
 * teams' pace this season from PropFinder (possessions a game, `pace` on the pull, last season's for a team without a
 * row yet) — their mean against the league's, Fast / Average / Slow at PACE_EDGE — and the book's total and spread as
 * the schedule carries them (ESPN's line), High / Average / Low against twice the league's points a game at TOTAL_EDGE.
 * { word ("Fast pace · high total"), pace, total, spread, text (the hover) } or null without either read.
 */
export function gameScript(g, pace, defense) {
  const a = pace?.teams?.[g.away]; const h = pace?.teams?.[g.home];
  const out = {};
  if (a && h && pace.league > 0) {
    const game = Math.round(((a.pace + h.pace) / 2) * 10) / 10;
    const diff = game - pace.league;
    out.pace = { game, league: pace.league, away: a.pace, home: h.pace, awayRank: a.rank, homeRank: h.rank, held: !!(a.held || h.held), word: diff >= PACE_EDGE ? 'Fast' : diff <= -PACE_EDGE ? 'Slow' : 'Average' };
  }
  const total = Number(g.odds?.total);
  const lg = defense?.leagueFor?.pts > 0 ? Math.round(defense.leagueFor.pts * 2 * 10) / 10 : null;
  if (Number.isFinite(total) && total > 0) out.total = { line: total, league: lg, word: lg == null ? null : total >= lg + TOTAL_EDGE ? 'High' : total <= lg - TOTAL_EDGE ? 'Low' : 'Average' };
  if (g.odds?.spread) out.spread = String(g.odds.spread);
  if (!out.pace && !out.total) return null;
  const words = [out.pace ? `${out.pace.word === 'Average' ? 'Average' : out.pace.word} pace` : null, out.total?.word ? `${out.total.word.toLowerCase()} total` : null].filter(Boolean);
  const text = [
    out.pace ? `Pace: ${out.pace.game} possessions a game between them (${g.away} ${out.pace.away}${out.pace.awayRank ? `, #${out.pace.awayRank}` : ''} · ${g.home} ${out.pace.home}${out.pace.homeRank ? `, #${out.pace.homeRank}` : ''}; the league ${out.pace.league}), PropFinder${out.pace.held ? ', last season’s for a team without a row yet' : ''}` : null,
    out.total ? `The book’s total ${out.total.line}${lg ? ` against the league’s ${lg}` : ''}` : null,
    out.spread ? `spread ${out.spread}` : null,
  ].filter(Boolean).join(' · ');
  return { ...out, word: words.join(' · ') || null, text };
}

/** Both teams of a game: { teams: [away, home], cells: { [team]: { aspect: cell } }, rows: the aspects either team has } or null. */
export function gameProfile(g, defense, sides, { pace = null } = {}) {
  const teams = [g.away, g.home];
  const cells = {};
  for (const team of teams) {
    const opp = team === g.away ? g.home : g.away;
    const t = teamProfile({ team, defense, oppSide: sides?.[opp] || null });
    if (t) cells[team] = t;
  }
  const script = gameScript(g, pace, defense);
  if (!Object.keys(cells).length) return script ? { teams, cells: {}, groups: [], script } : null;
  const has = ([key]) => teams.some((t) => cells[t]?.[key]);
  const groups = GROUPS.map(([key, label, rows]) => ({ key, label, rows: rows.filter(has).map(([k, l, hover]) => ({ key: k, label: l, hover })) })).filter((x) => x.rows.length);
  return { teams, cells, groups, positions: POS_WORD, script };
}

export const profile = { gameProfile, teamProfile, gameScript };
