'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Slots the automation can fill, in upload-grid order.
export const AUTO_SLOTS = [
  { key: 'season', label: 'Season matchups', source: 'PropFinder · folder sync' },
  { key: 'l5', label: 'L5 matchups', source: 'PropFinder · folder sync' },
  { key: 'lineups', label: 'Lineups', source: 'NHL.com game previews' },
  { key: 'hist', label: 'Historical profiles', source: 'NHL API box scores' },
  { key: 'playerStats', label: 'Home / away stats', source: 'NHL API play-by-play' },
  { key: 'rankings', label: 'Defense rankings', source: 'PropFinder defense blocks' },
  { key: 'boxScores', label: 'Box scores', source: 'NHL API (after games end)' },
];

function fmt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function slotDetail(key, v) {
  if (!v) return null;
  if (key === 'season' || key === 'l5') return `${v.name} · ${fmt(v.receivedAt)}`;
  if (key === 'lineups') {
    return v.complete
      ? `${v.games}/${v.of} games · ${fmt(v.fetchedAt)}`
      : `${v.games}/${v.of} games so far · held back until every game has one (the model skips players missing from the lineups)`;
  }
  if (key === 'boxScores') return `${v.games} games · ${fmt(v.fetchedAt)}`;
  if (key === 'rankings') return `${v.teams} teams · ${fmt(v.updatedAt)}`;
  return `through ${v.asOf}`;
}

async function fetchSlotFile(slot, date) {
  const res = await fetch(`/api/nhl/data/file?slot=${slot}&date=${date}`, { cache: 'no-store' });
  if (!res.ok) return null;
  const blob = await res.blob();
  const name = decodeURIComponent(res.headers.get('X-File-Name') || `${slot}-${date}.xlsx`);
  return new File([blob], name, { type: blob.type });
}

