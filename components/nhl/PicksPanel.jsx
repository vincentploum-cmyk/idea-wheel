'use client';

import { useCallback, useEffect, useState } from 'react';
import { Headshot, TeamLogo } from './media';
import { usePlayerCard } from './PlayerCard';
import { SlateDateContext } from './player-card-context';
import { fairOdds, hitOf } from '@/lib/nhl-data/picks-pure';

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const last = (name) => String(name || '').split(' ').slice(-1)[0];

/** A probability with its break-even price under it; once the box score is in, green when the skater reached the market's floor, red when he fell short. */
function Prob({ p, lead = false, wide = false, hit = null }) {
  return <td className={`is-num${lead ? ' is-lead' : ''}${wide ? ' is-wide' : ''}${hit == null ? '' : hit ? ' is-hit' : ' is-miss'}`}><b>{pct(p)}</b><small>{fairOdds(p)}</small></td>;
}

// The row's own grade follows its table's lead market (3+ SOG, 1+ G); a skater with no box-score row reads DNP.
const rowGrade = (c, stat, min) => (c.actual === undefined ? '' : c.actual === null ? ' is-dnp' : hitOf(c, stat, min) ? ' is-hit' : ' is-miss');
const rowTitle = (c, stat, min, unit) => (c.actual === undefined ? null : c.actual === null ? 'Did not play' : `${hitOf(c, stat, min) ? 'Hit' : 'Miss'}: ${c.actual[stat]} ${unit} in the box score`);

/** Finished game: the skater's box-score figure for the table's stat. */
function Got({ c, stat, unit }) {
  if (c.actual === undefined) return null;
  return <td className="is-num nhlx-pk-got">{c.actual === null ? <small>DNP</small> : <><b>{c.actual[stat]}</b><small>{unit}</small></>}</td>;
}

function Player({ c }) {
  const open = usePlayerCard();
  return (
    <td className="is-click" onClick={() => open({ id: c.id, opp: c.opp, venue: c.venue, pos: c.pos, line: c.line })}>
      <div className="nhlx-db-player">
        <Headshot id={c.id} size={30} />
        <span><b>{c.name}</b><small>{c.team} · {c.pos}{c.line ? c.line : ''} · {c.venue === 'H' ? 'vs' : 'at'} {c.opp}{c.carried ? ' · carried' : ''}</small></span>
      </div>
    </td>
  );
}

/** "3 of 4 shots plays hit, 1 of 3 goal plays" for a finished game: the rows over the floor, on their lead market. */
function tally(g) {
  const count = (list, stat, min) => { const rows = list.filter((c) => !c.under && c.actual); return rows.length ? `${rows.filter((c) => hitOf(c, stat, min)).length} of ${rows.length}` : null; };
  const s = count(g.shots || [], 'sog', 3); const go = count(g.goals || [], 'g', 1);
  return [s ? `${s} shots plays hit` : null, go ? `${go} goal plays hit` : null].filter(Boolean).join(', ');
}

