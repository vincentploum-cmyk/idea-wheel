'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

// The scorecard on the History tab: the saved runs graded against the stored box
// scores (/api/nhl/data/scorecard). Tables only; colour marks where the calls landed
// above or below what the model said.

const pct = (v, d = 0) => (v == null ? '—' : `${(v * 100).toFixed(d)}%`);
const num = (v, d = 2) => (v == null ? '—' : Number(v).toFixed(d));
const signed = (v, d = 2) => (v == null ? '—' : `${v > 0 ? '+' : ''}${Number(v).toFixed(d)}`);
const fmtDate = (d) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }) : '');

/** Hit rate against what the model said, in points; tinted once there is a sample. */
function Diff({ s }) {
  if (!s || !s.n || s.avg == null || s.hit == null) return <td className="is-num">—</td>;
  const d = (s.hit - s.avg) * 100;
  const cls = s.n >= 20 && Math.abs(d) >= 5 ? (d > 0 ? ' is-over' : ' is-under') : '';
  return <td className={`is-num${cls}`} title={`Hit rate minus the model's average probability (${s.n} calls)`}>{d > 0 ? '+' : ''}{d.toFixed(0)} pts</td>;
}

const HitCell = ({ s }) => <td className="is-num">{s?.n ? <><b>{pct(s.hit)}</b><small>{s.n}</small></> : '—'}</td>;

