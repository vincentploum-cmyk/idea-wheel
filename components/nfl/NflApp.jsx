'use client';

import { useCallback, useEffect, useState } from 'react';
import SiteHeader from '@/components/nhl/SiteHeader';
import SignOutButton from '@/components/nhl/SignOutButton';
import ThemeToggle from '@/components/nhl/ThemeToggle';
import SportNav from '@/components/site/SportNav';
import { weekLabel, shiftWeek } from '@/lib/nfl/week';
import NflBoard from './NflBoard';
import NflSources from './NflSources';

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '');

/** The NFL page: the week's board with its week picker, the notes, and the data sources under it. */
export default function NflApp({ email }) {
  const [wk, setWk] = useState(null);     // { season, week, type }
  const [board, setBoard] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // The fetch sets state only in its callbacks, so the first load can run from the effect.
  const load = useCallback((w) => {
    const q = w ? `?season=${w.season}&week=${w.week}&type=${w.type}` : '';
    return fetch(`/api/nfl/picks${q}`, { cache: 'no-store' })
      .then(async (res) => { const j = await res.json(); if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`); return j; })
      .then((j) => { setBoard(j); setWk({ season: j.season, week: j.week, type: j.type }); })
      .catch((e) => setErr(`Couldn’t load the week: ${e.message}`))
      .finally(() => setBusy(false));
  }, []);
  useEffect(() => { load(null); }, [load]);
  const go = (w) => { setBusy(true); setErr(''); load(w); };

  const games = board?.games || [];
  const span = games.length ? `${fmtDay(games[0].date)} – ${fmtDay(games[games.length - 1].date)}` : '';
  const finals = games.filter((g) => g.final).length;
  const src = board?.sources;

  return (
    <>
      <SiteHeader sport="NFL" nav={<SportNav />} right={<><span className="nhlx-user">{email}</span><ThemeToggle /><SignOutButton /></>} />
      <main>
        <section className="nhlx-bench">
          <div className="nhlx-wrap">
            <div className="nhlx-bench-head">
              <div>
                <span className="nhlx-eyebrow">NFL</span>
                <h1>This week&apos;s <span>best plays</span></h1>
                <p>Per game, four tables: touchdowns, passing, rushing and receiving. The chance is a hit-rate read against the line from PropFinder’s logs and the cheat sheets, shrunk toward the book’s price; the row greys when under the floor, greens or reds once the box score is in.</p>
              </div>
            </div>
            <section className="nhlx-pk" aria-label="The week’s picks">
              <div className="nhlx-today-head">
                <div>
                  <div className="nhlx-today-date">{wk ? `${weekLabel(wk)} · ${wk.season}` : 'Loading…'}</div>
                  <div className="nhlx-auto-sub">
                    {board ? [`${games.length} game${games.length === 1 ? '' : 's'}`, span, finals ? `${finals} final` : null, `${board.plays} play${board.plays === 1 ? '' : 's'}`, src?.sheets?.length ? `${src.sheets.length} cheat sheet${src.sheets.length === 1 ? '' : 's'}` : 'no cheat sheet', src?.propfinder ? `PropFinder ${fmtDay(src.propfinder.at)} ${fmtTime(src.propfinder.at)}` : 'PropFinder not pulled', board.byes?.length ? `bye: ${board.byes.join(', ')}` : null].filter(Boolean).join(' · ') : ''}
                  </div>
                </div>
                <div className="nhlx-auto-actions">
                  <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !wk} onClick={() => go(shiftWeek(wk, -1))} aria-label="Previous week">‹</button>
                  <span className="ir-nfl-weekpick">{wk ? weekLabel(wk) : ''}</span>
                  <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !wk} onClick={() => go(shiftWeek(wk, 1))} aria-label="Next week">›</button>
                  <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={busy || !wk} onClick={() => go(wk)}>{busy ? 'Loading…' : 'Reload'}</button>
                </div>
              </div>
              {err ? <div className="nhlx-alert">{err}</div> : null}
              {board ? <NflBoard board={board} /> : !err ? <div className="nhlx-empty">Loading the week…</div> : null}
            </section>
            {wk ? <NflSources wk={wk} onChange={() => go(wk)} /> : null}
          </div>
        </section>
      </main>
      <footer className="nhlx-footer">
        <div className="nhlx-wrap">
          <span>ideareels · NFL picks</span>
          <span>Schedule and box scores from ESPN · lines and logs from PropFinder · cheat sheets stored in Supabase Storage</span>
        </div>
      </footer>
    </>
  );
}
