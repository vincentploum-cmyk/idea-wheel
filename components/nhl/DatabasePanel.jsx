'use client';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Headshot, TeamLogo, rankClass } from './media';

const POSITIONS = ['C', 'LW', 'RW', 'D', 'G'];
const GROUP_OF = { C: 'Forwards', LW: 'Forwards', RW: 'Forwards', D: 'Defense', G: 'Goalies' };
const GROUPS = ['Forwards', 'Defense', 'Goalies'];
const PAGE = 150;

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function changeText(c) {
  if (c.type === 'added') return `joined ${c.to}`;
  if (c.type === 'removed') return `left ${c.from} roster`;
  if (c.type === 'moved') return `${c.from} → ${c.to}`;
  return `${c.type.replace('-changed', '')}: ${c.from ?? '—'} → ${c.to ?? '—'}`;
}

function preseasonText(p) {
  if (!p.preseason) return '—';
  const away = p.preseason.team && p.preseason.team !== p.team ? ` (${p.preseason.team})` : '';
  return `${p.preseason.gp} GP · last ${p.preseason.last?.slice(5)}${away}`;
}

function StatusChip({ p }) {
  if (p.excluded) return <span className="nhlx-chip nhlx-chip-amber">Left out</span>;
  if (p.overridden) return <span className="nhlx-chip nhlx-chip-violet">Edited</span>;
  if (p.onRoster) return <span className="nhlx-chip nhlx-chip-blue">On roster</span>;
  return <span className="nhlx-chip">Last game {p.lastGame || '—'}</span>;
}

function PlayerName({ p }) {
  return (
    <div className="nhlx-db-player">
      <Headshot id={p.id} size={32} />
      <span>
        <b>{p.name}</b>
        {p.propfinderName && p.propfinderName !== p.name && <small>PropFinder: {p.propfinderName}</small>}
        {p.note && <small>{p.note}</small>}
      </span>
    </div>
  );
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

// One player row, shared by the team roster and the search table.
function PlayerRow({ p, teams, editing, setEditing, saveOverride, showTeam }) {
  return (
    <tr className={p.excluded ? 'is-excluded' : ''}>
      <td>
        <PlayerName p={p} />
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
      {showTeam && <td>{p.team || '—'}</td>}
      <td>{p.pos || '—'}</td>
      <td>{p.number ?? '—'}</td>
      <td>{p.games}</td>
      <td>{preseasonText(p)}</td>
      <td><StatusChip p={p} /></td>
      <td><button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={() => setEditing(editing === p.id ? null : p.id)}>Edit</button></td>
    </tr>
  );
}

function PlayerTable({ rows, showTeam, ...rowProps }) {
  return (
    <table className="nhlx-db-table">
      <thead>
        <tr><th>Player</th>{showTeam && <th>Team</th>}<th>Pos</th><th>#</th><th>Games stored</th><th>Preseason</th><th>Status</th><th /></tr>
      </thead>
      <tbody>
        {rows.map((p) => <PlayerRow key={p.id} p={p} showTeam={showTeam} {...rowProps} />)}
      </tbody>
    </table>
  );
}

const DEF_POS = ['LW', 'C', 'RW', 'D'];
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));

