'use client';

import { useState } from 'react';
import Board from '@/components/picks/Board';
import Shuffle from '@/components/picks/Shuffle';
import SidePicks from '@/components/picks/SidePicks';
import SlateOverview, { useRanked } from '@/components/picks/SlateOverview';
import { useValueFilters } from '@/components/picks/value-filters';
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

/** Both teams' best plays above a game's tables (the NBA court's strip, lib/picks/board.js `side.picks`), away then home. */
function GamePicks({ g }) {
  const sides = g.sides || {};
  const list = [sides[g.away], sides[g.home]].filter((s) => s?.picks);
  if (!list.length) return null;
  return <div className="ir-picks-pair">{list.map((side) => <SidePicks key={side.team} side={side} sport={SPORT} final={g.final} />)}</div>;
}

/**
 * The week's board (the restructure of 2026-10-31): the slate overview first — the value floors, Top Matchups (the
 * games by their Matchup Score) and Top Plays (every +EV play across the week, the best value first) — then every game
 * folded to one line, in the same order, opening on a press to the profile, both sides' strips and the four tables
 * ordered by EV with the marginal rows behind the switch.
 */
export default function NflBoard({ board }) {
  const [filters, setFilters, reset] = useValueFilters('nfl');
  const [open, setOpen] = useState(() => new Set());
  const { ranked } = useRanked(board, filters);
  const onGame = (id) => {
    setOpen((prev) => new Set(prev).add(id));
    // After the fold opens, scroll the game into view.
    setTimeout(() => document.getElementById(`game-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };
  if (!board?.games?.length) return <div className="nhlx-empty">No games in this week.</div>;
  const allOpen = board.games.every((g) => open.has(g.id));
  return (
    <>
      <SlateOverview board={board} sport={SPORT} filters={filters} onFilters={setFilters} onReset={reset} onGame={onGame} withDay title="Top plays this week" />
      <section className="ir-gf-list" aria-label="Games">
        <div className="nhlx-pfd-head">
          <b>Games</b>
          <small className="nhlx-auto-meta">by Matchup Score · each line the leak badge, the +EV count and the top play · press one for the profile, both strips and the tables</small>
          <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-gf-all" onClick={() => setOpen(allOpen ? new Set() : new Set(board.games.map((g) => g.id)))}>{allOpen ? 'Collapse all' : 'Expand all'}</button>
        </div>
        <Board board={board} sport={SPORT} empty="No games in this week." before={(g) => <GamePicks g={g} />} ranked={ranked} open={open} onToggle={(id, next) => setOpen((prev) => { const s = new Set(prev); if (next) s.add(id); else s.delete(id); return s; })} filters={filters} marginal={!!filters.marginal} />
      </section>
    </>
  );
}
