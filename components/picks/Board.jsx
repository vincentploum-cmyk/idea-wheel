'use client';

import { useState } from 'react';
import { fmtOdds } from '@/lib/nfl/odds';
import { asStated } from '@/lib/picks/calibration';
import { fmtEv, passes, orderBy, DEFAULTS } from '@/lib/picks/value';
import { RowBadges } from './badges';
import { ICON } from '@/components/nhl/flags';
import { GameCharacteristics } from '@/components/nhl/Characteristics';
import { MatchupProfile } from '@/components/nhl/MatchupProfile';

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const fmtStart = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const last = (name) => String(name || '').split(' ').slice(-1)[0];

/** "o245.5 Pass yards" / "u27.5 Points" / the market's name for a yes play. */
export function playLabel(r) {
  if (r.side === 'yes') return r.line > 0.5 && r.unit === 'TD' && r.market === 'two_td' ? '2+ TD' : r.label;
  if (r.side === 'no') return `No ${r.label}`;
  return `${r.side === 'under' ? 'u' : 'o'}${r.line} ${r.label}`;
}

function Flags({ r }) {
  const out = [];
  if (r.form === 'hot') out.push(['hot', `Hot: ${pct(r.rates.l5)} of his last ${r.rates.l5N} over this line (colour only; the chance already carries the rate)`]);
  if (r.form === 'cold') out.push(['cold', `Cold: ${pct(r.rates.l5)} of his last ${r.rates.l5N} over this line`]);
  if (r.spot?.soft) out.push(['soft', `Soft spot: ${r.opp} allows ${r.spot.value} ${r.unit} per game to ${r.pos}s, #${r.spot.rank} of ${r.spot.teams} (the soft third)`]);
  if (!out.length) return null;
  return <span className="nhlx-pk-flags">{out.map(([kind, title]) => <i key={kind} className={`nhlx-pk-flag is-${kind}`} title={title} aria-label={title}>{ICON[kind]}</i>)}</span>;
}

