// Read the lines off one tweet's picture the way the site does, and print what the parser
// makes of them. For checking a tweet by hand (and the first thing to run once the key is on
// Render): the photos X's syndication endpoint hands back, the model's answer, the lines the
// roster accepts.
//   ANTHROPIC_API_KEY=… node --import ./tools/audit/register.mjs tools/lines-picture.mjs <tweet url or status id> NJD
//   npm run lines:picture -- https://x.com/GameDayLines/status/2116284670182920405 NJD
// The roster comes from the NHL API (api-web.nhle.com/v1/roster/<TEAM>/current), so no store
// is needed. NHL_LINES_VISION_MODEL picks the model (claude-opus-5-5 by default).
import { fetchTweetPhotos, readTweetPicture, visionModel, picturesEnabled } from '../lib/nhl-data/tweet-pictures.js';
import { parseLineTweet, tweetTime } from '../lib/nhl-data/gamedaytweets.js';

const [arg, team] = process.argv.slice(2);
if (!arg || !team) { console.error('usage: lines-picture.mjs <tweet url or status id> <TEAM>'); process.exit(2); }
const id = String(arg).match(/(\d{15,20})/)?.[1];
if (!id) { console.error(`no status id in ${arg}`); process.exit(2); }
if (!picturesEnabled()) { console.error('ANTHROPIC_API_KEY is not set (or NHL_LINES_PICTURES=off)'); process.exit(2); }

const res = await fetch(`https://api-web.nhle.com/v1/roster/${team.toUpperCase()}/current`);
if (!res.ok) { console.error(`NHL roster answered ${res.status} for ${team}`); process.exit(1); }
const r = await res.json();
const roster = [...(r.forwards || []), ...(r.defensemen || []), ...(r.goalies || [])]
  .map((p) => ({ id: p.id, name: `${p.firstName?.default || ''} ${p.lastName?.default || ''}`.trim(), pos: p.positionCode, team: team.toUpperCase() }));
console.log(`${team.toUpperCase()} roster: ${roster.length} players · model ${visionModel()}`);

const { photos, user, text, status } = await fetchTweetPhotos(id);
console.log(`tweet ${id} by @${user || '?'} at ${tweetTime(id) || '?'} (syndication ${status}): ${JSON.stringify(text)}`);
console.log(`photos: ${photos.length ? photos.map((p) => `${p.url} (${p.width}×${p.height})`).join(', ') : 'none'}`);
if (!photos.length) process.exit(0);

const t0 = Date.now();
const rec = await readTweetPicture({ id, url: `https://x.com/i/status/${id}`, handle: user, text: text || '' }, roster);
console.log(`\nread: ${rec.status} in ${((Date.now() - t0) / 1000).toFixed(1)} s, ${rec.reads} model call${rec.reads === 1 ? '' : 's'}${rec.error ? ` — ${rec.error}` : ''}`);
if (rec.raw) console.log(`\nthe model said:\n${rec.raw}`);
if (rec.text) {
  console.log(`\nas the parser reads it:\n${rec.text}`);
  const lines = parseLineTweet(rec.text, roster);
  if (!lines) console.log('\nthe parser accepts no lines from it (fewer than three forward lines with two roster hits each)');
  else {
    const row = (ps) => ps.map((p) => (p.id ? p.name : `${p.name}?`)).join(' - ');
    console.log(`\nforwards:\n${lines.forwards.map(row).join('\n')}\npairs:\n${lines.defense.map(row).join('\n')}`);
    const unmatched = [...lines.forwards.flat(), ...lines.defense.flat()].filter((p) => !p.id);
    if (unmatched.length) console.log(`not on the roster: ${unmatched.map((p) => p.name).join(', ')}`);
  }
}
