// A Node loader hook so the audit scripts can import the site's own modules outside Next: a
// relative import without an extension ('../memo', './teams') is tried with .js, then as a folder
// index, and a bare package path without one ('next/headers') with .js when the package has no
// exports map for it. Usage: node --import ./tools/audit/register.mjs <script.mjs>
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const hasExt = (s) => /\.[a-z]+$/i.test(s);

export async function resolve(specifier, context, nextResolve) {
  const relative = specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/');
  if (relative && !hasExt(specifier) && context.parentURL?.startsWith('file:')) {
    const p = fileURLToPath(new URL(specifier, context.parentURL));
    for (const cand of [`${p}.js`, `${p}.mjs`, `${p}/index.js`]) {
      if (existsSync(cand) && statSync(cand).isFile()) return nextResolve(pathToFileURL(cand).href, context);
    }
  }
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND' && !relative && specifier.includes('/') && !hasExt(specifier)) return nextResolve(`${specifier}.js`, context);
    throw err;
  }
}
