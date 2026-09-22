'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import SiteHeader from './SiteHeader';
import SignOutButton from './SignOutButton';
import { teamLogo, slotLabel } from './run-summary';

// The model is ~10k lines plus SheetJS; load it on the client only.
const NhlModel = dynamic(() => import('./NhlModel'), {
  ssr: false,
  loading: () => <div className="nhlx-empty">Loading model…</div>,
});

const MAX_RESULTS_BYTES = 12 * 1024 * 1024;

async function api(path, init) {
  const res = await fetch(path, { cache: 'no-store', ...init });
  let body = null;
  try { body = await res.json(); } catch {}
  if (!res.ok) throw new Error(body?.detail || body?.error || `Request failed (${res.status})`);
  return body;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function RunCard({ run, active, busy, onLoad, onDelete }) {
  const games = run.games || [];
  return (
    <article className={`nhlx-run${active ? ' is-active' : ''}`}>
      <div className="nhlx-run-meta">
        <span>Slate <b>{run.slateDate || '—'}</b></span>
        <span>Saved <b>{fmtDate(run.createdAt)}</b></span>
        {run.files?.boxScores && <span style={{ color: 'var(--danger)' }}>Box scores attached</span>}
      </div>
      <div className="nhlx-run-title">
        {games.length} game{games.length === 1 ? '' : 's'} · {run.playerCount ?? '—'} players
      </div>
      {games.length > 0 && (
        <div className="nhlx-run-logos">
          {games.map((g, i) => (
            <span className="nhlx-run-game" key={`${g.label}-${i}`} title={g.label}>
              {teamLogo(g.away) ? <img src={teamLogo(g.away)} alt={g.away} width="22" height="22" /> : <span>{g.away}</span>}
              <i>@</i>
              {teamLogo(g.home) ? <img src={teamLogo(g.home)} alt={g.home} width="22" height="22" /> : <span>{g.home}</span>}
            </span>
          ))}
        </div>
      )}
      {run.topPicks?.length > 0 && (
        <div className="nhlx-run-picks">
          {run.topPicks.slice(0, 4).map((p, i) => (
            <div className="nhlx-run-pick" key={`${p.name}-${i}`}>
              <b>{p.name}</b>
              <em>{Math.round((p.prob || 0) * 100)}% {p.market}</em>
            </div>
          ))}
        </div>
      )}
      <div className="nhlx-run-files">
        {Object.entries(run.files || {}).map(([slot, f]) => (
          <a
            key={slot}
            className="nhlx-run-file"
            href={`/api/nhl/runs/${run.id}/file?slot=${slot}`}
            title={`Download ${f.name}`}
          >
            {slotLabel(slot)}
          </a>
        ))}
      </div>
      <div className="nhlx-run-actions">
        <button type="button" className="nhlx-btn nhlx-btn-sm" disabled={busy} onClick={() => onLoad(run)}>
          {active ? 'Reload slate' : 'Open slate'}
        </button>
        <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-danger" disabled={busy} onClick={() => onDelete(run)}>
          Delete
        </button>
      </div>
    </article>
  );
}

export default function NhlApp({ email }) {
  const [runs, setRuns] = useState(null);
  const [historyError, setHistoryError] = useState('');
  const [activeRunId, setActiveRunId] = useState(null);
  const [loadRequest, setLoadRequest] = useState(null);
  const [save, setSave] = useState({ state: 'idle', text: '' });
  const [busy, setBusy] = useState(false);
  const [latest, setLatest] = useState(null);
  const activeRunRef = useRef(null);
  activeRunRef.current = activeRunId;
  const prevFilesRef = useRef({});
  const replayingRef = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const { runs } = await api('/api/nhl/runs');
      setRuns(runs || []);
      setHistoryError('');
    } catch (err) {
      setHistoryError(err.message);
      setRuns((r) => r || []);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const onRunComplete = useCallback(async ({ files, results, summary, runId }) => {
    setLatest(summary);
    if (runId) {
      // Replayed from history: nothing new to store.
      setActiveRunId(runId);
      setSave({ state: 'ok', text: 'Loaded from history' });
      return;
    }
    setSave({ state: 'busy', text: 'Saving run to Supabase…' });
    try {
      const form = new FormData();
      for (const [slot, file] of Object.entries(files)) if (file) form.append(slot, file, file.name);
      form.append('summary', JSON.stringify(summary));
      try {
        const json = JSON.stringify(results);
        if (json.length <= MAX_RESULTS_BYTES) form.append('results', new Blob([json], { type: 'application/json' }), 'results.json');
      } catch (e) {
        console.warn('Results not serializable; saving inputs only.', e);
      }
      const { run } = await api('/api/nhl/runs', { method: 'POST', body: form });
      setActiveRunId(run.id);
      setSave({ state: 'ok', text: 'Saved to run history' });
      setRuns((prev) => [run, ...(prev || []).filter((r) => r.id !== run.id)]);
    } catch (err) {
      setSave({ state: 'err', text: `Not saved: ${err.message}` });
    }
  }, []);

  // Inputs added after a run (box scores, rankings) are attached to that run.
  const onFileAdded = useCallback(async (slot, file) => {
    const id = activeRunRef.current;
    if (!id) return;
    setSave({ state: 'busy', text: `Attaching ${slotLabel(slot)}…` });
    try {
      const form = new FormData();
      form.append(slot, file, file.name);
      const { run } = await api(`/api/nhl/runs/${id}`, { method: 'PATCH', body: form });
      setRuns((prev) => (prev || []).map((r) => (r.id === run.id ? run : r)));
      setSave({ state: 'ok', text: `${slotLabel(slot)} attached to this run` });
    } catch (err) {
      setSave({ state: 'err', text: `Attach failed: ${err.message}` });
    }
  }, []);

  const onFilesChange = useCallback((files) => {
    // A new core input means a new slate; the next run saves as a new entry.
    const core = ['season', 'l5', 'hist', 'playerStats', 'lineups', 'pace'];
    const prev = prevFilesRef.current;
    if (!replayingRef.current && core.some((k) => files[k] !== prev[k])) {
      setActiveRunId(null);
      setLatest(null);
      setSave({ state: 'idle', text: '' });
    }
    prevFilesRef.current = files;
    replayingRef.current = false;
  }, []);

  const loadRun = useCallback(async (run) => {
    setBusy(true);
    setSave({ state: 'busy', text: 'Downloading slate files…' });
    try {
      const entries = await Promise.all(
        Object.entries(run.files || {}).map(async ([slot, meta]) => {
          const res = await fetch(`/api/nhl/runs/${run.id}/file?slot=${slot}`, { cache: 'no-store' });
          if (!res.ok) throw new Error(`${meta.name}: ${res.status}`);
          const blob = await res.blob();
          return [slot, new File([blob], meta.name, { type: blob.type })];
        }),
      );
      replayingRef.current = true;
      setActiveRunId(run.id);
      setLoadRequest({ files: Object.fromEntries(entries), runId: run.id, at: Date.now() });
      document.getElementById('model')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
      setSave({ state: 'err', text: `Could not load run: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }, []);

  const deleteRun = useCallback(async (run) => {
    if (!window.confirm(`Delete the ${run.slateDate || ''} run and its files? This can't be undone.`)) return;
    setBusy(true);
    try {
      await api(`/api/nhl/runs/${run.id}`, { method: 'DELETE' });
      setRuns((prev) => (prev || []).filter((r) => r.id !== run.id));
      if (activeRunRef.current === run.id) setActiveRunId(null);
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);

  const counters = useMemo(() => {
    if (latest) {
      return [
        [latest.games.length, 'Games tonight'],
        [latest.playerCount ?? '—', 'Players projected'],
        [runs ? runs.length : '—', 'Saved runs'],
      ];
    }
    return [
      ['4', 'Prop markets'],
      ['8', 'Input feeds'],
      [runs ? runs.length : '—', 'Saved runs'],
    ];
  }, [latest, runs]);

  const status = save.text ? (
    <span className={`nhlx-status nhlx-status-${save.state === 'err' ? 'err' : save.state === 'busy' ? 'busy' : 'ok'}`} role="status">
      {save.text}
    </span>
  ) : null;

  return (
    <>
      <SiteHeader
        nav={(
          <>
            <a href="#model">Model</a>
            <a href="#history">Run history</a>
          </>
        )}
        right={(
          <>
            <span className="nhlx-user">{email}</span>
            <SignOutButton />
          </>
        )}
      />

      <main>
        <section className="nhlx-glow" id="model">
          <div className="nhlx-wrap">
            <div className="nhlx-bench-head">
              <div>
                <span className="nhlx-eyebrow">Model 3.0 workbench</span>
                <h1 style={{ marginTop: 16 }}>Tonight&apos;s <span>slate</span></h1>
              </div>
              <div className="nhlx-counters">
                {counters.map(([v, l]) => (
                  <div className="nhlx-counter" key={l}><b>{v}</b><span>{l}</span></div>
                ))}
              </div>
            </div>

            <NhlModel
              loadRequest={loadRequest}
              onRunComplete={onRunComplete}
              onFileAdded={onFileAdded}
              onFilesChange={onFilesChange}
              statusSlot={status}
            />
          </div>
        </section>

        <section className="nhlx-section" id="history">
          <div className="nhlx-wrap">
            <div className="nhlx-history-head">
              <div>
                <span className="nhlx-eyebrow">Supabase</span>
                <h2 className="nhlx-h2">Run <span>history</span></h2>
              </div>
              <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={refresh} disabled={busy}>
                Refresh
              </button>
            </div>
            {historyError && <div className="nhlx-alert" style={{ marginTop: 20 }}>⚠ {historyError}</div>}
            {runs === null ? (
              <div className="nhlx-empty">Loading saved runs…</div>
            ) : runs.length === 0 ? (
              <div className="nhlx-empty">No saved runs yet. Run the model and the slate is stored here with its input files.</div>
            ) : (
              <div className="nhlx-history-grid">
                {runs.map((run) => (
                  <RunCard
                    key={run.id}
                    run={run}
                    active={run.id === activeRunId}
                    busy={busy}
                    onLoad={loadRun}
                    onDelete={deleteRun}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="nhlx-footer">
        <div className="nhlx-wrap">
          <span>NHL Model 3.0 · Shot Supply Engine</span>
          <span>Runs and input files are stored in Supabase Storage</span>
        </div>
      </footer>
    </>
  );
}
