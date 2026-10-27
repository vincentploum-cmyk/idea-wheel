import { authorize, DATE_RE, todayET, addDays } from '@/lib/nhl-data/util';
import { readJson, dataRevision } from '@/lib/nhl-store';
import { asyncMemo } from '@/lib/memo';
import { loadRows } from '@/lib/nhl-data/build';
import { positionsPath } from '@/lib/nhl-data/positions';
import { defenseByPosition, defenseBySlot, blendedDefense, firstGoalsAllowed } from '@/lib/nhl-data/defense';
import { gamesFor, buildSlate } from '@/lib/nhl-data/slate';
import { loadMoneyPuck } from '@/lib/nhl-data/moneypuck';
import { skaterStreaks } from '@/lib/nhl-data/streaks';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin: what every team allows to each position, at home and away (`season` = this season
// blended into last season's table per skater at the position, the study's read; `l10` / `l5`
// = the last games stored, across the season boundary), the same per line slot (LW1 … RW4,
// D1 … D3) under `slots`, from the games logged with a line, and the first goals each team
// gives up under `firstGoals`.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const asOf = url.searchParams.get('date') || todayET();
  if (!DATE_RE.test(asOf)) return Response.json({ error: 'bad date' }, { status: 400 });
  return Response.json(await buildDefense(asOf), { headers: { 'Cache-Control': 'no-store' } });
}

// The payload is kept per store state (lib/memo.js): the Defense tab and the Teams tab both open on
// it, and the tables, the slate and the streaks are the same until a game or lineup is stored.
const memo = asyncMemo({ ttl: 15 * 60 * 1000, max: 4, revision: dataRevision });
const inputs = (asOf) => () => Promise.all([loadRows(addDays(asOf, 1)), buildSlate(asOf).catch(() => null), readJson(positionsPath(asOf)), loadMoneyPuck().catch(() => null)]);
const buildDefense = (asOf) => memo(asOf, inputs(asOf), () => computeDefense(asOf));

async function computeDefense(asOf) {
  // loadRows is strictly-before; include games played on the date itself.
  const rows = await loadRows(addDays(asOf, 1));
  const season = blendedDefense(rows, asOf);
  const l10 = defenseByPosition(rows, { lastN: 10 });
  const l5 = defenseByPosition(rows, { lastN: 5 });
  const slots = { season: defenseBySlot(rows), l10: defenseBySlot(rows, { lastN: 10 }), l5: defenseBySlot(rows, { lastN: 5 }) };
  // First goals given up, by venue, position and line slot (`firstGoals.season.teams.NJD.H.bySlot.LW1`).
  const firstGoals = { season: firstGoalsAllowed(rows), l10: firstGoalsAllowed(rows, { lastN: 10 }) };
  // The Defense tab: the date's games (for tonight's matchup reads) and MoneyPuck's team rates.
  const [tonight, mp, slate] = await Promise.all([gamesFor(asOf).catch(() => []), loadMoneyPuck().catch(() => ({ teams: null })), buildSlate(asOf).catch(() => null)]);
  // Tonight's lineups (the slate's: beat writers' lines, else the preview, else the roster), so the matchup
  // reads can name the shooters at a defender's softest spot: per game, per side, the skaters in the lineup
  // with position, line slot and the saved run's λ shots / goals when a run exists.
  const sidesById = Object.fromEntries((slate?.games || []).map((g) => [g.id, (g.sides || []).map((s) => ({
    team: s.team, source: s.source || null,
    // lamS / lamG = the saved run's λ when a run exists; sog / g = his stored rate a game (the slate's baseline window) as the fallback order
    skaters: (s.skaters || []).filter((p) => p.inLineup && p.id != null).map((p) => ({ id: p.id, name: p.name, pos: p.pos, line: p.line ?? null, carried: !!p.carried, lamS: p.model?.sog ?? null, lamG: p.model?.g ?? null, sog: p.sog ?? null, g: p.g ?? null, gp: p.gp ?? 0 })),
  }))]));
  // The stored box score, once a game is final: the score and every skater's shots and goals by id, so the
  // matchup reads can grade the shooters they named.
  const resultById = Object.fromEntries((slate?.games || []).filter((g) => g.log?.skaters).map((g) => [g.id, {
    score: g.log.score || null,
    skaters: Object.fromEntries(g.log.skaters.filter((s) => s.id != null).map((s) => [s.id, { sog: Number(s.sog) || 0, g: Number(s.g) || 0 }])),
  }]));
  const all = mp?.teams?.situations?.all || {};
  const moneypuck = {
    year: mp?.teams?.year ?? null, updatedAt: mp?.teams?.updatedAt ?? null,
    teams: Object.fromEntries(Object.entries(all).map(([a, t]) => [a, { gp: t.gp ?? null, ga60: t.ga60 ?? null, sa60: t.sa60 ?? null, xga60: t.xga60 ?? null, hdsa60: t.hdsa60 ?? null, pace60: t.pace60 ?? null }])),
  };
  return {
    asOf, games: new Set(rows.map((r) => r.gameId)).size, season, l10, l5, slots, firstGoals,
    tonight: (tonight || []).map((g) => ({ id: g.id, away: g.away, home: g.home, startTimeUTC: g.startTimeUTC || null, sides: sidesById[g.id] || null, result: resultById[g.id] || null })),
    moneypuck,
    // Who is running hot (this season's stored games): goal / point / 3+ SOG streaks, the last game, tonight's opponent.
    streaks: skaterStreaks(rows, { date: asOf, games: tonight || [] }),
  };
}
