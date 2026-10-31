'use client';

import { useState } from 'react';
import { BoardNotes } from '@/components/picks/Board';
import Shuffle from '@/components/picks/Shuffle';
import SlateList from '@/components/picks/SlateList';
import { GROUPS, MARKETS, SHUFFLE_MARKETS, labelOf } from '@/lib/nba/markets';
import { teamLogo, teamName } from '@/lib/nba/teams';
import { headshotUrl } from '@/lib/nba/espn';
import GameFold from './NbaGame';
import { DEFAULT_VIEW } from './NbaProfile';
import { reliabilityText, reliableFor } from '@/lib/picks/reliability';

/** The markets the reliability line names, the best-bets markets first. */
const RELIABLE_ORDER = ['reb', 'ast', 'tpm', 'pts', 'pra'];
import { CourtShuffleProvider } from './NbaCourt';
import { NbaPlayerCardProvider, useNbaPlayerCard } from './NbaPlayerCard';

const SPORT = { groups: GROUPS, teamLogo, teamName, headshotUrl, totalStat: 'pts', totalUnit: 'points' };
const BARS = SHUFFLE_MARKETS.map((m) => ({ ...m, label: labelOf(m.market), unit: MARKETS[m.market].unit }));

/** The shuffle for the night, a row opening the player's card; needs an NbaPlayerCardProvider above it. */
function NbaShuffleRows({ date }) {
  const open = useNbaPlayerCard();
  return <Shuffle sport={{ api: '/api/nba', query: `date=${date}`, markets: BARS, teamLogo, headshotUrl }} onOpen={(p, market) => open({ key: p.key, player: p, team: p.team, opp: p.opp, venue: p.venue, market })} />;
}

/** The night's shuffle (the Shuffle tab), with its own card host. */
export function NbaShuffle({ date }) {
  if (!date) return null;
  return (
    <NbaPlayerCardProvider date={date}>
      <NbaShuffleRows date={date} />
    </NbaPlayerCardProvider>
  );
}

/** The slate: every play ranked, then the games folded to a line each; needs an NbaPlayerCardProvider above it. */
function NbaSlate({ board }) {
  const open = useNbaPlayerCard();
  const [metric, setMetric] = useState('pts');   // the courts' stat (the tabs above each court, one setting for the slate); the bar's height per stat lives in CourtShuffleProvider
  // Every game open by default (Vincent, 2026-10-30: "too many clicks"); the set of closed ones is the state, so a new slate opens again.
  const [closed, setClosed] = useState(() => new Set());
  const [profileView, setProfileView] = useState(DEFAULT_VIEW);   // the profile's Offense / Defense view, one setting for the page, Defense to start
  if (!board?.games?.length) return <div className="nhlx-empty">No games on this date.</div>;
  const allClosed = board.games.every((g) => closed.has(g.id));
  // A row of the list opens the card with the side's entry for the player (his ladders and projection), as a court chip does.
  const openRow = (r) => {
    const side = board.games.find((g) => g.id === r.game)?.sides?.[r.team];
    open({ key: r.key, player: side?.players?.find((p) => p.key === r.key) || r, team: r.team, opp: r.opp, venue: r.venue, market: r.market });
  };
  return (
    <>
      {/* The games first, open (2026-10-30, Vincent: "too many clicks. I need the games listed first along with the best bets"), the ranked list under them. */}
      <section className="ir-gf-list" aria-label="Games">
        <div className="nhlx-pfd-head">
          <b>Games</b>
          <small className="nhlx-auto-meta">each with its profile, its best bets and the two courts: the stat tabs, the shuffle bar, every player’s projections and his chance at the bar, PropFinder’s table above each · the ranked list of every play is under the games</small>
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-gf-all" onClick={() => setClosed(allClosed ? new Set() : new Set(board.games.map((g) => g.id)))}>{allClosed ? 'Expand all' : 'Collapse all'}</button>
        </div>
        {/* What chance has been reliable to bet on, per market, from the season's graded nights (lib/picks/reliability.js; Vincent,
            2026-10-31): every percentage on the page is green at or over its market's threshold, red under it. */}
        {board.reliability ? (
          <p className="ir-rel-line nhlx-auto-meta" title={`Learned from ${board.reliability.nights} graded nights (${board.reliability.from} → ${board.reliability.to}, ${board.reliability.plays} over / yes plays as the board stated them): the lowest chance from which ${board.reliability.min} plays or more landed at least their break-even at the book's prices. Hover a market for its figures.`}>
            <b>Reliable from</b>
            {RELIABLE_ORDER.filter((m) => board.reliability.markets?.[m]).map((m) => { const t = reliableFor(board.reliability, m); return <span key={m} className={`ir-rel-pill${t != null ? ' ir-rel-yes' : ' ir-rel-none'}`} title={reliabilityText(board.reliability, m, labelOf(m))}>{labelOf(m)} {t != null ? `${Math.round(t * 100)}%` : 'not yet'}</span>; })}
            <small>green = a chance at or over its market’s threshold, red = under it, by the chance as the model states it</small>
          </p>
        ) : null}
        {board.games.map((g) => <GameFold key={g.id} g={{ ...g, season: board.season }} best={board.best} sport={SPORT} metric={metric} onMetric={setMetric} profileView={profileView} onProfileView={setProfileView} reliability={board.reliability || null} open={!closed.has(g.id)} onToggle={(next) => setClosed((prev) => { const s = new Set(prev); if (next) s.delete(g.id); else s.add(g.id); return s; })} />)}
      </section>
      <SlateList board={board} sport={SPORT} onOpen={openRow} />
      <BoardNotes notes={board.notes} />
    </>
  );
}

/** The night's board: the slate's plays in one ranked list over the games, each folded to a line (2026-10-30). */
export default function NbaBoard({ board }) {
  return (
    <NbaPlayerCardProvider date={board?.date}>
      <CourtShuffleProvider date={board?.date}>
        <NbaSlate board={board} />
      </CourtShuffleProvider>
    </NbaPlayerCardProvider>
  );
}
