'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Headshot } from './media';
import { usePlayerCard } from './PlayerCard';
import { Flags } from './flags';
import { LEAGUE_POS } from '@/lib/nhl-data/picks-pure';
import { NHL_BARS, READ_FROM, HEIGHTS, survivorsAt, fallenAt, curveOf } from '@/lib/nhl-data/shuffle-pure';

// The NHL shuffle (the top of Best bets): a bar for shots and one for goals. Raise it and the field
// falls away; what stays are the skaters whose chance of the bar holds over the floor, off the
// board's own λ (the Poisson tail further up the same ladder the 2+ / 3+ / 4+ columns read), each
// with his chance and break-even price, how often he has actually reached it, where he thins
// out, and his figure once final. "Read from" moves the λ to the study's or a window of his own
// stored games. One request a slate (/api/nhl/data/shuffle), every bar move local.

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v, d = 2) => (v == null ? '—' : Number(v).toFixed(d));
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const FLOORS = [0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7];
const FELL_MAX = 14;

function toneOf(rank, teams) {
  if (!rank || !teams) return 'none';
  const third = Math.ceil(teams / 3);
  return rank <= third ? 'soft' : rank > teams - third ? 'tough' : 'mid';
}

function Curve({ curve, height, onPick }) {
  const max = Math.max(1, ...curve.map((c) => c.n));
  return (
    <div className="ir-sh-curve" role="img" aria-label="How many skaters clear each height at the floor">
      {curve.map((c) => (
        <button type="button" key={c.height} className={`ir-sh-step${c.height === height ? ' is-on' : ''}`} style={{ height: `${Math.max(3, (c.n / max) * 100)}%` }} title={`${c.n} clear ${c.height}+`} onClick={() => onPick(c.height)} aria-label={`${c.height} and up: ${c.n} skaters`}>
          <i>{c.n}</i><span>{c.height}+</span>
        </button>
      ))}
    </div>
  );
}

