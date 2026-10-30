'use client';

import { useState } from 'react';
import { BoardNotes } from '@/components/picks/Board';
import Shuffle from '@/components/picks/Shuffle';
import SlateList from '@/components/picks/SlateList';
import { GROUPS, MARKETS, SHUFFLE_MARKETS, labelOf } from '@/lib/nba/markets';
import { teamLogo, teamName } from '@/lib/nba/teams';
import { headshotUrl } from '@/lib/nba/espn';
import GameFold from './NbaGame';
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
  const [metric, setMetric] = useState('pts');
  if (!board?.games?.length) return <div className="nhlx-empty">No games on this date.</div>;
  // A row of the list opens the card with the side's entry for the player (his ladders and projection), as a court chip does.
  const openRow = (r) => {
    const side = board.games.find((g) => g.id === r.game)?.sides?.[r.team];
    open({ key: r.key, player: side?.players?.find((p) => p.key === r.key) || r, team: r.team, opp: r.opp, venue: r.venue, market: r.market });
  };
  return (
    <>
      <SlateList board={board} sport={SPORT} onOpen={openRow} />
      <section className="ir-gf-list" aria-label="Games">
        <div className="nhlx-pfd-head"><b>Games</b><small className="nhlx-auto-meta">open a game for both rosters against both defenses; the courts and the tables sit behind a switch inside it</small></div>
        {board.games.map((g) => <GameFold key={g.id} g={{ ...g, season: board.season }} best={board.best} sport={SPORT} metric={metric} onMetric={setMetric} />)}
      </section>
      <BoardNotes notes={board.notes} />
    </>
  );
}

/** The night's board: the slate's plays in one ranked list over the games, each folded to a line (2026-10-30). */
export default function NbaBoard({ board }) {
  return (
    <NbaPlayerCardProvider date={board?.date}>
      <NbaSlate board={board} />
    </NbaPlayerCardProvider>
  );
}
