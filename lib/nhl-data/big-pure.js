// The NHL's big games (Vincent, 2026-11-01: "Do the same big games study for the NHL"; docs/audits/2026-11-01-nhl-big-games.md,
// tools/audit/nhl_big.py): the night's likeliest 5+ / 6+ shots on goal and 2+ goals. Unlike the NFL and the NBA, nothing
// beside the board's own λ found the big nights on both checks (2025-26 Nov–Jan → Feb–Apr, 2025-26 → 2026-27): his record of
// big nights over his last 20, his attempts, ice time, line, chances, the opponent's shots allowed and its table at his
// position, the goalie, pace, rest and home all moved the Brier by less than the noise, every figure at once and the trees
// did worse, and the mined rules fell from 30–50% on the fit to 0–23% on the checks. What the study did find is the level:
// a plain Poisson tail of the λ understates the big shot nights (5+ said 7.7%, landed 9.0%; 6+ 3.0% / 3.7%; 7+ 1.1% /
// 1.6%), which is what the calibration the board prints with corrects. So the tab is the board's own chance at the mark,
// as the shuffle prints it (`chanceAt` on the board's read, calibrated), ranked, with how often he has done it beside it.
// Pure, client-safe: the panel runs it on the shuffle's payload (/api/nhl/data/shuffle).
import { chanceAt, HEIGHTS } from './shuffle-pure';
import { poissonAtLeast } from './picks-pure';

/** Per market: the marks, the λ a skater needs to be read, the chance at the first mark a candidate needs to be listed. */
export const NHL_BIG = {
  sog: { label: 'Shots', unit: 'SOG', marks: [5, 6], minLam: 1.5, listMin: 0.1 },
  g: { label: 'Goals', unit: 'G', marks: [2], minLam: 0.1, listMin: 0.04 },
};

const r3 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 1000) / 1000);

/**
 * The big games on the shuffle's payload: per market every skater whose board λ reaches the market's floor, his chance of
 * each mark (the board's read through the calibration in `shuffle.calibration.fits`, the Poisson tail as stated beside it as
 * `raw`), how often he reached the first mark over his last ten and this season (`own.cleared`), his figure once final;
 * `lists[market]` = the row ids from the market's `listMin` at the first mark, the likeliest first.
 */
export function nhlBigGames(shuffle) {
  const cal = shuffle?.calibration?.fits || null;
  const rows = {};
  const lists = Object.fromEntries(Object.keys(NHL_BIG).map((m) => [m, []]));
  for (const g of shuffle?.games || []) {
    for (const s of g.skaters || []) {
      const row = { ...s, cal };
      for (const [market, spec] of Object.entries(NHL_BIG)) {
        const lam = market === 'sog' ? s.lamS : s.lamG;
        if (!(lam >= spec.minLam)) continue;
        const p = Object.fromEntries(spec.marks.map((mk) => [mk, chanceAt(row, market, mk)]));
        const raw = Object.fromEntries(spec.marks.map((mk) => [mk, r3(poissonAtLeast(lam, mk))]));
        const i = HEIGHTS[market].indexOf(spec.marks[0]);
        const c10 = s.own?.cleared?.l10; const cs = s.own?.cleared?.season;
        const actual = s.actual === undefined ? undefined : s.actual === null ? null : s.actual[market] ?? 0;
        const id = `${s.id}|${market}`;
        rows[id] = {
          id, pid: s.id, name: s.name, team: s.team, opp: s.opp, venue: s.venue, pos: s.pos, line: s.line ?? null, game: g.id, start: g.startTimeUTC || null,
          market, marks: spec.marks, p, raw, lam: r3(lam), calibrated: !!cal,
          record: { l10: c10?.n ? { hits: c10[market]?.[i] ?? 0, of: c10.n } : null, season: cs?.n ? { hits: cs[market]?.[i] ?? 0, of: cs.n } : null },
          final: !!g.final, actual: actual === undefined ? undefined : actual,
          got: actual == null ? null : Object.fromEntries(spec.marks.map((mk) => [mk, actual >= mk])),
        };
        if (p[spec.marks[0]] != null && p[spec.marks[0]] >= spec.listMin) lists[market].push(id);
      }
    }
  }
  for (const m of Object.keys(lists)) {
    const first = NHL_BIG[m].marks[0];
    lists[m].sort((a, b) => rows[b].p[first] - rows[a].p[first] || rows[b].lam - rows[a].lam || rows[a].name.localeCompare(rows[b].name));
  }
  return { rows, lists };
}

/** The line beside a name: how often he has reached the first mark lately ("5+ in 3 of his last 10 · 6 of 14 this season"). */
export function bigWhy(r) {
  const mk = r.marks[0];
  const parts = [];
  if (r.record?.l10) parts.push(`${mk}+ in ${r.record.l10.hits} of his last ${r.record.l10.of}`);
  if (r.record?.season) parts.push(`${r.record.season.hits} of ${r.record.season.of} this season`);
  return parts.join(' · ') || `no ${mk}+ on record`;
}
