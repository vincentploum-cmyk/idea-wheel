'use client';

import { useMemo, useState } from 'react';
import { TeamLogo } from './media';
import { usePlayerCard } from './PlayerCard';
import { PropfinderDefense } from './Propfinder';

// Tactical board: one team's whole lineup on a full vertical rink (85 × 200 ft,
// attacking goal at the top). Forward lines stack in the attacking half with
// LW, C and RW left to right; defense pairs sit in the defending half. Four
// bands of ice (LW, C, RW lanes and the D half) are tinted by what tonight's
// opponent allows to that position at this venue: green = permissive third of
// the league, amber = middle, red = stingiest third. Every chip carries the
// slate's projected shots and goals (player rate × defense ratio).
export const ZONES = ['LW', 'C', 'RW', 'D'];
const F_POS = ['LW', 'C', 'RW'];
const F_X = { LW: 19, C: 50, RW: 81 };       // % of rink width
const F_Y = [20, 43, 66, 89];                  // forward line centres, feet from the top
const D_Y = [118, 143, 168];                   // defense pair centres
const D_X = [31, 69];
const pct = (ft) => ft / 2;                    // 200 ft → 100 %
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const et = (iso) => (iso ? `${new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET` : null);

/** "lines from … · NHL.com lineup updated 5:30 PM ET · captured 7:20 PM ET". */
function SourceLine({ side }) {
  const m = side.sourceMeta || {};
  const gdt = m.handle ? <>the beat writers via GameDayTweets (<a href={m.url || 'https://www.gamedaytweets.com/lines'} target="_blank" rel="noopener noreferrer">@{m.handle}</a>{m.at ? `, ${et(m.at)}` : m.date ? `, ${m.date}` : ''})</> : null;
  const nhl = m.nhlUpdated ? `NHL.com lineup updated ${et(m.nhlUpdated)}` : null;
  if (side.source === 'gamedaytweets') return <>lines from {gdt}{nhl ? ` · ${nhl}` : ''}{m.capturedAt ? ` · captured ${et(m.capturedAt)}` : ''}</>;
  if (side.source === 'lineup') return <>lines from the NHL.com projected lineup{nhl ? ` (updated ${et(m.nhlUpdated)})` : ''}{gdt ? <> · older tweet from {gdt}</> : ''}{m.capturedAt ? ` · captured ${et(m.capturedAt)}` : ''}</>;
  return <>lines from the roster, ordered by projected shots (no lines yet{m.capturedAt ? `, last checked ${et(m.capturedAt)}` : ''})</>;
}

/** League rank (1 = most permissive) → 'soft' | 'mid' | 'tough' | 'none'. */
export function zoneTone(rank, teams) {
  if (!rank || !teams) return 'none';
  const third = Math.ceil(teams / 3);
  if (rank <= third) return 'soft';
  if (rank > teams - third) return 'tough';
  return 'mid';
}

/** Last name only; the chip's title carries the full name. */
const shortName = (name) => {
  const parts = String(name || '').trim().split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : name;
};

const byLine = (a, b) => (a.line || 9) - (b.line || 9) || (b.shotScore || 0) - (a.shotScore || 0) || a.name.localeCompare(b.name);

/**
 * Place skaters on the board: forwards into 4 line rows per lane, defense into
 * 3 pairs. A skater's frozen/projected line wins; roster-only players (no line)
 * fill the remaining slots by projected shots. Whoever is left goes under the rink.
 */