function Row({ r, final, sport }) {
  const grade = r.hit == null ? (final && r.actual === null ? ' is-dnp' : '') : r.hit ? ' is-hit' : ' is-miss';
  const source = r.confirmed ? '✓ on the sheet' : r.sheetOnly ? 'sheet only' : r.pfBacked ? 'PropFinder' : 'sheet';
  const sourceTitle = r.confirmed ? `PropFinder play, confirmed by ${r.sheetFiles.join(', ')}` : r.sheetOnly ? 'Only on a cheat sheet: PropFinder lists no line or log for it' : r.pfBacked ? 'From PropFinder’s logs and lines' : `From ${r.sheetFiles.join(', ')}`;
  const windows = [['L5', r.rates.l5, r.rates.l5N], ['L10', r.rates.l10], ['Season', r.rates.season, r.rates.n], ['H2H', r.rates.h2h]].filter(([, v]) => v != null).map(([k, v, n]) => `${k} ${pct(v)}${n ? ` (${n})` : ''}`).join(' · ');
  const title = [
    `${r.player} · ${playLabel(r)} · ${r.sources.join(' + ')}`,
    windows ? `Over the line: ${windows} (${r.rates.from === 'logs' ? 'PropFinder logs' : 'the cheat sheet'})` : null,
    r.avg?.season != null ? `Average: L5 ${r.avg.l5 ?? '—'} · L10 ${r.avg.l10 ?? '—'} · season ${r.avg.season}` : null,
    r.proj != null ? `Sheet projection ${r.proj}` : null, r.rating ? `Sheet rating ${r.rating}` : null, r.injury ? `Injury report: ${r.injury}${r.injuryDetail ? ` (${r.injuryDetail})` : ''}` : null,
    r.without ? `Without ${r.without.names.join(' + ')} (${r.without.absent.map((a) => a.status).join(', ')}): ${pct(r.without.rate)} over in ${r.without.n} game${r.without.n === 1 ? '' : 's'}, ${r.without.avg ?? '—'} ${r.unit} a game; the season read moved from ${pct(r.without.seasonAll)} to ${pct(r.rates.season)} (weight ${r.without.weight})` : null,
    r.under ? `Marginal: ${r.fails ? FAIL_WORD[r.fails] || r.fails : 'fails a floor'}, listed to make three` : null,
    r.sheetOnly ? 'Sheet only: PropFinder lists no line or log for it, so it fills in behind PropFinder’s plays' : null,
    r.hit == null ? (final && r.actual === null ? 'No box-score line (did not play)' : null) : `${r.hit ? 'Hit' : 'Miss'}: ${r.actual} ${r.unit} in the box score`,
  ].filter(Boolean).join('\n');
  const evTone = r.ev == null ? 'none' : r.ev >= DEFAULTS.minEv ? 'good' : r.ev > 0 ? 'thin' : 'bad';
  return (
    <tr className={`${r.under || r.sheetOnly ? 'is-under' : ''}${r.confirmed ? ' is-confirmed' : ''}${grade}`} title={title}>
      <td>
        <div className="nhlx-db-player">
          {r.espnId ? <img src={sport.headshotUrl(r.espnId)} alt="" width="30" height="30" loading="lazy" /> : <img src={sport.teamLogo(r.team)} alt="" width="30" height="30" loading="lazy" className="ir-nfl-logo" />}
          <span><b>{r.player}<Flags r={r} /></b><small>{r.team}{r.pos ? ` · ${r.pos}` : ''} · {r.venue === 'H' ? 'vs' : 'at'} {r.opp}{r.injury ? ` · ${r.injury}` : ''}{r.without ? ` · w/o ${r.without.names.join(' + ')}` : ''}<RowBadges r={r} /></small></span>
        </div>
      </td>
      <td className="ir-nfl-play"><b>{playLabel(r)}</b><small title={sourceTitle} className={r.confirmed ? 'is-confirmed' : ''}>{source}{r.fails ? ` · ${FAIL_WORD[r.fails] || r.fails}` : ''}</small></td>
      <td className={`is-num is-lead ir-ev-${evTone}${r.hit == null ? '' : r.hit ? ' is-hit' : ' is-miss'}`} title={r.ev != null ? `${fmtEv(r.ev)} a unit at ${fmtOdds(r.odds)} on ${pct(r.p)}; the edge over the book's ${pct(r.implied)} under it` : 'No price: no value to read'}><b>{fmtEv(r.ev)}</b><small>{r.edge == null ? '—' : `${r.edge >= 0 ? '+' : ''}${Math.round(r.edge * 100)} pts`}</small></td>
      <td className="is-num"><b>{fmtOdds(r.odds)}</b><small>{r.odds == null ? (r.book || '—') : `implies ${pct(r.implied)}`}</small></td>
      <td className="is-num" title={r.raw != null ? `${pct(r.p)} calibrated${asStated(r.raw)}` : undefined}><b>{pct(r.p)}</b><small>{r.fair}</small></td>
      {final ? <td className="is-num nhlx-pk-got">{r.actual === undefined ? <small title="The box score has no figure for this market">—</small> : r.actual === null ? <small>DNP</small> : <><b>{r.actual}</b><small>{r.unit}</small></>}</td> : null}
    </tr>
  );
}
const FAIL_WORD = { price: 'no price', juice: 'past the juice ceiling', ev: 'under the EV floor', chance: 'under the chance floor', thin: 'thin minutes', out: 'out' };

/**
 * One market group's table: the rows clearing the value floors, the best value first, EV the lead column with the
 * price beside it (the brief of 2026-10-31); the marginal rows (failing a floor) behind "show marginal" — the panel's
 * switch (`marginal`), or the table's own button without one. With `filters` the rows are read again at the user's
 * floors (a row the server shows that fails them moves to marginal, and the other way round).
 */
