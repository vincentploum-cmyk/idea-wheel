// The matchup profile of an NBA game, the NHL card's form (Vincent, 2026-10-31: "now do the same profile for the NBA
// board"; the firsthalfscore layout of 2026-10-30 and its offense / defense toggle of the next morning are gone): the
// two teams side by side, five rows, each cell a word (Elite · Strong · Average · Weak · Poor for an attack, Elite ·
// Tight · Average · Leaky · Very leaky for a defense) over one line of figures with every rank phrase in its tone —
// green = more points likely from that side's angle, red = fewer. Built on the board from the pull's team rows
// (`totals[ABBR].for` the team's own per-game row, `.against` what it gives up, `.l10` its last ten; ranked here over
// the teams in the pull) and the sides' allowed tables (what the team gives up to each position: PropFinder's rank
// with the cheat sheet's tile beside it, `rankBlend` the two together, the matchup the projections read). Pure;
// nothing here touches a number on the board.
import { levelOf, ordinal, badgeOf, bestOf, cellOf, rankPart } from '../picks/profile-words';
import { POS_WORD } from './characteristics';

const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const STATS = [['pts', 'points'], ['reb', 'rebounds'], ['ast', 'assists'], ['tpm', 'threes']];
const r1 = (v) => (v == null ? '—' : Number(v).toFixed(1));
const pct = (v) => `${Math.round(v * 100)}%`;
/** A last-ten rank this far from the season rank reads tightening / loosening. */
export const TREND_DRIFT = 5;

/** Rank 1 = the highest figure, or the lowest when `low`; ties share the better rank. { rank, n } or null. */
export function rankIn(values, mine, low = false) {
  if (mine == null) return null;
  const have = values.filter((v) => v != null);
  if (!have.length) return null;
  return { rank: have.filter((v) => (low ? v < mine : v > mine)).length + 1, n: have.length };
}
const src = (row) => (row?.held ? 'last season’s row' : row?.gp ? `${row.gp} games` : 'this season');

/** The five rows, in order, with the hover text under the label. */
export const PROFILE_ROWS = [
  { key: 'scoring', label: 'Scoring', hint: 'Points a game, ranked over the league (PropFinder’s team row), with the threes made a game and their share of its points.' },
  { key: 'rebounding', label: 'Rebounding', hint: 'Rebounds a game, ranked over the league.' },
  { key: 'playmaking', label: 'Playmaking', hint: 'Assists a game, ranked, with the turnovers a game (1st = the fewest).' },
  { key: 'allows', label: 'Allows', hint: 'Points allowed a game, 1 = the most; its last ten beside the season, tightening or loosening at five ranks’ drift.' },
  { key: 'spots', label: 'Soft spots', hint: 'The positions it gives up the most points, rebounds, assists and threes to: PropFinder’s rank with the cheat sheet’s tile, blended (the matchup the projections read); the soft third named, 1 = the most. Hover a cell for both reads.' },
];

