'use client';

import { useCallback, useEffect, useState } from 'react';
import { Headshot, TeamLogo } from './media';
import { usePlayerCard } from './PlayerCard';
import { fairOdds } from '@/lib/nhl-data/picks-pure';

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const last = (name) => String(name || '').split(' ').slice(-1)[0];

/** A probability with its break-even price under it. */
function Prob({ p, lead = false, wide = false }) {
  return <td className={`is-num${lead ? ' is-lead' : ''}${wide ? ' is-wide' : ''}`}><b>{pct(p)}</b><small>{fairOdds(p)}</small></td>;
}

function Player({ c }) {
  const open = usePlayerCard();
  return (
    <td className="is-click" onClick={() => open({ id: c.id, opp: c.opp, venue: c.venue })}>
      <div className="nhlx-db-player">
        <Headshot id={c.id} size={30} />
        <span><b>{c.name}</b><small>{c.team} · {c.pos}{c.line ? c.line : ''} · {c.venue === 'H' ? 'vs' : 'at'} {c.opp}{c.carried ? ' · carried' : ''}</small></span>
      </div>
    </td>
  );
}

const season = (c, k, base) => (c.rates ? <><b>{c.rates[k] == null ? '—' : c.rates[k].toFixed(2)}</b> <small>({c.rates.n}) / {c.rates[base] == null ? 'none' : c.rates[base].toFixed(2)}</small></> : <span className="nhlx-auto-meta">no stored games</span>);

