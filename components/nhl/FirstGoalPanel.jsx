'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Headshot, TeamLogo, rankClass } from './media';
import { usePlayerCard } from './PlayerCard';
import { SortTh } from './pf-ui';
import { sortCandidates } from '@/lib/nhl-data/firstgoal-sort';

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);

/** The opponent's first goals given up to the player's position and slot at tonight's venue. */
function LeakCell({ c }) {
  const l = c.leak;
  if (!l) return <td className="nhlx-auto-meta">no games at venue</td>;
  const title = `${c.opp} gave up the first goal to ${c.pos} in ${l.allowed} of ${l.games} games at ${c.venue === 'H' ? 'its road games' : 'home'} with a first goal on record (${pct(l.share)}, league ${pct(l.league)})${c.slot ? ` · ${l.slot} of them from ${c.slot}` : ''} · rank ${l.rank ?? '–'} of ${l.teamCount}`;
  return (
    <td className={rankClass(l.rank, l.teamCount)} title={title}>
      {l.rank ? <i className="nhlx-fg-rank">#{l.rank}</i> : null} {l.allowed}/{l.games}{c.slot ? <small className="nhlx-fg-slot">{c.slot} ×{l.slot}</small> : null}
    </td>
  );
}

function CandidateRow({ c, rank }) {
  const open = usePlayerCard();
  return (
    <tr className={c.id ? 'is-click' : ''} onClick={() => c.id && open({ id: c.id, opp: c.opp, venue: c.venue })}>
      <td><b>{rank}</b></td>
      <td>
        <div className="nhlx-db-player">
          <Headshot id={c.id} size={30} />
          <span><b>{c.name}</b><small>{c.team} · {c.slot || c.pos}</small></span>
        </div>
      </td>
      <td>{c.venue === 'H' ? 'vs' : 'at'} {c.opp} · {c.venue === 'H' ? 'home' : 'away'}</td>
      <td title={`First goals scored over his last ${c.own.gp} stored games with a first goal on record`}>{c.own.gp ? <><b>{c.own.fg}</b> / {c.own.gp} <small className="nhlx-auto-meta">{pct(c.own.rate)}</small></> : <span className="nhlx-auto-meta">no record</span>}</td>
      <LeakCell c={c} />
      <td>{c.h2h ? <>{c.h2h.hot ? <span className="nhlx-rk-h2h is-legend">h2h</span> : null}{c.h2h.g} G in {c.h2h.gp} GP</> : <span className="nhlx-auto-meta">—</span>}</td>
      <td title={c.h2h ? `${c.h2h.sog} shots in ${c.h2h.gp} meeting${c.h2h.gp === 1 ? '' : 's'} with ${c.opp}, this season and last` : undefined}>{c.h2h ? <>{c.h2h.shotsHot ? <span className="nhlx-rk-h2h is-legend">sog</span> : null}<b>{c.h2h.spg.toFixed(1)}</b> <small className="nhlx-auto-meta">{c.h2h.sog} in {c.h2h.gp}</small></> : <span className="nhlx-auto-meta">—</span>}</td>
      <td title={c.modelled ? 'The model’s 1+ goal probability from the latest saved run' : 'No model run: 1+ goal odds from the matchup read'}><b>{pct(c.p1g)}</b>{c.modelled ? null : <i className="nhlx-fg-rank">read</i>}{c.model?.fire ? <span className="nhlx-rk-fire" role="img" aria-label="on fire"> 🔥</span> : null}</td>
      <td><div className="nhlx-fg-score"><div className="nhlx-fg-bar"><i style={{ width: `${c.score}%` }} /></div><b>{c.score}</b></div></td>
    </tr>
  );
}

/** The candidates table: a column header sorts (click again for the score order); the # column keeps the score rank. */
function CandidateTable({ list, sort, onSort }) {
  const byScore = useMemo(() => new Map([...list].sort((a, b) => b.score - a.score).map((c, i) => [`${c.team}-${c.name}`, i + 1])), [list]);
  const rows = useMemo(() => sortCandidates(list, sort), [list, sort]);
  const th = (k, label, title) => <SortTh k={k} label={label} sort={sort} onSort={(c) => onSort(sort === c ? 'score' : c)} title={title} />;
  return (
    <div className="nhlx-db-table-wrap">
      <table className="nhlx-db-table nhlx-mu-table nhlx-fg-table">
        <thead>
          <tr>
            <th title="Rank by score">#</th>
            {th('player', 'Player', 'Sort by name')}
            {th('tonight', 'Tonight', 'Sort by opponent')}
            {th('own', 'Own 1st G', 'First goals scored ÷ games, last 100 stored games')}
            {th('leak', 'Opp gives to slot', "First goals the opponent gives up to this position at tonight's venue, and how many came from this line slot")}
            {th('h2h', 'H2H G', 'Goals against this opponent, this season and last; the badge marks more goals than games')}
            {th('h2hsog', 'H2H SOG/G', 'Shots on goal per game against this opponent, this season and last; the badge marks 4+ a game over 2+ meetings, or 5+ in the one meeting stored')}
            {th('p1g', '1+ G', '1+ goal probability')}
            {th('score', 'Score', "Combined read, 0–100: the 1+ goal odds and own first-goal rate carry most of it; the opponent's leak to the position and the head-to-head record move it")}
          </tr>
        </thead>
        <tbody>{rows.map((c) => <CandidateRow key={`${c.team}-${c.name}`} c={c} rank={byScore.get(`${c.team}-${c.name}`)} />)}</tbody>
      </table>
    </div>
  );
}

function LeakLine({ game }) {
  const part = (team) => { const l = game.leaks[team]; return l?.games ? `${team} gives up the 1st goal in ${l.allowed} of ${l.games} ${team === game.home ? 'at home' : 'away'}` : `${team}: no games at this venue yet`; };
  return <small className="nhlx-auto-meta">{part(game.home)} · {part(game.away)}</small>;
}

export default function FirstGoalPanel() {
  const [date, setDate] = useState('');
  const [board, setBoard] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('slate');
  const [group, setGroup] = useState('');
  const [sort, setSort] = useState('score');

  const load = useCallback((d) => fetch(`/api/nhl/data/firstgoal${d ? `?date=${d}` : ''}`, { cache: 'no-store' })
    .then(async (res) => { const j = await res.json(); if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`); return j; })
    .then((j) => { setBoard(j); setDate(j.date); setErr(''); })
    .catch((e) => setErr(`Couldn’t load the first-goal board: ${e.message}`))
    .finally(() => setBusy(false)), []);
  useEffect(() => { load(''); }, [load]);
  const pickDate = (d) => { setBusy(true); setErr(''); load(d); };
  const shift = (n) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); pickDate(d.toISOString().slice(0, 10)); };

  const keep = (c) => !group || (group === 'D' ? c.pos === 'D' : c.pos !== 'D');
  const top = useMemo(() => (board ? board.games.flatMap((g) => g.candidates).filter(keep).sort((a, b) => b.score - a.score).slice(0, 40) : []), [board, group]); // eslint-disable-line react-hooks/exhaustive-deps
  const pretty = date ? new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '';

  return (
    <div className="nhlx-mu">
      <div className="nhlx-today-head">
        <div>
          <div className="nhlx-today-date">{pretty || 'Loading…'}</div>
          <div className="nhlx-auto-sub">
            {board ? `${board.games.length} game${board.games.length === 1 ? '' : 's'} · ${board.count} skaters dressed · ${board.recorded} first goals on record · ${board.modelRun ? `model run ${new Date(board.modelRun.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : 'no model run yet: 1+ goal odds from the matchup read'}` : ''}
          </div>
        </div>
        <div className="nhlx-auto-actions">
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !date} onClick={() => shift(-1)} aria-label="Previous day">‹</button>
          <input type="date" className="nhlx-input nhlx-input-sm" value={date} onChange={(e) => e.target.value && pickDate(e.target.value)} aria-label="Slate date" />
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !date} onClick={() => shift(1)} aria-label="Next day">›</button>
          <div className="nhlx-tabs" role="tablist" aria-label="View">
            {[['slate', 'Whole slate'], ['games', 'By game']].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={view === k} className={`nhlx-tab${view === k ? ' is-active' : ''}`} onClick={() => setView(k)}>{l}</button>)}
          </div>
          <div className="nhlx-tabs" role="tablist" aria-label="Position group">
            {[['', 'All'], ['F', 'Forwards'], ['D', 'Defense']].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={group === k} className={`nhlx-tab${group === k ? ' is-active' : ''}`} onClick={() => setGroup(k)}>{l}</button>)}
          </div>
        </div>
      </div>
      {err ? <div className="nhlx-alert">{err}</div> : null}
      <p className="nhlx-auto-meta nhlx-fg-how">
        Each candidate blends his own first-goal record (first goals over his last 100 stored games), what the opponent gives up to his position and line slot at tonight’s venue, his head-to-head goals, and the 1+ goal odds from the latest model run. Score 0–100: the 1+ goal odds and the own rate carry most of it. Click a row for the player card.
      </p>
      {board && !board.games.length ? <div className="nhlx-empty">No games on this date.</div> : null}
      {board && view === 'slate' && top.length ? <CandidateTable list={top} sort={sort} onSort={setSort} /> : null}
      {board && view === 'games' && board.games.map((g) => {
        const list = g.candidates.filter(keep).slice(0, 6);
        return (
          <article key={g.id} className="nhlx-mu-game nhlx-fg-game">
            <div className="nhlx-mu-game-head">
              <TeamLogo abbr={g.away} size={28} />
              <b>{g.away} @ {g.home}</b>
              <TeamLogo abbr={g.home} size={28} />
              <small>{g.final ? <>Final · <b className="nhlx-mu-score">{g.away} {g.score.away} – {g.home} {g.score.home}</b></> : fmtTime(g.startTimeUTC)}</small>
            </div>
            <LeakLine game={g} />
            {g.actual ? <p className="nhlx-fg-actual">First goal: <b>{g.actual.name || 'unknown'}</b> ({g.actual.team}){g.actual.period ? `, ${g.actual.time} of period ${g.actual.period}` : ''}{(() => { const i = g.candidates.findIndex((c) => c.id === g.actual.playerId); return i >= 0 ? ` · was candidate #${i + 1} (score ${g.candidates[i].score})` : ' · not among the candidates'; })()}</p> : g.final ? <p className="nhlx-fg-actual">No first goal on record for this game yet.</p> : null}
            {list.length ? <CandidateTable list={list} sort={sort} onSort={setSort} /> : <p className="nhlx-auto-meta">No candidates yet (no lineups).</p>}
          </article>
        );
      })}
    </div>
  );
}
