'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Headshot, TeamLogo } from './media';

// Any table can open a player's profile: const open = usePlayerCard(); open({ id, opp, venue }).
const PlayerCardContext = createContext(() => {});
export const usePlayerCard = () => useContext(PlayerCardContext);

const MARKETS = [
  ['goals', 'Goals', 'g', [0.5, 1.5], 0.5],
  ['shots', 'Shots', 'sog', [1.5, 2.5, 3.5, 4.5], 2.5],
  ['points', 'Points', 'pts', [0.5, 1.5], 0.5],
  ['assists', 'Assists', 'a', [0.5, 1.5], 0.5],
];
const SPLITS = [['season', 'Season'], ['h2h', 'H2H'], ['tonight', null], ['l5', 'L5'], ['l10', 'L10'], ['l20', 'L20']];
const STAT_COLS = [['gp', 'GP'], ['toi', 'TOI'], ['g', 'G'], ['a', 'A'], ['pts', 'PTS'], ['sog', 'SOG'], ['icf', 'iCF'], ['iff', 'iFF'], ['iscf', 'iSCF'], ['ihdcf', 'iHDCF']];
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));

export function FormChip({ tag, small }) {
  if (!tag) return null;
  const cls = tag === 'Hot' ? 'is-hot' : tag === 'Cold' ? 'is-cold' : '';
  return <span className={`nhlx-form ${cls}${small ? ' is-small' : ''}`}>{tag === 'Hot' ? '🔥 ' : tag === 'Cold' ? '🧊 ' : ''}{tag}</span>;
}

function RateTile({ label, hit, tone }) {
  const rate = hit?.rate;
  const cls = rate == null ? '' : rate >= 0.6 ? 'is-good' : rate < 0.45 ? 'is-bad' : 'is-mid';
  return (
    <div className={`nhlx-rate ${cls}`}>
      <b>{hit?.gp ? `${hit.hits}/${hit.gp}` : '—'}</b>
      <span>{rate == null ? '' : `${Math.round(rate * 100)}%`}</span>
      <small>{label}{tone ? ` · ${tone}` : ''}</small>
    </div>
  );
}

/** Per-game columns against the line: green over, red under, avg as a hairline. */
function Histogram({ games, statKey, line, avgValue }) {
  const [hover, setHover] = useState(null);
  const W = 720; const H = 190; const padL = 26; const padB = 34; const padT = 14;
  const max = Math.max(line + 1, ...games.map((g) => Number(g[statKey]) || 0));
  const innerW = W - padL - 8;
  const slot = innerW / Math.max(games.length, 1);
  const bw = Math.min(24, Math.max(6, slot - 4));
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const ticks = Array.from({ length: Math.floor(max) + 1 }, (_, i) => i).filter((t) => max <= 8 || t % 2 === 0);
  return (
    <div className="nhlx-hist">
      <div className="nhlx-hist-scroll">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${statKey} per game, last ${games.length} games`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - 8} y1={y(t)} y2={y(t)} className="nhlx-hist-grid" />
            <text x={padL - 6} y={y(t) + 4} className="nhlx-hist-tick" textAnchor="end">{t}</text>
          </g>
        ))}
        <line x1={padL} x2={W - 8} y1={y(line)} y2={y(line)} className="nhlx-hist-line" />
        {avgValue != null && <line x1={padL} x2={W - 8} y1={y(avgValue)} y2={y(avgValue)} className="nhlx-hist-avg" />}
        {games.map((g, i) => {
          const v = Number(g[statKey]) || 0;
          const x = padL + i * slot + (slot - bw) / 2;
          const top = y(v);
          const h = Math.max(0, y(0) - top);
          const over = v > line;
          return (
            <g key={`${g.gameId}-${i}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={padL + i * slot} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
              {v > 0 ? (
                <path d={`M${x},${y(0)} v${-(h - Math.min(4, h))} q0,-${Math.min(4, h)} ${Math.min(4, bw / 2)},-${Math.min(4, h)} h${bw - 2 * Math.min(4, bw / 2)} q${Math.min(4, bw / 2)},0 ${Math.min(4, bw / 2)},${Math.min(4, h)} v${h - Math.min(4, h)} z`} className={over ? 'nhlx-hist-over' : 'nhlx-hist-under'} />
              ) : (
                <rect x={x} y={y(0) - 2} width={bw} height={2} className="nhlx-hist-under" />
              )}
              {(games.length <= 20 || hover === i) && <text x={x + bw / 2} y={top - 5} className="nhlx-hist-val" textAnchor="middle">{v}</text>}
              {(games.length <= 20 || i % 2 === 0) && (
                <text x={x + bw / 2} y={H - padB + 13} className="nhlx-hist-x" textAnchor="middle">{g.venue === 'H' ? 'vs' : '@'}{g.opp}</text>
              )}
              {(games.length <= 20 || i % 2 === 0) && (
                <text x={x + bw / 2} y={H - padB + 25} className="nhlx-hist-x nhlx-hist-date" textAnchor="middle">{g.date.slice(5)}</text>
              )}
            </g>
          );
        })}
      </svg>
      </div>
      {hover != null && games[hover] && (
        <div className="nhlx-hist-tip">
          <b>{games[hover].date} · {games[hover].venue === 'H' ? 'vs' : '@'} {games[hover].opp}</b>
          <span>{games[hover].g} G · {games[hover].a} A · {games[hover].sog} SOG · {games[hover].iscf} iSCF · {num(games[hover].toi)} min · {games[hover].pos}</span>
        </div>
      )}
      <div className="nhlx-hist-legend">
        <span><i className="nhlx-key nhlx-key-over" /> Over the line</span>
        <span><i className="nhlx-key nhlx-key-under" /> Under</span>
        <span><i className="nhlx-key nhlx-key-line" /> Line {line}</span>
        <span><i className="nhlx-key nhlx-key-avg" /> Season average{avgValue != null ? ` ${num(avgValue, 2)}` : ''}</span>
      </div>
    </div>
  );
}

