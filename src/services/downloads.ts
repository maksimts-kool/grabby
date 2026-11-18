import { and, asc, eq, inArray, isNotNull, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { apps, downloads, files, type Download } from '@/db/schema';
import { USER_AGENT } from '@/fourpda/client';
import { pickFile } from '@/lib/abi';
import { formatSize } from '@/lib/format';
import { settings } from '@/lib/settings';
import { hasUpdate } from '@/lib/updates';
import { deviceAbis, native, type DownloadError } from '@/native';
import { logActivity } from './activity';
import { refreshInstalled, rememberFile } from './apps';
import { notifyProblem } from './notifications';
import { markSessionExpired } from './session';

/**
 * The download queue. Rows live in SQLite (the UI reads them live); the bytes move in the
 * native WorkManager job. At most two run at once — the rest wait here in order.
 *
 *   queued (workId null)   waiting in Grabby's queue
 *   queued (workId set)    handed to WorkManager, waiting for the network it's allowed to use
 *   downloading            bytes flowing
 *   paused | failed        stopped; resume / retry puts it back in the queue
 *   ready                  file on disk, waiting for the install tap
 *   installed | cancelled  done
 */
export const MAX_PARALLEL = 2;
const ACTIVE: Download['status'][] = ['queued', 'downloading'];

export class NoFileError extends Error {
  constructor() {
    super('No APK in this topic');
  }
}
export class InstallPermissionError extends Error {
  constructor() {
    super('Install permission is off');
  }
}

/** The sentence a failure shows in its row: what happened and what fixes it. */
export function failureText(error: string | null): string {
  switch (error as DownloadError | null) {
    case 'sign-in':
      return 'Sign in to 4PDA to get this file';
    case 'gone':
      return 'File is gone from the topic';
    case 'storage':
      return 'Not enough storage';
    case 'network':
      return 'Couldn’t reach 4PDA';
    case 'corrupt':
      return 'File didn’t download completely — retry';
    default:
      return 'Download failed';
  }
}

async function appTitle(topicId: number) {
  const [app] = await db.select({ title: apps.title }).from(apps).where(eq(apps.topicId, topicId));
  return app?.title ?? 'App';
}

/** Queues the latest build of one tracked app. Returns the download row id. */
export async function queueUpdate(topicId: number, attachId?: number): Promise<number> {
  const [app] = await db.select().from(apps).where(eq(apps.topicId, topicId));
  if (!app) throw new Error('Not tracked');
  const existing = await db
    .select()
    .from(downloads)
    .where(
      and(
        eq(downloads.topicId, topicId),
        inArray(downloads.status, [...ACTIVE, 'paused', 'ready']),
      ),
    );
  const sameVersion = existing.find((d) => d.version === app.latestVersion);
  if (sameVersion) {
    if (sameVersion.status === 'paused') await resume(sameVersion.id);
    return sameVersion.id;
  }

  const options = await db
    .select()
    .from(files)
    .where(eq(files.topicId, topicId))
    .orderBy(asc(files.position));
  const file = attachId
    ? options.find((f) => f.attachId === attachId)
    : pickFile(options, deviceAbis(), {
        preferredAbi: settings.get('preferredAbi'),
        rememberedPattern: app.filePattern,
      });
  if (!file) throw new NoFileError();
  if (attachId) await rememberFile(topicId, file.name);

  // An older version still waiting is replaced by the new one.
  for (const old of existing) await cancel(old.id);

  const now = Date.now();
  const [row] = await db
    .insert(downloads)
    .values({
      topicId,
      attachId: file.attachId,
      fileName: file.name,
      url: file.url,
      version: app.latestVersion,
      status: 'queued',
      bytesTotal: file.sizeBytes,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: downloads.id });
  await pump();
  return row.id;
}

/** "Update all": queues every app with an update. Returns how many were queued. */
export async function queueAllUpdates(): Promise<number> {
  const betas = settings.get('notifyBetas');
  const rows = await db.select().from(apps);
  let queued = 0;
  for (const app of rows.filter((a) => hasUpdate(a, betas))) {
    try {
      await queueUpdate(app.topicId);
      queued++;
    } catch {
      // No APK in that topic: its row says so.
    }
  }
  return queued;
}

/** Hands queued rows to WorkManager while fewer than MAX_PARALLEL are running. */
export async function pump(options: { mobileDataOnce?: boolean } = {}) {
  const handed = await db
    .select({ id: downloads.id })
    .from(downloads)
    .where(and(inArray(downloads.status, ACTIVE), isNotNull(downloads.workId)));
  let slots = MAX_PARALLEL - handed.length;
  if (slots <= 0) return;
  const waiting = await db
    .select()
    .from(downloads)
    .where(and(eq(downloads.status, 'queued'), isNull(downloads.workId)))
    .orderBy(asc(downloads.createdAt));
  for (const d of waiting) {
    if (slots-- <= 0) break;
    await handOff(d, options.mobileDataOnce ?? false);
  }
}

async function handOff(d: Download, mobileDataOnce: boolean) {
  const [app] = await db.select().from(apps).where(eq(apps.topicId, d.topicId));
  const workId = native.enqueueDownload({
    id: String(d.id),
    url: d.url,
    fileName: d.fileName,
    title: [app?.title, d.version].filter(Boolean).join(' '),
    installedVersion: app?.installedVersion ?? null,
    wifiOnly: settings.get('wifiOnly') && !mobileDataOnce,
    userAgent: USER_AGENT,
  });
  await db
    .update(downloads)
    .set({ workId: workId ?? 'unavailable', pauseReason: null, updatedAt: Date.now() })
    .where(eq(downloads.id, d.id));
}

/** "Use mobile data this once": re-enqueues waiting jobs without the Wi‑Fi constraint. */
export async function allowMobileDataOnce() {
  const waiting = await db
    .select()
    .from(downloads)
    .where(and(eq(downloads.status, 'queued'), isNotNull(downloads.workId)));
  for (const d of waiting) await handOff(d, true);
  await pump({ mobileDataOnce: true });
}

export async function pause(id: number) {
  native.pauseDownload(String(id));
  await db
    .update(downloads)
    .set({
      status: 'paused',
      pauseReason: 'user',
      workId: null,
      speed: null,
      updatedAt: Date.now(),
    })
    .where(eq(downloads.id, id));
  await pump();
}

export async function pauseAll() {
  const rows = await db.select().from(downloads).where(inArray(downloads.status, ACTIVE));
  for (const d of rows) await pause(d.id);
}

export async function resume(id: number) {
  await db
    .update(downloads)
    .set({ status: 'queued', workId: null, pauseReason: null, error: null, updatedAt: Date.now() })
    .where(eq(downloads.id, id));
  await pump();
}

export async function resumeAll() {
  const rows = await db.select().from(downloads).where(eq(downloads.status, 'paused'));
  for (const d of rows) await resume(d.id);
}

export const retry = resume;

export async function cancel(id: number) {
  const [d] = await db.select().from(downloads).where(eq(downloads.id, id));
  if (!d) return;
  native.cancelDownload(String(id), d.fileName);
  if (d.path) native.deleteApk(d.path);
  await db
    .update(downloads)
    .set({ status: 'cancelled', workId: null, updatedAt: Date.now() })
    .where(eq(downloads.id, id));
  await pump();
}

/** Opens Android's installer for a finished file. Android always asks the user to confirm. */
export async function install(id: number) {
  const [d] = await db.select().from(downloads).where(eq(downloads.id, id));
  if (!d?.path) throw new Error('Not downloaded');
  if (!native.canRequestPackageInstalls()) throw new InstallPermissionError();
  await native.installApk(d.path, String(id));
}

/** APKs of versions already installed: what "Delete … installed APKs" can free. */
export function installedApks() {
  return db
    .select()
    .from(downloads)
    .where(and(eq(downloads.status, 'installed'), isNotNull(downloads.path)));
}

export async function deleteInstalledApks() {
  let freed = 0;
  for (const d of await installedApks()) {
    if (d.path && native.deleteApk(d.path)) freed += d.bytesTotal ?? 0;
    await db.update(downloads).set({ path: null }).where(eq(downloads.id, d.id));
  }
  return freed;
}

// region Native events

async function onProgress(e: { id: string; bytesDone: number; bytesTotal: number; speed: number }) {
  await db
    .update(downloads)
    .set({
      status: 'downloading',
      bytesDone: e.bytesDone,
      bytesTotal: e.bytesTotal > 0 ? e.bytesTotal : null,
      speed: e.speed,
      updatedAt: Date.now(),
    })
    .where(and(eq(downloads.id, Number(e.id)), inArray(downloads.status, ACTIVE)));
}

async function onComplete(e: { id: string; path: string; bytesTotal: number }) {
  const id = Number(e.id);
  await db
    .update(downloads)
    .set({
      status: 'ready',
      path: e.path,
      bytesDone: e.bytesTotal,
      bytesTotal: e.bytesTotal,
      speed: null,
      updatedAt: Date.now(),
    })
    .where(eq(downloads.id, id));
  const [d] = await db.select().from(downloads).where(eq(downloads.id, id));
  if (d) {
    const [app] = await db.select().from(apps).where(eq(apps.topicId, d.topicId));
    await logActivity({
      kind: 'download-ready',
      tone: 'success',
      icon: 'box',
      title: `${app?.title ?? d.fileName} ${d.version ?? ''} is ready`.trim(),
      text: app?.installedVersion
        ? `Tap to install over ${app.installedVersion}`
        : 'Tap to install',
      topicId: d.topicId,
    });
  }
  await pump();
}

async function onFailed(e: { id: string; error: DownloadError; message: string }) {
  const id = Number(e.id);
  await db
    .update(downloads)
    .set({ status: 'failed', error: e.error, workId: null, speed: null, updatedAt: Date.now() })
    .where(eq(downloads.id, id));
  const [d] = await db.select().from(downloads).where(eq(downloads.id, id));
  if (d) {
    const title = await appTitle(d.topicId);
    await logActivity({
      kind: 'download-failed',
      tone: 'danger',
      icon: 'alert',
      title: `${title} download failed`,
      text: failureText(e.error),
      topicId: d.topicId,
    });
    if (e.error === 'sign-in' && markSessionExpired()) {
      await logActivity({
        kind: 'session-expired',
        tone: 'danger',
        icon: 'user',
        title: 'Your 4PDA session expired',
      });
      await notifyProblem(
        'session',
        'Your 4PDA session expired',
        'Sign in again to download files hidden from guests.',
        '/settings',
      );
    } else if (e.error === 'storage') {
      await notifyProblem(
        `dl-${id}`,
        `Not enough space for ${title}`,
        'Free up space or let Grabby delete installed APKs.',
        '/downloads',
      );
    }
  }
  await pump();
}

async function onPaused(e: { id: string }) {
  await db
    .update(downloads)
    .set({
      status: 'paused',
      pauseReason: 'user',
      workId: null,
      speed: null,
      updatedAt: Date.now(),
    })
    .where(eq(downloads.id, Number(e.id)));
  await pump();
}

type InstallListener = (e: { downloadId: number; status: string; message: string }) => void;
const installListeners = new Set<InstallListener>();
/** Screens use this to show a snackbar when an install is cancelled or fails. */
export function onInstallResult(listener: InstallListener) {
  installListeners.add(listener);
  return () => {
    installListeners.delete(listener);
  };
}

async function onInstallStatus(e: {
  downloadId: string;
  status: string;
  packageName: string;
  message: string;
}) {
  const id = Number(e.downloadId);
  installListeners.forEach((l) => l({ downloadId: id, status: e.status, message: e.message }));
  if (e.status !== 'success') return;
  const [d] = await db.select().from(downloads).where(eq(downloads.id, id));
  if (!d) return;
  let text: string | null = null;
  if (settings.get('deleteApkAfterInstall') && d.path && native.deleteApk(d.path)) {
    text = `APK deleted · ${formatSize(d.bytesTotal)} freed`;
    await db.update(downloads).set({ path: null }).where(eq(downloads.id, id));
  }
  await db
    .update(downloads)
    .set({ status: 'installed', updatedAt: Date.now() })
    .where(eq(downloads.id, id));
  await refreshInstalled([d.topicId]);
  const title = await appTitle(d.topicId);
  await logActivity({
    kind: 'installed',
    tone: 'success',
    icon: 'check',
    title: `${title} ${d.version ?? ''} installed`.trim(),
    text,
    topicId: d.topicId,
  });
}

let subscribed = false;
/** Subscribes to native events once, then reconciles with what WorkManager did meanwhile. */
export async function startDownloadService() {
  if (!subscribed) {
    subscribed = true;
    native.addListener('onDownloadProgress', (e) => void onProgress(e));
    native.addListener('onDownloadComplete', (e) => void onComplete(e));
    native.addListener('onDownloadFailed', (e) => void onFailed(e));
    native.addListener('onDownloadPaused', (e) => void onPaused(e));
    native.addListener('onInstallStatus', (e) => void onInstallStatus(e));
  }
  await reconcile();
  await pump();
}

/** Catches up on jobs that finished, failed or were paused while the app wasn't running. */
export async function reconcile() {
  const states = await native.getDownloads();
  if (!states.length) return;
  const byId = new Map(states.map((s) => [Number(s.id), s]));
  const rows = await db
    .select()
    .from(downloads)
    .where(and(inArray(downloads.status, ACTIVE), isNotNull(downloads.workId)));
  for (const d of rows) {
    const s = byId.get(d.id);
    if (!s) continue;
    if (s.state === 'succeeded' && s.path)
      await onComplete({ id: s.id, path: s.path, bytesTotal: s.bytesTotal });
    else if (s.state === 'failed')
      await onFailed({ id: s.id, error: s.error ?? 'unknown', message: '' });
    else if (s.state === 'cancelled') {
      await db
        .update(downloads)
        .set({
          status: s.paused ? 'paused' : 'cancelled',
          pauseReason: s.paused ? 'user' : null,
          workId: null,
        })
        .where(eq(downloads.id, d.id));
    } else if (s.state === 'running' && s.bytesDone > 0) {
      await onProgress({ id: s.id, bytesDone: s.bytesDone, bytesTotal: s.bytesTotal, speed: 0 });
    }
  }
}
// endregion
