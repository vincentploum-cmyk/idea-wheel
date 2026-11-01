'use client';

import { useEffect, useMemo, useState } from 'react';
import { fmtOdds } from '@/lib/nfl/odds';
import { boardsOf, markText, tierOf, PER_BOARD } from '@/lib/picks/boards';

// The slate's boards as numbered lists (Vincent, 2026-11-01, in the form of his own: "Best Receiving Ladders · 1. Puka
// Nacua 100+ / 110+ / 125+", "we should for assists, points, rebounds have the best candidates … list the point ladders.
// 20+, 25+"; then "I don't care about edge … 10+ points (strong), 20+ points (lean), 30+ points (thin)" and "TD
// candidates we should list with chance%"): per board the players ranked, each line the name, the game, the marks he
// clears at each tier (a ladder) or his chance (candidates), and his caveat ("if he plays", "if role confirmed").
//   board: the picks board; specs: lib/picks/boards.js (NBA_BOARDS); gameId cuts every board to one game; onOpen(row) the card.

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));

function Line({ r, kind, unit, onOpen }) {
  const game = `${r.team} ${r.venue === 'H' ? 'vs' : 'at'} ${r.opp}`;
  const grade = r.hit == null ? '' : r.hit ? ' is-hit' : ' is-miss';
  const El = onOpen ? 'button' : 'span';
  return (
    <li className={`ir-bd-line${grade}`}>
      <El {...(onOpen ? { type: 'button', onClick: () => onOpen(r) } : {})} className="ir-bd-name"><b>{r.player}</b><small> {game}{r.pos ? ` · ${r.pos}` : ''}</small></El>
      {kind === 'ladder' ? (
        <span className="ir-bd-marks">
          {r.marks.map((m) => <span key={m.line} className={`ir-bd-mark is-${m.tier}`} title={markText(m, unit)}>{m.mark}<small>{m.tier}</small></span>)}
          {r.proj != null ? <small className="nhlx-auto-meta ir-bd-proj" title={`Projected ${num(r.proj)} ${unit}, ${r.floor}–${r.ceiling} half the nights`}>proj {num(r.proj)}</small> : null}
        </span>
      ) : (
        <span className="ir-bd-marks">
          {/* A candidate is listed with his chance alone (Vincent, 2026-11-01: "TD candidates we should list with chance%"); the price on the hover. */}
          <span className={`ir-bd-chance is-${tierOf(r.p) || 'none'}`} title={`${r.side === 'yes' ? r.label : `o${r.line}`}: ${pct(r.p)} on the board${r.odds != null ? ` · ${fmtOdds(r.odds)} at the book` : ''}`}>{pct(r.p)}</span>
          {r.side !== 'yes' ? <small className="nhlx-auto-meta">o{r.line}</small> : null}
          {r.proj != null && r.side !== 'yes' ? <small className="nhlx-auto-meta ir-bd-proj">proj {num(r.proj)}</small> : null}
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
      <div className="nhlx-pfd-head"><b>{b.title}</b><small className="nhlx-auto-meta">{b.note}{b.kind === 'ladder' && b.round === false ? ' · the book’s rungs until the round marks load' : ''}</small></div>
      {rows.length ? <ol className="ir-bd-list">{rows.map((r) => <Line key={r.id || `${r.key}|${r.market}`} r={r} kind={b.kind} unit={unit} onOpen={onOpen} />)}</ol> : <p className="nhlx-auto-meta">Nobody clears the bar{b.kind === 'ladder' ? ' on this ladder' : ''} yet.</p>}
      {!all && b.rows.length > rows.length ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={() => setAll(true)}>Show all {b.rows.length}</button> : null}
    </section>
  );
}

/**
 * `shuffleApi` ('/api/nba', with `query` 'date=…'): the ladder boards read the shuffle per market for round marks (10+,
 * 15+, 20+ points), the book's rungs standing in until it arrives.
 */
export default function Boards({ board, specs, units = null, gameId = null, onOpen = null, title = 'Boards', shuffleApi = null, query = '' }) {
  const [shuffles, setShuffles] = useState({});
  const markets = useMemo(() => [...new Set(specs.filter((sp) => sp.kind === 'ladder').map((sp) => sp.market))], [specs]);
  useEffect(() => {
    if (!shuffleApi || !query) return undefined;
    let live = true;
    // One request a market, as the Shuffle tab and the courts read them; each board switches to round marks as its arrives.
    for (const m of markets) {
      fetch(`${shuffleApi}/shuffle?${query}&market=${m}`, { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((j) => { if (live && j?.players) setShuffles((prev) => ({ ...prev, [m]: j })); })
        .catch(() => {});
    }
    return () => { live = false; };
  }, [shuffleApi, query, markets]);
  // A new slate drops the last one's reads (the state adjusted during render as the query changes).
  const [lastQuery, setLastQuery] = useState(query);
  if (query !== lastQuery) { setLastQuery(query); setShuffles({}); }
  const boards = useMemo(() => boardsOf(board, specs, { gameId, shuffles }), [board, specs, gameId, shuffles]);
  if (!board?.games?.length) return null;
  return (
    <section className="ir-bds" aria-label={title}>
      <div className="nhlx-pfd-head">
        <b>{title}</b>
        <small className="nhlx-auto-meta">per stat the slate’s players ranked: the highest mark each clears <b>strong</b> (70%+ on the board’s chance), <b>lean</b> (55%+) and <b>thin</b> (40%+), the strongest ladder first · hover a mark for the chance and the price · click a name for the card</small>
      </div>
      <div className="ir-bds-grid">{boards.map((b) => <OneBoard key={b.key} b={b} units={units} onOpen={onOpen} />)}</div>
    </section>
  );
}
