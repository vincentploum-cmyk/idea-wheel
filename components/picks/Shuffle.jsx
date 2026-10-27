'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fmtOdds } from '@/lib/nfl/odds';
import { survivorsAt, fallenAt, curveOf, READ_FROM } from '@/lib/picks/shuffle';

// The shuffle: a bar per stat. Raise it and the field falls away; what stays are the players whose
// chance of clearing the bar holds over the floor, each with his chance there, how often he has
// actually cleared it, the book's rung at or above the bar with its price and edge, and the height
// where he himself thins out. One request per market (/api/<sport>/shuffle), every bar move local.
//   sport: { api, query, markets: [{ market, label, unit, min, max, step, start }], teamLogo, headshotUrl, withDay }
//   onOpen(player, market): open the player's card (the NBA), optional.

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const fmtStart = (iso, withDay) => (iso ? new Date(iso).toLocaleString(undefined, withDay ? { weekday: 'short', hour: 'numeric', minute: '2-digit' } : { hour: 'numeric', minute: '2-digit' }) : '');
const FLOORS = [0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6];
const FELL_MAX = 14;

/** League rank → 'soft' | 'mid' | 'tough' | 'none' by third. */
function toneOf(rank, count) {
  if (!rank || !count) return 'none';
  const third = Math.ceil(count / 3);
  return rank <= third ? 'soft' : rank > count - third ? 'tough' : 'mid';
}

function Curve({ curve, height, onPick }) {
  const max = Math.max(1, ...curve.map((c) => c.n));
  const every = Math.max(1, Math.ceil(curve.length / 12));
  return (
    <div className="ir-sh-curve" role="img" aria-label="How many players clear each height at the floor">
      {curve.map((c, i) => (
        <button type="button" key={c.height} className={`ir-sh-step${c.height === height ? ' is-on' : ''}`} style={{ height: `${Math.max(3, (c.n / max) * 100)}%` }} title={`${c.n} clear ${c.height}+`} onClick={() => onPick(c.height)} aria-label={`${c.height} and up: ${c.n} players`}>
          {c.height === height || i % every === 0 ? <i>{c.n}</i> : null}
          {c.height === height || i % every === 0 ? <span>{c.height}</span> : null}
        </button>
      ))}
    </div>
  );
}

