// Fetch GameDayTweets lines pages with a real Chrome (Playwright), for runners whose
// plain requests get Cloudflare's "Just a moment" challenge. Writes <team>.html files.
//   node tools/gdt-browser.mjs <outDir> TEAM [TEAM…]
// Needs playwright-core and a Chrome: on GitHub's ubuntu runners Google Chrome is
// preinstalled (channel "chrome"); set GDT_CHROME to an executable path otherwise.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const [outDir, ...teams] = process.argv.slice(2);
if (!outDir || !teams.length) { console.error('usage: gdt-browser.mjs <outDir> TEAM…'); process.exit(2); }
const launch = process.env.GDT_CHROME ? { executablePath: process.env.GDT_CHROME } : { channel: 'chrome' };
const browser = await chromium.launch({ ...launch, headless: true, args: ['--disable-blink-features=AutomationControlled'] });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  viewport: { width: 1280, height: 900 }, locale: 'en-US',
  ignoreHTTPSErrors: process.env.GDT_INSECURE === '1', // local testing behind an intercepting proxy only
});
let ok = 0;
for (const team of teams) {
  const page = await context.newPage();
  try {
    await page.goto(`https://www.gamedaytweets.com/lines?team=${team}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    // A Cloudflare challenge page resolves itself after a few seconds; wait for the tweets.
    await page.waitForSelector('blockquote.full-sized-tweet', { timeout: 30000 });
    await writeFile(path.join(outDir, `${team}.html`), await page.content());
    ok++;
    console.log(`${team}: ok`);
  } catch (err) {
    console.log(`${team}: ${String(err.message || err).split('\n')[0].slice(0, 120)}`);
  } finally {
    await page.close();
  }
}
await browser.close();
console.log(`browser fetched ${ok}/${teams.length}`);
