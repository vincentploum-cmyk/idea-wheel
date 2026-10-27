// Team characteristics for the picks boards (NBA, NFL), the Matchups card's layout: strengths and
// weaknesses as traits with a badge, the style of play as plain traits, no number in the line (the
// figures ride on each trait as `detail` for the hover). Read from the pull's defense block
// (lib/picks/propfinder.js defenseAllowed): `totals[ABBR].for` = the team's own per-game row,
// `.against` = what it gives up in all, both ranked here over the league; `teams` / `ranks` = what
// it gives up per position (rank 1 = the most). A sport binds it with a config:
//   { attack: [{ key, stat, text, low }], defense: [{ key, stat, text, own, low }],
//     positions: { stat | statOf(pos), word: { POS: 'point guards' } }, headline: stat, style(ctx),
//     trend: { stat, unit } }
// `low`: a lower figure is the better one (turnovers); `own`: a defense trait read off the team's own
// row (blocks) rather than what it gives up; `trend`: the last ten against the season on what it
// gives up (`totals[ABBR].l10.against`, the All row at lastN 10), the NHL card's loosening /
// tightening line, when the two ranks drift `TREND_DRIFT` places or more. Pure; nothing here
// touches a number on the board.
import { levelOf, joinAnd, splitTraits, STRENGTHS } from './levels';

const META = ['gp', 'season', 'prior', 'priorSeason', 'lastN', 'held'];
const r1 = (v) => Number(v).toFixed(1);
const pct = (v) => `${Math.round(Number(v) * 100)}%`;

export const TIER_TEXT = { leaky: 'Leaky defense', average: 'Average defense', tight: 'Tight defense' };
/** Ranks of drift between the last ten and the season before the trend line reads. */
export const TREND_DRIFT = 5;
/** Teams with a last-ten row before the trend is ranked at all. */
export const TREND_MIN_TEAMS = 10;
export const TIER_TONE = { leaky: 'is-soft', tight: 'is-tough', average: '' };

/** Rank 1 = the best: the highest figure, or the lowest when `low`. Ties share the better rank. */
function rankIn(values, mine, low = false) {
  if (mine == null) return null;
  const have = values.filter((v) => v != null);
  if (!have.length) return null;
  const better = have.filter((v) => (low ? v < mine : v > mine)).length;
  return { rank: better + 1, n: have.length };
}

/** "last season's row (0 games this season)" or "12 games" for the hover. */
function rowSource(row) {
  if (!row) return '';
  if (row.held) return `last season's row until ten games (${row.gp || 0} this season)`;
  if (row.prior && row.gp) return `${row.gp} games this season, blended with last`;
  return row.gp ? `${row.gp} games` : 'this season';
}

