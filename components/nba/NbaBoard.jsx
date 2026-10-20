'use client';

import { useState } from 'react';
import Board from '@/components/picks/Board';
import { GROUPS } from '@/lib/nba/markets';
import { teamLogo, teamName } from '@/lib/nba/teams';
import { headshotUrl } from '@/lib/nba/espn';
import CourtPair, { COURT_METRICS } from './NbaCourt';

const SPORT = { groups: GROUPS, teamLogo, teamName, headshotUrl };

/** The night's board: per game the two courts (the matchup view) over the five tables. */
export default function NbaBoard({ board }) {
  const [metric, setMetric] = useState('pts');
  return (
    <>
      {board?.games?.length ? (
        <div className="ir-court-switch nhlx-rk-toggle">
          <small>Courts show</small>
          <div className="nhlx-tabs nhlx-rk-tabs" role="tablist" aria-label="Court metric">
            {COURT_METRICS.map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={metric === key} className={`nhlx-tab${metric === key ? ' is-active' : ''}`} onClick={() => setMetric(key)}>{label}</button>)}
          </div>
          <span className="nhlx-rk-toggle-note">Each zone is tinted by what the opponent gives up to that position (green = the most permissive third of the league, red = the stingiest); the chip carries the player’s line and chance for the stat.</span>
        </div>
      ) : null}
      <Board board={board} sport={SPORT} empty="No games on this date." before={(g) => <CourtPair g={g} metric={metric} sport={SPORT} />} />
    </>
  );
}
