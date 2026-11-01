'use client';

import { fmtOdds } from '@/lib/nfl/odds';
import { ladderValue, fmtEv } from '@/lib/picks/value';

// The alternate-line ladder of a play with the value of every rung (the brief of 2026-10-31, level 3: "Books expose
// every rung; your job is to say WHICH one"): per rung the line, the board's chance of clearing it, the book's price
// for the side and the EV a unit, the best-EV rung ringed, the book's main line marked. The rungs are the side
// player's `ladders[market]` (lib/picks/board.js ladderOf); a rung without a price shows its break-even.
//   rungs, side ('over' | 'under'), unit, label; onPick(line) optional (the NBA card's line menu)

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);

export default function Ladder({ rungs, side = 'over', unit = '', label = '', line = null, onPick = null, compact = false }) {
  const rows = ladderValue(rungs, side);
  if (!rows.length) return <small className="ir-nfl-none">No ladder for this market.</small>;
  const best = rows.find((r) => r.best) || null;
  const mark = side === 'under' || side === 'no' ? 'u' : 'o';
  return (
    <div className={`ir-ladder${compact ? ' is-compact' : ''}`} aria-label={`${label} ladder`}>
      <div className="ir-ladder-head">
        <b>{label} ladder</b>
        <small className="nhlx-auto-meta">{best ? <>best value: <b>{mark}{best.line}</b> at {fmtOdds(best.odds)}, {fmtEv(best.ev)} a unit</> : 'no priced rung'} · every rung the board’s chance at the book’s price for the {side === 'under' || side === 'no' ? 'under' : 'over'}</small>
      </div>
      <div className="ir-ladder-rungs">
        {rows.map((r) => {
          const tone = r.ev == null ? 'none' : r.ev >= 0.05 ? 'good' : r.ev > 0 ? 'thin' : 'bad';
          const title = `${mark}${r.line} ${unit}: ${pct(r.p)} chance${r.odds != null ? ` at ${fmtOdds(r.odds)} (the book implies ${pct(r.pBook)}) · EV ${fmtEv(r.ev)} a unit · edge ${r.edge >= 0 ? '+' : '−'}${Math.abs(Math.round(r.edge * 100))} pts` : ` · no price on this rung, break-even ${r.fair || '—'}`}${r.main ? ' · the book’s main line' : ''}${r.best ? ' · the best value on the ladder' : ''}`;
          const El = onPick ? 'button' : 'div';
          return (
            <El key={r.line} {...(onPick ? { type: 'button', onClick: () => onPick(r.line) } : {})} className={`ir-ladder-rung is-${tone}${r.main ? ' is-main' : ''}${r.best ? ' is-best' : ''}${line != null && r.line === line ? ' is-active' : ''}`} title={title}>
              <b>{mark}{r.line}</b>
              <i>{pct(r.p)}</i>
              <small>{r.odds != null ? fmtOdds(r.odds) : r.fair || '—'}</small>
              <em>{r.odds != null ? fmtEv(r.ev) : 'no price'}</em>
            </El>
          );
        })}
      </div>
    </div>
  );
}
