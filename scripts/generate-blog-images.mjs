// One-off generator: fetches the blog's Unsplash photos and writes pre-optimized
// AVIF/WebP variants + an OG JPEG to public/blog-img/. Static files get Cloudflare
// edge caching (unlike /_next/image), so blog images stop hitting the Render origin.
// Run: node scripts/generate-blog-images.mjs   (needs: npm i --no-save sharp)
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const PHOTOS = [
  'photo-1531538606174-0f90ff5dce83',
  'photo-1677442135703-1787eea5ce01',
  'photo-1460925895917-afdab827c52f',
  'photo-1551288049-bebda4e38f71',
  'photo-1518770660439-4636190af475',
  'photo-1507003211169-0a1dd7228f2d',
  'photo-1519389950473-47ba0277781c',
];

const WIDTHS = [400, 800, 1600];
const OUT = new URL('../public/blog-img/', import.meta.url).pathname;

await mkdir(OUT, { recursive: true });

for (const photo of PHOTOS) {
  const id = photo.slice(-12);
  const src = `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1600&q=85&fm=jpg`;
  const res = await fetch(src);
  if (!res.ok) throw new Error(`fetch ${photo}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  for (const w of [...WIDTHS, 144]) {
    const base = sharp(buf).resize({ width: w, withoutEnlargement: true });
    await writeFile(`${OUT}${id}-${w}.avif`, await base.clone().avif({ quality: 50 }).toBuffer());
    await writeFile(`${OUT}${id}-${w}.webp`, await base.clone().webp({ quality: 75 }).toBuffer());
  }
  // OG image: fixed 1200x630 JPEG for social scrapers (many still reject AVIF)
  await writeFile(`${OUT}${id}-og.jpg`, await sharp(buf).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 80, mozjpeg: true }).toBuffer());
  console.log('done', id);
}
