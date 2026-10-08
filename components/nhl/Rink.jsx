'use client';

import { useMemo, useState } from 'react';
import { TeamLogo, headshotUrl } from './media';
import { TeamLink } from './links';
import { usePlayerCard } from './PlayerCard';
import { PropfinderDefense } from './Propfinder';
import { defaultDefenseTab, defenseBandFromTab, defenseTabText } from '@/lib/nhl-data/propfinder-csv';

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
const NB = '\u00a0';                          // keeps a chip's number with its unit; the stat line may only break after the dot
const et = (iso) => (iso ? `${new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET` : null);

/** "lines from … · NHL.com lineup updated 5:30 PM ET · captured 7:20 PM ET" (the card's hover title). */
function sourceText(side) {
  const m = side.sourceMeta || {};
  const gdt = m.handle ? `the beat writers via GameDayTweets (@${m.handle}${m.at ? `, ${et(m.at)}` : m.date ? `, ${m.date}` : ''})` : null;
  const nhl = m.nhlUpdated ? `NHL.com lineup updated ${et(m.nhlUpdated)}` : null;
  if (side.source === 'gamedaytweets') return `lines from ${gdt}${nhl ? ` · ${nhl}` : ''}${m.capturedAt ? ` · captured ${et(m.capturedAt)}` : ''}`;
  if (side.source === 'lineup') return `lines from the NHL.com projected lineup${nhl ? ` (updated ${et(m.nhlUpdated)})` : ''}${gdt ? ` · older tweet from ${gdt}` : ''}${m.capturedAt ? ` · captured ${et(m.capturedAt)}` : ''}${carriedText(side)}`;
  if (side.source === 'propfinder') return `lines from PropFinder’s depth chart${m.pfAt ? ` (pulled ${et(m.pfAt)})` : ''} · no beat-writer or NHL.com lines yet${m.capturedAt ? ` · captured ${et(m.capturedAt)}` : ''}${carriedText(side)}`;
  if (side.carried) return `no lines yet: ${carriedText(side).slice(3)}${m.capturedAt ? ` · last checked ${et(m.capturedAt)}` : ''}`;
  return `lines from the roster, ordered by projected shots (no lines yet${m.capturedAt ? `, last checked ${et(m.capturedAt)}` : ''})`;
}

/** " · 3 slots carried from the last known lineup (2026-09-30)". */
const carriedText = (side) => (side.carried ? ` · ${side.carried.count} slot${side.carried.count === 1 ? '' : 's'} carried from the last known lineup${side.carried.date ? ` (${side.carried.date})` : ''}` : '');

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
 * 3 pairs. A skater's lineup line wins; roster-only players (no line)
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

