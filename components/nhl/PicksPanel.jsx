'use client';

import { useCallback, useEffect, useState } from 'react';
import { Headshot, TeamLogo } from './media';
import { usePlayerCard } from './PlayerCard';
import { SlateDateContext } from './player-card-context';
import { fairOdds, hitOf, FORM } from '@/lib/nhl-data/picks-pure';

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

const ICON = {
  // a flame, a snowflake and a rink: 16-unit glyphs drawn in the current colour
  hot: <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5c.6 2.2 2.6 3.3 3.6 5.2A4.6 4.6 0 0 1 8 14.5a4.6 4.6 0 0 1-4.3-6.3c.4-1 1.1-1.7 1.6-2.6.2 1 .7 1.7 1.4 2.1C6.6 5.5 6.9 3.4 8 1.5Z" fill="currentColor" /></svg>,
  cold: <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1v14M1.9 4.5l12.2 7M1.9 11.5l12.2-7M8 1 6 3M8 1l2 2M8 15l-2-2M8 15l2-2M1.9 4.5l2.7.7M1.9 4.5l.7-2.7M14.1 11.5l-2.7-.7M14.1 11.5l-.7 2.7M1.9 11.5l.7 2.7M1.9 11.5l2.7-.7M14.1 4.5l-.7-2.7M14.1 4.5l-2.7.7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" /></svg>,
  soft: <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1" y="3" width="14" height="10" rx="3.5" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M8 3v10" stroke="currentColor" strokeWidth="1.2" /><circle cx="8" cy="8" r="1.8" fill="none" stroke="currentColor" strokeWidth="1.2" /></svg>,
};

/**
 * The flags beside a name for the table's market: a flame or snowflake for his form going in
 * (colour only: the study found a streak adds nothing once the rate is in, so the number is
 * untouched) and a green rink when the opponent sits in the soft third at his position.
 */
function flagsFor(c, stat) {
  const f = c.form; const o = c.oppPos; const out = [];
  if (f) {
    if (stat === 'sog') {
      if (f.hotS) out.push({ kind: 'hot', title: `Hot: ${f.sogL5} shots a game over his last ${f.games}, ${Math.round((f.sogRatio - 1) * 100)}% over his norm (colour only; the number already carries his rate and minutes)` });
      else if (f.coldS) out.push({ kind: 'cold', title: `Cold: ${f.sogL5} shots a game over his last ${f.games}, ${Math.round((1 - f.sogRatio) * 100)}% under his norm` });
    } else if (f.hotG) out.push({ kind: 'hot', title: `Hot: ${f.gL5} goal${f.gL5 === 1 ? '' : 's'} in his last ${f.games} games (colour only; the study found no carry-over from a streak)` });
    else if (f.coldG) out.push({ kind: 'cold', title: `Cold: no goal in his last ${FORM.coldGoalsGames} games` });
  }
  if (o && (stat === 'sog' ? o.softSog : o.softG)) {
    const v = stat === 'sog' ? o.sog : o.g; const rank = stat === 'sog' ? o.rankSog : o.rankG;
    out.push({ kind: 'soft', title: `Soft spot: ${c.opp} allows ${v.toFixed(stat === 'sog' ? 2 : 3)} ${stat === 'sog' ? 'shots' : 'goals'} per ${c.pos} a game, #${rank} of ${o.teams} (the soft third)` });
  }
  return out;
}

function Player({ c, stat }) {
  const open = usePlayerCard();
  const flags = flagsFor(c, stat);
  return (
    <td className="is-click" onClick={() => open({ id: c.id, opp: c.opp, venue: c.venue, pos: c.pos, line: c.line })}>
      <div className="nhlx-db-player">
        <Headshot id={c.id} size={30} />
        <span><b>{c.name}{flags.length ? <span className="nhlx-pk-flags">{flags.map((f) => <i key={f.kind} className={`nhlx-pk-flag is-${f.kind}`} title={f.title} aria-label={f.title}>{ICON[f.kind]}</i>)}</span> : null}</b><small>{c.team} · {c.pos}{c.line ? c.line : ''} · {c.venue === 'H' ? 'vs' : 'at'} {c.opp}{c.carried ? ' · carried' : ''}</small></span>
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
              <Prob p={c.p2} wide hit={hitOf(c, 'sog', 2)} /><Prob p={c.p3} lead hit={hitOf(c, 'sog', 3)} /><Prob p={c.p4} hit={hitOf(c, 'sog', 4)} />
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
              <Prob p={c.p1g} lead hit={hitOf(c, 'g', 1)} />
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
            {board ? `${board.games.length} game${board.games.length === 1 ? '' : 's'} · ${board.source === 'model' ? `model run saved ${board.modelRun?.createdAt ? fmtTime(board.modelRun.createdAt) : ''}` : 'no model run yet: own rates'}` : ''}
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
        The best shots plays and goal plays in every game. The percentage is the chance of the hit, the price under it the break-even; dimmed rows are under the floor. Click a player for his card.
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
          {g.skaters ? <div className="nhlx-pk-grid"><ShotsTable g={g} /><GoalsTable g={g} /></div> : <p className="nhlx-auto-meta">{board.source === 'model' ? 'The run projected nobody in this game.' : 'No lineups yet.'}</p>}
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
