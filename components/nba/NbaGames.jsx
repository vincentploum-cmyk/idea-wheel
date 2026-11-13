'use client';

import { useEffect, useMemo, useState } from 'react';
import { teamLogo, teamName, teamAbbrFromText } from '@/lib/nba/teams';
import { headshotUrl } from '@/lib/nba/espn';
import { tierBoard, ladderBoard, withEveryone, NBA_BOARDS } from '@/lib/picks/boards';
import { AllowedTable, windowsOf, tableFor, windowLabel, zoneTone, envPos as envPosOf } from './NbaCourt';
import { NbaPlayerCardProvider, useNbaPlayerCard, WoEdgeTag } from './NbaPlayerCard';
import NbaSoftSpots from './NbaSoftSpots';

// The NBA page laid out as the NFL's (Vincent, 2026-11-01: "for nba, I need the same layout as nfl with as addition the
// propfinder tables for each game when clicking on the game"): the night's games as a sportsbook lists them, each opening
// on PropFinder's tables (what each defense gives up per position, both teams) and its players with their ladders —
// strong / lean / thin, the highest round mark each clears at the board's chance (lib/picks/boards.js, the Boards tab's
// read off the shuffle: 70% / 55% / 40%) — per stat; and the same list across the slate (`NbaStatList`). No price, no edge.

export const NBA_STATS = [['pts', 'Points'], ['reb', 'Rebounds'], ['ast', 'Assists'], ['tpm', 'Threes'], ['pra', 'PRA']];
const UNIT = { pts: 'pts', reb: 'reb', ast: 'ast', tpm: '3PM', pra: 'PRA' };
const STEP = Object.fromEntries(NBA_BOARDS.filter((b) => b.kind === 'ladder').map((b) => [b.market, b.step || 1]));
const TIER_COLS = [['strong', 'Strong', '70'], ['lean', 'Lean', '55'], ['thin', 'Thin', '40']];
const SHOW = 40;
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));

/**
 * The slate's shuffle per stat (one request a stat, the Shuffle tab's and the courts' read: every player at every height
 * of the bar), so the ladders read round marks; `{}` until they arrive, the book's rungs standing in meanwhile.
 */
export function useNbaShuffles(date) {
  const [state, setState] = useState({ date: null, by: {} });
  useEffect(() => {
    if (!date) return undefined;
    let live = true;
    for (const [m] of NBA_STATS) {
      fetch(`/api/nba/shuffle?date=${date}&market=${m}`, { cache: 'no-store' })
        .then((res) => (res.ok ? res.json() : null))
        .then((j) => { if (live && j?.players) setState((prev) => ({ date, by: { ...(prev.date === date ? prev.by : {}), [m]: j } })); })
        .catch(() => {});
    }
    return () => { live = false; };
  }, [date]);
  return state.date === date ? state.by : {};
}

/** The rows of a stat's list: round marks off the shuffle once loaded (else the book's rungs), the highest projection first. */
export function tierRows(board, shuffles, market, gameId = null) {
  const sh = shuffles?.[market];
  // Every active player is listed (`withEveryone`): one without a ladder for the stat reads 0, one without a game in the pull "—".
  const rows = withEveryone(board, sh?.players ? tierBoard(sh, { step: STEP[market] || 1, gameId, keepAll: true }) : ladderBoard(board, { market, gameId, keepAll: true }), { market, gameId });
  // His spot on the board (the slot PropFinder's table is read at), for a pressed row of the table.
  const spot = new Map();
  // His priced line of the stat with the widest without-teammates edge (board.js WO_EDGE), for the row's "w/o edge" tag.
  const wo = new Map();
  // His Q1 read for the stat (lib/nba/quarter.js, put on the board by boardFor): the row's Q1 badge.
  const q1 = new Map();
  for (const g of board?.games || []) for (const t of [g.away, g.home]) for (const p of g.sides?.[t]?.players || []) {
    spot.set(`${t}|${p.key}`, p.envPos || envPosOf(p));
    if (p.q1?.[market]) q1.set(`${t}|${p.key}`, p.q1[market]);
    for (const x of p.plays || []) {
      const e = x.market === market ? x.without?.edge : null;
      if (!e) continue;
      const k = `${t}|${p.key}`; const prev = wo.get(k);
      if (!prev || e.gap > prev.gap) wo.set(k, { ...e, line: x.line, side: x.side, names: x.without.names || [] });
    }
  }
  return rows.map((r) => ({ ...r, envPos: spot.get(`${r.team}|${r.key}`) || null, woEdge: wo.get(`${r.team}|${r.key}`) || null, q1: q1.get(`${r.team}|${r.key}`) || null })).sort((a, b) => (b.proj ?? -1) - (a.proj ?? -1) || a.player.localeCompare(b.player));
}

