// The Patterns study's rows: every skater-game of the season read the morning of the game by the site's own feature
// builder (lib/nhl-data/patterns-pure.js), from the public box scores shaped as the store's rows. The line slot the
// store takes from the lineups is read here from ice time (the box score has none): within a team's game the
// centres, left and right wings ranked by minutes are lines 1–4, the defensemen by minutes pairs 1–3.
//
//   node tools/predictors/patterns-rows.mjs <games-pos dir> <out.csv> [--to YYYY-MM-DD]
import fs from 'node:fs';
import path from 'node:path';
import { patternTable, MARKS } from '../../lib/nhl-data/patterns-pure.js';

const [dir, out] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const toArg = process.argv.indexOf('--to') > 0 ? process.argv[process.argv.indexOf('--to') + 1] : null;
if (!dir || !out) { console.error('usage: patterns-rows.mjs <games-pos dir> <out.csv> [--to YYYY-MM-DD]'); process.exit(2); }
const POS = ['C', 'LW', 'RW', 'D'];

const rows = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const day = JSON.parse(fs.readFileSync(path.join(dir, f)));
  for (const g of day.games) {
    if (g.gameType != null && Number(g.gameType) !== 2 && Number(g.gameType) !== 3) continue;
    const sk = g.skaters.filter((s) => POS.includes(s.pos) && s.id != null);
    // Line slot by minutes within team and position.
    for (const team of new Set(sk.map((s) => s.team))) {
      for (const p of POS) {
        const list = sk.filter((s) => s.team === team && s.pos === p).sort((a, b) => b.toi - a.toi);
        list.forEach((s, i) => { s._line = p === 'D' ? Math.min(3, Math.floor(i / 2) + 1) : Math.min(4, i + 1); });
      }
    }
    for (const s of sk) rows.push({ date: g.date, gameId: g.id, playerId: s.id, name: s.name, team: s.team, opp: s.opp, venue: s.venue, pos: s.pos, toi: s.toi, g: s.g, a: s.a, sog: s.sog, hits: s.hits, blk: s.blk, icf: s.icf, iff: s.iff, isf: s.isf, iscf: s.iscf, ihdcf: s.ihdcf, line: s._line });
  }
}
rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
const last = rows[rows.length - 1].date;
const to = toArg || last;
const dayAfter = new Date(Date.parse(`${to}T12:00:00Z`) + 86400000).toISOString().slice(0, 10);
const { rows: table } = patternTable(rows.filter((r) => r.date <= to), { date: dayAfter });

const fkeys = [...new Set(table.flatMap((r) => Object.keys(r.f)))];
const okeys = ['sog', 'g', 'a', 'toi', ...MARKS.map((m) => `y_${m.key}`)];
const head = ['date', 'gameId', 'playerId', 'name', 'team', 'opp', 'venue', ...fkeys.filter((k) => !['pos', 'line', 'slot'].includes(k)), 'pos', 'line', 'slot', ...okeys.map((k) => `o_${k}`)];
const esc = (v) => (v == null ? '' : typeof v === 'string' && /[,"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : String(v));
const lines = [head.join(',')];
for (const r of table) {
  const rec = { date: r.date, gameId: r.gameId, playerId: r.playerId, name: r.name, team: r.team, opp: r.opp, venue: r.venue, ...r.f };
  for (const k of okeys) rec[`o_${k}`] = r.o[k];
  lines.push(head.map((k) => esc(rec[k])).join(','));
}
fs.writeFileSync(out, lines.join('\n'));
console.log(`${table.length} skater-games, ${fkeys.length} figures each, ${table[0]?.date} → ${table[table.length - 1]?.date} → ${out}`);
