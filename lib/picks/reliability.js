// What chance has been reliable to bet on, per market (Vincent, 2026-10-31: "keep track of what % is reliable to bet on
// for threes, assists, rebounds and based on that the % for the players should be colored green / red"). Learned from
// the season's graded nights (gradeBoard records, the chances as the board stated them, the over / yes side): for each
// chance step from 50% up, the plays at or above it, how often they landed and the break-even their prices asked
// (the mean implied probability); the **reliable threshold** is the lowest step with `RELIABLE_MIN` plays at or above
// it whose landed rate reaches the break-even (a flat stake at the book's prices would not have lost), `RELIABLE_BAR`
// where no price was stored. Stored beside the calibration (lib/picks/store.js scorecardFor, `reliability` in
// nba/meta/calibration.json), on the board as `board.reliability`, read by the views through `reliableTone`: a play's
// stated chance at or over the market's threshold is green, under it red, no colour for a market without one. Pure.
export const RELIABLE_MIN = 25;
export const RELIABLE_BAR = 0.6;
export const RELIABLE_STEPS = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9];
const OVER = new Set(['over', 'yes']);
const r3 = (v) => Math.round(v * 1000) / 1000;
const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

/** The reliability per market from graded slates ({ key, plays: [{ market, side, p, raw, implied, hit }] }). */
export function reliabilityOf(graded, { min = RELIABLE_MIN, bar = RELIABLE_BAR, steps = RELIABLE_STEPS, at = null } = {}) {
  const nights = [...new Set((graded || []).filter((g) => g.plays?.length).map((g) => g.key))].sort();
  const byMarket = new Map();
  let total = 0;
  for (const g of graded || []) {
    for (const x of g.plays || []) {
      if (!OVER.has(x.side) || (x.hit !== 0 && x.hit !== 1)) continue;
      const p = x.raw ?? x.p;
      if (!Number.isFinite(p)) continue;
      const list = byMarket.get(x.market) || []; list.push({ p, hit: x.hit, implied: Number.isFinite(x.implied) ? x.implied : null }); byMarket.set(x.market, list); total++;
    }
  }
  const markets = {};
  for (const [market, plays] of [...byMarket.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const table = steps.map((t) => {
      const list = plays.filter((x) => x.p >= t - 1e-9);
      const priced = list.filter((x) => x.implied != null);
      const breakEven = priced.length ? r3(mean(priced.map((x) => x.implied))) : null;
      const landed = list.length ? r3(mean(list.map((x) => x.hit))) : null;
      return { t, n: list.length, landed, breakEven, ok: list.length >= min && landed != null && landed >= (breakEven ?? bar) };
    });
    const first = table.find((row) => row.ok) || null;
    markets[market] = { threshold: first?.t ?? null, n: first?.n ?? 0, landed: first?.landed ?? null, breakEven: first?.breakEven ?? null, plays: plays.length, table };
  }
  return { at: at || new Date().toISOString(), from: nights[0] ?? null, to: nights[nights.length - 1] ?? null, nights: nights.length, plays: total, min, bar, markets };
}

/** The market's reliable threshold, or null. */
export const reliableFor = (rel, market) => rel?.markets?.[market]?.threshold ?? null;

/** 'yes' when the play's stated chance (`raw`, else `p`) reaches the market's threshold, 'no' under it, null without one. */
export function reliableTone(rel, market, p, raw = null) {
  const t = reliableFor(rel, market);
  const s = raw ?? p;
  if (t == null || s == null) return null;
  return s >= t - 1e-9 ? 'yes' : 'no';
}

const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);

/** One market's line: "reliable from 65%: 62 plays at or over it landed 68% against a 63% break-even", or why not. */
export function reliabilityText(rel, market, label = market) {
  const m = rel?.markets?.[market];
  if (!m) return `${label}: no graded plays yet`;
  if (m.threshold == null) {
    const best = [...m.table].filter((r) => r.n >= (rel.min ?? RELIABLE_MIN)).sort((a, b) => (b.landed - (b.breakEven ?? rel.bar ?? RELIABLE_BAR)) - (a.landed - (a.breakEven ?? rel.bar ?? RELIABLE_BAR)))[0];
    return `${label}: not reliable at any chance yet (${m.plays} plays${best ? `; at ${pct(best.t)}+ ${best.n} landed ${pct(best.landed)} against a ${pct(best.breakEven ?? rel.bar ?? RELIABLE_BAR)} break-even` : ''})`;
  }
  return `${label}: reliable from ${pct(m.threshold)} — ${m.n} plays at or over it landed ${pct(m.landed)} against a ${pct(m.breakEven ?? rel.bar ?? RELIABLE_BAR)} break-even`;
}
