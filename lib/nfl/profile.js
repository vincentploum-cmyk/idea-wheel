// The matchup profile of an NFL game, the NHL card's form (Vincent, 2026-10-31: "now do the same profile for the NFL
// board", after the NHL's and the NBA's): the two teams side by side, five rows, each cell a word (Elite · Strong ·
// Average · Weak · Poor for an attack, Elite · Tight · Average · Leaky · Very leaky for a defense) over one line of
// figures with every rank phrase in its tone — green = more yards and touchdowns likely from that side's angle, red =
// fewer. Built on the board from the pull's team rows (`totals[ABBR].for` the team's own per-game row, `.against` what
// it gives up; ranked here over the teams in the pull) and the sides' allowed tables (what the team gives up to each
// position: PropFinder's rank with the cheat sheet's tile beside it, `rankBlend` the two together). Pure.
import { ordinal, badgeOf, bestOf, cellOf, rankPart } from '../picks/profile-words';
import { POS_WORD } from './characteristics';

/** The positions the soft spots name and the yards each is read on. */
const SPOTS = [['QB', 'passYds', 'passing'], ['RB', 'rushYds', 'rushing'], ['WR', 'recYds', 'receiving'], ['TE', 'recYds', 'receiving']];
const r1 = (v) => (v == null ? '—' : Number(v).toFixed(1));
const r0 = (v) => (v == null ? '—' : String(Math.round(Number(v))));
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
const yardsOf = (row) => (row && (row.passYds != null || row.rushYds != null) ? (row.passYds || 0) + (row.rushYds || 0) : null);

/** The five rows, in order, with the hover text under the label. */
export const PROFILE_ROWS = [
  { key: 'passing', label: 'Passing', hint: 'Passing yards a game, ranked over the league (PropFinder’s team row), with the passing touchdowns a game.' },
  { key: 'rushing', label: 'Rushing', hint: 'Rushing yards a game, ranked, with the rushing touchdowns a game.' },
  { key: 'endzone', label: 'End zone', hint: 'Touchdowns a game (rushing, receiving and returns), ranked, with the interceptions thrown (1st = the fewest).' },
  { key: 'allows', label: 'Allows', hint: 'Yards allowed a game, passing and rushing, 1 = the most, with the touchdowns allowed; the last ten beside the season when the pull carries them.' },
  { key: 'spots', label: 'Soft spots', hint: 'The positions it gives up the most yards to — passing to quarterbacks, rushing to backs, receiving to receivers and tight ends: PropFinder’s rank with the cheat sheet’s tile, blended (the matchup the projections read); the soft third named, 1 = the most.' },
];

