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
    setMsg('Collecting today’s inputs…');
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
      setMsg(ready
        ? `${n} inputs loaded for ${s.date}${existing ? ' (already saved, reopened from history)' : ''}.`
        : `${n} inputs pre-filled for ${s.date}. Waiting for the PropFinder season + L5 files.`);
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

  return (
    <div className="nhlx-auto">
      <div className="nhlx-auto-head">
        <div>
          <div className="nhlx-auto-title">Automatic inputs</div>
          <div className="nhlx-auto-sub">
            NHL data refreshes every morning and before puck drop.
            {status?.lastRefresh ? ` Last refresh ${fmt(status.lastRefresh)}.` : ''}
          </div>
        </div>
        <div className="nhlx-auto-actions">
          <input
            type="date"
            className="nhlx-input nhlx-input-sm"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Slate date"
          />
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={disabled || !date} onClick={() => loadSlate(date)}>
            Load slate
          </button>
          <button type="button" className="nhlx-btn nhlx-btn-sm" disabled={disabled || !date} onClick={refreshNow}>
            Refresh NHL data
          </button>
        </div>
      </div>

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
      {msg && <p className="nhlx-auto-msg" role="status">{msg}</p>}

      <details className="nhlx-auto-tools">
        <summary>Folder sync and data tools</summary>
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
            <p className="nhlx-auto-meta">Loads finished games into the database so history and home/away stats have depth.</p>
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
