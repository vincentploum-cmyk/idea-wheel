'use client';

import { useState } from 'react';
import Board from '@/components/picks/Board';
import { GROUPS } from '@/lib/nba/markets';
import { teamLogo, teamName } from '@/lib/nba/teams';
import { headshotUrl } from '@/lib/nba/espn';
import CourtPair, { COURT_METRICS } from './NbaCourt';
import { NbaPlayerCardProvider } from './NbaPlayerCard';

const SPORT = { groups: GROUPS, teamLogo, teamName, headshotUrl };

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