export default function AutomationPanel({ runs, onLoad, busy: parentBusy }) {
  const [date, setDate] = useState('');
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [backfill, setBackfill] = useState({ from: '', to: '', running: false, done: 0, total: 0, log: '' });
  const autoStarted = useRef(false);
  const cancelBackfill = useRef(false);

  const loadStatus = useCallback(async (d) => {
    const res = await fetch(`/api/nhl/data/status${d ? `?date=${d}` : ''}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const s = await res.json();
    setStatus(s);
    if (!d) setDate(s.date);
    return s;
  }, []);

  const loadSlate = useCallback(async (d, { runIfReady = true } = {}) => {
    setBusy(true);
    setMsg('Loading inputs…');
    try {
      const s = await loadStatus(d);
      const usable = (k) => !!s.slots[k] && (k !== 'lineups' || s.slots[k].complete);
      const available = AUTO_SLOTS.filter((x) => usable(x.key)).map((x) => x.key);
      const entries = await Promise.all(available.map(async (k) => [k, await fetchSlotFile(k, s.date)]));
      const files = Object.fromEntries(entries.filter(([, f]) => f));
      const ready = !!(files.season && files.l5);
      const autoKey = [s.date, s.slots.season?.receivedAt, s.slots.l5?.receivedAt, s.slots.lineups?.fetchedAt, s.slots.boxScores?.fetchedAt].join('|');
      const existing = (runs || []).find((r) => r.autoKey === autoKey);
      onLoad({
        files,
        run: ready && runIfReady,
        runId: existing?.id || null,
        meta: { autoKey, source: 'auto' },
        autoSlots: files,
      });
      const n = Object.keys(files).length;
      setMsg(ready && existing ? 'Reopened your saved run for this slate.' : '');
    } catch (err) {
      setMsg(`Couldn’t load automatic inputs: ${err.message}`);
    } finally {
      setBusy(false);
    }
  }, [loadStatus, onLoad, runs]);

  // First visit: pull whatever the automation has for today.
  useEffect(() => {
    if (autoStarted.current || runs === null) return;
    autoStarted.current = true;
    loadSlate('', { runIfReady: true });
  }, [runs, loadSlate]);

  const refreshNow = async () => {
    setBusy(true);
    setMsg('Pulling fresh NHL data…');
    try {
      const res = await fetch(`/api/nhl/data/refresh?date=${date}`, { method: 'POST' });
      const j = await res.json();
      if (!res.ok || !j.ok) throw new Error(j.error || `refresh ${res.status}`);
      await loadSlate(date, { runIfReady: false });
    } catch (err) {
      setMsg(`Refresh failed: ${err.message}`);
      setBusy(false);
    }
  };

  const newToken = async () => {
    if (status?.syncToken && !window.confirm('Create a new sync token? The old one stops working.')) return;
    const res = await fetch('/api/nhl/data/token', { method: 'POST' });
    const j = await res.json();
    if (j.token) setToken(j.token);
    loadStatus(date);
  };

  const runBackfill = async () => {
    const { from, to } = backfill;
    if (!from || !to || from > to) return;
    const dates = [];
    for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      dates.push(d.toISOString().slice(0, 10));
    }
    cancelBackfill.current = false;
    setBackfill((b) => ({ ...b, running: true, done: 0, total: dates.length, log: '' }));
    let games = 0;
    for (let i = 0; i < dates.length; i++) {
      if (cancelBackfill.current) break;
      try {
        const res = await fetch(`/api/nhl/data/backfill?date=${dates[i]}`, { method: 'POST' });
        const j = await res.json();
        games += j.result?.ingested || 0;
        setBackfill((b) => ({ ...b, done: i + 1, log: `${dates[i]}: ${j.ok ? `${j.result.ingested} new games` : j.error}` }));
      } catch (err) {
        setBackfill((b) => ({ ...b, done: i + 1, log: `${dates[i]}: ${err.message}` }));
      }
    }
    setBackfill((b) => ({ ...b, running: false, log: `Done. ${games} games added.` }));
    loadStatus(date);
  };

  const slots = status?.slots || {};
  const disabled = busy || parentBusy;

  const shiftDate = (n) => {
    const d = new Date(`${date || status?.date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    const next = d.toISOString().slice(0, 10);
    setDate(next);
    loadSlate(next);
  };

  const uploadMatchups = async (fileList) => {
    const files = [...fileList].filter((f) => /\.xlsx$/i.test(f.name));
    if (!files.length) return;
    setBusy(true);
    setMsg(`Uploading ${files.length} file${files.length === 1 ? '' : 's'}…`);
    try {
      const form = new FormData();
      form.append('date', date);
      files.forEach((f) => form.append('file', f, f.name));
      const res = await fetch('/api/nhl/data/matchups', { method: 'POST', body: form });
      const j = await res.json();
      const bad = (j.results || []).filter((r) => r.error);
      const good = (j.results || []).filter((r) => !r.error);
      if (!good.length) throw new Error(bad[0]?.error || 'upload failed');
      const d = good[0].date;
      setDate(d);
      setBusy(false);
      await loadSlate(d);
      if (bad.length) setMsg((m) => `${m} Skipped: ${bad.map((b) => b.file).join(', ')}.`);
    } catch (err) {
      setMsg(`Upload failed: ${err.message}`);
      setBusy(false);
    }
  };

  const prettyDate = (date || status?.date)
    ? new Date(`${date || status.date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
    : '';

  const auto = ['lineups', 'hist', 'playerStats', 'rankings'];
  const autoReady = auto.filter((k) => slots[k] && (k !== 'lineups' || slots[k].complete)).length;
  const lineupState = !slots.lineups ? 'No projected lineups yet (NHL.com posts them on game-day morning).'
    : slots.lineups.complete ? `${slots.lineups.games}/${slots.lineups.of} games have a projected lineup.`
      : `${slots.lineups.games}/${slots.lineups.of} games have a lineup so far; the model waits for all of them.`;
  const filesReady = !!(slots.season && slots.l5);
  const fileRow = (key, label, hint) => (
    <div key={key} className={`nhlx-gd-file${slots[key] ? ' is-ready' : ''}`}>
      <span className="nhlx-auto-dot" aria-hidden />
      <div>
        <div className="nhlx-auto-label">{label}</div>
        <div className="nhlx-auto-meta">{slots[key] ? `${slots[key].name} · received ${fmt(slots[key].receivedAt)}` : hint}</div>
      </div>
    </div>
  );

  return (
    <div className="nhlx-today">
      <div className="nhlx-today-head">
        <div>
          <div className="nhlx-today-date">{prettyDate}</div>
          <div className="nhlx-auto-sub">
            {!status ? 'Checking today’s data…'
              : filesReady ? `Both PropFinder files are in${autoReady === auto.length ? ' and the NHL data is ready' : ''}.`
                : 'One thing to do on game day: drop the two PropFinder files below. Everything else loads itself.'}
            {status?.lastRefresh ? ` NHL data refreshed ${fmt(status.lastRefresh)}.` : ''}
          </div>
        </div>
        <div className="nhlx-auto-actions">
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={disabled || !date} onClick={() => shiftDate(-1)} aria-label="Previous day">‹</button>
          <input
            type="date"
            className="nhlx-input nhlx-input-sm"
            value={date}
            onChange={(e) => { setDate(e.target.value); if (e.target.value) loadSlate(e.target.value); }}
            aria-label="Slate date"
          />
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={disabled || !date} onClick={() => shiftDate(1)} aria-label="Next day">›</button>
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={disabled || !date} onClick={refreshNow}>
            Refresh NHL data
          </button>
        </div>
      </div>

      <ol className="nhlx-gd">
        <li className={`nhlx-gd-step${autoReady === auto.length ? ' is-done' : autoReady ? ' is-partial' : ''}`}>
          <span className="nhlx-gd-num">1</span>
          <div>
            <div className="nhlx-gd-title">NHL data <em>automatic</em></div>
            <p className="nhlx-auto-meta">
              Lineups, history, home/away splits and box scores come from the NHL by themselves (9:00, 13:00 and 17:30 ET).
              {' '}{status ? lineupState : ''}
              {status && !slots.hist ? ' No stored games yet: run a backfill under “Data sources” once.' : ''}
            </p>
          </div>
        </li>
        <li className={`nhlx-gd-step${filesReady ? ' is-done' : slots.season || slots.l5 ? ' is-partial' : ''}`}>
          <span className="nhlx-gd-num">2</span>
          <div>
            <div className="nhlx-gd-title">Your two PropFinder files <em>you upload</em></div>
            <p className="nhlx-auto-meta">
              In PropFinder export today’s NHL goal matchups twice: <b>Season</b> and <b>Last 5</b>. Keep the file names PropFinder gives them
              (<code>NHL-Goal-Matchups-{date || 'YYYY-MM-DD'}.xlsx</code>); the date in the name picks the slate, the contents tell Season from L5.
              Drop both here, or save them in <code>Desktop/NHL</code> on your Mac and the sync uploads them.
            </p>
            <div className="nhlx-gd-files">
              {fileRow('season', 'Season matchups', 'Missing · the “Season” export')}
              {fileRow('l5', 'L5 matchups', 'Missing · the “Last 5 games” export')}
            </div>
            {!filesReady && (
              <label
                className={`nhlx-drop${dragOver ? ' is-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); uploadMatchups(e.dataTransfer.files); }}
              >
                <span className="nhlx-drop-icon" aria-hidden>↓</span>
                <span className="nhlx-drop-title">{slots.season || slots.l5 ? 'Drop the other file here' : 'Drop both .xlsx files here'}</span>
                <span className="nhlx-drop-sub">or click to choose them · any order, together or one at a time</span>
                <input type="file" multiple accept=".xlsx" style={{ display: 'none' }} disabled={disabled} onChange={(e) => { uploadMatchups(e.target.files); e.target.value = ''; }} />
              </label>
            )}
            {filesReady && (
              <label className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" style={{ cursor: 'pointer', marginTop: 10 }}>
                Replace a file
                <input type="file" multiple accept=".xlsx" style={{ display: 'none' }} disabled={disabled} onChange={(e) => { uploadMatchups(e.target.files); e.target.value = ''; }} />
              </label>
            )}
          </div>
        </li>
        <li className={`nhlx-gd-step${filesReady ? ' is-done' : ''}`}>
          <span className="nhlx-gd-num">3</span>
          <div>
            <div className="nhlx-gd-title">Run <em>automatic</em></div>
            <p className="nhlx-auto-meta">
              The model runs the moment both files are in and saves the run to history. Results appear below; after the games, box scores attach themselves for grading.
            </p>
          </div>
        </li>
      </ol>

      {msg && <p className="nhlx-auto-msg" role="status">{msg}</p>}

      <details className="nhlx-auto-tools">
        <summary>Data sources, folder sync and backfill</summary>
        <div className="nhlx-auto-grid">
          {AUTO_SLOTS.map((s) => (
            <div key={s.key} className={`nhlx-auto-item${slots[s.key] && (s.key !== 'lineups' || slots[s.key].complete) ? ' is-ready' : slots[s.key] ? ' is-partial' : ''}`}>
              <span className="nhlx-auto-dot" aria-hidden />
              <div>
                <div className="nhlx-auto-label">{s.label}</div>
                <div className="nhlx-auto-meta">{slots[s.key] ? slotDetail(s.key, slots[s.key]) : `Waiting · ${s.source}`}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="nhlx-auto-tools-grid">
          <div>
            <div className="nhlx-auto-label">PropFinder folder sync</div>
            <p className="nhlx-auto-meta">
              Your Mac uploads any <code>NHL-Goal-Matchups-*.xlsx</code> saved in Desktop/NHL.
              {status?.syncToken ? ` Token created ${fmt(status.syncToken.createdAt)}.` : ' No token yet.'}
            </p>
            <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={newToken}>
              {status?.syncToken ? 'Replace sync token' : 'Create sync token'}
            </button>
            {token && (
              <div className="nhlx-token">
                <p className="nhlx-auto-meta">Copy it now, it won’t be shown again:</p>
                <code>{token}</code>
              </div>
            )}
          </div>
          <div>
            <div className="nhlx-auto-label">Backfill past games</div>
            <p className="nhlx-auto-meta">Loads finished games and lineups into the database so history and home/away stats have depth.</p>
            <div className="nhlx-auto-actions">
              <input type="date" className="nhlx-input nhlx-input-sm" value={backfill.from} onChange={(e) => setBackfill((b) => ({ ...b, from: e.target.value }))} aria-label="From" />
              <input type="date" className="nhlx-input nhlx-input-sm" value={backfill.to} onChange={(e) => setBackfill((b) => ({ ...b, to: e.target.value }))} aria-label="To" />
              {backfill.running ? (
                <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={() => { cancelBackfill.current = true; }}>Stop</button>
              ) : (
                <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={runBackfill} disabled={!backfill.from || !backfill.to}>Backfill</button>
              )}
            </div>
            {backfill.total > 0 && (
              <p className="nhlx-auto-meta">{backfill.done}/{backfill.total} days · {backfill.log}</p>
            )}
          </div>
        </div>
      </details>
    </div>
  );
}
