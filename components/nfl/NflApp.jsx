'use client';

import { useCallback, useEffect, useState } from 'react';
import SiteHeader from '@/components/nhl/SiteHeader';
import SignOutButton from '@/components/nhl/SignOutButton';
import ThemeToggle from '@/components/nhl/ThemeToggle';
import SportNav from '@/components/site/SportNav';
import TabBar from '@/components/site/TabBar';
import { useHashTab } from '@/components/site/hash-tab';
import { weekLabel, shiftWeek } from '@/lib/nfl/week';
import Scorecard from '@/components/picks/Scorecard';
import NflBoard, { NflShuffle } from './NflBoard';
import NflSources from './NflSources';

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '');

const TABS = [
  ['board', 'Best plays'],
  ['shuffle', 'Shuffle'],
];
const TAB_KEYS = TABS.map(([key]) => key);

/**
 * The NFL page, two hash tabs over one week picker: Best plays (the week's board, the notes, the
 * scorecard and the data sources under it) and Shuffle (a bar per market over the week's players).
 */
export default function NflApp({ email }) {
  const [tab, mounted] = useHashTab(TAB_KEYS, 'board');
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

  // The week head, the same on both tabs: the week and its figures, the picker.
  const head = () => (
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
  );

  return (
    <>
      <SiteHeader sport="NFL" nav={<SportNav />} right={<><span className="nhlx-user">{email}</span><ThemeToggle /><SignOutButton /></>} />
      <main>
        <TabBar tabs={TABS} tab={tab} />

        <section className="nhlx-bench nhlx-tabpanel" id="board" role="tabpanel" aria-labelledby="tab-board" hidden={tab !== 'board'}>
          <div className="nhlx-wrap">
            <div className="nhlx-bench-head">
              <div>
                <span className="nhlx-eyebrow">NFL</span>
                <h1>This week&apos;s <span>best plays</span></h1>
                <p>Per game, four tables: touchdowns, passing, rushing and receiving. The chance is a hit-rate read against the line from PropFinder’s logs and the cheat sheets, shrunk toward the book’s price; the row greys when under the floor, greens or reds once the box score is in.</p>
              </div>
            </div>
            <section className="nhlx-pk" aria-label="The week’s picks">
              {head()}
              {err ? <div className="nhlx-alert">{err}</div> : null}
              {board ? <NflBoard board={board} /> : !err ? <div className="nhlx-empty">Loading the week…</div> : null}
            </section>
            {wk ? <Scorecard sport={{ api: '/api/nfl', kind: 'week', season: wk.season, to: wk.type === 3 ? 18 + wk.week : wk.week, label: 'NFL' }} /> : null}
            {wk ? <NflSources wk={wk} onChange={() => go(wk)} /> : null}
          </div>
        </section>

        <section className="nhlx-bench nhlx-tabpanel" id="shuffle" role="tabpanel" aria-labelledby="tab-shuffle" hidden={tab !== 'shuffle'}>
          <div className="nhlx-wrap">
            <div className="nhlx-bench-head">
              <div>
                <span className="nhlx-eyebrow">NFL</span>
                <h1>The <span>shuffle</span></h1>
                <p>Pick the chance and every player shows the highest line he clears at it, with the book’s rung there and its edge; or pick the line and the field falls away as the bar rises. Every player on the week’s slate with a PropFinder log.</p>
              </div>
            </div>
            <section className="nhlx-pk" aria-label="The week’s shuffle">
              {head()}
              {err ? <div className="nhlx-alert">{err}</div> : null}
              {mounted('shuffle') && wk ? (games.length ? <NflShuffle wk={wk} /> : board ? <div className="nhlx-empty">No games in this week.</div> : null) : null}
            </section>
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