function Who({ r, game = false, onOpen }) {
  return (
    <div className="nhlx-db-player">
      {r.espnId ? <img src={headshotUrl(r.espnId)} alt="" width="28" height="28" loading="lazy" /> : <img src={teamLogo(r.team)} alt="" width="28" height="28" loading="lazy" className="ir-nfl-logo" />}
      <span>
        <button type="button" className="ir-big-name" onClick={() => onOpen?.(r)}><b>{r.player}</b></button>
        {r.q1 ? <i className={`nhlx-rk-per-b ir-q1 is-${r.q1.tone}`} title={`${r.q1.text} · green = the opponent's 1st quarter and his own both lean good, red = both lean bad, amber = they cancel out or sit in the middle`}>Q1</i> : null}
        <small>
          {r.team} · {r.slot && r.depth ? `${r.slot}${r.depth}` : r.pos || '—'}{game ? ` · ${r.venue === 'H' ? 'vs' : '@'} ${r.opp}` : ''}
          {r.health === 'DTD' ? <> · <span className="ir-health is-dtd">DTD</span></> : null}
          {r.caveat && r.health !== 'DTD' ? <span className="ir-bd-role is-role">{r.caveat}</span> : null}
          {r.woEdge ? <WoEdgeTag e={r.woEdge} /> : null}
        </small>
      </span>
    </div>
  );
}

/** One rung: "20+ pts" over its chance; green / red once the game is in. */
function Rung({ m, unit, actual }) {
  if (!m) return <small className="ir-ml-none">—</small>;
  const at = parseInt(m.mark, 10);
  const hit = actual == null ? '' : actual >= at ? ' is-hit' : ' is-miss';
  return <span className={`ir-ml-rung${hit}`}><b>{m.mark} {unit}</b><small>{pct(m.p)}</small></span>;
}