/** One team's cells, keyed by row. `oppSide` is the opponent's entry on the board game (its `allowed` is what this team gives up). */
export function teamProfile({ team, defense, oppSide }) {
  const totals = defense?.totals || {};
  const mine = totals[team] || null;
  const abbrs = Object.keys(totals);
  const out = {};
  const forOf = (stat) => abbrs.map((a) => totals[a]?.for?.[stat] ?? null);
  const againstOf = (stat) => abbrs.map((a) => totals[a]?.against?.[stat] ?? null);
  if (mine?.for) {
    const f = mine.for;
    const pts = rankIn(forOf('pts'), f.pts);
    if (pts) {
      const tpm = rankIn(forOf('tpm'), f.tpm);
      const parts = [{ t: `${r1(f.pts)} points a game · ` }, rankPart('attack', pts.rank, pts.n)];
      if (tpm) parts.push({ t: ` · ${r1(f.tpm)} threes (` }, { t: ordinal(tpm.rank), tone: badgeOf('attack', tpm.rank, tpm.n).tone }, { t: `${f.pts ? `, ${pct((f.tpm * 3) / f.pts)} of its points` : ''})` });
      out.scoring = cellOf(badgeOf('attack', pts.rank, pts.n), 'propfinder', `PropFinder's team row, ${src(f)}: ${r1(f.pts)} points a game, ${ordinal(pts.rank)} of ${pts.n}${tpm ? ` · ${r1(f.tpm)} threes made a game, ${ordinal(tpm.rank)} of ${tpm.n}` : ''}${f.ftm != null ? ` · ${r1(f.ftm)} free throws made a game` : ''}`, parts);
    }
    const reb = rankIn(forOf('reb'), f.reb);
    if (reb) out.rebounding = cellOf(badgeOf('attack', reb.rank, reb.n), 'propfinder', `PropFinder's team row, ${src(f)}: ${r1(f.reb)} rebounds a game, ${ordinal(reb.rank)} of ${reb.n}`, [{ t: `${r1(f.reb)} rebounds a game · ` }, rankPart('attack', reb.rank, reb.n)]);
    const ast = rankIn(forOf('ast'), f.ast);
    if (ast) {
      const tov = rankIn(forOf('tov'), f.tov, true);   // fewer turnovers rank first
      const parts = [{ t: `${r1(f.ast)} assists a game · ` }, rankPart('attack', ast.rank, ast.n)];
      if (tov) parts.push({ t: ` · ${r1(f.tov)} turnovers (` }, { t: `${ordinal(tov.rank)} fewest`, tone: badgeOf('attack', tov.rank, tov.n).tone }, { t: ')' });
      out.playmaking = cellOf(badgeOf('attack', ast.rank, ast.n), 'propfinder', `PropFinder's team row, ${src(f)}: ${r1(f.ast)} assists a game, ${ordinal(ast.rank)} of ${ast.n}${tov ? ` · ${r1(f.tov)} turnovers a game, ${ordinal(tov.rank)} of ${tov.n} fewest` : ''}`, parts);
    }
  }
  if (mine?.against?.pts != null) {
    const v = mine.against.pts;
    const r = rankIn(againstOf('pts'), v);   // 1 = allows the most
    if (r) {
      const parts = [{ t: `${r1(v)} points allowed a game · ` }, rankPart('defense', r.rank, r.n, ' most')];
      let hover = `PropFinder's team row, ${src(mine.against)}: ${r1(v)} points allowed a game, ${ordinal(r.rank)} of ${r.n} most`;
      let trend = null;
      // The last ten against the season, over the teams with a last-ten row.
      const l10 = mine.l10?.against?.pts ?? null;
      if (l10 != null) {
        const l10Of = (a) => totals[a]?.l10?.against?.pts ?? null;
        const withL10 = abbrs.filter((a) => l10Of(a) != null);
        const now = rankIn(withL10.map(l10Of), l10);
        const season = rankIn(withL10.map((a) => totals[a]?.against?.pts ?? null), v);
        if (now && season && now.n >= 10) {
          const drift = now.rank - season.rank;   // ranks of "most allowed": a lower rank lately = allowing more = loosening
          trend = drift <= -TREND_DRIFT ? 'loosening' : drift >= TREND_DRIFT ? 'tightening' : null;
          parts.push({ t: ` · last ${mine.l10.against.gp || 10}: ${r1(l10)} (` }, { t: `${ordinal(now.rank)} most`, tone: badgeOf('defense', bestOf(now.rank, now.n), now.n).tone }, { t: `${trend ? `, ${trend}` : ''})` });
          hover += ` · its last ${mine.l10.against.gp || 10}: ${r1(l10)} allowed, ${ordinal(now.rank)} of ${now.n} most${trend ? `, ${trend}` : ''}`;
        }
      }
      out.allows = { ...cellOf(badgeOf('defense', bestOf(r.rank, r.n), r.n), 'propfinder', hover, parts), trend };
    }
  }
  // What it gives up to each position: the opponent side's allowed table (PropFinder's rank, the cheat sheet's tile
  // beside it, rankBlend the two: the matchup the projections read). Per stat the positions in the soft third, named.
  const allowed = oppSide?.allowed || null;
  if (allowed?.rows) {
    const n = allowed.count || 30;
    const soft = Math.ceil(n / 3); const tough = n - soft;
    const parts = []; const hover = [];
    let softCount = 0; let toughCount = 0; let stats = 0;
    for (const [stat, noun] of STATS) {
      const cells = POSITIONS.map((pos) => { const c = allowed.rows[pos]?.[stat]; const rank = c?.rankBlend ?? c?.rank ?? null; return rank ? { pos, rank, pf: c.rank ?? null, sheet: c.sheet ?? null, value: c.value ?? null } : null; }).filter(Boolean);
      if (!cells.length) continue;
      stats += 1;
      const leaks = cells.filter((c) => c.rank <= soft).sort((a, b) => a.rank - b.rank);
      softCount += leaks.length; toughCount += cells.filter((c) => c.rank > tough).length;
      if (parts.length) parts.push({ t: ' · ' });
      if (leaks.length) {
        parts.push({ t: `${noun} to ` });
        leaks.forEach((c, i) => { if (i) parts.push({ t: ', ' }); parts.push({ t: `${c.pos} #${c.rank}`, tone: 'is-soft' }); });
      } else parts.push({ t: `${noun}: none` });
      const read = (c) => `${c.pos} #${c.rank}${c.sheet != null && c.pf != null ? ` (PropFinder #${c.pf}, sheet #${c.sheet})` : allowed.from === 'sheet' ? ' (sheet)' : ''}`;
      hover.push(`${noun}: ${[...cells].sort((a, b) => a.rank - b.rank).map(read).join(', ')} of ${n}`);
    }
    if (stats) {
      const level = softCount >= 4 ? 'poor' : softCount ? 'weak' : toughCount >= 6 ? 'strong' : 'average';
      const word = { poor: 'Very leaky', weak: 'Leaky', strong: 'Tight', average: 'Average' }[level];
      const tone = level === 'poor' || level === 'weak' ? 'is-soft' : level === 'strong' ? 'is-tough' : '';
      out.spots = cellOf({ word, level, tone }, allowed.from || 'propfinder', `what it gives up to each position, ${allowed.from === 'sheet' ? 'the cheat sheet’s tiles' : 'PropFinder’s table with the cheat sheet’s tiles blended in'}, 1 = the most · ${hover.join(' · ')}`, parts);
    }
  }
  return Object.keys(out).length ? out : null;
}

/** The defense pill in the head: the team's points allowed in thirds, 1 = the most. */
function verdictOf(cells) {
  const a = cells?.allows;
  if (!a) return null;
  const tier = a.level === 'elite' || a.level === 'strong' ? 'tight' : a.level === 'weak' || a.level === 'poor' ? 'leaky' : 'average';
  return { headline: `${{ tight: 'Tight', leaky: 'Leaky', average: 'Average' }[tier]} defense`, tier };
}

/**
 * Both teams of a game in the matchup profile's shape (components/nhl/MatchupProfile.jsx draws it):
 * { order: [away, home], teams: { ABBR: head }, total, title, legend, rows: [{ key, label, hint, cells }] } or null.
 */
export function gameProfile(g, defense, sides) {
  const order = [g.away, g.home];
  const cells = {};
  const heads = {};
  for (const team of order) {
    const opp = team === g.away ? g.home : g.away;
    const t = teamProfile({ team, defense, oppSide: sides?.[opp] || null });
    if (t) cells[team] = t;
    const row = defense?.totals?.[team]?.for || null;
    const out = sides?.[team]?.out?.length || 0;
    heads[team] = {
      team, venue: team === g.home ? 'H' : 'A', opp,
      games: row?.gp || 0,
      sub: `${row ? (row.held ? 'last season’s row' : `${row.gp} games`) : 'no team row'}${out ? ` · ${out} out` : ''} · PropFinder`,
      verdict: verdictOf(t),
    };
  }
  if (!Object.keys(cells).length) return null;
  const rows = PROFILE_ROWS.map((row) => ({ ...row, cells: Object.fromEntries(order.map((t) => [t, cells[t]?.[row.key] || null])) })).filter((row) => order.some((t) => row.cells[t]));
  if (!rows.length) return null;
  const exp = (t) => sides?.[t]?.teamProj?.pts;
  const total = order.every((t) => exp(t) != null)
    ? { headline: `${Math.round(order.reduce((s, t) => s + exp(t), 0))} points expected · ${order.map((t) => `${t} ${Math.round(exp(t))}`).join(' · ')}`, tier: null, title: 'Each side’s expected points tonight: its own per-game figure through the opponent’s environment (PropFinder)' }
    : null;
  return { order, teams: heads, total, rows, title: 'Matchup profile', legend: 'this season · green = more points likely, red = fewer · hover a cell for both reads', positions: POS_WORD };
}

export const profile = { gameProfile, teamProfile };
