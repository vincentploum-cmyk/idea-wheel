import * as XLSX from 'xlsx';
import { authorize, DATE_RE } from '@/lib/nhl-data/util';
import { listNames, readBlob, readJson } from '@/lib/nhl-store';
import { slatePath } from '@/lib/nhl-data/matchups';
import { skaterPropsPath } from '@/lib/nhl-data/skater-props';
import { slateExport } from '@/lib/nhl-data/study-export';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Admin, read-only: every stored slate's pre-game PropFinder reads (the defense table by position, the skaters with
// PropFinder's position labels, the book's prices) in one JSON download, for the matchup study
// (lib/nhl-data/study-export.js). `?from=&to=` narrow the dates. Admin session only.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const from = DATE_RE.test(url.searchParams.get('from') || '') ? url.searchParams.get('from') : '0000-00-00';
  const to = DATE_RE.test(url.searchParams.get('to') || '') ? url.searchParams.get('to') : '9999-99-99';
  const dates = (await listNames('data/slates')).filter((n) => DATE_RE.test(n) && n >= from && n <= to).sort();
  const book = async (date, kind) => {
    const blob = await readBlob(slatePath(date, kind)).catch(() => null);
    return blob ? XLSX.read(Buffer.from(await blob.arrayBuffer()), { type: 'buffer' }) : null;
  };
  const slates = [];
  // One date at a time: a workbook object is alive only while its date is read (the server has 512 MB).
  for (const date of dates) {
    const [seasonBook, l5Book, props] = await Promise.all([book(date, 'season'), book(date, 'l5'), readJson(skaterPropsPath(date)).catch(() => null)]);
    slates.push(slateExport(date, { seasonBook, l5Book, props }));
  }
  const body = JSON.stringify({ generatedAt: new Date().toISOString(), from: dates[0] || null, to: dates[dates.length - 1] || null, slates });
  return new Response(body, {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="nhl-study-export-${dates[dates.length - 1] || 'empty'}.json"`,
      'Cache-Control': 'no-store',
    },
  });
}