function Chip({ p, x, y, minGp, actual, played, metric = 'sog' }) {
  const open = usePlayerCard();
  const thin = (p.gp || 0) < minGp;
  const m = p.model;
  // Probability as "42%" (not `pct`, which converts rink feet to % and places the chip below).
  const prob = (v) => (v == null ? null : `${Math.round(v * 100)}%`);
  const modelText = m ? ` · model: ${num(m.sog)} SOG, ${num(m.g, 2)} G${m.p3s != null ? `, 3+ SOG ${prob(m.p3s)}` : ''}${m.p1g != null ? `, 1+ G ${prob(m.p1g)}` : ''}${m.gateOpen === false ? ' (gate closed)' : ''}${m.fire ? ' · ON FIRE (1+ point ≥ 50%, 2.0+ iSCF/G, 16+ min)' : ''}` : '';
  // Head to head: his stored games against this opponent; the mark when he scores more than a goal a game on them.
  const h2hText = p.h2h ? ` · vs ${p.opp}: ${p.h2h.g} G, ${p.h2h.sog} SOG in ${p.h2h.gp} GP${p.h2h.hot ? ' (scores on them)' : ''}${p.h2h.shotsHot ? ' (fires at them)' : ''}` : '';
  // The h2h mark follows the rink's metric: scorers when the ice shows goals, shooters when it shows shots.
  const h2hMark = metric === 'g' ? p.h2h?.hot : p.h2h?.shotsHot;
  const h2hTitle = metric === 'g' ? `scores on ${p.opp}: ${p.h2h?.g} goals in ${p.h2h?.gp} games` : `fires at ${p.opp}: ${p.h2h?.sog} shots in ${p.h2h?.gp} games`;
  // Finished game: the box score at the logged position, with the projection kept in the title.
  const result = played ? (actual ? ` · played: ${actual.sog} SOG, ${actual.g} G, ${actual.a} A in ${num(actual.toi)} min` : ' · did not play') : '';
  const title = `${p.name} · ${p.pos}${p.line ? ` L${p.line}` : ''} · ${p.gp || 0} GP · ${num(p.sog)} SOG/G, ${num(p.g, 2)} G/G${modelText}${h2hText}${p.projSog != null ? ` · matchup read ${num(p.projSog)} SOG, ${num(p.projG, 2)} G` : ''}${result}`
    + (p.shotEdge != null ? ` · shot edge ${p.shotEdge > 0 ? '+' : ''}${p.shotEdge}%` : '')
    + (p.goalEdge != null ? ` · goal edge ${p.goalEdge > 0 ? '+' : ''}${p.goalEdge}%` : '')
    + (p.carried ? ` · carried from the last known lineup${p.carriedFrom ? ` (${p.carriedFrom})` : ''}` : p.inLineup ? '' : ' · not in the projected lineup');
  return (
    <button
      type="button"
      className={`nhlx-rk-chip${p.inLineup ? '' : ' is-out'}${p.carried ? ' is-carried' : ''}${p.id ? '' : ' is-static'}`}
      style={{ left: `${x}%`, top: `${pct(y)}%` }}
      title={title}
      onClick={() => p.id && open({ id: p.id, opp: p.opp, venue: p.venue })}
    >
      <span className="nhlx-rk-pic">
        {p.id ? <img src={headshotUrl(p.id)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : null}
        <i className="nhlx-rk-num">{p.number ?? p.pos}</i>
      </span>
      <span className="nhlx-rk-meta">
        <b className="nhlx-rk-name">{m?.fire ? <span className="nhlx-rk-fire" role="img" aria-label="on fire">🔥</span> : null}{h2hMark ? <span className="nhlx-rk-h2h" title={h2hTitle}>h2h</span> : null}<span className="nhlx-rk-nm">{shortName(p.name)}</span></b>
        {played ? (actual
          ? <span className={`nhlx-rk-stat is-actual${(m?.sog ?? p.projSog) != null && actual.sog >= (m?.sog ?? p.projSog) ? ' is-over' : ''}`}><em>{actual.sog}</em>{NB}SOG{NB}· <em>{actual.g}</em>{NB}G{actual.a ? <>{NB}· <em>{actual.a}</em>{NB}A</> : null}{m?.sog != null ? <i>m{NB}{num(m.sog)}</i> : p.projSog != null ? <i>p{NB}{num(p.projSog)}</i> : null}</span>
          : <span className="nhlx-rk-stat">did not play</span>)
          : m?.sog != null
            ? <span className={`nhlx-rk-stat is-model${m.gateOpen === false ? ' is-closed' : ''}`}><em>{num(m.sog)}</em>{NB}SOG{NB}· <em>{num(m.g, 2)}</em>{NB}G</span>
            : thin || p.projSog == null
              ? <span className="nhlx-rk-stat"><em>{p.pos}</em>{NB}· {p.gp ? `${p.gp}${NB}GP` : `no${NB}games`}</span>
              : <span className="nhlx-rk-stat is-read"><em>{num(p.projSog)}</em>{NB}SOG{NB}· <em>{num(p.projG, 2)}</em>{NB}G</span>}
      </span>
    </button>
  );
}

// The toggle above each rink: which window of the opponent's defense tints the ice.
const WINDOWS = [['home', 'Home'], ['away', 'Away'], ['l5', 'L5'], ['l10', 'L10'], ['l5home', 'L5 home'], ['l5away', 'L5 away'], ['h2hhome', 'H2H home'], ['h2haway', 'H2H away']];
const WINDOW_TEXT = { home: 'at home', away: 'away', l5: 'over its last 5 games', l10: 'over its last 10 games', l5home: 'over its last 5 home games', l5away: 'over its last 5 away games', h2hhome: 'at home against this team (stored meetings, this season and last)', h2haway: 'away against this team (stored meetings, this season and last)' };
const WINDOW_TITLE = { h2hhome: 'What the opponent allowed in its home games against this team', h2haway: 'What the opponent allowed in its road games against this team' };

function BandLabel({ pos, d, opp, view, windowText = null, teamCount, x, y, metric = 'sog' }) {
  const r = d?.rank || {};
  const s = d?.season;
  const n = d?.teamCount || teamCount;
  const tone = zoneTone(r[metric], n);
  const when = windowText || WINDOW_TEXT[view];
  const from = d?.source === 'propfinder' ? (d.window ? ` · PropFinder's table, ${d.window}` : ` · PropFinder ${d.seasonLabel} (last season, until ${opp} has enough stored games)`)
    : d?.source === 'h2h' ? ` · ${s?.gp ?? 0} stored meeting${s?.gp === 1 ? '' : 's'}; the rank is where that sits among the league's season values at this venue`
      : ` · this season's stored games (${s?.gp ?? 0})`;
  // First goals given up to this position (the season table at tonight's venue; the card's column has the same numbers).
  const fg = d?.firstGoal;
  const fgText = fg?.games ? ` · first goal given up to ${pos} in ${fg.allowed} of ${fg.games} games${fg.rank ? ` (#${fg.rank})` : ''}${Object.keys(fg.bySlot || {}).length ? `: ${Object.entries(fg.bySlot).sort((a, b) => b[1] - a[1]).map(([k, c]) => `${k} ×${c}`).join(', ')}` : ''}` : '';
  const title = s?.gp ? `${opp} allows ${num(s.sog)} SOG (#${r.sog ?? '–'}) and ${num(s.g, 2)} goals (#${r.g ?? '–'}) per game to ${pos} ${when} · rank 1 = most permissive of ${n}${from}${fgText}` : `No defense data for ${opp} ${when} yet`;
  return (
    <div className={`nhlx-rk-zone is-${tone}`} style={{ left: `${x}%`, top: `${pct(y)}%` }} title={title}>
      <b>{pos}</b>{s?.gp ? <span>{metric === 'g' ? <>#{r.g ?? '–'} G · #{r.sog ?? '–'} SOG</> : <>#{r.sog ?? '–'} SOG · #{r.g ?? '–'} G</>}{d?.source === 'propfinder' ? <i title={`PropFinder ${d.seasonLabel}`}>PF</i> : d?.source === 'h2h' ? <i title={`${s.gp} stored meeting${s.gp === 1 ? '' : 's'}`}>{s.gp} GP</i> : null}</span> : <span>{view?.startsWith('h2h') ? 'no meetings' : 'no data'}</span>}
    </div>
  );
}

/** One side of a game: `side` is an entry of a slate game's `sides`. */
export function Rink({ side, teamCount, posFilter = '', minGp = 1, log = null, modelRun = null, metric = 'sog', onMetric = null }) {
  // Kept for the card's title (hover): where the chip numbers and the lines come from.
  const numSrc = modelRun ? `Numbers on the chips: the model, ${modelRun.source === 'auto' ? 'run automatically' : 'run'} ${et(modelRun.createdAt)}${modelRun.players ? ` (${modelRun.players} players)` : ''}.` : 'No model run for this slate yet: chips show a matchup read (own SOG/G × opponent ratio).';
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
  // What tints the ice: our stored games (the window toggle) or the PropFinder table above
  // (its selected tab, which the rink then owns).
  const [tint, setTint] = useState('rink');
  const [pfKey, setPfKey] = useState(null);
  const pfTabs = side.propfinder?.tabs || [];
  const pfTab = pfTabs.find((t) => t.key === pfKey) || defaultDefenseTab(pfTabs);
  const fromPf = tint === 'propfinder' && !!pfTab;
  const defAt = (pos) => (fromPf ? defenseBandFromTab(pfTab, pos) : side.defense?.[pos]?.windows?.[v] ?? (v === defaultView ? side.defense?.[pos] : null) ?? null);
  const windowText = fromPf ? `over ${defenseTabText(pfTab)} (PropFinder)` : WINDOW_TEXT[v];
  const tones = Object.fromEntries(ZONES.map((z) => [z, posFilter && posFilter !== z ? 'none' : zoneTone(defAt(z)?.rank?.[metric], defAt(z)?.teamCount || teamCount)]));
  const metricWord = metric === 'g' ? 'goals' : 'shots';
  const clipId = `rink-${side.team}-${side.opp}`;
  const open = usePlayerCard();
  return (
    <section className="nhlx-rk-card" aria-label={`${side.team} lineup on the rink`} title={`${numSrc} Ice tinted by the ${metricWord} ${side.opp} allows ${windowText} to each position (rank 1 = most permissive) · ${sourceText(side)}`}>
      <div className="nhlx-rk-head">
        <TeamLink abbr={side.team} logo={28} />
        <div>
          <b><TeamLink abbr={side.team}>{side.team}</TeamLink> <small>{side.venue === 'H' ? 'home' : 'away'}{score ? ` · final ${score[0]}–${score[1]} vs ${side.opp} · chips show the game's shots, goals, assists` : ' · attacking upwards'}</small></b>
          {/* The chips' source and the lines' source stay in the title attribute: the head shows only the team. */}
        </div>
      </div>
      {side.propfinder ? <PropfinderDefense abbr={side.opp} data={side.propfinder} posFilter={posFilter} tabKey={pfTab?.key ?? null} onTabChange={setPfKey} drivesRink={fromPf} /> : null}
      <div className="nhlx-rk-toggle">
        <small>Tint by</small>
        <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label="Shots or goals tint the rink">
          {[['sog', 'Shots'], ['g', 'Goals']].map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={metric === k} className={`nhlx-tab${metric === k ? ' is-active' : ''}`} onClick={() => onMetric?.(k)} title={k === 'sog' ? `Ice by the shots ${side.opp} allows to each position; h2h marks the shooters who fire at ${side.opp}` : `Ice by the goals ${side.opp} allows to each position; h2h marks the scorers who score on ${side.opp}`}>{l}</button>
          ))}
        </div>
        <small>from</small>
        <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label="What tints the rink">
          <button type="button" role="tab" aria-selected={!fromPf} className={`nhlx-tab${!fromPf ? ' is-active' : ''}`} onClick={() => setTint('rink')} title="Our stored box scores, by the window on the right">Rink</button>
          <button type="button" role="tab" aria-selected={fromPf} disabled={!pfTab} className={`nhlx-tab${fromPf ? ' is-active' : ''}`} onClick={() => setTint('propfinder')} title={pfTab ? 'PropFinder\'s table above: its selected tab tints the rink' : 'No PropFinder table for this opponent'}>PropFinder</button>
        </div>
        {fromPf ? (
          <small className="nhlx-rk-toggle-note">{side.opp} allows over {defenseTabText(pfTab)} · pick a tab in the table above</small>
        ) : (
          <>
            <small>{side.opp} allows</small>
            <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label={`Window of ${side.opp}'s defense`}>
              {WINDOWS.map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={v === k} className={`nhlx-tab${v === k ? ' is-active' : ''}`} onClick={() => setView(k)} title={k === defaultView ? `Tonight's venue for ${side.opp}` : WINDOW_TITLE[k]}>
                  {l}{k === defaultView ? <i aria-label="tonight's venue">•</i> : null}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className={`nhlx-rk${posFilter ? ` is-filter-${posFilter.toLowerCase()}` : ''}`}>
        <RinkMarkings clipId={clipId} tones={tones} />
        {F_POS.map((z) => <BandLabel key={z} pos={z} d={defAt(z)} opp={side.opp} view={v} windowText={windowText} teamCount={teamCount} x={F_X[z]} y={6} metric={metric} />)}
        <BandLabel pos="D" d={defAt('D')} opp={side.opp} view={v} windowText={windowText} teamCount={teamCount} x={50} y={100} metric={metric} />
        {F_Y.map((y, i) => <div key={`l${i}`} className="nhlx-rk-tag" style={{ top: `${pct(y - 8.3)}%` }}>Line {i + 1}</div>)}
        {D_Y.map((y, i) => <div key={`d${i}`} className="nhlx-rk-tag" style={{ top: `${pct(y - 8.3)}%` }}>Pair {i + 1}</div>)}
        {placed.map(({ p, x, y }) => <Chip key={`${p.team}-${p.name}`} p={p} x={x} y={y} minGp={minGp} played={!!actual} actual={actualFor(p)} metric={metric} />)}
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

export function RinkLegend({ metric = 'sog' }) {
  const word = metric === 'g' ? 'goals' : 'shots';
  return (
    <p className="nhlx-rk-legend nhlx-auto-meta">
      <span><i className="is-soft" /> favourable: the opponent allows the most {word} to that position (top third of the league); switch Shots / Goals above a rink to tint by the other</span>
      <span><i className="is-mid" /> neutral</span>
      <span><i className="is-tough" /> stingy: bottom third</span>
      <span>on each player: the model’s projected SOG and goals from the latest saved run for this slate (3+ SOG and 1+ G odds in the tooltip), or a matchup read when no run exists; once the game is final, the actual shots, goals and assists with the model’s number after “m”; click for the player card</span>
      <span>🔥 on fire, by the model’s rule: 1+ point at 50% or better, 2.0+ scoring chances per game, 16+ minutes</span>
      {metric === 'g'
        ? <span><i className="nhlx-rk-h2h is-legend">h2h</i> scores on this opponent: more than a goal a game against them over 2+ stored games, or 2+ goals in the one game stored (this season and last)</span>
        : <span><i className="nhlx-rk-h2h is-legend">h2h</i> fires at this opponent: 4+ shots a game against them over 2+ stored games, or 5+ in the one game stored (this season and last)</span>}
    </p>
  );
}
