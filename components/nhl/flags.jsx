'use client';

import { FORM } from '@/lib/nhl-data/picks-pure';

// The flags beside a name on Best bets and Matchups: a flame (hot), a snowflake (cold) and a rink
// (the opponent in the soft third at his position). 16-unit glyphs drawn in the current colour.
export const ICON = {
  hot: <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5c.6 2.2 2.6 3.3 3.6 5.2A4.6 4.6 0 0 1 8 14.5a4.6 4.6 0 0 1-4.3-6.3c.4-1 1.1-1.7 1.6-2.6.2 1 .7 1.7 1.4 2.1C6.6 5.5 6.9 3.4 8 1.5Z" fill="currentColor" /></svg>,
  cold: <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1v14M1.9 4.5l12.2 7M1.9 11.5l12.2-7M8 1 6 3M8 1l2 2M8 15l-2-2M8 15l2-2M1.9 4.5l2.7.7M1.9 4.5l.7-2.7M14.1 11.5l-2.7-.7M14.1 11.5l-.7 2.7M1.9 11.5l.7 2.7M1.9 11.5l2.7-.7M14.1 4.5l-.7-2.7M14.1 4.5l-2.7.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" /></svg>,
  soft: <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="3" width="14" height="10" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 3v10" stroke="currentColor" strokeWidth="1.2" /><circle cx="8" cy="8" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>,
};

/**
 * The flags for a skater `c` ({ heat, spot, oppPos, opp, pos }) on `stat` ('sog' | 'g'): his form going
 * in (`heat`, formOf in picks-pure.js; colour only — the study found a streak adds nothing once the
 * rate is in, so no number moves) and the soft spot: `spot` (PropFinder's table above the rink on
 * Matchups, on the tab it opens on — `spotFromTab` in propfinder-csv.js — so the flag and the ice
 * agree), the study's per-skater table (`oppPos`) standing in for a team without one, named in the title.
 */
export function flagsFor(c, stat) {
  const f = c?.heat; const s = c?.spot; const o = s || c?.oppPos; const out = [];
  if (f) {
    if (stat === 'sog') {
      if (f.hotS) out.push({ kind: 'hot', title: `Hot: ${f.sogL5} shots a game over his last ${f.games}, ${Math.round((f.sogRatio - 1) * 100)}% over his norm (colour only; the number already carries his rate and minutes)` });
      else if (f.coldS) out.push({ kind: 'cold', title: `Cold: ${f.sogL5} shots a game over his last ${f.games}, ${Math.round((1 - f.sogRatio) * 100)}% under his norm` });
    } else if (f.hotG) out.push({ kind: 'hot', title: `Hot: ${f.gL5} goal${f.gL5 === 1 ? '' : 's'} in his last ${f.games} games (colour only; the study found no carry-over from a streak)` });
    else if (f.coldG) out.push({ kind: 'cold', title: `Cold: no goal in his last ${FORM.coldGoalsGames} games` });
  }
  if (o && (stat === 'sog' ? o.softSog : o.softG)) {
    const v = stat === 'sog' ? o.sog : o.g; const rank = stat === 'sog' ? o.rankSog : o.rankG; const word = stat === 'sog' ? 'shots' : 'goals';
    const read = s
      ? `${c.opp} allows ${Number(v).toFixed(2)} ${word} a game to ${c.pos} over ${s.tab.text}, #${rank} of ${o.teams} (the soft third) · PropFinder’s table above the rink on Matchups, its ${s.tab.label} tab`
      : `${c.opp} allows ${Number(v).toFixed(stat === 'sog' ? 2 : 3)} ${word} per ${c.pos} a game, #${rank} of ${o.teams} (the soft third) · the stored box scores, this season blended into last season’s, per skater at the position: no PropFinder table for ${c.opp}`;
    out.push({ kind: 'soft', title: `Soft spot: ${read}` });
  }
  return out;
}

/** The flags as inline icons, or null when there are none. `soft: false` leaves the rink out (the ice is already tinted under a chip). */
export function Flags({ c, stat, className = '', soft = true }) {
  const flags = flagsFor(c, stat).filter((f) => soft || f.kind !== 'soft');
  if (!flags.length) return null;
  return <span className={`nhlx-pk-flags${className ? ` ${className}` : ''}`}>{flags.map((f) => <i key={f.kind} className={`nhlx-pk-flag is-${f.kind}`} title={f.title} aria-label={f.title}>{ICON[f.kind]}</i>)}</span>;
}
