// The posted lines for every team-game of a season, rebuilt from GameDayTweets with the site's own reader
// (lib/nhl-data/gamedaytweets.js `latestTeamLines`), for the minutes refit (tools/audit/nhl_toi.py --lines).
//
// For each game: the newest lines tweet dated the day before or later and posted by `--after` minutes past puck drop
// (the lineup read's warm-up window, lines-chain.js WINDOW_AFTER_MIN = 10: the lines a pre-game run could have
// read); with none, the team's last game's lines carried over (`fillFromLastLineup`'s rule), marked `last`. The roster
// is every skater who played for the team in the season's TOI rows (the stored reference roster is in the private
// store), so a name the writers used for a player who never dressed stays unmatched, as it would be on the site.
//
//   node --import ./tools/audit/register.mjs tools/audit/nhl-toi-lines.mjs \
//     --raw .nhl-data/toi --season 20262027 --gdt .nhl-data/toi/gdt --sched .nhl-data/toi/sched --out .nhl-data/toi/lines-20262027.json
//
// --gdt holds one page a team (<ABBR>.html: https://www.gamedaytweets.com/lines?team=<ABBR>, fetched one at a time),
// --sched one NHL schedule a team (<ABBR>.json: https://api-web.nhle.com/v1/club-schedule-season/<ABBR>/<season>).
// A page lists the season's tweets newest first; a team whose oldest tweet is newer than its first game is reported.
import fs from 'node:fs';
import path from 'node:path';
import { latestTeamLines, parseLinesPage } from '../../lib/nhl-data/gamedaytweets.js';
import { normName } from '../../lib/nhl-data/model-key.js';

const arg = (k, d = null) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const raw = arg('raw'); const season = arg('season', '20262027'); const gdt = arg('gdt'); const sched = arg('sched'); const out = arg('out');
const afterMin = Number(arg('after', 10));
if (!raw || !gdt || !sched || !out) { console.error('usage: --raw <dir> --season <id> --gdt <dir> --sched <dir> --out <file>'); process.exit(1); }

const POS = { C: 'C', L: 'LW', R: 'RW', D: 'D' };
const rows = fs.readdirSync(path.join(raw, season)).filter((f) => f.startsWith('skater-timeonice-'))
  .flatMap((f) => JSON.parse(fs.readFileSync(path.join(raw, season, f), 'utf8')).data);
const rosters = {}; // team → id → { id, name, pos }
const games = {};   // team → [{ gameId, date }]
for (const r of rows) {
  const t = r.teamAbbrev;
  (rosters[t] = rosters[t] || {})[r.playerId] = { id: r.playerId, name: r.skaterFullName, pos: POS[r.positionCode] || r.positionCode, team: t };
  const list = (games[t] = games[t] || []);
  if (!list.some((g) => g.gameId === r.gameId)) list.push({ gameId: r.gameId, date: r.gameDate });
}
const addDays = (d, n) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

const result = { season, afterMin, built: new Date().toISOString(), teams: {}, games: [] };
for (const team of Object.keys(games).sort()) {
  const html = fs.existsSync(path.join(gdt, `${team}.html`)) ? fs.readFileSync(path.join(gdt, `${team}.html`), 'utf8') : '';
  const starts = {};
  try {
    for (const g of JSON.parse(fs.readFileSync(path.join(sched, `${team}.json`), 'utf8')).games || []) starts[g.id] = g.startTimeUTC;
  } catch { /* no schedule: the date alone bounds the read */ }
  const roster = Object.values(rosters[team]);
  const tweets = parseLinesPage(html);
  const list = games[team].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.gameId - b.gameId));
  result.teams[team] = { tweets: tweets.length, oldest: tweets.map((t) => t.date).filter(Boolean).sort()[0] || null, first: list[0]?.date, roster: roster.length };
  let last = null;
  const counts = { tweet: 0, last: 0, none: 0 };
  for (const g of list) {
    const start = starts[g.gameId] || null;
    const until = start ? new Date(Date.parse(start) + afterMin * 60000).toISOString() : `${g.date}T23:59:59Z`;
    const read = latestTeamLines(html, roster, { since: addDays(g.date, -1), until });
    let players = null; let source = 'none'; let at = null;
    if (read) { players = read.players; source = 'tweet'; at = read.meta?.at || null; last = read.players; }
    else if (last) { players = last; source = 'last'; }
    counts[source]++;
    const byId = {};
    for (const p of Object.values(players || {})) if (p.id != null) byId[p.id] = { pos: p.pos, line: p.line };
    // a name the reader kept without an id: match it to the roster by its normalised name
    for (const p of Object.values(players || {})) {
      if (p.id != null) continue;
      const hit = roster.find((r) => normName(r.name) === normName(p.name));
      if (hit) byId[hit.id] = { pos: p.pos, line: p.line };
    }
    result.games.push({ gameId: g.gameId, date: g.date, team, start, source, at, players: byId });
  }
  Object.assign(result.teams[team], counts);
}
fs.writeFileSync(out, JSON.stringify(result));
const tot = result.games.reduce((a, g) => { a[g.source] = (a[g.source] || 0) + 1; return a; }, {});
console.log(`${out}: ${result.games.length} team-games`, tot);
for (const [t, v] of Object.entries(result.teams)) if (!v.oldest || v.oldest > v.first) console.log(`  ${t}: oldest tweet ${v.oldest}, first game ${v.first}`);
