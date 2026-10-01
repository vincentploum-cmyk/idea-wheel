// Plain-language reads of a team for the Matchups fixture and the team page:
// how leaky or tight its defense is (rank 1 = allows the most of the league),
// where it leaks by position, how its last 10 games compare, its offense and
// its pace (MoneyPuck). Pure functions over data the slate already carries.

/** Thirds of the league: rank 1 = allows the most. */
export function defenseTier(rank, teams = 32) {
  if (!rank || !teams) return null;
  const third = Math.ceil(teams / 3);
  if (rank <= third) return 'leaky';
  if (rank > teams - third) return 'tight';
  return 'average';
}

export const TIER_TEXT = { leaky: 'Leaky defense', average: 'Average defense', tight: 'Tight defense' };
export const TIER_TONE = { leaky: 'is-soft', tight: 'is-tough', average: '' };

/** Pace thirds: rank 1 = most shot attempts for + against per 60. */
export function paceTier(rank, teams = 32) {
  const t = defenseTier(rank, teams);
  return t === 'leaky' ? 'fast' : t === 'tight' ? 'slow' : t;
}

const VENUE_TEXT = { H: 'at home', A: 'away' };
const POS_ORDER = ['LW', 'C', 'RW', 'D'];

/**
 * A verdict for one side of a game. `defense` is the side's defense object from
 * the slate (keyed by position + All, each with season/rank/l10/l10Rank and the
 * `windows`), read for the *opponent* of that side; so pass the other side's
 * object to describe this team. `mp` is the slate's moneypuck block.
 * Returns { team, venue, tier, headline, lines: [{ key, text, tone }] } or null.
 */
export function teamVerdict({ team, venue, defense, teamCount = 32, mp = null }) {
  if (!team || !defense) return null;
  const all = defense.All || {};
  const n = all.teamCount || teamCount;
  const rank = all.rank?.sog ?? null;
  const tier = defenseTier(rank, n);
  const lines = [];
  const where = VENUE_TEXT[venue] || '';

  // Defense at this venue: shots and goals allowed per game, ranked.
  if (all.season?.gp) {
    lines.push({
      key: 'defense', tone: TIER_TONE[tier] || '',
      text: `${TIER_TEXT[tier] || 'Defense'} ${where}: allows ${all.season.sog.toFixed(1)} SOG (#${rank ?? '–'}) and ${all.season.g.toFixed(2)} goals (#${all.rank?.g ?? '–'}) per game${all.source === 'propfinder' ? `, PropFinder ${all.seasonLabel || 'last season'}` : ` over ${all.season.gp} games`}.`,
    });
  }

  // By position: where it leaks and where it holds.
  const byPos = POS_ORDER.map((pos) => ({ pos, rank: defense[pos]?.rank?.sog ?? null, n: defense[pos]?.teamCount || n })).filter((p) => p.rank);
  const leaks = byPos.filter((p) => defenseTier(p.rank, p.n) === 'leaky').sort((a, b) => a.rank - b.rank);
  const holds = byPos.filter((p) => defenseTier(p.rank, p.n) === 'tight').sort((a, b) => b.rank - a.rank);
  if (leaks.length || holds.length) {
    const parts = [];
    if (leaks.length) parts.push(`leaks shots to ${leaks.map((p) => `${p.pos} (#${p.rank})`).join(', ')}`);
    if (holds.length) parts.push(`holds ${holds.map((p) => `${p.pos} (#${p.rank})`).join(', ')}`);
    lines.push({ key: 'positions', tone: leaks.length ? 'is-soft' : 'is-tough', text: `${parts.join(' · ')}.`.replace(/^./, (c) => c.toUpperCase()) });
  }

  // Trend: the last 10 games (all venues) against the season rank at this venue.
  const l10Rank = all.l10Rank?.sog ?? null;
  if (all.l10?.gp && l10Rank) {
    const l10Tier = defenseTier(l10Rank, n);
    const drift = rank ? l10Rank - rank : 0;
    const trend = drift <= -5 ? 'loosening' : drift >= 5 ? 'tightening' : 'steady';
    lines.push({ key: 'trend', tone: trend === 'loosening' ? 'is-soft' : trend === 'tightening' ? 'is-tough' : '', text: `Last 10: ${all.l10.sog.toFixed(1)} SOG allowed (#${l10Rank}, ${l10Tier}) · ${trend}.` });
  }

  // Offense and pace from MoneyPuck, all situations.
  const t = mp?.situations?.all?.[team];
  const r = mp?.ranks?.all?.[team];
  if (t && r) {
    const mpN = mp.teams || Object.keys(mp.situations.all).length || 32;
    const off = [];
    if (t.sf60 != null) off.push(`${t.sf60.toFixed(1)} SF/60 (#${r.sf60 ?? '–'})`);
    if (t.xgf60 != null) off.push(`${t.xgf60.toFixed(2)} xGF/60 (#${r.xgf60 ?? '–'})`);
    if (off.length) {
      const offTier = defenseTier(r.sf60, mpN); // rank 1 = most shots for
      lines.push({ key: 'offense', tone: offTier === 'leaky' ? 'is-soft' : offTier === 'tight' ? 'is-tough' : '', text: `Offense: ${off.join(', ')}${offTier === 'leaky' ? ' · high volume' : offTier === 'tight' ? ' · low volume' : ''}.` });
    }
    const pace = t.pace60 ?? (t.cf60 != null && t.ca60 != null ? +(t.cf60 + t.ca60).toFixed(1) : null);
    if (pace != null) {
      const pTier = paceTier(r.pace60, mpN);
      lines.push({ key: 'pace', tone: pTier === 'fast' ? 'is-soft' : pTier === 'slow' ? 'is-tough' : '', text: `Pace: ${pace.toFixed(1)} shot attempts/60 both ways${r.pace60 ? ` (#${r.pace60}, ${pTier})` : ''}.` });
    }
  }
  if (!lines.length) return null;
  const headline = tier ? `${TIER_TEXT[tier]} ${where}` : 'No defense read yet';
  return { team, venue, tier, rank, headline, lines };
}
