'use client';

import { useState } from 'react';
import { BoardNotes } from '@/components/picks/Board';
import Shuffle from '@/components/picks/Shuffle';
import SlateOverview, { useRanked } from '@/components/picks/SlateOverview';
import { useValueFilters } from '@/components/picks/value-filters';
import Boards from '@/components/picks/Boards';
import { NBA_BOARDS } from '@/lib/picks/boards';
import { GROUPS, MARKETS, SHUFFLE_MARKETS, labelOf } from '@/lib/nba/markets';
import { teamLogo, teamName } from '@/lib/nba/teams';
import { headshotUrl } from '@/lib/nba/espn';
import GameFold from './NbaGame';
import NbaSoftSpots from './NbaSoftSpots';
import { reliabilityText, reliableFor } from '@/lib/picks/reliability';

/** The markets the reliability line names, the best-bets markets first. */
const RELIABLE_ORDER = ['reb', 'ast', 'tpm', 'pts', 'pra'];
import { CourtShuffleProvider } from './NbaCourt';
import { NbaPlayerCardProvider, useNbaPlayerCard } from './NbaPlayerCard';

const SPORT = { groups: GROUPS, teamLogo, teamName, headshotUrl, totalStat: 'pts', totalUnit: 'points' };
const BARS = SHUFFLE_MARKETS.map((m) => ({ ...m, label: labelOf(m.market), unit: MARKETS[m.market].unit }));

/** The shuffle for the night, a row opening the player's card; needs an NbaPlayerCardProvider above it. */
function NbaShuffleRows({ date }) {
  const open = useNbaPlayerCard();
  return <Shuffle sport={{ api: '/api/nba', query: `date=${date}`, markets: BARS, teamLogo, headshotUrl }} onOpen={(p, market) => open({ key: p.key, player: p, team: p.team, opp: p.opp, venue: p.venue, market })} />;
}

/** The night's shuffle (the Shuffle tab), with its own card host. */
export function NbaShuffle({ date }) {
  if (!date) return null;
  return (
    <NbaPlayerCardProvider date={date}>
      <NbaShuffleRows date={date} />
    </NbaPlayerCardProvider>
  );
}

/**
 * The slate (the restructure of 2026-10-31): the overview first — the value floors, Top Matchups (the games by their
 * Matchup Score) and Top Plays (every +EV play on the night, the best value first) — then the games folded to a line
 * each in the same order, closed by default, opening on a press; needs an NbaPlayerCardProvider above it.
 * `game` (a game id from the head's dropdown, or a Top Matchups card) shows that game alone, open, with the list cut to
 * its plays; `onGame` sets or clears it ("All games").
 */
