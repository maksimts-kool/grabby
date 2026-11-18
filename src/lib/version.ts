/**
 * Version handling for versions exactly as 4PDA topics post them: "4.13.1541",
 * "6.70.0-beta1", "3.6.5 Build 2", "0.34". Versions are always displayed as posted;
 * these helpers only order them and spot pre-releases.
 */

const PRERELEASE = /(alpha|beta|preview|rc|test|dev|nightly|canary|альфа|бета|тест)/i;

export function isPrerelease(version: string): boolean {
  return PRERELEASE.test(version);
}

type Part = number | string;

function tokenize(version: string): Part[] {
  const core = version.trim().replace(/^v(?=\d)/i, '');
  return (core.match(/\d+|[a-zа-яё]+/gi) ?? []).map((t) =>
    /^\d+$/.test(t) ? Number(t) : t.toLowerCase(),
  );
}

/**
 * Compares two versions. Returns > 0 when `a` is newer, < 0 when `b` is newer, 0 when equal.
 * Numeric parts compare numerically; a pre-release sorts before the same release
 * ("6.70.0-beta1" < "6.70.0"); text parts compare alphabetically (alpha < beta < rc).
 */
export function compareVersions(a: string, b: string): number {
  const pa = tokenize(a);
  const pb = tokenize(b);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === y) continue;
    if (x === undefined) return typeof y === 'string' ? 1 : -1; // "1.0" > "1.0-beta", "1.0" < "1.0.1"
    if (y === undefined) return typeof x === 'string' ? -1 : 1;
    if (typeof x === 'number' && typeof y === 'number') return x - y;
    if (typeof x === 'number') return 1; // "1.0.1" > "1.0.beta"
    if (typeof y === 'number') return -1;
    return x < y ? -1 : 1;
  }
  return 0;
}

export function isNewer(
  candidate: string | null | undefined,
  installed: string | null | undefined,
) {
  if (!candidate) return false;
  if (!installed) return true;
  return compareVersions(candidate, installed) > 0;
}