function Card({ req, onClose }) {
  const [p, setP] = useState(null);
  const [err, setErr] = useState('');
  const [market, setMarket] = useState('goals');
  const [line, setLine] = useState(0.5);
  const [span, setSpan] = useState(20);

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
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const def = MARKETS.find((m) => m[0] === market);
  const statKey = def[2];
  const games = useMemo(() => (p ? p.games.slice(-span) : []), [p, span]);
  const hits = p?.hits?.[market]?.[line];

  return (
    <div className="nhlx-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="nhlx-modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="nhlx-modal-close" onClick={onClose} aria-label="Close">×</button>
        {err && <div className="nhlx-alert">⚠ Couldn’t load this player: {err}</div>}
        {!p && !err && <div className="nhlx-empty">Loading player…</div>}
        {p && (
          <>
            <div className="nhlx-pc-head">
              <Headshot id={p.id} size={64} />
              <div className="nhlx-pc-title">
                <h3>{p.name} <span className="nhlx-chip">{p.pos}</span>{p.number != null ? <span className="nhlx-chip">#{p.number}</span> : null}</h3>
                <div className="nhlx-pc-sub">
                  <TeamLogo abbr={p.team} size={20} /> {p.team}
                  {req.opp ? <> · tonight {req.venue === 'H' ? 'vs' : '@'} <TeamLogo abbr={req.opp} size={20} /> {req.opp}</> : null}
                  {' · '}{p.gp} games stored
                </div>
              </div>
              <div className="nhlx-pc-form">
                <div><small>Shots</small><FormChip tag={p.form.shots} /></div>
                <div><small>Goals</small><FormChip tag={p.form.goals} /></div>
              </div>
            </div>

            <div className="nhlx-pc-controls">
              <div className="nhlx-tabs" role="tablist">
                {MARKETS.map(([k, l, , , d]) => (
                  <button key={k} type="button" role="tab" aria-selected={market === k} className={`nhlx-tab${market === k ? ' is-active' : ''}`} onClick={() => { setMarket(k); setLine(d); }}>{l}</button>
                ))}
              </div>
              <div className="nhlx-auto-actions">
                <label className="nhlx-auto-meta">Over
                  <select className="nhlx-input nhlx-input-sm" value={line} onChange={(e) => setLine(Number(e.target.value))}>
                    {def[3].map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </label>
                <select className="nhlx-input nhlx-input-sm" value={span} onChange={(e) => setSpan(Number(e.target.value))} aria-label="Games shown">
                  {[10, 20, 40].map((n) => <option key={n} value={n}>Last {n}</option>)}
                </select>
              </div>
            </div>

            <div className="nhlx-rates">
              {SPLITS.map(([k, label]) => {
                if (k === 'h2h' && !req.opp) return null;
                if (k === 'tonight' && !req.venue) return null;
                const lbl = k === 'tonight' ? (req.venue === 'H' ? 'Home' : 'Away') : k === 'h2h' ? `vs ${req.opp}` : label;
                return <RateTile key={k} label={lbl} hit={hits?.[k]} />;
              })}
            </div>

            {games.length ? (
              <Histogram games={games} statKey={statKey} line={line} avgValue={p.stats.season?.[statKey]} />
            ) : (
              <div className="nhlx-empty">No stored games for this player yet.</div>
            )}

            <div className="nhlx-db-table-wrap" style={{ marginTop: 16 }}>
              <table className="nhlx-db-table nhlx-pc-stats">
                <thead><tr><th>Split</th>{STAT_COLS.map(([k, l]) => <th key={k}>{l}{k !== 'gp' && k !== 'toi' ? '/G' : ''}</th>)}</tr></thead>
                <tbody>
                  {[['l5', 'Last 5'], ['l10', 'Last 10'], ['l20', 'Last 20'], ['season', 'Season'], ['home', 'Home'], ['away', 'Away'], ...(req.opp ? [['h2h', `vs ${req.opp}`]] : [])].map(([k, l]) => {
                    const s = p.stats[k];
                    return (
                      <tr key={k}>
                        <td><b>{l}</b></td>
                        {STAT_COLS.map(([c]) => <td key={c}>{c === 'gp' ? s.gp : s.gp ? num(s[c], c === 'toi' ? 1 : 2) : '—'}</td>)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