function MarketsTable({ markets }) {
  return (
    <div className="nhlx-db-table-wrap">
      <table className="nhlx-db-table nhlx-mu-table nhlx-sc-table">
        <thead>
          <tr>
            <th>Market</th>
            <th className="is-num" title="Player-games with a probability for this market">Calls</th>
            <th className="is-num" title="The model's average probability over those calls">Model said</th>
            <th className="is-num" title="How often the stat line was reached">Hit</th>
            <th className="is-num" title="Hit minus said: positive means the calls came in more often than promised">Diff</th>
            <th className="is-num" title="Brier score: mean squared error of the probabilities (0 is perfect, 0.25 is a coin flip)">Brier</th>
            <th className="is-num" title="Calls with the model's gate open">Gate open</th>
            <th className="is-num" title="Calls with the gate closed">Gate closed</th>
            <th className="is-num" title="Players whose best bet was this market">Best-bet calls</th>
          </tr>
        </thead>
        <tbody>
          {markets.map((m) => (
            <tr key={m.key}>
              <td><b>{m.label}</b></td>
              <td className="is-num">{m.n}</td>
              <td className="is-num">{pct(m.avg)}</td>
              <td className="is-num"><b>{pct(m.hit)}</b></td>
              <Diff s={m} />
              <td className="is-num">{m.brier == null ? '—' : m.brier.toFixed(3)}</td>
              <HitCell s={m.gate.open} />
              <HitCell s={m.gate.closed} />
              <HitCell s={m.best} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BoardsTable({ picks }) {
  return (
    <div className="nhlx-db-table-wrap">
      <table className="nhlx-db-table nhlx-mu-table nhlx-sc-table">
        <thead>
          <tr><th>Board</th><th className="is-num">Plays</th><th className="is-num">3+ SOG</th><th className="is-num">4+ SOG</th><th className="is-num">1+ goal</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><b>Top 5 shots plays</b> <small>per slate</small></td>
            <td className="is-num">{picks.shots.n}</td>
            <HitCell s={picks.shots.s3} />
            <HitCell s={picks.shots.s4} />
            <td className="is-num">—</td>
          </tr>
          <tr>
            <td><b>Top 5 goal plays</b> <small>per slate</small></td>
            <td className="is-num">{picks.goals.n}</td>
            <td className="is-num">—</td>
            <td className="is-num">—</td>
            <HitCell s={picks.goals.g1} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ScoreRows({ rows, label }) {
  return (
    <div className="nhlx-db-table-wrap">
      <table className="nhlx-db-table nhlx-mu-table nhlx-sc-table">
        <thead><tr><th>{label}</th><th className="is-num">Calls</th><th className="is-num">Said</th><th className="is-num">Hit</th><th className="is-num">Diff</th></tr></thead>
        <tbody>
          {rows.map(([k, s]) => (
            <tr key={k} className={s.n ? '' : 'is-muted'}>
              <td>{k}</td>
              <td className="is-num">{s.n}</td>
              <td className="is-num">{pct(s.avg)}</td>
              <td className="is-num"><b>{pct(s.hit)}</b></td>
              <Diff s={s} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const POS_ORDER = ['C', 'LW', 'RW', 'D'];
const slotOrder = (a, b) => {
  const pa = POS_ORDER.indexOf(a.replace(/\d+$/, ''));
  const pb = POS_ORDER.indexOf(b.replace(/\d+$/, ''));
  return pa - pb || a.localeCompare(b, undefined, { numeric: true });
};

function Calibration({ market }) {
  const byPos = POS_ORDER.filter((p) => market.byPos[p]).map((p) => [p, market.byPos[p]]);
  const bySlot = Object.keys(market.bySlot).sort(slotOrder).map((k) => [k, market.bySlot[k]]);
  return (
    <div className="nhlx-sc-grid">
      <ScoreRows label="Model said" rows={market.buckets.map((b) => [b.label, b])} />
      <ScoreRows label="Position" rows={byPos} />
      <ScoreRows label="Line slot" rows={bySlot} />
    </div>
  );
}

function PredictorsTable({ report }) {
  const list = report.common.predictors;
  const withN = list.filter((p) => p.n);
  const bestMae = withN.length ? Math.min(...withN.map((p) => p.mae)) : null;
  const bestBrier = withN.length ? Math.min(...withN.map((p) => p.brier)) : null;
  const unit = report.stat === 'sog' ? 'shots' : 'goals';
  return (
    <div className="nhlx-db-table-wrap">
      <table className="nhlx-db-table nhlx-mu-table nhlx-sc-table">
        <thead>
          <tr>
            <th>Predictor</th>
            <th className="is-num" title={`Average projected ${unit} per game`}>Projected</th>
            <th className="is-num" title={`Average actual ${unit} per game on the same rows`}>Actual</th>
            <th className="is-num" title="Projected minus actual, per game">Bias</th>
            <th className="is-num" title={`Mean absolute error in ${unit} per game (lower is better)`}>MAE</th>
            <th className="is-num" title={`${report.market} odds the predictor implies (Poisson)`}>{report.market} said</th>
            <th className="is-num" title={`How often ${report.market} came in on these rows`}>Hit</th>
            <th className="is-num" title="Brier score of those odds (lower is better)">Brier</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.key} className={p.key === 'model' ? 'is-model' : ''}>
              <td><b>{p.label}</b> <small>{p.source === 'own' ? 'stored games' : p.source === 'propfinder' ? 'PropFinder' : 'saved run'}</small></td>
              <td className="is-num">{num(p.avg)}</td>
              <td className="is-num">{num(p.actual)}</td>
              <td className="is-num">{signed(p.bias)}</td>
              <td className={`is-num${p.n && p.mae === bestMae ? ' is-best' : ''}`}>{num(p.mae)}</td>
              <td className="is-num">{pct(p.prob)}</td>
              <td className="is-num">{pct(p.hit)}</td>
              <td className={`is-num${p.n && p.brier === bestBrier ? ' is-best' : ''}`}>{p.brier == null ? '—' : p.brier.toFixed(3)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SlatesTable({ slates }) {
  return (
    <div className="nhlx-db-table-wrap">
      <table className="nhlx-db-table nhlx-mu-table nhlx-sc-table">
        <thead>
          <tr>
            <th>Slate</th>
            <th className="is-num" title="Games graded / games stored for the date">Games</th>
            <th className="is-num" title="Projected skaters found in a box score">Players</th>
            <th className="is-num" title="Projected skaters not in the box score (scratched, or a name the box score spells differently)">Not dressed</th>
            <th className="is-num">3+ SOG</th>
            <th className="is-num">4+ SOG</th>
            <th className="is-num">1+ goal</th>
            <th className="is-num">1+ point</th>
            <th className="is-num" title="Mean absolute error of λ shots">SOG MAE</th>
            <th className="is-num" title="λ shots minus actual shots, per player-game">SOG bias</th>
          </tr>
        </thead>
        <tbody>
          {slates.map((s) => (
            <tr key={s.date} className={s.players ? '' : 'is-muted'}>
              <td><b>{fmtDate(s.date)}</b> <small>{s.date}</small></td>
              <td className="is-num">{s.graded}/{s.games}</td>
              <td className="is-num">{s.players}</td>
              <td className="is-num">{s.missing}</td>
              <HitCell s={s.s3} />
              <HitCell s={s.s4} />
              <HitCell s={s.g1} />
              <HitCell s={s.p1} />
              <td className="is-num">{num(s.sogMae)}</td>
              <td className="is-num">{signed(s.sogBias)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CAL_MARKETS = ['s3', 's4', 'g1', 'p1'];

function toCsv(rows) {
  if (!rows?.length) return '';
  const cols = Object.keys(rows[0]);
  const cell = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
}

export default function Scorecard() {
  const [card, setCard] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(true); // the first grade runs on mount
  const [range, setRange] = useState({ from: '', to: '' });
  const [cal, setCal] = useState('s3');
  const [stat, setStat] = useState('sog');

  const query = useCallback((r) => {
    const q = new URLSearchParams();
    if (r.from) q.set('from', r.from);
    if (r.to) q.set('to', r.to);
    return q.toString() ? `?${q}` : '';
  }, []);

  // Fetch only: callers flip `busy` themselves (the first load starts busy).
  const load = useCallback((r) => {
    return fetch(`/api/nhl/data/scorecard${query(r)}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.detail || body?.error || `Request failed (${res.status})`);
        setCard(body);
      })
      .catch((e) => setErr(e.message))
      .finally(() => setBusy(false));
  }, [query]);

  useEffect(() => { load({ from: '', to: '' }); }, [load]);
  const grade = () => { setBusy(true); setErr(''); load(range); };

  const exportCsv = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/nhl/data/scorecard${query(range)}${query(range) ? '&' : '?'}rows=1`, { cache: 'no-store' });
      const body = await res.json();
      const blob = new Blob([toCsv(body.rows)], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `nhl_scorecard_${body.from}_${body.to}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [query, range]);

  const market = useMemo(() => card?.markets?.find((m) => m.key === cal) || null, [card, cal]);

  return (
    <div className="nhlx-sc">
      <div className="nhlx-today-head">
        <div>
          <div className="nhlx-today-date">Scorecard</div>
          <div className="nhlx-auto-sub">
            {card ? `${card.slates} slate${card.slates === 1 ? '' : 's'} · ${card.games} game${card.games === 1 ? '' : 's'} · ${card.players} player-games graded · ${card.missing} projected skaters not in a box score · ${fmtDate(card.from)} – ${fmtDate(card.to)}` : busy ? 'Grading saved runs…' : ''}
          </div>
        </div>
        <div className="nhlx-auto-actions">
          <input type="date" className="nhlx-input nhlx-input-sm" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} aria-label="From" />
          <input type="date" className="nhlx-input nhlx-input-sm" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} aria-label="To" />
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={busy} onClick={grade}>Grade</button>
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={busy || !card?.players} onClick={exportCsv}>Export CSV</button>
        </div>
      </div>
      <p className="nhlx-auto-meta nhlx-fg-how">
        Each stored game is graded against the newest run saved before its puck drop; a run saved after the game never counts. A call is one player-game with a probability for the market. “Said” is the model’s average probability, “Hit” how often the line was reached: the two should match. Brier is the squared error of the probabilities (0 perfect, 0.25 a coin flip). Below, the same player-games score the plain windows — a skater’s own last 5 / 10 / 15 stored games and season to date, and PropFinder’s L5 and season rates as the run saw them — beside the model’s λ, so the sources and windows can be compared on identical rows.
      </p>
      {err ? <div className="nhlx-alert">{err}</div> : null}
      {card && !card.players ? (
        <div className="nhlx-empty">Nothing graded yet. The first rows appear once a slate has a run saved before puck drop and its box scores stored by the morning run.</div>
      ) : null}
      {card?.players ? (
        <>
          <h3 className="nhlx-sc-h">Markets</h3>
          <MarketsTable markets={card.markets} />

          <h3 className="nhlx-sc-h">The Model tab’s boards <small>the five shots plays and five goal plays each slate</small></h3>
          <BoardsTable picks={card.picks} />

          <h3 className="nhlx-sc-h">Calibration <small>where the calls landed, by what the model said, position and line slot</small></h3>
          <div className="nhlx-tabs" role="tablist" aria-label="Market">
            {CAL_MARKETS.map((k) => {
              const m = card.markets.find((x) => x.key === k);
              return <button key={k} type="button" role="tab" aria-selected={cal === k} className={`nhlx-tab${cal === k ? ' is-active' : ''}`} onClick={() => setCal(k)}>{m?.label || k}</button>;
            })}
          </div>
          {market ? <Calibration market={market} /> : null}

          <h3 className="nhlx-sc-h">Windows and sources <small>on the {card.predictors[stat].common.n} player-games every predictor covers</small></h3>
          <div className="nhlx-tabs" role="tablist" aria-label="Stat">
            {[['sog', 'Shots'], ['g', 'Goals']].map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={stat === k} className={`nhlx-tab${stat === k ? ' is-active' : ''}`} onClick={() => setStat(k)}>{l}</button>)}
          </div>
          <PredictorsTable report={card.predictors[stat]} />
          <p className="nhlx-auto-meta">
            Own L5 / L10 / L15 need the full window of stored games (across seasons: in October the last five are last season’s); own season needs three games this season; PropFinder’s season rate is carried on runs saved from now on. Coverage on all rows: {card.predictors[stat].each.map((p) => `${p.label} ${p.n}`).join(' · ')}.
          </p>

          <h3 className="nhlx-sc-h">By slate</h3>
          <SlatesTable slates={card.bySlate} />
        </>
      ) : null}
    </div>
  );
}
