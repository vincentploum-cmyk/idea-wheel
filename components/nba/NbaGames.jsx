'use client';

import { useEffect, useMemo, useState } from 'react';
import { teamLogo, teamName, teamAbbrFromText } from '@/lib/nba/teams';
import { headshotUrl } from '@/lib/nba/espn';
import { tierBoard, ladderBoard, NBA_BOARDS } from '@/lib/picks/boards';
import { AllowedTable, windowsOf, envPos as envPosOf } from './NbaCourt';
import { NbaPlayerCardProvider, useNbaPlayerCard } from './NbaPlayerCard';

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
  const rows = sh?.players ? tierBoard(sh, { step: STEP[market] || 1, gameId }) : ladderBoard(board, { market, gameId });
  // His spot on the board (the slot PropFinder's table is read at), for a pressed row of the table.
  const spot = new Map();
  for (const g of board?.games || []) for (const t of [g.away, g.home]) for (const p of g.sides?.[t]?.players || []) spot.set(`${t}|${p.key}`, p.envPos || envPosOf(p));
  return rows.map((r) => ({ ...r, envPos: spot.get(`${r.team}|${r.key}`) || null })).sort((a, b) => (b.proj ?? -1) - (a.proj ?? -1) || a.player.localeCompare(b.player));
}

