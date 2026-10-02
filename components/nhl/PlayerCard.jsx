'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Headshot, TeamLogo } from './media';
import { DefenseAllowed, PosBadge, PfTable } from './pf-ui';
import { teamName } from '@/lib/nhl-data/teams';

// Any table can open a player's profile: const open = usePlayerCard(); open({ id, opp, venue }).
const PlayerCardContext = createContext(() => {});
export const usePlayerCard = () => useContext(PlayerCardContext);

// [key, tab label, prop label, stat key, lines, default line] — PropFinder's market order.
const MARKETS = [
  ['goals', 'Goals', 'Goals', 'g', [0.5, 1.5], 0.5],
  ['shots', 'Shots on Goal', 'Shots on Goal', 'sog', [1.5, 2.5, 3.5, 4.5, 5.5], 2.5],
  ['points', 'Points', 'Points', 'pts', [0.5, 1.5, 2.5], 0.5],
  ['assists', 'Assists', 'Assists', 'a', [0.5, 1.5], 0.5],
  ['blocks', 'Blocked Shots', 'Blocked Shots', 'blk', [0.5, 1.5, 2.5], 0.5],
  ['hits', 'Hits', 'Hits', 'hits', [0.5, 1.5, 2.5, 3.5], 1.5],
];
const STAT_COLS = [['gp', 'GP'], ['toi', 'TOI'], ['g', 'G'], ['a', 'A'], ['pts', 'PTS'], ['sog', 'SOG'], ['icf', 'iCF'], ['iff', 'iFF'], ['iscf', 'iSCF'], ['ihdcf', 'iHDCF'], ['hits', 'HIT'], ['blk', 'BLK']];
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const pct = (rate) => (rate == null ? '—' : `${Math.round(rate * 100)}%`);
// '25-'26 for a game dated in the 2025-26 season.
const seasonTag = (date) => {
  if (!date) return 'Season';
  const y = Number(date.slice(0, 4));
  const start = Number(date.slice(5, 7)) >= 7 ? y : y - 1;
  return `'${String(start).slice(2)}-'${String(start + 1).slice(2)}`;
};
const mdy = (iso) => (iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}/${iso.slice(2, 4)}` : '');

export function FormChip({ tag, small }) {
  if (!tag) return null;
  const cls = tag === 'Hot' ? 'is-hot' : tag === 'Cold' ? 'is-cold' : '';
  return <span className={`nhlx-form ${cls}${small ? ' is-small' : ''}`}>{tag === 'Hot' ? '🔥 ' : tag === 'Cold' ? '🧊 ' : ''}{tag}</span>;
}

/** Hit-rate badge: green from 50% up, red below (PropFinder's colouring). */
function Pct({ rate }) {
  if (rate == null) return <span className="nhlx-pct is-none">—</span>;
  return <span className={`nhlx-pct ${rate >= 0.5 ? 'is-good' : 'is-bad'}`}>{pct(rate)}</span>;
}

/** One split tile: hits/games over the % — click to draw those games. */
function RateTile({ label, hit, active, onClick, disabled }) {
  const rate = hit?.rate;
  const cls = disabled ? 'is-none' : rate == null ? 'is-none' : rate >= 0.5 ? 'is-good' : 'is-bad';
  return (
    <button type="button" className={`nhlx-rate ${cls}${active ? ' is-active' : ''}`} onClick={onClick} disabled={disabled} aria-pressed={active}>
      <small>{label}</small>
      <b>{hit?.gp ? `${hit.hits}/${hit.gp}` : '—'}</b>
      <span>{hit?.gp ? pct(rate) : ''}</span>
    </button>
  );
}

/**
 * Per-game columns against the line, drawn PropFinder's way: a flat bar per game, green
 * over the line and red under, the value inside, shot attempts (iCF) as an outline when
 * "Total shots" is on, the average as a line with its pill at the right.
 */
function Histogram({ games, statKey, line, avgValue, showTotal, unit }) {
  const [hover, setHover] = useState(null);
  // The bars share the pane's width (a slot per game, 28px at the least, scrolling beyond that).
  const box = useRef(null);
  const [width, setWidth] = useState(720);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const read = () => setWidth(el.clientWidth || 720);
    read();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  const n = games.length;
  const padL = 30; const padR = 70; const padB = 36; const padT = 18; const H = 230;
  const slot = Math.max(28, Math.min(120, Math.floor((width - padL - padR) / Math.max(n, 1))));
  const W = padL + n * slot + padR;
  const totalKey = statKey === 'sog' ? 'icf' : null;
  const vals = games.map((g) => Number(g[statKey]) || 0);
  const tots = showTotal && totalKey ? games.map((g) => Number(g[totalKey]) || 0) : [];
  const max = Math.max(Math.ceil(line) + 1, ...vals, ...tots, 1);
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const step = max <= 8 ? 1 : max <= 16 ? 2 : 5;
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  const bw = Math.max(8, slot * 0.78);
  return (
    <div className="nhlx-hist">
      <div className="nhlx-hist-scroll" ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, minWidth: '100%' }} role="img" aria-label={`${unit} per game, ${n} games`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - padR + 10} y1={y(t)} y2={y(t)} className="nhlx-hist-grid" />
              <text x={padL - 8} y={y(t) + 4} className="nhlx-hist-tick" textAnchor="end">{t}</text>
            </g>
          ))}
          <line x1={padL} x2={W - padR + 10} y1={y(0)} y2={y(0)} className="nhlx-hist-base" />
          {games.map((g, i) => {
            const v = vals[i];
            const x = padL + i * slot + (slot - bw) / 2;
            const top = y(v);
            const h = Math.max(0, y(0) - top);
            const over = v > line;
            const tot = tots[i];
            return (
              <g key={`${g.gameId}-${i}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={padL + i * slot} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
                {tot != null && tot > v && (
                  <>
                    <rect x={x} y={y(tot)} width={bw} height={y(0) - y(tot)} className="nhlx-hist-total" />
                    <text x={x + bw / 2} y={y(tot) - 5} className="nhlx-hist-totlbl" textAnchor="middle">T:{tot}</text>
                  </>
                )}
                {v > 0 ? <rect x={x} y={top} width={bw} height={h} className={over ? 'nhlx-hist-over' : 'nhlx-hist-under'} /> : <rect x={x} y={y(0) - 3} width={bw} height={3} className="nhlx-hist-under" />}
                {v > 0 && h > 16 ? <text x={x + bw / 2} y={top + 14} className="nhlx-hist-val" textAnchor="middle">{v}</text>
                  : <text x={x + bw / 2} y={top - 5} className="nhlx-hist-val is-out" textAnchor="middle">{v}</text>}
                {(slot >= 40 || i % 2 === 0) && (
                  <>
                    <text x={x + bw / 2} y={H - padB + 14} className="nhlx-hist-x" textAnchor="middle">{g.venue === 'H' ? 'vs' : '@'} {g.opp}</text>
                    <text x={x + bw / 2} y={H - padB + 27} className="nhlx-hist-x nhlx-hist-date" textAnchor="middle">{mdy(g.date)}</text>
                  </>
                )}
              </g>
            );
          })}
          <line x1={padL} x2={W - padR + 10} y1={y(line)} y2={y(line)} className="nhlx-hist-line" />
          {avgValue != null && (
            <g>
              <line x1={padL} x2={W - padR + 10} y1={y(avgValue)} y2={y(avgValue)} className="nhlx-hist-avg" />
              <rect x={W - padR + 12} y={y(avgValue) - 10} width={56} height={20} rx={4} className="nhlx-hist-avgpill" />
              <text x={W - padR + 40} y={y(avgValue) + 4} className="nhlx-hist-avgtxt" textAnchor="middle">{num(avgValue, 1)} AVG</text>
            </g>
          )}
        </svg>
      </div>
      {hover != null && games[hover] && (
        <div className="nhlx-hist-tip">
          <b>{games[hover].date} · {games[hover].venue === 'H' ? 'vs' : '@'} {games[hover].opp}{games[hover].result ? ` · ${games[hover].result}` : ''}</b>
          <span>{games[hover].g} G · {games[hover].a} A · {games[hover].sog} SOG · {games[hover].icf} iCF · {games[hover].iscf} iSCF · {games[hover].hits ?? 0} HIT · {games[hover].blk ?? 0} BLK · {num(games[hover].toi)} min · {games[hover].pos}{games[hover].line ? games[hover].line : ''}</span>
        </div>
      )}
    </div>
  );
}

