'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const fmt = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');

async function api(path, init) {
  const res = await fetch(path, { cache: 'no-store', ...init });
  let body = null;
  try { body = await res.json(); } catch {}
  if (!res.ok) throw new Error(body?.detail || body?.error || body?.results?.find((r) => r.error)?.error || `Request failed (${res.status})`);
  return body;
}

/**
 * Data sources for a slate: the cheat sheets (drop zone, the stored ones, delete), the PropFinder
 * pull, ESPN's schedule and box scores, and the folder-sync note.
 *   sport: { api ('/api/nfl'), query (the slate's query string), fields (the slate's form fields),
 *            label ('week 7'), groupLabel, folder ('~/Desktop/NFL'), nameHint, liveNote }
 */
export default function Sources({ sport, onChange }) {
  const [status, setStatus] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [over, setOver] = useState(false);
  const [preview, setPreview] = useState(null); // the rows read from a PDF nothing parsed from
  const fileRef = useRef(null);
  const { api: base, query, fields, label, groupLabel, folder, nameHint } = sport;

  const load = useCallback(() => api(`${base}/status?${query}`).then(setStatus).catch((e) => setMsg(`Status: ${e.message}`)), [base, query]);
  useEffect(() => { load(); }, [load]);
  // A PDF being read by OCR: poll until its rows land, then redraw the board.
  const reading = !!status?.sheets?.some((s) => s.ocr?.status === 'pending');
  useEffect(() => {
    if (!reading) return undefined;
    const t = setInterval(async () => {
      const next = await api(`${base}/status?${query}`).catch(() => null);
      if (!next) return;
      setStatus(next);
      if (!next.sheets.some((s) => s.ocr?.status === 'pending')) onChange?.();
    }, 6000);
    return () => clearInterval(t);
  }, [reading, base, query, onChange]);

  const upload = async (files) => {
    const list = [...files].filter((f) => /\.(csv|tsv|txt|xlsx|xlsm|xls|pdf)$/i.test(f.name));
    if (!list.length) { setMsg('Drop a CSV, TSV, Excel or PDF cheat sheet.'); return; }
    setBusy('upload'); setMsg('');
    try {
      const form = new FormData();
      for (const f of list) form.append('file', f, f.name);
      for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
      const j = await api(`${base}/sheets`, { method: 'POST', body: form });
      const lines = j.results.map((r) => (r.pending ? `${r.fileName}: ${r.pages} page${r.pages === 1 ? '' : 's'} of pictures, being read by OCR (a few minutes); the rows land on the board when the read is done.` : r.ok ? `${r.fileName}: ${r.rows} rows (${Object.entries(r.groups || {}).map(([g, n]) => `${n} ${groupLabel[g] || g}`).join(', ')})${r.pages ? ` from ${r.pages} page${r.pages === 1 ? '' : 's'}` : ''}${r.replaced ? ', replaced' : ''}${r.warnings?.length ? ` · ${r.warnings.length} warning${r.warnings.length === 1 ? '' : 's'}` : ''}` : `${r.fileName}: ${r.error || (r.warnings || []).join('; ') || 'no rows'}`));
      setMsg(lines.join(' · '));
      setPreview(j.results.find((r) => !r.ok && r.preview?.length)?.preview || null);
      await load(); onChange?.();
    } catch (e) { setMsg(`Upload failed: ${e.message}`); }
    finally { setBusy(''); }
  };

  const reread = async (s, full) => {
    setBusy(s.id); setMsg('');
    try {
      const j = await api(`${base}/sheets?reread=${s.id}&${query}${full ? '&full=1' : ''}`, { method: 'POST' });
      setMsg(j.sheet?.pending ? `${s.fileName}: reading again…` : j.sheet?.running ? `${s.fileName}: a read is already running.` : `${s.fileName}: ${j.sheet?.rows ?? 0} rows read again.`);
      await load(); onChange?.();
    } catch (e) { setMsg(`Re-read failed: ${e.message}`); }
    finally { setBusy(''); }
  };

  const remove = async (s) => {
    if (!window.confirm(`Remove ${s.fileName} from ${label}?`)) return;
    setBusy(s.id);
    try { await api(`${base}/sheets?id=${s.id}&${query}`, { method: 'DELETE' }); await load(); onChange?.(); }
    catch (e) { setMsg(`Remove failed: ${e.message}`); }
    finally { setBusy(''); }
  };

  const refresh = async (only) => {
    setBusy(only); setMsg('');
    try {
      const j = await api(`${base}/refresh?only=${only}&${query}&force=1`, { method: 'POST' });
      if (only === 'propfinder') {
        const p = j.propfinder || {};
        setMsg(p.ok ? `PropFinder: ${p.players} players (${p.withProps} with lines, ${p.withGames} with logs), ${p.defenseTeams} defenses${p.missingTeams?.length ? `, no team row for ${p.missingTeams.join(', ')}` : ''}${p.fieldsSeen?.unread?.length ? ` · unread game fields: ${p.fieldsSeen.unread.join(', ')}` : ''}` : `PropFinder: ${p.skipped || p.error || 'not pulled'}`);
      } else setMsg(`Schedule: ${j.schedule?.games} games, ${j.schedule?.finals} final, ${j.schedule?.resultsStored} box score${j.schedule?.resultsStored === 1 ? '' : 's'} stored`);
      await load(); onChange?.();
    } catch (e) { setMsg(`${only === 'propfinder' ? 'PropFinder' : 'Schedule'}: ${e.message}`); }
    finally { setBusy(''); }
  };

  const pf = status?.propfinder;
  return (
    <details className="nhlx-auto-tools ir-nfl-sources">
      <summary>Data sources: cheat sheets, PropFinder, schedule and folder sync</summary>
      <div
        className={`nhlx-drop${over ? ' is-over' : ''}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}
        role="button" tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click(); }}
      >
        <span className="nhlx-drop-icon">+</span>
        <span className="nhlx-drop-title">{busy === 'upload' ? 'Reading…' : 'Drop the cheat sheets here'}</span>
        <span className="nhlx-drop-sub">CSV, TSV, Excel or PDF, any column order: one row per prop (market, line, side, odds, hit rates) or one row per player with a column per market; a PDF of pictures is read by OCR. They land on {label}; a file with a stored name replaces it.</span>
        <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx,.xlsm,.xls,.pdf" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
      </div>
      {msg ? <p className="nhlx-auto-msg">{msg}</p> : null}
      {preview ? <details className="ir-nfl-warn" open><summary>What was read from the PDF (first rows; the parser needs a header row with Player, the market or a line, and the price)</summary><ul>{preview.map((row, i) => <li key={i}><code>{row}</code></li>)}</ul></details> : null}
      <div className="nhlx-auto-tools-grid">
        <div>
          <div className="nhlx-auto-label">Cheat sheets on {label}</div>
          {!status ? <div className="nhlx-auto-meta">Loading…</div> : !status.sheets.length ? <div className="nhlx-auto-meta">None yet. Drop the sheets above, or save them in <code>{folder}</code> on the Mac: the folder sync posts them here.</div> : (
            <ul className="ir-nfl-sheets">
              {status.sheets.map((s) => (
                <li key={s.id}>
                  <b>{s.fileName}</b>
                  {s.ocr?.status === 'pending' ? <span className="nhlx-auto-meta ir-ocr-live">Reading the pictures by OCR: page {s.ocr.page || 0} of {s.ocr.pages}… · {s.source === 'sync' ? 'folder sync' : 'uploaded'} {fmt(s.at)}</span>
                    : s.ocr?.status === 'failed' ? <span className="nhlx-auto-meta">OCR read failed: {s.ocr.error || 'no rows'} · {s.source === 'sync' ? 'folder sync' : 'uploaded'} {fmt(s.at)}</span>
                    : <span className="nhlx-auto-meta">{s.rows} rows · {s.players} players · {Object.entries(s.groups || {}).map(([g, n]) => `${n} ${groupLabel[g] || g}`).join(', ')} · {s.source === 'sync' ? 'folder sync' : 'uploaded'} {fmt(s.at)}{s.ocr ? ` · read by OCR from ${s.pages} page${s.pages === 1 ? '' : 's'}${s.ocr.games?.length ? ` (${s.ocr.games.map((g) => g.teams.filter(Boolean).join('–')).join(', ')})` : ''}` : ''}{s.warnings?.length ? ` · ${s.warnings.length} ${s.ocr ? 'note' : 'row'}${s.warnings.length === 1 ? '' : 's'}${s.ocr ? '' : ' skipped'}` : ''}</span>}
                  {s.warnings?.length ? <details className="ir-nfl-warn"><summary>{s.ocr ? 'Notes from the read' : 'Skipped rows'}</summary><ul>{s.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></details> : null}
                  {s.preview?.length ? <details className="ir-nfl-warn"><summary>First rows read from the PDF ({s.pages} page{s.pages === 1 ? '' : 's'})</summary><ul>{s.preview.map((row, i) => <li key={i}><code>{row}</code></li>)}</ul></details> : null}
                  {s.ocr && s.ocr.status !== 'pending' ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={!!busy} onClick={() => reread(s, s.ocr.status === 'failed' && !s.ocr.games)}>Read again</button> : null}{' '}
                  <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-danger" disabled={busy === s.id} onClick={() => remove(s)}>Remove</button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="nhlx-auto-label">PropFinder</div>
          <div className="nhlx-auto-meta">
            {!status ? 'Loading…' : !pf?.configured ? 'Not configured: set PROPFINDER_EMAIL / PROPFINDER_PASSWORD on Render (the NHL pull’s credentials serve every sport).'
              : pf.file ? <>Pulled {fmt(pf.file.at)}: {pf.file.players} players ({pf.file.withProps} with lines, {pf.file.withGames} with logs), {pf.file.defenseTeams} defenses{pf.file.depthCharts != null ? `, ${pf.file.depthCharts} depth chart${pf.file.depthCharts === 1 ? '' : 's'}` : ''}{pf.file.injuries ? (pf.file.injuries.source ? `, injury report: ${pf.file.injuries.slate ?? pf.file.injuries.count} player${(pf.file.injuries.slate ?? pf.file.injuries.count) === 1 ? '' : 's'} on the slate, ${pf.file.injuries.out} out${pf.file.injuries.fetched?.length ? ` (${pf.file.injuries.fetched.join(', ')} read one by one for the without-teammate splits)` : ''}${pf.file.injuries.missing?.length ? `; not read: ${pf.file.injuries.missing.join(', ')}` : ''}` : `; the injury report was not read${pf.file.injuries.error ? ` (${pf.file.injuries.error})` : ''}`) : ''}.{pf.file.missingTeams?.length ? ` No team row for ${pf.file.missingTeams.join(', ')}.` : ''}{pf.file.fieldsSeen?.unread?.length ? <> <b>Unread game fields</b> (spellings this site does not know yet): <code>{pf.file.fieldsSeen.unread.join(', ')}</code>.</> : ''}{pf.file.injuries?.stale?.length ? <> <b>Report rows the logs overtook</b> (listed out, but he played since; left aside): {pf.file.injuries.stale.join('; ')}.</> : ''}{pf.file.samples ? Object.entries(pf.file.samples).map(([name, s]) => <span key={name}> <b>{name} route</b> <code>{s.path}</code>: {s.error ? `refused (${s.error})` : `answered${s.count != null ? ` with ${s.count} items` : ''}; keys ${s.keys.join(', ') || 'none'}`}.{s.sample ? <details className="ir-nfl-warn"><summary>The answer’s first 2000 characters</summary><code>{s.sample}</code></details> : null}</span>) : ''}</>
              : pf.last?.skipped || pf.last?.error ? `Last try ${fmt(pf.last.at)}: ${pf.last.skipped || pf.last.error}` : 'Not pulled for this slate yet. The scheduled run pulls it; or pull now.'}
          </div>
          {status?.injuries ? (
            <div className="nhlx-auto-meta" title="ESPN's league injury feed, read with the schedule and again every 20 minutes while the slate is live: the newer word on each player wins over PropFinder's report; the stored box score beats both once a game is final.">
              {status.injuries.at ? <>ESPN injuries read {fmt(status.injuries.fetchedAt || status.injuries.at)}: {status.injuries.slate} listed on the slate ({status.injuries.out} out, {status.injuries.gtd} game-time decisions), {status.injuries.league} league-wide.</> : 'ESPN injuries: not read yet for this slate (the first board load or refresh reads it).'}
            </div>
          ) : null}
          {pf?.file?.fieldsSeen?.markets && Object.keys(pf.file.fieldsSeen.markets).length ? (
            <details className="ir-nfl-warn"><summary>Odds markets in the pull ({Object.keys(pf.file.fieldsSeen.markets).length}) and where each is filed</summary>
              <ul>{Object.entries(pf.file.fieldsSeen.markets).sort((a, b) => b[1].n - a[1].n).map(([name, m]) => <li key={name}><code>{name}</code> → {m.market || 'skipped'} ({m.n})</li>)}</ul>
            </details>
          ) : null}
          <div className="nhlx-auto-actions">
            <button type="button" className="nhlx-btn nhlx-btn-sm" disabled={!!busy || !pf?.configured} onClick={() => refresh('propfinder')}>{busy === 'propfinder' ? 'Pulling…' : 'Pull from PropFinder now'}</button>
          </div>
        </div>
        <div>
          <div className="nhlx-auto-label">Schedule and box scores (ESPN)</div>
          <div className="nhlx-auto-meta">
            {!status ? 'Loading…' : status.schedule ? `${status.schedule.games} games, ${status.schedule.finals} final, ${status.results} box score${status.results === 1 ? '' : 's'} stored · fetched ${fmt(status.schedule.fetchedAt)}` : 'Not fetched yet.'}
            {' '}Re-read on every board load when stale (every 10 minutes while a game is on).
          </div>
          <div className="nhlx-auto-actions">
            <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={!!busy} onClick={() => refresh('schedule')}>{busy === 'schedule' ? 'Fetching…' : 'Refresh schedule and scores'}</button>
          </div>
        </div>
        <div>
          <div className="nhlx-auto-label">Folder sync</div>
          <div className="nhlx-auto-meta">
            The Mac sync watches <code>{folder}</code> (any subfolder) and posts every new <code>.csv</code> / <code>.xlsx</code> here with the same sync token as the NHL folder; the slate is read from the file name ({nameHint}) or is the current one.
            {status?.syncToken ? ` Token created ${fmt(status.syncToken.createdAt)}.` : ' No sync token yet: create one under the NHL Best bets → Data sources.'} Re-run <code>tools/mac-sync/install.command</code> once after updating.
          </div>
        </div>
      </div>
    </details>
  );
}
