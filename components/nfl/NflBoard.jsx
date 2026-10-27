'use client';

import Board from '@/components/picks/Board';
import Shuffle from '@/components/picks/Shuffle';
import { GROUPS, MARKETS, SHUFFLE_MARKETS, labelOf } from '@/lib/nfl/markets';
import { teamLogo, teamName } from '@/lib/nfl/teams';
import { headshotUrl } from '@/lib/nfl/espn';

const SPORT = { groups: GROUPS, teamLogo, teamName, headshotUrl };
const BARS = SHUFFLE_MARKETS.map((m) => ({ ...m, label: labelOf(m.market), unit: MARKETS[m.market].unit }));

/** The week's board: the shuffle, then per game the four tables. */
export default function NflBoard({ board }) {
  const query = board?.season ? `season=${board.season}&week=${board.week}&type=${board.type || 2}` : '';
  return (
    <>
      {board?.games?.length && query ? <Shuffle sport={{ api: '/api/nfl', query, markets: BARS, teamLogo, headshotUrl, withDay: true }} /> : null}
      <Board board={board} sport={SPORT} empty="No games in this week." />
    </>
  );
}