/** One team's cells, keyed by row. `oppSide` is the opponent's entry on the board game (its `allowed` is what this team gives up). */
export function teamProfile({ team, defense, oppSide }) {
  const totals = defense?.totals || {};
  const mine = totals[team] || null;
  const abbrs = Object.keys(totals);
  const out = {};
  const forOf = (stat) => abbrs.map((a) => totals[a]?.for?.[stat] ?? null);
  const againstOf = (fn) => abbrs.map((a) => fn(totals[a]?.against || null));
  if (mine?.for) {
    const f = mine.for;
    const passing = rankIn(forOf('passYds'), f.passYds);
    if (passing) {
      const td = rankIn(forOf('passTd'), f.passTd);
      const parts = [{ t: `${r1(f.passYds)} passing yards a game · ` }, rankPart('attack', passing.rank, passing.n)];
      if (td) parts.push({ t: ` · ${r1(f.passTd)} TD (` }, { t: ordinal(td.rank), tone: badgeOf('attack', td.rank, td.n).tone }, { t: ')' });
      out.passing = cellOf(badgeOf('attack', passing.rank, passing.n), 'propfinder', `PropFinder's team row, ${src(f)}: ${r1(f.passYds)} passing yards a game, ${ordinal(passing.rank)} of ${passing.n}${td ? ` · ${r1(f.passTd)} passing touchdowns a game, ${ordinal(td.rank)} of ${td.n}` : ''}${f.passCmp && f.passAtt ? ` · ${Math.round((f.passCmp / f.passAtt) * 100)}% completed, ${(f.passYds / f.passCmp).toFixed(1)} yards a completion` : ''}`, parts);
    }
    const rushing = rankIn(forOf('rushYds'), f.rushYds);
    if (rushing) {
      const td = rankIn(forOf('rushTd'), f.rushTd);
      const parts = [{ t: `${r1(f.rushYds)} rushing yards a game · ` }, rankPart('attack', rushing.rank, rushing.n)];
      if (td) parts.push({ t: ` · ${r1(f.rushTd)} TD (` }, { t: ordinal(td.rank), tone: badgeOf('attack', td.rank, td.n).tone }, { t: ')' });
      out.rushing = cellOf(badgeOf('attack', rushing.rank, rushing.n), 'propfinder', `PropFinder's team row, ${src(f)}: ${r1(f.rushYds)} rushing yards a game, ${ordinal(rushing.rank)} of ${rushing.n}${td ? ` · ${r1(f.rushTd)} rushing touchdowns a game, ${ordinal(td.rank)} of ${td.n}` : ''}${f.rushAtt ? ` · ${(f.rushYds / f.rushAtt).toFixed(1)} yards a carry` : ''}`, parts);
    }
    const td = rankIn(forOf('td'), f.td);
    if (td) {
      const ints = rankIn(forOf('passInt'), f.passInt, true);   // fewer interceptions rank first
      const parts = [{ t: `${r1(f.td)} touchdowns a game · ` }, rankPart('attack', td.rank, td.n)];
      if (ints) parts.push({ t: ` · ${r1(f.passInt)} interceptions thrown (` }, { t: `${ordinal(ints.rank)} fewest`, tone: badgeOf('attack', ints.rank, ints.n).tone }, { t: ')' });
      out.endzone = cellOf(badgeOf('attack', td.rank, td.n), 'propfinder', `PropFinder's team row, ${src(f)}: ${r1(f.td)} touchdowns a game (rushing, receiving and returns), ${ordinal(td.rank)} of ${td.n}${ints ? ` · ${r1(f.passInt)} interceptions thrown a game, ${ordinal(ints.rank)} of ${ints.n} fewest` : ''}`, parts);
    }
  }
  const against = mine?.against || null;
  const yds = yardsOf(against);
  if (yds != null) {
    const r = rankIn(againstOf(yardsOf), yds);   // 1 = allows the most
    if (r) {
      const td = against.td != null ? rankIn(againstOf((row) => row?.td ?? null), against.td) : null;
      const parts = [{ t: `${r0(yds)} yards allowed a game (${r0(against.passYds)} passing, ${r0(against.rushYds)} rushing) · ` }, rankPart('defense', r.rank, r.n, ' most')];
      if (td) parts.push({ t: ` · ${r1(against.td)} TD allowed (` }, { t: `${ordinal(td.rank)} most`, tone: badgeOf('defense', bestOf(td.rank, td.n), td.n).tone }, { t: ')' });
      let hover = `PropFinder's team row, ${src(against)}: ${r0(yds)} yards allowed a game, ${ordinal(r.rank)} of ${r.n} most (${r0(against.passYds)} passing, ${r0(against.rushYds)} rushing)${td ? ` · ${r1(against.td)} touchdowns allowed a game, ${ordinal(td.rank)} of ${td.n} most` : ''}${against.passInt != null ? ` · ${r1(against.passInt)} interceptions a game` : ''}`;
      let trend = null;
      const l10 = yardsOf(mine.l10?.against || null);
      if (l10 != null) {
        const l10Of = (a) => yardsOf(totals[a]?.l10?.against || null);
        const withL10 = abbrs.filter((a) => l10Of(a) != null);
        const now = rankIn(withL10.map(l10Of), l10);
        const season = rankIn(withL10.map((a) => yardsOf(totals[a]?.against || null)), yds);
        if (now && season && now.n >= 10) {
          const drift = now.rank - season.rank;
          trend = drift <= -TREND_DRIFT ? 'loosening' : drift >= TREND_DRIFT ? 'tightening' : null;
          parts.push({ t: ` · last ${mine.l10.against.gp || 10}: ${r0(l10)} (` }, { t: `${ordinal(now.rank)} most`, tone: badgeOf('defense', bestOf(now.rank, now.n), now.n).tone }, { t: `${trend ? `, ${trend}` : ''})` });
          hover += ` · its last ${mine.l10.against.gp || 10}: ${r0(l10)} yards allowed, ${ordinal(now.rank)} of ${now.n} most${trend ? `, ${trend}` : ''}`;
        }
      }
      out.allows = { ...cellOf(badgeOf('defense', bestOf(r.rank, r.n), r.n), 'propfinder', hover, parts), trend };
    }
  }
  const allowed = oppSide?.allowed || null;
  if (allowed?.rows) {
    const n = allowed.count || 32;
    const soft = Math.ceil(n / 3); const tough = n - soft;
    const parts = []; const hover = [];
    let softCount = 0; let toughCount = 0; let read = 0;
    // One phrase per kind of yards: passing to the quarterbacks, rushing to the backs, receiving to the receivers and tight ends.
    for (const noun of ['passing', 'rushing', 'receiving']) {
      const cells = SPOTS.filter(([, , word]) => word === noun).map(([pos, stat]) => { const c = allowed.rows[pos]?.[stat]; const rank = c?.rankBlend ?? c?.rank ?? null; return rank ? { pos, rank, pf: c.rank ?? null, sheet: c.sheet ?? null, value: c.value ?? null } : null; }).filter(Boolean);
      if (!cells.length) continue;
      read += 1;
      const leaks = cells.filter((c) => c.rank <= soft).sort((a, b) => a.rank - b.rank);
      softCount += leaks.length; toughCount += cells.filter((c) => c.rank > tough).length;
      if (parts.length) parts.push({ t: ' · ' });
      if (leaks.length) {
        parts.push({ t: `${noun} to ` });
        leaks.forEach((c, i) => { if (i) parts.push({ t: ', ' }); parts.push({ t: `${c.pos} #${c.rank}`, tone: 'is-soft' }); });
      } else parts.push({ t: `${noun}: none` });
      hover.push(`${noun} yards: ${[...cells].sort((a, b) => a.rank - b.rank).map((c) => `${c.pos} #${c.rank}${c.sheet != null && c.pf != null ? ` (PropFinder #${c.pf}, sheet #${c.sheet})` : allowed.from === 'sheet' ? ' (sheet)' : ''}${c.value != null ? `, ${r1(c.value)} a game` : ''}`).join(', ')} of ${n}`);
    }
    if (read) {
      const level = softCount >= 3 ? 'poor' : softCount ? 'weak' : toughCount >= 3 ? 'strong' : 'average';
      const word = { poor: 'Very leaky', weak: 'Leaky', strong: 'Tight', average: 'Average' }[level];
      const tone = level === 'poor' || level === 'weak' ? 'is-soft' : level === 'strong' ? 'is-tough' : '';
      out.spots = cellOf({ word, level, tone }, allowed.from || 'propfinder', `what it gives up to each position, ${allowed.from === 'sheet' ? 'the cheat sheet’s tiles' : 'PropFinder’s table with the cheat sheet’s tiles blended in'}, 1 = the most · ${hover.join(' · ')}`, parts);
    }
  }
  return Object.keys(out).length ? out : null;
}

/** The defense pill in the head: the team's yards allowed in thirds, 1 = the most. */
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
  // The card's pill: the expected touchdowns when the sides carry them.
  const exp = (t) => sides?.[t]?.teamProj?.td;
  const total = order.every((t) => exp(t) != null)
    ? { headline: `${(order.reduce((s, t) => s + exp(t), 0)).toFixed(1)} touchdowns expected · ${order.map((t) => `${t} ${exp(t).toFixed(1)}`).join(' · ')}`, tier: null, title: 'Each side’s expected touchdowns: its own per-game figure through the opponent’s environment (PropFinder)' }
    : null;
  return { order, teams: heads, total, rows, title: 'Matchup profile', legend: 'this season · green = more yards and touchdowns likely, red = fewer · hover a cell for both reads', positions: POS_WORD };
}

export const profile = { gameProfile, teamProfile };