function NbaSlate({ board: whole, game = null, onGame = null }) {
  const open = useNbaPlayerCard();
  const [filters, setFilters, reset] = useValueFilters('nba');
  const picked = game ? (whole?.games || []).find((g) => g.id === game) || null : null;
  const board = picked ? { ...whole, games: [picked], best: (whole.best || []).filter((r) => r.game === picked.id) } : whole;
  const { ranked } = useRanked(board, filters);
  const [metric, setMetric] = useState('pts');   // the courts' stat (the tabs above each court, one setting for the slate); the bar's height per stat lives in CourtShuffleProvider
  // Every game folded by default (the brief of 2026-10-31: "Games collapsed by default to a one-line header"); the set of open ones is the state.
  const [opened, setOpened] = useState(() => new Set());
  if (!whole?.games?.length) return <div className="nhlx-empty">No games on this date.</div>;
  const allOpen = board.games.every((g) => opened.has(g.id));
  // A row of the list opens the card with the side's entry for the player (his ladders and projection), as a court chip does.
  const openRow = (r) => {
    const side = whole.games.find((g) => g.id === r.game)?.sides?.[r.team];
    open({ key: r.key, player: side?.players?.find((p) => p.key === r.key) || r, team: r.team, opp: r.opp, venue: r.venue, market: r.market });
  };
  const pickGame = (id) => { if (onGame) onGame(String(id)); else setOpened((prev) => new Set(prev).add(id)); };
  return (
    <>
      <SlateOverview board={board} sport={SPORT} filters={filters} onFilters={setFilters} onReset={reset} onGame={picked ? null : pickGame} onOpen={openRow} picked={picked?.id || null} title="Top plays tonight" />
      {/* The soft spots (Vincent, 2026-11-10, the NHL's list on Best bets: "We should do the same with nba"): the regulars
          facing one of the five most permissive defenses at their position, cut to the picked game with the rest. */}
      <NbaSoftSpots board={board} sport={SPORT} onOpen={openRow} />
      <section className="ir-gf-list" aria-label="Games">
        <div className="nhlx-pfd-head">
          <b>{picked ? `${picked.away} @ ${picked.home}` : 'Games'}</b>
          <small className="nhlx-auto-meta">{picked ? 'one game, picked above · its plays ranked over it' : 'by Matchup Score · each line the leak badge, the +EV count and the top play · press one for the profile, the courts and the tables'}</small>
          {picked && onGame ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-gf-all" onClick={() => onGame('')}>All games ({whole.games.length})</button>
            : <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-gf-all" onClick={() => setOpened(allOpen ? new Set() : new Set(board.games.map((g) => g.id)))}>{allOpen ? 'Collapse all' : 'Expand all'}</button>}
        </div>
        {/* What chance has been reliable to bet on, per market, from the season's graded nights (lib/picks/reliability.js; Vincent,
            2026-10-31): every percentage on the page is green at or over its market's threshold, red under it. */}
        {board.reliability ? (
          <p className="ir-rel-line nhlx-auto-meta" title={`Learned from ${board.reliability.nights} graded nights (${board.reliability.from} → ${board.reliability.to}, ${board.reliability.plays} over / yes plays as the board stated them): the lowest chance from which ${board.reliability.min} plays or more landed at least their break-even at the book's prices. Hover a market for its figures.`}>
            <b>Reliable from</b>
            {RELIABLE_ORDER.filter((m) => board.reliability.markets?.[m]).map((m) => { const t = reliableFor(board.reliability, m); return <span key={m} className={`ir-rel-pill${t != null ? ' ir-rel-yes' : ' ir-rel-none'}`} title={reliabilityText(board.reliability, m, labelOf(m))}>{labelOf(m)} {t != null ? `${Math.round(t * 100)}%` : 'not yet'}</span>; })}
            <small>green = a chance at or over its market’s threshold, red = under it, by the chance as the model states it</small>
          </p>
        ) : null}
        {ranked.map(({ game: g, matchup }) => <GameFold key={g.id} g={{ ...g, season: board.season }} matchup={matchup} best={board.best} sport={SPORT} metric={metric} onMetric={setMetric} reliability={board.reliability || null} filters={filters} open={!!picked || opened.has(g.id)} onToggle={(next) => setOpened((prev) => { const s = new Set(prev); if (next) s.add(g.id); else s.delete(g.id); return s; })} />)}
      </section>
      <BoardNotes notes={board.notes} />
    </>
  );
}

const UNITS = Object.fromEntries(Object.entries(MARKETS).map(([k, m]) => [k, m.unit]));

/** The boards' rows open the card with the side's entry for the player; needs an NbaPlayerCardProvider above it. */
function NbaBoardsRows({ board, game = null }) {
  const open = useNbaPlayerCard();
  const openRow = (r) => {
    const side = (board.games || []).find((g) => g.id === r.game)?.sides?.[r.team];
    open({ key: r.key, player: side?.players?.find((p) => p.key === r.key) || r, team: r.team, opp: r.opp, venue: r.venue, market: r.market });
  };
  if (!board?.games?.length) return <div className="nhlx-empty">No games on this date.</div>;
  return <Boards board={board} specs={NBA_BOARDS} units={UNITS} gameId={game || null} onOpen={openRow} title={game ? 'The game’s boards' : 'Tonight’s boards'} shuffleApi="/api/nba" query={board.date ? `date=${board.date}` : ''} />;
}

/**
 * The Boards tab (Vincent, 2026-11-01, his own lists as the form: "we should for assists, points, rebounds have the best
 * candidates. Also, we should list the point ladders. 20+, 25+"): per stat the best candidates over the book's main line
 * and the ladders, the slate's players ranked, cut to one game by the head's dropdown.
 */
export function NbaBoards({ board, game = null }) {
  if (!board) return null;
  return (
    <NbaPlayerCardProvider date={board.date}>
      <NbaBoardsRows board={board} game={game} />
    </NbaPlayerCardProvider>
  );
}

/** The night's board: the slate's plays in one ranked list over the games, each folded to a line (2026-10-30). */
export default function NbaBoard({ board, game = null, onGame = null }) {
  return (
    <NbaPlayerCardProvider date={board?.date}>
      <CourtShuffleProvider date={board?.date}>
        <NbaSlate board={board} game={game} onGame={onGame} />
      </CourtShuffleProvider>
    </NbaPlayerCardProvider>
  );
}
