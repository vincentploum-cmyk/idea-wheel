// Filesystem stand-in for the Supabase Storage bucket API subset used by
// nhl-store.js. Development only (NHL_STORE_DRIVER=fs); data in ./.nhl-data.
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = path.join(process.cwd(), '.nhl-data');

function safe(p) {
  const full = path.join(ROOT, p);
  if (!full.startsWith(ROOT)) throw new Error('bad path');
  return full;
}

export function fsBucket() {
  return {
    async upload(p, body) {
      const full = safe(p);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, Buffer.from(await body.arrayBuffer()));
      return { data: { path: p }, error: null };
    },
    async download(p) {
      try {
        const buf = await fs.readFile(safe(p));
        return { data: new Blob([buf]), error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    async list(prefix) {
      try {
        const names = await fs.readdir(safe(prefix));
        return { data: names.map((name) => ({ name })), error: null };
      } catch {
        return { data: [], error: null };
      }
    },
    async remove(paths) {
      for (const p of paths) await fs.rm(safe(p), { force: true });
      return { data: null, error: null };
    },
  };
}