/** What this team allows per game to each position, at home and away. */
function TeamDefense({ abbr, defense }) {
  if (!defense) return <p className="nhlx-auto-meta">Loading defense table…</p>;
  const t = defense.season.teams[abbr];
  if (!t || !t.ALL.All.gp) return <p className="nhlx-auto-meta">No stored games for {abbr} yet, so nothing to rank.</p>;
  const n = defense.season.teamCount;
  const cell = (venue, pos, k, d = 1) => {
    const v = t[venue][pos];
    const r = defense.season.ranks[abbr]?.[venue]?.[pos]?.[k];
    return <td key={`${venue}${pos}${k}`} className={rankClass(r, n)}>{v.gp ? num(v[k], d) : '—'}{r ? <i>#{r}</i> : null}</td>;
  };
  return (
    <div className="nhlx-defcard nhlx-defcard-wide">
      <div className="nhlx-defcard-head">
        <div>
          <b>How {abbr} defends each position</b>
          <small>Allowed per game this season · rank 1 = most permissive of {n} · {t.H.All.gp} home, {t.A.All.gp} away games</small>
        </div>
      </div>
      <table className="nhlx-deftable">
        <thead>
          <tr><th rowSpan="2">Pos</th><th colSpan="3">At home</th><th colSpan="3">Away</th><th colSpan="2">Last 10</th></tr>
          <tr><th>SOG</th><th>Goals</th><th>Chances</th><th>SOG</th><th>Goals</th><th>Chances</th><th>SOG</th><th>Goals</th></tr>
        </thead>
        <tbody>
          {DEF_POS.map((pos) => {
            const l = defense.l10.teams[abbr]?.ALL?.[pos];
            const lr = defense.l10.ranks[abbr]?.ALL?.[pos] || {};
            return (
              <tr key={pos}>
                <td><b>{pos}</b></td>
                {cell('H', pos, 'sog')}{cell('H', pos, 'g', 2)}{cell('H', pos, 'iscf')}
                {cell('A', pos, 'sog')}{cell('A', pos, 'g', 2)}{cell('A', pos, 'iscf')}
                <td className={rankClass(lr.sog, n)}>{l?.gp ? num(l.sog) : '—'}{lr.sog ? <i>#{lr.sog}</i> : null}</td>
                <td className={rankClass(lr.g, n)}>{l?.gp ? num(l.g, 2) : '—'}{lr.g ? <i>#{lr.g}</i> : null}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const byNumber = (a, b) => (a.number ?? 999) - (b.number ?? 999) || a.name.localeCompare(b.name);

// Collapsed sections render nothing, so a closed table doesn't re-render on every keystroke.
function Section({ title, children }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="nhlx-db-details" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{title}</summary>
      {open && children}
    </details>
  );
}

function DatabasePanel() {
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
  const [defense, setDefense] = useState(null);

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

  // The defense table is only needed once a team is picked; fetch it once.
  useEffect(() => {
    if (!team || defense) return;
    let live = true;
    fetch('/api/nhl/data/defense', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (live && j) setDefense(j); }).catch(() => {});
    return () => { live = false; };
  }, [team, defense]);

  const fetchMedia = async () => {
    setBusy(true);
    setMsg('Copying logos and player photos from the NHL…');
    try {
      const res = await fetch('/api/nhl/data/media', { method: 'POST' });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error);
      const r = j.result;
      setMsg(`Media: ${r.downloaded} files copied this run, ${r.remaining} still missing (${r.logos} logos, ${r.headshots} photos stored)${r.failed.length ? `; failed: ${r.failed.slice(0, 5).join(', ')}` : ''}.`);
    } catch (e) {
      setMsg(`Media copy failed: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

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

  const selected = teams.find((t) => t.abbrev === team) || null;
  // Roster rows grouped by position; excluded players stay listed (dimmed) so they can be re-included.
  const roster = useMemo(() => {
    if (!selected) return [];
    const buckets = Object.fromEntries(GROUPS.map((g) => [g, []]));
    for (const p of players) if (p.team === selected.abbrev && p.onRoster) buckets[GROUP_OF[p.pos] || 'Forwards'].push(p);
    return GROUPS.map((g) => [g, buckets[g].sort(byNumber)]).filter(([, rows]) => rows.length);
  }, [players, selected]);
  const leftOut = roster.reduce((n, [, rows]) => n + rows.filter((p) => p.excluded).length, 0);

  const onRoster = players.filter((p) => p.onRoster).length;
  const linkCands = useMemo(() => {
    const n = linkQ.trim().toLowerCase();
    if (n.length < 2) return [];
    return players.filter((p) => p.name.toLowerCase().includes(n)).slice(0, 8);
  }, [players, linkQ]);

  if (!db) {
    return <div className="nhlx-empty">{err || 'Loading the database…'}</div>;
  }

  const rowProps = { teams, editing, setEditing, saveOverride };

  return (
    <div className="nhlx-db">
      <div className="nhlx-db-teams" role="tablist" aria-label="Teams">
        {teams.map((t) => (
          <button
            type="button"
            key={t.abbrev}
            role="tab"
            aria-selected={team === t.abbrev}
            className={`nhlx-db-team${team === t.abbrev ? ' is-active' : ''}`}
            onClick={() => setTeam(team === t.abbrev ? '' : t.abbrev)}
          >
            <TeamLogo abbr={t.abbrev} size={34} />
            <span>
              <b>{t.name}</b>
              <small>{t.players} players</small>
            </span>
          </button>
        ))}
        {!teams.length && <div className="nhlx-empty">No teams yet. Open “Keep the database current” below and click “Update rosters now”.</div>}
      </div>

      {selected ? (
        <div className="nhlx-db-roster">
          <div className="nhlx-db-roster-head">
            <TeamLogo abbr={selected.abbrev} size={56} />
            <div>
              <h3 className="nhlx-db-roster-title">{selected.full || selected.name}</h3>
              <p className="nhlx-auto-meta">
                {selected.players} on roster
                {leftOut ? ` · ${leftOut} left out` : ''}
                {selected.preseasonDressed ? ` · ${selected.preseasonDressed} dressed in preseason` : ''}
                {` · ${selected.gamesStored} games stored`}
              </p>
            </div>
            <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setTeam('')}>All teams</button>
          </div>
          <TeamDefense abbr={selected.abbrev} defense={defense} />
          {roster.map(([label, rows]) => (
            <div key={label} className="nhlx-db-group">
              <h4 className="nhlx-db-h4">{label} <span>{rows.length}</span></h4>
              <div className="nhlx-db-table-wrap">
                <PlayerTable rows={rows} showTeam={false} {...rowProps} />
              </div>
            </div>
          ))}
          {!roster.length && <div className="nhlx-empty">No players stored for this team yet.</div>}
        </div>
      ) : (
        <p className="nhlx-auto-meta" style={{ marginTop: 18 }}>
          {teams.length} teams · {onRoster} players on rosters · {players.length - onRoster} other players seen. Pick a team above to see its roster.
        </p>
      )}

      <Section title="Search all players">
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
          <PlayerTable rows={filtered.slice(0, page * PAGE)} showTeam {...rowProps} />
          {filtered.length > page * PAGE && (
            <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" style={{ margin: '14px auto', display: 'flex' }} onClick={() => setPage((n) => n + 1)}>
              Show more
            </button>
          )}
        </div>
      </Section>

      <Section title="Keep the database current">
        <div className="nhlx-counters">
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
            <div className="nhlx-auto-sub">
              Rosters refresh every morning. Last update {fmt(db.lastRoster?.at)}; last game refresh {fmt(db.lastRefresh)}.
            </div>
            <div className="nhlx-auto-actions">
              <button type="button" className="nhlx-btn nhlx-btn-sm" disabled={busy} onClick={updateRosters}>Update rosters now</button>
              <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={busy} onClick={loadPreseason}>Update preseason games</button>
              <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={busy} onClick={rebuild} title="Recompute season indexes, defense rankings and PropFinder names from the stored source files">Rebuild indexes</button>
              <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={busy} onClick={fetchMedia} title="Copy team logos and player photos into Supabase so they never depend on the NHL's CDN">Fetch logos &amp; photos</button>
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
      </Section>
    </div>
  );
}

export default memo(DatabasePanel);
