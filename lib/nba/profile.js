// The game profile of an NBA game, the firsthalfscore.com layout (Vincent, 2026-10-30: "replace the characteristics
// with a summary from PropFinder and cheat sheet data like we have for firsthalfscore.com"): one row per aspect, the
// two teams side by side, each cell a rating word with the figures under it. Built on the board from the pull's team
// rows (`totals[ABBR].for` the team's own per-game row, `.against` what it gives up, `.l10` its last ten; ranked here
// over the teams in the pull), the sides' allowed tables (what the team gives up to each position, PropFinder's rank
// with the cheat sheet's tile beside it, `rankBlend` the two together: the matchup the projections read) and the sheet's
// named players. Pure; nothing here touches a number on the board.
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
const ranked = (r, text) => (r ? cell(levelOf(r.rank, r.n), null, `${r.rank}${suffix(r.rank)} / ${r.n} · ${text}`) : null);
const suffix = (n) => (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
const src = (row) => (row?.held ? 'last season’s row' : row?.gp ? `${row.gp} games` : 'this season');

/** The team's own and allowed rows ranked over the league: the attack and defense aspects. */
const ATTACK = [
  ['scoring', 'Scoring', 'pts', 'points'],
  ['rebounding', 'Rebounding', 'reb', 'rebounds'],
  ['playmaking', 'Ball movement', 'ast', 'assists'],
  ['threes', 'Three-point shooting', 'tpm', 'threes'],
  ['line', 'Getting to the line', 'ftm', 'free throws'],
  ['security', 'Ball security', 'tov', 'turnovers', true],
];
const DEFENSE = [
  ['ptsAgainst', 'Defense', 'pts', 'points allowed'],
  ['rebAgainst', 'Defensive glass', 'reb', 'rebounds allowed'],
  ['tpmAgainst', 'Defending the three', 'tpm', 'threes allowed'],
  ['forcing', 'Forcing turnovers', 'tov', 'turnovers forced', true],
];
const LEAKS = [['leaksPts', 'Gives up points to', 'pts'], ['leaksReb', 'Gives up rebounds to', 'reb'], ['leaksAst', 'Gives up assists to', 'ast'], ['leaksTpm', 'Gives up threes to', 'tpm']];

/** One team's cells, keyed by aspect. `side` is its entry on the board game, `oppSide` the opponent's (its `allowed` is what this team gives up). */
export function teamProfile({ team, defense, side, oppSide }) {
  const totals = defense?.totals || {};
  const mine = totals[team] || null;
  const abbrs = Object.keys(totals);
  const league = defense?.leagueFor || {};
  const out = {};
  // Expected tonight: the side's figure (its own × the opponent's environment) against the league's average.
  const exp = side?.teamProj?.pts ?? null;
  if (exp != null) {
    const ratio = league.pts > 0 ? exp / league.pts : null;
    const level = ratio == null ? 'average' : ratio >= 1.06 ? 'very' : ratio >= 1.025 ? 'strong' : ratio <= 0.94 ? 'veryWeak' : ratio <= 0.975 ? 'weak' : 'average';
    out.expected = cell(level, ratio == null ? 'Expected' : ratio >= 1.025 ? 'High' : ratio <= 0.975 ? 'Low' : 'Average', `${Math.round(exp)} points expected tonight${mine?.for?.pts != null ? ` · ${r1(mine.for.pts)} a game` : ''}${league.pts ? ` · league ${r1(league.pts)}` : ''}`);
  }
  if (mine?.for) {
    for (const [key, , stat, unit, low] of ATTACK) {
      const v = mine.for[stat];
      const r = rankIn(abbrs.map((a) => totals[a]?.for?.[stat] ?? null), v, !!low);
      if (r) out[key] = ranked(r, `${r1(v)} ${unit} a game${stat === 'tpm' && mine.for.pts ? ` · ${pct((v * 3) / mine.for.pts)} of its points` : ''} · ${src(mine.for)}`);
    }
  }
  if (mine?.against) {
    for (const [key, , stat, unit, low] of DEFENSE) {
      const v = mine.against[stat];
      const r = rankIn(abbrs.map((a) => totals[a]?.against?.[stat] ?? null), v, !low);   // allowing less is better; forcing more turnovers is
      if (r) out[key] = ranked(r, `${r1(v)} ${unit} a game · ${src(mine.against)}`);
    }
    // The last ten against the season on points allowed, over the teams with a last-ten row.
    const l10 = mine.l10?.against?.pts ?? null;
    if (l10 != null) {
      const l10Of = (a) => totals[a]?.l10?.against?.pts ?? null;
      const withL10 = abbrs.filter((a) => l10Of(a) != null);
      const now = rankIn(withL10.map(l10Of), l10, true);
      const season = rankIn(withL10.map((a) => totals[a]?.against?.pts ?? null), mine.against.pts, true);
      if (now && season && now.n >= 10) {
        const drift = season.rank - now.rank;
        const level = drift >= 5 ? (now.rank <= 3 ? 'very' : 'strong') : drift <= -5 ? (now.rank > now.n - 3 ? 'veryWeak' : 'weak') : 'average';
        out.trend = cell(level, drift >= 5 ? 'Tightening' : drift <= -5 ? 'Loosening' : 'Steady', `${now.rank}${suffix(now.rank)} / ${now.n} fewest over its last ${mine.l10.against.gp || 10} · ${season.rank}${suffix(season.rank)} on the season · ${r1(l10)} allowed a game`);
      }
    }
  }
  // What it gives up to each position: the opponent side's allowed table (PropFinder's rank, the cheat sheet's tile
  // beside it, rankBlend the two: the matchup the projections read). The soft positions named, the sheet's say with them.
  const allowed = oppSide?.allowed || null;
  if (allowed?.rows) {
    const n = allowed.count || 30;
    const soft = Math.ceil(n / 3); const tough = n - soft;
    for (const [key, , stat] of LEAKS) {
      const cells = POSITIONS.map((pos) => { const c = allowed.rows[pos]?.[stat]; const rank = c?.rankBlend ?? c?.rank ?? null; return rank ? { pos, rank, pf: c.rank ?? null, sheet: c.sheet ?? null, value: c.value ?? null } : null; }).filter(Boolean);
      if (!cells.length) continue;
      const leaks = cells.filter((c) => c.rank <= soft).sort((a, b) => a.rank - b.rank);
      const holds = cells.filter((c) => c.rank > tough);
      const best = Math.min(...cells.map((c) => c.rank));
      const level = leaks.length >= 3 || best <= 3 ? 'veryWeak' : leaks.length ? 'weak' : holds.length >= 3 ? 'very' : holds.length ? 'strong' : 'average';
      const word = leaks.length ? (leaks.length === cells.length ? 'Every position' : leaks.map((c) => c.pos).join(', ')) : holds.length === cells.length ? 'Holds every position' : holds.length ? 'Holds' : 'Average';
      const named = (leaks.length ? leaks : [...cells].sort((a, b) => a.rank - b.rank).slice(0, 2));
      const text = named.map((c) => `${c.pos} #${c.rank}${c.sheet != null && c.pf != null ? ` (PropFinder #${c.pf}, sheet #${c.sheet})` : allowed.from === 'sheet' ? ' (sheet)' : ''}`).join(' · ') + ` of ${n}` + (leaks.length ? '' : ' · nothing in the soft third');
      out[key] = cell(level, word, text, { from: allowed.from || 'propfinder' });
    }
  }
  // The cheat sheet's named players on the side (a play of theirs confirmed by the sheet).
  if (side?.players) {
    const named = side.players.filter((p) => (p.plays || []).some((x) => x.confirmed || x.onSheet));
    const files = [...new Set(side.players.flatMap((p) => (p.plays || []).flatMap((x) => x.sheetFiles || [])))];
    out.sheet = named.length
      ? cell('average', `${named.length} named`, named.map((p) => p.player.split(' ').slice(-1)[0]).join(', ') + (files.length ? ` · ${files.join(', ')}` : ''))
      : cell('average', 'No sheet', 'no cheat sheet names this side');
  }
  return Object.keys(out).length ? out : null;
}

/** The rows the table draws, in order: [key, label, hover]. */
export const ROWS = [
  ['expected', 'Expected points', 'The side’s expected points tonight: its own per-game figure through the opponent’s environment (PropFinder), against the league’s average'],
  ['scoring', 'Scoring', 'Points a game, ranked over the league (PropFinder’s team row)'],
  ['ptsAgainst', 'Defense', 'Points allowed a game, 1st = the fewest'],
  ['trend', 'Defense, last ten', 'Points allowed over its last ten against the season: tightening or loosening at five ranks’ drift'],
  ['leaksPts', 'Gives up points to', 'The positions it gives up the most points to: PropFinder’s rank with the cheat sheet’s tile, blended (the matchup the projections read); 1 = the most'],
  ['leaksReb', 'Gives up rebounds to', 'The same for rebounds'],
  ['leaksAst', 'Gives up assists to', 'The same for assists'],
  ['leaksTpm', 'Gives up threes to', 'The same for threes'],
  ['rebounding', 'Rebounding', 'Rebounds a game, ranked'],
  ['playmaking', 'Ball movement', 'Assists a game, ranked'],
  ['threes', 'Three-point shooting', 'Threes a game, ranked, with the share of its points from threes'],
  ['line', 'Getting to the line', 'Free throws made a game, ranked'],
  ['security', 'Ball security', 'Turnovers a game, 1st = the fewest'],
  ['forcing', 'Forcing turnovers', 'Turnovers forced a game, 1st = the most'],
  ['rebAgainst', 'Defensive glass', 'Rebounds allowed a game, 1st = the fewest'],
  ['tpmAgainst', 'Defending the three', 'Threes allowed a game, 1st = the fewest'],
  ['sheet', 'On the cheat sheet', 'The players the cheat sheet names on the side'],
];

/** Both teams of a game: { teams: [away, home], cells: { [team]: { aspect: cell } }, rows: the aspects either team has } or null. */
export function gameProfile(g, defense, sides) {
  const teams = [g.away, g.home];
  const cells = {};
  for (const team of teams) {
    const opp = team === g.away ? g.home : g.away;
    const t = teamProfile({ team, defense, side: sides?.[team] || null, oppSide: sides?.[opp] || null });
    if (t) cells[team] = t;
  }
  if (!Object.keys(cells).length) return null;
  const rows = ROWS.filter(([key]) => teams.some((t) => cells[t]?.[key]));
  return { teams, cells, rows: rows.map(([key, label, hover]) => ({ key, label, hover })), positions: POS_WORD };
}

export const profile = { gameProfile, teamProfile };
