'use client';

import Board from '@/components/picks/Board';
import { GROUPS } from '@/lib/nba/markets';
import { teamLogo, teamName } from '@/lib/nba/teams';
import { headshotUrl } from '@/lib/nba/espn';

const SPORT = { groups: GROUPS, teamLogo, teamName, headshotUrl };

export default function NbaBoard({ board }) {
  return <Board board={board} sport={SPORT} empty="No games on this date." />;
}
