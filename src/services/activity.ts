import { lt } from 'drizzle-orm';

import { db } from '@/db/client';
import { activity, type ActivityEntry } from '@/db/schema';
import type { IconName } from '@/theme/icons';

export type ActivityKind =
  | 'updates-found'
  | 'check-quiet'
  | 'check-failed'
  | 'check-skipped'
  | 'beta-muted'
  | 'download-ready'
  | 'download-failed'
  | 'installed'
  | 'tracked'
  | 'untracked'
  | 'session-expired';

/**
 * Every push is mirrored here, and muted events (betas when betas are off, "nothing new")
 * land here without a push — so dismissing a notification never loses anything.
 */
export async function logActivity(entry: {
  kind: ActivityKind;
  tone: ActivityEntry['tone'];
  icon: IconName;
  title: string;
  text?: string | null;
  topicId?: number | null;
}) {
  await db.insert(activity).values({
    at: Date.now(),
    kind: entry.kind,
    tone: entry.tone,
    icon: entry.icon,
    title: entry.title,
    text: entry.text ?? null,
    topicId: entry.topicId ?? null,
  });
}

const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

export async function pruneActivity(now = Date.now()) {
  await db.delete(activity).where(lt(activity.at, now - KEEP_MS));
}

export async function clearActivity() {
  await db.delete(activity);
}
