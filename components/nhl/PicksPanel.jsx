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

function ShotsTable({ g }) {
  return (
    <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
      <table className="nhlx-db-table nhlx-pk-table">
        <thead>
          <tr>
            <th>Shots{g.shotsFallback ? <i className="nhlx-fg-rank"> best available, under 50%</i> : null}</th>
            <th className="is-num is-wide" title="Projected shots on goal">λ</th>
            <th className="is-num is-wide" title="2+ shots: probability and the break-even price">2+</th>
            <th className="is-num" title="3+ shots">3+</th>
            <th className="is-num" title="4+ shots">4+</th>
            <th className="is-num" title="Shots a game this season (games), and last season's base">Season / base</th>
            <th className="is-num is-wide" title="Where the opponent ranks for shots allowed a game this season (1 = allows the most)">Opp</th>
          </tr>
        </thead>
        <tbody>
          {g.shots.map((c) => (
            <tr key={c.id}>
              <Player c={c} />
              <td className="is-num is-wide">{c.lamS.toFixed(2)}</td>
              <Prob p={c.p2} wide /><Prob p={c.p3} lead /><Prob p={c.p4} />
              <td className="is-num"><b>{c.rates.curSog == null ? '—' : c.rates.curSog.toFixed(2)}</b> <small>({c.rates.n}) / {c.rates.baseSog == null ? 'none' : c.rates.baseSog.toFixed(2)}</small></td>
              <td className="is-num is-wide">{c.oppRank ? `#${c.oppRank}` : '—'}{c.oppSog ? <small>{c.oppSog.toFixed(1)}/g</small> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {g.nextShots.length ? <p className="nhlx-pk-next">Next: {g.nextShots.map((c) => `${last(c.name)} ${pct(c.p3)}`).join(' · ')}</p> : null}
    </div>
  );
}

function GoalsTable({ g }) {
  return (
    <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
      <table className="nhlx-db-table nhlx-pk-table">
        <thead>
          <tr>
            <th>Goals{g.goalsFallback ? <i className="nhlx-fg-rank"> best available, under 35%</i> : null}</th>
            <th className="is-num is-wide" title="Projected goals">λ</th>
            <th className="is-num" title="1+ goal: probability and the break-even price">1+ G</th>
            <th className="is-num" title="Goals a game this season (games), and last season's base">Season / base</th>
            {g.goals.some((c) => c.model?.p1g != null) ? <th className="is-num" title="The latest saved model run's 1+ goal odds">Model</th> : null}
          </tr>
        </thead>
        <tbody>
          {g.goals.map((c) => (
            <tr key={c.id}>
              <Player c={c} />
              <td className="is-num is-wide">{c.lamG.toFixed(2)}</td>
              <Prob p={c.p1g} lead />
              <td className="is-num"><b>{c.rates.curG == null ? '—' : c.rates.curG.toFixed(2)}</b> <small>({c.rates.n}) / {c.rates.baseG == null ? 'none' : c.rates.baseG.toFixed(2)}</small></td>
              {g.goals.some((x) => x.model?.p1g != null) ? <td className="is-num">{c.model?.p1g != null ? pct(c.model.p1g) : '—'}</td> : null}
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
            {board ? `${board.games.length} game${board.games.length === 1 ? '' : 's'} · ${board.games.reduce((s, g) => s + g.skaters, 0)} skaters projected · the opponent read is this season's shots allowed (league ${board.allowed.league ?? '—'} a game)` : ''}
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
        The best shots play and the best goal play in every game, every skater over the floor (50% for 3+ shots, 35% for a goal). The percentage is the chance of the hit; the price under it is the break-even, so the play wants better odds than that. Each number is the skater’s own rate this season blended with last season’s base, his attempts, home ice and what the opponent has allowed this season. Click a player for his card.
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
          {g.skaters ? <div className="nhlx-pk-grid"><ShotsTable g={g} /><GoalsTable g={g} /></div> : <p className="nhlx-auto-meta">No lineups yet.</p>}
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
