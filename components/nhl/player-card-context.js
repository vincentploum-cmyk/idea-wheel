'use client';

import { createContext, useContext } from 'react';

// The player card's opener, in its own module so the card can draw components (the game
// log) that themselves open a card: const open = usePlayerCard(); open({ id, opp, venue }).
export const PlayerCardContext = createContext(() => {});
export const usePlayerCard = () => useContext(PlayerCardContext);
