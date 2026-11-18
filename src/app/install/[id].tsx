import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';

import { install } from '@/services/downloads';

/**
 * Target of the "ready" notification (grabby://install/<downloadId>): opens Android's installer
 * for that file, then leaves the user on Downloads. If the install is blocked, the Downloads
 * banner explains why.
 */
export default function InstallRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  useEffect(() => {
    const downloadId = Number(id);
    router.replace('/downloads');
    if (Number.isFinite(downloadId)) install(downloadId).catch(() => {});
  }, [id]);
  return null;
}
