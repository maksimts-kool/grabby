import { getTableName, isTable } from 'drizzle-orm';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { shareRows } from '@/lib/rows';

/**
 * Live SQLite queries, replacing drizzle's useLiveQuery, which made the UI stutter during checks
 * and downloads:
 * - SQLite reports changes per row, so a check that rewrites 30 file rows re-ran every files
 *   query 30 times. Changes are collected and each query re-runs at most once per frame.
 * - A re-run that returns the same rows keeps the previous array (and unchanged rows keep
 *   their objects), so nothing re-renders when other rows changed.
 * - The database is synchronous, so the first render already has the data: no empty first
 *   frame, no skeleton flashing while a screen slides in.
 */

type SyncQuery = { all: () => unknown[] };

const FLUSH_MS = 16;
const listeners = new Map<string, Set<() => void>>();
const dirty = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let subscribed = false;

function flush() {
  flushTimer = null;
  const tables = [...dirty];
  dirty.clear();
  const run = new Set<() => void>();
  for (const t of tables) listeners.get(t)?.forEach((l) => run.add(l));
  run.forEach((l) => l());
}

function subscribe(table: string, listener: () => void) {
  if (!subscribed) {
    subscribed = true;
    addDatabaseChangeListener(({ tableName }) => {
      if (!listeners.has(tableName)) return;
      dirty.add(tableName);
      flushTimer ??= setTimeout(flush, FLUSH_MS);
    });
  }
  let set = listeners.get(table);
  if (!set) listeners.set(table, (set = new Set()));
  set.add(listener);
  return () => {
    set.delete(listener);
    if (!set.size) listeners.delete(table);
  };
}

function tableOf(query: SyncQuery): string | null {
  const table = (query as unknown as { config?: { table?: unknown } }).config?.table;
  return isTable(table) ? getTableName(table) : null;
}

interface LiveState<R> {
  data: R;
  error?: Error;
  updatedAt?: Date;
}

function read<R>(query: SyncQuery): LiveState<R> {
  try {
    return { data: query.all() as R, updatedAt: new Date() };
  } catch (e) {
    return { data: [] as R, error: e as Error };
  }
}

export function useLiveQuery<Q extends SyncQuery>(query: Q, deps: unknown[] = []) {
  type R = ReturnType<Q['all']>;
  const [state, setState] = useState<LiveState<R>>(() => read<R>(query));

  useEffect(() => {
    const refresh = () =>
      setState((prev) => {
        const next = read<R>(query);
        if (next.error) return { ...prev, error: next.error };
        const data = shareRows(prev.data as unknown[], next.data as unknown[]) as R;
        return data === prev.data && !prev.error ? prev : { data, updatedAt: next.updatedAt };
      });
    // Deps changed (another topic): read now rather than wait for a change.
    refresh();
    const table = tableOf(query);
    return table ? subscribe(table, refresh) : undefined;
    // The query is rebuilt every render; `deps` says when it really changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return state;
}
