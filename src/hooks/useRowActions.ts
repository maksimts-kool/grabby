import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useSyncExternalStore } from 'react';

import { useSnackbar } from '@/components/ui';
import { topicUrl } from '@/fourpda/urls';
import {
  cancel,
  getInstalling,
  install,
  InstallPermissionError,
  needsSignIn,
  NoFileError,
  pause,
  queueUpdate,
  retry,
  subscribeInstalling,
} from '@/services/downloads';
import { settings } from '@/lib/settings';
import { rowStatus, type LibraryItem } from './useLibrary';

// Topics whose Download/Update was just tapped: the button shows loading until the queued row
// lands in the database and the screen re-reads it (can take seconds while a refresh runs).
let starting: readonly number[] = [];
const startingListeners = new Set<() => void>();
function setStarting(topicId: number, on: boolean) {
  starting = on ? [...starting, topicId] : starting.filter((t) => t !== topicId);
  startingListeners.forEach((l) => l());
}
const subscribeStarting = (l: () => void) => {
  startingListeners.add(l);
  return () => {
    startingListeners.delete(l);
  };
};

/** Topic ids whose download is being queued right now. */
export function useStarting(): readonly number[] {
  return useSyncExternalStore(subscribeStarting, () => starting);
}

/** Download ids whose install is in progress: their Install buttons show loading. */
export function useInstalling(): readonly number[] {
  return useSyncExternalStore(subscribeInstalling, getInstalling);
}

/** What a row's trailing button does, by state. It acts directly and never opens the detail. */
export function useRowActions() {
  const snackbar = useSnackbar();

  const start = async (topicId: number, attachId?: number) => {
    if (starting.includes(topicId)) return;
    setStarting(topicId, true);
    try {
      await queueUpdate(topicId, attachId);
      // The queued row reaches the screen a moment after this resolves; until then the button
      // would flash back to "Download". Once the row shows, progress replaces the button anyway.
      setTimeout(() => setStarting(topicId, false), 5000);
    } catch (e) {
      setStarting(topicId, false);
      if (e instanceof NoFileError) {
        snackbar({
          message: 'No APK in this topic yet',
          action: 'Open topic',
          onAction: () => void Linking.openURL(topicUrl(topicId)),
        });
      } else {
        snackbar({ message: 'Couldn’t start the download' });
      }
    }
  };

  const installById = async (downloadId: number) => {
    try {
      await install(downloadId);
    } catch (e) {
      // Blocked: Downloads carries the banner that unblocks it.
      if (e instanceof InstallPermissionError) router.push('/downloads');
      else snackbar({ message: 'The downloaded file is gone — download it again' });
    }
  };

  const act = (item: LibraryItem) => {
    const d = item.download;
    switch (rowStatus(item).status) {
      case 'update':
        return void start(item.app.topicId);
      case 'downloading':
        return d && void pause(d.id);
      case 'queued':
        return d && void cancel(d.id);
      case 'ready':
        return d && void installById(d.id);
      case 'failed':
        if (d && needsSignIn(d.error, settings.get('signedIn'))) return router.push('/sign-in');
        return d && void retry(d.id);
      default:
        return undefined;
    }
  };

  return { act, start, installById };
}
