'use client';

import { useCallback, useEffect, useState } from 'react';
import SiteHeader from '@/components/nhl/SiteHeader';
import SignOutButton from '@/components/nhl/SignOutButton';
import ThemeToggle from '@/components/nhl/ThemeToggle';
import SportNav from '@/components/site/SportNav';
import TabBar from '@/components/site/TabBar';
import { useHashTab } from '@/components/site/hash-tab';
import { weekLabel, shiftWeek } from '@/lib/nfl/week';
import { NflMatchups, NflList } from './NflBoards';
import NflSources from './NflSources';

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '');

// Vincent, 2026-11-01: "way too complicated … I just need a simple list of games and per game, players listed with their
// ladders": the games first, the same lists across the week, the data sources last. The Best plays board (EV, juice, the
// floors) and the shuffle are off the NFL page; their routes and components stay.
// The tabs as pills, a sportsbook's games page the form (Vincent, the same day).
const TABS = [
  ['matchups', 'Games'],
  ['tds', 'TDs'],
  ['passing', 'Pass Yards'],
  ['receiving', 'Receiving Yards'],
  ['rushing', 'Rushing Yards'],
  ['sources', 'Data sources'],
];
const LIST_TABS = [['matchups', null], ['tds', 'td'], ['passing', 'passing'], ['receiving', 'receiving'], ['rushing', 'rushing']];
const TAB_KEYS = TABS.map(([key]) => key);

/**
 * The NFL page, six hash tabs over one week picker: Games (the week's games, each opening on its TDs, pass, receiving and
 * rushing lists), the same four lists across the week (lib/nfl/projections.js) and Data sources (the cheat sheets, the pulls).
 */
export default function NflApp({ email }) {
  const [tab, mounted] = useHashTab(TAB_KEYS, 'matchups');
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
          {board ? [`${games.length} game${games.length === 1 ? '' : 's'}`, span, finals ? `${finals} final` : null, src?.sheets?.length ? `${src.sheets.length} cheat sheet${src.sheets.length === 1 ? '' : 's'}` : 'no cheat sheet', src?.propfinder ? `PropFinder ${fmtDay(src.propfinder.at)} ${fmtTime(src.propfinder.at)}` : 'PropFinder not pulled', board.byes?.length ? `bye: ${board.byes.join(', ')}` : null].filter(Boolean).join(' · ') : ''}
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
        <TabBar tabs={TABS} tab={tab} pills />

        {LIST_TABS.map(([key, kind]) => (
          <section key={key} className="nhlx-bench nhlx-tabpanel ir-nfl-panel" id={key} role="tabpanel" aria-labelledby={`tab-${key}`} hidden={tab !== key}>
            <div className="nhlx-wrap">
              <section className="nhlx-pk" aria-label={TABS.find(([k]) => k === key)[1]}>
                {head()}
                {err ? <div className="nhlx-alert">{err}</div> : null}
                {mounted(key) ? (board ? (kind ? <NflList board={board} kind={kind} /> : <NflMatchups board={board} />) : !err ? <div className="nhlx-empty">Loading the week…</div> : null) : null}
              </section>
            </div>
          </section>
        ))}

        <section className="nhlx-bench nhlx-tabpanel ir-nfl-panel" id="sources" role="tabpanel" aria-labelledby="tab-sources" hidden={tab !== 'sources'}>
          <div className="nhlx-wrap">
            <section className="nhlx-pk" aria-label="Data sources">
              {head()}
              {err ? <div className="nhlx-alert">{err}</div> : null}
              {wk ? <NflSources wk={wk} onChange={() => go(wk)} /> : null}
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
