'use client';

import { useId, useMemo, useRef, useState } from 'react';
import { searchPlayers } from '@/lib/picks/player-search';

// The search box in each board's head (Vincent, 2026-11-01: "I should be able to search on players for both nba and
// nfl"): type a name or a team code, the matches drop under the box — name, team, position, tonight's game and a line of
// his projections —, arrows and Enter pick one, Escape closes; the pick goes to `onPick` (the NBA opens the player card,
// the NFL its player panel).
//   players: lib/picks/player-search.js nbaSearchList / nflSearchList; teamLogo, headshotUrl: the sport's.

export default function PlayerSearch({ players, onPick, teamLogo, headshotUrl = null, placeholder = 'Search a player' }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState(0);
  const listId = useId();
  const box = useRef(null);
  const hits = useMemo(() => searchPlayers(players, q, 8), [players, q]);
  const pick = (p) => { if (!p) return; onPick(p); setQ(''); setOpen(false); setAt(0); box.current?.blur(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setAt((i) => Math.min(hits.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(hits[at]); }
    else if (e.key === 'Escape') { setOpen(false); box.current?.blur(); }
  };
  const showing = open && q.trim().length > 0;
  return (
    <div className="ir-ps" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false); }}>
      <input
        ref={box} type="search" className="nhlx-input nhlx-input-sm ir-ps-input" value={q} placeholder={placeholder} aria-label="Search a player"
        role="combobox" aria-expanded={showing} aria-controls={listId} aria-autocomplete="list" aria-activedescendant={showing && hits[at] ? `${listId}-${at}` : undefined}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setAt(0); }} onFocus={() => setOpen(true)} onKeyDown={onKey} disabled={!players?.length}
      />
      {showing ? (
        <ul className="ir-ps-list" id={listId} role="listbox">
          {hits.length ? hits.map((p, i) => (
            <li key={p.id} id={`${listId}-${i}`} role="option" aria-selected={i === at}>
              <button type="button" className={`ir-ps-hit${i === at ? ' is-at' : ''}${p.out ? ' is-out' : ''}`} onMouseEnter={() => setAt(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}>
                {p.espnId && headshotUrl ? <img src={headshotUrl(p.espnId)} alt="" width="28" height="28" loading="lazy" /> : <img src={teamLogo(p.team)} alt="" width="28" height="28" loading="lazy" className="ir-nfl-logo" />}
                <span>
                  <b>{p.name}</b>
                  <small>{p.team}{p.pos ? ` · ${p.pos}` : ''}{p.opp ? ` · ${p.venue === 'H' ? 'vs' : 'at'} ${p.opp}` : ''}{p.out ? ' · out' : p.health === 'DTD' ? ' · DTD' : ''}{p.sub ? ` · ${p.sub}` : ''}</small>
                </span>
              </button>
            </li>
          )) : <li className="ir-ps-none">No player on this slate matches “{q.trim()}”.</li>}
        </ul>
      ) : null}
    </div>
  );
}