/** The opponent's read at the skater's position: the blended per-skater figure and its rank (1 = allows the most to the position). */
function OppPos({ c, k, rank }) {
  const o = c.oppPos;
  if (!o || o[k] == null) return <td className="is-num is-wide">—</td>;
  return <td className="is-num is-wide" title={`${c.opp} allows ${o[k].toFixed(2)} ${k === 'sog' ? 'shots' : 'goals'} per ${c.pos} a game (${o.games} game${o.games === 1 ? '' : 's'} this season blended into last season's ${o.prevGames}); rank ${o[rank] ?? '—'} of the league, 1 = allows the most`}>{o[rank] ? `#${o[rank]}` : '—'}<small>{o[k].toFixed(2)}/{c.pos}{c.b2b ? ' · B2B' : ''}</small></td>;
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
            {g.final ? <th className="is-num" title="Shots on goal in the box score">Got</th> : null}
            {model ? <th className="is-num is-wide" title="The study's own rate for 3+ shots, for comparison (the skater's rate, attempts and ice time, home ice, back-to-back, what the opponent allows per skater at his position)">Study 3+</th> : null}
            {model ? <th className="is-num is-wide" title="The study's own rate for 4+ shots">Study 4+</th> : null}
            <th className="is-num" title="Shots a game this season (games), and last season's base">Season / base</th>
            <th className="is-num is-wide" title="What the opponent allows per skater at his position, shots a game (this season blended into last season's), and its rank among the teams (1 = allows the most to the position)">Opp to pos</th>
          </tr>
        </thead>
        <tbody>
          {g.shots.map((c) => (
            <tr key={c.id} className={`${c.under ? 'is-under' : ''}${rowGrade(c, 'sog', 3)}`} title={[c.under ? 'Under the 50% floor for 3+ shots: listed to make three' : null, rowTitle(c, 'sog', 3, 'SOG')].filter(Boolean).join(' · ') || undefined}>
              <Player c={c} />
              <td className="is-num is-wide">{c.lamS.toFixed(2)}</td>
              <Prob p={c.p2} wide hit={hitOf(c, 'sog', 2)} /><Prob p={c.p3} lead hit={hitOf(c, 'sog', 3)} /><Prob p={c.p4} hit={hitOf(c, 'sog', 4)} />
              {g.final ? <Got c={c} stat="sog" unit="SOG" /> : null}
              {model ? <td className="is-num is-wide nhlx-pk-study">{c.study ? pct(c.study.p3) : '—'}</td> : null}
              {model ? <td className="is-num is-wide nhlx-pk-study">{c.study ? pct(c.study.p4) : '—'}</td> : null}
              <td className="is-num">{season(c, 'curSog', 'baseSog')}</td>
              <OppPos c={c} k="sog" rank="rankSog" />
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
            {g.final ? <th className="is-num" title="Goals in the box score">Got</th> : null}
            {model ? <th className="is-num is-wide" title="The study's own rate for 1+ goal, for comparison (the skater's goals, chances and shots, home ice, back-to-back, the opponent's goals allowed per skater at his position)">Study 1+</th> : null}
            <th className="is-num" title="Goals a game this season (games), and last season's base">Season / base</th>
            <th className="is-num is-wide" title="Goals the opponent allows per skater at his position a game (this season blended into last season's), and its rank among the teams (1 = allows the most to the position)">Opp to pos</th>
          </tr>
        </thead>
        <tbody>
          {g.goals.map((c) => (
            <tr key={c.id} className={`${c.under ? 'is-under' : ''}${rowGrade(c, 'g', 1)}`} title={[c.under ? 'Under the 35% floor for a goal: listed to make three' : null, rowTitle(c, 'g', 1, 'G')].filter(Boolean).join(' · ') || undefined}>
              <Player c={c} />
              <td className="is-num is-wide">{c.lamG.toFixed(2)}</td>
              <Prob p={c.p1g} lead hit={hitOf(c, 'g', 1)} />
              {g.final ? <Got c={c} stat="g" unit="G" /> : null}
              {model ? <td className="is-num is-wide nhlx-pk-study">{c.study ? pct(c.study.p1g) : '—'}</td> : null}
              <td className="is-num">{season(c, 'curG', 'baseG')}</td>
              <OppPos c={c} k="g" rank="rankG" />
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
    <SlateDateContext.Provider value={date}>
    <section className="nhlx-pk" aria-label="Tonight’s picks">
      <div className="nhlx-today-head">
        <div>
          <div className="nhlx-today-date">{pretty || 'Loading…'}</div>
          <div className="nhlx-auto-sub">
            {board ? `${board.games.length} game${board.games.length === 1 ? '' : 's'} · ${board.games.reduce((s, g) => s + g.skaters, 0)} skaters · ${board.source === 'model' ? `the model's numbers from the run saved ${board.modelRun?.createdAt ? new Date(board.modelRun.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ''} (${board.modelRun?.players ?? '—'} players; skaters it did not project are not listed)${board.studyWeight ? `, blended ${Math.round(board.studyWeight * 100)}% with the study's read` : ''}` : 'no model run for this date: the study\'s rates stand in'}` : ''}
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
        The best shots plays and the best goal plays in every game: every skater over the floor (50% for 3+ shots, 35% for a goal), and three to four a table (the rest on the “next” line); the dimmed rows are under the floor. The percentage is the chance of the hit; the price under it is the break-even, so the play wants better odds than that. {board?.source === 'model' ? board.studyWeight ? `The numbers are a blend: ${Math.round((1 - board.studyWeight) * 100)}% the model’s λ from the latest run saved for the date, ${Math.round(board.studyWeight * 100)}% the study’s plain-rate λ, the odds read off the blended rate; the dimmed Study column is the study’s own read.` : 'The numbers are the model’s, from the latest run saved for the date; the dimmed Study column is the plain-rate read (the skater’s own rate, attempts and ice time, home ice, back-to-back, what the opponent allows per skater at his position) for comparison.' : 'With no run saved for this date the numbers are the plain-rate read: the skater’s own rate this season blended with last season’s base, his attempts and ice time, home ice, back-to-back, and what the opponent allows per skater at his position (this season blended into last season’s).'} Click a player for his card.
      </p>
      {board && !board.games.length ? <div className="nhlx-empty">No games on this date.</div> : null}
      {board && board.games.map((g, i) => (
        <article key={g.id} className={`nhlx-mu-game${i === 0 ? ' is-first' : ''}`}>
          <div className="nhlx-mu-game-head">
            <TeamLogo abbr={g.away} size={28} />
            <b>{g.away} @ {g.home}</b>
            <TeamLogo abbr={g.home} size={28} />
            <small>{g.final ? <>Final · <b className="nhlx-mu-score">{g.away} {g.score.away} – {g.home} {g.score.home}</b>{tally(g) ? <> · {tally(g)}</> : null}</> : fmtTime(g.startTimeUTC)}</small>
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
    </SlateDateContext.Provider>
  );
}
