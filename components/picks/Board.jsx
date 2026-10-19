'use client';

import { fmtOdds } from '@/lib/nfl/odds';
import { ICON } from '@/components/nhl/flags';

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
  const windows = [['L5', r.rates.l5, r.rates.l5N], ['L10', r.rates.l10], ['Season', r.rates.season, r.rates.n], ['H2H', r.rates.h2h]].filter(([, v]) => v != null).map(([k, v, n]) => `${k} ${pct(v)}${n ? ` (${n})` : ''}`).join(' · ');
  const title = [
    `${r.player} · ${playLabel(r)} · ${r.sources.join(' + ')}`,
    windows ? `Over the line: ${windows} (${r.rates.from === 'logs' ? 'PropFinder logs' : 'the cheat sheet'})` : null,
    r.avg?.season != null ? `Average: L5 ${r.avg.l5 ?? '—'} · L10 ${r.avg.l10 ?? '—'} · season ${r.avg.season}` : null,
    r.proj != null ? `Sheet projection ${r.proj}` : null, r.rating ? `Sheet rating ${r.rating}` : null, r.injury ? `Injury: ${r.injury}` : null,
    r.under ? 'Under the floor: listed to make three' : null,
    r.hit == null ? (final && r.actual === null ? 'No box-score line (did not play)' : null) : `${r.hit ? 'Hit' : 'Miss'}: ${r.actual} ${r.unit} in the box score`,
  ].filter(Boolean).join('\n');
  return (
    <tr className={`${r.under ? 'is-under' : ''}${grade}`} title={title}>
      <td>
        <div className="nhlx-db-player">
          {r.espnId ? <img src={sport.headshotUrl(r.espnId)} alt="" width="30" height="30" loading="lazy" /> : <img src={sport.teamLogo(r.team)} alt="" width="30" height="30" loading="lazy" className="ir-nfl-logo" />}
          <span><b>{r.player}<Flags r={r} /></b><small>{r.team}{r.pos ? ` · ${r.pos}` : ''} · {r.venue === 'H' ? 'vs' : 'at'} {r.opp}{r.injury ? ` · ${r.injury}` : ''}</small></span>
        </div>
      </td>
      <td className="ir-nfl-play"><b>{playLabel(r)}</b><small>{r.rates.from === 'logs' ? 'logs' : 'sheet'}{r.sources.length > 1 ? ' + sheet' : ''}</small></td>
      <td className={`is-num is-lead${r.hit == null ? '' : r.hit ? ' is-hit' : ' is-miss'}`}><b>{pct(r.p)}</b><small>{r.fair}</small></td>
      <td className="is-num is-wide"><b>{fmtOdds(r.odds)}</b><small>{r.edge == null ? (r.book || '—') : `${r.edge >= 0 ? '+' : ''}${Math.round(r.edge * 100)} pts`}</small></td>
      {final ? <td className="is-num nhlx-pk-got">{r.actual === null || r.actual === undefined ? <small>DNP</small> : <><b>{r.actual}</b><small>{r.unit}</small></>}</td> : null}
    </tr>
  );
}

function GroupTable({ label, t, final, sport }) {
  return (
    <div className="nhlx-db-table-wrap nhlx-pk-table-wrap">
      <table className="nhlx-db-table nhlx-pk-table ir-nfl-table">
        <thead>
          <tr>
            <th>{label}{t.fallback ? <i className="nhlx-fg-rank"> nobody over the floor: best available</i> : null}</th>
            <th title="The side and the line">Play</th>
            <th className="is-num" title="The chance of the hit, and the break-even price under it">Chance</th>
            <th className="is-num is-wide" title="The book’s price, and the edge over its implied chance under it (points)">Price</th>
            {final ? <th className="is-num" title="The box-score figure">Got</th> : null}
          </tr>
        </thead>
        <tbody>
          {t.rows.length ? t.rows.map((r) => <Row key={r.id} r={r} final={final} sport={sport} />) : <tr><td colSpan={final ? 5 : 4}><small className="ir-nfl-none">No {label.toLowerCase()} line for this game yet.</small></td></tr>}
        </tbody>
      </table>
      {t.next.length ? <p className="nhlx-pk-next">Next: {t.next.map((r) => `${last(r.player)} ${playLabel(r)} ${pct(r.p)}`).join(' · ')}</p> : null}
    </div>
  );
}

function GameHead({ g, sport }) {
  return (
    <div className="nhlx-mu-game-head ir-nfl-game-head">
      <img src={sport.teamLogo(g.away)} alt="" width="34" height="34" loading="lazy" />
      <span>{sport.teamName(g.away)}</span>
      <i>@</i>
      <img src={sport.teamLogo(g.home)} alt="" width="34" height="34" loading="lazy" />
      <span>{sport.teamName(g.home)}</span>
      <small className="ir-nfl-game-meta">
        {g.final ? `Final ${g.awayScore}–${g.homeScore}` : g.state === 'in' ? `Live ${g.awayScore}–${g.homeScore} · ${g.detail}` : fmtStart(g.date)}
        {g.preseason ? ' · preseason' : ''}
        {g.odds?.spread ? ` · ${g.odds.spread}${g.odds.total ? `, o/u ${g.odds.total}` : ''}` : ''}
        {g.tally ? ` · ${g.tally.hit} of ${g.tally.of} plays hit` : ''}
      </small>
    </div>
  );
}

/**
 * The board of one slate for a sport: { groups: [[key, label]], teamLogo, teamName, headshotUrl }.
 * Per game the sport's tables; a game without a play collapses to one line; the notes under the slate.
 */
export default function Board({ board, sport, empty = 'No games on this slate.' }) {
  if (!board?.games?.length) return <div className="nhlx-empty">{empty}</div>;
  return (
    <>
      {board.games.map((g, i) => (
        <article key={g.id} className={`nhlx-mu-game${i === 0 ? ' is-first' : ''}`}>
          <GameHead g={g} sport={sport} />
          {g.plays ? (
            <div className="ir-nfl-grid">
              {sport.groups.map(([key, label]) => <GroupTable key={key} label={label} t={g.tables[key]} final={g.final} sport={sport} />)}
            </div>
          ) : <p className="ir-nfl-nogame">No plays yet: no cheat-sheet row or PropFinder line for either team.</p>}
        </article>
      ))}
      {board.notes?.length ? (
        <section className="nhlx-pk-notes" aria-label="Notes">
          <h3>Notes</h3>
          <ul>{board.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
        </section>
      ) : null}
    </>
  );
}
