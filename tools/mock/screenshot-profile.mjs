#!/usr/bin/env node
// Screenshots of the matchup profile mock-ups: the pages the render test writes with
// MOCK_OUT=<dir> (npx jest __tests__/nhl-matchup-profile-render.test.js), each at 1440 and 390
// wide, through the pre-installed Chromium (playwright is resolved globally in the cloud
// container; pass PLAYWRIGHT_CHROMIUM to use another binary).
//   node tools/mock/screenshot-profile.mjs <dir> [--width 1440,390] [--theme dark,light]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const args = process.argv.slice(2);
const dir = path.resolve(args.find((a) => !a.startsWith('--')) || '.mock');
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] ? args[i + 1] : dflt; };
const widths = opt('width', '1440,390').split(',').map(Number);
const themes = opt('theme', 'dark,light').split(',');

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(require.resolve('playwright', { paths: ['/usr/lib/node_modules', '/usr/local/lib/node_modules'] }))); }

const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ['--no-sandbox'] } : {});
const pages = fs.readdirSync(dir).filter((f) => /^profile-.*\.html$/.test(f) && themes.some((t) => f.endsWith(`-${t}.html`))).sort();
for (const file of pages) {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
    await page.goto(`file://${path.join(dir, file)}`);
    await page.evaluate(() => document.fonts.ready);
    const card = page.locator('.nhlx-mu-game');
    const out = path.join(dir, `${file.replace(/\.html$/, '')}-${width}.png`);
    await card.screenshot({ path: out });
    await page.close();
    console.log(out);
  }
}
await browser.close();