export function makeCharacteristics(cfg) {
  const { attack = [], defense: defenseTraits = [], positions = null, headline = null, style = null, trend = null, teamCount = 32 } = cfg;

  /**
   * One team's characteristics against the pull's defense block (`teams`, `ranks`, `league`, `count`,
   * `totals`, `leagueFor`). Returns { team, venue, headline, tier, tone, strengths, weaknesses,
   * style } or null when the block carries nothing for the team.
   */
  function teamCharacteristics({ team, venue = null, defense = null }) {
    if (!team || !defense) return null;
    const totals = defense.totals || {};
    const mine = totals[team];
    const traits = [];
    const styleOut = [];
    const forOf = (abbr, stat) => totals[abbr]?.for?.[stat] ?? null;
    const againstOf = (abbr, stat) => totals[abbr]?.against?.[stat] ?? null;
    const abbrs = Object.keys(totals);

    // ── The team's own row: the attack traits, and the defense traits read off it (blocks, steals).
    if (mine?.for) {
      const src = rowSource(mine.for);
      for (const t of attack) {
        const v = mine.for[t.stat];
        const r = rankIn(abbrs.map((a) => forOf(a, t.stat)), v, !!t.low);
        const level = r && levelOf(r.rank, r.n);
        if (level) traits.push({ key: t.key, kind: 'attack', text: t.text, level, rank: r.rank, n: r.n, detail: `${r1(v)} ${t.unit || t.stat} a game, #${r.rank} of ${r.n}${t.low ? ' fewest' : ''} · PropFinder, ${src}` });
      }
      for (const t of defenseTraits.filter((x) => x.own)) {
        const v = mine.for[t.stat];
        const r = rankIn(abbrs.map((a) => forOf(a, t.stat)), v, !!t.low);
        const level = r && levelOf(r.rank, r.n);
        if (level) traits.push({ key: t.key, kind: 'defense', text: t.text, level, rank: r.rank, n: r.n, detail: `${r1(v)} ${t.unit || t.stat} a game, #${r.rank} of ${r.n} · PropFinder, ${src}` });
      }
    }
    // ── What it gives up in all: the defense traits (rank 1 = allows the least, the best).
    let tier = null;
    if (mine?.against) {
      const src = rowSource(mine.against);
      for (const t of defenseTraits.filter((x) => !x.own)) {
        const v = mine.against[t.stat];
        // Allowing less is better, unless the stat is one the opponent gives away (their turnovers).
        const r = rankIn(abbrs.map((a) => againstOf(a, t.stat)), v, !t.low);
        const level = r && levelOf(r.rank, r.n);
        if (level) traits.push({ key: t.key, kind: 'defense', text: t.text, level, rank: r.rank, n: r.n, detail: `${r1(v)} ${t.unit || t.stat} a game allowed, #${r.rank} of ${r.n}${t.low ? ' most forced' : ' fewest'} · PropFinder, ${src}` });
      }
      if (headline) {
        const v = mine.against[headline];
        const r = rankIn(abbrs.map((a) => againstOf(a, headline)), v, false); // rank 1 = allows the most
        if (r) { const third = Math.ceil(r.n / 3); tier = r.rank <= third ? 'leaky' : r.rank > r.n - third ? 'tight' : 'average'; }
      }
    }
    // ── The last ten against the season on what it gives up: the ranks over the teams with a last-ten row
    // (1 = allows the fewest), the line when they drift TREND_DRIFT places or more.
    if (trend && mine?.l10?.against?.[trend.stat] != null && mine?.against?.[trend.stat] != null) {
      const l10Of = (abbr) => totals[abbr]?.l10?.against?.[trend.stat] ?? null;
      const withL10 = abbrs.filter((a) => l10Of(a) != null);
      const now = rankIn(withL10.map(l10Of), l10Of(team), true);
      const season = rankIn(withL10.map((a) => againstOf(a, trend.stat)), againstOf(team, trend.stat), true);
      if (now && season && now.n >= TREND_MIN_TEAMS) {
        const drift = season.rank - now.rank;   // positive = a better rank lately
        const unit = trend.unit || trend.stat;
        const detail = `${r1(mine.l10.against[trend.stat])} ${unit} a game allowed over its last ${mine.l10.against.gp || 10}, #${now.rank} of ${now.n} fewest, against #${season.rank} of ${season.n} on the season · PropFinder`;
        if (drift <= -TREND_DRIFT) traits.push({ key: 'trend', kind: 'defense', text: 'Defense loosening over the last ten', level: now.rank > now.n - 4 ? 'veryWeak' : 'weak', rank: now.rank, n: now.n, detail });
        if (drift >= TREND_DRIFT) traits.push({ key: 'trend', kind: 'defense', text: 'Defense tightening over the last ten', level: now.rank <= 4 ? 'very' : 'strong', rank: now.rank, n: now.n, detail });
      }
    }
    // ── By position: the positions it leaks to and holds, one line each way (rank 1 = allows the most).
    if (positions && defense.ranks?.[team]) {
      const n = defense.count || Object.keys(defense.teams || {}).length || teamCount;
      const statOf = (pos) => (typeof positions.stat === 'function' ? positions.stat(pos) : positions.stat);
      const byPos = Object.keys(defense.ranks[team]).filter((pos) => !positions.only || positions.only.includes(pos)).map((pos) => { const stat = statOf(pos); const rank = defense.ranks[team][pos]?.[stat] ?? null; return rank ? { pos, stat, rank, value: defense.teams?.[team]?.[pos]?.[stat] ?? null, n } : null; }).filter(Boolean);
      const level = (p) => levelOf(n + 1 - p.rank, n);
      const leaks = byPos.filter((p) => ['weak', 'veryWeak'].includes(level(p))).sort((a, b) => a.rank - b.rank);
      const holds = byPos.filter((p) => STRENGTHS.includes(level(p))).sort((a, b) => b.rank - a.rank);
      const word = (p) => positions.word?.[p.pos] || p.pos;
      const unit = (p) => positions.unit?.(p.stat) || p.stat;
      const detail = (list) => list.map((p) => `${p.pos} ${p.value != null ? `${r1(p.value)} ${unit(p)} a game, ` : ''}#${p.rank} of ${p.n} most`).join(' · ');
      const all = byPos.length >= 4;
      if (leaks.length) traits.push({ key: 'leaks', kind: 'defense', text: all && leaks.length === byPos.length ? `Leaks at every position` : `Gives up ${positions.noun || 'production'} to ${joinAnd(leaks.map(word))}`, level: leaks[0].rank <= 4 ? 'veryWeak' : 'weak', rank: n + 1 - leaks[0].rank, n, detail: detail(leaks) });
      if (holds.length) traits.push({ key: 'holds', kind: 'defense', text: all && holds.length === byPos.length ? `Holds every position` : `Holds ${joinAnd(holds.map(word))}`, level: holds[0].rank > n - 4 ? 'very' : 'strong', rank: n + 1 - holds[0].rank, n, detail: detail(holds) });
    }
    // ── Style: the sport's reads off the team's own row and what it gives up, against the league.
    if (style && mine) {
      const leagueAgainst = {};
      for (const key of new Set(abbrs.flatMap((a) => Object.keys(totals[a]?.against || {})))) {
        if (META.includes(key)) continue;
        const have = abbrs.map((a) => againstOf(a, key)).filter((v) => v != null);
        if (have.length) leagueAgainst[key] = have.reduce((s, v) => s + v, 0) / have.length;
      }
      for (const t of style({ own: mine.for || null, against: mine.against || null, league: defense.leagueFor || {}, leagueAgainst, pct, r1 }) || []) if (t) styleOut.push(t);
    }

    const { strengths, weaknesses } = splitTraits(traits, teamCount);
    if (!strengths.length && !weaknesses.length && !styleOut.length) return null;
    return { team, venue, tier, headline: tier ? TIER_TEXT[tier] : null, tone: tier ? TIER_TONE[tier] : '', strengths, weaknesses, style: styleOut };
  }

  /** Both teams of a game: { [away]: …, [home]: … }, or null when neither has a read. */
  function gameCharacteristics(g, defense) {
    const out = Object.fromEntries([[g.away, 'A'], [g.home, 'H']].map(([team, venue]) => [team, teamCharacteristics({ team, venue, defense })]));
    return Object.values(out).some(Boolean) ? out : null;
  }

  return { teamCharacteristics, gameCharacteristics };
}

/** A style trait when `value` sits `edge` or more above (`up`) or below (`down`) the league's figure. */
export function shareTrait({ key, kind = 'attack', value, league, edge = 0.15, up, down, detail }) {
  if (value == null || !(league > 0)) return null;
  const ratio = value / league;
  if (ratio >= 1 + edge && up) return { key, kind, text: up, detail };
  if (ratio <= 1 - edge && down) return { key: down === up ? key : `${key}Low`, kind, text: down, detail };
  return null;
}