export default function Shuffle({ sport, onOpen = null }) {
  const { api, query, markets, teamLogo, headshotUrl, withDay = false } = sport;
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState(markets[0].market);
  const [bars, setBars] = useState(() => Object.fromEntries(markets.map((m) => [m.market, m.start])));
  const [floor, setFloor] = useState(0.35);
  const [from, setFrom] = useState('blend');
  const [data, setData] = useState({});
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  const loaded = useRef({ query: null, set: new Set() });

  const load = useCallback(async (market) => {
    setBusy(market); setErr('');
    try {
      const res = await fetch(`${api}/shuffle?${query}&market=${market}`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`);
      setData((prev) => ({ ...prev, [market]: j }));
    } catch (e) { setErr(`Shuffle: ${e.message}`); }
    finally { setBusy(''); }
  }, [api, query]);

  // A new slate starts over; the active market loads first, then the others so every bar can count its field.
  useEffect(() => {
    if (loaded.current.query !== query) { loaded.current = { query, set: new Set() }; setData({}); }
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      for (const m of [active, ...markets.map((x) => x.market).filter((x) => x !== active)]) {
        if (cancelled || loaded.current.set.has(m)) continue;
        loaded.current.set.add(m);
        await load(m);
      }
    })();
    return () => { cancelled = true; };
  }, [open, active, query, markets, load]);

  const d = data[active];
  const heights = d?.heights || [];
  // A bar sits on its market's grid: clamped to the range and snapped to the step.
  const clampTo = (m, h) => { const cfg = markets.find((x) => x.market === m); const v = Math.min(cfg.max, Math.max(cfg.min, Number(h) || cfg.min)); return Math.round((cfg.min + Math.round((v - cfg.min) / cfg.step) * cfg.step) * 100) / 100; };
  const height = clampTo(active, bars[active]);
  const survivors = useMemo(() => (d ? survivorsAt(d.players, heights, height, floor, from) : []), [d, heights, height, floor, from]);
  const fallen = useMemo(() => (d ? fallenAt(d.players, heights, height, floor, from) : []), [d, heights, height, floor, from]);
  const curve = useMemo(() => (d ? curveOf(d.players, heights, floor, from) : []), [d, heights, floor, from]);
  const countAt = (m) => { const dd = data[m]; if (!dd) return null; const h = clampTo(m, bars[m]); return curveOf(dd.players, dd.heights, floor, from).find((c) => c.height === h)?.n ?? null; };
  const unitOf = (m) => markets.find((x) => x.market === m)?.unit || '';
  const final = !!d && d.finals > 0;
  const fromLabel = READ_FROM.find(([k]) => k === from)?.[1] || from;

  return (
    <section className="ir-sh" aria-label="Shuffle">
      <div className="ir-sh-head">
        <div>
          <h3 className="ir-sh-title">Shuffle <small>raise the bar, the field falls away</small></h3>
          <p className="nhlx-auto-meta">Set a height per stat; the list keeps the players whose chance of clearing it holds over the floor. The chance is his ladder read at that line (half his own distribution over it, centred on tonight’s projection with the matchup inside it, half how often he actually cleared it); the price is the book’s rung at or above the bar.</p>
        </div>
        <div className="ir-sh-floor">
          <label>Keep players at <select className="nhlx-input nhlx-input-sm" value={floor} onChange={(e) => setFloor(Number(e.target.value))} aria-label="The floor">{FLOORS.map((f) => <option key={f} value={f}>{Math.round(f * 100)}%</option>)}</select> or better</label>
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      {open ? (
        <div className="nhlx-rk-toggle ir-sh-from">
          <small>Read from</small>
          <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label="What the chance is read from">
            {READ_FROM.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={from === k} className={`nhlx-tab${from === k ? ' is-active' : ''}`} onClick={() => setFrom(k)} title={k === 'blend' ? 'The board’s read: his season blended with his last ten, × the matchup' : k === 'line' ? 'The book’s main line as the centre of his distribution' : `His average over his ${l.toLowerCase()} games, × the matchup`}>{l}</button>)}
          </div>
          <span className="nhlx-rk-toggle-note">The centre of each player’s distribution: the board’s blend, a plain window of his own results, or the book’s line. The hit-rate half of the chance stays as it is. The scorecard under the board says which has predicted best.</span>
        </div>
      ) : null}
      {err ? <div className="nhlx-alert" style={{ marginTop: 12 }}>{err}</div> : null}
      {open ? (
        <>
          <div className="ir-sh-grid">
            <div className="ir-sh-bars">
              {markets.map((m) => {
                const h = clampTo(m.market, bars[m.market]);
                const n = countAt(m.market);
                const dd = data[m.market];
                return (
                  <div className={`ir-sh-bar${m.market === active ? ' is-active' : ''}`} key={m.market}>
                    <button type="button" className="ir-sh-bar-label" onClick={() => setActive(m.market)}>{m.label}</button>
                    <input type="range" min={m.min} max={m.max} step={m.step} value={h} onChange={(e) => setBars((b) => ({ ...b, [m.market]: Number(e.target.value) }))} onFocus={() => setActive(m.market)} onPointerDown={() => setActive(m.market)} aria-label={`${m.label} bar`} />
                    <div className="ir-sh-bar-val"><b>{h}+</b><small>{m.unit}</small></div>
                    <div className="ir-sh-bar-count">{dd ? <><b>{n}</b> of {dd.players.length} at {Math.round(floor * 100)}%+</> : busy === m.market ? 'reading…' : <span>—</span>}</div>
                  </div>
                );
              })}
            </div>
            <div className="ir-sh-side">
              <div className="nhlx-auto-meta">How many clear the {markets.find((m) => m.market === active)?.label.toLowerCase()} bar at {Math.round(floor * 100)}%+, as it rises · click a step to set the bar</div>
              {d ? <Curve curve={curve} height={height} onPick={(h) => setBars((b) => ({ ...b, [active]: h }))} /> : <div className="ir-sh-curve is-empty">{busy ? 'Reading the slate…' : 'No pull for this slate yet'}</div>}
            </div>
          </div>

          {d ? (
            <>
              <div className="nhlx-pfd-head" style={{ marginTop: 14 }}>
                <b>Clear {height}+ {unitOf(active)}</b>
                <small className="nhlx-auto-meta">{survivors.length} of {d.players.length} players · read from {fromLabel.toLowerCase()} · sorted by edge at the bar, then the chance · the book column is the rung at the bar, or the nearest one above it{onOpen ? ' · click a row for the card' : ''}</small>
              </div>
              <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
                <table className="nhlx-db-table nhlx-pk-table ir-sh-table">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th title="The opponent’s rank at his position for the stat (1 = gives up the most) and the environment factor in his projection">Matchup</th>
                      <th className="is-num" title={from === 'blend' ? 'His projection for the game, and the quartiles of his range' : `The centre his chance is read around: ${fromLabel.toLowerCase()}${from === 'line' ? '' : ' × the matchup'}; the board’s projection under it`}>{from === 'blend' ? 'Expected' : 'Centre'}</th>
                      <th className="is-num" title={`His chance of ${height}+ and the break-even price under it`}>Chance at {height}+</th>
                      <th title="How often he cleared the bar: his last ten, and the season rate">Cleared it</th>
                      <th className="is-num" title="The book’s rung at the bar, or the nearest rung above it, with its price">Book</th>
                      <th className="is-num" title="The rung’s chance minus the price’s implied probability, in points">Edge</th>
                      <th className="is-num" title={`The highest bar he still clears at ${Math.round(floor * 100)}%`}>Thins out</th>
                      {final ? <th className="is-num" title="The box-score figure">Got</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {survivors.length ? survivors.map(({ player: p, read: r, thins }) => {
                      const tone = toneOf(p.spot?.rank, p.spot?.count);
                      const grade = r.hit == null ? '' : r.hit ? ' is-hit' : ' is-miss';
                      return (
                        <tr key={p.key} className={`${onOpen ? 'is-click' : ''}${p.injury ? ' is-under' : ''}${grade}`} onClick={() => onOpen?.(p, active)}>
                          <td>
                            <div className="nhlx-db-player">
                              {p.espnId ? <img src={headshotUrl(p.espnId)} alt="" width="30" height="30" loading="lazy" /> : <img src={teamLogo(p.team)} alt="" width="30" height="30" loading="lazy" className="ir-nfl-logo" />}
                              <span><b>{p.player}{p.confirmed ? <small className="ir-sh-check" title={`On the cheat sheet: ${p.sheet.join(', ')}`}> ✓</small> : null}</b><small>{p.team}{p.slot && p.depth ? ` · ${p.slot}${p.depth}` : p.pos ? ` · ${p.pos}` : ''} · {p.venue === 'H' ? 'vs' : 'at'} {p.opp}{p.start ? ` · ${fmtStart(p.start, withDay)}` : ''}{p.injury ? ` · ${p.injury}` : ''}</small></span>
                            </div>
                          </td>
                          <td>{p.spot?.rank ? <span className={`ir-spot is-${tone}`} title={`${p.opp} gives up ${num(p.spot.value)} ${unitOf(active)} a game to ${p.spot.pos}s, #${p.spot.rank} of ${p.spot.count}`}>#{p.spot.rank} {p.spot.pos}</span> : <span className="ir-spot is-none">no table</span>}{p.env != null ? <small className="nhlx-auto-meta" style={{ marginLeft: 6 }}>× {num(p.env, 2)}</small> : null}</td>
                          <td className="is-num" title={`Spread ${num(p.sd)} over his games · last 5 ${num(p.own?.l5)} · last 10 ${num(p.own?.l10)} · season ${num(p.own?.season)} (${p.own?.seasonN ?? 0} games) · blend ${num(p.own?.blend)}`}><b>{num(r.centre)}</b><small>{from === 'blend' ? (p.floor != null ? `${p.floor}–${p.ceiling}` : '') : `board ${num(p.exp)}`}</small></td>
                          <td className="is-num is-lead" title={`Model tail ${pct(r.model)} · hit rate ${pct(r.emp)} over ${r.n} games`}><b>{pct(r.p)}</b><small>{r.fair} fair</small></td>
                          <td className="small">{r.cleared ? `${r.cleared.n} of last ${r.cleared.of}` : '—'}{r.season != null ? <small className="nhlx-auto-meta"> · {pct(r.season)} season</small> : null}</td>
                          <td className="is-num" title={r.book ? `${r.exact ? 'The book’s rung at the bar' : 'The nearest rung above the bar'}: ${r.book.main ? 'the main line, ' : ''}${r.book.books} book${r.book.books === 1 ? '' : 's'} · its chance ${pct(r.book.p)}` : 'No rung at or above the bar'}>{r.book ? <><b>{r.exact ? '' : '↑ '}o{r.book.line}</b><small>{fmtOdds(r.book.odds)}{r.book.main ? ' · main' : ''}</small></> : <small>no line</small>}</td>
                          <td className={`is-num${r.edge != null && r.edge > 0 ? ' is-best' : ''}`}>{r.edge == null ? '—' : <b>{r.edge >= 0 ? '+' : '−'}{Math.abs(Math.round(r.edge * 100))} pts</b>}</td>
                          <td className="is-num"><b>{thins == null ? '—' : `${thins}+`}</b></td>
                          {final ? <td className="is-num nhlx-pk-got">{r.got === undefined ? <small>—</small> : r.got === null ? <small>DNP</small> : <><b>{r.got}</b><small>{unitOf(active)}</small></>}</td> : null}
                        </tr>
                      );
                    }) : <tr><td colSpan={final ? 9 : 8}><small className="ir-nfl-none">Nobody clears {height}+ at {Math.round(floor * 100)}% or better. Lower the bar or the floor.</small></td></tr>}
                  </tbody>
                </table>
              </div>
              {fallen.length ? (
                <div className="ir-sh-fell" aria-label={`Under the floor at ${height}+`}>
                  <small className="nhlx-auto-meta">Fell off at {height}+ (his chance, the bar he still clears):</small>
                  {fallen.slice(0, FELL_MAX).map(({ player: p, read: r, thins }) => <span key={p.key} title={`${p.player} · ${pct(r.p)} to clear ${height}+${thins != null ? ` · still ${Math.round(floor * 100)}%+ at ${thins}+` : ''}`}>{p.player}<b>{pct(r.p)}</b>{thins != null ? <i> · {thins}+</i> : null}</span>)}
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
