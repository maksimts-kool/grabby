import { asc, desc, eq, inArray, not } from 'drizzle-orm';
import { useLiveQuery } from '@/db/live';

import type { AppRowStatus } from '@/components/ui';
import { db } from '@/db/client';
import { apps, downloads, files, type App, type AppFile, type Download } from '@/db/schema';
import { abiFromFileName, pickFile } from '@/lib/abi';
import { formatSize } from '@/lib/format';
import { settings, useSetting } from '@/lib/settings';
import { hasUpdate } from '@/lib/updates';
import { deviceAbis } from '@/native';
import { failureText } from '@/services/downloads';

export interface LibraryItem {
  app: App;
  files: AppFile[];
  /** The build Grabby would download: remembered pattern, else best ABI match. */
  file: AppFile | null;
  /** Download of the latest version, if one exists and isn't finished. */
  download: Download | null;
  update: boolean;
}

/** Status for AppRow, from the app's update state and its download. */
export function rowStatus(item: LibraryItem): { status: AppRowStatus; note?: string } {
  const d = item.download;
  if (d?.status === 'downloading') return { status: 'downloading' };
  if (d?.status === 'queued') return { status: 'queued' };
  if (d?.status === 'ready') return { status: 'ready' };
  if (d?.status === 'failed') {
    return { status: 'failed', note: failureText(d.error, settings.get('signedIn')) };
  }
  if (item.update) return { status: 'update' };
  return { status: 'latest' };
}

function groupBy<T, K>(rows: T[], key: (row: T) => K) {
  const map = new Map<K, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = map.get(k);
    if (list) list.push(row);
    else map.set(k, [row]);
  }
  return map;
}

export function fileSize(item: LibraryItem) {
  return item.file?.sizeBytes ? formatSize(item.file.sizeBytes) : undefined;
}

/**
 * Updates not yet downloading, for the Apps tab badge. Reads only the apps table and the
 * download ids, so the tab bar doesn't redo the whole library on every progress tick.
 */
export function useUpdateCount() {
  const appsQuery = useLiveQuery(db.select().from(apps));
  const downloadsQuery = useLiveQuery(
    db
      .select({ topicId: downloads.topicId, version: downloads.version })
      .from(downloads)
      .where(not(inArray(downloads.status, ['cancelled', 'installed']))),
  );
  const [betas] = useSetting('notifyBetas');
  const started = new Set(downloadsQuery.data.map((d) => `${d.topicId}:${d.version}`));
  return appsQuery.data.filter(
    (a) => hasUpdate(a, betas) && !started.has(`${a.topicId}:${a.latestVersion}`),
  ).length;
}

/** Tracked apps with their files and downloads, live from SQLite. */
export function useLibrary() {
  const appsQuery = useLiveQuery(db.select().from(apps).orderBy(desc(apps.latestSeenAt)));
  const filesQuery = useLiveQuery(db.select().from(files).orderBy(asc(files.position)));
  const downloadsQuery = useLiveQuery(
    db
      .select()
      .from(downloads)
      .where(not(inArray(downloads.status, ['cancelled', 'installed'])))
      .orderBy(desc(downloads.createdAt)),
  );
  const [betas] = useSetting('notifyBetas');
  const [preferredAbi] = useSetting('preferredAbi');
  const abis = deviceAbis();

  const filesByTopic = groupBy(filesQuery.data, (f) => f.topicId);
  const downloadsByTopic = groupBy(downloadsQuery.data, (d) => d.topicId);
  const items: LibraryItem[] = appsQuery.data.map((app) => {
    const own = filesByTopic.get(app.topicId) ?? [];
    return {
      app,
      files: own,
      file: pickFile(own, abis, { preferredAbi, rememberedPattern: app.filePattern }),
      download:
        downloadsByTopic.get(app.topicId)?.find(
          (d) =>
            d.version === app.latestVersion &&
            // A leftover try for the version already installed isn't this app's state.
            d.version !== app.installedVersion,
        ) ?? null,
      update: hasUpdate(app, betas),
    };
  });

  const updates = items.filter((i) => i.update);
  const upToDate = items.filter((i) => !i.update);
  const updateBytes = updates.reduce((sum, i) => sum + (i.file?.sizeBytes ?? 0), 0);
  const lastChecked = appsQuery.data.reduce<number | null>(
    (max, a) => (a.lastCheckedAt && (!max || a.lastCheckedAt > max) ? a.lastCheckedAt : max),
    null,
  );

  return {
    loaded: appsQuery.updatedAt !== undefined,
    items,
    updates,
    upToDate,
    updateSize: updateBytes ? formatSize(updateBytes) : undefined,
    lastChecked,
  };
}

/** One app with its files and download, for the detail screen. */
export function useApp(topicId: number) {
  const appQuery = useLiveQuery(db.select().from(apps).where(eq(apps.topicId, topicId)), [topicId]);
  const filesQuery = useLiveQuery(
    db.select().from(files).where(eq(files.topicId, topicId)).orderBy(asc(files.position)),
    [topicId],
  );
  const downloadsQuery = useLiveQuery(
    db
      .select()
      .from(downloads)
      .where(eq(downloads.topicId, topicId))
      .orderBy(desc(downloads.createdAt)),
    [topicId],
  );
  const [betas] = useSetting('notifyBetas');
  const [preferredAbi] = useSetting('preferredAbi');
  const app = appQuery.data[0] ?? null;
  const abis = deviceAbis();
  const fitting = filesQuery.data.find((f) => {
    const abi = abiFromFileName(f.name);
    return abi !== null && abi !== 'universal' && abis[0] === abi;
  });
  const item: LibraryItem | null = app
    ? {
        app,
        files: filesQuery.data,
        file: pickFile(filesQuery.data, abis, { preferredAbi, rememberedPattern: app.filePattern }),
        download:
          downloadsQuery.data.find(
            (d) =>
              d.version === app.latestVersion &&
              d.version !== app.installedVersion &&
              !['cancelled', 'installed'].includes(d.status),
          ) ?? null,
        update: hasUpdate(app, betas),
      }
    : null;
  return {
    loaded: appQuery.updatedAt !== undefined,
    item,
    fittingAttachId: fitting?.attachId ?? null,
  };
}
