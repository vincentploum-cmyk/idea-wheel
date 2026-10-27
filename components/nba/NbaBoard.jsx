'use client';

import { useState } from 'react';
import Board from '@/components/picks/Board';
import Shuffle from '@/components/picks/Shuffle';
import { GROUPS, MARKETS, SHUFFLE_MARKETS, labelOf } from '@/lib/nba/markets';
import { teamLogo, teamName } from '@/lib/nba/teams';
import { headshotUrl } from '@/lib/nba/espn';
import CourtPair, { COURT_METRICS } from './NbaCourt';
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

/** The night's board: per game the two courts (the matchup view) over the five tables. */
export default function NbaBoard({ board }) {
  const [metric, setMetric] = useState('pts');
  return (
    <NbaPlayerCardProvider date={board?.date}>
      {board?.games?.length ? (
        <div className="ir-court-switch nhlx-rk-toggle">
          <small>Courts</small>
          <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label="Court metric">
            {COURT_METRICS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={metric === key} className={`nhlx-tab${metric === key ? ' is-active' : ''}`} onClick={() => setMetric(key)}>{label}</button>)}
          </div>
          <span className="nhlx-rk-toggle-note">One stat for every court (the tabs above each court change it too). Zones: what the opponent gives up to that position over the window picked above the court (green = the most permissive third of the league, red = the stingiest). Chips: what the player can get tonight (his rate × that environment, green when over the line), the book’s main line and the chance. Under each court, per player and market: what he is expected to get tonight, his floor–ceiling, and the book’s line with his chance to clear it.</span>
        </div>
      ) : null}
      <Board board={board} sport={SPORT} empty="No games on this date." before={(g) => <CourtPair g={{ ...g, season: board?.season }} metric={metric} onMetric={setMetric} sport={SPORT} />} />
    </NbaPlayerCardProvider>
  );
}
