// Plain-language reads of a team for the Matchups fixture and the team page:
// how leaky or tight its defense is (rank 1 = allows the most of the league),
// where it leaks by position, how its last 10 games compare, its offense and
// its pace (MoneyPuck). Pure functions over data the slate already carries.
import { memoByRows } from '../memo';
import { pairRows } from './defense';

/** Thirds of the league: rank 1 = allows the most. */
export function defenseTier(rank, teams = 32) {
  if (!rank || !teams) return null;
  const third = Math.ceil(teams / 3);
  if (rank <= third) return 'leaky';
  if (rank > teams - third) return 'tight';
  return 'average';
}

export const TIER_TEXT = { leaky: 'Leaky defense', average: 'Average defense', tight: 'Tight defense' };
export const TIER_TONE = { leaky: 'is-soft', tight: 'is-tough', average: '' };

/** Pace thirds: rank 1 = most shot attempts for + against per 60. */
export function paceTier(rank, teams = 32) {
  const t = defenseTier(rank, teams);
  return t === 'leaky' ? 'fast' : t === 'tight' ? 'slow' : t;
}

export const VENUE_TEXT = { H: 'at home', A: 'away' };
const POS_ORDER = ['LW', 'C', 'RW', 'D'];

/**
 * A verdict for one side of a game. `defense` is the side's defense object from
 * the slate (keyed by position + All, each with season/rank/l10/l10Rank and the
 * `windows`), read for the *opponent* of that side; so pass the other side's
 * object to describe this team. `mp` is the slate's moneypuck block.
 * Returns { team, venue, tier, rank, headline, lines: [{ key, text, tone }] } or null, with the
 * reads behind the lines as data for the game script (`lib/nhl-data/script.js`): `season`
 * (what it allows per game at the venue, ranked), `leaks` / `holds` (the positions in the soft
 * and the tight third), `trend` (its last 10 against the season rank), `offense` and `pace`.
 */
