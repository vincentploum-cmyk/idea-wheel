'use client';

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MARKETS, statOf } from '@/lib/nba/markets';
import { teamLogo, teamName } from '@/lib/nba/teams';
import { headshotUrl } from '@/lib/nba/espn';
import { fmtOdds } from '@/lib/nfl/odds';
import { projectFor } from '@/lib/picks/projection';

// The NBA player card, laid out as the NHL card (components/nhl/PlayerCard.jsx): the top bar
// (team logo, position, tonight's game, the season averages), market tabs carrying the hit rate for
// the pressed split, the Over + line block with the chance, the per-game bars (green over the line,
// red under, the average pill), the split tiles (L5 · L10 · L20 · season · H2H · home / away; press
// one to draw its games), the splits table, and on the right what the opponent gives up at every
// position with the league rank. Any chip or table row opens it: const open = useNbaPlayerCard();
// open({ key, player, team, opp, venue, market }). The logs and the opponent's rows come from
// /api/nba/player; the plays (lines, chances) ride in from the opener.
const Ctx = createContext(() => {});
const DateCtx = createContext('');
export const useNbaPlayerCard = () => useContext(Ctx);

const TABS = [['pts', 'Points', 'PTS'], ['reb', 'Rebounds', 'REB'], ['ast', 'Assists', 'AST'], ['tpm', '3-pointers', '3PM'], ['pra', 'Pts + reb + ast', 'PRA'], ['pr', 'Pts + reb', 'PR'], ['pa', 'Pts + ast', 'PA'], ['ra', 'Reb + ast', 'RA'], ['stl', 'Steals', 'STL'], ['blk', 'Blocks', 'BLK'], ['tov', 'Turnovers', 'TO']];
const STAT_LABEL = { pts: 'PTS', reb: 'REB', ast: 'AST', tpm: '3PM', pra: 'PRA', pr: 'PR', pa: 'PA', ra: 'RA', stl: 'STL', blk: 'BLK', tov: 'TO', ftm: 'FTM', fgm: 'FGM', min: 'MIN', usg: 'USG%', rebCh: 'REB CH', potAst: 'POT AST' };
// Per-game figures that are not markets: read straight off the game row.
const RAW = new Set(['min', 'usg', 'rebCh', 'potAst']);
const POSITIONS = ['PG', 'SG', 'SF', 'PF', 'C'];
const SEASON_MIN = 10;   // the season split is last season's (his last 82) until this one has ten games
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const pct = (r) => (r == null ? '—' : `${Math.round(r * 100)}%`);
const mdy = (iso) => (iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}/${iso.slice(2, 4)}` : '');
const seasonTag = (season) => (season ? `'${String(season).slice(2)}-'${String(season + 1).slice(2)}` : 'Season');

/** League rank (1 = most permissive) → 'soft' | 'mid' | 'tough' | 'none'. */
const tone = (rank, teams) => { if (!rank || !teams) return 'none'; const third = Math.ceil(teams / 3); return rank <= third ? 'soft' : rank > teams - third ? 'tough' : 'mid'; };

/** Hit rate over a line on a list of games for a market: { hits, gp, rate }. */
export function hitRate(games, market, line) {
  const vals = games.map((g) => statOf(g, market)).filter((v) => v != null);
  const hits = vals.filter((v) => v > line).length;
  return { hits, gp: vals.length, rate: vals.length ? hits / vals.length : null };
}

/** The games a split draws from a player's logs (newest first): l5 / l10 / l20 / season / h2h / venue. */
export function splitGames(games, span, { season, opp, venue }) {
  if (span === 'h2h') return games.filter((g) => g.opp === opp);
  if (span === 'venue') return games.filter((g) => (venue === 'H' ? g.home === true || g.home === 1 : g.home === false || g.home === 0));
  if (span === 'season') { const szn = games.filter((g) => g.season === season); return szn.length >= SEASON_MIN ? szn : games.slice(0, 82); }
  return games.slice(0, Number(span.slice(1)));
}

function Pct({ rate }) {
  if (rate == null) return <span className="nhlx-pct is-none">—</span>;
  return <span className={`nhlx-pct ${rate >= 0.5 ? 'is-good' : 'is-bad'}`}>{pct(rate)}</span>;
}

function RateTile({ label, hit, active, onClick }) {
  const cls = !hit?.gp ? 'is-none' : hit.rate >= 0.5 ? 'is-good' : 'is-bad';
  return (
    <button type="button" className={`nhlx-rate ${cls}${active ? ' is-active' : ''}`} onClick={onClick} disabled={!hit?.gp} aria-pressed={active}>
      <small>{label}</small>
      <b>{hit?.gp ? `${hit.hits}/${hit.gp}` : '—'}</b>
      <span>{hit?.gp ? pct(hit.rate) : ''}</span>
    </button>
  );
}

/** Per-game bars against the line, PropFinder's way: green over, red under, the average pill at the right. */
function Bars({ games, market, line, unit }) {
  const [hover, setHover] = useState(null);
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
  const list = [...games].reverse();   // oldest left, newest right
  const n = list.length;
  const padL = 30; const padR = 70; const padB = 36; const padT = 18; const H = 230;
  const slot = Math.max(28, Math.min(120, Math.floor((width - padL - padR) / Math.max(n, 1))));
  const W = padL + n * slot + padR;
  const vals = list.map((g) => statOf(g, market) ?? 0);
  const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  const max = Math.max(Math.ceil(line) + 1, ...vals, 1);
  const y = (v) => padT + (H - padT - padB) * (1 - v / max);
  const step = max <= 8 ? 1 : max <= 16 ? 2 : max <= 40 ? 5 : 10;
  const ticks = Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
  const bw = Math.max(8, slot * 0.78);
  return (
    <div className="nhlx-hist">
      <div className="nhlx-hist-scroll" ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, minWidth: '100%' }} role="img" aria-label={`${unit} per game, ${n} games`}>
          {ticks.map((t) => <g key={t}><line x1={padL} x2={W - padR + 10} y1={y(t)} y2={y(t)} className="nhlx-hist-grid" /><text x={padL - 8} y={y(t) + 4} className="nhlx-hist-tick" textAnchor="end">{t}</text></g>)}
          <line x1={padL} x2={W - padR + 10} y1={y(0)} y2={y(0)} className="nhlx-hist-base" />
          {list.map((g, i) => {
            const v = vals[i];
            const x = padL + i * slot + (slot - bw) / 2;
            const top = y(v); const h = Math.max(0, y(0) - top);
            return (
              <g key={`${g.date}-${i}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <rect x={padL + i * slot} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
                {v > 0 ? <rect x={x} y={top} width={bw} height={h} className={v > line ? 'nhlx-hist-over' : 'nhlx-hist-under'} /> : <rect x={x} y={y(0) - 3} width={bw} height={3} className="nhlx-hist-under" />}
                {v > 0 && h > 16 ? <text x={x + bw / 2} y={top + 14} className="nhlx-hist-val" textAnchor="middle">{v}</text> : <text x={x + bw / 2} y={top - 5} className="nhlx-hist-val is-out" textAnchor="middle">{v}</text>}
                {(slot >= 40 || i % 2 === 0) && <><text x={x + bw / 2} y={H - padB + 14} className="nhlx-hist-x" textAnchor="middle">{g.home === true || g.home === 1 ? 'vs' : '@'} {g.opp || '—'}</text><text x={x + bw / 2} y={H - padB + 27} className="nhlx-hist-x nhlx-hist-date" textAnchor="middle">{mdy(g.date)}</text></>}
              </g>
            );
          })}
          <line x1={padL} x2={W - padR + 10} y1={y(line)} y2={y(line)} className="nhlx-hist-line" />
          {avg != null && <g><line x1={padL} x2={W - padR + 10} y1={y(avg)} y2={y(avg)} className="nhlx-hist-avg" /><rect x={W - padR + 12} y={y(avg) - 10} width={56} height={20} rx={4} className="nhlx-hist-avgpill" /><text x={W - padR + 40} y={y(avg) + 4} className="nhlx-hist-avgtxt" textAnchor="middle">{num(avg)} AVG</text></g>}
        </svg>
      </div>
      {hover != null && list[hover] && (
        <div className="nhlx-hist-tip">
          <b>{list[hover].date} · {list[hover].home === true || list[hover].home === 1 ? 'vs' : '@'} {list[hover].opp || '—'}</b>
          <span>{list[hover].pts ?? 0} PTS · {list[hover].reb ?? 0} REB · {list[hover].ast ?? 0} AST · {list[hover].tpm ?? 0} 3PM · {list[hover].stl ?? 0} STL · {list[hover].blk ?? 0} BLK · {list[hover].tov ?? 0} TO{list[hover].min != null ? ` · ${num(list[hover].min, 0)} min` : ''}</span>
        </div>
      )}
    </div>
  );
}

