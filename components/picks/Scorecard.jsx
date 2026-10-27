'use client';

import { useCallback, useEffect, useState } from 'react';

// The picks scorecard (/api/<sport>/scorecard): every stored slate's board replayed leak-free and
// graded against the box scores. Tables only; colour marks where the calls landed above or below
// what the board said. Nothing here feeds the board.
//   sport: { api, kind: 'date' | 'week', season (week), to (the slate date or week ordinal), label }

const pct = (v, d = 0) => (v == null ? '—' : `${(v * 100).toFixed(d)}%`);
const brier = (v) => (v == null ? '—' : v.toFixed(3));
const ret = (v) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`);
const fmtDate = (d) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }) : d);

/** Hit minus said, in points; tinted once the sample means something. */
function Diff({ s }) {
  if (!s || !s.n || s.diff == null) return <td className="is-num">—</td>;
  const d = s.diff * 100;
  const cls = s.n >= 20 && Math.abs(d) >= 5 ? (d > 0 ? ' is-over' : ' is-under') : '';
  return <td className={`is-num${cls}`} title={`Hit rate minus the stated chance over ${s.n} calls`}>{d > 0 ? '+' : ''}{d.toFixed(0)} pts</td>;
}
const Hit = ({ s }) => <td className="is-num">{s?.n ? <><b>{pct(s.hit)}</b><small>{s.n}</small></> : '—'}</td>;

/** Rows of { label, all, board }: said / calls / hit / diff for every call, then the table rows. */
function SplitTable({ title, rows, first = 'Split' }) {
  return (
    <div className="nhlx-db-table-wrap">
      <table className="nhlx-db-table nhlx-mu-table nhlx-sc-table">
        <thead>
          <tr>
            <th>{first}</th>
            <th className="is-num" title="Graded plays">Calls</th>
            <th className="is-num" title="The board’s average chance over those calls">Said</th>
            <th className="is-num" title="How often the line was cleared">Hit</th>
            <th className="is-num" title="Hit minus said">Diff</th>
            <th className="is-num" title="The plays that made a table (over the floor, PropFinder-backed): how often they hit">On the board</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key || r.label} className={r.all?.n ? '' : 'is-muted'}>
              <td><b>{r.label}</b></td>
              <td className="is-num">{r.all?.n ?? 0}</td>
              <td className="is-num">{pct(r.all?.said)}</td>
              <td className="is-num"><b>{pct(r.all?.hit)}</b></td>
              <Diff s={r.all} />
              <Hit s={r.board} />
            </tr>
          ))}
        </tbody>
      </table>
      {title ? <p className="nhlx-auto-meta" style={{ margin: '6px 2px 0' }}>{title}</p> : null}
    </div>
  );
}

function EdgeTable({ edges }) {
  return (
    <div className="nhlx-db-table-wrap ir-sc-wide">
      <table className="nhlx-db-table nhlx-mu-table nhlx-sc-table">
        <thead>
          <tr>
            <th>Edge against the book</th>
            <th className="is-num" title="Priced plays in the bucket">Calls</th>
            <th className="is-num" title="The price’s implied probability, vig included">Book said</th>
            <th className="is-num" title="The board’s chance">Board said</th>
            <th className="is-num">Hit</th>
            <th className="is-num" title="Flat-stake return per unit at the book’s price (a model metric: one unit on every call)">Return</th>
            <th className="is-num" title="The same on the plays that made a table">On the board</th>
          </tr>
        </thead>
        <tbody>
          {edges.map((e) => (
            <tr key={e.key} className={e.all?.priced ? '' : 'is-muted'}>
              <td><b>{e.label}</b></td>
              <td className="is-num">{e.all?.priced ?? 0}</td>
              <td className="is-num">{pct(e.all?.implied)}</td>
              <td className="is-num">{pct(e.all?.said)}</td>
              <td className="is-num"><b>{pct(e.all?.hit)}</b></td>
              <td className={`is-num${e.all?.ret != null && e.all.priced >= 20 ? (e.all.ret > 0 ? ' is-over' : ' is-under') : ''}`}>{ret(e.all?.ret)}</td>
              <td className="is-num">{e.board?.priced ? <>{ret(e.board.ret)}<small>{e.board.priced}</small></> : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LaddersTable({ ladders }) {
  const best = (l) => Math.min(...['model', 'emp', 'blend'].map((k) => l[k]?.brier ?? Infinity));
  return (
    <div className="nhlx-db-table-wrap">
      <table className="nhlx-db-table nhlx-mu-table nhlx-sc-table">
        <thead>
          <tr>
            <th>Ladder</th>
            <th className="is-num" title="Rungs graded (every rung of every player with a box-score line); the three reads are scored on the rungs with a hit rate">Rungs</th>
            <th className="is-num" title="The model’s tail over the rung: said / hit / Brier">Model said</th><th className="is-num">Hit</th><th className="is-num">Brier</th>
            <th className="is-num" title="His hit rate at the rung over his logs: said / hit / Brier">Hit-rate said</th><th className="is-num">Hit</th><th className="is-num">Brier</th>
            <th className="is-num" title="The blend the board shows (half and half): said / hit / Brier">Blend said</th><th className="is-num">Hit</th><th className="is-num">Brier</th>
            <th className="is-num" title="The book’s main rung: how often it cleared">Main rung</th>
            <th className="is-num" title="Rungs the blend put at 20–35%: the ceiling plays; said / hit">Ceiling rungs</th>
          </tr>
        </thead>
        <tbody>
          {ladders.map((l) => {
            const b = best(l);
            const cell = (k) => <td className={`is-num${l[k]?.n && l[k].brier === b ? ' is-best' : ''}`}>{brier(l[k]?.brier)}</td>;
            return (
              <tr key={l.key}>
                <td><b>{l.label}</b></td>
                <td className="is-num">{l.n}<small>{l.common}</small></td>
                <td className="is-num">{pct(l.model?.said)}</td><td className="is-num">{pct(l.model?.hit)}</td>{cell('model')}
                <td className="is-num">{pct(l.emp?.said)}</td><td className="is-num">{pct(l.emp?.hit)}</td>{cell('emp')}
                <td className="is-num">{pct(l.blend?.said)}</td><td className="is-num"><b>{pct(l.blend?.hit)}</b></td>{cell('blend')}
                <Hit s={l.main} />
                <td className="is-num">{l.ceiling?.n ? <>{pct(l.ceiling.said)} → <b>{pct(l.ceiling.hit)}</b><small>{l.ceiling.n}</small></> : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The predictors of a player's figure, per market: the windows of his own results before the game,
 * the board's blend, the projection and the book's line, each against the box score (bias, MAE,
 * RMSE) and as an over-the-line read (said / hit / Brier), on the rows every predictor covers.
 */
function PredictorsTable({ predictors }) {
  const [market, setMarket] = useState(predictors[0]?.key);
  const report = predictors.find((p) => p.key === market) || predictors[0];
  if (!report) return null;
  const list = report.common.predictors;
  const withN = list.filter((p) => p.n && !p.sparse);   // the bold compares the predictors scored on the same rows
  const bestMae = withN.length ? Math.min(...withN.map((p) => p.mae)) : null;
  const bestBrier = withN.filter((p) => p.brier != null).length ? Math.min(...withN.filter((p) => p.brier != null).map((p) => p.brier)) : null;
  const source = (s) => (s === 'own' ? 'his own results' : s === 'board' ? 'the board' : 'the book');
  return (
    <>
      <div className="nhlx-tabs" role="tablist" aria-label="Predictor market" style={{ marginBottom: 10 }}>
        {predictors.map((p) => <button key={p.key} type="button" role="tab" aria-selected={p.key === report.key} className={`nhlx-tab${p.key === report.key ? ' is-active' : ''}`} onClick={() => setMarket(p.key)}>{p.label} <small>{p.n}</small></button>)}
      </div>
      <div className="nhlx-db-table-wrap">
        <table className="nhlx-db-table nhlx-mu-table nhlx-sc-table">
          <thead>
            <tr>
              <th>Predictor</th>
              <th className="is-num" title="Player-games every predictor here covers">Rows</th>
              <th className="is-num" title="Average figure the predictor put on them">Projected</th>
              <th className="is-num" title="Average figure they got">Actual</th>
              <th className="is-num" title="Projected minus actual">Bias</th>
              <th className="is-num" title="Mean absolute error (lower is better)">MAE</th>
              <th className="is-num" title="Root mean squared error (lower is better)">RMSE</th>
              <th className="is-num" title="The chance of clearing the book’s main line the predictor implies as the centre of his distribution">Over the line said</th>
              <th className="is-num">Hit</th>
              <th className="is-num" title="Brier score of those chances (lower is better)">Brier</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.key} className={p.key === 'proj' ? 'is-model' : p.key === 'blend' ? 'is-blend' : ''}>
                <td title={p.note || undefined}><b>{p.label}</b> <small>{source(p.source)}</small>{p.sparse && p.n ? <small className="nhlx-auto-meta" style={{ display: 'block' }}>on its {p.n} rows · the projection there: MAE {p.against?.proj?.mae ?? '—'}, Brier {brier(p.against?.proj?.brier)} · the blend: MAE {p.against?.blend?.mae ?? '—'}, Brier {brier(p.against?.blend?.brier)}</small> : null}</td>
                <td className="is-num">{p.n}</td>
                <td className="is-num">{p.avg ?? '—'}</td>
                <td className="is-num">{p.actual ?? '—'}</td>
                <td className="is-num">{p.bias == null ? '—' : `${p.bias > 0 ? '+' : ''}${p.bias}`}</td>
                <td className={`is-num${p.n && !p.sparse && p.mae === bestMae ? ' is-best' : ''}`}>{p.mae ?? '—'}</td>
                <td className="is-num">{p.rmse ?? '—'}</td>
                <td className="is-num">{pct(p.said)}</td>
                <td className="is-num">{p.lined ? <><b>{pct(p.hit)}</b><small>{p.lined}</small></> : '—'}</td>
                <td className={`is-num${p.brier != null && !p.sparse && p.brier === bestBrier ? ' is-best' : ''}`}>{brier(p.brier)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="nhlx-auto-meta" style={{ margin: '6px 2px 0' }}>{report.common.n} of {report.n} player-games carry every predictor (a window needs its games; a line needs a book; head to head is scored on the rows with two meetings, the projection and the blend beside it on those same rows, and the bold is not for it). Bold = the best column. If a plain window beats the projection here over a month, the board should read from it.</p>
    </>
  );
}

export default function Scorecard({ sport }) {
  const { api, kind, season = null, to = null, label = '' } = sport;
  const [open, setOpen] = useState(true);
  const [range, setRange] = useState({ from: '', to: '' });
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [asked, setAsked] = useState(null);   // the range the report answers

  const load = useCallback(async (r) => {
    setBusy(true); setErr('');
    const q = new URLSearchParams();
    if (kind === 'week' && season) q.set('season', String(season));
    if (r.from) q.set('from', String(r.from));
    if (r.to) q.set('to', String(r.to));
    try {
      const res = await fetch(`${api}/scorecard?${q}`, { cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`);
      setReport(j);
      setAsked({ from: j.from, to: j.to });
      setRange((cur) => ({ from: cur.from || j.from || '', to: cur.to || j.to || '' }));
    } catch (e) { setErr(`Scorecard: ${e.message}`); }
    finally { setBusy(false); }
  }, [api, kind, season]);

  // The season to date on first open (the route's default range); the controls narrow it after.
  useEffect(() => { if (open && !report && !busy) load({ from: '', to: to || '' }); }, [open, report, busy, load, to]);

  const summary = report ? [
    [`${report.slates} ${kind === 'week' ? 'week' : 'night'}${report.slates === 1 ? '' : 's'}`],
    [`${report.graded} of ${report.games} finished game${report.games === 1 ? '' : 's'} graded`],
    [`${report.plays} calls`, `${report.boardPlays} on the board`],
  ] : [];
  const all = report?.all; const board = report?.board;

  return (
    <section className="ir-sc nhlx-sc" aria-label={`${label} scorecard`}>
      <div className="ir-sc-head">
        <div>
          <h2 className="nhlx-sc-h" style={{ margin: 0 }}>Scorecard <small>what the board said against what happened</small></h2>
          <p className="nhlx-auto-meta">Every stored {kind === 'week' ? 'week' : 'night'} replayed from its files as it stood before the games (each player’s log cut before his game) and graded against the box scores. Said = the board’s chance; Hit = how often the line was cleared; Brier = mean squared error of the chance (0.25 is a coin flip, lower is better). Nothing here feeds the board.</p>
        </div>
        <div className="ir-sc-range">
          {kind === 'date' ? (
            <>
              <input type="date" className="nhlx-input nhlx-input-sm" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} aria-label="From" />
              <span className="nhlx-auto-meta">to</span>
              <input type="date" className="nhlx-input nhlx-input-sm" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} aria-label="To" />
            </>
          ) : (
            <>
              <span className="nhlx-auto-meta">{season} · weeks</span>
              <input type="number" min="1" max="22" className="nhlx-input nhlx-input-sm" style={{ width: 72 }} value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} aria-label="From week" />
              <span className="nhlx-auto-meta">to</span>
              <input type="number" min="1" max="22" className="nhlx-input nhlx-input-sm" style={{ width: 72 }} value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} aria-label="To week" />
            </>
          )}
          <button type="button" className="nhlx-btn nhlx-btn-sm" disabled={busy} onClick={() => load(range)}>{busy ? 'Grading…' : 'Grade'}</button>
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      {err ? <div className="nhlx-alert" style={{ marginTop: 12 }}>{err}</div> : null}
      {open ? (
        !report ? <div className="nhlx-empty">{busy ? 'Grading the stored slates…' : 'No scorecard yet.'}</div> : !report.plays ? (
          <div className="nhlx-empty">No graded plays {asked?.from ? `between ${fmtDate(asked.from)} and ${fmtDate(asked.to)}` : 'yet'}: a slate grades once its games are final and their box scores stored.</div>
        ) : (
          <>
            <div className="ir-sc-sum">
              {summary.map((s, i) => <span key={i}>{s.map((x, j) => <span key={j}>{j ? ' · ' : ''}{x}</span>)}</span>)}
              <span>All calls: said <b>{pct(all.said)}</b>, hit <b>{pct(all.hit)}</b>, Brier <b>{brier(all.brier)}</b></span>
              <span>On the board: said <b>{pct(board.said)}</b>, hit <b>{pct(board.hit)}</b> over <b>{board.n}</b></span>
              {all.priced ? <span>At the book’s price: implied <b>{pct(all.implied)}</b>, return <b>{ret(all.ret)}</b> a unit over {all.priced} priced calls{board.priced ? <>, <b>{ret(board.ret)}</b> on the board’s {board.priced}</> : null}</span> : null}
              {asked?.from ? <span className="nhlx-auto-meta">{fmtDate(asked.from)} to {fmtDate(asked.to)} · built {new Date(report.builtAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span> : null}
            </div>
            <div className="ir-sc-grid">
              <SplitTable first="The board said" rows={report.buckets.map((b) => ({ key: b.key, label: b.label, all: b.all, board: b.board }))} title="Calibration: a well-read board hits about as often as it says in every row." />
              <SplitTable first="Market" rows={report.markets} />
              <SplitTable first="Matchup" rows={report.thirds} title="The opponent’s third at the player’s position for the stat (colour on the board, no number)." />
              <SplitTable first="Source" rows={report.sources} />
              <SplitTable first="Form" rows={report.forms} title="Flame and snowflake are colour only; this is whether they would have earned a number." />
              <EdgeTable edges={report.edges} />
            </div>
            {report.predictors?.length ? (
              <>
                <h3 className="nhlx-sc-h">What predicts his figure <small>his own results over a window, the board’s blend of them, the projection with the matchup in it, and the book’s line, each against the box scores</small></h3>
                <PredictorsTable predictors={report.predictors} />
              </>
            ) : null}
            {report.ladders?.length ? (
              <>
                <h3 className="nhlx-sc-h">Ladders <small>every rung of every player with a box-score line; the model’s tail, his hit rate and the blend the board shows, side by side</small></h3>
                <LaddersTable ladders={report.ladders} />
              </>
            ) : null}
            <h3 className="nhlx-sc-h">By {kind === 'week' ? 'week' : 'night'}</h3>
            <div className="nhlx-db-table-wrap">
              <table className="nhlx-db-table nhlx-mu-table nhlx-sc-table">
                <thead><tr><th>{kind === 'week' ? 'Week' : 'Night'}</th><th className="is-num" title="Games graded / games finished">Games</th><th className="is-num">Calls</th><th className="is-num">Said</th><th className="is-num">Hit</th><th className="is-num">Diff</th><th className="is-num">On the board</th></tr></thead>
                <tbody>
                  {report.bySlate.map((s) => (
                    <tr key={s.key} className={s.plays ? '' : 'is-muted'}>
                      <td><b>{kind === 'date' ? fmtDate(s.key) : s.label}</b> <small>{kind === 'date' ? s.key : ''}</small></td>
                      <td className="is-num">{s.graded}/{s.finals}</td>
                      <td className="is-num">{s.plays}</td>
                      <td className="is-num">{pct(s.all?.said)}</td>
                      <td className="is-num"><b>{pct(s.all?.hit)}</b></td>
                      <Diff s={s.all} />
                      <Hit s={s.board} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      ) : null}
    </section>
  );
}
