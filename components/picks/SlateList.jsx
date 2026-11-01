'use client';

import { useMemo, useState } from 'react';
import { fmtOdds } from '@/lib/nfl/odds';
import { playLabel } from './Board';
import Ladder from './Ladder';
import { RowBadges } from './badges';
import { asStated, calibrationNote } from '@/lib/picks/calibration';
import { reliableTone, reliableFor, reliabilityText } from '@/lib/picks/reliability';
import { failsOf, fmtEv, DEFAULTS } from '@/lib/picks/value';

// The Top Plays table (the brief of 2026-10-31, level 1: "a flat, sortable table of every +EV play across all games,
// sorted by EV% desc"; before it the NBA's ranked list of 2026-10-30): every play with an edge on the slate, the value
// at the book's price the headline number and the price beside it, then the chance, his projection with his
// floor–ceiling drawn against the line, and the opponent's rank at his spot. The rows arrive ranked and filtered by
// the panel (lib/picks/value.js topPlays with the user's floors); with "show marginal" on, the rows failing a floor
// come too, dimmed, each naming the floor it misses. A market filter on the tabs, a soft-only switch, a row opening
// the player's card (the NBA) and a ladder button opening the alternate lines with the value of every rung.
//   sport: { groups: [[key, label]], headshotUrl, teamLogo }

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const SHOWN = 25;
const FAIL_WORD = { price: 'no price', juice: 'past the juice ceiling', ev: 'under the EV floor', chance: 'under the chance floor', thin: 'thin minutes', out: 'out' };

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

/** The side player's ladder for a row's market, off the board game it belongs to. */
export function laddersFor(board, r) {
  const side = (board?.games || []).find((g) => g.id === r.game)?.sides?.[r.team];
  return side?.players?.find((p) => p.key === r.key)?.ladders?.[r.market] || null;
}

const fmtTip = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');

/** The EV tone: good from the default floor, thin over zero, bad under it. */
export const evTone = (ev) => (ev == null ? 'none' : ev >= DEFAULTS.minEv ? 'good' : ev > 0 ? 'thin' : 'bad');

