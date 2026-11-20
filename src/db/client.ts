import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

/**
 * One connection for the UI and the background task (both run in the same JS runtime).
 * The change listener powers useLiveQuery (src/db/live.ts).
 */
export const sqlite = openDatabaseSync('grabby.db', { enableChangeListener: true });
sqlite.execSync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });
export { schema };
