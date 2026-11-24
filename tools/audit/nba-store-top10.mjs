#!/usr/bin/env node
// The stat lists as the site built them, night by night, off a copy of the store (tools/audit/nba-store-dump.mjs): the
// stored PropFinder pull, schedule, lineups, injuries and box scores read through the site's own `shuffleFor` / `boardFor`
// (lib/nba/store.js), every player's chance at every height of the Points / Rebounds / Assists / Threes bars, and what he got.
// For tools/audit/nba_top10.py --store (docs/audits/2026-11-24-nba-top10.md).
//
//   ln -sfn <dump>/nba .nhl-data/nba     # the fs driver reads .nhl-data/
//   NODE_ENV=development NHL_STORE_DRIVER=fs node --import ./tools/audit/register.mjs tools/audit/nba-store-top10.mjs --from 2026-10-21 --to 2026-11-23 --out .nhl-data/audit/store
//
// The calibration (nba/meta/calibration.json) is not in the copy: with --calibrate the season to date before each night is
// graded with `scorecardFor` and its calibration put in place first, as the site's refresh would have had it (slow).
import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { boardFor, shuffleFor, datesWithData, scorecardFor } from '../../lib/nba/store.js';
import { pAt } from '../../lib/picks/shuffle.js';

const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const FROM = arg('--from', '2026-10-21'); const TO = arg('--to', '2099-12-31'); const OUT = arg('--out', '.nhl-data/audit/store');
const CAL = process.argv.includes('--calibrate');
const MARKETS = ['pts', 'reb', 'ast', 'tpm'];
fs.mkdirSync(OUT, { recursive: true });
const CAL_PATH = path.join(process.cwd(), '.nhl-data', 'nba', 'meta', 'calibration.json');

const dates = (await datesWithData()).filter((d) => d >= FROM && d <= TO).sort();
const marks = ['date,market,key,team,game,height,p,raw,exp,actual,health,idle'];
const players = ['date,key,team,game,b2b,minutes,health,starter,lineupStatus,pullAt,firstTip,latePull'];
for (const date of dates) {
  if (CAL) {
    const before = dates.filter((d) => d < date);
    fs.mkdirSync(path.dirname(CAL_PATH), { recursive: true });
    if (before.length >= 3) {
      const report = await scorecardFor(before.map((d) => ({ date: d })), { from: before[0], to: before[before.length - 1] }, { save: false });
      if (report?.calibration) fs.writeFileSync(CAL_PATH, JSON.stringify(report.calibration)); else fs.rmSync(CAL_PATH, { force: true });
    } else fs.rmSync(CAL_PATH, { force: true });
  }
  const slate = { date };
  const board = await boardFor(slate).catch((e) => { console.error(`${date}: board failed: ${e.message}`); return null; });
  if (!board?.games?.length) { console.error(`${date}: no board`); continue; }
  const firstTip = board.games.map((g) => g.date).filter(Boolean).sort()[0] || null;
  // When the stored pull was taken (the file's `at`): after the night's first tip its logs may already hold an early game.
  let pullAt = null;
  try { const buf = fs.readFileSync(path.join(process.cwd(), '.nhl-data', 'nba', date, 'propfinder.json')); pullAt = JSON.parse((buf[0] === 0x1f && buf[1] === 0x8b ? gunzipSync(buf) : buf).toString('utf8')).at || null; } catch { /* no pull */ }
  const late = pullAt && firstTip ? pullAt > firstTip : '';
  for (const g of board.games) for (const t of [g.away, g.home]) for (const p of g.sides?.[t]?.players || []) {
    players.push([date, JSON.stringify(p.key), t, g.id, p.b2b ? 1 : 0, p.minutes?.tonight ?? '', p.health || '', p.lineup?.role || '', p.lineup?.status || '', pullAt || '', firstTip || '', late].join(','));
  }
  let n = 0;
  for (const market of MARKETS) {
    const sh = await shuffleFor(slate, market).catch((e) => { console.error(`${date} ${market}: ${e.message}`); return null; });
    for (const pl of sh?.players || []) {
      sh.heights.forEach((h, i) => {
        const p = pAt(pl, sh.heights, i);
        if (p == null) return;
        marks.push([date, market, JSON.stringify(pl.key), pl.team, pl.game, h, p, pl.at[i]?.raw ?? '', pl.exp ?? '', pl.actual ?? '', pl.health || '', pl.idle ? 1 : 0].join(','));
        n++;
      });
    }
  }
  console.error(`${date}: ${board.games.length} games, ${n} chances, pull ${pullAt || '?'} first tip ${firstTip || '?'}`);
}
fs.writeFileSync(path.join(OUT, `store${CAL ? '-cal' : ''}-marks.csv`), marks.join('\n'));
fs.writeFileSync(path.join(OUT, `store${CAL ? '-cal' : ''}-players.csv`), players.join('\n'));
console.error(`written ${OUT}/store${CAL ? '-cal' : ''}-marks.csv and -players.csv`);
