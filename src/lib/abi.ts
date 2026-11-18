import type { ABIS } from './settings';

export type Abi = (typeof ABIS)[number];

/** Reads the ABI a file targets from its name as posted ("AIMP_v4.13.1541_arm64-v8a.apk"). */
export function abiFromFileName(name: string): Abi | null {
  const n = name.toLowerCase();
  if (/arm64|aarch64|armv8|arm-v8|v8a/.test(n)) return 'arm64-v8a';
  if (/armeabi|armv7|arm-v7|v7a|\barm\b|_arm[_.]/.test(n)) return 'armeabi-v7a';
  if (/x86[_-]?64|amd64/.test(n)) return 'x86_64';
  if (/x86|i686/.test(n)) return 'x86';
  if (/universal|all[_-]?abi|noarch|fat/.test(n)) return 'universal';
  return null;
}

/**
 * The order to prefer files in for a phone: its own ABIs (as Android reports them, best first),
 * then a universal build, then a file with no ABI in its name (usually universal too).
 */
export function abiPreference(
  deviceAbis: readonly string[],
  preferred?: Abi | null,
): (Abi | null)[] {
  const order: (Abi | null)[] = [];
  if (preferred) order.push(preferred);
  for (const a of deviceAbis) if (!order.includes(a as Abi)) order.push(a as Abi);
  if (!order.includes('universal')) order.push('universal');
  order.push(null);
  return order;
}

/** Turns a posted file name into a pattern that matches the same build in the next version. */
export function fileNamePattern(name: string): string {
  return name
    .toLowerCase()
    .replace(/\d+(?:[._-]\d+)*/g, '#')
    .replace(/#(?:[._-]?#)+/g, '#');
}

export interface PickableFile {
  name: string;
}

/**
 * Picks the file Grabby downloads by default: the one matching the pattern remembered for
 * this app, else the best ABI match for the phone. Mods and alternative builds ("Lite", "Mod")
 * are only picked when they are all there is.
 */
export function pickFile<T extends PickableFile>(
  files: readonly T[],
  deviceAbis: readonly string[],
  options: { preferredAbi?: Abi | null; rememberedPattern?: string | null } = {},
): T | null {
  // Zips are builds too ("apk в архиве"): the parser only keeps versioned ones.
  const apks = files.filter((f) => /\.(apk|apks|xapk|apkm|zip)$/i.test(f.name));
  if (!apks.length) return null;
  if (options.rememberedPattern) {
    const match = apks.find((f) => fileNamePattern(f.name) === options.rememberedPattern);
    if (match) return match;
  }
  const isAlt = (f: T) => /\b(mod|lite|patched|clone|old)\b|_mod[_.]|_lite[_.]/i.test(f.name);
  const pool = apks.some((f) => !isAlt(f)) ? apks.filter((f) => !isAlt(f)) : apks;
  const order = abiPreference(deviceAbis, options.preferredAbi);
  for (const abi of order) {
    const hit = pool.find((f) => abiFromFileName(f.name) === abi);
    if (hit) return hit;
  }
  return pool[0] ?? null;
}
