import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { settings } from '@/lib/settings';
import { native } from '@/native';
import { logActivity } from './activity';
import { checkAll } from './checker';
import { startDownloadService } from './downloads';

/**
 * Background checks run through expo-background-task (WorkManager underneath): 15 min minimum,
 * and Android decides the exact time — battery saver can push it much later. Activity's
 * subtitle shows last/next check so a starved schedule is visible.
 *
 * The task must be defined at module scope, before the app registers anything, so this file
 * is imported from the entry point.
 */
export const CHECK_TASK = 'grabby-check';

TaskManager.defineTask(CHECK_TASK, async () => {
  try {
    await startDownloadService();
    const last = settings.get('lastCheckAt');
    const intervalMs = settings.get('checkIntervalHours') * 3_600_000;
    if (last && Date.now() - last > intervalMs * 2) {
      await logActivity({
        kind: 'check-skipped',
        tone: 'neutral',
        icon: 'battery',
        title: 'Checks ran late',
        text: native.isIgnoringBatteryOptimizations()
          ? 'Android delayed the background check'
          : 'Battery saver is holding checks back',
      });
    }
    await checkAll('background');
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** (Re)registers the periodic check with the interval from Settings. */
export async function scheduleBackgroundCheck() {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
  const minutes = settings.get('checkIntervalHours') * 60;
  if (await TaskManager.isTaskRegisteredAsync(CHECK_TASK)) {
    await BackgroundTask.unregisterTaskAsync(CHECK_TASK);
  }
  await BackgroundTask.registerTaskAsync(CHECK_TASK, { minimumInterval: minutes });
  const last = settings.get('lastCheckAt') ?? Date.now();
  settings.set('nextCheckAt', last + minutes * 60_000);
  return true;
}

/** Last check more than twice the interval ago: Android is holding checks back. */
export function checksDelayed(now = Date.now()) {
  const last = settings.get('lastCheckAt');
  if (!last) return false;
  return now - last > settings.get('checkIntervalHours') * 3_600_000 * 2;
}