function Card({ req, onClose }) {
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  const [market, setMarket] = useState('shots');
  // The line picked per market (PropFinder keeps one per tab).
  const [lines, setLines] = useState(() => Object.fromEntries(MARKETS.map(([k, , , , , d]) => [k, d])));
  // Which games the graph draws: the split tile that is pressed.
  const [pickedSpan, setSpan] = useState(req.opp ? 'h2h' : 'l10');
  const [showTotal, setShowTotal] = useState(false);

  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({ id: String(req.id) });
    if (req.opp) q.set('opp', req.opp);
    if (req.venue) q.set('venue', req.venue);
    fetch(`/api/nhl/data/player?${q}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((j) => { if (live) setP(j); })
      .catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [req]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('nhlx-modal-open');
    return () => { window.removeEventListener('keydown', onKey); document.body.classList.remove('nhlx-modal-open'); };
  }, [onClose]);

  // A split with no games falls back to the last 10 (PropFinder greys that tile out).
  const picked = pickedSpan;
  const span = !p ? picked : (picked === 'h2h' ? p.h2hGames?.length : picked === 'tonight' ? p.stats.tonight?.gp : p.stats[picked]?.gp) ? picked : 'l10';

  const def = MARKETS.find((m) => m[0] === market);
  const statKey = def[3];
  const line = lines[market] ?? def[5];
  const games = useMemo(() => {
    if (!p) return [];
    if (span === 'h2h') return p.h2hGames || [];
    if (span === 'tonight') return p.games.filter((g) => g.venue === req.venue);
    if (span === 'season') return p.games;
    return p.games.slice(-Number(span.slice(1)));
  }, [p, span, req.venue]);
  const hit = p?.hits?.[market]?.[line];
  const graphAvg = games.length ? games.reduce((s, g) => s + (Number(g[statKey]) || 0), 0) / games.length : null;
  const seasonLabel = seasonTag(p?.last?.date);
  const splits = p ? [
    ['season', seasonLabel],
    ...(req.opp ? [['h2h', 'H2H']] : []),
    ...(req.venue ? [['tonight', req.venue === 'H' ? 'Home' : 'Away']] : []),
    ['l5', 'L5'], ['l10', 'L10'], ['l20', 'L20'],
  ] : [];

  return (
    <div className="nhlx-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="nhlx-modal-card nhlx-pc" onClick={(e) => e.stopPropagation()}>
        {err && <div className="nhlx-alert" style={{ margin: 16 }}>⚠ Couldn’t load this player: {err}</div>}
        {!p && !err && <div className="nhlx-empty" style={{ margin: 16 }}>Loading player…</div>}
        {p && (
          <>
            <div className="nhlx-pc-top">
              <button type="button" className="nhlx-pc-back" onClick={onClose} aria-label="Close">←</button>
              <div className="nhlx-pc-id">
                <span className="nhlx-pc-avatar">
                  <Headshot id={p.id} size={48} />
                  {p.team ? <span className="nhlx-pc-avatar-logo"><TeamLogo abbr={p.team} size={18} /></span> : null}
                </span>
                <h3>{p.name}</h3>
                <PosBadge pos={p.pos} />
                {p.number != null ? <span className="nhlx-pc-num">#{p.number}</span> : null}
              </div>
              <div className="nhlx-pc-stat">
                <small>Shot form</small>
                <b className={p.form.shots === 'Hot' ? 'is-good' : p.form.shots === 'Cold' ? 'is-bad' : ''}>{p.form.shots}</b>
              </div>
              <div className="nhlx-pc-stat">
                <small>Graph avg</small>
                <b className="is-accent">{graphAvg == null ? '—' : num(graphAvg, 1)}</b>
              </div>
              <div className="nhlx-pc-stat">
                <small>Avg TOI</small>
                <b className="is-accent">{p.stats.season?.gp ? num(p.stats.season.toi, 1) : '—'}</b>
              </div>
            </div>

            <div className="nhlx-pc-body">
              <section className="nhlx-pc-pane nhlx-pc-left">
                <div className="nhlx-pc-markets" role="tablist" aria-label="Market">
                  {MARKETS.map(([k, l]) => {
                    const r = p.hits?.[k]?.[lines[k]]?.[span]?.rate;
                    return (
                      <button key={k} type="button" role="tab" aria-selected={market === k} className={`nhlx-pc-market${market === k ? ' is-active' : ''}`} onClick={() => setMarket(k)}>
                        {l} <Pct rate={r} />
                      </button>
                    );
                  })}
                </div>

                <div className="nhlx-pc-prop">
                  <span className="nhlx-pc-over">OVER</span>
                  <b>{line} {def[2]}</b>
                  <label className="nhlx-sel nhlx-pc-line">
                    <small>Line</small>
                    <select value={line} onChange={(e) => setLines({ ...lines, [market]: Number(e.target.value) })}>
                      {def[4].map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </label>
                </div>

                <div className="nhlx-pc-chips">
                  {req.opp ? (
                    <span className="nhlx-pc-chip"><b>{req.venue === 'H' ? 'Home' : req.venue === 'A' ? 'Away' : 'Next'}</b> {req.venue === 'A' ? '@' : 'vs'} <TeamLogo abbr={req.opp} size={18} /></span>
                  ) : p.team ? <span className="nhlx-pc-chip"><TeamLogo abbr={p.team} size={18} /> <b>{teamName(p.team) || p.team}</b></span> : null}
                  <span className="nhlx-pc-chip"><b>GP</b> {p.gp}</span>
                  {hit?.[span] ? <span className="nhlx-pc-chip"><b>Hit</b> {hit[span].hits}/{hit[span].gp}</span> : null}
                  {statKey === 'sog' && (
                    <label className="nhlx-pc-check">
                      <input type="checkbox" checked={showTotal} onChange={(e) => setShowTotal(e.target.checked)} /> Total shots
                    </label>
                  )}
                </div>

                {games.length ? (
                  <Histogram games={games} statKey={statKey} line={line} avgValue={graphAvg} showTotal={showTotal} unit={def[2]} />
                ) : (
                  <div className="nhlx-empty">{span === 'h2h' ? `No stored games vs ${req.opp} yet.` : 'No stored games for this player yet.'}</div>
                )}

                <div className="nhlx-rates">
                  {splits.map(([k, label]) => {
                    const h = hit?.[k];
                    return <RateTile key={k} label={label} hit={h} active={span === k} disabled={!h?.gp} onClick={() => setSpan(k)} />;
                  })}
                </div>
                {span === 'season' && p.gp > games.length ? <p className="nhlx-auto-meta nhlx-pc-note">Graph shows the last {games.length} of {p.gp} games; the tile counts all of them.</p> : null}

                <PfTable className="nhlx-pc-stats">
                  <thead><tr><th>Split</th>{STAT_COLS.map(([k, l]) => <th key={k}>{l}{k !== 'gp' && k !== 'toi' ? '/G' : ''}</th>)}</tr></thead>
                  <tbody>
                    {[['l5', 'Last 5'], ['l10', 'Last 10'], ['l20', 'Last 20'], ['season', 'Season'], ['home', 'Home'], ['away', 'Away'], ...(req.opp ? [['h2h', `vs ${req.opp}`]] : [])].map(([k, l]) => {
                      const s = p.stats[k];
                      return (
                        <tr key={k} className={span === k || (k === 'h2h' && span === 'h2h') ? 'is-active' : ''}>
                          <td><b>{l}</b></td>
                          {STAT_COLS.map(([c]) => <td key={c}>{c === 'gp' ? s.gp : s.gp ? num(s[c], c === 'toi' ? 1 : 2) : '—'}</td>)}
                        </tr>
                      );
                    })}
                    {[['propfinder', (r) => `PropFinder ${r.season}-${String(r.season + 1).slice(2)}`], ['propfinderL5', () => 'PropFinder last 5'], ['propfinderL5Home', () => 'PropFinder last 5 home'], ['propfinderL5Away', () => 'PropFinder last 5 away']].map(([k, label]) => p[k] && (
                      <tr key={k}>
                        <td><b>{label(p[k])}</b><small>all strengths · as of {p[k].asOf}{p[k].status ? ` · ${p[k].status}` : ''}</small></td>
                        {STAT_COLS.map(([c]) => <td key={c}>{c === 'gp' ? p[k].gp : p[k][c] == null ? '—' : num(p[k][c], c === 'toi' ? 1 : 2)}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </PfTable>
              </section>

              <section className="nhlx-pc-pane nhlx-pc-right">
                {req.opp && p.defense ? (
                  <DefenseAllowed abbr={req.opp} data={p.defense} pos={p.pos} />
                ) : (
                  <div className="nhlx-empty">{req.opp ? `No PropFinder defense table for ${req.opp} yet.` : 'Open this player from a slate to see what tonight’s opponent allows.'}</div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function PlayerCardHost({ children }) {
  const [req, setReq] = useState(null);
  const open = useCallback((r) => { if (r?.id) setReq({ id: r.id, opp: r.opp || null, venue: r.venue || null }); }, []);
  const close = useCallback(() => setReq(null), []);
  return (
    <PlayerCardContext.Provider value={open}>
      {children}
      {req && <Card req={req} onClose={close} />}
    </PlayerCardContext.Provider>
  );
}
