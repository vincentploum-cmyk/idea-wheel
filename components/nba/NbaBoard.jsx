'use client';

import { useState } from 'react';
import { BoardNotes } from '@/components/picks/Board';
import Shuffle from '@/components/picks/Shuffle';
import SlateList from '@/components/picks/SlateList';
import { GROUPS, MARKETS, SHUFFLE_MARKETS, labelOf } from '@/lib/nba/markets';
import { teamLogo, teamName } from '@/lib/nba/teams';
import { headshotUrl } from '@/lib/nba/espn';
import GameFold from './NbaGame';
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
        {board.games.map((g) => <GameFold key={g.id} g={{ ...g, season: board.season }} best={board.best} sport={SPORT} metric={metric} onMetric={setMetric} open={!closed.has(g.id)} onToggle={(next) => setClosed((prev) => { const s = new Set(prev); if (next) s.delete(g.id); else s.add(g.id); return s; })} />)}
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
