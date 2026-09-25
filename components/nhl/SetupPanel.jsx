'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
const n = (v) => Number(v || 0).toLocaleString();

async function post(url) {
  const res = await fetch(url, { method: 'POST' });
  const text = await res.text();
  let j = {};
  try { j = JSON.parse(text); } catch {}
  if (!res.ok || j.ok === false) throw new Error(j.error || j.detail || `${res.status} ${res.statusText}${text && !text.startsWith('<') ? ` · ${text.slice(0, 160)}` : ' (no details came back from the server)'}`);
  return j;
}

function dates(from, to) {
  const out = [];
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10));
  return out;
}

function Step({ num, title, done, running, optional, children }) {
  const cls = done ? ' is-done' : running ? ' is-running' : '';
  return (
    <li className={`nhlx-setup-step${cls}`}>
      <span className="nhlx-gd-num" aria-hidden>{done ? '✓' : num}</span>
      <div>
        <div className="nhlx-gd-title">{title}{optional ? <em>optional</em> : done ? <em className="is-ok">done</em> : <em className="is-todo">to do</em>}</div>
        {children}
      </div>
    </li>
  );
}

export default function SetupPanel({ onStatus, initial = null }) {
  const [s, setS] = useState(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const [log, setLog] = useState({});
  const cancel = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/nhl/data/setup', { cache: 'no-store' });
      if (!res.ok) throw new Error(`${res.status}`);
      const j = await res.json();
      setS(j);
      setErr('');
      onStatus?.(j);
    } catch (e) {
      setErr(`Couldn’t check the setup: ${e.message}`);
    }
  }, [onStatus]);
  useEffect(() => { if (!initial) load(); }, [load, initial]);

  const say = (k, text) => setLog((l) => ({ ...l, [k]: text }));
  const run = async (k, fn) => {
    setBusy(k);
    cancel.current = false;
    try { await fn(); } catch (e) { say(k, `Failed: ${e.message}`); }
    setBusy('');
    load();
  };

  const rosters = () => run('rosters', async () => {
    say('rosters', 'Pulling all 32 rosters from the NHL…');
    const j = await post('/api/nhl/data/rosters');
    say('rosters', `Done: ${j.result.teams} teams, ${j.result.players} players${j.result.failed?.length ? `; failed: ${j.result.failed.join(', ')}` : ''}.`);
  });

  const media = () => run('media', async () => {
    let total = 0;
    for (let i = 0; i < 12 && !cancel.current; i++) {
      say('media', `Copying logos and photos… ${n(total)} so far`);
      const j = await post('/api/nhl/data/media');
      total += j.result.downloaded;
      if (j.result.remaining === 0 || j.result.downloaded === 0) { say('media', `Done: ${n(j.result.logos)} logos, ${n(j.result.headshots)} photos stored${j.result.remaining ? `, ${j.result.remaining} could not be fetched` : ''}.`); return; }
    }
    say('media', `Copied ${n(total)} files; click again for the rest.`);
  });

  const history = (range, key) => run('history', async () => {
    const list = dates(range.from, range.to);
    let games = 0;
    for (let i = 0; i < list.length; i++) {
      if (cancel.current) { say('history', `Stopped at ${list[i]} · ${n(games)} games added. Click again to continue; loaded days are skipped.`); return; }
      say('history', `Loading ${key} games… ${list[i]} (${i + 1}/${list.length}) · ${n(games)} new so far`);
      try {
        const j = await post(`/api/nhl/data/backfill?date=${list[i]}&lineups=0`);
        games += j.result?.ingested || 0;
      } catch (e) { /* a bad day never stops the season */ }
    }
    say('history', `Done: ${n(games)} new games added for ${key}.`);
  });

  const league = () => run('league', async () => {
    say('league', 'Refreshing standings and leaders…');
    const res = await fetch('/api/nhl/data/league?refresh=1', { cache: 'no-store' });
    const j = await res.json();
    if (j.refreshed?.error) throw new Error(j.refreshed.error);
    say('league', `Done: ${j.conferences.reduce((c, x) => c + x.divisions.reduce((d, y) => d + y.teams.length, 0), 0)} teams, leaders updated.`);
  });

  const moneypuck = (games) => run('moneypuck', async () => {
    say('moneypuck', games ? 'Pulling MoneyPuck season summary and all 32 game logs…' : 'Pulling the MoneyPuck season summary…');
    const j = await post(`/api/nhl/data/moneypuck${games ? '?games=1' : ''}`);
    say('moneypuck', `Done: ${j.result.teams} teams${j.result.gameRows != null ? `, ${j.result.gameRows} game rows for home/away splits` : ''}${j.result.failed?.length ? `; failed: ${j.result.failed.join(', ')}` : ''}.`);
  });

  const today = () => run('today', async () => {
    say('today', 'Pulling today’s lineups, yesterday’s results and freezing positions…');
    const j = await post(`/api/nhl/data/refresh?date=${s.today}`);
    const l = j.result?.lineups;
    say('today', `Done: ${l?.withLineups ?? 0}/${l?.scheduled ?? 0} games have a projected lineup${l?.positions ? `, ${l.positions.games} position snapshots` : ''}.`);
  });

  const upload = (fileList) => run('propfinder', async () => {
    const files = [...fileList].filter((f) => /\.xlsx$/i.test(f.name));
    if (!files.length) throw new Error('no .xlsx files selected');
    const form = new FormData();
    form.append('date', s.today);
    files.forEach((f) => form.append('file', f, f.name));
    const res = await fetch('/api/nhl/data/matchups', { method: 'POST', body: form });
    const j = await res.json();
    const good = (j.results || []).filter((r) => !r.error);
    const bad = (j.results || []).filter((r) => r.error);
    if (!good.length) throw new Error(bad[0]?.error || 'upload failed');
    say('propfinder', `Stored ${good.map((r) => `${r.kind} (${r.file})`).join(', ')}${bad.length ? `; skipped ${bad.map((b) => b.file).join(', ')}` : ''}.`);
  });

  if (!s) return <div className="nhlx-empty">{err || 'Checking what is already synced…'}</div>;
  const st = s.steps;
  const H = st.history;

  return (
    <div className="nhlx-setup">
      <div className={`nhlx-complete ${s.complete ? 'is-ok' : 'is-warn'}`} role="status">
        <b>{s.complete ? 'Everything is synced' : `${s.remaining.length} step${s.remaining.length === 1 ? '' : 's'} left`}</b>
        <span>{s.complete ? ' · open Matchups for tonight, or Best bets to run the model.' : ' · work down the list; each step checks itself when it finishes.'}</span>
        {s.complete && <a className="nhlx-btn nhlx-btn-sm" href="#matchups">Open Matchups →</a>}
      </div>
      {err && <div className="nhlx-alert">⚠ {err}</div>}

      <ol className="nhlx-gd nhlx-setup-list">
        <Step num={1} title="Rosters" done={st.rosters.done} running={busy === 'rosters'}>
          <p className="nhlx-auto-meta">
            {st.rosters.teams ? `${st.rosters.teams} teams, ${n(st.rosters.players)} players · last update ${fmt(st.rosters.at)}.` : 'Nothing loaded yet.'}
            {st.rosters.incomplete.length ? ` Incomplete: ${st.rosters.incomplete.join(', ')} (fewer than 12 F / 6 D / 2 G).` : ''}
            {st.rosters.failed.length ? ` Last fetch failed for ${st.rosters.failed.join(', ')}.` : ''}
            {' '}Rosters also refresh every morning by themselves.
          </p>
          <div className="nhlx-auto-actions">
            <button type="button" className="nhlx-btn nhlx-btn-sm" disabled={!!busy} onClick={rosters}>{st.rosters.teams ? 'Update rosters now' : 'Load all 32 rosters'}</button>
            {st.rosters.incomplete.length > 0 && <a className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" href="#teams">Fix in Teams &amp; players</a>}
          </div>
          {log.rosters && <p className="nhlx-auto-msg">{log.rosters}</p>}
        </Step>

        <Step num={2} title="Logos & photos" done={st.media.done} running={busy === 'media'}>
          <p className="nhlx-auto-meta">
            {n(st.media.logos)} logos and {n(st.media.headshots)} player photos stored
            {st.media.remaining != null ? `, ${n(st.media.remaining)} still to copy` : ''}. Copied from the NHL into Supabase so they never go missing; 300 per click.
          </p>
          <div className="nhlx-auto-actions">
            <button type="button" className="nhlx-btn nhlx-btn-sm" disabled={!!busy || st.media.done} onClick={media}>Copy missing logos &amp; photos</button>
            {busy === 'media' && <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={() => { cancel.current = true; }}>Stop</button>}
          </div>
          {log.media && <p className="nhlx-auto-msg">{log.media}</p>}
        </Step>

        <Step num={3} title="Game history" done={st.history.done} running={busy === 'history'}>
          <p className="nhlx-auto-meta">
            Every finished game becomes the per-player and defense-by-position history behind Matchups and the player cards.
            {' '}<b>{H.previous.season.slice(0, 4)}-{H.previous.season.slice(6)}:</b> {n(H.previous.games)} games{H.previous.last ? ` through ${H.previous.last}` : ''} (a full season is ~1,312).
            {' '}<b>{H.current.season.slice(0, 4)}-{H.current.season.slice(6)}:</b> {n(H.current.games)} games{H.current.last ? ` through ${H.current.last}` : ''}.
            {' '}Loading a season walks one day at a time (about 20–30 minutes); you can stop and continue later, loaded days are skipped.
          </p>
          <div className="nhlx-auto-actions">
            <button type="button" className="nhlx-btn nhlx-btn-sm" disabled={!!busy} onClick={() => history(H.previous, `${H.previous.season.slice(0, 4)}-${H.previous.season.slice(6)}`)}>Load last season</button>
            <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={!!busy} onClick={() => history(H.current, 'this season')}>Load this season so far</button>
            {busy === 'history' && <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" onClick={() => { cancel.current = true; }}>Stop</button>}
          </div>
          {log.history && <p className="nhlx-auto-msg">{log.history}</p>}
        </Step>

        <Step num={4} title="League tables" done={st.league.done} running={busy === 'league'}>
          <p className="nhlx-auto-meta">Standings and scoring leaders from the NHL · {st.league.teams ? `${st.league.teams} teams, updated ${fmt(st.league.updatedAt)}` : 'not loaded yet'}. Refreshes with the morning run.</p>
          <div className="nhlx-auto-actions"><button type="button" className="nhlx-btn nhlx-btn-sm" disabled={!!busy} onClick={league}>Refresh from the NHL</button></div>
          {log.league && <p className="nhlx-auto-msg">{log.league}</p>}
        </Step>

        <Step num={5} title="MoneyPuck team data" done={st.moneypuck.done} running={busy === 'moneypuck'}>
          <p className="nhlx-auto-meta">
            Expected goals, shot quality and possession per team and situation from MoneyPuck.com, shown on team pages, Matchups and League.
            {' '}{st.moneypuck.teams ? `${st.moneypuck.teams} teams for ${st.moneypuck.year}-${String((st.moneypuck.year || 0) + 1).slice(2)}, updated ${fmt(st.moneypuck.updatedAt)}.` : 'Not loaded yet.'}
            {' '}{st.moneypuck.splits ? `Home/away splits from ${n(st.moneypuck.splits.rows)} game rows, ${fmt(st.moneypuck.splits.updatedAt)}.` : 'No home/away splits yet.'}
            {' '}The summary refreshes every morning; the game logs every Sunday.
          </p>
          <div className="nhlx-auto-actions">
            <button type="button" className="nhlx-btn nhlx-btn-sm" disabled={!!busy} onClick={() => moneypuck(false)}>Load team data</button>
            <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={!!busy} onClick={() => moneypuck(true)}>Load with home/away splits</button>
          </div>
          {log.moneypuck && <p className="nhlx-auto-msg">{log.moneypuck}</p>}
        </Step>

        <Step num={6} title={`Today’s NHL data (${s.today})`} done={st.today.done} running={busy === 'today'}>
          <p className="nhlx-auto-meta">
            {st.today.games === 0 ? 'No NHL games today, nothing to load.'
              : `${st.today.games} game${st.today.games === 1 ? '' : 's'} today · ${st.today.withLineup} with a projected lineup · ${st.today.frozen} with positions frozen.`}
            {st.today.lastRefresh ? ` Last automatic refresh ${fmt(st.today.lastRefresh)}.` : ''}
            {' '}Runs by itself at 9:00, 13:00 and 17:30 ET; NHL.com posts lineups on game-day morning.
          </p>
          <div className="nhlx-auto-actions"><button type="button" className="nhlx-btn nhlx-btn-sm" disabled={!!busy || st.today.games === 0} onClick={today}>Refresh today’s NHL data</button></div>
          {log.today && <p className="nhlx-auto-msg">{log.today}</p>}
        </Step>

        <Step num={7} title="Today’s PropFinder files" done={st.propfinder.done} running={busy === 'propfinder'}>
          <p className="nhlx-auto-meta">
            {st.propfinder.games === 0 ? 'No games today.' : <>
              The one thing you upload: PropFinder’s <b>Season</b> and <b>Last 5</b> exports for today (<code>NHL-Goal-Matchups-{s.today}.xlsx</code>).
              {' '}Season: {st.propfinder.season ? `✓ ${st.propfinder.season.name}` : 'missing'} · L5: {st.propfinder.l5 ? `✓ ${st.propfinder.l5.name}` : 'missing'}.
              {' '}Once both are in, Best bets runs the model by itself.
            </>}
          </p>
          {st.propfinder.games > 0 && (
            <div className="nhlx-auto-actions">
              <label className="nhlx-btn nhlx-btn-sm" style={{ cursor: 'pointer' }}>
                {st.propfinder.done ? 'Replace a file' : 'Choose the two .xlsx files'}
                <input type="file" multiple accept=".xlsx" style={{ display: 'none' }} disabled={!!busy} onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
              </label>
              <a className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" href="#model">Open Best bets</a>
            </div>
          )}
          {log.propfinder && <p className="nhlx-auto-msg">{log.propfinder}</p>}
        </Step>

        <Step num={8} title="Mac folder sync" done={st.sync.done} optional>
          <p className="nhlx-auto-meta">
            {st.sync.done ? `Token created ${fmt(st.sync.createdAt)}: files saved in Desktop/NHL on your Mac upload themselves.` : 'Skip the upload step on game days: create a sync token under Best bets → Data sources, and files saved in Desktop/NHL upload themselves.'}
          </p>
          <div className="nhlx-auto-actions"><a className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" href="#model">Open Best bets → Data sources</a></div>
        </Step>
      </ol>
    </div>
  );
}
