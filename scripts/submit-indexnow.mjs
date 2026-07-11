// Submits every sitemap URL to IndexNow (Bing/Yandex instant indexing; Google
// does not use IndexNow). Run after a deploy that adds pages:
//   node scripts/submit-indexnow.mjs
// The key file public/<KEY>.txt must be live on the site first.
const KEY = 'de43b9f2f766d9ebaf79f4ab97931150';
const HOST = 'ideareels.io';

const res = await fetch(`https://${HOST}/sitemap.xml`);
const xml = await res.text();
const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urls.length) throw new Error('no URLs found in sitemap');

const submit = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList: urls,
  }),
});
console.log(`IndexNow: submitted ${urls.length} URLs → HTTP ${submit.status}`);
if (!submit.ok) console.log(await submit.text());
