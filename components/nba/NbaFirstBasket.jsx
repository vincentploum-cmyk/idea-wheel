'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { teamLogo } from '@/lib/nba/teams';
import { headshotUrl } from '@/lib/nba/espn';
import { NbaPlayerCardProvider, useNbaPlayerCard } from './NbaPlayerCard';

const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
const pct0 = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const price = (v) => (v == null ? '—' : v > 0 ? `+${v}` : `${v}`);
const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');

function Row({ c, rank, onOpen, final }) {
  const tip = c.tip.from === 'centre' ? `${c.tip.centre} has won ${c.tip.jumps.won} of ${c.tip.jumps.of} jump balls this season` : c.tip.from === 'team' ? `${c.team} has won ${c.tip.team.won} of ${c.tip.team.of} tips this season (no record on its centre)` : 'no tip on record yet: an even jump';
  const teamTitle = `${c.team} scores the first basket ${pct(c.pTeam)}: first possession ${pct0(c.tip.p)} (${tip}), and the team with first possession scores first more often than not`;
  const shareTitle = `His share of ${c.team}’s first basket ${pct(c.share)}: ${c.fga ?? '—'} field-goal attempts a game, ${pct0(c.attShare)} of the five starters’, × ${c.finish} for his finishing (${c.fgPct != null ? pct0(c.fgPct) : '—'} from the field against theirs)${c.empShare != null ? `; he took ${c.firstShots} of the team’s first shots this season (${pct0(c.empShare)}), blended in` : ''}`;
  return (
    <tr className={`is-click${final && c.hit === true ? ' is-hit' : final && c.hit === false ? ' is-miss' : ''}`} onClick={() => onOpen(c)}>
      <td><b>{rank}</b></td>
      <td>
        <div className="nhlx-db-player">
          {c.espnId ? <img src={headshotUrl(c.espnId)} alt="" width="30" height="30" style={{ borderRadius: '50%' }} /> : <img src={teamLogo(c.team)} alt="" width="30" height="30" />}
          <span><b>{c.name}</b><small>{c.team} · {c.slot || c.pos || '—'}{c.source === 'minutes' ? ' · by minutes' : ''}</small></span>
        </div>
      </td>
      <td>{c.venue === 'H' ? 'vs' : 'at'} {c.opp}</td>
      <td title={teamTitle}><b>{pct0(c.pTeam)}</b> <small className="nhlx-auto-meta">tip {pct0(c.tip.p)}</small></td>
      <td title={shareTitle}><b>{pct0(c.share)}</b> <small className="nhlx-auto-meta">{c.fga ?? '—'} FGA{c.firstShots ? ` · ${c.firstShots} first shots` : ''}</small></td>
      <td title={c.own.starts ? `${c.own.fb} first basket${c.own.fb === 1 ? '' : 's'} in ${c.own.starts} start${c.own.starts === 1 ? '' : 's'} this season (${c.own.fp} first points), in at weight ${pct0(c.own.weight)}` : 'No starts on record this season'}>{c.own.starts ? <><b>{c.own.fb}</b> / {c.own.starts}</> : <span className="nhlx-auto-meta">—</span>}</td>
      <td title={`The model alone: ${pct(c.modelP)} before his own record`}><b>{pct(c.p)}</b> <small className="nhlx-auto-meta">{price(c.fair)}</small></td>
      <td className={c.edge != null ? (c.edge > 0 ? 'is-soft' : 'is-tough') : ''} title={c.odds != null ? `${c.book || 'the book'}${c.books > 1 ? ` and ${c.books - 1} more` : ''}: ${price(c.odds)} (implied ${pct(c.implied)})` : 'No first-basket price in the pull'}>{c.odds != null ? <><b>{price(c.odds)}</b> <small className="nhlx-auto-meta">{c.edge > 0 ? '+' : ''}{(c.edge * 100).toFixed(1)}</small></> : <span className="nhlx-auto-meta">—</span>}</td>
      <td><div className="nhlx-fg-score"><div className="nhlx-fg-bar"><i style={{ width: `${Math.min(100, c.score)}%` }} /></div><b>{c.score}</b></div></td>
    </tr>
  );
}

function Table({ list, onOpen, final = false }) {
  return (
    <div className="nhlx-db-table-wrap">
      <table className="nhlx-db-table nhlx-mu-table nhlx-fg-table">
        <thead>
          <tr>
            <th title="Rank by chance">#</th><th>Player</th><th>Tonight</th>
            <th title="His team’s chance of the first basket: the tip (the centre’s jump-ball record this season) and how often the team with first possession scores first">Team 1st</th>
            <th title="His share of his team’s first basket: his attempts among the five starters, his finishing, and the first shots he has taken this season">Share</th>
            <th title="His first baskets over his starts this season">Own</th>
            <th title="His chance of the first basket with its fair price">Chance</th>
            <th title="The book’s price from the pull and the edge against it, in points">Book</th>
            <th title="0–100: a 25% chance tops the scale">Score</th>
          </tr>
        </thead>
        <tbody>{list.map((c, i) => <Row key={`${c.team}-${c.key}`} c={c} rank={i + 1} onOpen={onOpen} final={final} />)}</tbody>
      </table>
    </div>
  );
}

