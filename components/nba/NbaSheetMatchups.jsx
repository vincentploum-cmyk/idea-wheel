'use client';

// The Cheat sheet tab (Vincent, 2026-10-31: "create a new view with best cheat sheet matchups per game"): per game the
// cheat sheet's softest tiles — what each team's opponent gives up most to a position for points, rebounds, assists or
// threes — both sides ranked together, each with PropFinder's table beside it and the side's players at that spot with
// their projection, the book's line, the board's chance and edge, a best bet marked. Read off the board the page holds
// (lib/nba/sheet-matchups.js); a player opens his card.
import { useState } from 'react';
import { fmtOdds } from '@/lib/nfl/odds';
import { labelOf } from '@/lib/nba/markets';
import { teamLogo } from '@/lib/nba/teams';
import { sheetMatchups, hasSheet, ordinal, SHEET_SOFT } from '@/lib/nba/sheet-matchups';
import { NbaPlayerCardProvider, useNbaPlayerCard } from './NbaPlayerCard';

const SHOWN = 6;
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const num = (v, d = 1) => (v == null ? '—' : Number(v).toFixed(d));
const fmtTip = (iso) => (iso ? new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '');
const AGREE = { soft: 'PropFinder agrees: its soft third too', mid: 'PropFinder has it mid-table', tough: 'PropFinder has it in its tough third' };

function Player({ x, row, open }) {
  const stat = labelOf(row.stat);
  const tip = [
    `${x.player}${x.slot ? ` (${x.slot}${x.depth ? `, depth ${x.depth}` : ''})` : ''}: ${num(x.exp)} ${stat.toLowerCase()} projected tonight, half his nights between ${num(x.floor, 0)} and ${num(x.ceiling, 0)}`,
    x.line != null ? `the book's line o${x.line}${x.odds != null ? ` at ${fmtOdds(x.odds)} (implies ${pct(x.implied)})` : ' (no price)'}; the board gives the over ${pct(x.p)}${x.raw != null && x.raw !== x.p ? ` (${pct(x.raw)} as stated)` : ''}` : 'no book line on him for this stat',
    x.edge != null ? `edge ${x.edge > 0 ? '+' : ''}${Math.round(x.edge * 100)} pts` : null,
    x.bet ? `a best bet tonight: ${x.bet.side === 'under' ? 'u' : 'o'}${x.bet.line} at ${fmtOdds(x.bet.odds)}, ${pct(x.bet.p)}, edge +${Math.round(x.bet.edge * 100)} pts` : null,
    x.health && x.health !== 'In' ? `listed ${x.health}` : null,
  ].filter(Boolean).join(' · ');
  return (
    <button type="button" className="ir-sm-player" title={tip} onClick={() => open({ key: x.key, player: x.entry, team: row.team, opp: row.opp, venue: row.venue, market: row.stat })}>
      <span className="ir-sm-name">{x.player}{x.slot ? <small>{x.slot}</small> : null}{x.health && x.health !== 'In' ? <small className="ir-sm-dtd">{x.health}</small> : null}</span>
      <span className="ir-sm-proj"><b>{num(x.exp)}</b><small>proj</small></span>
      <span className="ir-sm-line">{x.line != null ? <>o{x.line} <b className={x.edge != null ? (x.edge > 0 ? 'is-up' : 'is-down') : ''}>{pct(x.p)}</b>{x.odds != null ? <small>{fmtOdds(x.odds)}{x.edge != null ? ` · ${x.edge > 0 ? '+' : ''}${Math.round(x.edge * 100)}` : ''}</small> : null}</> : <small>no line</small>}</span>
      {x.bet ? <span className="ir-sm-bet">best bet</span> : null}
    </button>
  );
}

