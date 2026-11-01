'use client';

import { useMemo } from 'react';
import PlayerSearch from '@/components/picks/PlayerSearch';
import { nbaSearchList } from '@/lib/picks/player-search';
import { teamLogo } from '@/lib/nba/teams';
import { headshotUrl } from '@/lib/nba/espn';
import { NbaPlayerCardProvider, useNbaPlayerCard } from './NbaPlayerCard';

// The NBA head's player search (Vincent, 2026-11-01): a pick opens the player card with the side's entry for him, as a
// court chip or a list row does.

function Box({ board }) {
  const open = useNbaPlayerCard();
  const players = useMemo(() => nbaSearchList(board), [board]);
  return <PlayerSearch players={players} teamLogo={teamLogo} headshotUrl={headshotUrl} placeholder="Search a player tonight" onPick={(p) => open({ key: p.key, player: p.ref, team: p.team, opp: p.opp, venue: p.venue })} />;
}

export default function NbaSearch({ board }) {
  if (!board?.date) return null;
  return <NbaPlayerCardProvider date={board.date}><Box board={board} /></NbaPlayerCardProvider>;
}