function Card({ req, date, onClose }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [market, setMarket] = useState(req.market || 'pts');
  const [lines, setLines] = useState({});
  const [span, setSpan] = useState('l5');
  const [win, setWin] = useState('season');   // the window of the opponent's table (season, or PropFinder's last-N rows)
  const plays = req.player?.plays || [];

  // The card is keyed by the player, so a new one mounts fresh; the fetch only ever lands here.
  useEffect(() => {
    let live = true;
    const q = new URLSearchParams({ key: req.key });
    if (date) q.set('date', date);
    fetch(`/api/nba/player?${q}`, { cache: 'no-store' })
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.detail || j.error || `${r.status}`); return j; })
      .then((j) => { if (live) setData(j); })
      .catch((e) => { if (live) setErr(e.message); });
    return () => { live = false; };
  }, [req.key, date]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const opp = data?.opp || req.opp || null;
  const venue = data?.venue || req.venue || null;
  const games = data?.games || [];
  const season = data?.season || null;
  // The line per market: the opener's main play, else PropFinder's prop, else the season average rounded to .5.
  const lineFor = (m) => {
    if (lines[m] != null) return lines[m];
    const pl = plays.filter((x) => x.market === m && (x.side === 'over' || x.side === 'yes'));
    const main = pl.find((x) => x.main) || pl[0];
    if (main) return main.line;
    const prop = (data?.props || []).find((x) => x.market === m);
    if (prop) return prop.line;
    const vals = games.slice(0, 20).map((g) => statOf(g, m)).filter((v) => v != null);
    return vals.length ? Math.floor(vals.reduce((s, v) => s + v, 0) / vals.length) + 0.5 : 0.5;
  };
  const line = lineFor(market);
  const play = plays.find((x) => x.market === market && x.line === line && (x.side === 'over' || x.side === 'yes')) || plays.find((x) => x.market === market && x.line === line) || null;
  const thisSeason = games.filter((g) => g.season === season).length;
  const seasonLabel = season && thisSeason < SEASON_MIN ? `${seasonTag(season - 1)}${thisSeason ? ` +${thisSeason}` : ''}` : seasonTag(season);
  const splits = [['l5', 'L5'], ['l10', 'L10'], ['l20', 'L20'], ['season', seasonLabel], ...(opp ? [['h2h', `vs ${opp}`]] : []), ...(venue ? [['venue', venue === 'H' ? 'Home' : 'Away']] : [])];
  const spanGames = splitGames(games, span, { season, opp, venue });
  const hit = hitRate(spanGames, market, line);
  // The line menu: the book's ladder for the market (PropFinder's `lines`, priced), his plays' lines and ±3 around the one shown.
  const ladder = (data?.props || []).find((x) => x.market === market);
  const priced = new Map((ladder?.lines || (ladder ? [{ line: ladder.line, odds: ladder.odds, main: ladder.isMain }] : [])).map((x) => [x.line, x]));
  const lineSet = new Set([line, ...priced.keys(), ...plays.filter((x) => x.market === market).map((x) => x.line)]);
  for (let d = -3; d <= 3; d++) if (Math.floor(line) + d + 0.5 > 0) lineSet.add(Math.floor(line) + d + 0.5);
  const lineChoices = [...lineSet].sort((a, b) => a - b);
  const p = data?.player || { name: req.player?.player || req.key, team: req.team, pos: req.player?.pos || null, injury: req.player?.injury || null };
  const avgOf = (m, list) => { const vals = list.map((g) => (RAW.has(m) ? (g[m] == null ? null : Number(g[m])) : statOf(g, m))).filter((v) => v != null && Number.isFinite(v)); return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null; };
  const seasonGames = splitGames(games, 'season', { season, opp, venue });
  const allowedKeys = data?.allowed ? [...new Set(Object.values(data.allowed).flatMap((r) => Object.keys(r)))].filter((k) => !['gp', 'season', 'prior', 'priorSeason', 'lastN'].includes(k)).sort((a, b) => (Object.keys(STAT_LABEL).indexOf(a) + 1 || 99) - (Object.keys(STAT_LABEL).indexOf(b) + 1 || 99)).slice(0, 8) : [];
  const myPos = POSITIONS.includes(p.pos) ? p.pos : p.pos === 'G' ? 'SG' : p.pos === 'F' ? 'SF' : null;
  // What he can reach tonight: his own windows × the opponent's environment at his spot (the window picked on the right).
  const windows = ['season', ...Object.keys(data?.windows || {}).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))];
  const view = windows.includes(win) ? win : 'season';
  const table = view === 'season' ? (data?.allowed ? { rows: data.allowed, league: data.league, count: data.count } : null) : data?.windows?.[view] || null;
  const own = games.length ? { l5: avgOf(market, games.slice(0, 5)), l10: avgOf(market, games.slice(0, 10)), season: avgOf(market, seasonGames) } : null;
  const proj = projectFor(own, table, myPos, market, req.player?.scale || null);
  const WIN_LABEL = { season: seasonTag(season), l5: 'L5', l10: 'L10', l15: 'L15', l20: 'L20' };

  return (
    <div className="nhlx-modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="nhlx-modal-card nhlx-pc" onClick={(e) => e.stopPropagation()}>
        <div className="nhlx-pc-top ir-pc-top">
          <button type="button" className="nhlx-pc-back" onClick={onClose} aria-label="Close">←</button>
          <div className="nhlx-pc-id">
            <span className="nhlx-pc-avatar">
              {req.player?.espnId ? <img src={headshotUrl(req.player.espnId)} alt="" width="48" height="48" style={{ borderRadius: '50%' }} /> : <img src={teamLogo(p.team)} alt="" width="48" height="48" />}
            </span>
            <div style={{ minWidth: 0 }}>
              <h3>{p.name}</h3>
              <span className="nhlx-pc-slot">{p.pos || '—'} · {teamName(p.team) || p.team}{opp ? ` · ${venue === 'H' ? 'vs' : 'at'} ${opp}` : ''}{p.injury ? ` · ${p.injury}` : ''}</span>
            </div>
          </div>
          {[['pts', 'PTS', 'points'], ['reb', 'REB', 'rebounds'], ['ast', 'AST', 'assists'], ['usg', 'USG%', 'usage rate: the share of his team’s possessions he ends while on the floor'], ['rebCh', 'REB CH', 'rebound chances: rebounds plus the ones within reach he did not get'], ['potAst', 'POT AST', 'potential assists: passes that led to a shot']].map(([m, l, t]) => <div key={m} className="nhlx-pc-stat" title={`${t}, a game, ${seasonLabel}${thisSeason < SEASON_MIN ? ' (last season carries the read until he has ten games this season)' : ''}${avgOf(m, seasonGames) == null && RAW.has(m) ? ' · not in this pull’s game rows (the unread fields under Data sources name the spelling)' : ''}`}><small>{l}{m === 'usg' ? '' : ' / G'}</small><b>{num(avgOf(m, seasonGames))}{m === 'usg' && avgOf(m, seasonGames) != null ? '%' : ''}</b></div>)}
        </div>
        {err ? <div className="nhlx-alert" style={{ margin: 16 }}>⚠ Couldn’t load this player: {err}</div> : null}
        <div className="nhlx-pc-body">
          <section className="nhlx-pc-pane nhlx-pc-left">
            <div className="nhlx-pc-markets" role="tablist" aria-label="Market">
              {TABS.filter(([k]) => MARKETS[k]).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={market === k} className={`nhlx-pc-market${market === k ? ' is-active' : ''}`} onClick={() => setMarket(k)}>{l} <Pct rate={hitRate(spanGames, k, lineFor(k)).rate} /></button>)}
            </div>
            <div className="nhlx-pc-prop">
              <span className="nhlx-pc-over">OVER</span>
              <b>{line} {STAT_LABEL[market] || market}</b>
              {play ? <span className="nhlx-pc-chip" title={`The board's chance for this line (${play.rates?.n || 0} games behind it, shrunk toward the book's price)${play.odds != null ? ` · ${fmtOdds(play.odds)}${play.book ? ` at ${play.book}` : ''}` : ''}`}><b>{pct(play.p)}</b> chance{play.odds != null ? ` · ${fmtOdds(play.odds)}` : ''}</span> : null}
              <label className="nhlx-sel nhlx-pc-line"><small>Line</small><select value={line} onChange={(e) => setLines({ ...lines, [market]: Number(e.target.value) })}>{lineChoices.map((l) => { const b = priced.get(l); return <option key={l} value={l}>{l}{b ? `${b.odds != null ? ` (${fmtOdds(b.odds)})` : ''}${b.main ? ' main' : ''}` : ''}</option>; })}</select></label>
              {proj.value != null ? <span className={`nhlx-pc-chip ir-pc-proj${proj.value > line ? ' is-up' : ' is-down'}`} title={`His ${num(proj.rate)} ${STAT_LABEL[market] || market} a game (season ${num(own?.season)}, last 10 ${num(own?.l10)}, last 5 ${num(own?.l5)})${proj.factor != null ? ` × ${proj.factor}: ${opp} gives up ${num(proj.allowed)} to ${myPos}s over ${WIN_LABEL[view]} against the league's ${num(proj.league)}` : ' (no environment table)'}${proj.team != null ? ` × ${proj.team} so his side's projections add up to its share of the team's expected total` : ''}`}><b>{num(proj.value)}</b> tonight{proj.factor != null || proj.team != null ? ` · ×${Math.round((proj.factor ?? 1) * (proj.team ?? 1) * 1000) / 1000}` : ''}</span> : null}
            </div>
            <div className="nhlx-pc-chips">
              {opp ? <span className="nhlx-pc-chip"><b>{venue === 'H' ? 'Home' : 'Away'}</b> {venue === 'A' ? '@' : 'vs'} <img src={teamLogo(opp)} alt="" width="18" height="18" /> {opp}</span> : null}
              <span className="nhlx-pc-chip"><b>GP</b> {games.length}</span>
              {hit.gp ? <span className="nhlx-pc-chip"><b>Hit</b> {hit.hits}/{hit.gp}</span> : null}
              {data?.pulledAt ? <span className="nhlx-pc-chip" title="PropFinder's logs, pulled for this slate">PropFinder {new Date(data.pulledAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span> : null}
            </div>
            {(req.player?.ladders?.[market] || []).length ? (
              <div className="ir-pc-ladder" aria-label="Ladder">
                {req.player.ladders[market].map((r) => {
                  const tone = r.p >= 0.55 ? 'soft' : r.p < 0.35 ? 'tough' : 'mid';
                  return <button key={r.line} type="button" className={`ir-ladder-rung is-${tone}${r.main ? ' is-main' : ''}${r.line === line ? ' is-active' : ''}`} onClick={() => setLines({ ...lines, [market]: r.line })} title={`o${r.line}: ${pct(r.p)} tonight = ½ his distribution over it (${pct(r.model)}: ${num(r.proj)} ± ${num(r.sd)}${r.env != null ? `, matchup × ${r.env}` : ''}) + ½ how often he cleared it (${pct(r.emp)}: L5 ${pct(r.rates.l5)} · L10 ${pct(r.rates.l10)} · season ${pct(r.rates.season)}, ${r.rates.n} games)${r.odds != null ? ` · ${fmtOdds(r.odds)}` : ` · break-even ${r.fair}`}${r.main ? ' · the book’s main line' : ''}`}><b>o{r.line}</b><i>{pct(r.p)}</i><small>{r.odds != null ? fmtOdds(r.odds) : r.fair}</small></button>;
                })}
              </div>
            ) : null}
            {!data && !err ? <div className="nhlx-empty">Loading the logs…</div> : spanGames.length ? <Bars games={spanGames} market={market} line={line} unit={STAT_LABEL[market] || market} /> : <div className="nhlx-empty">{span === 'h2h' ? `No logged games vs ${opp}.` : 'No logged games for this player yet.'}</div>}
            <div className="nhlx-rates">
              {splits.map(([k, label]) => <RateTile key={k} label={label} hit={hitRate(splitGames(games, k, { season, opp, venue }), market, line)} active={span === k} onClick={() => setSpan(k)} />)}
            </div>
            <div className="nhlx-pfd-wrap nhlx-pc-stats">
              <table className="nhlx-pfd-table">
                <thead><tr><th>Split</th><th>GP</th><th>MIN</th>{['pts', 'reb', 'ast', 'tpm', 'pra', 'usg', 'rebCh', 'potAst'].map((m) => <th key={m} title={m === 'usg' ? 'Usage rate' : m === 'rebCh' ? 'Rebound chances a game' : m === 'potAst' ? 'Potential assists a game' : ''}>{STAT_LABEL[m]}</th>)}<th>Over {line}</th></tr></thead>
                <tbody>
                  {splits.map(([k, label]) => {
                    const list = splitGames(games, k, { season, opp, venue });
                    const h = hitRate(list, market, line);
                    return <tr key={k} className={span === k ? 'is-active' : ''}><td><b>{label}</b></td><td>{list.length}</td><td>{num(avgOf('min', list), 0)}</td>{['pts', 'reb', 'ast', 'tpm', 'pra', 'usg', 'rebCh', 'potAst'].map((m) => <td key={m}>{num(avgOf(m, list))}{m === 'usg' && avgOf(m, list) != null ? '%' : ''}</td>)}<td className={h.gp ? (h.rate >= 0.5 ? 'is-soft' : 'is-tough') : ''}><span className="nhlx-pfd-val">{h.gp ? pct(h.rate) : '—'}</span>{h.gp ? <span className="nhlx-pfd-rank">{h.hits}/{h.gp}</span> : null}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <section className="nhlx-pc-pane nhlx-pc-right">
            <div className="nhlx-pfd-head"><b>What {opp || 'the opponent'} gives up per game, by position</b><small className="nhlx-auto-meta">rank 1 = the most of {table?.count || data?.count || 30} · {view === 'season' ? 'this season blended into last season’s' : `its last ${view.slice(1)} games${table?.season && season && table.season < season ? ' of last season' : ''}`}{table?.league ? ' · Lg = the league’s average' : ''}</small></div>
            {windows.length > 1 ? (
              <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label="Window of the opponent's table" style={{ marginBottom: 8 }}>
                {windows.map((k) => <button key={k} type="button" role="tab" aria-selected={view === k} className={`nhlx-tab${view === k ? ' is-active' : ''}`} onClick={() => setWin(k)}>{WIN_LABEL[k]}</button>)}
              </div>
            ) : null}
            {table?.rows ? (
              <div className="nhlx-pfd-wrap">
                <table className="nhlx-pfd-table">
                  <thead><tr><th>Pos</th>{allowedKeys.map((k) => <th key={k} className={k === market ? 'is-on' : ''}>{STAT_LABEL[k] || k.toUpperCase()}</th>)}</tr></thead>
                  <tbody>
                    {[...POSITIONS.filter((x) => table.rows[x]), ...Object.keys(table.rows).filter((x) => !POSITIONS.includes(x))].map((pos) => (
                      <tr key={pos} className={pos === myPos ? 'is-active' : ''}>
                        <td><b>{pos}</b>{pos === myPos ? <small className="nhlx-auto-meta"> his spot</small> : null}</td>
                        {allowedKeys.map((k) => { const c = table.rows[pos][k]; const t = tone(c?.rank, table.count || data?.count || 30); const lg = table.league?.[pos]?.[k]; return <td key={k} className={`${c ? `is-${t}` : ''}${k === market ? ' is-on' : ''}`} title={c && lg != null ? `${num(c.value)} against the league's ${num(lg)} at ${pos}` : ''}>{c && typeof c === 'object' ? <><span className="nhlx-pfd-val">{c.value != null ? num(c.value) : '—'}</span>{c.rank ? <span className="nhlx-pfd-rank">#{c.rank}</span> : null}</> : '—'}</td>; })}
                      </tr>
                    ))}
                    {table.league ? <tr className="ir-court-league"><td><b>Lg</b>{myPos ? <small className="nhlx-auto-meta"> at {myPos}</small> : null}</td>{allowedKeys.map((k) => <td key={k} className={k === market ? 'is-on' : ''}><span className="nhlx-pfd-val">{num(table.league[myPos]?.[k] ?? Object.values(table.league).map((r) => r[k]).find((v) => v != null))}</span></td>)}</tr> : null}
                  </tbody>
                </table>
              </div>
            ) : <div className="nhlx-empty">{data ? `No defense table for ${opp || 'the opponent'} in this pull.` : 'Loading…'}</div>}
            {plays.length ? (
              <div className="nhlx-pfd ir-pc-plays">
                <div className="nhlx-pfd-head"><b>His lines tonight</b><small className="nhlx-auto-meta">the board’s chance per line</small></div>
                <div className="nhlx-pfd-wrap">
                  <table className="nhlx-pfd-table">
                    <thead><tr><th>Market</th><th>Line</th><th>Chance</th><th>Price</th><th>L5 · L10 · season</th></tr></thead>
                    <tbody>
                      {[...plays].sort((a, b) => b.p - a.p).map((x) => <tr key={x.id} className={x.market === market && x.line === line ? 'is-active' : ''} onClick={() => { setMarket(x.market); setLines({ ...lines, [x.market]: x.line }); }} style={{ cursor: 'pointer' }}><td><b>{x.label}</b></td><td>{x.side === 'yes' ? '' : x.side === 'under' ? 'u' : 'o'}{x.line}</td><td className={x.p >= x.floor ? 'is-soft' : 'is-tough'}><span className="nhlx-pfd-val">{pct(x.p)}</span></td><td>{x.odds != null ? fmtOdds(x.odds) : '—'}</td><td>{pct(x.rates?.l5)} · {pct(x.rates?.l10)} · {pct(x.rates?.season)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}

/** Wrap a board in it: every chip and table row inside can open the card for the slate's date. */
export function NbaPlayerCardProvider({ date, children }) {
  const [req, setReq] = useState(null);
  const open = useCallback((r) => setReq(r), []);
  const close = useCallback(() => setReq(null), []);
  return (
    <Ctx.Provider value={open}>
      <DateCtx.Provider value={date || ''}>
        {children}
        {req ? <Card key={`${req.key}|${date || ''}`} req={req} date={date} onClose={close} /> : null}
      </DateCtx.Provider>
    </Ctx.Provider>
  );
}
