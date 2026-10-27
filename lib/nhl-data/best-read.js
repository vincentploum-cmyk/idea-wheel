// The shuffle's "Read from" verdict, stored: which read the History tab's scorecard rates best
// for each bar (bestReadFrom in shuffle-pure.js: the lowest Brier at the bar's floor over the rows
// every predictor covers, 100 at least). The scorecard is built from every stored game and run
// of the season — tens of seconds on a cold server, past the proxy's limit on a bad day — so the
// shuffle no longer waits for it: the verdict is written whenever the season's scorecard is built
// (the History tab's first grade, the morning refresh in the background) and read with the slate,
// and the green tab is there on first paint. The same verdict is never written twice: a write
// drops every build kept per store state (lib/memo.js).
import { readJson, writeJson } from '../nhl-store';
import { bestReadFrom, NHL_BARS } from './shuffle-pure';

export const BEST_READ_PATH = 'data/scorecard/best-read.json';

/**
 * The verdict file's content from a built scorecard (summarize()): one verdict per bar
 * ({ best, n, scores, ranked }) with when it was built and what from. Null without predictors.
 */
export function bestReadOf(card, at = new Date().toISOString()) {
  if (!card?.predictors) return null;
  const bars = Object.fromEntries(NHL_BARS.map((b) => [b.market, bestReadFrom(card.predictors, b.market)]));
  return { at, from: card.from ?? null, to: card.to ?? null, slates: card.slates ?? 0, players: card.players ?? 0, bars };
}

/** Whether two verdicts say the same (the bars, the slates and the player-games behind them; not when they were built). */
export function sameBestRead(a, b) {
  if (!a || !b) return false;
  return a.slates === b.slates && a.players === b.players && JSON.stringify(a.bars) === JSON.stringify(b.bars);
}

/** The stored verdict, or null. */
export async function loadBestRead() {
  return (await readJson(BEST_READ_PATH)) || null;
}

/**
 * Store the verdict a scorecard built over the season gives; the one stored comes back untouched
 * when it says the same. Returns the verdict stored, or null when the card has none.
 */
export async function saveBestRead(card) {
  const next = bestReadOf(card);
  if (!next) return null;
  const cur = await loadBestRead();
  if (sameBestRead(cur, next)) return cur;
  await writeJson(BEST_READ_PATH, next);
  return next;
}
