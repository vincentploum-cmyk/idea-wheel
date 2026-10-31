// The Patterns tab (Vincent, 2026-10-30: "look at literally every data point … the outcome should be pills like
// firsthalfscore.com"): every skater in tonight's lineups read the morning of the game by the study's own feature
// builder (patterns-pure.js) and checked against the rules the study kept per line (patterns-rules.json, written by
// tools/predictors/patterns.py: mined on the season's first weeks, kept only when they held on the week after). Each
// line gets a pill: filled with a check when a rule that held fires and its rate clears the line's bar, outlined
// with the figure otherwise; the conditions behind the filled pills ride along as the facts. The rules' rates move
// with the site's own games after the study (patternRecord), and those games are the record.
import RULES from './patterns-rules.json';
import { buildSlate } from './slate';
import { loadRows } from './build';
import { dataRevision } from '../nhl-store';
import { asyncMemo, memoByRows } from '../memo';
import { patternTable, patternRecord, rulesKeys, skaterPatterns, rulesCatalog, slotKey, NOTE_KEYS } from './patterns-pure';

const memo = asyncMemo({ ttl: 15 * 60 * 1000, max: 4, revision: dataRevision });
const inputs = (date) => () => Promise.all([buildSlate(date), loadRows(date)]);

/** Tonight's pills for a date (and, once its games are stored, what each skater got). */
export function buildPatterns(date, { rules = RULES } = {}) {
  return memo(date, inputs(date), (slate, rows) => computePatterns(date, slate, rows, rules));
}

export function computePatterns(date, slate, rows, rules = RULES) {
  const keep = new Set([...rulesKeys(rules), ...NOTE_KEYS]);
  // The season walked once per stored rows and date (a lineup read or a run saved leaves the rows as they were); read-only.
  const { rows: table, tracker } = memoByRows(rows, `patterns|${date}|${rules.builtThrough}`, () => patternTable(rows, { date, keep }));
  const record = patternRecord(table, rules);
  const games = (slate.games || []).map((g) => {
    const got = new Map((g.log?.skaters || []).map((s) => [s.id, s]));
    const final = !!g.log?.score;
    const sides = g.sides.map((side) => ({
      team: side.team, opp: side.opp, venue: side.venue,
      skaters: side.skaters.filter((p) => p.inLineup && p.id != null && ['C', 'LW', 'RW', 'D'].includes(p.pos)).map((p) => {
        const f = tracker.features({ playerId: p.id, team: side.team, opp: side.opp, venue: side.venue, pos: p.pos, line: p.line, date });
        const slot = slotKey(p.pos, p.line);
        const ctx = { opp: side.opp, pos: p.pos, slot: slot || p.pos, home: side.venue === 'H' };
        const s = got.get(p.id);
        return {
          id: p.id, name: p.name, team: side.team, opp: side.opp, venue: side.venue, pos: p.pos, line: p.line ?? null, slot,
          ...(f.gp ? skaterPatterns(f, rules, record.rates, ctx) : { pills: null, facts: [], notes: [] }),
          actual: final ? (s ? { sog: s.sog, g: s.g } : { dnp: true }) : null,
        };
      }),
    }));
    return { id: g.id, away: g.away, home: g.home, startTimeUTC: g.startTimeUTC || null, final, score: g.log?.score || null, sides };
  });
  return {
    date,
    rules: {
      builtThrough: rules.builtThrough, fit: rules.fit, check: rules.check, rows: rules.rows,
      marks: Object.fromEntries(Object.entries(rules.marks).map(([mk, m]) => [mk, { label: m.label, bar: m.bar, base: m.base, retention: m.retention, held: m.rules.filter((r) => r.kind === 'rule').length }])),
      catalog: rulesCatalog(rules),
    },
    record: { after: record.after, from: record.from, to: record.to, games: record.games, marks: record.marks },
    games,
    gamesStored: slate.gamesStored ?? null,
  };
}