export function teamVerdict({ team, venue, defense, teamCount = 32, mp = null }) {
  if (!team || !defense) return null;
  const all = defense.All || {};
  const n = all.teamCount || teamCount;
  const rank = all.rank?.sog ?? null;
  const tier = defenseTier(rank, n);
  const lines = [];
  const where = VENUE_TEXT[venue] || '';

  // Defense at this venue: shots and goals allowed per game, ranked.
  if (all.season?.gp) {
    lines.push({
      key: 'defense', tone: TIER_TONE[tier] || '',
      text: `${TIER_TEXT[tier] || 'Defense'} ${where}: allows ${all.season.sog.toFixed(1)} SOG (#${rank ?? '–'}) and ${all.season.g.toFixed(2)} goals (#${all.rank?.g ?? '–'}) per game${all.source === 'propfinder' ? `, PropFinder ${all.seasonLabel || 'last season'}` : ` over ${all.season.gp} games`}.`,
    });
  }

  // By position: where it leaks and where it holds.
  const byPos = POS_ORDER.map((pos) => ({ pos, rank: defense[pos]?.rank?.sog ?? null, n: defense[pos]?.teamCount || n })).filter((p) => p.rank);
  const leaks = byPos.filter((p) => defenseTier(p.rank, p.n) === 'leaky').sort((a, b) => a.rank - b.rank).map(({ pos, rank }) => ({ pos, rank }));
  const holds = byPos.filter((p) => defenseTier(p.rank, p.n) === 'tight').sort((a, b) => b.rank - a.rank).map(({ pos, rank }) => ({ pos, rank }));
  if (leaks.length || holds.length) {
    const parts = [];
    if (leaks.length) parts.push(`leaks shots to ${leaks.map((p) => `${p.pos} (#${p.rank})`).join(', ')}`);
    if (holds.length) parts.push(`holds ${holds.map((p) => `${p.pos} (#${p.rank})`).join(', ')}`);
    lines.push({ key: 'positions', tone: leaks.length ? 'is-soft' : 'is-tough', text: `${parts.join(' · ')}.`.replace(/^./, (c) => c.toUpperCase()) });
  }

  // Trend: the last 10 games (all venues) against the season rank at this venue.
  const l10Rank = all.l10Rank?.sog ?? null;
  let trend = null;
  if (all.l10?.gp && l10Rank) {
    const l10Tier = defenseTier(l10Rank, n);
    const drift = rank ? l10Rank - rank : 0;
    const word = drift <= -5 ? 'loosening' : drift >= 5 ? 'tightening' : 'steady';
    trend = { gp: all.l10.gp, sog: all.l10.sog, rank: l10Rank, tier: l10Tier, drift, trend: word };
    lines.push({ key: 'trend', tone: word === 'loosening' ? 'is-soft' : word === 'tightening' ? 'is-tough' : '', text: `Last 10: ${all.l10.sog.toFixed(1)} SOG allowed (#${l10Rank}, ${l10Tier}) · ${word}.` });
  }

  // Offense and pace from MoneyPuck, all situations.
  const t = mp?.situations?.all?.[team];
  const r = mp?.ranks?.all?.[team];
  let offense = null;
  let paceRead = null;
  if (t && r) {
    const mpN = mp.teams || Object.keys(mp.situations.all).length || 32;
    const off = [];
    if (t.sf60 != null) off.push(`${t.sf60.toFixed(1)} SF/60 (#${r.sf60 ?? '–'})`);
    if (t.xgf60 != null) off.push(`${t.xgf60.toFixed(2)} xGF/60 (#${r.xgf60 ?? '–'})`);
    if (off.length) {
      const offTier = defenseTier(r.sf60, mpN); // rank 1 = most shots for
      offense = { sf60: t.sf60 ?? null, sf60Rank: r.sf60 ?? null, xgf60: t.xgf60 ?? null, xgf60Rank: r.xgf60 ?? null, tier: offTier };
      lines.push({ key: 'offense', tone: offTier === 'leaky' ? 'is-soft' : offTier === 'tight' ? 'is-tough' : '', text: `Offense: ${off.join(', ')}${offTier === 'leaky' ? ' · high volume' : offTier === 'tight' ? ' · low volume' : ''}.` });
    }
    const pace = t.pace60 ?? (t.cf60 != null && t.ca60 != null ? +(t.cf60 + t.ca60).toFixed(1) : null);
    if (pace != null) {
      const pTier = paceTier(r.pace60, mpN);
      paceRead = { value: +pace.toFixed(1), rank: r.pace60 ?? null, tier: pTier };
      lines.push({ key: 'pace', tone: pTier === 'fast' ? 'is-soft' : pTier === 'slow' ? 'is-tough' : '', text: `Pace: ${pace.toFixed(1)} shot attempts/60 both ways${r.pace60 ? ` (#${r.pace60}, ${pTier})` : ''}.` });
    }
  }
  if (!lines.length) return null;
  const headline = tier ? `${TIER_TEXT[tier]} ${where}` : 'No defense read yet';
  const season = all.season?.gp ? { gp: all.season.gp, sog: all.season.sog, g: all.season.g, rankSog: rank, rankG: all.rank?.g ?? null, source: all.source || 'games', seasonLabel: all.seasonLabel || null } : null;
  return { team, venue, tier, rank, headline, lines, season, leaks, holds, trend, offense, pace: paceRead };
}

// ── Game total: high- or low-scoring? ───────────────────────────────────────
// Two readings blended: what the teams have done against each other (stored
// games, this season and last) and what MoneyPuck says they generate and allow
// (expected goals per 60, venue splits when there are enough games).

const r1 = (v) => +v.toFixed(1);
const HIGH_MARGIN = 0.5; // goals above / below the league average that make a game read high / low

/**
 * The stored meetings between two teams, from skater rows: one entry per game with each
 * side's goals (its skaters' goals) and the total, oldest first.
 * Rows are rowObj() records; `a` / `b` are team codes.
 */
export function h2hTotals(rows, a, b) {
  return memoByRows(rows, `totals|${a}|${b}`, () => {
    // The pair index (one pass per rows array) in place of a scan of the season per game.
    const pairs = pairRows(rows);
    const games = {};
    for (const r of [...(pairs.get(`${b}|${a}`) || []), ...(pairs.get(`${a}|${b}`) || [])]) {
      const g = (games[r.gameId] = games[r.gameId] || { gameId: r.gameId, date: r.date, goals: { [a]: 0, [b]: 0 }, home: r.venue === 'H' ? r.team : r.opp });
      g.goals[r.team] += Number(r.g) || 0;
    }
    return Object.values(games).map((g) => ({ ...g, total: g.goals[a] + g.goals[b] })).sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
  });
}

/** League average goals per game (both teams) from MoneyPuck's all-situations GF/60, or 6.1. */
/**
 * The league average a game's read is judged against, in the unit the read is built from:
 * MoneyPuck's expected goals (xGF/60, both teams) when the teams carry it, goals (GF/60)
 * otherwise, 6.1 without a table. The projection is expected goals, so judging it against
 * actual goals read every game low whenever the league shot above its xG (opening week ran
 * 10% hot) and high whenever it shot cold; the two now move together.
 */
export function leagueGoalsPerGame(mp) {
  const teams = Object.values(mp?.situations?.all || {});
  const avg = (key) => { const v = teams.map((t) => t?.[key]).filter((x) => x != null); return v.length >= 10 ? r1((v.reduce((s, x) => s + x, 0) / v.length) * 2) : null; };
  return avg('xgf60') ?? avg('gf60') ?? 6.1;
}

/**
 * The read on a game's total. `h2h` from h2hTotals(); `mp` is the slate's moneypuck block
 * (situations / ranks, and byVenue / venueRanks when the game logs are stored).
 * Returns { tier: 'high'|'average'|'low', headline, projected, league, expected, h2h, pace, lines } or null.
 */
export function gameTotalRead({ away, home, h2h = [], mp = null, minVenueGp = 5 }) {
  if (!away || !home) return null;
  const league = leagueGoalsPerGame(mp);
  const lines = [];

  // Head to head: average total, how often it ran over the league average, the last meeting.
  let h2hRead = null;
  if (h2h.length) {
    const avg = r1(h2h.reduce((s, g) => s + g.total, 0) / h2h.length);
    const over = h2h.filter((g) => g.total > league).length;
    const last = h2h[h2h.length - 1];
    h2hRead = { gp: h2h.length, avg, over, last: { date: last.date, score: `${last.home === home ? home : away} ${last.goals[last.home === home ? home : away]}–${last.goals[last.home === home ? away : home]} ${last.home === home ? away : home}` }, games: h2h.map((g) => ({ date: g.date, total: g.total, score: `${g.home} ${g.goals[g.home]}–${g.goals[g.home === home ? away : home]} ${g.home === home ? away : home}` })) };
    lines.push({
      key: 'h2h', tone: avg >= league + HIGH_MARGIN ? 'is-soft' : avg <= league - HIGH_MARGIN ? 'is-tough' : '',
      text: `Head to head: ${h2h.length} meeting${h2h.length === 1 ? '' : 's'} stored (this season and last), ${avg.toFixed(1)} goals a game, ${over} of ${h2h.length} over the league's ${league.toFixed(1)} · last ${last.score || h2hRead.last.score} (${last.date}).`,
    });
  } else {
    lines.push({ key: 'h2h', tone: '', text: 'Head to head: no stored meetings yet (this season and last).' });
  }

  // MoneyPuck: each offense against the other defense, per 60, venue splits when both have enough games.
  let expected = null;
  let pace = null;
  const all = mp?.situations?.all;
  if (all?.[away] && all?.[home]) {
    const vH = mp.byVenue?.all?.H?.[home];
    const vA = mp.byVenue?.all?.A?.[away];
    const split = vH?.gp >= minVenueGp && vA?.gp >= minVenueGp && vH.xgf60 != null && vA.xgf60 != null;
    const tH = split ? vH : all[home];
    const tA = split ? vA : all[away];
    const rH = (split ? mp.venueRanks?.all?.H?.[home] : mp.ranks?.all?.[home]) || {};
    const rA = (split ? mp.venueRanks?.all?.A?.[away] : mp.ranks?.all?.[away]) || {};
    if (tH.xgf60 != null && tH.xga60 != null && tA.xgf60 != null && tA.xga60 != null) {
      const homeX = (tH.xgf60 + tA.xga60) / 2;
      const awayX = (tA.xgf60 + tH.xga60) / 2;
      expected = { total: r1(homeX + awayX), home: r1(homeX), away: r1(awayX), split, gp: split ? { home: vH.gp, away: vA.gp } : null };
      const where = split ? ` (${home} at home over ${vH.gp} games, ${away} away over ${vA.gp})` : ' (season, all venues)';
      lines.push({
        key: 'xg', tone: expected.total >= league + HIGH_MARGIN ? 'is-soft' : expected.total <= league - HIGH_MARGIN ? 'is-tough' : '',
        text: `MoneyPuck expected goals${where}: ${home} ${tH.xgf60.toFixed(2)} xGF/60${rH.xgf60 ? ` (#${rH.xgf60})` : ''} into ${away}'s ${tA.xga60.toFixed(2)} xGA/60${rA.xga60 ? ` (#${rA.xga60})` : ''}; ${away} ${tA.xgf60.toFixed(2)}${rA.xgf60 ? ` (#${rA.xgf60})` : ''} into ${home}'s ${tH.xga60.toFixed(2)}${rH.xga60 ? ` (#${rH.xga60})` : ''} → ${expected.total.toFixed(1)} expected.`,
      });
    }
    const n = mp.teams || Object.keys(all).length || 32;
    const pH = all[home].pace60 ?? (all[home].cf60 != null && all[home].ca60 != null ? all[home].cf60 + all[home].ca60 : null);
    const pA = all[away].pace60 ?? (all[away].cf60 != null && all[away].ca60 != null ? all[away].cf60 + all[away].ca60 : null);
    if (pH != null && pA != null) {
      const tierH = paceTier(mp.ranks?.all?.[home]?.pace60, n);
      const tierA = paceTier(mp.ranks?.all?.[away]?.pace60, n);
      const both = tierH === 'fast' && tierA === 'fast' ? 'fast' : tierH === 'slow' && tierA === 'slow' ? 'slow' : 'mixed';
      pace = { home: r1(pH), away: r1(pA), homeTier: tierH, awayTier: tierA, both };
      lines.push({
        key: 'pace', tone: both === 'fast' ? 'is-soft' : both === 'slow' ? 'is-tough' : '',
        text: `Pace (shot attempts both ways per 60): ${home} ${pH.toFixed(1)}${mp.ranks?.all?.[home]?.pace60 ? ` (#${mp.ranks.all[home].pace60}${tierH ? `, ${tierH}` : ''})` : ''} · ${away} ${pA.toFixed(1)}${mp.ranks?.all?.[away]?.pace60 ? ` (#${mp.ranks.all[away].pace60}${tierA ? `, ${tierA}` : ''})` : ''}${both === 'fast' ? ' · both play fast' : both === 'slow' ? ' · both play slow' : ''}.`,
      });
    }
  } else {
    lines.push({ key: 'xg', tone: '', text: 'MoneyPuck: no team metrics stored yet.' });
  }

  // The projection: MoneyPuck's expected total, pulled toward the head-to-head average by
  // up to half once five meetings are stored (one meeting moves it a tenth of the way).
  let projected = expected?.total ?? h2hRead?.avg ?? null;
  let basis = expected ? (h2hRead ? 'blend' : 'moneypuck') : h2hRead ? 'h2h' : null;
  if (expected && h2hRead) {
    const w = Math.min(h2hRead.gp, 5) / 10;
    projected = r1(expected.total * (1 - w) + h2hRead.avg * w);
  }
  // A fast pace between two fast teams nudges the read up by a quarter goal; two slow teams down.
  if (projected != null && pace?.both === 'fast') projected = r1(projected + 0.25);
  if (projected != null && pace?.both === 'slow') projected = r1(projected - 0.25);
  if (projected == null) return null;
  const tier = projected >= league + HIGH_MARGIN ? 'high' : projected <= league - HIGH_MARGIN ? 'low' : 'average';
  const headline = tier === 'high' ? `High-scoring game likely · ${projected.toFixed(1)} goals` : tier === 'low' ? `Low-scoring game likely · ${projected.toFixed(1)} goals` : `Average scoring · ${projected.toFixed(1)} goals`;
  lines.push({ key: 'read', tone: tier === 'high' ? 'is-soft' : tier === 'low' ? 'is-tough' : '', text: `Read: ${projected.toFixed(1)} goals against a league average of ${league.toFixed(1)}${basis === 'blend' ? ` (MoneyPuck's ${expected.total.toFixed(1)} pulled ${Math.round(Math.min(h2hRead.gp, 5) * 10)}% toward the head-to-head ${h2hRead.avg.toFixed(1)})` : basis === 'h2h' ? ' (head to head only)' : ' (MoneyPuck only)'}${pace?.both === 'fast' ? ', +0.25 for two fast teams' : pace?.both === 'slow' ? ', −0.25 for two slow teams' : ''}.` });
  return { away, home, tier, headline, projected, league, basis, expected, h2h: h2hRead, pace, lines };
}