export default function SlateList({ board, sport, rows: given = null, filters = DEFAULTS, onFilters = null, onOpen = null, title = null }) {
  const reliability = board?.reliability || null;
  const [ownGroup, setOwnGroup] = useState('all');
  const group = onFilters ? (filters.group || 'all') : ownGroup;
  const setGroup = (k) => (onFilters ? onFilters({ group: k }) : setOwnGroup(k));
  const [softOnly, setSoftOnly] = useState(false);
  const [all, setAll] = useState(false);
  const [ladder, setLadder] = useState(null);   // the row id whose ladder is open
  const best = useMemo(() => given || board?.best || [], [given, board]);
  const pool = useMemo(() => best.filter((r) => !softOnly || spotTone(r.spot) === 'soft'), [best, softOnly]);
  const rows = useMemo(() => pool.filter((r) => group === 'all' || r.group === group), [pool, group]);
  const shown = all ? rows : rows.slice(0, SHOWN);
  const final = best.some((r) => r.final);
  const gamesN = board?.games?.length || 0;
  if (!best.length) return <section className="ir-slate" aria-label="Top plays"><div className="nhlx-pfd-head"><b>{title || 'Top plays'}</b><small className="nhlx-auto-meta">No play clears the floors{filters.marginal ? '' : ' · "Show marginal" lists the rest'}.</small></div></section>;

  // A tab per stat group the list carries.
  const tabs = [['all', 'All'], ...sport.groups.filter(([k]) => best.some((r) => r.group === k))];
  const sortWord = filters.sort === 'chance' ? 'the likeliest first' : filters.sort === 'matchup' ? 'by the game’s Matchup Score, then the value' : 'the best value first';
  return (
    <section className="ir-slate" aria-label="Top plays">
      <div className="nhlx-pfd-head">
        <b>{title || 'Top plays'}, {sortWord}</b>
        <small className="nhlx-auto-meta">{rows.length} play{rows.length === 1 ? '' : 's'} across {gamesN} game{gamesN === 1 ? '' : 's'} · EV = the return a unit at the book’s price on the board’s chance{onOpen ? ' · click a row for the card' : ''} · the ladder button opens the alternate lines{board?.calibration?.plays?.length ? <span title={calibrationNote(board.calibration)}> · chances calibrated</span> : null}</small>
      </div>
      <div className="ir-slate-bar">
        <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label="Market">
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
              <th className="is-num is-lead" title="Expected value: the return a unit staked at the book’s price on the board’s chance (p × (decimal − 1) − (1 − p)); the probability edge under it">EV</th>
              <th className="is-num" title="The book’s price, and the chance it implies under it">Price</th>
              <th className="is-num" title="The board’s chance of the hit, and the break-even price under it">Chance</th>
              <th title="His projection for the game (the board’s), the quartiles of his range under it, drawn against the line">Projection</th>
              <th title="The opponent’s rank at his spot for the stat on the season table (the cheat sheet’s tile and PropFinder’s table together), 1 = gives up the most">Matchup</th>
              {final ? <th className="is-num" title="The box-score figure">Got</th> : null}
            </tr>
          </thead>
          <tbody>
            {shown.length ? shown.map((r, i) => {
              const tone = spotTone(r.spot);
              const bar = rangeBar(r.proj, r.side === 'over' || r.side === 'under' ? r.line : null);
              const grade = r.hit == null ? (r.final && r.actual === null ? ' is-dnp' : '') : r.hit ? ' is-hit' : ' is-miss';
              const fails = failsOf(r, filters);
              const open = ladder === r.id;
              const rungs = open ? laddersFor(board, r) : null;
              const cols = final ? 10 : 9;
              return [
                <tr key={r.id} className={`${onOpen ? 'is-click' : ''}${grade}${fails ? ' is-marginal' : ''}`} onClick={() => (onOpen ? onOpen(r) : setLadder(open ? null : r.id))}>
                  <td className="ir-slate-rank ir-sl-rank">{i + 1}</td>
                  <td className="ir-sl-player">
                    <div className="nhlx-db-player">
                      {r.espnId ? <img src={sport.headshotUrl(r.espnId)} alt="" width="30" height="30" loading="lazy" /> : <img src={sport.teamLogo(r.team)} alt="" width="30" height="30" loading="lazy" className="ir-nfl-logo" />}
                      <span><b>{r.player}{r.confirmed ? <small className="ir-sh-check" title="On the cheat sheet"> ✓</small> : null}</b><small>{r.team} · {r.slot && r.depth ? `${r.slot}${r.depth}` : r.pos || '—'}<RowBadges r={r} />{r.sheetOnly ? ' · sheet only' : ''}{fails ? <> · <span className="ir-fails" title="Fails a floor: shown because “Show marginal” is on">{FAIL_WORD[fails] || fails}</span></> : null}</small></span>
                    </div>
                  </td>
                  <td className="ir-sl-game"><b>{r.venue === 'H' ? 'vs' : 'at'} {r.opp}</b><small className="ir-slate-sub">{r.final ? 'final' : fmtTip(r.start)}</small></td>
                  <td className="ir-nfl-play ir-sl-play"><b>{playLabel(r)}</b><button type="button" className={`ir-ladder-btn${open ? ' is-open' : ''}`} onClick={(e) => { e.stopPropagation(); setLadder(open ? null : r.id); }} aria-expanded={open} title="The alternate lines with the value of every rung">ladder {open ? '▴' : '▾'}</button></td>
                  <td className={`is-num is-lead ir-sl-ev ir-ev-${evTone(r.ev)}`} title={r.ev != null ? `${fmtEv(r.ev)} a unit staked at ${fmtOdds(r.odds)} on a ${pct(r.p)} chance · edge ${r.edge >= 0 ? '+' : '−'}${Math.abs(Math.round(r.edge * 100))} points over the book’s ${pct(r.implied ?? (1 / ((r.odds > 0 ? r.odds / 100 : 100 / Math.abs(r.odds)) + 1)))}` : 'No price: no value to read'}><b>{fmtEv(r.ev)}</b><small>{r.edge == null ? '—' : `${r.edge >= 0 ? '+' : '−'}${Math.abs(Math.round(r.edge * 100))} pts`}</small></td>
                  <td className="is-num ir-sl-price"><b>{fmtOdds(r.odds)}</b><small>{r.odds == null ? (r.book || '—') : `implies ${pct(r.implied ?? null)}`}</small></td>
                  <td className={`is-num ir-sl-chance${reliableTone(reliability, r.market, r.p, r.raw) ? ` ir-rel-${reliableTone(reliability, r.market, r.p, r.raw)}` : ''}`} title={`${r.raw != null ? `${pct(r.p)} calibrated to what this season's ${r.label} plays have landed${asStated(r.raw)}` : ''}${reliableFor(reliability, r.market) != null ? `${r.raw != null ? ' · ' : ''}${reliabilityText(reliability, r.market, r.label)}` : ''}` || undefined}><b>{pct(r.p)}</b><small>{r.fair}</small></td>
                  <td className="ir-sl-proj">
                    {r.proj ? (
                      <div className="ir-slate-proj" title={`Projected ${num(r.proj.exp)} ${r.unit}, between ${r.proj.floor} and ${r.proj.ceiling} half the nights${r.proj.reach ? ` · ${num(r.proj.base)} before the ceiling read, ${r.proj.reach > 0 ? '+' : '−'}${num(Math.abs(r.proj.reach))} toward his ${r.proj.reach > 0 ? 'ceiling' : 'floor'} for the matchup at his spot` : ''}`}>
                        <span><b>{num(r.proj.exp)}</b><small className="ir-slate-sub">{r.gap != null ? <span className={r.gap * (r.side === 'under' ? -1 : 1) > 0 ? 'ir-slate-gap is-up' : 'ir-slate-gap'} title={`The projection ${num(Math.abs(r.gap))} ${r.unit} ${r.gap >= 0 ? 'over' : 'under'} the book's line`}>{r.gap >= 0 ? '+' : '−'}{num(Math.abs(r.gap))} vs line · </span> : null}{r.proj.floor}–{r.proj.ceiling}</small></span>
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
                  <td className="ir-sl-spot">{r.spot?.rank ? <span className={`ir-spot is-${tone}`} title={`${r.opp} gives up ${r.spot.value != null ? `${num(r.spot.value)} ${r.unit} a game` : `the #${r.spot.rank} most`} to ${r.spot.pos}s, #${r.spot.rank} of ${r.spot.count}`}>#{r.spot.rank} {r.spot.pos} · {TONE_WORD[tone] || ''}</span> : <span className="ir-spot is-none">no table</span>}</td>
                  {final ? <td className="is-num nhlx-pk-got ir-sl-got">{r.actual === undefined ? <small>—</small> : r.actual === null ? <small>DNP</small> : <><b>{r.actual}</b><small>{r.unit}</small></>}</td> : null}
                </tr>,
                open ? <tr key={`${r.id}|ladder`} className="ir-slate-ladder-row"><td colSpan={cols}>{rungs ? <Ladder rungs={rungs} side={r.side} unit={r.unit} label={r.label} line={r.line} compact /> : <small className="ir-nfl-none">No ladder: the board has no rungs for {r.player}’s {r.label.toLowerCase()} (a market without a ladder, or no PropFinder log).</small>}</td></tr> : null,
              ];
            }) : <tr><td colSpan={final ? 10 : 9}><small className="ir-nfl-none">No play clears the floors{softOnly ? ' in a soft matchup' : ''} for this market.</small></td></tr>}
          </tbody>
        </table>
      </div>
      {!all && rows.length > SHOWN ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-slate-more" onClick={() => setAll(true)}>Show all {rows.length}</button> : null}
    </section>
  );
}