export default function ShufflePanel({ date }) {
  const open = usePlayerCard();
  const [opened, setOpened] = useState(true);
  const [active, setActive] = useState('sog');
  const [bars, setBars] = useState(() => Object.fromEntries(NHL_BARS.map((b) => [b.market, b.start])));
  const [floors, setFloors] = useState(() => Object.fromEntries(NHL_BARS.map((b) => [b.market, b.floor])));
  const [from, setFrom] = useState('model');
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async (d) => {
    if (!d) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch(`/api/nhl/data/shuffle?date=${d}`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`);
      setData(j);
    } catch (e) { setErr(`Shuffle: ${e.message}`); }
    finally { setBusy(false); }
  }, []);
  useEffect(() => { if (opened) load(date); }, [opened, date, load]);

  const rows = useMemo(() => (data?.games || []).flatMap((g) => g.skaters.map((s) => ({ ...s, game: g.id, start: g.startTimeUTC, final: g.final }))), [data]);
  const bar = NHL_BARS.find((b) => b.market === active);
  const height = Math.min(bar.max, Math.max(bar.min, bars[active]));
  const floor = floors[active];
  const survivors = useMemo(() => survivorsAt(rows, active, height, floor, from), [rows, active, height, floor, from]);
  const fallen = useMemo(() => fallenAt(rows, active, height, floor, from), [rows, active, height, floor, from]);
  const curve = useMemo(() => curveOf(rows, active, floor, from), [rows, active, floor, from]);
  const countAt = (m) => { const h = Math.min(8, Math.max(1, bars[m])); return curveOf(rows, m, floors[m], from).find((c) => c.height === h)?.n ?? null; };
  const fromLabel = READ_FROM.find(([k]) => k === from)?.[1] || from;
  const final = rows.some((r) => r.final);
  const statLabel = active === 'sog' ? 'shots' : 'goals';

  return (
    <section className="ir-sh" aria-label="Shuffle">
      <div className="ir-sh-head">
        <div>
          <h3 className="ir-sh-title">Shuffle <small>raise the bar, the field falls away</small></h3>
          <p className="nhlx-auto-meta">A bar for shots and one for goals. The list keeps the skaters whose chance of the bar holds over the floor, off the board’s own λ: the 3+ figure here is the board’s 3+ figure, and 5+ or 6+ is the same λ read further up. No price in the number; the break-even price sits under it.</p>
        </div>
        <div className="ir-sh-floor">
          <label>Keep skaters at <select className="nhlx-input nhlx-input-sm" value={floor} onChange={(e) => setFloors((f) => ({ ...f, [active]: Number(e.target.value) }))} aria-label={`The ${statLabel} floor`}>{FLOORS.map((f) => <option key={f} value={f}>{Math.round(f * 100)}%</option>)}</select> or better <small className="nhlx-auto-meta">({bar.label.toLowerCase()})</small></label>
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={() => setOpened((o) => !o)}>{opened ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      {err ? <div className="nhlx-alert" style={{ marginTop: 12 }}>{err}</div> : null}
      {opened ? (
        <>
          <div className="nhlx-rk-toggle ir-sh-from">
            <small>Read from</small>
            <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label="What the chance is read from">
              {READ_FROM.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={from === k} className={`nhlx-tab${from === k ? ' is-active' : ''}`} onClick={() => setFrom(k)} title={k === 'model' ? (data?.source === 'study' ? 'No run saved for the date: the study’s read stands in' : 'The saved run’s λ, as the board reads it') : k === 'study' ? 'The study’s plain-rate read: his blended rates, home ice, back-to-back and the opponent at his position' : `His average over his ${l.toLowerCase()} stored games as the λ`}>{l}</button>)}
            </div>
            <span className="nhlx-rk-toggle-note">The λ each chance is read from. A window he does not have yet falls back to the board’s. The History tab’s scorecard says which has predicted best.</span>
          </div>
          <div className="ir-sh-grid">
            <div className="ir-sh-bars">
              {NHL_BARS.map((b) => {
                const h = Math.min(b.max, Math.max(b.min, bars[b.market]));
                const n = countAt(b.market);
                return (
                  <div className={`ir-sh-bar${b.market === active ? ' is-active' : ''}`} key={b.market}>
                    <button type="button" className="ir-sh-bar-label" onClick={() => setActive(b.market)}>{b.label}</button>
                    <input type="range" min={b.min} max={b.max} step={b.step} value={h} onChange={(e) => setBars((x) => ({ ...x, [b.market]: Number(e.target.value) }))} onFocus={() => setActive(b.market)} onPointerDown={() => setActive(b.market)} aria-label={`${b.label} bar`} />
                    <div className="ir-sh-bar-val"><b>{h}+</b><small>{b.unit}</small></div>
                    <div className="ir-sh-bar-count">{data ? <><b>{n}</b> of {rows.length} at {Math.round(floors[b.market] * 100)}%+</> : busy ? 'reading…' : <span>—</span>}</div>
                  </div>
                );
              })}
            </div>
            <div className="ir-sh-side">
              <div className="nhlx-auto-meta">How many clear the {statLabel} bar at {Math.round(floor * 100)}%+, as it rises · click a step to set the bar</div>
              {data ? <Curve curve={curve} height={height} onPick={(h) => setBars((x) => ({ ...x, [active]: h }))} /> : <div className="ir-sh-curve is-empty">{busy ? 'Reading the slate…' : 'No slate yet'}</div>}
            </div>
          </div>
          {data ? (
            <>
              <div className="nhlx-pfd-head" style={{ marginTop: 14 }}>
                <b>{height}+ {bar.unit}</b>
                <small className="nhlx-auto-meta">{survivors.length} of {rows.length} skaters · read from {fromLabel.toLowerCase()} · sorted by the chance · click a skater for his card</small>
              </div>
              <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
                <table className="nhlx-db-table nhlx-pk-table ir-sh-table">
                  <thead>
                    <tr>
                      <th>Skater</th>
                      <th title={`What the opponent allows per skater at his position in ${statLabel} a game, and its rank (1 = allows the most)`}>Matchup</th>
                      <th className="is-num" title={`The λ ${statLabel} his chance is read from`}>{from === 'model' ? 'λ' : 'Centre'}</th>
                      <th className="is-num" title={`His chance of ${height}+ ${statLabel} and the break-even price under it`}>Chance at {height}+</th>
                      <th title="How often he reached the bar: his last ten stored games, and this season">Reached it</th>
                      <th className="is-num" title={`The highest bar he still clears at ${Math.round(floor * 100)}%`}>Thins out</th>
                      {final ? <th className="is-num" title="The box-score figure">Got</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {survivors.length ? survivors.map(({ row: c, read: r, thins }) => {
                      const rank = active === 'sog' ? c.oppPos?.rankSog : c.oppPos?.rankG;
                      const allows = active === 'sog' ? c.oppPos?.sog : c.oppPos?.g;
                      const league = LEAGUE_POS[c.pos]?.[active];
                      const tone = toneOf(rank, c.oppPos?.teams);
                      const grade = r.hit == null ? (c.final && c.actual === null ? ' is-dnp' : '') : r.hit ? ' is-hit' : ' is-miss';
                      return (
                        <tr key={c.id} className={`is-click${grade}`} onClick={() => open({ id: c.id, opp: c.opp, venue: c.venue, pos: c.pos, line: c.line })}>
                          <td>
                            <div className="nhlx-db-player">
                              <Headshot id={c.id} size={30} />
                              <span><b>{c.name}<Flags c={c} stat={active} /></b><small>{c.team} · {c.pos}{c.line || ''} · {c.venue === 'H' ? 'vs' : 'at'} {c.opp}{c.start ? ` · ${fmtTime(c.start)}` : ''}{c.carried ? ' · carried' : ''}</small></span>
                            </div>
                          </td>
                          <td>{rank ? <span className={`ir-spot is-${tone}`} title={`${c.opp} allows ${num(allows, active === 'sog' ? 2 : 3)} ${statLabel} per ${c.pos} a game, #${rank} of ${c.oppPos.teams}${league != null ? ` (league ${num(league, active === 'sog' ? 2 : 3)})` : ''}`}>#{rank} {c.pos}</span> : <span className="ir-spot is-none">no table</span>}{allows != null ? <small className="nhlx-auto-meta" style={{ marginLeft: 6 }}>{num(allows, active === 'sog' ? 2 : 3)}</small> : null}</td>
                          <td className="is-num" title={`Board ${num(active === 'sog' ? c.lamS : c.lamG)} · study ${num(active === 'sog' ? c.study?.lamS : c.study?.lamG)} · last 5 ${num(c.own?.l5?.[active])} · last 10 ${num(c.own?.l10?.[active])} · season ${num(c.own?.season?.[active])} (${c.own?.season?.n ?? 0} games)`}><b>{num(r.lambda)}</b>{r.fellBack ? <small>board’s</small> : from !== 'model' ? <small>board {num(active === 'sog' ? c.lamS : c.lamG)}</small> : null}</td>
                          <td className="is-num is-lead"><b>{pct(r.p)}</b><small>{r.fair}</small></td>
                          <td className="small">{r.cleared ? `${r.cleared.n} of last ${r.cleared.of}` : '—'}{r.season?.of ? <small className="nhlx-auto-meta"> · {pct(r.season.n / r.season.of)} this season ({r.season.of})</small> : null}</td>
                          <td className="is-num"><b>{thins == null ? '—' : `${thins}+`}</b></td>
                          {final ? <td className="is-num nhlx-pk-got">{r.got === undefined ? <small>—</small> : r.got === null ? <small>DNP</small> : <><b>{r.got}</b><small>{bar.unit}</small></>}</td> : null}
                        </tr>
                      );
                    }) : <tr><td colSpan={final ? 7 : 6}><small className="ir-nfl-none">Nobody clears {height}+ at {Math.round(floor * 100)}% or better. Lower the bar or the floor.</small></td></tr>}
                  </tbody>
                </table>
              </div>
              {fallen.length ? (
                <div className="ir-sh-fell" aria-label={`Under the floor at ${height}+`}>
                  <small className="nhlx-auto-meta">Fell off at {height}+ (his chance, the bar he still clears):</small>
                  {fallen.slice(0, FELL_MAX).map(({ row: c, read: r, thins }) => <span key={c.id} title={`${c.name} · ${pct(r.p)} for ${height}+${thins != null ? ` · still ${Math.round(floor * 100)}%+ at ${thins}+` : ''}`}>{c.name}<b>{pct(r.p)}</b>{thins != null ? <i> · {thins}+</i> : null}</span>)}
                  {fallen.length > FELL_MAX ? <span>… {fallen.length - FELL_MAX} more</span> : null}
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
