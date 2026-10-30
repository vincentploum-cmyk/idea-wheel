'use client';

import { useMemo, useState } from 'react';
import { fmtOdds } from '@/lib/nfl/odds';
import { playLabel } from './Board';

// The slate in one list (the NBA board's first view since 2026-10-30; Vincent: "you have built a website which makes
// it so incredibly difficult to find good match ups easily"): every play over the floor on the night, ranked by its
// chance (`board.best`, lib/picks/board.js), each row carrying what it takes to judge it without opening the game —
// the line, his projection with his floor–ceiling drawn against the line, the chance, the book's price and edge, and
// the opponent's rank at his spot for the stat (the table the court and the shuffle read). A stat filter, a soft-only
// switch, a row opening the player's card.
//   sport: { groups: [[key, label]], headshotUrl, teamLogo }

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const SHOWN = 25;

/** League rank (1 = gives up the most) → 'soft' | 'mid' | 'tough' | 'none' by third. */
export function spotTone(spot) {
  if (!spot?.rank || !spot?.count) return 'none';
  const third = Math.ceil(spot.count / 3);
  return spot.rank <= third ? 'soft' : spot.rank > spot.count - third ? 'tough' : 'mid';
}
const TONE_WORD = { soft: 'soft', mid: 'even', tough: 'tough' };

/** Where the floor, the projection and the line sit on one scale: percentages for the bar, null without a range. */
export function rangeBar(proj, line) {
  if (!proj || proj.exp == null || proj.floor == null || proj.ceiling == null) return null;
  const lo = Math.min(proj.floor, line ?? proj.floor);
  const hi = Math.max(proj.ceiling, line ?? proj.ceiling);
  const pad = Math.max((hi - lo) * 0.15, 0.5);
  const a = lo - pad; const span = hi + pad - a;
  const at = (x) => Math.round(((x - a) / span) * 1000) / 10;
  return { floor: at(proj.floor), band: Math.round(((proj.ceiling - proj.floor) / span) * 1000) / 10, exp: at(proj.exp), line: line == null ? null : at(line) };
}

const fmtTip = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');