function ShotsTable({ g, model }) {
  return (
    <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
      <table className="nhlx-db-table nhlx-pk-table">
        <thead>
          <tr>
            <th>Shots{g.shotsFallback ? <i className="nhlx-fg-rank"> nobody over 50%: best available</i> : null}</th>
            <th className="is-num is-wide" title="Projected shots on goal">λ</th>
            <th className="is-num is-wide" title="2+ shots: probability and the break-even price">2+</th>
            <th className="is-num" title="3+ shots">3+</th>
            <th className="is-num" title="4+ shots">4+</th>
            {model ? <th className="is-num is-wide" title="The study's own rate for 3+ shots, for comparison (the skater's rate, attempts, home ice, the opponent's shots allowed)">Study 3+</th> : null}
            <th className="is-num" title="Shots a game this season (games), and last season's base">Season / base</th>
            <th className="is-num is-wide" title="Where the opponent ranks for shots allowed a game this season (1 = allows the most)">Opp</th>
          </tr>
        </thead>
        <tbody>
          {g.shots.map((c) => (
            <tr key={c.id} className={c.under ? 'is-under' : ''} title={c.under ? 'Under the 50% floor for 3+ shots: listed to make three' : undefined}>
              <Player c={c} />
              <td className="is-num is-wide">{c.lamS.toFixed(2)}</td>
              <Prob p={c.p2} wide /><Prob p={c.p3} lead /><Prob p={c.p4} />
              {model ? <td className="is-num is-wide nhlx-pk-study">{c.study ? pct(c.study.p3) : '—'}</td> : null}
              <td className="is-num">{season(c, 'curSog', 'baseSog')}</td>
              <td className="is-num is-wide">{c.oppRank ? `#${c.oppRank}` : '—'}{c.oppSog ? <small>{c.oppSog.toFixed(1)}/g</small> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {g.nextShots.length ? <p className="nhlx-pk-next">Next: {g.nextShots.map((c) => `${last(c.name)} ${pct(c.p3)}`).join(' · ')}</p> : null}
    </div>
  );
}

function GoalsTable({ g, model }) {
  return (
    <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
      <table className="nhlx-db-table nhlx-pk-table">
        <thead>
          <tr>
            <th>Goals{g.goalsFallback ? <i className="nhlx-fg-rank"> nobody over 35%: best available</i> : null}</th>
            <th className="is-num is-wide" title="Projected goals">λ</th>
            <th className="is-num" title="1+ goal: probability and the break-even price">1+ G</th>
            {model ? <th className="is-num is-wide" title="The study's own rate for 1+ goal, for comparison">Study 1+</th> : null}
            <th className="is-num" title="Goals a game this season (games), and last season's base">Season / base</th>
          </tr>
        </thead>
        <tbody>
          {g.goals.map((c) => (
            <tr key={c.id} className={c.under ? 'is-under' : ''} title={c.under ? 'Under the 35% floor for a goal: listed to make three' : undefined}>
              <Player c={c} />
              <td className="is-num is-wide">{c.lamG.toFixed(2)}</td>
              <Prob p={c.p1g} lead />
              {model ? <td className="is-num is-wide nhlx-pk-study">{c.study ? pct(c.study.p1g) : '—'}</td> : null}
              <td className="is-num">{season(c, 'curG', 'baseG')}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {g.nextGoals.length ? <p className="nhlx-pk-next">Next: {g.nextGoals.map((c) => `${last(c.name)} ${pct(c.p1g)}`).join(' · ')}</p> : null}
    </div>
  );
}

export default function PicksPanel() {
  const [date, setDate] = useState('');
  const [board, setBoard] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback((d) => fetch(`/api/nhl/data/picks${d ? `?date=${d}` : ''}`, { cache: 'no-store' })
    .then(async (res) => { const j = await res.json(); if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`); return j; })
    .then((j) => { setBoard(j); setDate(j.date); setErr(''); })
    .catch((e) => setErr(`Couldn’t load tonight’s picks: ${e.message}`))
    .finally(() => setBusy(false)), []);
  useEffect(() => { load(''); }, [load]);
  const pickDate = (d) => { setBusy(true); setErr(''); load(d); };
  const shift = (n) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); pickDate(d.toISOString().slice(0, 10)); };
  const pretty = date ? new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '';

  return (
    <section className="nhlx-pk" aria-label="Tonight’s picks">
      <div className="nhlx-today-head">
        <div>
          <div className="nhlx-today-date">{pretty || 'Loading…'}</div>
          <div className="nhlx-auto-sub">
            {board ? `${board.games.length} game${board.games.length === 1 ? '' : 's'} · ${board.games.reduce((s, g) => s + g.skaters, 0)} skaters · ${board.source === 'model' ? `the model's numbers from the run saved ${board.modelRun?.createdAt ? new Date(board.modelRun.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''} (${board.modelRun?.players ?? '—'} players; skaters it did not project are not listed)` : 'no model run for this date: the study\'s rates stand in'}` : ''}
          </div>
        </div>
        <div className="nhlx-auto-actions">
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !date} onClick={() => shift(-1)} aria-label="Previous day">‹</button>
          <input type="date" className="nhlx-input nhlx-input-sm" value={date} onChange={(e) => e.target.value && pickDate(e.target.value)} aria-label="Slate date" />
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !date} onClick={() => shift(1)} aria-label="Next day">›</button>
        </div>
      </div>
      {err ? <div className="nhlx-alert">{err}</div> : null}
      <p className="nhlx-auto-meta nhlx-fg-how">
        The best shots plays and the best goal plays in every game: every skater over the floor (50% for 3+ shots, 35% for a goal), and never fewer than three a table; the dimmed rows are under the floor. The percentage is the chance of the hit; the price under it is the break-even, so the play wants better odds than that. {board?.source === 'model' ? 'The numbers are the model’s, from the latest run saved for the date; the dimmed Study column is the plain-rate read (the skater’s own rate, attempts, home ice, the opponent’s shots allowed) for comparison.' : 'With no run saved for this date the numbers are the plain-rate read: the skater’s own rate this season blended with last season’s base, his attempts, home ice and what the opponent has allowed this season.'} Click a player for his card.
      </p>
      {board && !board.games.length ? <div className="nhlx-empty">No games on this date.</div> : null}
      {board && board.games.map((g, i) => (
        <article key={g.id} className={`nhlx-mu-game${i === 0 ? ' is-first' : ''}`}>
          <div className="nhlx-mu-game-head">
            <TeamLogo abbr={g.away} size={28} />
            <b>{g.away} @ {g.home}</b>
            <TeamLogo abbr={g.home} size={28} />
            <small>{g.final ? <>Final · <b className="nhlx-mu-score">{g.away} {g.score.away} – {g.home} {g.score.home}</b></> : fmtTime(g.startTimeUTC)}</small>
          </div>
          {g.skaters ? <div className="nhlx-pk-grid"><ShotsTable g={g} model={board.source === 'model'} /><GoalsTable g={g} model={board.source === 'model'} /></div> : <p className="nhlx-auto-meta">{board.source === 'model' ? 'The run projected nobody in this game.' : 'No lineups yet.'}</p>}
        </article>
      ))}
      {board?.notes?.length ? (
        <div className="nhlx-pk-notes">
          <h3>Notes on tonight</h3>
          <ul>{board.notes.map((n, i) => <li key={`${n.kind}-${i}`}>{n.text}</li>)}</ul>
        </div>
      ) : null}
    </section>
  );
}