export function GroupTable({ label, t, final, sport, marginal: marginalProp = null, filters = null }) {
  const [ownMarginal, setOwnMarginal] = useState(false);
  const showMarginal = marginalProp ?? ownMarginal;
  const all = [...t.rows, ...(t.marginal || t.next || [])];
  const f = filters ? { ...DEFAULTS, ...filters } : null;
  const order = orderBy(f?.sort === 'chance' ? 'chance' : 'ev');
  const rows = f ? all.filter((r) => passes(r, f) && !r.under).sort(order) : t.rows;
  const rest = f ? all.filter((r) => !rows.some((x) => x.id === r.id)).map((r) => ({ ...r, under: true })).sort(order) : (t.marginal || t.next || []);
  const cols = final ? 6 : 5;
  return (
    <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
      <table className="nhlx-db-table nhlx-pk-table ir-nfl-table">
        <thead>
          <tr>
            <th>{label}{t.fallback && !rows.length ? <i className="nhlx-fg-rank"> nobody clears the floors</i> : null}</th>
            <th title="The side and the line">Play</th>
            <th className="is-num is-lead" title="Expected value: the return a unit staked at the book’s price on the board’s chance; the edge over the book’s implied chance under it (points)">EV</th>
            <th className="is-num" title="The book’s price, and the chance it implies under it">Price</th>
            <th className="is-num" title="The board’s chance of the hit, and the break-even price under it">Chance</th>
            {final ? <th className="is-num" title="The box-score figure">Got</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((r) => <Row key={r.id} r={r} final={final} sport={sport} />) : <tr><td colSpan={cols}><small className="ir-nfl-none">{all.length ? `No ${label.toLowerCase()} play clears the floors${rest.length ? ` · ${rest.length} marginal` : ''}.` : `No ${label.toLowerCase()} line for this game yet.`}</small></td></tr>}
          {showMarginal && rest.length ? rest.map((r) => <Row key={r.id} r={r} final={final} sport={sport} />) : null}
        </tbody>
      </table>
      {rest.length && marginalProp == null ? <button type="button" className="nhlx-btn nhlx-btn-ghost nhlx-btn-sm ir-marginal-btn" aria-pressed={ownMarginal} onClick={() => setOwnMarginal((v) => !v)}>{ownMarginal ? 'Hide' : 'Show'} marginal ({rest.length})</button>
        : rest.length && !showMarginal ? <p className="nhlx-pk-next">Marginal: {rest.slice(0, 4).map((r) => `${last(r.player)} ${playLabel(r)} ${fmtEv(r.ev)}${r.sheetOnly ? ' (sheet)' : ''}`).join(' · ')}{rest.length > 4 ? ` · ${rest.length - 4} more` : ''}</p> : null}
    </div>
  );
}

/** The one-line summary of a game (the brief's level 2 header): the leak badge, how many +EV plays, the top one with its EV. */
export function GameSummary({ g, matchup = null }) {
  const m = matchup || g.matchup || null;
  const leak = m?.leak || null;
  const top = m?.topPlay || null;
  return (
    <>
      {leak ? Object.entries(leak.teams || {}).filter(([, t]) => t.tier > 0).map(([abbr, t]) => <span key={abbr} className="nhlx-edge is-soft ir-gf-meta" title={[t.from?.allows, t.from?.spots ? `soft spots ${t.from.spots.toLowerCase()}` : null].filter(Boolean).join(' · ') || t.word}>{abbr} {t.word.toLowerCase()}</span>) : null}
      {m ? <span className="ir-gf-meta" title="Plays clearing the value floors">{m.breadth} +EV</span> : null}
      <span className="ir-gf-best">{top ? <>Top: <b>{top.player}</b> {playLabel(top)} · <em className={`ir-ev-${top.ev >= DEFAULTS.minEv ? 'good' : 'thin'}`}>{fmtEv(top.ev)}</em> at {fmtOdds(top.odds)}</> : 'No play clears the floors'}</span>
      {m ? <span className="ir-gf-score" title="Matchup Score: the top three plays’ EV, the breadth, the leak tier, the spread"><b>{m.score}</b></span> : null}
    </>
  );
}

function GameHead({ g, sport, open = null, onToggle = null, matchup = null, bodyId = null }) {
  const head = (
    <>
      <span className="ir-gf-teams">
        <img src={sport.teamLogo(g.away)} alt="" width="28" height="28" loading="lazy" />{g.away}
        <i>@</i>
        <img src={sport.teamLogo(g.home)} alt="" width="28" height="28" loading="lazy" />{g.home}
      </span>
      <span className="ir-gf-meta">
        {g.final ? `Final ${g.awayScore}–${g.homeScore}` : g.state === 'in' ? `Live ${g.awayScore}–${g.homeScore} · ${g.detail}` : fmtStart(g.date)}
        {g.preseason ? ' · preseason' : ''}
        {g.odds?.spread ? ` · ${g.odds.spread}${g.odds.total ? `, o/u ${g.odds.total}` : ''}` : ''}
        {g.tally ? ` · ${g.tally.hit} of ${g.tally.of} hit` : ''}
      </span>
      <GameSummary g={g} matchup={matchup} />
    </>
  );
  if (!onToggle) return <div className="ir-gf-head is-static">{head}</div>;
  return (
    <button type="button" className="ir-gf-head" aria-expanded={!!open} aria-controls={bodyId || undefined} onClick={() => onToggle(!open)}>
      {head}
      <svg className="ir-gf-caret" aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
    </button>
  );
}

