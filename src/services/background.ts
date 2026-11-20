import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { isCheckDue, isCheckLate, needsReschedule } from '@/lib/schedule';
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
    if (checksDelayed()) {
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

/**
 * Registers the periodic check with the interval from Settings. Safe to call on every launch:
 * the task is only re-registered when it's missing or its interval changed, because
 * re-registering restarts WorkManager's countdown. Doing that on every launch meant anyone who
 * opened the app more often than the interval never got a background check.
 */
export async function scheduleBackgroundCheck() {
  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return false;
  const minutes = settings.get('checkIntervalHours') * 60;
  const registered = (await TaskManager.getRegisteredTasksAsync()).find(
    (t) => t.taskName === CHECK_TASK,
  );
  const registeredMinutes = registered
    ? Number((registered.options as { minimumInterval?: unknown })?.minimumInterval) || null
    : null;
  if (!needsReschedule(registeredMinutes, minutes)) return true;

  if (registered) await BackgroundTask.unregisterTaskAsync(CHECK_TASK);
  await BackgroundTask.registerTaskAsync(CHECK_TASK, { minimumInterval: minutes });
  // The countdown starts now; a check that's already due runs on the next app open anyway.
  settings.set('nextCheckAt', Date.now() + minutes * 60_000);
  return true;
}

/**
 * Catch-up check when the app opens: WorkManager won't run the task while the app is in the
 * foreground and Android may defer it for hours, so check here once a full interval has passed.
 */
export async function checkIfDue(now = Date.now()) {
  if (!settings.get('onboarded')) return;
  if (!isCheckDue(settings.get('lastCheckAt'), settings.get('checkIntervalHours'), now)) return;
  await checkAll('start');
}

/** Last check more than twice the interval ago: Android is holding checks back. */
export function checksDelayed(now = Date.now()) {
  return isCheckLate(settings.get('lastCheckAt'), settings.get('checkIntervalHours'), now);
}
