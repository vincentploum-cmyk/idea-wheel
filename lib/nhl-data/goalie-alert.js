// The rink's weak-goalie alert (Vincent, 2026-11-14: "can we have a weak goalie alert added to the rink?"): who is in
// net against this team tonight, and whether he is one of the league's weak ones. The goalie: RotoWire's named starter
// for the opponent ("Confirmed" / "Expected", lib/nhl-data/rotowire.js, the date's stored page), else the one the
// stored box scores make likely (likelyStarter in goalies-pure.js). Weak = his save % this season, shrunk to the
// league's (the book's `svPct`), in the bottom quarter of the goalies with GOALIE_MIN_STARTS starts; or his last five
// starts at GOALIE_COLD_PCT or under while his season is under the league's. A backup in for the usual starter is
// named. An alert, not a number: on 2025-26 and 2026-27 the opposing starter's save % added nothing to a skater's
// goals over his own rate (docs/audits/2026-11-13-nhl-drivers.md), so nothing in the picks moves with it. Pure.
import { likelyStarter } from './goalies-pure';
import { normName } from './names';

export const GOALIE_MIN_STARTS = 4;
export const GOALIE_WEAK_SHARE = 0.25;      // the bottom quarter of the ranked goalies
export const GOALIE_COLD_PCT = 0.88;        // his last five starts at or under this …
export const GOALIE_COLD_MIN_STARTS = 3;    // … over at least this many of them

const pct3 = (v) => (v == null ? '—' : Number(v).toFixed(3).replace(/^0/, ''));
const lastOf = (n) => normName(n).split(' ').slice(1).join(' ');

/** Every goalie with enough starts this season, the worst shrunk save % first: [{ id, team, svPct, rank }] and the count. */
export function goalieRanks(book) {
  const all = Object.values(book?.teams || {}).filter((t) => !t.held).flatMap((t) => t.goalies).filter((g) => g.starts >= GOALIE_MIN_STARTS && g.svPct != null);
  const sorted = [...all].sort((a, b) => a.svPct - b.svPct || b.sa - a.sa);
  return { of: sorted.length, rankOf: Object.fromEntries(sorted.map((g, i) => [g.id, 1 + sorted.filter((x) => x.svPct < g.svPct).length || i + 1])) };
}

/** The opponent's goalie on RotoWire's page matched to the book's: the full name, else the last name with the first initial. */
export function namedStarter(book, rw, opp) {
  const named = rw?.teams?.[opp]?.goalie;
  if (!named?.name) return null;
  const list = book?.teams?.[opp]?.goalies || [];
  const key = normName(named.name);
  const hit = list.find((g) => normName(g.name) === key) || list.find((g) => lastOf(g.name) && lastOf(g.name) === lastOf(named.name) && normName(g.name)[0] === key[0]) || null;
  return { name: named.name, status: /confirm/i.test(named.status || '') ? 'confirmed' : 'expected', goalie: hit };
}

/**
 * The goalie this side shoots at tonight: { name, status ('confirmed' | 'expected' | 'likely'), id, starts, pct (raw),
 * svPct (shrunk), rank (1 = the weakest), of, l5, backup, usual, weak, cold, reasons, text } or null without a goalie.
 * `book` = goalieBook for the slate, `rw` = the date's stored RotoWire read, `opp` the team in the other net.
 */
export function opposingGoalie({ book, rw = null, opp, date }) {
  const named = namedStarter(book, rw, opp);
  const likely = likelyStarter(book, opp, date);
  const g = named?.goalie || (named ? null : likely?.goalie) || null;
  const name = named?.name || g?.name || null;
  if (!name) return null;
  const status = named ? named.status : 'likely';
  const ranks = goalieRanks(book);
  const rank = g ? ranks.rankOf[g.id] ?? null : null;
  const league = book?.league?.pct ?? null;
  const usual = [...(book?.teams?.[opp]?.goalies || [])].sort((a, b) => b.starts - a.starts)[0] || null;
  const backup = !!(g && usual && usual.id !== g.id && usual.starts > g.starts);
  const bottom = rank != null && ranks.of >= 8 && rank <= Math.max(1, Math.round(ranks.of * GOALIE_WEAK_SHARE));
  const cold = !!(g?.l5 && g.l5.starts >= GOALIE_COLD_MIN_STARTS && g.l5.pct != null && g.l5.pct <= GOALIE_COLD_PCT && league != null && g.svPct < league);
  const weak = bottom || cold;
  const reasons = [];
  if (bottom) reasons.push(`#${rank} weakest of ${ranks.of} goalies with ${GOALIE_MIN_STARTS}+ starts by save % this season`);
  if (cold) reasons.push(`${pct3(g.l5.pct)} over his last ${g.l5.starts} starts`);
  if (backup) reasons.push(`the backup: ${usual.name} has ${usual.starts} starts to his ${g.starts}`);
  const word = status === 'confirmed' ? 'confirmed on RotoWire' : status === 'expected' ? 'expected on RotoWire' : `likely (${likely?.reason || 'the stored starts'})`;
  const line = g ? `${pct3(g.pct)} on ${g.sa} shots in ${g.gp} game${g.gp === 1 ? '' : 's'} this season (${pct3(g.svPct)} shrunk to the league's ${pct3(league)})${rank != null ? `, #${rank} weakest of ${ranks.of}` : `, under ${GOALIE_MIN_STARTS} starts: not ranked`}` : 'no games on record this season';
  const text = `${opp}'s goalie tonight: ${name}, ${word} · ${line}${g?.l5 ? ` · last ${g.l5.starts} starts ${pct3(g.l5.pct)}` : ''}${backup ? ` · the backup (${usual.name} is the usual starter)` : ''}`
    + `${weak ? ` · weak: ${reasons.filter((r) => !/^the backup/.test(r)).join('; ')}` : ''} · an alert only: a goalie's save % has not moved a skater's goals over his own rate, so no pick changes with it`;
  return {
    name, status, id: g?.id ?? null, starts: g?.starts ?? 0, pct: g?.pct ?? null, svPct: g?.svPct ?? null, rank, of: ranks.of,
    l5: g?.l5 || null, backup, usual: backup ? usual.name : null, weak, cold, reasons, text,
  };
}
