import { useCallback, useSyncExternalStore } from 'react';
import { createMMKV } from 'react-native-mmkv';
import { z } from 'zod';

/**
 * User preferences and small bits of app state, kept in MMKV (synchronous, survives restarts,
 * readable from the background task). Every value is validated on read, so a bad or
 * missing value silently falls back to its default.
 */
const storage = createMMKV({ id: 'grabby.settings' });

export const CHECK_INTERVALS = [1, 3, 6, 12, 24] as const;
export const ABIS = ['arm64-v8a', 'armeabi-v7a', 'x86_64', 'x86', 'universal'] as const;

const schema = {
  onboarded: z.boolean().default(false),
  theme: z.enum(['system', 'dark', 'light']).default('system'),
  checkIntervalHours: z.literal(CHECK_INTERVALS).default(6),
  wifiOnly: z.boolean().default(true),
  autoDownload: z.boolean().default(false),
  notifyUpdates: z.boolean().default(true),
  notifyBetas: z.boolean().default(false),
  /** null = use the device's primary ABI. */
  preferredAbi: z.enum(ABIS).nullable().default(null),
  deleteApkAfterInstall: z.boolean().default(true),
  /** Cached result of the 4PDA cookie check; the cookie jar is the source of truth. */
  signedIn: z.boolean().default(false),
  /** Set when a download returns 4PDA's login page instead of a file. */
  sessionExpiredAt: z.number().nullable().default(null),
  lastCheckAt: z.number().nullable().default(null),
  nextCheckAt: z.number().nullable().default(null),
} as const;

type Schema = typeof schema;
export type SettingKey = keyof Schema;
export type SettingValue<K extends SettingKey> = z.output<Schema[K]>;

function read<K extends SettingKey>(key: K): SettingValue<K> {
  return parse(key, storage.getString(key));
}

function parse<K extends SettingKey>(key: K, raw: string | undefined): SettingValue<K> {
  let parsed: unknown = undefined;
  if (raw !== undefined) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = undefined;
    }
  }
  const result = schema[key].safeParse(parsed);
  return (result.success ? result.data : schema[key].parse(undefined)) as SettingValue<K>;
}

function write<K extends SettingKey>(key: K, value: SettingValue<K>) {
  storage.set(key, JSON.stringify(value));
}

function subscribe(key: SettingKey, onChange: () => void) {
  const listener = storage.addOnValueChangedListener((changed) => {
    if (changed === key) onChange();
  });
  return () => listener.remove();
}

/** Read or change one setting, re-rendering when it changes (from anywhere). */
export function useSetting<K extends SettingKey>(key: K) {
  const value = useSyncExternalStore(
    useCallback((cb: () => void) => subscribe(key, cb), [key]),
    () => storage.getString(key),
  );
  // `value` is the raw string so the snapshot is referentially stable. Parse that snapshot, not a
  // fresh read: the React Compiler memoises `read(key)` on `key` alone, which froze the value.
  const current = parse(key, value);
  const set = useCallback((next: SettingValue<K>) => write(key, next), [key]);
  return [current, set] as const;
}

export const settings = {
  get: read,
  set: write,
  getTheme: () => read('theme'),
  clearAll: () => storage.clearAll(),
};
