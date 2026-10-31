// The edge audit offline, on a scorecard export (`/api/nhl/data/scorecard?from=…&rows=1`, signed in; the rows carry the
// book's lines and the board's chance at them from 2026-10-31 on): the same grading the History tab draws
// (lib/nhl-data/edge-pure.js), printed as tables — every priced play, the board's plays, by the edge the board saw, by
// what the book asked, and up the board's chance with the reliable step.
//
//   node --import ./tools/audit/register.mjs tools/predictors/edge_audit.mjs <export.json>
import fs from 'node:fs';
import { edgeReport } from '../../lib/nhl-data/edge-pure.js';

const file = process.argv[2];
if (!file) { console.error('usage: edge_audit.mjs <export.json>'); process.exit(2); }
const j = JSON.parse(fs.readFileSync(file, 'utf8'));
const rows = (j.rows || []).map((r) => ({
  date: r.date, actual: { sog: r.sog, g: r.g },
  book: r.sogOdds != null || r.goalOdds != null ? {
    sog: r.sogOdds != null ? { line: r.sogLine, mark: Math.floor(r.sogLine) + 1, odds: r.sogOdds, implied: r.sogImplied, p: r.sogBoard, raw: r.p3s, edge: r.sogBoard != null && r.sogImplied != null ? r.sogBoard - r.sogImplied : null } : null,
    goal: r.goalOdds != null ? { odds: r.goalOdds, implied: r.goalImplied, p: r.goalBoard, raw: r.p1g, edge: r.goalBoard != null && r.goalImplied != null ? r.goalBoard - r.goalImplied : null } : null,
  } : null,
}));
const priced = rows.filter((r) => r.book);
console.log(`${rows.length} graded skater-games, ${priced.length} with the book's lines (${[...new Set(priced.map((r) => r.date))].length} nights).`);
if (!priced.length) { console.log('No priced rows: the book\'s lines are stored with the pull from 2026-10-31 on.'); process.exit(0); }
const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
const sgn = (v) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(3)}`);
const line = (label, s) => `| ${label} | ${s.n} | ${pct(s.said)} | ${pct(s.implied)} | ${pct(s.hit)} | ${s.n ? `${(s.hit - s.implied) > 0 ? '+' : ''}${((s.hit - s.implied) * 100).toFixed(0)} pts` : '—'} | ${sgn(s.ret)} |`;
const head = '| | Plays | Board said | Book asked | Landed | vs asked | Return / unit |\n| --- | --- | --- | --- | --- | --- | --- |';
const e = edgeReport(rows);
for (const k of ['sog', 'g']) {
  const m = e[k];
  console.log(`\n## ${m.label}\n`);
  console.log(m.reliable ? `Plays have paid from a board chance of ${pct(m.reliable.step)}: ${m.reliable.n} plays landed ${pct(m.reliable.hit)} against ${pct(m.reliable.implied)} asked, ${sgn(m.reliable.ret)} a unit.\n` : `No chance step with ${m.min} plays at or over it has paid yet.\n`);
  console.log(head); console.log(line('Every priced skater-game', m)); console.log(line('An edge over the book (the board’s plays)', m.plays));
  console.log(`\n**By the edge the board saw**\n\n${head}`); for (const b of m.byEdge) if (b.n) console.log(line(b.label, b));
  console.log(`\n**By what the book asked**\n\n${head}`); for (const b of m.byImplied) if (b.n) console.log(line(b.label, b));
  console.log(`\n**From a board chance of**\n\n${head}`); for (const s of m.steps) if (s.n) console.log(line(`${pct(s.step)} and up${s.ok ? ' ✓' : ''}`, s));
}
