'use client';

// The Outliers tables' sorting, shared by the NBA's and the NFL's Big games tabs (Vincent, 2026-11-07: "in the outlier tab,
// I should be able to sort"): a click sorts by the column (its first direction), a second click flips it, nulls last.

/** Each column's value and its first direction. */
export const OUT_SORTS = {
  player: { v: (r) => r.player, dir: 'asc' },
  mark: { v: (r) => r.mark, dir: 'desc' },
  p: { v: (r) => r.p, dir: 'desc' },
  proj: { v: (r) => r.proj, dir: 'desc' },
  floor: { v: (r) => r.floor, dir: 'desc' },
  ceiling: { v: (r) => r.ceiling, dir: 'desc' },
  book: { v: (r) => r.book?.edge ?? null, dir: 'desc' },
  season: { v: (r) => (r.record?.season?.n ? r.record.season.hits / r.record.season.n : null), dir: 'desc' },
  minutes: { v: (r) => r.minutes, dir: 'desc' },
  got: { v: (r) => r.actual, dir: 'desc' },
};

/** The rows in the sort's order; ties keep the order they came in (the chance's). */
export function sortOutliers(rows, { key = 'p', dir = 'desc' } = {}) {
  const spec = OUT_SORTS[key] || OUT_SORTS.p;
  const sign = dir === 'asc' ? 1 : -1;
  return rows.map((r, i) => [r, i]).sort(([a, i], [b, j]) => {
    const x = spec.v(a); const y = spec.v(b);
    if (x == null && y == null) return i - j;
    if (x == null) return 1;
    if (y == null) return -1;
    const c = typeof x === 'string' ? x.localeCompare(y) : x - y;
    return c ? sign * c : i - j;
  }).map(([r]) => r);
}

/** The next sort after a click on column `k`. */
export const nextSort = (cur, k) => (cur.key === k ? { key: k, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: OUT_SORTS[k]?.dir || 'desc' });

/** A sortable header: the sorted column carries the arrow and aria-sort. */
export function SortHead({ k, label, sort, onSort, title, className = '' }) {
  const on = sort.key === k;
  return (
    <th className={`${className}${on ? ' is-sorted' : ''}`} title={title} aria-sort={on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
      <button type="button" onClick={() => onSort(k)}>{label}{on ? <i aria-hidden="true">{sort.dir === 'asc' ? '↑' : '↓'}</i> : null}</button>
    </th>
  );
}

/** "4+ in 0 of 5 this season · 5 of 15 last season": his games at the mark, this season first. */
export function recordText(r) {
  const s = r.record?.season; const l = r.record?.last;
  const parts = [];
  if (s?.n) parts.push(`${r.mark}+ in ${s.hits} of ${s.n} this season`);
  if (l?.n) parts.push(s?.n ? `${l.hits} of ${l.n} last season` : `${r.mark}+ in ${l.hits} of his last ${l.n} last season`);
  return parts.join(' · ');
}
