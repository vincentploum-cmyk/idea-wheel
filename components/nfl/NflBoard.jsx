'use client';

import Board from '@/components/picks/Board';
import Shuffle from '@/components/picks/Shuffle';
import { GROUPS, MARKETS, SHUFFLE_MARKETS, labelOf } from '@/lib/nfl/markets';
import { teamLogo, teamName } from '@/lib/nfl/teams';
import { headshotUrl } from '@/lib/nfl/espn';

const SPORT = { groups: GROUPS, teamLogo, teamName, headshotUrl };
const BARS = SHUFFLE_MARKETS.map((m) => ({ ...m, label: labelOf(m.market), unit: MARKETS[m.market].unit }));

/** The week's shuffle (the Shuffle tab): a bar per market over the week's players. */
export function NflShuffle({ wk }) {
  const query = wk?.season ? `season=${wk.season}&week=${wk.week}&type=${wk.type || 2}` : '';
  if (!query) return null;
  return <Shuffle sport={{ api: '/api/nfl', query, markets: BARS, teamLogo, headshotUrl, withDay: true }} />;
}

/** The week's board: per game the four tables. */
export default function NflBoard({ board }) {
  return <Board board={board} sport={SPORT} empty="No games in this week." />;
}
