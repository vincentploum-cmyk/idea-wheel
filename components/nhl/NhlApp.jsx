'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import SiteHeader from './SiteHeader';
import SignOutButton from './SignOutButton';
import { teamLogo, slotLabel } from './run-summary';
import AutomationPanel from './AutomationPanel';
import DatabasePanel from './DatabasePanel';
import MatchupsPanel from './MatchupsPanel';
import LeaguePanel from './LeaguePanel';
import { PlayerCardHost } from './PlayerCard';
import SetupPanel from './SetupPanel';
import ThemeToggle from './ThemeToggle';

const TABS = [
  ['start', 'Start here'],
  ['teams', 'Teams & players'],
  ['matchups', 'Matchups'],
  ['model', 'Best bets'],
  ['league', 'League'],
  ['history', 'Run history'],
];
const TAB_KEYS = TABS.map(([key]) => key);

// The URL hash is the tab state, so tabs deep-link and back/forward work.
function tabFromHash() {
  const key = window.location.hash.slice(1);
  return TAB_KEYS.includes(key) ? key : TAB_KEYS[0];
}

// Tabs visited this page load; a visited panel stays mounted so the model
// keeps its loaded files when you switch away.
const visited = new Set();
function subscribeHash(cb) {
  const onChange = () => { visited.add(tabFromHash()); cb(); };
  onChange();
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}
const visitedKey = () => [...visited].sort().join(',');

function useHashTab() {
  const tab = useSyncExternalStore(subscribeHash, tabFromHash, () => TAB_KEYS[0]);
  const seen = useSyncExternalStore(subscribeHash, visitedKey, () => '');
  return [tab, (key) => key === tab || seen.split(',').includes(key)];
}

