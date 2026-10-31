'use client';

import { MatchupProfile } from '@/components/nhl/MatchupProfile';
import { teamMark } from '@/components/picks/Board';

// The matchup profile at the top of an opened NBA game: the NHL card (components/nhl/MatchupProfile.jsx) on the
// board game's `profile` (lib/nba/profile.js) — five rows, a word over one line, the rank phrases toned. Vincent,
// 2026-10-31: "now do the same profile for the NBA board".
export default function GameProfile({ g, sport }) {
  if (!g?.profile?.rows?.length) return null;
  return <MatchupProfile profile={g.profile} renderTeam={teamMark(sport)} />;
}