function Board({ date }) {
  const [board, setBoard] = useState(null);
  const [err, setErr] = useState('');
  const [view, setView] = useState('slate');
  const open = useNbaPlayerCard();
  const load = useCallback((d, backfill = true) => fetch(`/api/nba/firstbasket?date=${d}${backfill ? '' : '&backfill=0'}`, { cache: 'no-store' })
    .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.detail || j.error || `${r.status}`); return j; })
    .then((j) => { setBoard(j); setErr(''); })
    .catch((e) => setErr(`Couldn’t load the first-basket board: ${e.message}`)), []);
  useEffect(() => { if (date) load(date); }, [date, load]);
  useEffect(() => {
    const onMark = () => { if (date) load(date, false); };
    window.addEventListener('nba:injury-override', onMark);
    return () => window.removeEventListener('nba:injury-override', onMark);
  }, [date, load]);
  const top = useMemo(() => (board ? board.games.flatMap((g) => g.candidates.map((c) => ({ ...c, gameFinal: g.final }))).sort((a, b) => b.p - a.p).slice(0, 40) : []), [board]);
  const onOpen = (c) => open({ key: c.key, player: { player: c.name, key: c.key, pos: c.pos, injury: c.health }, team: c.team, opp: c.opp, venue: c.venue, market: 'pts' });
  return (
    <div className="nhlx-mu">
      <div className="nhlx-today-head">
        <div>
          <div className="nhlx-auto-sub">
            {board ? `${board.games.length} game${board.games.length === 1 ? '' : 's'} · ${board.count} starters · ${board.recorded} game${board.recorded === 1 ? '' : 's'} with an opening on record this season${board.possessionEdge ? ` (the team with first possession scored first in ${pct0(board.possessionEdge.share)} of ${board.possessionEdge.games}; ${board.edgeUsed === board.possessionEdge.share ? 'the figure used' : `${pct0(board.edgeUsed)} used until 40 games`})` : ''} · ${board.priced} player${board.priced === 1 ? '' : 's'} priced for the first basket in the pull${board.missing ? ` · ${board.missing} stored game${board.missing === 1 ? '' : 's'} still to read for the opening plays (each load reads a dozen)` : ''}` : 'Loading…'}
          </div>
        </div>
        <div className="nhlx-auto-actions">
          <div className="nhlx-tabs" role="tablist" aria-label="View">
            {[['slate', 'Whole slate'], ['games', 'By game']].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={view === k} className={`nhlx-tab${view === k ? ' is-active' : ''}`} onClick={() => setView(k)}>{l}</button>)}
          </div>
        </div>
      </div>
      {err ? <div className="nhlx-alert">{err}</div> : null}
      <p className="nhlx-auto-meta nhlx-fg-how">
        Each starter’s chance is his team’s chance of the first basket (the tip from the centre’s jump-ball record, and the team with first possession scoring first about 57% of the time) times his share of it (his attempts among the five starters, his finishing, and the first shots he has actually taken this season), moved toward his own first-basket record over his starts. The book’s first-basket price rides beside it when the pull carries one; the starters are PropFinder’s depth chart, the players out left aside. Click a row for the card.
      </p>
      {board && !board.games.length ? <div className="nhlx-empty">No games on this date.</div> : null}
      {board && view === 'slate' && top.length ? <Table list={top} onOpen={onOpen} final={false} /> : null}
      {board && view === 'games' && board.games.map((g) => (
        <article key={g.id} className="nhlx-mu-game nhlx-fg-game">
          <div className="nhlx-mu-game-head">
            <img src={teamLogo(g.away)} alt="" width="28" height="28" />
            <b>{g.away} @ {g.home}</b>
            <img src={teamLogo(g.home)} alt="" width="28" height="28" />
            <small>{g.final && g.score ? <>Final · <b className="nhlx-mu-score">{g.away} {g.score.away} – {g.home} {g.score.home}</b></> : fmtTime(g.date)}</small>
          </div>
          <small className="nhlx-auto-meta">{g.sides.map((s) => `${s.team} first basket ${pct0(s.pTeam)} (tip ${pct0(s.pTip)}${s.tipFrom === 'none' ? ', no record' : ''}; starters ${s.lineup === 'depth' ? 'from the depth chart' : 'by minutes'})`).join(' · ')}</small>
          {g.actual ? <p className="nhlx-fg-actual">{g.actual.firstBasket ? <>First basket: <b>{g.actual.firstBasket.name || 'unknown'}</b> ({g.actual.firstBasket.team}, a {g.actual.firstBasket.kind === '3' ? 'three' : 'two'}{g.actual.firstBasket.clock ? ` at ${g.actual.firstBasket.clock}` : ''}){(() => { const i = g.candidates.findIndex((c) => c.hit); return i >= 0 ? ` · was #${i + 1} at ${pct(g.candidates[i].p)}` : ' · not among the starters listed'; })()}</> : 'No first basket on record for this game.'}{g.actual.firstPoints && g.actual.firstPoints.kind === 'FT' ? <> · first points {g.actual.firstPoints.name} from the line</> : null}{g.actual.tip?.team ? <> · tip to {g.actual.tip.team}{g.actual.tip.possession?.name ? ` (${g.actual.tip.possession.name})` : ''}</> : null}</p> : g.final ? <p className="nhlx-fg-actual">The opening plays are not stored for this game yet.</p> : null}
          <Table list={g.candidates.slice(0, 6)} onOpen={onOpen} final={g.final} />
        </article>
      ))}
    </div>
  );
}

/** The First basket tab (who scores the first field goal of each game, lib/nba/firstbasket.js), with its own card host. */
export default function NbaFirstBasket({ date }) {
  return <NbaPlayerCardProvider date={date}><Board date={date} /></NbaPlayerCardProvider>;
}
