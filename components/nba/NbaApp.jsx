'use client';

import { useCallback, useEffect, useState } from 'react';
import SiteHeader from '@/components/nhl/SiteHeader';
import SignOutButton from '@/components/nhl/SignOutButton';
import ThemeToggle from '@/components/nhl/ThemeToggle';
import SportNav from '@/components/site/SportNav';
import TabBar from '@/components/site/TabBar';
import { useHashTab } from '@/components/site/hash-tab';
import NbaSources from './NbaSources';
import NbaSearch from './NbaSearch';
import NbaFirstBasket from './NbaFirstBasket';
import NbaBigGames from './NbaBigGames';
import { NbaGames, NbaStatList, useNbaShuffles } from './NbaGames';

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '');

// The NBA page laid out as the NFL's (Vincent, 2026-11-01: "for nba, I need the same layout as nfl with as addition the
// propfinder tables for each game when clicking on the game"): plain tabs drawn as pills — the games first, each opening
// on PropFinder's tables and its players' ladders, the same lists across the night per stat, the big games, the first
// basket and the data sources. The Best plays board (EV, juice, the floors), the Boards, the Cheat sheet and the Shuffle
// tabs are off the page; their components and routes stay, and an old #board / #shuffle link opens Games.
const TABS = [
  ['matchups', 'Games'],
  ['pts', 'Points'],
  ['reb', 'Rebounds'],
  ['ast', 'Assists'],
  ['tpm', 'Threes'],
  ['pra', 'PRA'],
  ['big', 'Big games'],
  ['firstbasket', 'First basket'],
  ['sources', 'Data sources'],
];
const STAT_TABS = ['pts', 'reb', 'ast', 'tpm', 'pra'];
const TAB_KEYS = TABS.map(([key]) => key);

/**
 * The NBA page, pill tabs over one date picker: Games (the night's games, each opening on PropFinder's tables for both
 * teams and the players' ladders per stat), the same ladders across the night per stat, Big games, First basket and
 * Data sources (the cheat sheets, the pulls).
 */
