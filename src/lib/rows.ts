/** Structural sharing for query results: equal results keep their identity. */

function sameValue(a: unknown, b: unknown) {
  if (Object.is(a, b)) return true;
  // JSON columns (changelog) come back as fresh objects on every read.
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function sameRow(a: unknown, b: unknown) {
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) =>
    sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
  );
}

/** Keeps `prev` (or its unchanged rows) when the new result is equal, so memoised UI holds. */
export function shareRows<T>(prev: T[], next: T[]): T[] {
  let changed = prev.length !== next.length;
  const merged = next.map((row, i) => {
    if (i < prev.length && sameRow(prev[i], row)) return prev[i];
    changed = true;
    return row;
  });
  return changed ? merged : prev;
}
