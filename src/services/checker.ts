import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { apps, type App } from '@/db/schema';
import { fetchTopic, FourPdaError } from '@/fourpda/client';
import { settings } from '@/lib/settings';
import { hasUpdate } from '@/lib/updates';
import { native } from '@/native';
import { logActivity, pruneActivity } from './activity';
import { refreshInstalled, saveTopic } from './apps';
import { queueUpdate } from './downloads';
import { notifyProblem, notifyUpdates } from './notifications';

export type CheckReason = 'manual' | 'background' | 'start';

export interface CheckProgress {
  done: number;
  total: number;
}

export interface CheckResult {
  checked: number;
  found: App[];
  failed: { app: App; code: string }[];
  skipped?: 'wifi' | 'offline';
}

/** Pause between topics so a check never hammers the forum. */
const POLITE_DELAY_MS = 400;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let running: Promise<CheckResult> | null = null;
const listeners = new Set<(p: CheckProgress | null) => void>();

/** Live "Checking 6 of 14" progress for the UI; null when idle. */
export function onCheckProgress(listener: (p: CheckProgress | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
const emit = (p: CheckProgress | null) => listeners.forEach((l) => l(p));

/** "Check the topic again" on one app: a full fetch, ignoring If-Modified-Since. */
export async function refreshTopic(topicId: number) {
  const [app] = await db.select().from(apps).where(eq(apps.topicId, topicId));
  const result = await fetchTopic(topicId);
  if (result.status === 'ok') await saveTopic(result.topic, result.lastModified, app ?? null);
  await refreshInstalled([topicId]);
}

export function isChecking() {
  return running !== null;
}

/** Checks every tracked topic. Concurrent calls share the run in progress. */
export function checkAll(reason: CheckReason): Promise<CheckResult> {
  running ??= run(reason).finally(() => {
    running = null;
    emit(null);
  });
  return running;
}

async function run(reason: CheckReason): Promise<CheckResult> {
  const now = Date.now();
  const network = native.getNetworkType();
  if (network === 'none') {
    return { checked: 0, found: [], failed: [], skipped: 'offline' };
  }
  if (reason === 'background' && settings.get('wifiOnly') && network !== 'wifi') {
    await logActivity({
      kind: 'check-skipped',
      tone: 'neutral',
      icon: 'wifi',
      title: 'Check skipped',
      text: 'Waiting for Wi‑Fi',
    });
    return { checked: 0, found: [], failed: [], skipped: 'wifi' };
  }

  await refreshInstalled();
  const rows = await db.select().from(apps);
  const betas = settings.get('notifyBetas');
  const found: App[] = [];
  const failed: CheckResult['failed'] = [];

  for (let i = 0; i < rows.length; i++) {
    const app = rows[i];
    emit({ done: i, total: rows.length });
    try {
      const result = await fetchTopic(app.topicId, { lastModified: app.lastModified });
      if (result.status === 'not-modified') {
        await db
          .update(apps)
          .set({ lastCheckedAt: Date.now(), lastError: null })
          .where(eq(apps.topicId, app.topicId));
      } else {
        const { topic } = result;
        await saveTopic(topic, result.lastModified, app);
        const isNew = !!topic.version && topic.version !== app.latestVersion;
        const after: App = { ...app, latestVersion: topic.version, latestIsBeta: topic.isBeta };
        if (isNew && topic.isBeta && !(app.notifyBetas ?? betas)) {
          await logActivity({
            kind: 'beta-muted',
            tone: 'neutral',
            icon: 'beta',
            title: `Beta posted in ${app.title} topic`,
            text: `${topic.version} · betas are muted`,
            topicId: app.topicId,
          });
        } else if (isNew && hasUpdate(after, betas)) {
          found.push(after);
        }
      }
    } catch (e) {
      const code = e instanceof FourPdaError ? e.code : 'unknown';
      failed.push({ app, code });
      await db
        .update(apps)
        .set({ lastError: code, lastCheckedAt: Date.now() })
        .where(eq(apps.topicId, app.topicId));
      if (code === 'network' || code === 'rate-limited') break;
    }
    if (i < rows.length - 1) await sleep(POLITE_DELAY_MS);
  }

  const hours = settings.get('checkIntervalHours');
  settings.set('lastCheckAt', now);
  settings.set('nextCheckAt', now + hours * 3_600_000);

  if (found.length) {
    const names = found.map((a) => a.title).join(', ');
    await logActivity({
      kind: 'updates-found',
      tone: 'update',
      icon: 'update',
      title: `${found.length} new ${found.length === 1 ? 'version' : 'versions'} found`,
      text: names,
    });
    if (reason === 'background' && settings.get('notifyUpdates')) {
      await notifyUpdates(found.map((a) => `${a.title} ${a.latestVersion}`));
    }
    if (settings.get('autoDownload')) {
      // You still tap to install: background download only gets the file ready.
      for (const a of found) await queueUpdate(a.topicId).catch(() => {});
    }
  } else if (!failed.length && rows.length) {
    await logActivity({
      kind: 'check-quiet',
      tone: 'neutral',
      icon: 'clock',
      title: `Checked ${rows.length} ${rows.length === 1 ? 'topic' : 'topics'}`,
      text: 'Nothing new',
    });
  }

  if (failed.length) {
    const offline = failed.some((f) => f.code === 'network');
    await logActivity({
      kind: 'check-failed',
      tone: 'danger',
      icon: offline ? 'offline' : 'alert',
      title: offline
        ? 'Couldn’t reach 4PDA'
        : `Couldn’t check ${failed.length} ${failed.length === 1 ? 'topic' : 'topics'}`,
      text: offline
        ? 'Grabby tries again on the next check'
        : failed.map((f) => f.app.title).join(', '),
    });
    if (reason === 'background' && !offline && failed.length === rows.length) {
      await notifyProblem(
        'check',
        'Couldn’t check your apps',
        'Open Grabby to see what went wrong.',
        '/activity',
      );
    }
  }

  await pruneActivity();
  return { checked: rows.length, found, failed };
}
