import { asc, desc, eq, inArray, not } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import type { AppRowStatus } from '@/components/ui';
import { db } from '@/db/client';
import { apps, downloads, files, type App, type AppFile, type Download } from '@/db/schema';
import { abiFromFileName, pickFile } from '@/lib/abi';
import { formatSize } from '@/lib/format';
import { useSetting } from '@/lib/settings';
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
  if (d?.status === 'failed') return { status: 'failed', note: failureText(d.error) };
  if (item.update) return { status: 'update' };
  return { status: 'latest' };
}

export function fileSize(item: LibraryItem) {
  return item.file?.sizeBytes ? formatSize(item.file.sizeBytes) : undefined;
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

  const items: LibraryItem[] = appsQuery.data.map((app) => {
    const own = filesQuery.data.filter((f) => f.topicId === app.topicId);
    return {
      app,
      files: own,
      file: pickFile(own, abis, { preferredAbi, rememberedPattern: app.filePattern }),
      download:
        downloadsQuery.data.find(
          (d) => d.topicId === app.topicId && d.version === app.latestVersion,
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
              d.version === app.latestVersion && !['cancelled', 'installed'].includes(d.status),
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