function Who({ r, game = false, onOpen }) {
  return (
    <div className="nhlx-db-player">
      {r.espnId ? <img src={headshotUrl(r.espnId)} alt="" width="28" height="28" loading="lazy" /> : <img src={teamLogo(r.team)} alt="" width="28" height="28" loading="lazy" className="ir-nfl-logo" />}
      <span>
        <button type="button" className="ir-big-name" onClick={() => onOpen?.(r)}><b>{r.player}</b></button>
        <small>
          {r.team} · {r.slot && r.depth ? `${r.slot}${r.depth}` : r.pos || '—'}{game ? ` · ${r.venue === 'H' ? 'vs' : '@'} ${r.opp}` : ''}
          {r.health === 'DTD' ? <> · <span className="ir-health is-dtd">DTD</span></> : null}
          {r.caveat && r.health !== 'DTD' ? <span className="ir-bd-role is-role">{r.caveat}</span> : null}
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
          <th className="is-num ir-ml-proj" title="Tonight’s projection: his rate × tonight’s matchup (PropFinder’s table and the cheat sheet)">Proj</th>
          {TIER_COLS.map(([k, l, at]) => <th key={k} className={`ir-ml-th is-${k}`} title={`The highest mark he reaches tonight at ${at}% or better`}>{l}</th>)}
          {final ? <th className="is-num">Got</th> : null}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.team}|${r.key}`}>
              <td className="ir-slate-rank">{i + 1}</td>
              <td><Who r={r} game={game} onOpen={onOpen} /></td>
              <td className="is-num ir-ml-proj" title={r.floor != null ? `${num(r.floor)}–${num(r.ceiling)} half the nights` : ''}><b>{num(r.proj)}</b><small>{unit}</small></td>
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

/** One team's PropFinder table (what the opponent gives up per position), opening on L10, and who is out. */
function TeamTable({ side, season, metric, hiPos, onPos }) {
  const windows = windowsOf(side.allowed);
  const [win, setWin] = useState(() => (windows.includes('l10') ? 'l10' : 'season'));
  const view = windows.includes(win) ? win : 'season';
  return (
    <section className="ir-gf-team" aria-label={`${side.team} ${side.venue === 'H' ? 'vs' : 'at'} ${side.opp}`}>
      <div className="ir-gf-team-head">
        <img src={teamLogo(side.team)} alt="" width="28" height="28" loading="lazy" />
        <b>{teamName(side.team)}</b>
        <small className="nhlx-auto-meta">{side.venue === 'H' ? 'vs' : 'at'} {side.opp}</small>
      </div>
      <p className="ir-gf-out"><b>Out</b> {side.out?.length ? side.out.map((a) => `${a.name}${a.status && a.status !== 'Out' ? ` (${a.status})` : ''}`).join(' · ') : 'nobody listed'}</p>
      <AllowedTable side={side} win={view} metric={metric} season={season} onWin={setWin} onPos={onPos} hiPos={hiPos} sheetMarks pickWord="in the list" />
    </section>
  );
}

const NO_DATA = 'No projection yet: the night needs a PropFinder pull.';

/**
 * One game as a sportsbook lists it (the NFL's `GameRow`): the matchup and the tip, a row a team with its logo, its
 * spread and the total; press it for the stat tabs, PropFinder's table for each team (a pressed row keeps that team's
 * players at that position) and both teams' players with their ladders.
 */
function GameRow({ g, board, shuffles, onOpen, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [market, setMarket] = useState('pts');
  const [pick, setPick] = useState(null);   // { team, pos } from a pressed row of a PropFinder table
  const live = !g.final && g.state === 'in';
  const scored = g.final || live;
  const status = g.final ? 'Final' : live ? 'Live' : tip(g.date);
  const total = g.odds?.total != null ? g.odds.total : null;
  const rows = useMemo(() => (open ? tierRows(board, shuffles, market, g.id) : []), [open, board, shuffles, market, g.id]);
  const shown = pick ? rows.filter((r) => r.team === pick.team && r.envPos === pick.pos) : rows;
  const team = (abbr, side) => {
    const score = side === 'away' ? g.awayScore : g.homeScore;
    const sp = spreadFor(g.odds, abbr);
    return (
      <span className="ir-gm-team">
        <img src={teamLogo(abbr)} alt="" width="34" height="34" className="ir-nfl-logo" />
        <span className="ir-gm-name">{teamName(abbr)}</span>
        {scored && score != null ? <b className="ir-gm-score">{score}</b> : <span />}
        <span className={`ir-gm-box${sp ? '' : ' is-empty'}`}>{sp || '—'}</span>
        <span className={`ir-gm-box${total != null ? '' : ' is-empty'}`}>{total != null ? `${side === 'away' ? 'O' : 'U'} ${total}` : '—'}</span>
      </span>
    );
  };
  const sides = [g.away, g.home].map((t) => g.sides?.[t]).filter(Boolean);
  return (
    <section className={`ir-gm${open ? ' is-open' : ''}`} aria-label={`${g.away} at ${g.home}`}>
      <button type="button" className="ir-gm-top" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="ir-gm-title">{g.away} {teamName(g.away)} @ {g.home} {teamName(g.home)}<i aria-hidden="true">›</i></span>
        <span className="ir-gm-time">{status}</span>
        {team(g.away, 'away')}
        {team(g.home, 'home')}
      </button>
      {open ? (
        <div className="ir-gm-detail">
          <div className="nhlx-tabs is-pills is-small" role="tablist" aria-label="Stat">
            {NBA_STATS.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={market === k} className={`nhlx-tab${market === k ? ' is-active' : ''}`} onClick={() => setMarket(k)}>{l}</button>)}
          </div>
          {sides.length ? (
            <div className="ir-gm-pf">
              {sides.map((s) => <TeamTable key={s.team} side={s} season={board.season} metric={market} hiPos={pick?.team === s.team ? pick.pos : null} onPos={(pos) => setPick(pos ? { team: s.team, pos } : null)} />)}
            </div>
          ) : null}
          <div className="nhlx-pfd-head ir-gm-players">
            <b>{pick ? `${pick.team}’s ${pick.pos}s` : 'Players'} · {NBA_STATS.find(([k]) => k === market)[1]}</b>
            {pick ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={() => setPick(null)}>Both teams</button> : null}
            {!shuffles?.[market] ? <small className="nhlx-auto-meta">the book’s rungs until the round marks load</small> : null}
          </div>
          {shown.length ? <TierTable rows={shown} market={market} onOpen={onOpen} /> : <p className="nhlx-auto-meta ir-ml-empty">{rows.length ? `No ${pick?.pos} of ${pick?.team} on this ladder.` : NO_DATA}</p>}
        </div>
      ) : null}
    </section>
  );
}

const LEGEND = (
  <p className="nhlx-auto-meta ir-bd-legend">
    Each mark is the highest he reaches tonight at that chance: <b>strong</b> 70%+ · <b>lean</b> 55%+ · <b>thin</b> 40%+ — his projection × tonight’s matchup (PropFinder’s table and the cheat sheet). The tables are PropFinder’s: what each defense gives up per game to each position, rank 1 = the most, ✓ / ✗ the cheat sheet’s tile; press a row for that team’s players at the position. <span className="ir-bd-role is-role">if role confirmed</span> thin minutes. Click a name for his card.
  </p>
);

function useOpenRow(board) {
  const open = useNbaPlayerCard();
  return (r) => {
    const side = (board.games || []).find((g) => String(g.id) === String(r.game))?.sides?.[r.team];
    open({ key: r.key, player: side?.players?.find((p) => p.key === r.key) || r, team: r.team, opp: r.opp, venue: r.venue, market: r.market });
  };
}

function GamesInner({ board, shuffles, openFirst = false }) {
  const onOpen = useOpenRow(board);
  return (
    <div className="ir-gm-list is-wide">
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
