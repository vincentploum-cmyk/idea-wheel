'use client';

import { useCallback, useEffect, useState } from 'react';
import SiteHeader from '@/components/nhl/SiteHeader';
import SignOutButton from '@/components/nhl/SignOutButton';
import ThemeToggle from '@/components/nhl/ThemeToggle';
import SportNav from '@/components/site/SportNav';
import Scorecard from '@/components/picks/Scorecard';
import NbaBoard from './NbaBoard';
import NbaSources from './NbaSources';

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '');

/** The NBA page: the night's board with its date picker (the shuffle on top of it), the notes, the scorecard and the data sources under it. */
export default function NbaApp({ email }) {
  const [date, setDate] = useState('');
  const [board, setBoard] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pull, setPull] = useState({ busy: false, msg: '' });

  // The fetch sets state only in its callbacks, so the first load can run from the effect.
  const load = useCallback((d) => fetch(`/api/nba/picks${d ? `?date=${d}` : ''}`, { cache: 'no-store' })
    .then(async (res) => { const j = await res.json(); if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`); return j; })
    .then((j) => { setBoard(j); setDate(j.date); })
    .catch((e) => setErr(`Couldn’t load the slate: ${e.message}`))
    .finally(() => setBusy(false)), []);
  useEffect(() => { load(''); }, [load]);
  const go = (d) => { setBusy(true); setErr(''); load(d); };
  // The PropFinder pull from the board head (the same call as under Data sources): lines, logs, defenses and depth charts for the night.
  const pullNow = async () => {
    setPull({ busy: true, msg: '' });
    try {
      const res = await fetch(`/api/nba/refresh?only=propfinder&date=${date}&force=1`, { method: 'POST', cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`);
      const p = j.propfinder || {};
      setPull({ busy: false, msg: p.ok ? `PropFinder: ${p.players} players, ${p.withProps} with lines, ${p.defenseTeams} defenses, ${p.depthCharts ?? 0} depth charts.` : `PropFinder: ${p.skipped || p.error || 'not pulled'}` });
      go(date);
    } catch (e) { setPull({ busy: false, msg: `PropFinder: ${e.message}` }); }
  };
  const shift = (n) => { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); go(d.toISOString().slice(0, 10)); };
  const pretty = date ? new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' }) : '';

  const games = board?.games || [];
  const finals = games.filter((g) => g.final).length;
  const src = board?.sources;

  return (
    <>
      <SiteHeader sport="NBA" nav={<SportNav />} right={<><span className="nhlx-user">{email}</span><ThemeToggle /><SignOutButton /></>} />
      <main>
        <section className="nhlx-bench">
          <div className="nhlx-wrap">
            <div className="nhlx-bench-head">
              <div>
                <span className="nhlx-eyebrow">NBA</span>
                <h1>Tonight&apos;s <span>best plays</span></h1>
                <p>Per game, five tables: points, rebounds, assists, threes, and the combos. The chance is a hit-rate read against the line from PropFinder’s logs and the cheat sheets, shrunk toward the book’s price; the row greys when under the floor, greens or reds once the box score is in.</p>
              </div>
            </div>
            <section className="nhlx-pk" aria-label="Tonight’s picks">
              <div className="nhlx-today-head">
                <div>
                  <div className="nhlx-today-date">{pretty || 'Loading…'}</div>
                  <div className="nhlx-auto-sub">
                    {board ? [`${games.length} game${games.length === 1 ? '' : 's'}`, finals ? `${finals} final` : null, `${board.plays} play${board.plays === 1 ? '' : 's'}`, src?.sheets?.length ? `${src.sheets.length} cheat sheet${src.sheets.length === 1 ? '' : 's'}` : 'no cheat sheet', src?.propfinder ? `PropFinder ${fmtDay(src.propfinder.at)} ${fmtTime(src.propfinder.at)}` : 'PropFinder not pulled'].filter(Boolean).join(' · ') : ''}
                  </div>
                </div>
                <div className="nhlx-auto-actions">
                  <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !date} onClick={() => shift(-1)} aria-label="Previous day">‹</button>
                  <input type="date" className="nhlx-input nhlx-input-sm" value={date} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Slate date" />
                  <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !date} onClick={() => shift(1)} aria-label="Next day">›</button>
                  <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={busy || !date} onClick={() => go(date)}>{busy ? 'Loading…' : 'Reload'}</button>
                  <button type="button" className="nhlx-btn nhlx-btn-sm" disabled={pull.busy || busy || !date} onClick={pullNow} title="Pull tonight's lines, logs, defense tables and depth charts from PropFinder now (the scheduled run does it at 9:47 AM and 5:23 PM ET)">{pull.busy ? 'Pulling…' : 'Pull PropFinder'}</button>
                </div>
              </div>
              {pull.msg ? <p className="nhlx-auto-msg">{pull.msg}</p> : null}
              {err ? <div className="nhlx-alert">{err}</div> : null}
              {board ? <NbaBoard board={board} /> : !err ? <div className="nhlx-empty">Loading the slate…</div> : null}
            </section>
            {date ? <Scorecard sport={{ api: '/api/nba', kind: 'date', to: date, label: 'NBA' }} /> : null}
            {date ? <NbaSources date={date} onChange={() => go(date)} /> : null}
          </div>
        </section>
      </main>
      <footer className="nhlx-footer">
        <div className="nhlx-wrap">
          <span>ideareels · NBA picks</span>
          <span>Schedule and box scores from ESPN · lines and logs from PropFinder · cheat sheets stored in Supabase Storage</span>
        </div>
      </footer>
    </>
  );
}
