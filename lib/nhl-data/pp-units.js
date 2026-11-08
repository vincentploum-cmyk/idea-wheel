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
export function ppRead({ rw, team, opp, name, pos, st = null }) {
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
  return { unit, minutes, ppTonight: r1(ppTonight), perPP, show: minutes >= PP_SHOW, lot: minutes >= PP_LOT, source: 'rotowire', at: rw?.fetchedAt || null, text };
}
