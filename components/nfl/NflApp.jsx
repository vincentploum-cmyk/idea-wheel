'use client';

import { useCallback, useEffect, useState } from 'react';
import SiteHeader from '@/components/nhl/SiteHeader';
import SignOutButton from '@/components/nhl/SignOutButton';
import ThemeToggle from '@/components/nhl/ThemeToggle';
import SportNav from '@/components/site/SportNav';
import TabBar from '@/components/site/TabBar';
import { useHashTab } from '@/components/site/hash-tab';
import { weekLabel, shiftWeek } from '@/lib/nfl/week';
import { NflMatchups, NflList, NflBigGames } from './NflBoards';
import NflSources from './NflSources';

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const MARKET_WORD = { pass_yds: 'pass yds', rush_yds: 'rush yds', rec_yds: 'rec yds', receptions: 'rec', anytime_td: 'TD' };
const moveText = (m) => (m.market === 'anytime_td' ? `${Math.round(m.from * 100)}% → ${Math.round(m.to * 100)}%` : `${m.from} → ${m.to}`);
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
  ['big', 'Big games'],
  ['sources', 'Data sources'],
];
const LIST_TABS = [['matchups', null], ['tds', 'td'], ['passing', 'passing'], ['receiving', 'receiving'], ['rushing', 'rushing'], ['big', 'big']];
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
  const [inj, setInj] = useState({ busy: false, msg: '', changes: null });

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
  // ESPN's injury feed read now (it is read every 20 minutes on its own while the week has a game to play): the board's
  // projections follow it (the out off the lists, their teammates' without splits and vacated lifts in), then the week
  // reloads and the head says who changed status and which projections moved.
  const pullInjuries = async () => {
    setInj({ busy: true, msg: '', changes: null });
    try {
      const res = await fetch(`/api/nfl/refresh?only=injuries&season=${wk.season}&week=${wk.week}&type=${wk.type}`, { method: 'POST', cache: 'no-store' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`);
      const c = j.changes?.counts || {};
      const read = j.injuries?.fetched ? `read ${fmtTime(j.injuries.fetchedAt)}, ${j.injuries.rows} listed league-wide` : 'not read again (the week is played, or ESPN did not answer): the stored copy stands';
      const what = c.status || c.moved
        ? [c.out ? `${c.out} now out` : null, c.dtd ? `${c.dtd} now questionable / doubtful` : null, c.back ? `${c.back} back in` : null, `${c.moved} projection${c.moved === 1 ? '' : 's'} moved`].filter(Boolean).join(' · ')
        : 'no change to the board';
      setInj({ busy: false, msg: `ESPN injuries ${read}: ${what}.`, changes: c.status || c.moved ? j.changes : null });
      go(wk);
    } catch (e) { setInj({ busy: false, msg: `Injuries: ${e.message}`, changes: null }); }
  };

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
          {board ? [`${games.length} game${games.length === 1 ? '' : 's'}`, span, finals ? `${finals} final` : null, src?.sheets?.length ? `${src.sheets.length} cheat sheet${src.sheets.length === 1 ? '' : 's'}` : 'no cheat sheet', src?.propfinder ? `PropFinder ${fmtDay(src.propfinder.at)} ${fmtTime(src.propfinder.at)}` : 'PropFinder not pulled', board.injuriesFetchedAt ? `injuries ${fmtTime(board.injuriesFetchedAt)}` : null, board.byes?.length ? `bye: ${board.byes.join(', ')}` : null].filter(Boolean).join(' · ') : ''}
        </div>
      </div>
      <div className="nhlx-auto-actions">
        <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !wk} onClick={() => go(shiftWeek(wk, -1))} aria-label="Previous week">‹</button>
        <span className="ir-nfl-weekpick">{wk ? weekLabel(wk) : ''}</span>
        <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !wk} onClick={() => go(shiftWeek(wk, 1))} aria-label="Next week">›</button>
        <button type="button" className="nhlx-btn nhlx-btn-sm" disabled={inj.busy || busy || !wk} onClick={pullInjuries} title="Read ESPN's injury report now and rebuild the projections on it (it is read every 20 minutes on its own while the week has a game to play)">{inj.busy ? 'Pulling…' : 'Pull injuries'}</button>
        <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={busy || !wk} onClick={() => go(wk)}>{busy ? 'Loading…' : 'Reload'}</button>
      </div>
    </div>
  );

  // What the last "Pull injuries" changed: who moved between In / DTD / Out, the projections that moved with them.
  const injNote = () => (inj.msg ? (
    <div className="nhlx-auto-msg">
      <p>{inj.msg}</p>
      {inj.changes ? (
        <details className="ir-nfl-injdiff">
          <summary>What changed</summary>
          {inj.changes.status.length ? (
            <ul>
              {inj.changes.status.map((s) => (
                <li key={`${s.team}|${s.name}`}><strong>{s.name}</strong> ({s.team}{s.pos ? ` ${s.pos}` : ''}): {s.from} → {s.to}{s.injury ? ` · ${s.injury}` : ''}{s.detail ? `, ${s.detail}` : ''}</li>
              ))}
            </ul>
          ) : null}
          {inj.changes.moved.length ? (
            <ul>
              {inj.changes.moved.slice(0, 15).map((m) => (
                <li key={`${m.team}|${m.name}|${m.market}`}>{m.name} ({m.team}) {MARKET_WORD[m.market] || m.market}: {moveText(m)}</li>
              ))}
              {inj.changes.moved.length > 15 ? <li>… and {inj.changes.moved.length - 15} more</li> : null}
            </ul>
          ) : null}
        </details>
      ) : null}
    </div>
  ) : null);

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
                {injNote()}
                {err ? <div className="nhlx-alert">{err}</div> : null}
                {mounted(key) ? (board ? (kind === 'big' ? <NflBigGames board={board} /> : kind ? <NflList board={board} kind={kind} /> : <NflMatchups board={board} />) : !err ? <div className="nhlx-empty">Loading the week…</div> : null) : null}
              </section>
            </div>
          </section>
        ))}

        <section className="nhlx-bench nhlx-tabpanel ir-nfl-panel" id="sources" role="tabpanel" aria-labelledby="tab-sources" hidden={tab !== 'sources'}>
          <div className="nhlx-wrap">
            <section className="nhlx-pk" aria-label="Data sources">
              {head()}
              {injNote()}
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