export default function NbaApp({ email }) {
  const [tab, mounted] = useHashTab(TAB_KEYS, 'matchups');
  const [date, setDate] = useState('');
  const [board, setBoard] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [pull, setPull] = useState({ busy: false, msg: '' });
  const [gameId, setGameId] = useState('');   // the game picked in the head's dropdown ('' = every game; Vincent, 2026-10-31)

  // The fetch sets state only in its callbacks, so the first load can run from the effect.
  const load = useCallback((d) => fetch(`/api/nba/picks${d ? `?date=${d}` : ''}`, { cache: 'no-store' })
    .then(async (res) => { const j = await res.json(); if (!res.ok) throw new Error(j.detail || j.error || `${res.status}`); return j; })
    .then((j) => { setBoard(j); setDate(j.date); setGameId((cur) => (cur && (j.games || []).some((g) => g.id === cur) ? cur : '')); })
    .catch((e) => setErr(`Couldn’t load the slate: ${e.message}`))
    .finally(() => setBusy(false)), []);
  useEffect(() => { load(''); }, [load]);
  // An injury override set on a card (POST /api/nba/injuries): the board reads the pull through it, so reload the day.
  useEffect(() => {
    const onMark = (e) => { const d = e.detail?.date || date; if (d) load(d); };
    window.addEventListener('nba:injury-override', onMark);
    return () => window.removeEventListener('nba:injury-override', onMark);
  }, [load, date]);
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

  // The slate's shuffle per stat, read once a night and shared by Games and the stat tabs (the ladders' round marks).
  const shuffles = useNbaShuffles(board?.games?.length ? date : null);
  const games = board?.games || [];
  const finals = games.filter((g) => g.final).length;
  const src = board?.sources;

  // The slate head, the same on every tab: the date and its figures, the picker, the PropFinder pull; on the board
  // the game dropdown first (the Matchups tab's `nhlx-mu-gamepick`; Vincent, 2026-10-31: "I need to be able to
  // select the games from a dropdown on top of the screen"), a pick showing that game alone with its plays.
  const head = ({ games: withGames = false } = {}) => (
    <div className="nhlx-today-head">
      <div>
        <div className="nhlx-today-date">{pretty || 'Loading…'}</div>
        <div className="nhlx-auto-sub">
          {board ? [`${games.length} game${games.length === 1 ? '' : 's'}`, finals ? `${finals} final` : null, src?.sheets?.length ? `${src.sheets.length} cheat sheet${src.sheets.length === 1 ? '' : 's'}` : 'no cheat sheet', src?.propfinder ? `PropFinder ${fmtDay(src.propfinder.at)} ${fmtTime(src.propfinder.at)}` : 'PropFinder not pulled'].filter(Boolean).join(' · ') : ''}
        </div>
      </div>
      <div className="nhlx-auto-actions">
        {/* Search a player on the slate (Vincent, 2026-11-01): a pick opens his card. */}
        {board ? <NbaSearch board={board} /> : null}
        {withGames ? (
          <select className="nhlx-input nhlx-input-sm nhlx-mu-gamepick" value={gameId} onChange={(e) => { setGameId(e.target.value); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-label="Game" disabled={!games.length}>
            <option value="">All games{games.length ? ` (${games.length})` : ''}</option>
            {games.map((g) => (
              <option key={g.id} value={String(g.id)}>{g.away} @ {g.home}{g.final ? ` · final ${g.awayScore}–${g.homeScore}` : g.state === 'in' ? ` · live ${g.awayScore}–${g.homeScore}` : g.date ? ` · ${fmtTime(g.date)}` : ''}</option>
            ))}
          </select>
        ) : null}
        <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !date} onClick={() => shift(-1)} aria-label="Previous day">‹</button>
        <input type="date" className="nhlx-input nhlx-input-sm" value={date} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Slate date" />
        <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm nhlx-btn-icon" disabled={busy || !date} onClick={() => shift(1)} aria-label="Next day">›</button>
        <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm" disabled={busy || !date} onClick={() => go(date)}>{busy ? 'Loading…' : 'Reload'}</button>
        <button type="button" className="nhlx-btn nhlx-btn-sm" disabled={pull.busy || busy || !date} onClick={pullNow} title="Pull tonight's lines, logs, defense tables and depth charts from PropFinder now (the scheduled run does it at 9:47 AM and 5:23 PM ET)">{pull.busy ? 'Pulling…' : 'Pull PropFinder'}</button>
      </div>
    </div>
  );

  return (
    <>
      <SiteHeader sport="NBA" nav={<SportNav />} right={<><span className="nhlx-user">{email}</span><ThemeToggle /><SignOutButton /></>} />
      <main>
        <TabBar tabs={TABS} tab={tab} pills />

        <section className="nhlx-bench nhlx-tabpanel ir-nfl-panel" id="matchups" role="tabpanel" aria-labelledby="tab-matchups" hidden={tab !== 'matchups'}>
          <div className="nhlx-wrap">
            <section className="nhlx-pk" aria-label="Games">
              {head()}
              {pull.msg ? <p className="nhlx-auto-msg">{pull.msg}</p> : null}
              {err ? <div className="nhlx-alert">{err}</div> : null}
              {board ? <NbaGames board={board} shuffles={shuffles} /> : !err ? <div className="nhlx-empty">Loading the slate…</div> : null}
            </section>
          </div>
        </section>

        {STAT_TABS.map((key) => (
          <section key={key} className="nhlx-bench nhlx-tabpanel ir-nfl-panel" id={key} role="tabpanel" aria-labelledby={`tab-${key}`} hidden={tab !== key}>
            <div className="nhlx-wrap">
              <section className="nhlx-pk" aria-label={TABS.find(([k]) => k === key)[1]}>
                {head()}
                {pull.msg ? <p className="nhlx-auto-msg">{pull.msg}</p> : null}
                {err ? <div className="nhlx-alert">{err}</div> : null}
                {mounted(key) ? (board ? <NbaStatList board={board} shuffles={shuffles} market={key} /> : !err ? <div className="nhlx-empty">Loading the slate…</div> : null) : null}
              </section>
            </div>
          </section>
        ))}

        <section className="nhlx-bench nhlx-tabpanel ir-nfl-panel" id="big" role="tabpanel" aria-labelledby="tab-big" hidden={tab !== 'big'}>
          <div className="nhlx-wrap">
            <section className="nhlx-pk" aria-label="Big games">
              {head({ games: true })}
              {err ? <div className="nhlx-alert">{err}</div> : null}
              {mounted('big') ? (board ? <NbaBigGames board={board} game={gameId || null} /> : !err ? <div className="nhlx-empty">Loading the slate…</div> : null) : null}
            </section>
          </div>
        </section>

        <section className="nhlx-bench nhlx-tabpanel ir-nfl-panel" id="firstbasket" role="tabpanel" aria-labelledby="tab-firstbasket" hidden={tab !== 'firstbasket'}>
          <div className="nhlx-wrap">
            <section className="nhlx-pk" aria-label="First basket">
              {head()}
              {mounted('firstbasket') && date ? <NbaFirstBasket date={date} /> : null}
            </section>
          </div>
        </section>

        <section className="nhlx-bench nhlx-tabpanel ir-nfl-panel" id="sources" role="tabpanel" aria-labelledby="tab-sources" hidden={tab !== 'sources'}>
          <div className="nhlx-wrap">
            <section className="nhlx-pk" aria-label="Data sources">
              {head()}
              {pull.msg ? <p className="nhlx-auto-msg">{pull.msg}</p> : null}
              {err ? <div className="nhlx-alert">{err}</div> : null}
              {date ? <NbaSources date={date} onChange={() => go(date)} /> : null}
            </section>
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
