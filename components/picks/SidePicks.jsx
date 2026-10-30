'use client';

import { fmtOdds } from '@/lib/nfl/odds';
import { ICON } from '@/components/nhl/flags';
import { playLabel } from './Board';
import { asStated } from '@/lib/picks/calibration';

// The strip above a side's view (the top of each NBA court card; the NFL game, both sides side by
// side), the NHL rink's model plays for the picks boards: the board's best plays for the team
// (`side.picks`, lib/picks/board.js: the table rows over the floor, one a player, four at most),
// each with the chance, the book's price and the edge over its implied chance; after the game each
// carries its hit or miss from the box score, dashed and dimmed when the player has no box-score row.
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const shortName = (name) => { const parts = String(name || '').trim().split(' '); return parts.length > 1 ? parts.slice(1).join(' ') : name; };

function flagsOf(pl) {
  const out = [];
  if (pl.form === 'hot') out.push(['hot', `Hot: ${pct(pl.rates?.l5)} of his last ${pl.rates?.l5N ?? 5} over this line (colour only; the chance already carries the rate)`]);
  if (pl.form === 'cold') out.push(['cold', `Cold: ${pct(pl.rates?.l5)} of his last ${pl.rates?.l5N ?? 5} over this line`]);
  if (pl.spot?.soft) out.push(['soft', `Soft spot: the opponent is in the permissive third at his position for this stat (#${pl.spot.rank})`]);
  return out;
}

export default function SidePicks({ side, sport, final = false, onOpen = null, heading = true }) {
  const picks = side?.picks;
  if (!picks) return null;
  const graded = picks.map((pl) => ({ ...pl, dnp: !!final && pl.hit == null && pl.actual == null }));
  const scored = graded.filter((pl) => pl.hit != null);
  const note = !picks.length ? 'No play clears the floor' : scored.length ? `${scored.filter((pl) => pl.hit).length} of ${scored.length} hit` : final ? 'Not in the box score' : `${picks.length} over the floor`;
  return (
    <div className="nhlx-plays ir-side-picks" title="The board’s best plays for this team: the table rows over the floor, one a player, four at most; the pill is the book’s price with the edge over its implied chance in points">
      <div className="nhlx-plays-head">{heading && <b>Best plays · {side.team} {side.venue === 'H' ? 'vs' : 'at'} {side.opp}</b>}<small className="nhlx-auto-meta">{note}</small></div>
      {graded.length > 0 && (
        <div className="nhlx-plays-row">
          {graded.map((pl) => {
            const flags = flagsOf(pl);
            const outcome = pl.hit == null ? (pl.dnp ? ' · did not play' : '') : ` · ${pl.hit ? 'HIT' : 'MISS'}: ${pl.actual} ${pl.unit}`;
            const price = pl.odds != null ? `${fmtOdds(pl.odds)}${pl.edge != null ? `, ${pl.edge >= 0 ? '+' : ''}${Math.round(pl.edge * 100)} pts of edge` : ''}` : 'no price';
            return (
              <button key={pl.id} type="button" className={`nhlx-play${onOpen ? '' : ' is-static'}${pl.hit == null ? (pl.dnp ? ' is-dnp' : '') : pl.hit ? ' is-hit' : ' is-miss'}`} onClick={() => onOpen?.(pl)} title={`${pl.player} · ${playLabel(pl)} ${pct(pl.p)}${asStated(pl.raw)}, break-even ${pl.fair} · ${price}${pl.confirmed ? ' · on the cheat sheet' : ''}${outcome}`}>
                {pl.espnId ? <img src={sport.headshotUrl(pl.espnId)} alt="" width="26" height="26" loading="lazy" /> : <img src={sport.teamLogo(side.team)} alt="" width="26" height="26" loading="lazy" className="ir-nfl-logo" />}
                <span className="nhlx-play-meta">
                  <b>{shortName(pl.player)}{flags.length ? <span className="nhlx-pk-flags">{flags.map(([k, t]) => <i key={k} className={`nhlx-pk-flag is-${k}`} title={t} aria-label={t}>{ICON[k]}</i>)}</span> : null}</b>
                  <span>{playLabel(pl)} <em>{pct(pl.p)}</em>{pl.hit != null ? <> · <strong className="nhlx-play-got">{pl.actual} {pl.unit}</strong></> : pl.dnp ? <> · DNP</> : null}</span>
                </span>
                {pl.odds != null ? <span className={`nhlx-edge${pl.edge != null && pl.edge > 0 ? ' is-soft' : ''}`}>{fmtOdds(pl.odds)}{pl.edge != null ? ` · ${pl.edge >= 0 ? '+' : '−'}${Math.abs(Math.round(pl.edge * 100))}` : ''}</span> : null}
                {pl.hit != null ? <i className={`nhlx-play-mark ${pl.hit ? 'is-hit' : 'is-miss'}`} aria-label={pl.hit ? 'hit' : 'miss'}>{pl.hit ? '✓' : '✗'}</i> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
