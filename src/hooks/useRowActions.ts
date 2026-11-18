import * as Linking from 'expo-linking';
import { router } from 'expo-router';

import { useSnackbar } from '@/components/ui';
import { topicUrl } from '@/fourpda/urls';
import {
  cancel,
  install,
  InstallPermissionError,
  NoFileError,
  pause,
  queueUpdate,
  retry,
} from '@/services/downloads';
import { rowStatus, type LibraryItem } from './useLibrary';

/** What a row's trailing button does, by state. It acts directly and never opens the detail. */
export function useRowActions() {
  const snackbar = useSnackbar();

  const start = async (topicId: number, attachId?: number) => {
    try {
      await queueUpdate(topicId, attachId);
    } catch (e) {
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
      // Blocked: the Downloads tab carries the banner that unblocks it.
      if (e instanceof InstallPermissionError) router.navigate('/downloads');
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
        if (d?.error === 'sign-in') return router.push('/sign-in');
        return d && void retry(d.id);
      default:
        return undefined;
    }
  };

  return { act, start, installById };
}
