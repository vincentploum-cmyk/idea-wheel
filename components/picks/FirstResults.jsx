'use client';

import { useState } from 'react';

// The first-scorer picks' season record (lib/picks/first-results.js), drawn the same on the three sports' tabs: the
// NBA's first basket, the NHL's first goal, the NFL's first touchdown.
const pct = (v, d = 1) => (v == null ? '—' : `${(v * 100).toFixed(d)}%`);
const SHOWN = 40;

function Line({ label, t, title }) {
  return (
    <tr title={title}>
      <td><b>{label}</b></td>
      <td>{t.hits} of {t.n}</td>
      <td><b>{pct(t.rate)}</b></td>
      <td>{pct(t.said)}</td>
      <td>{pct(t.random)}</td>
    </tr>
  );
}

/**
 * `data` = firstResultsPayload's { what, summary, log, nights, missing, errors }; `unit` names a slate ("night",
 * "week"); `whenOf` words an entry's date (the NFL's "Week 9"). Null draws nothing; no graded game says so.
 */
export function FirstResults({ data, error = '', unit = 'night', whenOf = (e) => e.date }) {
  const [more, setMore] = useState(false);
  if (error) return <div className="nhlx-alert">{error}</div>;
  if (!data) return <div className="nhlx-empty">Loading the record…</div>;
  const s = data.summary; const what = data.what;
  const pending = data.missing ? ` ${data.missing} more ${unit}${data.missing === 1 ? '' : 's'} still to grade: reload to add ${data.missing === 1 ? 'it' : 'them'}.` : '';
  if (!s.games) return <div className="nhlx-empty">No game graded yet for the {what}.{pending}</div>;
  const rows = more ? data.log : data.log.slice(0, SHOWN);
  return (
    <div className="nhlx-fr">
      <p className="nhlx-auto-meta nhlx-fg-how">
        {s.games} game{s.games === 1 ? '' : 's'} graded over {data.nights} {unit}{data.nights === 1 ? '' : 's'}{s.first ? `, ${s.first} to ${s.last}` : ''}: each {unit}’s list rebuilt from what was on record before it, then set against who scored the {what}.
        {' '}The scorer was on our list in {s.listed} of {s.games} ({pct(s.listed / s.games, 0)}){s.meanRank != null ? `, at place ${s.meanRank} of about ${s.perGame} on average` : ''}.{pending}
      </p>
      <div className="nhlx-db-table-wrap">
        <table className="nhlx-db-table nhlx-mu-table nhlx-fg-table">
          <thead>
            <tr>
              <th>Our pick</th><th>Scored the {what}</th><th>Hit rate</th>
              <th title="What our list said such a pick was worth: the stated chances added up">We said</th>
              <th title="A pick drawn at random from the same list">At random</th>
            </tr>
          </thead>
          <tbody>
            <Line label="The top pick" t={s.top1} title={`Our first name in each game scored the ${what}`} />
            <Line label="One of the top 3" t={s.top3} title={`The scorer was one of our first three names`} />
            <Line label="One of the top 5" t={s.top5} title={`The scorer was one of our first five names`} />
          </tbody>
        </table>
      </div>
      <div className="nhlx-db-table-wrap">
        <table className="nhlx-db-table nhlx-mu-table nhlx-fg-table">
          <thead>
            <tr><th title="Every name on every list, by the chance we gave him">Chance we gave</th><th>Names</th><th>We said</th><th>Scored it</th></tr>
          </thead>
          <tbody>
            {s.bands.map((b) => (
              <tr key={b.lo}>
                <td>{b.hi >= 1 ? `${Math.round(b.lo * 100)}%+` : `${Math.round(b.lo * 100)}–${Math.round(b.hi * 100)}%`}</td>
                <td>{b.n}</td><td>{pct(b.said)}</td><td><b>{pct(b.landed)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="nhlx-db-table-wrap">
        <table className="nhlx-db-table nhlx-mu-table nhlx-fg-table">
          <thead>
            <tr>
              <th>When</th><th>Game</th><th>Scored the {what}</th>
              <th title="His place on our list (1 = our top pick) and the chance we gave him">We had him</th>
              <th>Our top pick</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={`${e.date}-${e.id}`} className={e.rank === 1 ? 'is-hit' : ''}>
                <td>{whenOf(e)}</td>
                <td>{e.game}</td>
                <td><b>{e.scorer.name}</b>{e.scorer.team ? <small className="nhlx-auto-meta"> {e.scorer.team}</small> : null}</td>
                <td>{e.rank == null ? <span className="nhlx-auto-meta">not on our list</span> : <>#{e.rank} of {e.n} <small className="nhlx-auto-meta">{pct(e.said)}</small></>}</td>
                <td>{e.top[0] ? <>{e.top[0].hit ? '✓ ' : ''}{e.top[0].name}{e.top[0].team ? <small className="nhlx-auto-meta"> {e.top[0].team}</small> : null} <small className="nhlx-auto-meta">{pct(e.top[0].p)}</small></> : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.log.length > SHOWN ? <button type="button" className="nhlx-tab" onClick={() => setMore((v) => !v)}>{more ? 'Show fewer' : `Show all ${data.log.length} games`}</button> : null}
    </div>
  );
}
