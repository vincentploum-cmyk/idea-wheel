'use client';

import Board from '@/components/picks/Board';
import { GROUPS } from '@/lib/nfl/markets';
import { teamLogo, teamName } from '@/lib/nfl/teams';
import { headshotUrl } from '@/lib/nfl/espn';

const SPORT = { groups: GROUPS, teamLogo, teamName, headshotUrl };

export default function NflBoard({ board }) {
  return <Board board={board} sport={SPORT} empty="No games in this week." />;
}
