import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';

import { native } from '@/native';

/**
 * Four Android channels, so each can be muted separately in system settings:
 *   updates   default        a background check found new versions (one, updated in place)
 *   downloads low, ongoing   download progress — posted by the native download worker
 *   ready     high           a download finished and needs the install tap — native worker
 *   problems  default        a background download or check failed; the action is the fix
 */
export const CHANNELS = {
  updates: 'updates',
  downloads: 'downloads',
  ready: 'ready',
  problems: 'problems',
} as const;

const UPDATES_ID = 'updates';

export async function setupNotifications() {
  Notifications.setNotificationHandler({
    // In the foreground the screens already show everything; keep pushes quiet there.
    handleNotification: async () => ({
      shouldShowBanner: false,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });

  await Promise.all([
    Notifications.setNotificationChannelAsync(CHANNELS.updates, {
      name: 'New versions',
      importance: AndroidImportance.DEFAULT,
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.downloads, {
      name: 'Downloads in progress',
      importance: AndroidImportance.LOW,
      showBadge: false,
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.ready, {
      name: 'Ready to install',
      importance: AndroidImportance.HIGH,
    }),
    Notifications.setNotificationChannelAsync(CHANNELS.problems, {
      name: 'Problems',
      importance: AndroidImportance.DEFAULT,
    }),
  ]);
  native.ensureChannels();

  await Notifications.setNotificationCategoryAsync('updates', [
    {
      identifier: 'update-all',
      buttonTitle: 'Update all',
      options: { opensAppToForeground: true },
    },
    { identifier: 'view', buttonTitle: 'View', options: { opensAppToForeground: true } },
  ]);
}

export async function notificationsAllowed() {
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

/** Returns whether notifications are allowed and whether Android will still ask. */
export async function notificationPermission() {
  const p = await Notifications.getPermissionsAsync();
  return { granted: p.granted, canAskAgain: p.canAskAgain };
}

export async function requestNotifications() {
  const { granted } = await Notifications.requestPermissionsAsync();
  return granted;
}

/** One grouped notification per check, updated in place: "3 updates on 4PDA". */
export async function notifyUpdates(lines: string[]) {
  if (!lines.length || !(await notificationsAllowed())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: UPDATES_ID,
    content: {
      title: `${lines.length} ${lines.length === 1 ? 'update' : 'updates'} on 4PDA`,
      body: lines.join('\n'),
      categoryIdentifier: 'updates',
      data: { url: '/' },
    },
    trigger: { channelId: CHANNELS.updates },
  });
}

export async function clearUpdatesNotification() {
  await Notifications.dismissNotificationAsync(UPDATES_ID).catch(() => {});
}

/** Background failures only. The body names the fix; tapping opens where it happens. */
export async function notifyProblem(id: string, title: string, body: string, url: string) {
  if (!(await notificationsAllowed())) return;
  await Notifications.scheduleNotificationAsync({
    identifier: `problem-${id}`,
    content: { title, body, data: { url } },
    trigger: { channelId: CHANNELS.problems },
  });
}

/**
 * Taps deep-link through the same routes as the app: updates → Apps tab,
 * problems → where the fix is. (Native download notifications use grabby:// links.)
 */
export function handleNotificationResponses(onUpdateAll: () => void) {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const { actionIdentifier, notification } = response;
    if (actionIdentifier === 'update-all') {
      onUpdateAll();
      router.push('/downloads');
      return;
    }
    const url = notification.request.content.data?.url;
    if (typeof url === 'string') router.navigate(url as never);
  });
  return () => sub.remove();
}
