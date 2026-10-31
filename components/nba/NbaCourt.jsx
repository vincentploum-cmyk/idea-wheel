'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fmtOdds } from '@/lib/nfl/odds';
import { ICON } from '@/components/nhl/flags';
import { boardRead, windowRead, blendText, dampText, pullText } from '@/lib/picks/projection';
import { seasonTag } from '@/lib/nba/teams';
import { SHUFFLE_MARKETS } from '@/lib/nba/markets';
import { heightsOf, lineOf, readAt } from '@/lib/picks/shuffle';
import { reliableTone, reliableFor, reliabilityText } from '@/lib/picks/reliability';
import { asStated } from '@/lib/picks/calibration';
import SidePicks from '@/components/picks/SidePicks';
import { useNbaPlayerCard } from './NbaPlayerCard';

// The matchup view of an NBA game, the NHL rink's basketball twin: for each team a half court
// (50 × 47 ft, the basket at the top) with its players placed by position (PF · C · SF under the
// basket, SG · PG on the perimeter), every zone tinted by what tonight's opponent gives up to that
// position for the stat picked above the board (rank 1 = the most permissive of the league:
// green third, amber middle, red stingiest), each chip carrying the player's line and chance for
// the stat and his projection for tonight (his own rate × the opponent's environment at his
// position, lib/picks/projection.js); above the court the opponent's allowed table per position
// with the league ranks, under it every player's props read against the matchup. Above each
// court, as above each NHL rink: the stat tabs (Points · Rebounds · Assists · Threes, one setting
// for the slate) and the window of the opponent's table (this season's as PropFinder publishes it,
// the default and the table the board reads; last season's in full; then L5 / L10 / L15 / L20 as
// PropFinder publishes them) that tints the zones and fills the table. A window moves no figure:
// the chip's projection is the board's (`ranges` on the side's player, lib/picks/board.js: his rate
// × the matchup on the season table × the side's factor), the same number the Tonight table, the
// shuffle's Expected and the card show; the hover says what the picked window would have read.
// At the top of each card, as above each NHL rink: the board's best plays for the team
// (components/picks/SidePicks.jsx, `side.picks`), the picked players' chips ringed on the court.
// 2026-10-30 (Vincent: "above the court I want toggles for points / rebounds / assists / threes / steals /
// blocks and under that a shuffle bar that I can move … the % displayed next to the player on the court …
// by default per player the projected number for points / assists / threes / rebounds … click in the
// PropFinder table to see the players for that position highlighted"): six stat tabs; under them the
// stat's shuffle bar (the Shuffle tab's heights, `SHUFFLE_MARKETS`), one height per stat for the slate,
// every chip carrying his chance to clear it from the night's shuffle payload (`/api/nba/shuffle`, one
// request a stat, shared by every court through `CourtShuffleProvider`; `readAt` in lib/picks/shuffle.js
// reads the chance, so the court's figure is the Shuffle tab's); every chip his four projections (PTS ·
// REB · AST · 3PM, the picked stat too when it is another) off `ranges`; and the rows of the PropFinder
// table above the court press to ring that position's chips and dim the rest (`hiPos`).
export const COURT_METRICS = [['pts', 'Points'], ['reb', 'Rebounds'], ['ast', 'Assists'], ['tpm', 'Threes'], ['stl', 'Steals'], ['blk', 'Blocks']];
/** The projections every chip shows by default, the picked stat appended when it is not one of them. */
export const CHIP_STATS = ['pts', 'reb', 'ast', 'tpm'];
const BAR_OF = Object.fromEntries(SHUFFLE_MARKETS.map((m) => [m.market, m]));
const WINDOW_LABEL = { season: 'Season', prior: 'Last season', l5: 'L5', l10: 'L10', l15: 'L15', l20: 'L20' };
const WINDOW_TEXT = { season: 'this season’s table', prior: 'last season’s full table', l5: 'its last 5 games', l10: 'its last 10 games', l15: 'its last 15 games', l20: 'its last 20 games' };
/** The windows a side's allowed table offers: this season first (the table the board reads), last season's in full when the pull has it, then the last-N windows. */
export function windowsOf(allowed) { return ['season', ...(allowed?.prior ? ['prior'] : []), ...Object.keys(allowed?.windows || {}).filter((k) => WINDOW_LABEL[k]).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))]; }
/** The side's allowed table for a window (the season table when the window is missing). */
export function tableFor(allowed, win) { return (win === 'prior' && allowed?.prior) || (win && win !== 'season' && win !== 'prior' && allowed?.windows?.[win]) || allowed || null; }
/** A tab's label: the seasons by their years ('26-'27), the windows by their length. */
export function windowLabel(win, allowed, season) { return win === 'season' ? seasonTag(season) : win === 'prior' ? seasonTag(allowed?.prior?.season || (season ? season - 1 : null)) : WINDOW_LABEL[win] || win; }
/** Whether the cheat sheet's tile agrees with PropFinder's rank: the same third of the league → 'yes', else 'no'; null without a tile. */
export function sheetCheck(cell, count) {
  if (!cell || cell.sheet == null || cell.rank == null) return null;
  return zoneTone(cell.sheet, count) === zoneTone(cell.rank, count) ? 'yes' : 'no';
}
/** The position the environment is read at: the depth-chart slot, else the roster position (G → SG, F → SF). */
export function envPos(p) { return ZONE_OF[String(p.slot || p.pos || '').toUpperCase()] || ZONE_OF[String(p.pos || '').toUpperCase()] || null; }
const MARKET_OF = { pts: 'pts', reb: 'reb', ast: 'ast', tpm: 'tpm', stl: 'stl', blk: 'blk' };
const STAT_SHORT = { pts: 'P', reb: 'R', ast: 'A', tpm: '3P', stl: 'S', blk: 'B', pra: 'PRA' };   // the chip's projections row: the figure, then the stat's letter
const STAT_LABEL = { pts: 'PTS', reb: 'REB', ast: 'AST', tpm: '3PM', stl: 'STL', blk: 'BLK', tov: 'TO', pra: 'PRA', pr: 'PR', pa: 'PA', ra: 'RA', ftm: 'FTM', fgm: 'FGM', min: 'MIN', oreb: 'OREB', dreb: 'DREB' };
const STAT_ORDER = ['pts', 'reb', 'ast', 'tpm', 'pra', 'stl', 'blk', 'tov', 'ftm', 'fgm'];
const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const TABLE_MARKETS = [['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['tpm', '3PM'], ['pra', 'PRA']];
const W = 50; const H = 47;
// Zones in feet: [x, y, width, height]; the label sits at the zone's foot, the chips stack from its top.
const ZONES = { PF: [0, 0, 17, 22], C: [17, 0, 16, 22], SF: [33, 0, 17, 22], SG: [0, 22, 25, 25], PG: [25, 22, 25, 25] };
const ZONE_OF = { PG: 'PG', SG: 'SG', SF: 'SF', PF: 'PF', C: 'C', G: 'SG', F: 'SF' };
const CHIP_H = 5.2;                           // feet between stacked chips
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const shortName = (name) => { const parts = String(name || '').trim().split(' '); return parts.length > 1 ? parts.slice(1).join(' ') : name; };
const NB = '\u00a0';

/** League rank (1 = most permissive) → 'soft' | 'mid' | 'tough' | 'none'. */
export function zoneTone(rank, teams) {
  if (!rank || !teams) return 'none';
  const third = Math.ceil(teams / 3);
  if (rank <= third) return 'soft';
  if (rank > teams - third) return 'tough';
  return 'mid';
}

export const CourtShuffleContext = createContext(null);   // exported for offline renders and tests; the board uses the provider

/**
 * The night's shuffle for the courts: the payload per stat (`GET /api/nba/shuffle?date&market`, read once a stat
 * for the slate when a court first asks for it, every court sharing it), the bar's height per stat (one setting for
 * the slate, as the stat tabs are; it opens on the Shuffle tab's start) and the heights a bar can take. Wraps the
 * NBA board (components/nba/NbaBoard.jsx); without it the court draws no bar and no chance.
 */
export function CourtShuffleProvider({ date, children }) {
  const [data, setData] = useState({});
  const [bars, setBars] = useState({});
  const asked = useRef({ date: null, set: new Set() });
  const load = useCallback(async (market, { again = false } = {}) => {
    if (!date || !BAR_OF[market]) return;
    if (asked.current.date !== date) { asked.current = { date, set: new Set() }; setData({}); }
    if (asked.current.set.has(market) && !again) return;
    asked.current.set.add(market);
    setData((prev) => ({ ...prev, [market]: { busy: true } }));
    try {
      const res = await fetch(`/api/nba/shuffle?date=${date}&market=${market}`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`);
      if (asked.current.date === date) setData((prev) => ({ ...prev, [market]: j }));
    } catch (e) {
      if (asked.current.date === date) setData((prev) => ({ ...prev, [market]: { error: e.message } }));
    }
  }, [date]);
  const value = useMemo(() => ({
    date, load,
    payloadFor: (market) => (data[market]?.players ? data[market] : null),
    stateOf: (market) => (data[market]?.players ? 'ready' : data[market]?.error ? 'error' : data[market]?.busy ? 'busy' : 'idle'),
    errorOf: (market) => data[market]?.error || null,
    heightsFor: (market) => data[market]?.heights || (BAR_OF[market] ? heightsOf(BAR_OF[market]) : []),
    stepOf: (market) => data[market]?.step || BAR_OF[market]?.step || 1,
    barOf: (market) => bars[market] ?? data[market]?.start ?? BAR_OF[market]?.start ?? null,
    setBar: (market, h) => setBars((b) => ({ ...b, [market]: h })),
  }), [date, load, data, bars]);
  return <CourtShuffleContext.Provider value={value}>{children}</CourtShuffleContext.Provider>;
}
export function useCourtShuffle() { return useContext(CourtShuffleContext); }

/** The hover's line for the board's projection: the arithmetic, then what the picked window would read. */
function projectionText(read, stat, opp, allowed, win) {
  if (read?.value == null) return '';
  const label = STAT_LABEL[stat] || stat;
  const table = read.held ? 'last season’s table, no game this season yet' : 'this season’s table';
  const mf = read.matchupFrom;
  const env = read.matchup != null ? ` × ${read.matchup} (${mf?.from === 'blend' ? `the cheat sheet's tile #${read.sheetRank} × ${mf.sheet} in full, PropFinder's × ${mf.pf} beside it by its games; ` : mf?.from === 'sheet' ? `the cheat sheet's tile #${read.sheetRank} alone; ` : ''}${opp} gives up ${read.allowed != null ? `${num(read.allowed)} ${label}` : `the #${read.rank} most ${label}`} to ${read.pos}s, #${read.rank ?? '—'} of ${read.count ?? '—'} on ${table}${read.league != null ? `, the league ${num(read.league)}` : ''}${dampText(mf)})` : ' (no table for the environment)';
  const team = read.team != null ? ` × ${read.team} (the side's rates run past the team's expected total: scaled down to it)` : '';
  const lift = read.lift ? ` (+${num(read.lift)} of it ${(read.liftFrom || []).join(' + ')}'s production, out tonight)` : '';
  const vol = read.volume ? ` (${num(read.volume.att)} attempts at ${num(read.volume.pct * 100)}%)` : '';
  const mins = read.minutes?.factor && read.minutes.factor !== 1 ? ` (${num(read.minutes.tonight)} minutes tonight over the ${num(read.minutes.base)} behind his rate, × ${num(read.minutes.factor, 3)}${read.minutes.vacated ? `: +${num(read.minutes.vacated)} with ${(read.minutes.from || []).join(' + ')} out` : ''})` : '';
  const w = win && win !== 'season' ? windowRead(read, allowed, stat) : null;
  const window = w ? ` · over ${WINDOW_TEXT[win] || win} ${opp} gives up ${num(w.allowed)} (#${w.rank ?? '—'}): the matchup would read × ${w.factor}, ${num(w.value)} ${label}; the window tints the court, the figure stays the board's` : '';
  return `Tonight ${num(read.value)} ${label}, the board's read: his ${num(read.rate)} a game in PropFinder's logs (${blendText(read.weights)}${pullText(read.pull)})${vol}${mins}${lift}${env}${team}${window}`;
}

/** The player's play for a market: the book's main line on the over (or yes) side first, else his best over, else any. */
export function playFor(p, market) {
  const mine = (p.plays || []).filter((x) => x.market === market);
  const overs = mine.filter((x) => x.side === 'over' || x.side === 'yes');
  return overs.find((x) => x.main) || overs[0] || mine.find((x) => x.main) || mine[0] || null;
}

const ZONE_MAX = { PF: 3, C: 3, SF: 3, SG: 3, PG: 3 };   // chips a zone holds before the rest go under the court (three since the chips carry four projections and the bar's chance, 2026-10-30)

/** Players onto the court: one stack per zone (PG · SG · SF · PF · C; G and F join the guards and wings), the rest under it. */
export function layoutCourt(players) {
  const stacks = Object.fromEntries(Object.keys(ZONES).map((z) => [z, []]));
  const extras = [];
  // The depth chart's slot places a player (the starter first); the roster position otherwise.
  for (const p of players) {
    const z = ZONE_OF[String(p.slot || p.pos || '').toUpperCase()] || ZONE_OF[String(p.pos || '').toUpperCase()] || null;
    if (!z || stacks[z].length >= ZONE_MAX[z]) { extras.push(p); continue; }
    stacks[z].push(p);
  }
  const placed = [];
  for (const [z, list] of Object.entries(stacks)) {
    const [x, y, w] = ZONES[z];
    list.forEach((p, i) => placed.push({ p, zone: z, x: x + w / 2, y: y + 3.4 + i * CHIP_H }));
  }
  return { placed, extras };
}

function CourtMarkings({ clipId, tones }) {
  return (
    <svg className="ir-court-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <defs><clipPath id={clipId}><rect width={W} height={H} rx="1.5" /></clipPath></defs>
      <rect width={W} height={H} rx="1.5" className="ir-court-floor" />
      <g clipPath={`url(#${clipId})`}>
        {Object.entries(ZONES).map(([z, [x, y, w, h]]) => <rect key={z} x={x} y={y} width={w} height={h} className={`nhlx-rk-band is-${tones[z] || 'none'}`} />)}
        <path d={`M17 0V22M33 0V22M0 22H${W}M25 22V${H}`} className="nhlx-rk-band-line" />
        {/* Paint, free-throw circle, restricted area, rim and board, the three-point line, the centre circle. */}
        <rect x="17" y="0" width="16" height="19" className="ir-court-line" />
        <circle cx="25" cy="19" r="6" className="ir-court-line" />
        <path d="M21 5.25A4 4 0 0 0 29 5.25" className="ir-court-line" />
        <path d="M22 4H28" className="ir-court-line is-board" />
        <circle cx="25" cy="5.25" r="0.75" className="ir-court-line is-rim" />
        <path d="M3 0V14A23.75 23.75 0 0 0 47 14V0" className="ir-court-line is-arc" />
        <path d={`M19 ${H}A6 6 0 0 1 31 ${H}`} className="ir-court-line" />
      </g>
      <rect width={W} height={H} rx="1.5" className="ir-court-edge" />
    </svg>
  );
}

/** The zone's foot: the position and the opponent's rank for the court's stat, tinted by its third. */
function ZoneLabel({ zone, allowed, metric, opp, win }) {
  const [x, y, w, h] = ZONES[zone];
  const cell = allowed?.rows?.[zone]?.[metric];
  const count = allowed?.count || 30;
  const tone = zoneTone(cell?.rankBlend ?? cell?.rank, count);
  const league = allowed?.league?.[zone]?.[metric];
  const check = allowed?.from === 'sheet' ? null : sheetCheck(cell, count);
  const title = cell ? `${opp} gives up ${cell.value != null ? `${num(cell.value)} ${STAT_LABEL[metric] || metric} per game` : `the #${cell.rank} most ${STAT_LABEL[metric] || metric}`} to ${zone}s over ${WINDOW_TEXT[win] || win}${league != null ? ` (league ${num(league)})` : ''} · rank ${cell.rank} of ${count}, 1 = the most${allowed.from === 'sheet' ? ' · from the cheat sheet’s tiles' : ' · PropFinder'}${check ? ` · the cheat sheet's tile says #${cell.sheet} (${check === 'yes' ? 'the same read' : 'a different read'}); the tint and the matchup blend the two${cell.rankBlend ? `, #${cell.rankBlend} together` : ''}` : ''}` : `No defense table for ${opp} at ${zone}`;
  return (
    <div className={`nhlx-rk-zone is-${tone}`} style={{ left: `${((x + w / 2) / W) * 100}%`, top: `${((y + h - 2.2) / H) * 100}%` }} title={title}>
      <b>{zone}</b>{cell?.rank ? <span>#{cell.rank}{NB}{STAT_LABEL[metric] || metric}</span> : <span>no data</span>}
    </div>
  );
}

/** The hover's lines for the bar: his chance to clear it, the fair price, the book's rung at it or above, how often he cleared it. */
function barText(read, height, metric) {
  if (!read) return '';
  const label = STAT_LABEL[metric] || metric;
  const book = read.book ? ` · the book's o${read.book.line}${read.exact ? '' : ' (the nearest rung above)'} at ${fmtOdds(read.book.odds)}${read.edge != null ? `, edge ${read.edge >= 0 ? '+' : ''}${Math.round(read.edge * 100)}` : ''}` : ' · no price at this line';
  const cleared = read.cleared ? ` · cleared it in ${read.cleared.n} of his last ${read.cleared.of}` : '';
  const got = read.got === undefined ? '' : read.got == null ? ' · did not play' : ` · got ${read.got}: ${read.hit ? 'cleared' : 'short'}`;
  return `At the bar, ${height}+ ${label} (o${read.line}): ${pct(read.p)} to clear it, ${read.play ? "the board's play on the book's line (the strip's and the list's figure)" : "the shuffle's read"} (fair ${fmtOdds(read.fair)})${asStated(read.raw)}${book}${cleared}${got}`;
}

/**
 * A player's chip: his name with the flags, his projections for tonight (the board's, `ranges`: PTS · REB · AST · 3PM,
 * the picked stat too when it is another), and his chance to clear the bar for the picked stat from the night's shuffle
 * (`read`: null while the payload loads, `false` when the shuffle has no row for him — out tonight, or no logs). Once the
 * game is final the bar's line grades him. `hi` rings the chips of the position pressed in the table, `dim` fades the rest.
 */
function Chip({ p, metric, height, read, sport, team, opp, venue, final, allowed, seasonAllowed, win, hi = false, dim = false, reliability = null }) {
  const open = useNbaPlayerCard();
  const play = playFor(p, MARKET_OF[metric]);
  const avg = p.avg?.[metric];
  // The without-teammate split behind his season read (lib/picks/injuries.js), when a key teammate is out tonight.
  const own = p.own?.[metric];
  const woText = p.without && own?.without != null ? `Without ${p.without.names.join(' + ')} (${p.without.absent.map((a) => `${a.name}: ${a.status}${a.detail ? `, ${a.detail}` : ''}`).join('; ')}): ${num(own.without)} ${STAT_LABEL[metric]} a game over ${own.n} game${own.n === 1 ? '' : 's'}; the season read moved from ${num(own.all)} to ${num(own.season)} (weight ${p.without.weight})` : null;
  // The board's projection (one figure per player and stat on the slate, whatever window the court shows); the hover compares the window.
  const proj = boardRead(p, metric, seasonAllowed, envPos(p));
  const projText = `${projectionText(proj, metric, opp, allowed, win)}${proj.value != null ? ` · his windows: season ${num(p.own?.[metric]?.season)}, last 10 ${num(p.own?.[metric]?.l10)}, last 5 ${num(p.own?.[metric]?.l5)}` : ''}`;
  const stats = CHIP_STATS.includes(metric) ? CHIP_STATS : [...CHIP_STATS, metric];
  const projs = stats.map((k) => [k, k === metric ? proj.value : boardRead(p, k, seasonAllowed, envPos(p)).value]);
  const flags = [];
  if (play?.form === 'hot') flags.push(['hot', `Hot: ${pct(play.rates.l5)} of his last 5 over this line`, ICON.hot]);
  if (play?.form === 'cold') flags.push(['cold', `Cold: ${pct(play.rates.l5)} of his last 5 over this line`, ICON.cold]);
  if (play?.spot?.soft) flags.push(['soft', `Soft spot: the opponent is in the permissive third at his position for this stat (#${play.spot.rank})`, ICON.soft]);
  const all = (p.plays || []).filter((x) => x.side === 'over' || x.side === 'yes').map((x) => `${x.side === 'yes' ? '' : 'o'}${x.line} ${x.label} ${pct(x.p)}${x.odds != null ? ` at ${fmtOdds(x.odds)}` : ''}${x.hit == null ? '' : x.hit ? ' hit' : ' miss'}`);
  const title = `${p.player} · ${p.pos || '—'}${p.depth ? ` · ${p.slot}${p.depth} on the depth chart${p.depth === 1 ? ' (starter)' : ''}` : ''}${p.injury ? ` · ${p.injury}` : ''}${avg != null ? ` · ${num(avg)} ${STAT_LABEL[metric]} a game this season` : ''}\nTonight: ${projs.map(([k, v]) => `${num(v)} ${STAT_LABEL[k] || k}`).join(' · ')}${projText ? `\n${projText}` : ''}${woText ? `\n${woText}` : ''}${read ? `\n${barText(read, height, metric)}${reliableFor(reliability, MARKET_OF[metric]) != null ? ` · ${reliabilityText(reliability, MARKET_OF[metric], STAT_LABEL[metric])}` : ''}` : read === false ? (p.out ? '\nOut tonight: off the shuffle' : '\nNo logs in the pull: no chance at the bar') : ''}${all.length ? `\n${all.join('\n')}` : '\nNo PropFinder line yet'}`;
  const bar = read
    ? final && read.got !== undefined
      ? <span className={`nhlx-rk-stat is-actual${read.hit ? ' is-over' : ''}`}><em>{read.got == null ? 'DNP' : read.got}</em>{NB}got{NB}·{NB}{height}+{NB}<i>{pct(read.p)}</i></span>
      : <span className={`nhlx-rk-stat is-model${read.p >= 0.5 ? ' is-over' : ''}`}>{height}+{NB}<em className={read.exact && read.edge != null ? (read.edge > 0 ? 'ir-rel-yes' : 'ir-rel-no') : reliableTone(reliability, MARKET_OF[metric], read.p, read.raw) ? `ir-rel-${reliableTone(reliability, MARKET_OF[metric], read.p, read.raw)}` : undefined}>{pct(read.p)}</em>{read.book?.odds != null && read.exact ? <i>{fmtOdds(read.book.odds)}</i> : null}</span>
    : read === false
      ? <span className="nhlx-rk-stat">{p.out ? p.injury || 'out' : 'no logs'}</span>
      : height != null ? <span className="nhlx-rk-stat is-read">{height}+{NB}<em>…</em></span> : null;
  return (
    <button type="button" className={`nhlx-rk-chip${p.out ? ' is-out' : ''}${p.picked ? ' is-pick' : ''}${hi ? ' is-hi' : ''}${dim ? ' is-dim' : ''}`} title={title} onClick={() => open({ key: p.key, player: p, team, opp, venue, market: MARKET_OF[metric] })}>
      <span className="nhlx-rk-pic">
        {p.espnId ? <img src={sport.headshotUrl(p.espnId)} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none'; }} /> : <img src={sport.teamLogo(team)} alt="" loading="lazy" className="is-logo" />}
        <i className="nhlx-rk-num" title={p.depth ? `${p.slot}${p.depth} on PropFinder’s depth chart` : 'roster position'}>{p.slot && p.depth ? `${p.slot}${p.depth}` : p.pos || '—'}</i>
      </span>
      <span className="nhlx-rk-meta">
        <b className="nhlx-rk-name">{flags.length ? <span className="nhlx-pk-flags nhlx-rk-flags">{flags.map(([k, t, icon]) => <i key={k} className={`nhlx-pk-flag is-${k}`} title={t} aria-label={t}>{icon}</i>)}</span> : null}<span className="nhlx-rk-nm">{shortName(p.player)}</span></b>
        <span className="nhlx-rk-projs" aria-label="Projected tonight">{projs.map(([k, v]) => <span key={k} className={k === metric ? 'is-on' : ''}><em>{v != null ? num(v) : '—'}</em>{STAT_SHORT[k] || k}</span>)}</span>
        {bar}
      </span>
    </button>
  );
}

/** Who is out tonight (PropFinder's injury report), the side's team then the opponent, above the opponent's table. */
function OutLines({ side, oppOut }) {
  const line = (team, list) => (
    <p className="nhlx-auto-meta ir-court-out" key={team}>
      <b>Out for {team}:</b> {list?.length ? list.map((a) => `${a.name}${a.pos ? ` (${a.pos})` : ''} · ${a.status}${a.detail ? `, ${a.detail}` : ''}`).join(' · ') : 'nobody listed out on PropFinder’s injury report'}
    </p>
  );
  return <div className="ir-court-outs" aria-label="Players out tonight">{line(side.team, side.out)}{line(side.opp, oppOut)}</div>;
}

/**
 * What the opponent gives up per game to each position: PropFinder's table with the figure and the league rank in
 * every cell, the league's average in a last row (Lg), and, with `onWin`, the window tabs over it (this season's as
 * published, last season's in full, L5 / L10 / L15 / L20). Above each court and, since 2026-10-30, in each team's column of
 * the opened game (Vincent: "I need the propfinder data above each court again like how we had it" — the column had
 * been drawing the ranks alone for five stats).
 */
export function AllowedTable({ side, win, metric, season, onWin = null, onPos = null, hiPos = null }) {
  const a = tableFor(side.allowed, win);
  if (!a) return <p className="nhlx-auto-meta ir-court-none">No defense table for {side.opp} yet: pull PropFinder (the button above the board, or under Data sources).</p>;
  const windows = onWin ? windowsOf(side.allowed) : [];
  const keys = [...new Set(Object.values(a.rows).flatMap((r) => Object.keys(r)))].filter((k) => !['gp', 'prior'].includes(k)).sort((x, y) => (STAT_ORDER.indexOf(x) + 1 || 99) - (STAT_ORDER.indexOf(y) + 1 || 99)).slice(0, 8);
  const positions = [...POSITIONS.filter((p) => a.rows[p]), ...Object.keys(a.rows).filter((p) => !POSITIONS.includes(p))];
  const count = a.count || 30;
  const league = a.league || null;
  const held = win === 'season' && Object.values(a.rows).some((r) => r.held);
  const note = a.from === 'sheet' ? 'the cheat sheet’s tiles'
    : win === 'season' ? `PropFinder, ${seasonTag(season)} as published, the table the board’s projections read${held ? ` · last season’s until ${side.opp} plays its first game` : ''}`
      : win === 'prior' ? `PropFinder, ${windowLabel('prior', side.allowed, season)} in full · a comparison: the board reads this season’s`
        : `PropFinder, ${WINDOW_TEXT[win]}${a.season && season && a.season < season ? ' of last season (no games this season yet)' : ''} · a comparison: the board reads this season’s table`;
  return (
    <div className="nhlx-pfd">
      <div className="nhlx-pfd-head"><b>What {side.opp} gives up per game, by position{onWin ? '' : ` · ${windowLabel(win, side.allowed, season)}`}</b><small className="nhlx-auto-meta">rank 1 = the most of {count} · {note}{league ? ' · Lg = the league’s average' : ''}{onPos ? ' · press a row to pick out that position’s players on the court' : ''}</small></div>
      {windows.length > 1 ? (
        <div className="nhlx-tabs nhlx-rk-tabs nhlx-pfd-tabs" role="tablist" aria-label={`Window of ${side.opp}'s table`}>
          {windows.map((k) => <button key={k} type="button" role="tab" aria-selected={win === k} className={`nhlx-tab${win === k ? ' is-active' : ''}`} onClick={() => onWin(k)} title={`${WINDOW_TEXT[k]}${k === 'season' ? ': the table the board’s projections read' : ': a comparison, the projections keep this season’s table'}`}>{windowLabel(k, side.allowed, season)}</button>)}
        </div>
      ) : null}
      <div className="nhlx-pfd-wrap">
        <table className="nhlx-pfd-table">
          <thead><tr><th>Pos</th>{keys.map((k) => <th key={k} className={k === metric ? 'is-on' : ''}>{STAT_LABEL[k] || k.toUpperCase()}</th>)}</tr></thead>
          <tbody>
            {positions.map((pos) => (
              <tr key={pos} className={`${onPos ? 'is-click' : ''}${hiPos === pos ? ' is-active' : ''}`} onClick={onPos ? () => onPos(hiPos === pos ? null : pos) : undefined} aria-pressed={onPos ? hiPos === pos : undefined} title={onPos ? (hiPos === pos ? `Showing the ${pos}s on the court · press to show everyone` : `Press to pick out the ${pos}s on the court`) : undefined}>
                <td><b>{pos}</b>{hiPos === pos ? <small className="nhlx-auto-meta"> on the court</small> : null}<small className="nhlx-auto-meta" title={a.rows[pos].held ? `Last season's table (${a.rows[pos].prior || 0} games) until ${side.opp} plays its first game this season` : win === 'prior' ? `${a.rows[pos].gp || 0} games last season` : `${a.rows[pos].gp || 0} games${win === 'season' ? ' this season' : ''}`}> {a.rows[pos].held ? 'last season' : `${a.rows[pos].gp || 0} GP`}</small></td>
                {keys.map((k) => { const c = a.rows[pos][k]; const tone = zoneTone(c?.rankBlend ?? c?.rank, count); const lg = league?.[pos]?.[k]; const check = a.from === 'sheet' ? null : sheetCheck(c, count); return <td key={k} className={`${c ? `is-${tone}` : ''}${k === metric ? ' is-on' : ''}`} title={`${c && lg != null ? `${num(c.value)} against the league's ${num(lg)} at ${pos}` : ''}${check ? ` · the cheat sheet's tile: #${c.sheet} (${check === 'yes' ? 'the same third' : 'a different third'})` : ''}`}>{c ? <><span className="nhlx-pfd-val">{c.value != null ? num(c.value) : '—'}</span>{c.rank ? <span className="nhlx-pfd-rank">#{c.rank}</span> : null}</> : '—'}</td>; })}
              </tr>
            ))}
            {league ? <tr className="ir-court-league"><td><b>Lg</b></td>{keys.map((k) => { const v = Object.values(league).map((r) => r[k]).filter((x) => x != null); return <td key={k} className={k === metric ? 'is-on' : ''} title={v.length ? `The league's average ${STAT_LABEL[k] || k.toUpperCase()} a game over the positions` : ''}><span className="nhlx-pfd-val">{v.length ? num(v.reduce((x, y) => x + y, 0) / v.length) : '—'}</span></td>; })}</tr> : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Every player of the side with his props read against the matchup: the line and the chance per market. */
/** One line per player and market: his expected figure tonight, his range (floor–ceiling), and the book's line with his chance. */
function RangeCell({ p, market, final, reliability = null }) {
  const r = p.ranges?.[market];
  if (!r) return <td>—</td>;
  const play = playFor(p, market);
  const got = final && play?.actual != null ? play.actual : null;
  const ladder = p.ladders?.[market] || [];
  const title = `${p.player} · ${STAT_LABEL[market]} tonight: expected ${num(r.exp)}, between ${r.floor} and ${r.ceiling} half the nights (his own games, centred on the matchup)${r.line != null ? ` · the book's o${r.line}: ${pct(r.p)} to clear${r.odds != null ? ` at ${fmtOdds(r.odds)}` : ''}${asStated(r.raw)}` : ''}${got != null ? ` · got ${got}` : ''}\n${ladder.map((x) => `o${x.line} ${pct(x.p)}`).join(' · ')}`;
  // The chance coloured by the market's reliable threshold when the season has one (green at or over it, red under; the
  // cell filled green: a best bet as the model reads it), the old thirds without one.
  // Green when the play beats the book's price (an edge: a best bet, Vincent, 2026-10-31: "I only want to see profitable
  // bets with an edge"), red when priced without one, the old thirds without a price; the market's reliable chance on the hover.
  const over = play && (play.side === 'over' || play.side === 'yes') && !play.steep ? play : null;
  const edge = over?.edge ?? null;
  const tone = edge != null ? (edge > 0 ? 'soft' : 'tough') : r.p == null ? '' : r.p >= 0.55 ? 'soft' : r.p < 0.35 ? 'tough' : 'mid';
  const relText = `${edge != null ? ` · edge ${edge > 0 ? '+' : ''}${Math.round(edge * 100)} pts over the price${edge > 0 ? ': a best bet' : ': no bet'}` : ''}${reliableFor(reliability, market) != null ? ` · ${reliabilityText(reliability, market, STAT_LABEL[market])}` : ''}`;
  return (
    <td className={`ir-range-cell${got != null ? (got > (r.line ?? -1) ? ' is-hit' : ' is-miss') : ''}${edge != null && edge > 0 ? ' is-best' : ''}`} title={title + relText}>
      <span className="ir-range"><b>{num(r.exp, 0)}</b><small>{r.floor}–{r.ceiling}</small></span>
      {r.line != null ? <span className={`ir-range-line is-${tone}`}>o{r.line} <i>{pct(r.p)}</i></span> : <span className="ir-range-line">no line</span>}
      {got != null ? <span className="ir-range-got">got {got}</span> : null}
    </td>
  );
}

/** What the side's projections add up to: its share of the team's expected points, or why they are not scaled. */
function sideNote(side) {
  const T = side.teamProj?.pts;
  if (T == null) return '';
  const cover = side.share != null ? `${Math.round(side.share * 100)}% of the minutes` : null;
  if (side.scale?.pts == null) return ` · the team is expected to score ${num(T, 0)}${cover ? `; its priced players play ${cover}, too few to scale them` : ''}`;
  if (side.share != null && side.share < 1) return ` · its players add up to ${num(T * side.share, 0)} of the team’s ${num(T, 0)} points (${cover})`;
  return ` · the side adds up to ${num(T, 0)} points`;
}

function PlayersTable({ side, final, reliability = null }) {
  const open = useNbaPlayerCard();
  const players = side.players.filter((p) => Object.keys(p.ranges || {}).length);
  if (!players.length) return null;
  return (
    <div className="nhlx-pfd ir-court-players">
      <div className="nhlx-pfd-head"><b>Tonight · {side.team} {side.venue === 'H' ? 'vs' : 'at'} {side.opp}</b><small className="nhlx-auto-meta">per market: what he is expected to get, his floor–ceiling (he lands inside it half the nights; the top is his ceiling), and the book’s line with his chance to clear it{sideNote(side)} · click a row for the card and the full ladder</small></div>
      <div className="nhlx-pfd-wrap">
        <table className="nhlx-pfd-table ir-court-table ir-range-table">
          <thead><tr><th>Player</th><th>Pos</th>{TABLE_MARKETS.map(([k, l]) => <th key={k}>{l}</th>)}</tr></thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.key} className={`is-click${p.out ? ' is-muted' : ''}`} onClick={() => open({ key: p.key, player: p, team: side.team, opp: side.opp, venue: side.venue })}>
                <td><b>{p.player}</b>{p.injury ? <small className="nhlx-auto-meta" title={p.injuryDetail || ''}> {p.injury}</small> : null}{p.without ? <small className="nhlx-auto-meta" title={`His season read moves toward his ${p.without.n} games without ${p.without.names.join(' + ')} (weight ${p.without.weight})`}> w/o {p.without.names.join(' + ')}</small> : null}</td>
                <td>{p.slot && p.depth ? `${p.slot}${p.depth}` : p.pos || '—'}</td>
                {TABLE_MARKETS.map(([k]) => <RangeCell key={k} p={p} market={k} final={final} reliability={reliability} />)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The shuffle bar under the stat tabs: the Shuffle tab's heights for the stat, one setting for the slate; the chips read their chance at it. */
function CourtBar({ metric, side, sh, rows }) {
  const market = MARKET_OF[metric];
  const heights = sh.heightsFor(market);
  const height = sh.barOf(market);
  const state = sh.stateOf(market);
  if (!heights.length || height == null) return null;
  const label = STAT_LABEL[metric] || metric;
  const over = state === 'ready' ? [...rows.values()].filter((r) => (readAt(r, heights, height)?.p ?? 0) >= 0.5).length : null;
  return (
    <div className="ir-court-bar" role="group" aria-label={`${label} bar`}>
      <small>{label} bar</small>
      <input type="range" min={heights[0]} max={heights[heights.length - 1]} step={sh.stepOf(market)} value={height} onChange={(e) => sh.setBar(market, Number(e.target.value))} aria-label={`${label} the bar asks for`} aria-valuetext={`${height} or more ${label}`} />
      <span className="ir-court-bar-val"><b>{height}+</b><small>o{lineOf(height)}</small></span>
      <small className="ir-court-bar-note">
        {state === 'ready' ? `${over} of ${rows.size} ${side.team} player${rows.size === 1 ? '' : 's'} at 50% or better · every chip shows his chance`
          : state === 'error' ? <>the shuffle did not load ({sh.errorOf(market)}) · <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={() => sh.load(market, { again: true })}>Try again</button></>
            : 'reading every player’s chance at each height…'}
      </small>
    </div>
  );
}

function CourtCard({ side, oppOut = null, metric, onMetric, sport, final, season, reliability = null }) {
  const open = useNbaPlayerCard();
  const sh = useCourtShuffle();
  const windows = windowsOf(side.allowed);
  const [win, setWin] = useState('season');
  const [hiPos, setHiPos] = useState(null);
  const view = windows.includes(win) ? win : 'season';
  const allowed = tableFor(side.allowed, view);
  const { placed, extras } = layoutCourt(side.players);
  const count = allowed?.count || 30;
  const tones = Object.fromEntries(Object.keys(ZONES).map((z) => [z, zoneTone(allowed?.rows?.[z]?.[metric]?.rankBlend ?? allowed?.rows?.[z]?.[metric]?.rank, count)]));
  const clipId = `court-${side.team}-${side.opp}`;
  // The night's shuffle for the picked stat (one request a stat for the slate, shared by every court), this side's rows by player.
  const market = MARKET_OF[metric];
  const load = sh?.load;
  useEffect(() => { load?.(market); }, [load, market]);
  const payload = sh?.payloadFor(market) || null;
  const rows = useMemo(() => new Map((payload?.players || []).filter((r) => r.team === side.team).map((r) => [r.key, r])), [payload, side.team]);
  const heights = sh?.heightsFor(market) || [];
  const height = sh?.barOf(market) ?? null;
  const readFor = (p) => { if (!sh || height == null) return null; if (!payload) return null; const r = rows.get(p.key); return r ? readAt(r, heights, height) : false; };
  return (
    <section className="nhlx-rk-card ir-court-card" aria-label={`${side.team} court`}>
      <div className="nhlx-rk-head">
        <img src={sport.teamLogo(side.team)} alt="" width="40" height="40" loading="lazy" />
        <div><b>{sport.teamName(side.team)} <small>{side.venue === 'H' ? 'vs' : 'at'} {sport.teamName(side.opp)}</small></b></div>
      </div>
      <SidePicks side={side} sport={sport} final={final} heading={false} reliability={reliability} onOpen={(pl) => open({ key: pl.key, player: side.players.find((p) => p.key === pl.key) || null, team: side.team, opp: side.opp, venue: side.venue, market: pl.market })} />
      {/* The table, the players picker, the stat tabs with the bar, then the court: one view (Vincent, 2026-10-30: "put the
          shuffle bar right under the propfinder table so I can see the table, the bar (incl type) and the court in 1 view").
          The window tabs ride on the table (`onWin`); a window tints the zones and fills the table, the chips keep the board's figure. */}
      <AllowedTable side={side} win={view} metric={metric} season={season} onWin={setWin} onPos={setHiPos} hiPos={hiPos} />
      {/* Which players the court shows (Vincent, 2026-10-31: "an 'all' option to select all players"): All, or one position's
          chips picked out and the rest faded, the same as pressing that row of the table. */}
      <div className="nhlx-rk-toggle ir-court-pos">
        <small>Players</small>
        <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label="Which players the court picks out">
          {[null, ...POSITIONS].map((pos) => <button key={pos || 'all'} type="button" role="tab" aria-selected={hiPos === pos} className={`nhlx-tab${hiPos === pos ? ' is-active' : ''}`} onClick={() => setHiPos(pos)} title={pos ? `Pick out the ${pos}s on the court, the rest faded` : 'Every player on the court'}>{pos || 'All'}</button>)}
        </div>
      </div>
      <div className="nhlx-rk-toggle ir-court-stat">
        <small>Stat</small>
        <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label="Which stat the table, the bar and the court read">
          {COURT_METRICS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={metric === k} className={`nhlx-tab${metric === k ? ' is-active' : ''}`} onClick={() => onMetric?.(k)} title={`Marks the ${l.toLowerCase()} ${side.opp} gives up to each position in the table and tints the zones by it; the bar asks for ${l.toLowerCase()}, every chip showing his chance to clear it`}>{l}</button>)}
        </div>
        {view !== 'season' ? <small className="nhlx-rk-toggle-note">zones tinted by {windowLabel(view, side.allowed, season)}; the chips keep the board’s read off this season’s table</small> : null}
      </div>
      {sh ? <CourtBar metric={metric} side={side} sh={sh} rows={rows} /> : null}
      <div className={`nhlx-rk ir-court${hiPos ? ' is-picking' : ''}`}>
        <CourtMarkings clipId={clipId} tones={tones} />
        {Object.keys(ZONES).map((z) => {
          const [x, y, w, h] = ZONES[z];
          return (
            <div key={z} className={`ir-court-stack${hiPos === z ? ' is-hi' : ''}`} style={{ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, width: `${(w / W) * 100}%`, height: `${(h / H) * 100}%` }}>
              {placed.filter((it) => it.zone === z).map(({ p }) => <Chip key={p.key} p={p} metric={metric} height={height} read={readFor(p)} sport={sport} team={side.team} opp={side.opp} venue={side.venue} final={final} allowed={allowed} seasonAllowed={side.allowed} win={view} hi={hiPos === z} dim={!!hiPos && hiPos !== z} reliability={reliability} />)}
            </div>
          );
        })}
        {Object.keys(ZONES).map((z) => <ZoneLabel key={z} zone={z} allowed={allowed} metric={metric} opp={side.opp} win={view} />)}
      </div>
      {/* Who is out, under the court (Vincent, 2026-10-30: "who is out should be under the court"). */}
      <OutLines side={side} oppOut={oppOut} />
      {extras.length ? <p className="nhlx-rk-extras nhlx-auto-meta"><b>Also:</b> {extras.map((p) => { const read = readFor(p); const proj = boardRead(p, metric, side.allowed, envPos(p)); return `${p.player} (${p.pos || '—'}${proj.value != null ? `, ${num(proj.value)} ${STAT_LABEL[metric]} tonight` : ''}${read ? `, ${height}+ ${pct(read.p)}` : ''})`; }).join(' · ')}</p> : null}
      <PlayersTable side={side} final={final} reliability={reliability} />
    </section>
  );
}

/** The two courts of a game: the away team first, as the game head reads. */
export default function CourtPair({ g, metric, onMetric, sport, reliability = null }) {
  const sides = g.sides || {};
  const list = [sides[g.away], sides[g.home]].filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="nhlx-rink-pair ir-court-pair">
      {list.map((side) => <CourtCard key={side.team} side={side} oppOut={sides[side.opp]?.out || null} metric={metric} onMetric={onMetric} sport={sport} final={g.final} season={g.season || null} reliability={reliability} />)}
    </div>
  );
}
