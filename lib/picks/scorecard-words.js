// The scorecard in plain words: a few sentences read off the report (lib/picks/scorecard.js
// summarize) that say what the numbers mean, so the tables under them are the detail, not the
// message. Pure; the panel (components/picks/Scorecard.jsx) draws the sentences at the top.
//   plainSummary(report, { kind: 'date' | 'week' }) → { coverage, chances, picks, book, projections: [{ key, label, text }], caution }

const JUDGE_MIN = 30;      // plays before the chances are judged at all
const SETTLED_MIN = 100;   // plays before the figures stop swinging night to night
const ABOUT_RIGHT = 0.03;  // hit minus said within this, in probability, reads as about right

const pct = (v) => `${Math.round(v * 100)}%`;
const pts = (v) => `${Math.round(Math.abs(v) * 100)} points`;
const n1 = (v) => (v == null ? '—' : Number(v).toFixed(1));
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Inclusive days between two ET dates, null when either is missing. */
function daysBetween(from, to) {
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return null;
  const d = Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000) + 1;
  return d > 0 ? d : null;
}

/** How much of the asked range the report actually covers. */
export function coverageOf(report, { kind = 'date' } = {}) {
  const unit = kind === 'week' ? 'week' : 'night';
  const parts = [`${plural(report.slates, unit)} with finished games`, `${report.graded} of ${plural(report.games, 'finished game')} graded`];
  const days = kind === 'date' ? daysBetween(report.from, report.to) : null;
  const missing = days != null ? days - report.slates : 0;
  const gap = missing > 0 ? ` ${plural(missing, 'day')} in the range ${missing === 1 ? 'has' : 'have'} no finished games stored yet.` : '';
  return `${parts.join(', ')}.${gap}`;
}

/** Whether the chances came true: said against hit, judged once the sample means something. */
export function chancesOf(s) {
  if (!s || !s.n) return 'No plays graded yet.';
  if (s.n < JUDGE_MIN) return `Only ${plural(s.n, 'play')} graded so far, too few to judge the chances.`;
  const head = `On all ${s.n} plays the board said they would hit ${pct(s.said)} of the time; they hit ${pct(s.hit)}.`;
  if (Math.abs(s.diff) < ABOUT_RIGHT) return `${head} That is about right.`;
  return s.diff > 0
    ? `${head} They hit more often than it said: the board has been cautious by ${pts(s.diff)}.`
    : `${head} They hit less often than it said: the board has been too confident by ${pts(s.diff)}.`;
}

/** The plays that made the board, and what a flat stake on them did at the book's prices. */
export function picksOf(b) {
  if (!b || !b.n) return 'No plays made the board yet.';
  const hits = Math.round(b.hit * b.n);
  const head = `${plural(b.n, 'play')} made the board. The board said ${pct(b.said)}; ${hits} of ${b.n} hit (${pct(b.hit)}).`;
  if (!b.priced || b.ret == null) return head;
  return `${head} A flat stake on each at the book's price ${b.ret >= 0 ? 'returned' : 'lost'} ${Math.round(Math.abs(b.ret) * 100)}% per unit.`;
}

/** Every priced play at the book's price, against what the price itself implied. */
export function bookOf(s) {
  if (!s || !s.priced || s.ret == null) return null;
  return `Staking every priced play flat at the book's price ${s.ret >= 0 ? 'returned' : 'lost'} ${Math.round(Math.abs(s.ret) * 100)}% per unit over ${s.priced} plays; the prices themselves implied ${pct(s.implied)} and the board said ${pct(s.said)}.`;
}

/** One market's predictors in a sentence: how far the projection missed, which read came closest, head to head on its own games. */
export function projectionOf(rep) {
  const list = rep?.common?.predictors || [];
  const proj = list.find((p) => p.key === 'proj');
  if (!proj?.n) return null;
  const lean = Math.abs(proj.bias) < 0.05 ? 'with no lean either way' : `running ${n1(Math.abs(proj.bias))} ${proj.bias > 0 ? 'high' : 'low'}`;
  let text = `${rep.label}: the board's projection missed by ${n1(proj.mae)} on average over ${plural(proj.n, 'game')}, ${lean}.`;
  const others = list.filter((p) => p.key !== 'proj' && !p.sparse && p.n && p.mae != null);
  const best = others.sort((a, b) => a.mae - b.mae)[0] || null;
  if (best && best.mae < proj.mae) text += ` ${best.label} came closer, missing by ${n1(best.mae)}.`;
  else if (best) text += ' Nothing read closer.';
  const h2h = list.find((p) => p.key === 'h2h');
  if (h2h?.n && h2h.against?.proj?.mae != null) text += ` Head to head missed by ${n1(h2h.mae)} against the projection's ${n1(h2h.against.proj.mae)} on the same ${plural(h2h.n, 'game')}.`;
  return { key: rep.key, label: rep.label, text };
}

/** The whole report in plain words. */
export function plainSummary(report, { kind = 'date' } = {}) {
  if (!report) return null;
  const caution = report.plays < SETTLED_MIN ? `Figures over fewer than ${SETTLED_MIN} plays swing a lot from ${kind === 'week' ? 'week' : 'night'} to ${kind === 'week' ? 'week' : 'night'}.` : null;
  return {
    coverage: coverageOf(report, { kind }),
    chances: chancesOf(report.all),
    picks: picksOf(report.board),
    book: bookOf(report.all),
    projections: (report.predictors || []).map(projectionOf).filter(Boolean),
    caution,
  };
}
