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
    // Entries carry the same version marks the bucket's listing does (updated_at, eTag,
    // size), so the store's revalidation works the same way in development.
    async list(prefix, { limit = 100 } = {}) {
      try {
        const dir = safe(prefix);
        const names = (await fs.readdir(dir)).sort().slice(0, limit);
        const data = await Promise.all(names.map(async (name) => {
          const st = await fs.stat(path.join(dir, name)).catch(() => null);
          return st?.isFile()
            ? { name, updated_at: st.mtime.toISOString(), metadata: { eTag: `${st.mtimeMs}-${st.size}`, size: st.size } }
            : { name, updated_at: null, metadata: null };
        }));
        return { data, error: null };
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