function TierTable({ rows, market, game = false, onOpen }) {
  const unit = UNIT[market] || '';
  const final = rows.some((r) => r.final);
  return (
    <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
      <table className="nhlx-db-table nhlx-pk-table ir-ml-table">
        <thead><tr>
          <th className="ir-slate-rank">#</th><th>Player</th>
          <th className="is-num ir-ml-proj" title="Tonight’s projection: his rate × tonight’s matchup (what the defense gives up to all positions, PropFinder)">Proj</th>
          <th className="is-num ir-ml-fc" title="His floor tonight: he lands under it one night in four">Floor</th>
          <th className="is-num ir-ml-fc" title="His ceiling tonight: he lands over it one night in four (the Big games tab lists the nights far over it)">Ceiling</th>
          {TIER_COLS.map(([k, l, at]) => <th key={k} className={`ir-ml-th is-${k}`} title={`The highest mark he reaches tonight at ${at}% or better`}>{l}</th>)}
          {final ? <th className="is-num">Got</th> : null}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.team}|${r.key}`}>
              <td className="ir-slate-rank">{i + 1}</td>
              <td><Who r={r} game={game} onOpen={onOpen} /></td>
              <td className="is-num ir-ml-proj" title={r.noLogs ? 'No game of his in the PropFinder pull yet: nothing to project from' : r.floor != null ? `${num(r.floor, 0)}–${num(r.ceiling, 0)} half the nights` : ''}><b>{num(r.proj)}</b><small>{r.noLogs ? 'no games yet' : unit}</small></td>
              <td className="is-num ir-ml-fc">{r.floor != null ? <b>{num(r.floor, 0)}</b> : <small>—</small>}</td>
              <td className="is-num ir-ml-fc">{r.ceiling != null ? <b>{num(r.ceiling, 0)}</b> : <small>—</small>}</td>
              {TIER_COLS.map(([k]) => <td key={k} className={`ir-ml-cell is-${k}`}><Rung m={r[k]} unit={unit} actual={r.final ? r.actual : null} /></td>)}
              {final ? <td className="is-num nhlx-pk-got">{r.actual === undefined ? <small>—</small> : r.actual === null ? <small>DNP</small> : <b>{r.actual}</b>}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** A team's spread as the book writes it on its row ("+2.5", "-2.5", "PK"), from ESPN's "DET -2.5". */
export function spreadFor(odds, team) {
  const s = String(odds?.spread || '').trim();
  if (!s) return null;
  if (/^(even|pk|pick)/i.test(s)) return 'PK';
  const m = s.match(/^([A-Z]{2,4})\s*([+-]?\d+(?:\.\d+)?)$/i);
  if (!m) return null;
  const pts = Math.abs(Number(m[2]));
  if (!Number.isFinite(pts)) return null;
  if (!pts) return 'PK';
  const fav = teamAbbrFromText(m[1]) || m[1].toUpperCase();
  return fav === team ? `-${pts}` : `+${pts}`;
}
const tip = (iso) => (iso ? `${new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }).replace(' ', '')} ET` : '');

export const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];

/**
 * One defense and the players who face it (Vincent, 2026-11-01: "when clicking on a game, I need first the propfinder
 * table and then the players of the opponent underneath with their projections. I should be able to check easily per
 * position and type"): headed by the defending team, its PropFinder table (what it gives up per game to each position,
 * opening on L10, the cheat sheet's ✓ / ✗ in each cell, the picked stat's column and position's row marked; a pressed row
 * picks the position), the table's cell for the pick in a line, then the opposing team's players at that position with
 * their ladders, the highest projection first, and who is out on that team.
 */
const VERDICT_WORDS = { soft: 'gives up a lot of', mid: 'gives up an average number of', tough: 'gives up few' };
const VERDICT_NOUN = { pts: 'points', reb: 'rebounds', ast: 'assists', tpm: 'threes', pra: 'points + rebounds + assists' };

/**
 * The defense's headline for the stat (Vincent, 2026-11-10: "so that I can quickly see if the specific team allows shots or
 * not", the NHL rink's verdict): what it gives up to all positions this season, as words tinted by its third — green "gives up
 * a lot of points", amber "an average number of", red "few" — with the figure, the rank and the league's.
 */
export function AllowsVerdict({ side, all, market, unit }) {
  const tone = zoneTone(all.rank, all.count);
  const title = `${teamName(side.opp)} gives up ${num(all.value)} ${unit} a game to all positions this season${side.against?.gp ? ` (${side.against.gp} games)` : ''}${all.l10 != null ? ` · ${num(all.l10)} over its last ten` : ''}${all.league != null ? ` · the league ${num(all.league)}` : ''} · rank 1 = the most; green = the top third, red = the bottom third`;
  return <span className={`ir-gm-cell ir-gm-verdict is-${tone}`} title={title}>{side.opp} <b>{VERDICT_WORDS[tone] || 'gives up'} {VERDICT_NOUN[market] || unit}</b> · {num(all.value)} a game · #{all.rank} of {all.count}{all.league != null ? ` · league ${num(all.league)}` : ''}</span>;
}

export function DefenseBlock({ side, season, market, pos, onPos, rows, onOpen, shuffled }) {
  const windows = windowsOf(side.allowed);
  const [win, setWin] = useState(() => (windows.includes('l10') ? 'l10' : 'season'));
  const view = windows.includes(win) ? win : 'season';
  const table = side.allowed ? tableFor(side.allowed, view) : null;
  const count = table?.count || 30;
  const cell = pos ? table?.rows?.[pos]?.[market] : null;
  const lg = pos ? (table?.league || side.allowed?.league)?.[pos]?.[market] ?? null : null;
  const unit = UNIT[market] || market;
  const mine = rows.filter((r) => r.team === side.team && (!pos || r.envPos === pos));
  // What the defense gives up in all positions this season (the board's matchup for the stat), and for threes the threes it lets
  // teams attempt — at the picked position on the table's window and in all (Vincent, 2026-11-03: "if propfinder gives us the
  // allowed 3 pt attempts, we need to display that also").
  const all = side.against?.stats?.[market] || null;
  const tpaCell = market === 'tpm' && pos ? table?.rows?.[pos]?.tpa || null : null;
  const tpaAll = market === 'tpm' ? side.against?.stats?.tpa || null : null;
  return (
    <section className="ir-gm-def" aria-label={`${side.opp} defense against ${side.team}`}>
      <div className="ir-gf-team-head">
        <img src={teamLogo(side.opp)} alt="" width="28" height="28" loading="lazy" />
        <b>{teamName(side.opp)} defense</b>
        <small className="nhlx-auto-meta">against</small>
        <img src={teamLogo(side.team)} alt="" width="22" height="22" loading="lazy" />
        <b className="ir-gm-def-vs">{teamName(side.team)}</b>
      </div>
      <AllowedTable side={side} win={view} metric={market} season={season} onWin={setWin} onPos={onPos} hiPos={pos} sheetMarks pickWord="below" />
      <div className="nhlx-pfd-head ir-gm-players">
        <b>{side.team}’s {pos ? `${pos}s` : 'players'} · {NBA_STATS.find(([k]) => k === market)[1]}</b>
        {all ? <AllowsVerdict side={side} all={all} market={market} unit={unit} /> : null}
        {cell ? <span className={`ir-gm-cell is-${zoneTone(cell.rankBlend ?? cell.rank, count)}`} title={lg != null ? `The league's average at ${pos}: ${num(lg)} a game` : ''}>{side.opp} gives up {num(cell.value)} {unit} a game to {pos}s{cell.rank ? ` · #${cell.rank} of ${count}` : ''} · {windowLabel(view, side.allowed, season)}{lg != null ? ` · league ${num(lg)}` : ''}</span> : null}
        {tpaCell || tpaAll ? <span className={`ir-gm-cell is-${zoneTone(tpaAll?.rank ?? tpaCell?.rank, tpaAll?.count ?? count)}`} title={`Three-point attempts ${teamName(side.opp)} allows a game (PropFinder): more attempts, more threes made — the threes' matchup on the board${tpaAll?.l10 != null ? ` · ${num(tpaAll.l10)} over its last ten` : ''}`}>3PA allowed{tpaCell ? ` · ${num(tpaCell.value)} to ${pos}s${tpaCell.rank ? ` (#${tpaCell.rank})` : ''}` : ''}{tpaAll ? ` · ${num(tpaAll.value)} in all (#${tpaAll.rank} of ${tpaAll.count}${tpaAll.league != null ? `, league ${num(tpaAll.league)}` : ''})` : ''}</span> : null}
        {!shuffled ? <small className="nhlx-auto-meta">the book’s rungs until the round marks load</small> : null}
      </div>
      {mine.length ? <TierTable rows={mine} market={market} onOpen={onOpen} /> : <p className="nhlx-auto-meta ir-ml-empty">{rows.length ? `No ${pos ? `${pos} of ` : 'player of '}${side.team} on this ladder.` : NO_DATA}</p>}
      <p className="ir-gf-out"><b>{side.team} out</b> {side.out?.length ? side.out.map((a) => `${a.name}${a.status && a.status !== 'Out' ? ` (${a.status})` : ''}`).join(' · ') : 'nobody listed'}</p>
    </section>
  );
}

const NO_DATA = 'No projection yet: the night needs a PropFinder pull.';

/**
 * The model's expected score for a game (Vincent, 2026-11-05: "show the expected score in grey"): each side's `teamProj.pts`,
 * its own points a game through what the opponent allows (lib/picks/board.js sidesOf). Information, not a pick: replayed against
 * DraftKings' lines over 2025-26 (978 games) its side of the spread was right 48% of the time and of the total 49%, under the
 * 52.4% a -110 bet needs, home court or a stronger opponent read added none of it back — so it is grey, never green.
 */
export function modelScore(g) {
  const a = g?.sides?.[g.away]?.teamProj?.pts; const h = g?.sides?.[g.home]?.teamProj?.pts;
  return a != null && h != null ? { away: a, home: h } : null;
}
const MODEL_SCORE_TITLE = 'The model’s expected points: each team’s own points a game through what the opponent allows (PropFinder). Information, not a pick: against DraftKings’ lines over 2025-26 it called the spread right 48% of the time and the total 49%, under the 52.4% a bet at -110 needs.';

const clock = (iso) => (iso ? new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : '');
/**
 * Beside a team in the games list: RotoWire's word on its starting five (Vincent, 2026-11-04: "a 'lineups confirmed' message
 * next to the teams when the lineups are confirmed from rotowire / espn"; lib/nba/rotowire.js, `board.lineups`): "Lineup
 * confirmed" once RotoWire confirms it, "Expected lineup" before; the five and who may not play on the hover.
 */
export function LineupTag({ lineup, at = null }) {
  if (!lineup?.status) return null;
  const five = (lineup.starters || []).map((p) => `${p.pos ? `${p.pos} ` : ''}${p.name}`).join(', ');
  const doubt = (lineup.mayNotPlay || []).map((p) => `${p.name}${p.status ? ` (${p.status})` : ''}`).join(', ');
  const title = `RotoWire${at ? `, read ${clock(at)} ET` : ''}: ${lineup.status === 'confirmed' ? 'confirmed' : 'expected'} starting five${five ? ` · ${five}` : ''}${doubt ? ` · may not play: ${doubt}` : ''}`;
  return lineup.status === 'confirmed'
    ? <small className="ir-gm-lineup is-confirmed" title={title}>✓ Lineup confirmed</small>
    : <small className="ir-gm-lineup" title={title}>Expected lineup</small>;
}

/**
 * One game as a sportsbook lists it (the NFL's `GameRow`): the matchup and the tip, a row a team with its logo, its
 * spread and the total; press it for the stat and position pills, then each defense in turn: its PropFinder table and
 * the opposing team's players under it with their ladders (`DefenseBlock`).
 */
function GameRow({ g, board, shuffles, onOpen, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [market, setMarket] = useState('pts');
  const [pos, setPos] = useState(null);   // the position picked: the pills or a pressed row of a table, both defenses
  const live = !g.final && g.state === 'in';
  const scored = g.final || live;
  const status = g.final ? 'Final' : live ? 'Live' : tip(g.date);
  const total = g.odds?.total != null ? g.odds.total : null;
  const rows = useMemo(() => (open ? tierRows(board, shuffles, market, g.id) : []), [open, board, shuffles, market, g.id]);
  const team = (abbr, side) => {
    const score = side === 'away' ? g.awayScore : g.homeScore;
    const sp = spreadFor(g.odds, abbr);
    return (
      <span className="ir-gm-team">
        <img src={teamLogo(abbr)} alt="" width="34" height="34" className="ir-nfl-logo" />
        <span className="ir-gm-name">{teamName(abbr)}{!g.final ? <LineupTag lineup={board?.lineups?.teams?.[abbr]} at={board?.lineups?.at} /> : null}</span>
        {scored && score != null ? <b className="ir-gm-score">{score}</b> : <span />}
        <span className={`ir-gm-box${sp ? '' : ' is-empty'}`}>{sp || '—'}</span>
        <span className={`ir-gm-box${total != null ? '' : ' is-empty'}`}>{total != null ? `${side === 'away' ? 'O' : 'U'} ${total}` : '—'}</span>
      </span>
    );
  };
  const sides = [g.away, g.home].map((t) => g.sides?.[t]).filter(Boolean);
  const expected = modelScore(g);
  return (
    <section className={`ir-gm${open ? ' is-open' : ''}`} aria-label={`${g.away} at ${g.home}`}>
      <button type="button" className="ir-gm-top" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="ir-gm-title">{g.away} {teamName(g.away)} @ {g.home} {teamName(g.home)}<i aria-hidden="true">›</i></span>
        <span className="ir-gm-time">{status}</span>
        {team(g.away, 'away')}
        {team(g.home, 'home')}
        {expected && !g.final ? <span className="ir-gm-model" title={MODEL_SCORE_TITLE}>Model: {g.away} {Math.round(expected.away)} – {g.home} {Math.round(expected.home)} · total {Math.round(expected.away + expected.home)}</span> : null}
      </button>
      {open ? (
        <div className="ir-gm-detail">
          <div className="ir-gm-picks">
            <div className="nhlx-tabs is-pills is-small" role="tablist" aria-label="Stat">
              {NBA_STATS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={market === k} className={`nhlx-tab${market === k ? ' is-active' : ''}`} onClick={() => setMarket(k)}>{l}</button>)}
            </div>
            <div className="nhlx-tabs is-pills is-small" role="tablist" aria-label="Position">
              {[null, ...POSITIONS].map((k) => <button key={k || 'all'} type="button" role="tab" aria-selected={pos === k} className={`nhlx-tab${pos === k ? ' is-active' : ''}`} onClick={() => setPos(k)}>{k || 'All'}</button>)}
            </div>
          </div>
          {sides.length ? sides.map((s) => <DefenseBlock key={s.team} side={s} season={board.season} market={market} pos={pos} onPos={setPos} rows={rows} onOpen={onOpen} shuffled={!!shuffles?.[market]} />) : <p className="nhlx-auto-meta ir-ml-empty">{NO_DATA}</p>}
        </div>
      ) : null}
    </section>
  );
}

const LEGEND = (
  <p className="nhlx-auto-meta ir-bd-legend">
    Each mark is the highest he reaches tonight at that chance: <b>strong</b> 70%+ · <b>lean</b> 55%+ · <b>thin</b> 40%+ — his projection × tonight’s matchup (what the defense gives up to all positions, PropFinder). Each defense’s PropFinder table comes first — what it gives up per game to each position, rank 1 = the most — and the players who face it under it; pick a stat and a position (or press a row of a table) to narrow both. <span className="ir-bd-role is-role">if role confirmed</span> thin minutes. Click a name for his card.
  </p>
);

function useOpenRow(board) {
  const open = useNbaPlayerCard();
  return (r) => {
    const side = (board.games || []).find((g) => String(g.id) === String(r.game))?.sides?.[r.team];
    open({ key: r.key, player: side?.players?.find((p) => p.key === r.key) || r, team: r.team, opp: r.opp, venue: r.venue, market: r.market });
  };
}

/**
 * The site header's height as `--nhlx-header-h` on the page (it wraps on a phone), so an opened game's stat and position pills
 * can stick right under it (Vincent, 2026-11-13: "the top row of threes, rebounds etc should be frozen so I can easily toggle
 * whenever I'm in the middle of the page").
 */
function useHeaderHeight() {
  useEffect(() => {
    const el = document.querySelector('.nhlx-header');
    if (!el) return undefined;
    const root = document.documentElement;
    const set = () => root.style.setProperty('--nhlx-header-h', `${Math.round(el.getBoundingClientRect().height)}px`);
    set();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(set) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
}

function GamesInner({ board, shuffles, openFirst = false }) {
  const onOpen = useOpenRow(board);
  useHeaderHeight();
  return (
    <div className="ir-gm-list is-wide">
      {/* The soft spots (the regulars facing one of the five defenses that give up the most to their position): on Games since
          2026-11-11, the Best plays board they were built for being off the page. */}
      <NbaSoftSpots board={board} sport={{ headshotUrl, teamLogo }} onOpen={onOpen} plain />
      <div className="ir-gm-cols" aria-hidden="true"><span>Spread</span><span>Total</span></div>
      {board.games.map((g, i) => <GameRow key={g.id} g={g} board={board} shuffles={shuffles} onOpen={onOpen} defaultOpen={openFirst && i === 0} />)}
      {LEGEND}
    </div>
  );
}

/** The Games tab: the night's games as a sportsbook lists them, each opening on PropFinder's tables and its players. */
export function NbaGames({ board, shuffles, openFirst = false }) {
  if (!board?.games?.length) return <div className="nhlx-empty">No games on this date.</div>;
  return <NbaPlayerCardProvider date={board.date}><GamesInner board={board} shuffles={shuffles} openFirst={openFirst} /></NbaPlayerCardProvider>;
}

function ListInner({ board, shuffles, market }) {
  const onOpen = useOpenRow(board);
  const [all, setAll] = useState(false);
  const rows = useMemo(() => tierRows(board, shuffles, market), [board, shuffles, market]);
  if (!rows.length) return <div className="nhlx-empty">{NO_DATA}</div>;
  const shown = all ? rows : rows.slice(0, SHOW);
  return (
    <div className="ir-overview">
      {LEGEND}
      {!shuffles?.[market] ? <p className="nhlx-auto-meta">The book’s rungs until the round marks load.</p> : null}
      <TierTable rows={shown} market={market} game onOpen={onOpen} />
      {!all && rows.length > SHOW ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-slate-more" onClick={() => setAll(true)}>Show all {rows.length}</button> : null}
    </div>
  );
}

/** One stat's list across every game of the night: 'pts' | 'reb' | 'ast' | 'tpm' | 'pra'. */
export function NbaStatList({ board, shuffles, market }) {
  if (!board?.games?.length) return <div className="nhlx-empty">No games on this date.</div>;
  return <NbaPlayerCardProvider date={board.date}><ListInner board={board} shuffles={shuffles} market={market} /></NbaPlayerCardProvider>;
}

export default NbaGames;
