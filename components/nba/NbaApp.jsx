'use client';

import { useCallback, useEffect, useState } from 'react';
import SiteHeader from '@/components/nhl/SiteHeader';
import SignOutButton from '@/components/nhl/SignOutButton';
import ThemeToggle from '@/components/nhl/ThemeToggle';
import SportNav from '@/components/site/SportNav';
import NbaBoard from './NbaBoard';
import NbaSources from './NbaSources';

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '');

/** The NBA page: the night's board with its date picker, the notes, and the data sources under it. */
export default function NbaApp({ email }) {
  const [date, setDate] = useState('');
  const [board, setBoard] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // The fetch sets state only in its callbacks, so the first load can run from the effect.
  const load = useCallback((d) => fetch(`/api/nba/picks${d ? `?date=${d}` : ''}`, { cache: 'no-store' })
    .then(async (res) => { const j = await res.json(); if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`); return j; })
    .then((j) => { setBoard(j); setDate(j.date); })
    .catch((e) => setErr(`Couldn’t load the slate: ${e.message}`))
    .finally(() => setBusy(false)), []);
  useEffect(() => { load(''); }, [load]);
  const go = (d) => { setBusy(true); setErr(''); load(d); };
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
                </div>
              </div>
              {err ? <div className="nhlx-alert">{err}</div> : null}
              {board ? <NbaBoard board={board} /> : !err ? <div className="nhlx-empty">Loading the slate…</div> : null}
            </section>
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