export function layoutSide(skaters) {
  const placed = [];
  const extras = [];
  for (const pos of F_POS) {
    const list = skaters.filter((p) => p.pos === pos).sort(byLine);
    const rows = new Array(F_Y.length).fill(null);
    for (const p of list) {
      let r = p.line && p.line <= rows.length && !rows[p.line - 1] ? p.line - 1 : rows.indexOf(null);
      if (r < 0) { extras.push(p); continue; }
      rows[r] = p;
      placed.push({ p, x: F_X[pos], y: F_Y[r] });
    }
  }
  const d = skaters.filter((p) => p.pos === 'D').sort(byLine);
  const slots = new Array(D_Y.length * 2).fill(null); // pair-major: [p1L, p1R, p2L, p2R, ...]
  for (const p of d) {
    let k = -1;
    if (p.line && p.line <= D_Y.length) k = [2 * (p.line - 1), 2 * (p.line - 1) + 1].find((i) => !slots[i]) ?? -1;
    if (k < 0) k = slots.indexOf(null);
    if (k < 0) { extras.push(p); continue; }
    slots[k] = p;
    placed.push({ p, x: D_X[k % 2], y: D_Y[Math.floor(k / 2)] });
  }
  return { placed, extras: extras.sort(byLine) };
}

/** NHL rink markings in feet, drawn vertically (viewBox 85 × 200, attacking goal at the top). */
function RinkMarkings({ clipId, tones }) {
  const circle = (cx, cy) => (
    <g key={`${cx}-${cy}`}>
      <circle cx={cx} cy={cy} r="15" className="nhlx-rk-red-line" />
      <circle cx={cx} cy={cy} r="1" className="nhlx-rk-red-fill" />
      <path d={`M${cx - 15} ${cy - 3}h-2M${cx - 15} ${cy + 3}h-2M${cx + 15} ${cy - 3}h2M${cx + 15} ${cy + 3}h2`} className="nhlx-rk-red-line" />
      <path d={`M${cx - 0.75} ${cy - 2}v-4M${cx - 0.75} ${cy + 2}v4M${cx + 0.75} ${cy - 2}v-4M${cx + 0.75} ${cy + 2}v4`} className="nhlx-rk-red-line is-thin" />
    </g>
  );
  return (
    <svg className="nhlx-rk-svg" viewBox="0 0 85 200" aria-hidden="true">
      <defs><clipPath id={clipId}><rect width="85" height="200" rx="28" /></clipPath></defs>
      <rect width="85" height="200" rx="28" className="nhlx-rk-ice" />
      <g clipPath={`url(#${clipId})`}>
        {/* Matchup bands: the three forward lanes over the attacking half, the D half below. */}
        <rect x="0" y="0" width="28.33" height="100" className={`nhlx-rk-band is-${tones.LW}`} />
        <rect x="28.33" y="0" width="28.34" height="100" className={`nhlx-rk-band is-${tones.C}`} />
        <rect x="56.67" y="0" width="28.33" height="100" className={`nhlx-rk-band is-${tones.RW}`} />
        <rect x="0" y="100" width="85" height="100" className={`nhlx-rk-band is-${tones.D}`} />
        <path d="M28.33 0V100M56.67 0V100M0 100H85" className="nhlx-rk-band-line" />
        {/* Trapezoids, goal lines, blue lines, centre line. */}
        <path d="M31.5 11L28.5 0M53.5 11L56.5 0M31.5 189L28.5 200M53.5 189L56.5 200" className="nhlx-rk-red-line" />
        <rect x="0" y="10.8" width="85" height="0.35" className="nhlx-rk-red-fill" />
        <rect x="0" y="188.85" width="85" height="0.35" className="nhlx-rk-red-fill" />
        <rect x="0" y="74.5" width="85" height="1" className="nhlx-rk-blue-fill" />
        <rect x="0" y="124.5" width="85" height="1" className="nhlx-rk-blue-fill" />
        <rect x="0" y="99.5" width="85" height="1" className="nhlx-rk-red-fill" />
        <circle cx="42.5" cy="100" r="15" className="nhlx-rk-blue-line" />
        <circle cx="42.5" cy="100" r="0.6" className="nhlx-rk-blue-fill" />
        {[[20.5, 31], [64.5, 31], [20.5, 169], [64.5, 169]].map(([x, y]) => circle(x, y))}
        {[[20.5, 80], [64.5, 80], [20.5, 120], [64.5, 120]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" className="nhlx-rk-red-fill" />)}
        {/* Creases and goal frames. */}
        <path d="M36.5 11A6 6 0 0 0 48.5 11Z" className="nhlx-rk-crease" />
        <path d="M36.5 189A6 6 0 0 1 48.5 189Z" className="nhlx-rk-crease" />
        <rect x="39.5" y="7.7" width="6" height="3.1" rx="1" className="nhlx-rk-red-line is-goal" />
        <rect x="39.5" y="189.2" width="6" height="3.1" rx="1" className="nhlx-rk-red-line is-goal" />
      </g>
      <rect width="85" height="200" rx="28" className="nhlx-rk-board" />
    </svg>
  );
}

function Chip({ p, x, y, minGp, actual, played }) {
  const open = usePlayerCard();
  const thin = (p.gp || 0) < minGp;
  const m = p.model;
  // Probability as "42%" (not `pct`, which converts rink feet to % and places the chip below).
  const prob = (v) => (v == null ? null : `${Math.round(v * 100)}%`);
  const modelText = m ? ` · model: ${num(m.sog)} SOG, ${num(m.g, 2)} G${m.p3s != null ? `, 3+ SOG ${prob(m.p3s)}` : ''}${m.p1g != null ? `, 1+ G ${prob(m.p1g)}` : ''}${m.gateOpen === false ? ' (gate closed)' : ''}` : '';
  // Finished game: the box score at the frozen position, with the projection kept in the title.
  const result = played ? (actual ? ` · played: ${actual.sog} SOG, ${actual.g} G, ${actual.a} A in ${num(actual.toi)} min` : ' · did not play') : '';
  const title = `${p.name} · ${p.pos}${p.line ? ` L${p.line}` : ''} · ${p.gp || 0} GP · ${num(p.sog)} SOG/G, ${num(p.g, 2)} G/G${modelText}${p.projSog != null ? ` · matchup read ${num(p.projSog)} SOG, ${num(p.projG, 2)} G` : ''}${result}`
    + (p.shotEdge != null ? ` · shot edge ${p.shotEdge > 0 ? '+' : ''}${p.shotEdge}%` : '')
    + (p.goalEdge != null ? ` · goal edge ${p.goalEdge > 0 ? '+' : ''}${p.goalEdge}%` : '')
    + (p.inLineup ? '' : ' · not in the projected lineup');
  return (
    <button
      type="button"
      className={`nhlx-rk-chip${p.inLineup ? '' : ' is-out'}${p.id ? '' : ' is-static'}`}
      style={{ left: `${x}%`, top: `${pct(y)}%` }}
      title={title}
      onClick={() => p.id && open({ id: p.id, opp: p.opp, venue: p.venue })}
    >
      <span className="nhlx-rk-num">{p.number ?? p.pos}</span>
      <span className="nhlx-rk-meta">
        <b className="nhlx-rk-name">{shortName(p.name)}</b>
        {played ? (actual
          ? <span className={`nhlx-rk-stat is-actual${(m?.sog ?? p.projSog) != null && actual.sog >= (m?.sog ?? p.projSog) ? ' is-over' : ''}`}><em>{actual.sog}</em> SOG · <em>{actual.g}</em> G{actual.a ? <> · <em>{actual.a}</em> A</> : null}{m?.sog != null ? <i> m {num(m.sog)}</i> : p.projSog != null ? <i> p {num(p.projSog)}</i> : null}</span>
          : <span className="nhlx-rk-stat">did not play</span>)
          : m?.sog != null
            ? <span className={`nhlx-rk-stat is-model${m.gateOpen === false ? ' is-closed' : ''}`}><em>{num(m.sog)}</em> SOG · <em>{num(m.g, 2)}</em> G</span>
            : thin || p.projSog == null
              ? <span className="nhlx-rk-stat"><em>{p.pos}</em> · {p.gp ? `${p.gp} GP` : 'no games'}</span>
              : <span className="nhlx-rk-stat is-read"><em>{num(p.projSog)}</em> SOG · <em>{num(p.projG, 2)}</em> G</span>}
      </span>
    </button>
  );
}

// The toggle above each rink: which window of the opponent's defense tints the ice.
const WINDOWS = [['home', 'Home'], ['away', 'Away'], ['l5', 'L5'], ['l10', 'L10'], ['l5home', 'L5 home'], ['l5away', 'L5 away']];
const WINDOW_TEXT = { home: 'at home', away: 'away', l5: 'over its last 5 games', l10: 'over its last 10 games', l5home: 'over its last 5 home games', l5away: 'over its last 5 away games' };

function BandLabel({ pos, d, opp, view, teamCount, x, y }) {
  const r = d?.rank || {};
  const s = d?.season;
  const n = d?.teamCount || teamCount;
  const tone = zoneTone(r.sog, n);
  const from = d?.source === 'propfinder' ? ` · PropFinder ${d.seasonLabel} (last season, until ${opp} has enough stored games)` : ` · this season's stored games (${s?.gp ?? 0})`;
  const title = s?.gp ? `${opp} allows ${num(s.sog)} SOG (#${r.sog ?? '–'}) and ${num(s.g, 2)} goals (#${r.g ?? '–'}) per game to ${pos} ${WINDOW_TEXT[view]} · rank 1 = most permissive of ${n}${from}` : `No defense data for ${opp} ${WINDOW_TEXT[view]} yet`;
  return (
    <div className={`nhlx-rk-zone is-${tone}`} style={{ left: `${x}%`, top: `${pct(y)}%` }} title={title}>
      <b>{pos}</b>{s?.gp ? <span>#{r.sog ?? '–'} SOG · #{r.g ?? '–'} G{d?.source === 'propfinder' ? <i title={`PropFinder ${d.seasonLabel}`}>PF</i> : null}</span> : <span>no data</span>}
    </div>
  );
}

/** One side of a game: `side` is an entry of a slate game's `sides`. */
export function Rink({ side, teamCount, posFilter = '', minGp = 1, log = null, modelRun = null }) {
  const { placed, extras } = useMemo(() => layoutSide(side.skaters), [side.skaters]);
  // Finished game: this team's box-score rows, by player id and by name.
  const actual = useMemo(() => {
    if (!log?.skaters) return null;
    const m = {};
    for (const r of log.skaters) if (r.team === side.team) { if (r.id != null) m[`id:${r.id}`] = r; m[`nm:${String(r.name).toLowerCase()}`] = r; }
    return m;
  }, [log, side.team]);
  const actualFor = (p) => (actual ? actual[`id:${p.id}`] || actual[`nm:${String(p.name).toLowerCase()}`] || null : null);
  const score = log?.score ? (side.venue === 'H' ? [log.score.home, log.score.away] : [log.score.away, log.score.home]) : null;
  // Default window = where the opponent actually plays tonight (its home table when we're away).
  const defaultView = side.venue === 'A' ? 'home' : 'away';
  const [view, setView] = useState(null);
  const v = view || defaultView;
  const defAt = (pos) => side.defense?.[pos]?.windows?.[v] ?? (v === defaultView ? side.defense?.[pos] : null) ?? null;
  const tones = Object.fromEntries(ZONES.map((z) => [z, posFilter && posFilter !== z ? 'none' : zoneTone(defAt(z)?.rank?.sog, defAt(z)?.teamCount || teamCount)]));
  const clipId = `rink-${side.team}-${side.opp}`;
  const open = usePlayerCard();
  return (
    <section className="nhlx-rk-card" aria-label={`${side.team} lineup on the rink`}>
      <div className="nhlx-rk-head">
        <TeamLogo abbr={side.team} size={28} />
        <div>
          <b>{side.team} <small>{side.venue === 'H' ? 'home' : 'away'}{score ? ` · final ${score[0]}–${score[1]} vs ${side.opp} · chips show the game's shots, goals, assists` : ' · attacking upwards'}</small></b>
          <small className="nhlx-rk-numsrc">{modelRun ? <>Numbers on the chips: <b>the model</b>, {modelRun.source === 'auto' ? 'run automatically' : 'run'} {et(modelRun.createdAt)}{modelRun.players ? ` (${modelRun.players} players)` : ''}{score ? ', after "m"' : ''}.</> : <>No model run for this slate yet: chips show a matchup read (own SOG/G × opponent ratio){score ? ', after "p"' : ''}. The model runs itself once the PropFinder matchup files and the lines are in.</>}</small>
          <small>Ice tinted by what {side.opp} allows {WINDOW_TEXT[v]} to each position (rank 1 = most permissive) · <SourceLine side={side} /></small>
        </div>
      </div>
      {side.propfinder ? <PropfinderDefense abbr={side.opp} data={side.propfinder} posFilter={posFilter} /> : null}
      <div className="nhlx-rk-toggle">
        <small>{side.opp} allows</small>
        <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label={`Window of ${side.opp}'s defense`}>
          {WINDOWS.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={v === k} className={`nhlx-tab${v === k ? ' is-active' : ''}`} onClick={() => setView(k)} title={k === defaultView ? `Tonight's venue for ${side.opp}` : undefined}>
              {l}{k === defaultView ? <i aria-label="tonight's venue">•</i> : null}
            </button>
          ))}
        </div>
      </div>
      <div className={`nhlx-rk${posFilter ? ` is-filter-${posFilter.toLowerCase()}` : ''}`}>
        <RinkMarkings clipId={clipId} tones={tones} />
        {F_POS.map((z) => <BandLabel key={z} pos={z} d={defAt(z)} opp={side.opp} view={v} teamCount={teamCount} x={F_X[z]} y={6} />)}
        <BandLabel pos="D" d={defAt('D')} opp={side.opp} view={v} teamCount={teamCount} x={50} y={100} />
        {F_Y.map((y, i) => <div key={`l${i}`} className="nhlx-rk-tag" style={{ top: `${pct(y - 8.3)}%` }}>Line {i + 1}</div>)}
        {D_Y.map((y, i) => <div key={`d${i}`} className="nhlx-rk-tag" style={{ top: `${pct(y - 8.3)}%` }}>Pair {i + 1}</div>)}
        {placed.map(({ p, x, y }) => <Chip key={`${p.team}-${p.name}`} p={p} x={x} y={y} minGp={minGp} played={!!actual} actual={actualFor(p)} />)}
      </div>
      {extras.length > 0 && (
        <p className="nhlx-rk-extras nhlx-auto-meta">
          <b>Also on the roster:</b>{' '}
          {extras.map((p, i) => (
            <span key={`${p.team}-${p.name}`}>
              {i ? ', ' : ''}
              <button type="button" className={`nhlx-rk-extra${p.id ? '' : ' is-static'}`} onClick={() => p.id && open({ id: p.id, opp: p.opp, venue: p.venue })}>{p.name}</button> {p.pos}{p.projSog != null && (p.gp || 0) >= minGp ? ` ${num(p.projSog)} SOG` : ''}
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

export function RinkLegend() {
  return (
    <p className="nhlx-rk-legend nhlx-auto-meta">
      <span><i className="is-soft" /> favourable: the opponent allows the most shots to that position (top third)</span>
      <span><i className="is-mid" /> neutral</span>
      <span><i className="is-tough" /> stingy: bottom third</span>
      <span>on each player: the model’s projected SOG and goals from the latest saved run for this slate (3+ SOG and 1+ G odds in the tooltip), or a matchup read when no run exists; once the game is final, the actual shots, goals and assists with the model’s number after “m”; click for the player card</span>
    </p>
  );
}
