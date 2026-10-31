'use client';

import { useCallback, useEffect, useState } from 'react';
import { Headshot, TeamLogo } from './media';
import { usePlayerCard } from './PlayerCard';
import { SlateDateContext } from './player-card-context';
import { fairOdds, hitOf } from '@/lib/nhl-data/picks-pure';
import { SAVES_MARKS, SAVES_LEAD, SAVES_FLOOR } from '@/lib/nhl-data/goalies-pure';
import { Flags } from './flags';

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const last = (name) => String(name || '').split(' ').slice(-1)[0];

/** A probability with its break-even price under it; once the box score is in, green when the skater reached the market's floor, red when he fell short. */
// A chance as the board prints it: calibrated to what its stated chances have landed this season (lib/nhl-data/calibration.js),
// the figure as stated on the hover.
function Prob({ p, raw = null, lead = false, wide = false, hit = null }) {
  return <td className={`is-num${lead ? ' is-lead' : ''}${wide ? ' is-wide' : ''}${hit == null ? '' : hit ? ' is-hit' : ' is-miss'}`} title={raw != null ? `As stated: ${pct(raw)}. Shown calibrated to what such calls have landed this season.` : undefined}><b>{pct(p)}</b><small>{fairOdds(p)}</small></td>;
}

// The row's own grade follows its table's lead market (3+ SOG, 1+ G); a skater with no box-score row reads DNP.
const rowGrade = (c, stat, min) => (c.actual === undefined ? '' : c.actual === null ? ' is-dnp' : hitOf(c, stat, min) ? ' is-hit' : ' is-miss');
const rowTitle = (c, stat, min, unit) => (c.actual === undefined ? null : c.actual === null ? 'Did not play' : `${hitOf(c, stat, min) ? 'Hit' : 'Miss'}: ${c.actual[stat]} ${unit} in the box score`);

/** Finished game: the skater's box-score figure for the table's stat. */
function Got({ c, stat, unit }) {
  if (c.actual === undefined) return null;
  return <td className="is-num nhlx-pk-got">{c.actual === null ? <small>DNP</small> : <><b>{c.actual[stat]}</b><small>{unit}</small></>}</td>;
}

function Player({ c, stat }) {
  const open = usePlayerCard();
  return (
    <td className="is-click" onClick={() => open({ id: c.id, opp: c.opp, venue: c.venue, pos: c.pos, line: c.line })}>
      <div className="nhlx-db-player">
        <Headshot id={c.id} size={30} />
        <span><b>{c.name}<Flags c={c} stat={stat} /></b><small>{c.team} · {c.pos}{c.line ? c.line : ''} · {c.venue === 'H' ? 'vs' : 'at'} {c.opp}{c.carried ? ' · carried' : ''}</small></span>
      </div>
    </td>
  );
}

/** "3 of 4 shots plays hit, 1 of 3 goal plays" for a finished game: the rows over the floor, on their lead market. */
function tally(g) {
  const count = (list, stat, min) => { const rows = list.filter((c) => !c.under && c.actual); return rows.length ? `${rows.filter((c) => hitOf(c, stat, min)).length} of ${rows.length}` : null; };
  const s = count(g.shots || [], 'sog', 3); const go = count(g.goals || [], 'g', 1);
  const sv = (() => { const rows = (g.saves || []).filter((r) => !r.under && r.actual); return rows.length ? `${rows.filter((r) => r.played !== false && r.actual.sv >= SAVES_LEAD).length} of ${rows.length}` : null; })();
  return [s ? `${s} shots plays hit` : null, go ? `${go} goal plays hit` : null, sv ? `${sv} saves plays hit` : null].filter(Boolean).join(', ');
}

const pct3 = (v) => (v == null ? '—' : `.${String(Math.round(v * 1000)).padStart(3, '0')}`);