/** The characteristics card's team mark on a picks board: the sport's logo and the code. */
export const teamMark = (sport) => function TeamMark(abbr) {
  return <><img src={sport.teamLogo(abbr)} alt="" width="22" height="22" loading="lazy" className="ir-nfl-logo" /><b>{abbr}</b></>;
};

/** The card's head pill: the sides' expected total tonight for the sport's total stat (the NBA's points), when both carry one. */
export function expectedPill(g, sport) {
  if (!sport.totalStat) return null;
  const a = g.sides?.[g.away]?.teamProj?.[sport.totalStat]; const h = g.sides?.[g.home]?.teamProj?.[sport.totalStat];
  if (a == null || h == null) return null;
  const unit = sport.totalUnit || sport.totalStat;
  return { text: `${Math.round(a + h)} ${unit} expected · ${g.away} ${Math.round(a)} · ${g.home} ${Math.round(h)}`, tone: '', title: `Each side's expected ${unit} tonight: its own per-game figure through the opponent's environment, pro-rated to its priced players (PropFinder)` };
}

/** The notes under a slate, written from the plays. */
export function BoardNotes({ notes }) {
  if (!notes?.length) return null;
  return (
    <section className="nhlx-pk-notes" aria-label="Notes">
      <h3>Notes</h3>
      <ul>{notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
    </section>
  );
}

/**
 * The board of one slate for a sport: { groups: [[key, label]], teamLogo, teamName, headshotUrl,
 * totalStat?, totalUnit? }. Per game the matchup profile (the NHL card on the sport's `profile`, the NFL's from
 * lib/nfl/profile.js; the characteristics card for a game without one), then the sport's tables; a game without a play collapses to one line; the notes under the
 * slate. `before(game)` renders a sport's own view (the NBA court pair) between the game head and the tables.
 */
/**
 * Since the restructure of 2026-10-31 every game is folded to one line (the matchup, the tip, the leak badge, how many
 * +EV plays, the top one with its EV, the Matchup Score) and opens on a press; `ranked` ([{ game, matchup }], the
 * overview's order) sorts them, `open` (a Set of ids) and `onToggle(id, next)` hold the state when the parent does,
 * `filters` re-reads the tables at the user's floors, `marginal` shows the rows that fail them.
 */
export default function Board({ board, sport, empty = 'No games on this slate.', before = null, ranked = null, open = null, onToggle = null, filters = null, marginal = null, picked = null }) {
  const [ownOpen, setOwnOpen] = useState(() => new Set());
  if (!board?.games?.length) return <div className="nhlx-empty">{empty}</div>;
  const mark = teamMark(sport);
  const list = ranked ? ranked.map((r) => ({ g: r.game, matchup: r.matchup })) : board.games.map((g) => ({ g, matchup: g.matchup || null }));
  const openSet = open || ownOpen;
  const toggle = (id, next) => { if (onToggle) onToggle(id, next); else setOwnOpen((prev) => { const s = new Set(prev); if (next) s.add(id); else s.delete(id); return s; }); };
  return (
    <>
      {list.filter(({ g }) => !picked || g.id === picked).map(({ g, matchup }, i) => {
        const isOpen = picked ? true : openSet.has(g.id);
        const bodyId = `game-${g.id}`;
        return (
          <article key={g.id} className={`ir-gf${isOpen ? ' is-open' : ''}`} id={bodyId}>
            <GameHead g={g} sport={sport} open={isOpen} onToggle={picked ? null : (next) => toggle(g.id, next)} matchup={matchup} bodyId={`${bodyId}-body`} />
            {isOpen ? (
              <div className="ir-gf-body" id={`${bodyId}-body`}>
                {g.profile ? <MatchupProfile profile={g.profile} renderTeam={mark} /> : g.characteristics ? <GameCharacteristics game={g} renderTeam={mark} pill={expectedPill(g, sport)} /> : null}
                {before ? before(g) : null}
                {g.plays ? (
                  <div className="ir-nfl-grid">
                    {sport.groups.map(([key, label]) => <GroupTable key={key} label={label} t={g.tables[key]} final={g.final} sport={sport} filters={filters} marginal={marginal} />)}
                  </div>
                ) : <p className="ir-nfl-nogame">{g.steep ? `No plays: the ${g.steep} line${g.steep === 1 ? '' : 's'} PropFinder lists ${g.steep === 1 ? 'is' : 'are'} priced past -400, no play at that price.` : 'No plays yet: no cheat-sheet row or PropFinder line for either team.'}</p>}
              </div>
            ) : null}
          </article>
        );
      })}
      <BoardNotes notes={board.notes} />
    </>
  );
}
