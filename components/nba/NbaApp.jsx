'use client';

import { useCallback, useEffect, useState } from 'react';
import SiteHeader from '@/components/nhl/SiteHeader';
import SignOutButton from '@/components/nhl/SignOutButton';
import ThemeToggle from '@/components/nhl/ThemeToggle';
import SportNav from '@/components/site/SportNav';
import TabBar from '@/components/site/TabBar';
import { useHashTab } from '@/components/site/hash-tab';
import NbaBoard, { NbaShuffle } from './NbaBoard';
import NbaSources from './NbaSources';
import NbaFirstBasket from './NbaFirstBasket';

const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : '');

const TABS = [
  ['board', 'Best plays'],
  ['shuffle', 'Shuffle'],
  ['firstbasket', 'First basket'],
];
const TAB_KEYS = TABS.map(([key]) => key);

/**
 * The NBA page, three hash tabs over one date picker: Best plays (the night's plays in one ranked list,
 * the games folded under it, the notes, the scorecard and the data sources), Shuffle (each player's
 * line at a chance, or who clears a bar; a row opening the player's card) and First basket.
 */
export default function NbaApp({ email }) {
  const [tab, mounted] = useHashTab(TAB_KEYS, 'board');
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
          {board ? [`${games.length} game${games.length === 1 ? '' : 's'}`, finals ? `${finals} final` : null, `${board.plays} play${board.plays === 1 ? '' : 's'}`, src?.sheets?.length ? `${src.sheets.length} cheat sheet${src.sheets.length === 1 ? '' : 's'}` : 'no cheat sheet', src?.propfinder ? `PropFinder ${fmtDay(src.propfinder.at)} ${fmtTime(src.propfinder.at)}` : 'PropFinder not pulled'].filter(Boolean).join(' · ') : ''}
        </div>
      </div>
      <div className="nhlx-auto-actions">
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
        <TabBar tabs={TABS} tab={tab} />

        <section className="nhlx-bench nhlx-tabpanel" id="board" role="tabpanel" aria-labelledby="tab-board" hidden={tab !== 'board'}>
          <div className="nhlx-wrap">
            <div className="nhlx-bench-head">
              <div>
                <span className="nhlx-eyebrow">NBA</span>
                <h1>Tonight&apos;s <span>best plays</span></h1>
                <p>Tonight’s rebounds, assists and threes where the board beats the book, the biggest edge first: the book’s line, his projection against it with his floor and ceiling, the board’s chance there, the book’s price and the opponent’s rank at his spot. The games beside them: open one for both rosters against both defenses, the courts and the tables behind a switch.</p>
              </div>
            </div>
            <section className="nhlx-pk" aria-label="Tonight’s picks">
              {head({ games: true })}
              {pull.msg ? <p className="nhlx-auto-msg">{pull.msg}</p> : null}
              {err ? <div className="nhlx-alert">{err}</div> : null}
              {board ? <NbaBoard board={board} game={gameId || null} onGame={setGameId} /> : !err ? <div className="nhlx-empty">Loading the slate…</div> : null}
            </section>
            {date ? <NbaSources date={date} onChange={() => go(date)} /> : null}
          </div>
        </section>

        <section className="nhlx-bench nhlx-tabpanel" id="shuffle" role="tabpanel" aria-labelledby="tab-shuffle" hidden={tab !== 'shuffle'}>
          <div className="nhlx-wrap">
            <div className="nhlx-bench-head">
              <div>
                <span className="nhlx-eyebrow">NBA</span>
                <h1>The <span>shuffle</span></h1>
                <p>Pick the chance and every player shows the highest line he clears at it, with the book’s rung there and its edge; or pick the line and the field falls away as the bar rises. Every player on the night’s slate with a PropFinder log. Click a row for his card.</p>
              </div>
            </div>
            <section className="nhlx-pk" aria-label="Tonight’s shuffle">
              {head()}
              {pull.msg ? <p className="nhlx-auto-msg">{pull.msg}</p> : null}
              {err ? <div className="nhlx-alert">{err}</div> : null}
              {mounted('shuffle') && date ? (games.length ? <NbaShuffle date={date} /> : board ? <div className="nhlx-empty">No games on this date.</div> : null) : null}
            </section>
          </div>
        </section>
        <section className="nhlx-bench nhlx-tabpanel" id="firstbasket" role="tabpanel" aria-labelledby="tab-firstbasket" hidden={tab !== 'firstbasket'}>
          <div className="nhlx-wrap">
            <div className="nhlx-bench-head">
              <div>
                <span className="nhlx-eyebrow">NBA</span>
                <h1>First <span>basket</span></h1>
                <p>Who scores the first field goal of each game: the tip, the team with first possession, each starter’s share of his team’s first shot and his own record this season, with the book’s price beside it.</p>
              </div>
            </div>
            <section className="nhlx-pk" aria-label="First basket">
              {head()}
              {mounted('firstbasket') && date ? <NbaFirstBasket date={date} /> : null}
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