/** The Saves table: each side's likely starter, the shots he is expected to face, the chance of 25 / 30 / 35 saves (30+ the play), his line once final. */
function SavesTable({ g }) {
  const rows = g.saves || [];
  if (!rows.length) return null;
  const grade = (r, k) => (r.actual === undefined ? null : r.actual == null ? null : r.played === false ? false : r.actual.sv >= k);
  return (
    <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
      <table className="nhlx-db-table nhlx-pk-table">
        <thead>
          <tr>
            <th>Saves{rows.every((r) => r.under) ? <i className="nhlx-fg-rank"> nobody over {Math.round(SAVES_FLOOR * 100)}% for 30: best available</i> : null}</th>
            {SAVES_MARKS.map((k) => <th key={k} className={`is-num${k === SAVES_LEAD ? '' : ' is-wide'}`} title={`${k}+ saves: the chance, and the break-even price under it`}>{k}+</th>)}
            <th className="is-num" title="The saves projected: the shots the opponent is expected to put on him × his save percentage">Proj</th>
            {g.final ? <th className="is-num" title="Saves on shots against in the box score">Got</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const hit = grade(r, SAVES_LEAD);
            const title = [
              `${r.name}: ${r.starter === 'likely' ? 'likely in net' : 'in net'} (${r.reason})${r.other ? ` · the other way: ${r.other.name}, ${r.other.starts} start${r.other.starts === 1 ? '' : 's'}` : ''}`,
              `${r.shots} shots faced expected (${r.shotsFrom}) × ${pct3(r.svPct)} = ${r.lam} saves · ${r.starts} start${r.starts === 1 ? '' : 's'} this season${r.pct != null ? `, ${pct3(r.pct)} shrunk to ${pct3(r.svPct)}` : ''}${r.savesPerStart != null ? `, ${r.savesPerStart} saves a start` : ''}${r.held ? ' · last season’s goalies, no game this season yet' : ''}`,
              r.under ? `Under the ${Math.round(SAVES_FLOOR * 100)}% floor for ${SAVES_LEAD} saves: listed for the read` : null,
              r.actual === undefined ? null : r.actual == null ? 'No goalie line in the box score' : r.played === false ? `${r.startedBy || 'Another goalie'} played instead: ${r.actual.sv} saves on ${r.actual.sa}` : `${hit ? 'Hit' : 'Miss'}: ${r.actual.sv} saves on ${r.actual.sa} shots`,
            ].filter(Boolean).join(' · ');
            return (
              <tr key={r.id} className={`${r.under ? 'is-under' : ''}${r.actual === undefined ? '' : r.played === false ? ' is-dnp' : hit ? ' is-hit' : ' is-miss'}`} title={title}>
                <td>
                  <div className="nhlx-db-player">
                    <Headshot id={r.id} size={30} />
                    <span><b>{r.name}</b><small>{r.team} · G{r.starter === 'likely' ? ' · likely' : ''}{r.b2b ? ' · b2b' : ''} · {r.venue === 'H' ? 'vs' : 'at'} {r.opp} · {pct3(r.svPct)} · faces ~{Math.round(r.shots)}</small></span>
                  </div>
                </td>
                {SAVES_MARKS.map((k) => <Prob key={k} p={r[`p${k}`]} lead={k === SAVES_LEAD} wide={k !== SAVES_LEAD} hit={grade(r, k)} />)}
                <td className="is-num"><b>{r.lam}</b><small>saves</small></td>
                {g.final ? <td className="is-num nhlx-pk-got">{r.actual == null ? <small>—</small> : <><b>{r.actual.sv}</b><small>of {r.actual.sa}{r.played === false ? ` · ${String(r.startedBy || '').split(' ').slice(-1)[0]}` : ''}</small></>}</td> : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ShotsTable({ g }) {
  return (
    <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
      <table className="nhlx-db-table nhlx-pk-table">
        <thead>
          <tr>
            <th>Shots{g.shotsFallback ? <i className="nhlx-fg-rank"> nobody over 50%: best available</i> : null}</th>
            <th className="is-num is-wide" title="2+ shots: the chance, and the break-even price under it">2+</th>
            <th className="is-num" title="3+ shots: the chance, and the break-even price under it">3+</th>
            <th className="is-num" title="4+ shots: the chance, and the break-even price under it">4+</th>
            {g.final ? <th className="is-num" title="Shots on goal in the box score">Got</th> : null}
          </tr>
        </thead>
        <tbody>
          {g.shots.map((c) => (
            <tr key={c.id} className={`${c.under ? 'is-under' : ''}${rowGrade(c, 'sog', 3)}`} title={[c.under ? 'Under the 50% floor for 3+ shots: listed to make three' : null, rowTitle(c, 'sog', 3, 'SOG')].filter(Boolean).join(' · ') || undefined}>
              <Player c={c} stat="sog" />
              <Prob p={c.p2} raw={c.raw?.p2} wide hit={hitOf(c, 'sog', 2)} /><Prob p={c.p3} raw={c.raw?.p3} lead hit={hitOf(c, 'sog', 3)} /><Prob p={c.p4} raw={c.raw?.p4} hit={hitOf(c, 'sog', 4)} />
              {g.final ? <Got c={c} stat="sog" unit="SOG" /> : null}
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
            <th>Goals{g.goalsFallback ? <i className="nhlx-fg-rank"> nobody over 35%: best available</i> : null}</th>
            <th className="is-num" title="1+ goal: the chance, and the break-even price under it">1+ G</th>
            {g.final ? <th className="is-num" title="Goals in the box score">Got</th> : null}
          </tr>
        </thead>
        <tbody>
          {g.goals.map((c) => (
            <tr key={c.id} className={`${c.under ? 'is-under' : ''}${rowGrade(c, 'g', 1)}`} title={[c.under ? 'Under the 35% floor for a goal: listed to make three' : null, rowTitle(c, 'g', 1, 'G')].filter(Boolean).join(' · ') || undefined}>
              <Player c={c} stat="g" />
              <Prob p={c.p1g} raw={c.raw?.p1g} lead hit={hitOf(c, 'g', 1)} />
              {g.final ? <Got c={c} stat="g" unit="G" /> : null}
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
            {board ? `${board.games.length} game${board.games.length === 1 ? '' : 's'} · ${board.source === 'model' ? `model run saved ${board.modelRun?.createdAt ? fmtTime(board.modelRun.createdAt) : ''}` : 'no model run yet: own rates'}${board.calibration ? ` · chances calibrated on ${board.calibration.games} graded skater-games${board.calibration.to ? ` through ${board.calibration.to}` : ''} (hover one for the figure as stated)` : ''}` : ''}
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
        The best shots plays, goal plays and saves plays in every game. The percentage is the chance of the hit, the price under it the break-even; dimmed rows are under the floor. Click a skater for his card. The Saves table reads each team’s likely starter from the stored box scores (hover him for why) facing the shots the board expects of the opponent.
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
          {g.skaters ? <div className={`nhlx-pk-grid${g.saves?.length ? ' has-saves' : ''}`}><ShotsTable g={g} /><GoalsTable g={g} /><SavesTable g={g} /></div> : <p className="nhlx-auto-meta">{board.source === 'model' ? 'The run projected nobody in this game.' : 'No lineups yet.'}</p>}
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
