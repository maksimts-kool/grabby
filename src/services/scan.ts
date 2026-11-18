import { db } from '@/db/client';
import { apps, suggestions } from '@/db/schema';
import { FourPdaError, searchTopics } from '@/fourpda/client';
import { native } from '@/native';
import { labelMatches } from './apps';

export interface ScanProgress {
  done: number;
  total: number;
  matches: number;
}

const DELAY_MS = 1200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * "Looking for your apps on 4PDA": searches each installed (non-system) app's name and keeps
 * the topic whose title matches it as a suggestion for Add app. One search per app, spaced
 * out, and stoppable. 4PDA only lets members search, so this needs a session.
 */
export async function scanPhone(
  onProgress: (p: ScanProgress) => void,
  signal: AbortSignal,
): Promise<ScanProgress> {
  const installed = (await native.getInstalledPackages(false)).filter(
    (p) => p.label && p.label !== p.packageName,
  );
  const tracked = new Set(
    (await db.select({ pkg: apps.packageName }).from(apps)).map((r) => r.pkg),
  );
  const todo = installed.filter((p) => !tracked.has(p.packageName));
  const progress: ScanProgress = { done: 0, total: todo.length, matches: 0 };
  onProgress({ ...progress });

  for (const pkg of todo) {
    if (signal.aborted) break;
    try {
      const hits = await searchTopics(pkg.label, signal);
      const hit = hits.find((h) => labelMatches(pkg.label, h.title));
      if (hit) {
        progress.matches++;
        await db
          .insert(suggestions)
          .values({
            topicId: hit.topicId,
            title: hit.title,
            packageName: pkg.packageName,
            label: pkg.label,
            installedVersion: pkg.versionName,
            foundAt: Date.now(),
          })
          .onConflictDoNothing();
      }
    } catch (e) {
      if (signal.aborted) break;
      if (
        e instanceof FourPdaError &&
        (e.code === 'sign-in' || e.code === 'network' || e.code === 'rate-limited')
      ) {
        throw e;
      }
    }
    progress.done++;
    onProgress({ ...progress });
    await sleep(DELAY_MS);
  }
  return progress;
}
