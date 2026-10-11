'use client';

import { createContext, useCallback, useContext } from 'react';

// The player card's opener, in its own module so the card can draw components (the game
// log) that themselves open a card: const open = usePlayerCard(); open({ id, opp, venue }).
export const PlayerCardContext = createContext(() => {});
// The slate date a panel shows (Matchups, Best bets, 1st goal): every open() from inside it
// carries the date, so the card can read that night's lineup slot from the position snapshot
// itself instead of trusting what the opener passed.
export const SlateDateContext = createContext('');
export const usePlayerCard = () => {
  const open = useContext(PlayerCardContext);
  const date = useContext(SlateDateContext);
  return useCallback((req) => open(date && !req.date ? { ...req, date } : req), [open, date]);
};
