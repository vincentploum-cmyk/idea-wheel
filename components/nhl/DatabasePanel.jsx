'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const POSITIONS = ['C', 'LW', 'RW', 'D', 'G'];
const PAGE = 150;

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const logo = (abbr) => `https://assets.nhle.com/logos/nhl/svg/${abbr}_light.svg`;

function changeText(c) {
  if (c.type === 'added') return `joined ${c.to}`;
  if (c.type === 'removed') return `left ${c.from} roster`;
  if (c.type === 'moved') return `${c.from} → ${c.to}`;
  return `${c.type.replace('-changed', '')}: ${c.from ?? '—'} → ${c.to ?? '—'}`;
}

function PlayerEditor({ player, teams, onSave, onClear, onCancel }) {
  const [form, setForm] = useState({
    team: player.team || '',
    pos: player.pos || '',
    name: player.overridden ? player.name : '',
    excluded: !!player.excluded,
    note: player.note || '',
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  return (
    <div className="nhlx-db-editor">
      <label>Team
        <select className="nhlx-input nhlx-input-sm" value={form.team} onChange={set('team')}>
          {teams.map((t) => <option key={t.abbrev} value={t.abbrev}>{t.abbrev} · {t.name}</option>)}
        </select>
      </label>
      <label>Position
        <select className="nhlx-input nhlx-input-sm" value={form.pos} onChange={set('pos')}>
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </label>
      <label>Name used in PropFinder
        <input className="nhlx-input nhlx-input-sm" value={form.name} onChange={set('name')} placeholder={player.propfinderName || player.name} />
      </label>
      <label>Note
        <input className="nhlx-input nhlx-input-sm" value={form.note} onChange={set('note')} placeholder="e.g. trade pending" />
      </label>
      <label className="nhlx-db-check">
        <input type="checkbox" checked={form.excluded} onChange={set('excluded')} /> Leave out of the model
      </label>
      <div className="nhlx-auto-actions">
        <button type="button" className="nhlx-btn nhlx-btn-sm" onClick={() => onSave(form)}>Save</button>
        {player.overridden && <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={onClear}>Reset to NHL data</button>}
        <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function DatabasePanel() {
  const [db, setDb] = useState(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [team, setTeam] = useState('');
  const [pos, setPos] = useState('');
  const [showOff, setShowOff] = useState(false);
  const [preOnly, setPreOnly] = useState(false);
  const [editing, setEditing] = useState(null);
  const [linking, setLinking] = useState(null);
  const [linkQ, setLinkQ] = useState('');
  const [page, setPage] = useState(1);
  const [imp, setImp] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/nhl/data/players', { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status}`);
      setDb(await res.json());
      setErr('');
    } catch (e) {
      setErr(`Couldn’t load the database: ${e.message}`);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateRosters = async () => {
    setBusy(true);
    setMsg('Pulling all 32 rosters from the NHL…');
    try {
      const res = await fetch('/api/nhl/data/rosters', { method: 'POST' });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      const r = j.result;
      setMsg(`Rosters updated: ${r.teams} teams, ${r.players} players, ${r.firstLoad ? 'first load' : `${r.changes} change${r.changes === 1 ? '' : 's'}`}${r.failed?.length ? `, failed: ${r.failed.join(', ')}` : ''}.`);
      await load();
    } catch (e) {
      setMsg(`Roster update failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const loadPreseason = async () => {
    setBusy(true);
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), 8, 15)); // Sep 15
    const dates = [];
    for (let d = start; d <= today; d = new Date(d.getTime() + 86400000)) dates.push(d.toISOString().slice(0, 10));
    let games = 0;
    for (let i = 0; i < dates.length; i++) {
      setMsg(`Loading preseason games… ${dates[i]} (${i + 1}/${dates.length})`);
      try {
        const res = await fetch(`/api/nhl/data/backfill?preseason=1&date=${dates[i]}`, { method: 'POST' });
        const j = await res.json();
        games += j.result?.ingested || 0;
      } catch {}
    }
    setMsg(`Preseason updated: ${games} new game${games === 1 ? '' : 's'} loaded.`);
    await load();
    setBusy(false);
  };

  const rebuild = async () => {
    setBusy(true);
    setMsg('Rebuilding indexes from the stored games and PropFinder files…');
    try {
      const res = await fetch('/api/nhl/data/rebuild', { method: 'POST' });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      setMsg(`Rebuilt: ${j.games.games} games (${j.games.players} players), ${j.slates.slates} PropFinder slates, ${j.slates.defenseTeams} defense tables.`);
      await load();
    } catch (e) {
      setMsg(`Rebuild failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const importFiles = async (fileList) => {
    const files = [...fileList].filter((f) => /^NHL-Goal-Matchups-.*\.xlsx$/i.test(f.name));
    if (!files.length) { setMsg('No NHL-Goal-Matchups-*.xlsx files in that selection.'); return; }
    // Clean names first so they win over "_with_expected"-style variants.
    files.sort((a, b) => a.name.length - b.name.length);
    setImp({ done: 0, total: files.length, ok: 0, failed: [] });
    for (let i = 0; i < files.length; i += 4) {
      const form = new FormData();
      form.append('mode', 'import');
      files.slice(i, i + 4).forEach((f) => form.append('file', f, f.name));
      try {
        const res = await fetch('/api/nhl/data/matchups', { method: 'POST', body: form });
        const j = await res.json();
        const results = j.results || [];
        setImp((s) => ({
          ...s,
          done: Math.min(s.total, i + 4),
          ok: s.ok + results.filter((r) => !r.error).length,
          failed: [...s.failed, ...results.filter((r) => r.error).map((r) => r.file)],
        }));
      } catch (e) {
        setImp((s) => ({ ...s, done: Math.min(s.total, i + 4), failed: [...s.failed, ...files.slice(i, i + 4).map((f) => f.name)] }));
      }
    }
    await load();
  };

  const saveOverride = async (id, body) => {
    const res = await fetch('/api/nhl/data/players', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) });
    const j = await res.json();
    if (!res.ok) { setMsg(j.error || 'Save failed'); return; }
    setEditing(null);
    setLinking(null);
    await load();
  };

  const teams = db?.teams || [];
  const players = db?.players || [];
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return players.filter((p) => (showOff || p.onRoster || p.overridden)
      && (!preOnly || p.preseason)
      && (!team || p.team === team)
      && (!pos || p.pos === pos)
      && (!needle || p.name.toLowerCase().includes(needle) || (p.propfinderName || '').toLowerCase().includes(needle) || String(p.id) === needle));
  }, [players, q, team, pos, showOff, preOnly]);
  useEffect(() => { setPage(1); }, [q, team, pos, showOff, preOnly]);

  const onRoster = players.filter((p) => p.onRoster).length;
  const linkCands = useMemo(() => {
    const n = linkQ.trim().toLowerCase();
    if (n.length < 2) return [];
    return players.filter((p) => p.name.toLowerCase().includes(n)).slice(0, 8);
  }, [players, linkQ]);

  if (!db) {
    return <div className="nhlx-empty">{err || 'Loading the database…'}</div>;
  }

  return (
    <div className="nhlx-db">
      <div className="nhlx-counters">
        <div className="nhlx-counter"><b>{teams.length}</b><span>Teams</span></div>
        <div className="nhlx-counter"><b>{onRoster}</b><span>Players on rosters</span></div>
        <div className="nhlx-counter"><b>{players.length - onRoster}</b><span>Other players seen</span></div>
        {db.coverage.map((c) => (
          <div className="nhlx-counter" key={c.season}>
            <b>{c.games}</b>
            <span>{c.season.slice(0, 4)}-{c.season.slice(6)} games stored</span>
          </div>
        ))}
        <div className="nhlx-counter"><b>{db.propfinder.names - db.propfinder.unmatched.length}/{db.propfinder.names}</b><span>PropFinder names matched</span></div>
      </div>

      <div className="nhlx-auto nhlx-db-actions">
        <div className="nhlx-auto-head">
          <div>
            <div className="nhlx-auto-title">Keep the database current</div>
            <div className="nhlx-auto-sub">
              Rosters refresh every morning. Last update {fmt(db.lastRoster?.at)}; last game refresh {fmt(db.lastRefresh)}.
            </div>
          </div>
          <div className="nhlx-auto-actions">
            <button type="button" className="nhlx-btn nhlx-btn-sm" disabled={busy} onClick={updateRosters}>Update rosters now</button>
            <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={busy} onClick={loadPreseason}>Update preseason games</button>
            <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={busy} onClick={rebuild} title="Recompute season indexes, defense rankings and PropFinder names from the stored source files">Rebuild indexes</button>
            <label className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" style={{ cursor: 'pointer' }}>
              Import PropFinder files
              <input type="file" multiple accept=".xlsx" style={{ display: 'none' }} onChange={(e) => { importFiles(e.target.files); e.target.value = ''; }} />
            </label>
            <label className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" style={{ cursor: 'pointer' }}>
              Import a whole folder
              <input type="file" webkitdirectory="" directory="" multiple style={{ display: 'none' }} onChange={(e) => { importFiles(e.target.files); e.target.value = ''; }} />
            </label>
          </div>
        </div>
        {msg && <p className="nhlx-auto-msg" role="status">{msg}</p>}
        {imp && (
          <p className="nhlx-auto-msg" role="status">
            Import: {imp.done}/{imp.total} files, {imp.ok} stored{imp.failed.length ? `, ${imp.failed.length} not recognised` : ''}.
          </p>
        )}
      </div>

      <h3 className="nhlx-db-h3">Teams</h3>
      <div className="nhlx-db-teams">
        {teams.map((t) => (
          <button type="button" key={t.abbrev} className={`nhlx-db-team${team === t.abbrev ? ' is-active' : ''}`} onClick={() => setTeam(team === t.abbrev ? '' : t.abbrev)}>
            <img src={t.logo || logo(t.abbrev)} alt="" width="36" height="36" />
            <span>
              <b>{t.name}</b>
              <small>{t.players} on roster{t.preseasonDressed ? ` · ${t.preseasonDressed} dressed in preseason` : ''} · {t.gamesStored} games</small>
            </span>
          </button>
        ))}
        {!teams.length && <div className="nhlx-empty">No teams yet. Click “Update rosters now”.</div>}
      </div>

      <h3 className="nhlx-db-h3">Players</h3>
      <div className="nhlx-auto-actions nhlx-db-filters">
        <input className="nhlx-input nhlx-input-sm" placeholder="Search name or NHL id" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search players" />
        <select className="nhlx-input nhlx-input-sm" value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team">
          <option value="">All teams</option>
          {teams.map((t) => <option key={t.abbrev} value={t.abbrev}>{t.abbrev} · {t.name}</option>)}
        </select>
        <select className="nhlx-input nhlx-input-sm" value={pos} onChange={(e) => setPos(e.target.value)} aria-label="Position">
          <option value="">All positions</option>
          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <label className="nhlx-db-check"><input type="checkbox" checked={preOnly} onChange={(e) => setPreOnly(e.target.checked)} /> Dressed in preseason</label>
        <label className="nhlx-db-check"><input type="checkbox" checked={showOff} onChange={(e) => setShowOff(e.target.checked)} /> Include players not on a roster</label>
        <span className="nhlx-auto-meta">{filtered.length} players</span>
      </div>

      <div className="nhlx-db-table-wrap">
        <table className="nhlx-db-table">
          <thead>
            <tr><th>Player</th><th>Team</th><th>Pos</th><th>#</th><th>Games stored</th><th>Preseason</th><th>Status</th><th /></tr>
          </thead>
          <tbody>
            {filtered.slice(0, page * PAGE).map((p) => (
              <tr key={p.id} className={p.excluded ? 'is-excluded' : ''}>
                <td>
                  <div className="nhlx-db-player">
                    {p.headshot ? <img src={p.headshot} alt="" width="32" height="32" loading="lazy" /> : <span className="nhlx-db-avatar" />}
                    <span>
                      <b>{p.name}</b>
                      {p.propfinderName && p.propfinderName !== p.name && <small>PropFinder: {p.propfinderName}</small>}
                      {p.note && <small>{p.note}</small>}
                    </span>
                  </div>
                  {editing === p.id && (
                    <PlayerEditor
                      player={p}
                      teams={teams}
                      onSave={(f) => saveOverride(p.id, {
                        team: f.team !== p.team ? f.team : undefined,
                        pos: f.pos !== p.pos ? f.pos : undefined,
                        name: f.name || undefined,
                        note: f.note,
                        excluded: f.excluded,
                      })}
                      onClear={() => saveOverride(p.id, { clear: true })}
                      onCancel={() => setEditing(null)}
                    />
                  )}
                </td>
                <td>{p.team || '—'}</td>
                <td>{p.pos || '—'}</td>
                <td>{p.number ?? '—'}</td>
                <td>{p.games}</td>
                <td>{p.preseason ? `${p.preseason.gp} GP · last ${p.preseason.last?.slice(5)}${p.preseason.team && p.preseason.team !== p.team ? ` (${p.preseason.team})` : ''}` : '—'}</td>
                <td>
                  {p.excluded ? <span className="nhlx-chip nhlx-chip-amber">Left out</span>
                    : p.overridden ? <span className="nhlx-chip nhlx-chip-violet">Edited</span>
                      : p.onRoster ? <span className="nhlx-chip nhlx-chip-blue">On roster</span>
                        : <span className="nhlx-chip">Last game {p.lastGame || '—'}</span>}
                </td>
                <td><button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={() => setEditing(editing === p.id ? null : p.id)}>Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > page * PAGE && (
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" style={{ margin: '14px auto', display: 'flex' }} onClick={() => setPage((n) => n + 1)}>
            Show more
          </button>
        )}
      </div>

      <div className="nhlx-db-cols">
        <div>
          <h3 className="nhlx-db-h3">PropFinder names without a match ({db.propfinder.unmatched.length})</h3>
          <p className="nhlx-auto-meta">The model joins files on player name. Link these to the right NHL player so generated files use the same spelling.</p>
          <div className="nhlx-db-list">
            {db.propfinder.unmatched.slice(0, 60).map((u) => (
              <div key={u.name} className="nhlx-db-row">
                <span><b>{u.name}</b> <small>{u.team || '?'} · {u.pos || '?'} · last seen {u.lastSeen || '—'}</small></span>
                {linking === u.name ? (
                  <span className="nhlx-db-link">
                    <input className="nhlx-input nhlx-input-sm" autoFocus placeholder="Find NHL player" value={linkQ} onChange={(e) => setLinkQ(e.target.value)} />
                    {linkCands.map((c) => (
                      <button type="button" key={c.id} className="nhlx-run-file" onClick={() => saveOverride(c.id, { name: u.name })}>
                        {c.name} · {c.team}
                      </button>
                    ))}
                  </span>
                ) : (
                  <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={() => { setLinking(u.name); setLinkQ(u.name.split(' ').slice(-1)[0]); }}>Link</button>
                )}
              </div>
            ))}
            {!db.propfinder.unmatched.length && <p className="nhlx-auto-meta">Every PropFinder name matches an NHL player.</p>}
          </div>
        </div>
        <div>
          <h3 className="nhlx-db-h3">Recent roster changes</h3>
          <div className="nhlx-db-list">
            {db.changes.slice(0, 60).map((c, i) => (
              <div key={`${c.id}-${c.at}-${i}`} className="nhlx-db-row">
                <span><b>{c.name}</b> <small>{changeText(c)}</small></span>
                <small>{fmt(c.at)}</small>
              </div>
            ))}
            {!db.changes.length && <p className="nhlx-auto-meta">No changes logged yet. They appear here after each roster update.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
