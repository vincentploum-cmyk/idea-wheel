'use client';

import { useEffect, useRef, useState } from 'react';
import { Headshot, TeamLogo } from './media';
import { usePlayerCard } from './PlayerCard';

// One team's skaters on a rink, grouped into the four position zones (LW, C,
// RW up front; D at the back). Each zone is tinted by what tonight's opponent
// allows to that position at this venue: green = permissive third of the
// league, amber = middle, red = stingiest third. Every chip carries the
// player's projected shots and goals from the slate (player rate × defense ratio).
export const ZONES = ['LW', 'C', 'RW', 'D'];
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));

/** League rank (1 = most permissive) → 'soft' | 'mid' | 'tough' | 'none'. */
export function zoneTone(rank, teams) {
  if (!rank || !teams) return 'none';
  const third = Math.ceil(teams / 3);
  if (rank <= third) return 'soft';
  if (rank > teams - third) return 'tough';
  return 'mid';
}

function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      setSize((s) => (Math.abs(s.w - width) < 1 && Math.abs(s.h - height) < 1 ? s : { w: width, h: height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/**
 * Rink markings in pixels for the measured box. `a` runs 0 (own goal) → 1
 * (attacking goal): to the right on a wide rink, up on a tall one.
 */
function RinkLines({ w, h, horizontal }) {
  if (!w || !h) return null;
  const L = horizontal ? w : h;
  const S = horizontal ? h : w;
  const pt = (a, c) => (horizontal ? [a * L, c * S] : [c * S, (1 - a) * L]);
  const line = (a, cls) => { const [x1, y1] = pt(a, 0); const [x2, y2] = pt(a, 1); return <line key={`${a}-${cls}`} x1={x1} y1={y1} x2={x2} y2={y2} className={cls} />; };
  const circle = (a, c, r, cls) => { const [cx, cy] = pt(a, c); return <circle key={`${a}-${c}-${cls}`} cx={cx} cy={cy} r={r} className={cls} />; };
  const R = 0.075 * L; // 15 ft on a 200 ft rink
  const dots = [[0.155, 0.26], [0.155, 0.74], [0.845, 0.26], [0.845, 0.74]];
  const crease = (a) => {
    const [gx, gy] = pt(a, 0.5);
    const r = 0.03 * L;
    const dir = (a < 0.5 ? 1 : -1) * (horizontal ? 1 : -1);
    const d = horizontal
      ? `M${gx},${gy - r} A${r},${r} 0 0 ${dir > 0 ? 1 : 0} ${gx},${gy + r}`
      : `M${gx - r},${gy} A${r},${r} 0 0 ${dir > 0 ? 0 : 1} ${gx + r},${gy}`;
    return <path key={`crease-${a}`} d={d} className="nhlx-rink-crease" />;
  };
  return (
    <svg className="nhlx-rink-lines" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {line(0.055, 'nhlx-rink-goal')}
      {line(0.945, 'nhlx-rink-goal')}
      {line(0.375, 'nhlx-rink-blue')}
      {line(0.625, 'nhlx-rink-blue')}
      {line(0.5, 'nhlx-rink-red')}
      {circle(0.5, 0.5, R, 'nhlx-rink-circle')}
      {circle(0.5, 0.5, 2.5, 'nhlx-rink-dot')}
      {dots.map(([a, c]) => circle(a, c, R, 'nhlx-rink-circle'))}
      {dots.map(([a, c]) => circle(a, c, 2.5, 'nhlx-rink-dot'))}
      {crease(0.055)}
      {crease(0.945)}
    </svg>
  );
}

const lastName = (name) => { const parts = String(name || '').trim().split(' '); return parts.length > 1 ? parts.slice(1).join(' ') : name; };

function Chip({ p, minGp, compact }) {
  const open = usePlayerCard();
  const thin = (p.gp || 0) < minGp;
  const title = `${p.name} · ${p.pos}${p.line ? ` L${p.line}` : ''} · ${p.gp || 0} GP · ${num(p.sog)} SOG/G, ${num(p.g, 2)} G/G`
    + (p.shotEdge != null ? ` · shot edge ${p.shotEdge > 0 ? '+' : ''}${p.shotEdge}%` : '')
    + (p.goalEdge != null ? ` · goal edge ${p.goalEdge > 0 ? '+' : ''}${p.goalEdge}%` : '');
  return (
    <button
      type="button"
      className={`nhlx-rink-chip${p.inLineup ? '' : ' is-out'}${p.id ? '' : ' is-static'}`}
      title={title}
      onClick={() => p.id && open({ id: p.id, opp: p.opp, venue: p.venue })}
    >
      <Headshot id={p.id} size={22} />
      <span className="nhlx-rink-name">{p.line ? <em>L{p.line}</em> : null}{compact ? lastName(p.name) : p.name}</span>
      {thin || p.projSog == null ? (
        <span className="nhlx-rink-nums is-none" title={thin ? `Fewer than ${minGp} stored games` : 'No stored games'}>—</span>
      ) : (
        <span className="nhlx-rink-nums"><b>{num(p.projSog)}</b><i>SOG</i><b>{num(p.projG, 2)}</b><i>G</i></span>
      )}
    </button>
  );
}

function Zone({ pos, side, teamCount, skaters, minGp, dim, compact }) {
  const d = side.defense?.[pos];
  const s = d?.season;
  const r = d?.rank || {};
  const tone = zoneTone(r.sog, teamCount);
  const list = [...skaters].sort((a, b) => (a.line || 9) - (b.line || 9) || (b.shotScore || 0) - (a.shotScore || 0));
  return (
    <div className={`nhlx-rink-zone is-${pos.toLowerCase()} is-${tone}${dim ? ' is-dim' : ''}`}>
      <div className="nhlx-rink-zone-head">
        <b>{pos}</b>
        {s?.gp ? (
          <small>{side.opp} allows <b>{num(s.sog)}</b> SOG{r.sog ? <i>#{r.sog}</i> : null} · <b>{num(s.g, 2)}</b> G{r.g ? <i>#{r.g}</i> : null}</small>
        ) : <small>no defense data for {side.opp} yet</small>}
      </div>
      <div className="nhlx-rink-chips">
        {list.length ? list.map((p) => <Chip key={`${p.team}-${p.name}`} p={p} minGp={minGp} compact={compact} />) : <span className="nhlx-auto-meta">—</span>}
      </div>
    </div>
  );
}

/** One side of a game: `side` is an entry of a slate game's `sides`. */
export function Rink({ side, teamCount, posFilter = '', minGp = 1 }) {
  const ref = useRef(null);
  const { w, h } = useSize(ref);
  const horizontal = w === 0 || w >= 560;
  const defVenue = side.venue === 'A' ? 'home' : 'away';
  const byPos = Object.fromEntries(ZONES.map((z) => [z, side.skaters.filter((p) => p.pos === z)]));
  return (
    <section className="nhlx-rink-card" aria-label={`${side.team} on the rink`}>
      <div className="nhlx-rink-head">
        <TeamLogo abbr={side.team} size={26} />
        <div>
          <b>{side.team} <small>{side.venue === 'H' ? 'home' : 'away'}</small></b>
          <small>Attacking {horizontal ? 'to the right' : 'upwards'} · zones show what {side.opp} allows at {defVenue} to each position · rank 1 = most permissive of {teamCount} · positions from {side.source === 'lineup' ? 'the projected lineup' : 'the roster (no lineup yet)'}</small>
        </div>
      </div>
      <div
        ref={ref}
        className={`nhlx-rink${horizontal ? '' : ' is-vertical'}`}
        style={{ borderRadius: horizontal ? '14% / 33%' : '33% / 14%' }}
      >
        <RinkLines w={w} h={h} horizontal={horizontal} />
        <div className="nhlx-rink-zones">
          {ZONES.map((z) => (
            <Zone key={z} pos={z} side={side} teamCount={teamCount} skaters={byPos[z]} minGp={minGp} dim={!!posFilter && posFilter !== z} compact={!horizontal && z !== 'D'} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function RinkLegend() {
  return (
    <p className="nhlx-rink-legend nhlx-auto-meta">
      <span><i className="is-soft" /> favourable: the opponent allows the most shots to that position (top third)</span>
      <span><i className="is-mid" /> neutral</span>
      <span><i className="is-tough" /> stingy: bottom third</span>
      <span>numbers on a player = projected SOG and goals tonight (own rate × opponent ratio)</span>
    </p>
  );
}