// The model is ~10k lines plus SheetJS; load it on the client only.
const NhlModel = memo(dynamic(() => import('./NhlModel'), {
  ssr: false,
  loading: () => <div className="nhlx-empty">Loading model…</div>,
}));

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
        {run.files?.boxScores && <span className="nhlx-run-flag">Box scores attached</span>}
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
  const [autoSlots, setAutoSlots] = useState(null);
  const [tab, mounted] = useHashTab();
  const [setup, setSetup] = useState(null);
  // Land on "Start here" until every sync step is done; after that on Matchups.
  useEffect(() => {
    if (window.location.hash) return;
    fetch('/api/nhl/data/setup', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j) return;
      setSetup(j);
      if (!window.location.hash) window.location.replace(j.complete ? '#matchups' : '#start');
    }).catch(() => {});
  }, []);
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
      setAutoSlots(null);
      setActiveRunId(run.id);
      setLoadRequest({ files: Object.fromEntries(entries), runId: run.id, at: Date.now() });
      window.location.hash = 'model';
    } catch (err) {
      setSave({ state: 'err', text: `Could not load run: ${err.message}` });
    } finally {
      setBusy(false);
    }
  }, []);

  const loadAuto = useCallback(({ files, run, runId, meta, autoSlots: auto }) => {
    replayingRef.current = true;
    setAutoSlots(auto || null);
    if (runId) setActiveRunId(runId);
    else if (run) setActiveRunId(null);
    setLoadRequest({ files, run, runId, meta, at: Date.now() });
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


  const status = useMemo(() => (save.text ? (
    <span className={`nhlx-status nhlx-status-${save.state === 'err' ? 'err' : save.state === 'busy' ? 'busy' : 'ok'}`} role="status">
      {save.text}
    </span>
  ) : null), [save]);

  return (
    <PlayerCardHost>
      <SiteHeader
        right={(
          <>
            <span className="nhlx-user">{email}</span>
            <ThemeToggle />
            <SignOutButton />
          </>
        )}
      />

      <main>
        <div className="nhlx-wrap nhlx-tabbar">
          <div className="nhlx-tabs" role="tablist" aria-label="Sections">
            {TABS.map(([key, label]) => (
              <a
                key={key}
                href={`#${key}`}
                role="tab"
                id={`tab-${key}`}
                aria-selected={tab === key}
                aria-controls={key}
                className={`nhlx-tab${tab === key ? ' is-active' : ''}`}
              >
                {label}{key === 'start' && setup && !setup.complete ? <i className="nhlx-tab-dot" aria-label={`${setup.remaining.length} steps left`} /> : null}
              </a>
            ))}
          </div>
        </div>

        <section className="nhlx-section nhlx-tabpanel" id="start" role="tabpanel" aria-labelledby="tab-start" hidden={tab !== 'start'}>
          <div className="nhlx-wrap">
            <span className="nhlx-eyebrow">Setup</span>
            <h2 className="nhlx-h2">Start <span>here</span></h2>
            <p className="nhlx-lede">Eight steps, in order, from an empty database to tonight’s matchups. Each one checks itself; come back any day to see what still needs a click.</p>
            <div style={{ marginTop: 28 }}>{mounted('start') && <SetupPanel onStatus={setSetup} />}</div>
          </div>
        </section>

        <section className="nhlx-section nhlx-tabpanel" id="teams" role="tabpanel" aria-labelledby="tab-teams" hidden={tab !== 'teams'}>
          <div className="nhlx-wrap">
            <span className="nhlx-eyebrow">Supabase</span>
            <h2 className="nhlx-h2">Teams &amp; <span>players</span></h2>
            <p className="nhlx-lede">Pick a team to see who is on its roster. Rosters refresh from the NHL each morning; edit anything the feed hasn&apos;t caught up with yet.</p>
            <div style={{ marginTop: 28 }}><DatabasePanel /></div>
          </div>
        </section>

        <section className="nhlx-section nhlx-tabpanel" id="matchups" role="tabpanel" aria-labelledby="tab-matchups" hidden={tab !== 'matchups'}>
          <div className="nhlx-wrap">
            <span className="nhlx-eyebrow">Tonight</span>
            <h2 className="nhlx-h2">Matchups by <span>position</span></h2>
            <p className="nhlx-lede">Who is shooting into a soft spot tonight: every skater’s frozen position against what the opposing defense allows to that position at this venue.</p>
            <div style={{ marginTop: 28 }}>{mounted('matchups') && <MatchupsPanel />}</div>
          </div>
        </section>

        <section className="nhlx-bench nhlx-tabpanel" id="model" role="tabpanel" aria-labelledby="tab-model" hidden={tab !== 'model'}>
          <div className="nhlx-wrap">
            <div className="nhlx-bench-head">
              <div>
                <span className="nhlx-eyebrow">Model 3.0</span>
                <h1>Today&apos;s <span>best bets</span></h1>
                <p>{latest ? `${latest.games.length} games · ${latest.playerCount ?? '—'} players projected` : 'NHL data loads itself. Add the two PropFinder files and the model ranks the plays.'}</p>
              </div>
            </div>

            {mounted('model') && (
              <>
                <AutomationPanel runs={runs} onLoad={loadAuto} busy={busy} />
                <div className="nhlx-light">
                  <NhlModel
                    loadRequest={loadRequest}
                    autoSlots={autoSlots}
                    onRunComplete={onRunComplete}
                    onFileAdded={onFileAdded}
                    onFilesChange={onFilesChange}
                    statusSlot={status}
                  />
                </div>
              </>
            )}
          </div>
        </section>

        <section className="nhlx-section nhlx-tabpanel" id="league" role="tabpanel" aria-labelledby="tab-league" hidden={tab !== 'league'}>
          <div className="nhlx-wrap">
            <span className="nhlx-eyebrow">NHL</span>
            <h2 className="nhlx-h2">Standings &amp; <span>top scorers</span></h2>
            <div style={{ marginTop: 28 }}>{mounted('league') && <LeaguePanel />}</div>
          </div>
        </section>

        <section className="nhlx-section nhlx-history nhlx-tabpanel" id="history" role="tabpanel" aria-labelledby="tab-history" hidden={tab !== 'history'}>
          <div className="nhlx-wrap">
            <div className="nhlx-history-head">
              <div>
                <span className="nhlx-eyebrow">Saved in Supabase</span>
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
    </PlayerCardHost>
  );
}