export default function SlateList({ board, sport, onOpen = null }) {
  const [group, setGroup] = useState('all');
  const [softOnly, setSoftOnly] = useState(false);
  const [all, setAll] = useState(false);
  const best = useMemo(() => board?.best || [], [board]);
  const pool = useMemo(() => best.filter((r) => !softOnly || spotTone(r.spot) === 'soft'), [best, softOnly]);
  const rows = useMemo(() => pool.filter((r) => group === 'all' || r.group === group), [pool, group]);
  const shown = all ? rows : rows.slice(0, SHOWN);
  const final = best.some((r) => r.final);
  if (!best.length) return null;

  const tabs = [['all', 'All'], ...sport.groups];
  return (
    <section className="ir-slate" aria-label="Every play tonight">
      <div className="nhlx-pfd-head">
        <b>Every play tonight, the likeliest first</b>
        <small className="nhlx-auto-meta">{rows.length} play{rows.length === 1 ? '' : 's'} over the floor across {board.games.length} game{board.games.length === 1 ? '' : 's'}{onOpen ? ' · click a row for the card' : ''}</small>
      </div>
      <div className="ir-slate-bar">
        <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label="Stat">
          {tabs.map(([k, l]) => {
            const n = k === 'all' ? pool.length : pool.filter((r) => r.group === k).length;
            return <button key={k} type="button" role="tab" aria-selected={group === k} className={`nhlx-tab${group === k ? ' is-active' : ''}`} onClick={() => { setGroup(k); setAll(false); }}>{l}<i>{n}</i></button>;
          })}
        </div>
        <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-slate-soft" aria-pressed={softOnly} onClick={() => { setSoftOnly((v) => !v); setAll(false); }}>Soft matchups only</button>
      </div>
      <div className="ir-slate-legend" aria-hidden="true">
        <span><i className="ir-range-band is-key" />his floor to ceiling, half his nights</span>
        <span><i className="ir-range-dot is-key" />his projection</span>
        <span><i className="ir-range-tick is-key" />the line</span>
        <span className="ir-slate-legend-note">Matchup: the opponent’s rank at his spot for the stat, #1 gives up the most; soft the top third, tough the bottom third</span>
      </div>
      <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
        <table className="nhlx-db-table nhlx-pk-table ir-slate-table">
          <thead>
            <tr>
              <th className="ir-slate-rank">#</th>
              <th>Player</th>
              <th>Game</th>
              <th>Play</th>
              <th title="His projection for the game (the board’s), the quartiles of his range under it, drawn against the line">Projection</th>
              <th className="is-num" title="The chance of the hit, and the break-even price under it">Chance</th>
              <th className="is-num" title="The book’s price, and the edge over its implied chance under it (points)">Price</th>
              <th title="The opponent’s rank at his spot for the stat on the season table (the cheat sheet’s tile and PropFinder’s table together), 1 = gives up the most">Matchup</th>
              {final ? <th className="is-num" title="The box-score figure">Got</th> : null}
            </tr>
          </thead>
          <tbody>
            {shown.length ? shown.map((r, i) => {
              const tone = spotTone(r.spot);
              const bar = rangeBar(r.proj, r.side === 'over' ? r.line : null);
              const over = r.proj?.exp != null && r.side === 'over' ? r.proj.exp - r.line : null;
              const grade = r.hit == null ? (r.final && r.actual === null ? ' is-dnp' : '') : r.hit ? ' is-hit' : ' is-miss';
              return (
                <tr key={r.id} className={`${onOpen ? 'is-click' : ''}${grade}`} onClick={() => onOpen?.(r)}>
                  <td className="ir-slate-rank ir-sl-rank">{i + 1}</td>
                  <td className="ir-sl-player">
                    <div className="nhlx-db-player">
                      {r.espnId ? <img src={sport.headshotUrl(r.espnId)} alt="" width="30" height="30" loading="lazy" /> : <img src={sport.teamLogo(r.team)} alt="" width="30" height="30" loading="lazy" className="ir-nfl-logo" />}
                      <span><b>{r.player}{r.confirmed ? <small className="ir-sh-check" title="On the cheat sheet"> ✓</small> : null}</b><small>{r.team} · {r.slot && r.depth ? `${r.slot}${r.depth}` : r.pos || '—'}{r.health === 'DTD' ? <> · <span className="ir-health is-dtd" title={r.injury || ''}>DTD</span></> : null}{r.sheetOnly ? ' · sheet only' : ''}</small></span>
                    </div>
                  </td>
                  <td className="ir-sl-game"><b>{r.venue === 'H' ? 'vs' : 'at'} {r.opp}</b><small className="ir-slate-sub">{r.final ? 'final' : fmtTip(r.start)}</small></td>
                  <td className="ir-nfl-play ir-sl-play"><b>{playLabel(r)}</b></td>
                  <td className="ir-sl-proj">
                    {r.proj ? (
                      <div className="ir-slate-proj" title={`Projected ${num(r.proj.exp)} ${r.unit}, between ${r.proj.floor} and ${r.proj.ceiling} half the nights${over != null ? ` · ${over >= 0 ? '+' : '−'}${num(Math.abs(over))} over the line` : ''}`}>
                        <span><b>{num(r.proj.exp)}</b><small className="ir-slate-sub">{r.proj.floor}–{r.proj.ceiling}</small></span>
                        {bar ? (
                          <span className="ir-range-bar" aria-hidden="true">
                            <i className="ir-range-band" style={{ left: `${bar.floor}%`, width: `${bar.band}%` }} />
                            {bar.line != null ? <i className="ir-range-tick" style={{ left: `${bar.line}%` }} /> : null}
                            <i className="ir-range-dot" style={{ left: `${bar.exp}%` }} />
                          </span>
                        ) : null}
                      </div>
                    ) : <small className="ir-slate-sub">no projection</small>}
                  </td>
                  <td className="is-num is-lead ir-sl-chance"><b>{pct(r.p)}</b><small>{r.fair}</small></td>
                  <td className="is-num ir-sl-price"><b>{fmtOdds(r.odds)}</b><small>{r.edge == null ? (r.book || '—') : `${r.edge >= 0 ? '+' : '−'}${Math.abs(Math.round(r.edge * 100))} pts`}</small></td>
                  <td className="ir-sl-spot">{r.spot?.rank ? <span className={`ir-spot is-${tone}`} title={`${r.opp} gives up ${r.spot.value != null ? `${num(r.spot.value)} ${r.unit} a game` : `the #${r.spot.rank} most`} to ${r.spot.pos}s, #${r.spot.rank} of ${r.spot.count}`}>#{r.spot.rank} {r.spot.pos} · {TONE_WORD[tone] || ''}</span> : <span className="ir-spot is-none">no table</span>}</td>
                  {final ? <td className="is-num nhlx-pk-got ir-sl-got">{r.actual === undefined ? <small>—</small> : r.actual === null ? <small>DNP</small> : <><b>{r.actual}</b><small>{r.unit}</small></>}</td> : null}
                </tr>
              );
            }) : <tr><td colSpan={final ? 9 : 8}><small className="ir-nfl-none">No play over the floor{softOnly ? ' in a soft matchup' : ''} for this stat.</small></td></tr>}
          </tbody>
        </table>
      </div>
      {!all && rows.length > SHOWN ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-slate-more" onClick={() => setAll(true)}>Show all {rows.length}</button> : null}
    </section>
  );
}
