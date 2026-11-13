// Who gets the power-play minutes tonight: the rink's PP badge (Vincent, 2026-11-08, of the matchup profile's Power play
// and Discipline rows: "based on this data, we should know whether there will be a lot of powerplays... Then, we need to
// find out who is on the powerplay so we know which players will most likely get more minutes ... a small PP symbol next
// to the players on the rink that are predicted to get a lot of powerplay minutes based on the shotpropz data").
//   - how many power plays: `specialTeamsRead` (lib/nhl-data/special-teams.js), ShotPropz's all-games boards — the
//     team's drawn rate against the opponent's given rate, the same "tonight ≈ 3.6" the profile's Power play row ends on;
//   - who is on them: RotoWire's POWER PLAY #1 and #2 (lib/nhl-data/rotowire.js), the only source that lists the units;
//   - what a power play is worth to a unit's skater in minutes: the box scores (docs/audits/2026-11-07-nhl-toi-tables.md,
//     section B, "PP min / PP" by role over 56,445 skater-games): a first-unit forward plays 0.98 of a minute of each power
//     play, a first-unit defenseman 0.95, the second unit 0.48 and 0.45.
// The badge is drawn when his minutes tonight reach PP_SHOW (the first unit nearly always, the second only on a night of
// 4+ power plays) and is green at PP_LOT (a first-unit skater on a night of ~3.6+ power plays; the league's first unit
// averages 3.1 minutes). Descriptive only: no number on the board moves with it (the model's own power-play share is
// `PP_WEIGHTS` by line slot in special-teams.js). Pure: the slate feeds it.
import { normName } from './model-key';

/** Power-play minutes per power play by unit and position (the audit's section B slopes). */
export const PP_MIN_PER_PP = { F: { 1: 0.98, 2: 0.48 }, D: { 1: 0.95, 2: 0.45 } };
/** The league's power plays a team-game when ShotPropz has no read (2026-27 to the audit: 3.19). */
export const PP_LEAGUE = 3.2;
/** Minutes tonight from which the badge is drawn, and from which it reads "a lot" (green). */
export const PP_SHOW = 2.0;
export const PP_LOT = 3.5;

const r1 = (v) => Math.round(v * 10) / 10;
const lastOf = (n) => normName(n).split(' ').slice(1).join(' ');
const initialOf = (n) => normName(n).charAt(0);

/** Games a team needs this season (with power-play shots stored) before its power-play read ranks. */
export const PP_ALLOWED_MIN_GAMES = 5;

/**
 * The badge's colour (Vincent, 2026-11-13: "I want to know per team 1) if they allow a lot of powerplays and if so, to
 * which position are they allowing the most shots. Based on this, you should mark the pp in the rink either amber, green
 * or red"): every team's power-play shots on goal allowed a game this season, in all and to each position (the stored
 * rows' `ppSog`, both venues), each ranked 1 = the most among the teams with PP_ALLOWED_MIN_GAMES games, with the share
 * of them each position took and the league's. Per game to a position is both questions at once: a kill that is short
 * a lot gives every position more, and the share says where they go. `season` = the slate's season table
 * (`defenseByPosition(rows, { season })`). Pure.
 * { teams: { ABBR: { gp, all, pos: { C: { perGame, share, rank } … }, rankAll, of } }, league: { all, share: { C … } } }
 */
export function ppAllowedBook(season) {
  const teams = {};
  for (const [abbr, venues] of Object.entries(season?.teams || {})) {
    const t = venues?.ALL;
    const gp = t?.All?.gp || 0;
    const all = Number(t?.All?.ppSog) || 0;
    if (!gp || !(all > 0)) continue;
    const pos = {};
    for (const k of ['C', 'LW', 'RW', 'D']) {
      const v = Number(t[k]?.ppSog) || 0;
      pos[k] = { perGame: +v.toFixed(2), share: +(v / all).toFixed(3), rank: null };
    }
    teams[abbr] = { gp, all: +all.toFixed(2), pos, rankAll: null, of: 0 };
  }
  const ranked = Object.values(teams).filter((t) => t.gp >= PP_ALLOWED_MIN_GAMES);
  for (const t of ranked) {
    t.of = ranked.length;
    t.rankAll = 1 + ranked.filter((x) => x.all > t.all).length;
    for (const k of Object.keys(t.pos)) t.pos[k].rank = 1 + ranked.filter((x) => x.pos[k].perGame > t.pos[k].perGame).length;
  }
  const n = ranked.length;
  const mean = (f) => (n ? +(ranked.reduce((a, x) => a + f(x), 0) / n).toFixed(2) : null);
  const tot = ranked.reduce((a, x) => a + x.all, 0);
  const share = Object.fromEntries(['C', 'LW', 'RW', 'D'].map((k) => [k, tot ? +(ranked.reduce((a, x) => a + x.pos[k].perGame, 0) / tot).toFixed(3) : null]));
  return { teams, league: { all: mean((x) => x.all), share } };
}

