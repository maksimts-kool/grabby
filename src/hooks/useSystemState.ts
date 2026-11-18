import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { native, type NetworkType } from '@/native';
import { notificationPermission } from '@/services/notifications';

export interface SystemState {
  notifications: boolean;
  /** Android won't show the notification prompt again. */
  notificationsCanAsk: boolean;
  installAllowed: boolean;
  batteryUnrestricted: boolean;
  network: NetworkType;
}

const initial = (): SystemState => ({
  notifications: true,
  notificationsCanAsk: true,
  installAllowed: native.canRequestPackageInstalls(),
  batteryUnrestricted: native.isIgnoringBatteryOptimizations(),
  network: native.getNetworkType(),
});

/**
 * Permissions and connectivity that live in system settings. Re-read whenever the app comes
 * back to the foreground, so a banner's fix takes effect as soon as the user returns.
 */
export function useSystemState(pollMs = 0) {
  const [state, setState] = useState<SystemState>(initial);
  useEffect(() => {
    let alive = true;
    const read = async () => {
      const p = await notificationPermission().catch(() => ({ granted: true, canAskAgain: true }));
      if (!alive) return;
      setState({
        notifications: p.granted,
        notificationsCanAsk: p.canAskAgain,
        installAllowed: native.canRequestPackageInstalls(),
        batteryUnrestricted: native.isIgnoringBatteryOptimizations(),
        network: native.getNetworkType(),
      });
    };
    void read();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void read());
    const timer = pollMs ? setInterval(read, pollMs) : null;
    return () => {
      alive = false;
      sub.remove();
      if (timer) clearInterval(timer);
    };
  }, [pollMs]);
  return state;
}

/** Re-renders every `ms` so relative times ("12 min ago") stay true. */
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
