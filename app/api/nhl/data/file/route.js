import { authorize, DATE_RE, todayET } from '@/lib/nhl-data/util';
import { buildBoxScores, buildLineups, buildHistorical, buildPlayerStats, buildRankings, toBuffer } from '@/lib/nhl-data/build';
import { readSlateFile, slateMetaPath } from '@/lib/nhl-data/matchups';
import { readJson } from '@/lib/nhl-store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Serves each model input for a slate date as an .xlsx in the model's format.
export async function GET(request) {
  const auth = await authorize(request);
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  const slot = url.searchParams.get('slot');
  const date = url.searchParams.get('date') || todayET();
  if (!DATE_RE.test(date)) return Response.json({ error: 'bad date' }, { status: 400 });

  try {
    let body = null;
    let name = null;
    if (slot === 'season' || slot === 'l5') {
      const blob = await readSlateFile(date, slot);
      const meta = await readJson(slateMetaPath(date));
      if (blob) { body = Buffer.from(await blob.arrayBuffer()); name = meta?.files?.[slot]?.name || `${slot}-${date}.xlsx`; }
    } else {
      const builders = {
        boxScores: () => buildBoxScores(date),
        lineups: () => buildLineups(date),
        hist: () => buildHistorical(date),
        playerStats: () => buildPlayerStats(date),
        rankings: () => buildRankings(),
      };
      if (!builders[slot]) return Response.json({ error: 'unknown slot' }, { status: 400 });
      const built = await builders[slot]();
      if (built) { body = toBuffer(built.wb); name = built.name; }
    }
    if (!body) return Response.json({ error: 'not_available', slot, date }, { status: 404 });
    return new Response(body, {
      headers: {
        'Content-Type': XLSX_TYPE,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        'X-File-Name': encodeURIComponent(name),
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('[nhl-data] build failed:', slot, err);
    return Response.json({ error: 'build_failed', detail: err.message }, { status: 500 });
  }
}
