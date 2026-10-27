'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { plainSummary } from '@/lib/picks/scorecard-words';

// The picks scorecard (/api/<sport>/scorecard): every stored slate's board replayed with only what
// was known before the games and graded against the box scores. The verdict at the top says it in
// plain words (lib/picks/scorecard-words.js); the tables under it are the detail. Nothing here
// feeds the board.
//   sport: { api, kind: 'date' | 'week', season (week), to (the slate date or week ordinal), label }
//
// The words the tables use: "board said" = the chance the board gave; "actually hit" = how often
// the line was cleared; "off by" = actually hit minus board said, in points (green = hit more
// often than said); "accuracy" = how far the chances were from what happened, 0 perfect, 0.25 a
// coin flip, lower is better (the Brier score); "average miss" = how far a projected figure was
// from the box score, in the stat's units.

const pct = (v, d = 0) => (v == null ? '—' : `${(v * 100).toFixed(d)}%`);
const acc = (v) => (v == null ? '—' : v.toFixed(3));
const ret = (v) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}${Math.round(Math.abs(v) * 100)}%`);
const fmtDate = (d) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }) : d);
const ACCURACY = 'How far the chances were from what happened: 0 is perfect, 0.25 is a coin flip, lower is better';

/** Actually hit minus board said, in points; tinted once the sample means something. */
function OffBy({ s }) {
  if (!s || !s.n || s.diff == null) return <td className="is-num">—</td>;
  const d = s.diff * 100;
  const cls = s.n >= 20 && Math.abs(d) >= 5 ? (d > 0 ? ' is-over' : ' is-under') : '';
  return <td className={`is-num${cls}`} title={`Actually hit minus board said over ${s.n} plays; green = hit more often than the board said, red = less often`}>{d > 0 ? '+' : ''}{d.toFixed(0)} pts</td>;
}
const Hit = ({ s }) => <td className="is-num">{s?.n ? <><b>{pct(s.hit)}</b><small>{s.n}</small></> : '—'}</td>;

/** Rows of { label, all, board }: plays / board said / actually hit / off by, then the board's own plays. */
function SplitTable({ title, rows, first = 'Split' }) {
  return (
    <div className="nhlx-db-table-wrap">
      <table className="nhlx-db-table nhlx-mu-table nhlx-sc-table">
        <thead>
          <tr>
            <th>{first}</th>
            <th className="is-num" title="Graded plays">Plays</th>
            <th className="is-num" title="The chance the board gave, averaged over those plays">Board said</th>
            <th className="is-num" title="How often the line was actually cleared">Actually hit</th>
            <th className="is-num" title="Actually hit minus board said, in points">Off by</th>
            <th className="is-num" title="The plays that made a table (over the floor, PropFinder-backed): how often they hit, and how many">Board picks hit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key || r.label} className={r.all?.n ? '' : 'is-muted'}>
              <td><b>{r.label}</b></td>
              <td className="is-num">{r.all?.n ?? 0}</td>
              <td className="is-num">{pct(r.all?.said)}</td>
              <td className="is-num"><b>{pct(r.all?.hit)}</b></td>
              <OffBy s={r.all} />
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
            <th title="How far the board’s chance sat above the chance the book’s price implied">Board’s edge over the book</th>
            <th className="is-num" title="Priced plays in the row">Plays</th>
            <th className="is-num" title="The chance the book’s price implied, its cut included">Book’s price said</th>
            <th className="is-num" title="The chance the board gave">Board said</th>
            <th className="is-num" title="How often the line was actually cleared">Actually hit</th>
            <th className="is-num" title="One unit staked on every play at the book’s price: the return per unit">Return per unit</th>
            <th className="is-num" title="The same on the plays that made a table">Board picks</th>
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
      <p className="nhlx-auto-meta" style={{ margin: '6px 2px 0' }}>Where the board disagrees most with the book is where it is most sure of itself; if those rows hit less often than the board said, the board is too confident where it matters.</p>
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
            <th>Stat</th>
            <th className="is-num" title="Rungs graded: every rung of every player with a box-score line">Rungs</th>
            <th className="is-num" title="The half of the chance read off his range: where his projection and his spread put the rung">From his range said</th><th className="is-num">Hit</th><th className="is-num" title={ACCURACY}>Accuracy</th>
            <th className="is-num" title="The half of the chance read off how often he actually cleared the rung in his own games">From his past said</th><th className="is-num">Hit</th><th className="is-num" title={ACCURACY}>Accuracy</th>
            <th className="is-num" title="The two halves together: the chance the board shows">Board said</th><th className="is-num">Hit</th><th className="is-num" title={ACCURACY}>Accuracy</th>
            <th className="is-num" title="The book’s main line: how often it was cleared">Book’s line hit</th>
            <th className="is-num" title="The long shots: rungs the board put at 20–35%; what it said against how often they hit">Long shots said → hit</th>
          </tr>
        </thead>
        <tbody>
          {ladders.map((l) => {
            const b = best(l);
            const cell = (k) => <td className={`is-num${l[k]?.n && l[k].brier === b ? ' is-best' : ''}`}>{acc(l[k]?.brier)}</td>;
            return (
              <tr key={l.key}>
                <td><b>{l.label}</b></td>
                <td className="is-num">{l.n}</td>
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
      <p className="nhlx-auto-meta" style={{ margin: '6px 2px 0' }}>Every chance on the board is half “from his range” and half “from his past”. Bold = the most accurate of the three on that stat.</p>
    </div>
  );
}

/**
 * Which number predicts his figure best, per market: his own windows before the game, his head to
 * head, the board's blend, the projection with the matchup in it and the book's line, each against
 * the box scores (average miss, high or low) and as a chance of clearing the book's line.
 */
function PredictorsTable({ predictors }) {
  const [market, setMarket] = useState(predictors[0]?.key);
  const report = predictors.find((p) => p.key === market) || predictors[0];
  if (!report) return null;
  const list = report.common.predictors;
  const withN = list.filter((p) => p.n && !p.sparse);   // the bold compares the reads scored on the same games
  const bestMae = withN.length ? Math.min(...withN.map((p) => p.mae)) : null;
  const bestBrier = withN.filter((p) => p.brier != null).length ? Math.min(...withN.filter((p) => p.brier != null).map((p) => p.brier)) : null;
  const source = (s) => (s === 'own' ? 'his own games' : s === 'board' ? 'the board' : 'the book');
  const lean = (bias) => (bias == null ? '—' : Math.abs(bias) < 0.05 ? 'even' : `${Math.abs(bias).toFixed(1)} ${bias > 0 ? 'high' : 'low'}`);
  return (
    <>
      <div className="nhlx-tabs" role="tablist" aria-label="Stat" style={{ marginBottom: 10 }}>
        {predictors.map((p) => <button key={p.key} type="button" role="tab" aria-selected={p.key === report.key} className={`nhlx-tab${p.key === report.key ? ' is-active' : ''}`} onClick={() => setMarket(p.key)}>{p.label} <small>{p.n}</small></button>)}
      </div>
      <div className="nhlx-db-table-wrap">
        <table className="nhlx-db-table nhlx-mu-table nhlx-sc-table">
          <thead>
            <tr>
              <th>Read</th>
              <th className="is-num" title="Player-games it was scored on">Games</th>
              <th className="is-num" title="What it said he would get, on average">Predicted</th>
              <th className="is-num" title="What he actually got, on average">Actual</th>
              <th className="is-num" title="Whether it runs high or low: predicted minus actual, on average">Runs</th>
              <th className="is-num" title="How far it was from his figure on a typical night (lower is better)">Average miss</th>
              <th className="is-num" title="The chance of clearing the book’s main line it implies, on average">Over the line said</th>
              <th className="is-num" title="How often the line was actually cleared">Actually hit</th>
              <th className="is-num" title={ACCURACY}>Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.key} className={p.key === 'proj' ? 'is-model' : p.key === 'blend' ? 'is-blend' : ''}>
                <td title={p.note || undefined}>
                  <b>{p.label}</b> <small>{source(p.source)}</small>
                  {p.sparse && p.n ? <small className="nhlx-auto-meta" style={{ display: 'block' }}>on the {p.n} games with two meetings · the projection on those same games: miss {p.against?.proj?.mae ?? '—'}, accuracy {acc(p.against?.proj?.brier)} · the blend: miss {p.against?.blend?.mae ?? '—'}, accuracy {acc(p.against?.blend?.brier)}</small> : null}
                </td>
                <td className="is-num">{p.n}</td>
                <td className="is-num">{p.avg ?? '—'}</td>
                <td className="is-num">{p.actual ?? '—'}</td>
                <td className="is-num">{lean(p.bias)}</td>
                <td className={`is-num${p.n && !p.sparse && p.mae === bestMae ? ' is-best' : ''}`}>{p.mae ?? '—'}</td>
                <td className="is-num">{pct(p.said)}</td>
                <td className="is-num">{p.lined ? <><b>{pct(p.hit)}</b><small>{p.lined}</small></> : '—'}</td>
                <td className={`is-num${p.brier != null && !p.sparse && p.brier === bestBrier ? ' is-best' : ''}`}>{acc(p.brier)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="nhlx-auto-meta" style={{ margin: '6px 2px 0' }}>{report.common.n} of {report.n} player-games carry every read (a window needs its games; a line needs a book). Bold = the best column among the reads scored on the same games; head to head is scored on the games with two prior meetings, with the projection and the blend beside it on those same games. If a plain window of his own games beats the projection here over a month, the board should read from it.</p>
    </>
  );
}

export default function Scorecard({ sport }) {
  const { api, kind, season = null, to = null, label = '' } = sport;
  const [open, setOpen] = useState(true);
  const [range, setRange] = useState({ from: '', to: '' });
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(true);   // the first read runs on open
  const [err, setErr] = useState('');
  const [asked, setAsked] = useState(null);   // the range the report answers
  const inflight = useRef(false);             // a read on its way: the effect starts no second one

  // The fetch sets state only in its callbacks, so the first read can run from the effect.
  const load = useCallback((r) => {
    const q = new URLSearchParams();
    if (kind === 'week' && season) q.set('season', String(season));
    if (r.from) q.set('from', String(r.from));
    if (r.to) q.set('to', String(r.to));
    inflight.current = true;
    return fetch(`${api}/scorecard?${q}`, { cache: 'no-store' })
      .then(async (res) => { const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`); return j; })
      .then((j) => { setReport(j); setAsked({ from: j.from, to: j.to }); setRange((cur) => ({ from: cur.from || j.from || '', to: cur.to || j.to || '' })); setErr(''); })
      .catch((e) => setErr(`Scorecard: ${e.message}`))
      .finally(() => { inflight.current = false; setBusy(false); });
  }, [api, kind, season]);
  const grade = (r) => { setBusy(true); setErr(''); load(r); };

  // The season to date on first open (the route's default range); the controls narrow it after.
  useEffect(() => { if (open && !report && !inflight.current) load({ from: '', to: to || '' }); }, [open, report, load, to]);

  const words = report?.plays ? plainSummary(report, { kind }) : null;
  const unit = kind === 'week' ? 'week' : 'night';

  return (
    <section className="ir-sc nhlx-sc" aria-label={`${label} scorecard`}>
      <div className="ir-sc-head">
        <div>
          <h2 className="nhlx-sc-h" style={{ margin: 0 }}>Scorecard <small>what the board said against what happened</small></h2>
          <p className="nhlx-auto-meta">Every stored {unit} is replayed with only what was known before the games, then graded against the box scores. “Board said” is the chance it gave, “actually hit” how often the line was cleared, “off by” the gap in points. Nothing here changes the board.</p>
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
          <button type="button" className="nhlx-btn nhlx-btn-sm" disabled={busy} onClick={() => grade(range)}>{busy ? 'Grading…' : 'Grade'}</button>
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Show'}</button>
        </div>
      </div>
      {err ? <div className="nhlx-alert" style={{ marginTop: 12 }}>{err}</div> : null}
      {open ? (
        !report ? <div className="nhlx-empty">{busy ? 'Grading the stored slates…' : 'No scorecard yet.'}</div> : !report.plays ? (
          <div className="nhlx-empty">No graded plays {asked?.from ? `between ${fmtDate(asked.from)} and ${fmtDate(asked.to)}` : 'yet'}: a {unit} grades once its games are final and their box scores stored.</div>
        ) : (
          <>
            <ul className="ir-sc-verdict" aria-label="In plain words">
              <li><b>What was graded.</b> {words.coverage}</li>
              <li><b>Did the chances come true?</b> {words.chances}</li>
              <li><b>The board’s picks.</b> {words.picks}</li>
              {words.book ? <li><b>Against the book.</b> {words.book}</li> : null}
              {words.projections.map((p) => <li key={p.key}><b>{p.label}.</b> {p.text.slice(p.label.length + 2)}</li>)}
              {words.caution ? <li className="nhlx-auto-meta">{words.caution}</li> : null}
              {asked?.from ? <li className="nhlx-auto-meta">{fmtDate(asked.from)} to {fmtDate(asked.to)} · built {new Date(report.builtAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</li> : null}
            </ul>
            <h3 className="nhlx-sc-h">The chances <small>did they come true, and where</small></h3>
            <div className="ir-sc-grid">
              <SplitTable first="When the board said" rows={report.buckets.map((b) => ({ key: b.key, label: b.label, all: b.all, board: b.board }))} title="A well-read board hits about as often as it says in every row: a 60–70% row should hit around 65%." />
              <SplitTable first="By stat" rows={report.markets} />
              <SplitTable first="By matchup" rows={report.thirds} title="How generous the opponent is to the player’s position for the stat: the soft third gives up the most. Colour on the board, not a number." />
              <SplitTable first="By source" rows={report.sources} />
              <SplitTable first="By form" rows={report.forms} title="Hot and cold are colour only on the board; this says whether they would have earned a number." />
              <EdgeTable edges={report.edges} />
            </div>
            {report.predictors?.length ? (
              <>
                <h3 className="nhlx-sc-h">Which number predicts best <small>his own games over a window, his head to head, the board’s blend, the projection with the matchup in it, and the book’s line, each against the box scores</small></h3>
                <PredictorsTable predictors={report.predictors} />
              </>
            ) : null}
            {report.ladders?.length ? (
              <>
                <h3 className="nhlx-sc-h">The two halves of a chance <small>every rung of every player with a box score: read off his range, off his past, and the two together as the board shows it</small></h3>
                <LaddersTable ladders={report.ladders} />
              </>
            ) : null}
            <h3 className="nhlx-sc-h">By {unit}</h3>
            <div className="nhlx-db-table-wrap">
              <table className="nhlx-db-table nhlx-mu-table nhlx-sc-table">
                <thead><tr><th>{kind === 'week' ? 'Week' : 'Night'}</th><th className="is-num" title="Games graded / games finished">Games</th><th className="is-num">Plays</th><th className="is-num">Board said</th><th className="is-num">Actually hit</th><th className="is-num">Off by</th><th className="is-num">Board picks hit</th></tr></thead>
                <tbody>
                  {report.bySlate.map((s) => (
                    <tr key={s.key} className={s.plays ? '' : 'is-muted'}>
                      <td><b>{kind === 'date' ? fmtDate(s.key) : s.label}</b> <small>{kind === 'date' ? s.key : ''}</small></td>
                      <td className="is-num">{s.graded}/{s.finals}</td>
                      <td className="is-num">{s.plays}</td>
                      <td className="is-num">{pct(s.all?.said)}</td>
                      <td className="is-num"><b>{pct(s.all?.hit)}</b></td>
                      <OffBy s={s.all} />
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