function Game({ g, best }) {
  const open = useNbaPlayerCard();
  const [all, setAll] = useState(false);
  const rows = sheetMatchups(g, { best });
  const shown = all ? rows : rows.slice(0, SHOWN);
  const covered = hasSheet(g);
  return (
    <article className="ir-sm-game">
      <header className="ir-sm-head">
        <span className="ir-sm-teams"><img src={teamLogo(g.away)} alt="" width="22" height="22" loading="lazy" />{g.away}<i>@</i><img src={teamLogo(g.home)} alt="" width="22" height="22" loading="lazy" />{g.home}</span>
        <small className="nhlx-auto-meta">{g.final ? `final ${g.awayScore}–${g.homeScore}` : g.state === 'in' ? `live ${g.awayScore}–${g.homeScore}` : fmtTip(g.date)}{covered ? ` · ${rows.length} soft tile${rows.length === 1 ? '' : 's'} on the sheet (top ${SHEET_SOFT} of 30)` : ''}</small>
      </header>
      {!covered ? <p className="nhlx-empty">This game is not on the night’s cheat sheet.</p>
        : !rows.length ? <p className="nhlx-empty">The sheet has no tile in the top {SHEET_SOFT} for this game: no soft spot either way.</p> : (
          <div className="ir-sm-rows" role="list">
            {shown.map((row) => (
              <div className="ir-sm-row" role="listitem" key={`${row.team}-${row.pos}-${row.stat}`}>
                <div className="ir-sm-spot">
                  <img src={teamLogo(row.team)} alt="" width="20" height="20" loading="lazy" />
                  <span><b>{row.team} {row.pos}s · {labelOf(row.stat)}</b><small>{row.venue === 'H' ? 'vs' : '@'} {row.opp}</small></span>
                </div>
                <div className="ir-sm-rank" title={`The cheat sheet: ${row.opp} gives up the ${ordinal(row.sheet)} most ${labelOf(row.stat).toLowerCase()} to ${row.pos}s of the 30 teams`}>
                  <span className="ir-sm-chip">{ordinal(row.sheet)}</span><small>sheet</small>
                </div>
                <div className={`ir-sm-pf${row.agree ? ` is-${row.agree}` : ''}`} title={row.agree ? `${AGREE[row.agree]} · PropFinder's season table: ${row.opp} allows ${num(row.value)} a game to ${row.pos}s, #${row.pfRank} of ${row.count}${row.league != null ? `; the league ${num(row.league)}` : ''}` : 'No PropFinder table for this cell'}>
                  {row.pfRank != null ? <><b>#{row.pfRank}</b> <span>{num(row.value)} a game</span>{row.league != null ? <small>Lg {num(row.league)}</small> : null}</> : <small>no PropFinder table</small>}
                </div>
                <div className="ir-sm-players">
                  {row.players.length ? row.players.map((x) => <Player key={x.key} x={x} row={row} open={open} />) : <small className="nhlx-auto-meta">no active {row.team} {row.pos} with a projection</small>}
                </div>
              </div>
            ))}
          </div>
        )}
      {rows.length > SHOWN ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-sm-more" onClick={() => setAll((v) => !v)}>{all ? `Show the top ${SHOWN}` : `Show all ${rows.length}`}</button> : null}
    </article>
  );
}

/** The tab's body for the board the page holds; `game` = the head's dropdown pick, or every game. */
export function SheetMatchups({ board, game = null }) {
  const games = (board?.games || []).filter((g) => !game || g.id === game);
  if (!board?.games?.length) return <div className="nhlx-empty">No games on this date.</div>;
  const sheets = board.sources?.sheets?.length || 0;
  if (!board.games.some(hasSheet)) return <div className="nhlx-empty">{sheets ? 'The night’s cheat sheet carries no rank tiles the board could read (Data sources, on the Best plays tab, shows what was read).' : 'No cheat sheet for this date yet: drop the night’s sheet under Data sources on the Best plays tab, or save it in the Desktop/NBA folder.'}</div>;
  return (
    <div className="ir-sm">
      <p className="nhlx-auto-meta ir-sm-legend">Each game’s softest spots on the cheat sheet, both teams ranked together: the position and stat, the sheet’s rank (1st = the opponent gives up the most of the 30), PropFinder’s table beside it (green when it also has the spot in its soft third), and the team’s players there with their projection, the book’s line, the board’s chance and the edge. Click a player for his card.</p>
      {games.map((g) => <Game key={g.id} g={g} best={board.best || []} />)}
    </div>
  );
}

export default function NbaSheetMatchups({ board, game = null }) {
  return (
    <NbaPlayerCardProvider date={board?.date}>
      <SheetMatchups board={board} game={game} />
    </NbaPlayerCardProvider>
  );
}