/** Green, amber or red by thirds of the rank (1 = the most allowed): soft / mid / tough, as the rink's other badges. */
export function ppTone(rank, of) {
  if (!rank || !of) return null;
  const third = Math.ceil(of / 3);
  return rank <= third ? 'soft' : rank > of - third ? 'tough' : 'mid';
}

/** The opponent's power-play read at a position: { perGame, rank, share, all, rankAll, of, gp, tone, text } or null. */
export function ppAllowedAt(book, opp, pos) {
  const t = book?.teams?.[opp];
  const c = t?.pos?.[pos];
  if (!c || !t.of) return null;
  const tone = ppTone(c.rank, t.of);
  const lead = Object.entries(t.pos).sort((a, b) => b[1].perGame - a[1].perGame)[0][0];
  const word = tone === 'soft' ? 'a lot of' : tone === 'tough' ? 'few' : 'an average number of';
  const lg = book.league;
  const text = `${opp} gives ${word} power-play shots to ${pos}: ${c.perGame.toFixed(2)} a game, #${c.rank} of ${t.of}`
    + ` · ${t.all.toFixed(2)} power-play shots on goal allowed a game in all (#${t.rankAll}${lg?.all != null ? `, league ${lg.all.toFixed(2)}` : ''})`
    + ` · ${Math.round(c.share * 100)}% of them to ${pos}${lg?.share?.[pos] != null ? ` (league ${Math.round(lg.share[pos] * 100)}%)` : ''}, the most to ${lead}`
    + ` · this season, ${t.gp} games`;
  return { perGame: c.perGame, rank: c.rank, share: c.share, all: t.all, rankAll: t.rankAll, of: t.of, gp: t.gp, lead, tone, text };
}

/** His unit on RotoWire's read of his team: 1, 2 or null. Full name first, then the last name with the first initial. */
export function ppUnitOf(teamRead, name) {
  if (!teamRead || !name) return null;
  const key = normName(name);
  for (const unit of [1, 2]) if ((teamRead[`pp${unit}`] || []).some((p) => normName(p.name) === key)) return unit;
  const last = lastOf(name); const ini = initialOf(name);
  if (!last) return null;
  for (const unit of [1, 2]) if ((teamRead[`pp${unit}`] || []).some((p) => lastOf(p.name) === last && initialOf(p.name) === ini)) return unit;
  return null;
}

/**
 * The skater's power-play read tonight, or null when RotoWire has him on neither unit:
 * { unit, minutes, ppTonight, perPP, show, lot, source, at, text }. `st` is the side's `specialTeamsRead` (null: the
 * league's rate stands in); `rw` the stored RotoWire read for the date.
 */
export function ppRead({ rw, team, opp, name, pos, st = null, allowed = null }) {
  const teamRead = rw?.teams?.[team];
  const unit = ppUnitOf(teamRead, name);
  if (!unit) return null;
  const group = pos === 'D' ? 'D' : 'F';
  const perPP = PP_MIN_PER_PP[group][unit];
  const ppTonight = st?.ppFor?.expected ?? PP_LEAGUE;
  const minutes = r1(ppTonight * perPP);
  const own = st?.ppFor?.own; const gives = st?.ppFor?.oppGives;
  const why = st?.ppFor?.expected != null
    ? `${team} should get ≈ ${r1(ppTonight).toFixed(1)} power plays (ShotPropz: it draws ${own?.value != null ? r1(own.value).toFixed(1) : '—'} a game, ${opp} gives ${gives?.value != null ? r1(gives.value).toFixed(1) : '—'}; the league ${st.ppFor.league != null ? r1(st.ppFor.league).toFixed(1) : PP_LEAGUE})`
    : `no ShotPropz read, so the league's ${PP_LEAGUE} power plays a game`;
  const text = `Power play #${unit} on RotoWire · ≈ ${minutes.toFixed(1)} power-play minutes tonight: ${why} × ${perPP.toFixed(2)} of a minute each for a ${unit === 1 ? 'first' : 'second'}-unit ${group === 'D' ? 'defenseman' : 'forward'}${minutes >= PP_LOT ? ' — a lot' : ''}`;
  // The colour: the opponent's power-play shots allowed a game to his position (ppAllowedAt), green / amber / red.
  const opp_ = allowed ? ppAllowedAt(allowed, opp, pos) : null;
  return { unit, minutes, ppTonight: r1(ppTonight), perPP, show: minutes >= PP_SHOW, lot: minutes >= PP_LOT, source: 'rotowire', at: rw?.fetchedAt || null, allowed: opp_, tone: opp_?.tone || null, text: opp_ ? `${opp_.text} · ${text}` : text };
}
