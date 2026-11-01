'use client';

import { useMemo, useState } from 'react';
import { fmtOdds } from '@/lib/nfl/odds';
import { fmtEv } from '@/lib/picks/value';
import { boardsOf, marksText, markText, PER_BOARD } from '@/lib/picks/boards';

// The slate's boards as numbered lists (Vincent, 2026-11-01, in the form of his own: "Best Receiving Ladders · 1. Puka
// Nacua 100+ / 110+ / 125+", "we should for assists, points, rebounds have the best candidates … list the point ladders.
// 20+, 25+"): per board the players ranked, each line the name, the game, the marks he clears (a ladder) or the main
// line with the chance (candidates), the price and the EV, and his caveat ("if he plays", "if role confirmed").
//   board: the picks board; specs: lib/picks/boards.js (NBA_BOARDS); gameId cuts every board to one game; onOpen(row) the card.

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const evTone = (ev) => (ev == null ? '' : ev >= 0.05 ? 'ir-ev-good' : ev > 0 ? 'ir-ev-thin' : 'ir-ev-bad');

function Line({ r, kind, unit, onOpen }) {
  const game = `${r.team} ${r.venue === 'H' ? 'vs' : 'at'} ${r.opp}`;
  const grade = r.hit == null ? '' : r.hit ? ' is-hit' : ' is-miss';
  const El = onOpen ? 'button' : 'span';
  return (
    <li className={`ir-bd-line${grade}`}>
      <El {...(onOpen ? { type: 'button', onClick: () => onOpen(r) } : {})} className="ir-bd-name"><b>{r.player}</b><small> {game}{r.pos ? ` · ${r.pos}` : ''}</small></El>
      {kind === 'ladder' ? (
        <span className="ir-bd-marks">
          {r.marks.map((m) => <span key={m.line} className={`ir-bd-mark${m.ev != null && m.ev > 0 ? ' is-value' : ''}${m.main ? ' is-main' : ''}`} title={markText(m, unit)}>{m.mark}<small>{pct(m.p)}{m.odds != null ? ` ${fmtOdds(m.odds)}` : ''}</small></span>)}
          {r.proj != null ? <small className="nhlx-auto-meta ir-bd-proj" title={`Projected ${num(r.proj)} ${unit}, ${r.floor}–${r.ceiling} half the nights`}>proj {num(r.proj)}</small> : null}
        </span>
      ) : (
        <span className="ir-bd-marks">
          <span className={`ir-bd-mark${r.ev != null && r.ev > 0 ? ' is-value' : ''} is-main`} title={`${r.side === 'yes' ? r.label : `o${r.line}`}: ${pct(r.p)} on the board${r.odds != null ? ` · ${fmtOdds(r.odds)} at the book · EV ${fmtEv(r.ev)} a unit` : ` · no price, break-even ${r.fair || '—'}`}`}>{r.side === 'yes' ? r.label : `o${r.line}`}<small>{pct(r.p)}{r.odds != null ? ` ${fmtOdds(r.odds)}` : ''}</small></span>
          {r.ev != null ? <em className={evTone(r.ev)}>{fmtEv(r.ev)}</em> : null}
          {r.proj != null ? <small className="nhlx-auto-meta ir-bd-proj">proj {num(r.proj)}</small> : null}
        </span>
      )}
      {r.caveat ? <small className="ir-bd-caveat">, {r.caveat}</small> : null}
      {r.final && r.actual !== undefined ? <small className="ir-bd-got">got {r.actual ?? 'DNP'}</small> : null}
    </li>
  );
}

function OneBoard({ b, units, onOpen }) {
  const [all, setAll] = useState(false);
  const rows = all ? b.rows : b.rows.slice(0, b.limit ?? PER_BOARD);
  const unit = units?.[b.market] || '';
  return (
    <section className="ir-bd" aria-label={b.title}>
      <div className="nhlx-pfd-head"><b>{b.title}</b><small className="nhlx-auto-meta">{b.note}</small></div>
      {rows.length ? <ol className="ir-bd-list">{rows.map((r) => <Line key={r.id || `${r.key}|${r.market}`} r={r} kind={b.kind} unit={unit} onOpen={onOpen} />)}</ol> : <p className="nhlx-auto-meta">Nobody clears the bar{b.kind === 'ladder' ? ' on this ladder' : ''} yet.</p>}
      {!all && b.rows.length > rows.length ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={() => setAll(true)}>Show all {b.rows.length}</button> : null}
    </section>
  );
}

export default function Boards({ board, specs, units = null, gameId = null, onOpen = null, title = 'Boards' }) {
  const boards = useMemo(() => boardsOf(board, specs, { gameId }), [board, specs, gameId]);
  if (!board?.games?.length) return null;
  return (
    <section className="ir-bds" aria-label={title}>
      <div className="nhlx-pfd-head">
        <b>{title}</b>
        <small className="nhlx-auto-meta">the slate’s players ranked per stat: the best candidates over the book’s main line, and the ladders — the marks he clears at 55% or better on the board’s chance, the highest first · a mark green when the book’s price leaves an EV · click a name for the card</small>
      </div>
      <div className="ir-bds-grid">{boards.map((b) => <OneBoard key={b.key} b={b} units={units} onOpen={onOpen} />)}</div>
    </section>
  );
}
