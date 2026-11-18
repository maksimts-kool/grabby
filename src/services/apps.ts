import { and, eq, isNotNull, notInArray } from 'drizzle-orm';

import { db } from '@/db/client';
import { apps, files, suggestions, type App } from '@/db/schema';
import type { Topic } from '@/fourpda/parseTopic';
import { fileNamePattern } from '@/lib/abi';
import { native, type InstalledPackage } from '@/native';
import { logActivity } from './activity';

/** Writes what a check parsed from the topic. Files are replaced by the current set. */
export async function saveTopic(topic: Topic, lastModified: string | null, previous?: App | null) {
  const now = Date.now();
  const versionChanged = topic.version !== (previous?.latestVersion ?? null);
  const values = {
    title: topic.title,
    category: topic.category,
    packageName: previous?.packageName ?? topic.packageName,
    latestVersion: topic.version,
    latestIsBeta: topic.isBeta,
    latestSeenAt: versionChanged ? now : (previous?.latestSeenAt ?? now),
    headerUpdated: topic.headerUpdated,
    changelog: topic.changelog,
    lastCheckedAt: now,
    lastModified,
    lastError: topic.version || topic.files.length ? null : 'parse',
  };
  await db.transaction(async (tx) => {
    await tx
      .insert(apps)
      .values({ topicId: topic.id, createdAt: now, ...values })
      .onConflictDoUpdate({ target: apps.topicId, set: values });
    await tx.delete(files).where(eq(files.topicId, topic.id));
    if (topic.files.length) {
      await tx
        .insert(files)
        .values(
          topic.files.map((f, i) => ({
            attachId: f.attachId,
            topicId: topic.id,
            name: f.name,
            url: f.url,
            sizeBytes: f.sizeBytes,
            version: topic.version,
            position: i,
          })),
        )
        .onConflictDoNothing();
    }
  });
}

export async function trackTopic(
  topic: Topic,
  lastModified: string | null,
  installed?: InstalledPackage | null,
) {
  await saveTopic(topic, lastModified, null);
  if (installed) await linkPackage(topic.id, installed);
  else if (topic.packageName) await refreshInstalled([topic.id]);
  await db.update(suggestions).set({ dismissed: true }).where(eq(suggestions.topicId, topic.id));
  await logActivity({
    kind: 'tracked',
    tone: 'neutral',
    icon: 'plus',
    title: `Tracking ${topic.title}`,
    topicId: topic.id,
  });
}

export async function untrack(topicId: number) {
  await db.delete(apps).where(eq(apps.topicId, topicId));
}

export async function ignoreVersion(topicId: number, version: string | null) {
  await db.update(apps).set({ ignoredVersion: version }).where(eq(apps.topicId, topicId));
}

export async function setNotifyBetas(topicId: number, value: boolean | null) {
  await db.update(apps).set({ notifyBetas: value }).where(eq(apps.topicId, topicId));
}

/** Remember which build the user picked, so the next update auto-picks the same one. */
export async function rememberFile(topicId: number, fileName: string) {
  await db
    .update(apps)
    .set({ filePattern: fileNamePattern(fileName) })
    .where(eq(apps.topicId, topicId));
}

async function linkPackage(topicId: number, pkg: InstalledPackage) {
  await db
    .update(apps)
    .set({
      packageName: pkg.packageName,
      installedVersion: pkg.versionName,
      installedVersionCode: pkg.versionCode,
      iconUri: await native.getAppIcon(pkg.packageName),
    })
    .where(eq(apps.topicId, topicId));
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '');

/** Label ↔ topic title, for topics whose header doesn't name the package. */
export function labelMatches(label: string, title: string): boolean {
  const a = normalise(label);
  const b = normalise(title);
  if (a.length < 3 || b.length < 3) return a === b && a.length > 0;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

/**
 * Reads installed versions (and icons) from PackageManager into the apps table. Topics that
 * don't know their package yet are matched by app name. Runs on every check and app start.
 */
export async function refreshInstalled(onlyTopicIds?: number[]) {
  if (!native.available) return;
  const installed = await native.getInstalledPackages(false);
  const byPackage = new Map(installed.map((p) => [p.packageName, p]));
  const rows = await db.select().from(apps);
  for (const app of rows) {
    if (onlyTopicIds && !onlyTopicIds.includes(app.topicId)) continue;
    let pkg = app.packageName ? byPackage.get(app.packageName) : undefined;
    if (!app.packageName) pkg = installed.find((p) => labelMatches(p.label, app.title));
    const versionName = pkg?.versionName ?? null;
    const versionCode = pkg?.versionCode ?? null;
    if (
      pkg &&
      (versionName !== app.installedVersion || !app.iconUri || app.packageName !== pkg.packageName)
    ) {
      await linkPackage(app.topicId, pkg);
    } else if (!pkg && app.installedVersion) {
      await db
        .update(apps)
        .set({ installedVersion: null, installedVersionCode: null })
        .where(eq(apps.topicId, app.topicId));
    } else if (pkg && versionCode !== app.installedVersionCode) {
      await db
        .update(apps)
        .set({ installedVersionCode: versionCode })
        .where(eq(apps.topicId, app.topicId));
    }
  }
  // Keep suggestion notes ("You have 0.27.2") current, and drop ones for uninstalled apps.
  const known = await db.select().from(suggestions).where(isNotNull(suggestions.packageName));
  for (const s of known) {
    const pkg = byPackage.get(s.packageName);
    if (!pkg) await db.delete(suggestions).where(eq(suggestions.topicId, s.topicId));
    else if (pkg.versionName !== s.installedVersion) {
      await db
        .update(suggestions)
        .set({ installedVersion: pkg.versionName })
        .where(eq(suggestions.topicId, s.topicId));
    }
  }
}

/** Suggestions that aren't tracked or dismissed. */
export function openSuggestions() {
  return db
    .select()
    .from(suggestions)
    .where(
      and(
        eq(suggestions.dismissed, false),
        notInArray(suggestions.topicId, db.select({ id: apps.topicId }).from(apps)),
      ),
    );
}
