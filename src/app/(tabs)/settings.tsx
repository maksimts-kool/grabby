import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useRef } from 'react';
import { View } from 'react-native';
import { StyleSheet, UnistylesRuntime } from 'react-native-unistyles';

import { OptionsSheet, type OptionsSheetRef } from '@/components/OptionsSheet';
import {
  Banner,
  Gap,
  List,
  Screen,
  SectionHeader,
  SettingRow,
  Text,
  TopBar,
  useSnackbar,
} from '@/components/ui';
import { ORIGIN } from '@/fourpda/urls';
import { useSystemState } from '@/hooks/useSystemState';
import type { Abi } from '@/lib/abi';
import { formatDate } from '@/lib/format';
import { ABIS, CHECK_INTERVALS, useSetting, type SettingValue } from '@/lib/settings';
import { deviceAbis, native } from '@/native';
import { scheduleBackgroundCheck } from '@/services/background';
import { CHANNELS, requestNotifications } from '@/services/notifications';
import { signOut } from '@/services/session';

const intervalLabel = (h: number) => (h === 24 ? 'Daily' : `Every ${h} h`);
const THEMES = { system: 'Same as the phone', dark: 'Dark', light: 'Light' } as const;

/** Every preference on one screen: Checking, Notifications, Files, 4PDA account. */
export default function SettingsScreen() {
  const system = useSystemState();
  const snackbar = useSnackbar();
  const intervalSheet = useRef<OptionsSheetRef<SettingValue<'checkIntervalHours'>>>(null);
  const abiSheet = useRef<OptionsSheetRef<Abi | null>>(null);
  const themeSheet = useRef<OptionsSheetRef<SettingValue<'theme'>>>(null);

  const [interval, setCheckInterval] = useSetting('checkIntervalHours');
  const [wifiOnly, setWifiOnly] = useSetting('wifiOnly');
  const [autoDownload, setAutoDownload] = useSetting('autoDownload');
  const [notifyUpdates, setNotifyUpdates] = useSetting('notifyUpdates');
  const [notifyBetas, setNotifyBetas] = useSetting('notifyBetas');
  const [preferredAbi, setPreferredAbi] = useSetting('preferredAbi');
  const [deleteAfter, setDeleteAfter] = useSetting('deleteApkAfterInstall');
  const [theme, setTheme] = useSetting('theme');
  const [signedIn] = useSetting('signedIn');
  const [expiredAt] = useSetting('sessionExpiredAt');
  const phoneAbi = deviceAbis()[0];

  const account = (
    <View key="account">
      <SectionHeader title="4PDA account" />
      <List inset={54}>
        {signedIn ? (
          <SettingRow
            icon="user"
            title="Signed in"
            detail="Needed for files hidden from guests"
            value="Sign out"
            control="none"
            onPress={async () => {
              await signOut();
              snackbar({ message: 'Signed out of 4PDA' });
            }}
          />
        ) : expiredAt ? (
          <SettingRow
            icon="user"
            title="Session expired"
            detail={`Signed out by 4PDA on ${formatDate(expiredAt)}`}
            value="Sign in"
            control="none"
            onPress={() => router.push('/sign-in')}
          />
        ) : (
          <SettingRow
            testID="sign-in-row"
            icon="user"
            title="Sign in to 4PDA"
            detail="Needed for files hidden from guests"
            onPress={() => router.push('/sign-in')}
          />
        )}
      </List>
    </View>
  );

  const checking = (
    <View key="checking">
      <SectionHeader title="Checking" />
      <List inset={54}>
        <SettingRow
          icon="clock"
          title="Check for updates"
          value={intervalLabel(interval)}
          onPress={() =>
            intervalSheet.current?.open({
              title: 'Check for updates',
              selected: interval,
              options: CHECK_INTERVALS.map((h) => ({ value: h, label: intervalLabel(h) })),
              onSelect: (h) => {
                setCheckInterval(h);
                void scheduleBackgroundCheck();
              },
            })
          }
        />
        <SettingRow
          icon="wifi"
          title="Only on Wi‑Fi"
          detail="Applies to checks and downloads"
          on={wifiOnly}
          onToggle={setWifiOnly}
        />
        <SettingRow
          icon="download"
          title="Download in background"
          detail="You still tap to install"
          on={autoDownload}
          onToggle={setAutoDownload}
        />
      </List>
    </View>
  );

  const notifications = (
    <View key="notifications">
      <SectionHeader title="Notifications" />
      <List inset={54}>
        {system.notifications ? (
          <>
            <SettingRow
              icon="bell"
              title="New versions"
              on={notifyUpdates}
              onToggle={setNotifyUpdates}
            />
            <SettingRow
              icon="beta"
              title="Beta builds"
              detail="Posts marked beta, alpha or test"
              on={notifyBetas}
              onToggle={setNotifyBetas}
            />
            <SettingRow
              icon="settings"
              title="Notification channels"
              detail="Mute updates, downloads or problems separately"
              onPress={() => native.openNotificationSettings()}
            />
          </>
        ) : (
          <>
            <SettingRow
              icon="bell"
              title="Notifications are blocked"
              detail="Turned off in Android settings"
              value="Open"
              control="chevron"
              onPress={async () => {
                if (!system.notificationsCanAsk || !(await requestNotifications())) {
                  native.openNotificationSettings(CHANNELS.updates);
                }
              }}
            />
            <SettingRow
              icon="update"
              title="New versions"
              detail="Shown in Activity only"
              control="none"
            />
          </>
        )}
      </List>
    </View>
  );

  const filesGroup = (
    <View key="files">
      <SectionHeader title="Files" />
      <List inset={54}>
        <SettingRow
          icon="chip"
          title="Preferred build"
          value={preferredAbi ?? phoneAbi ?? 'Automatic'}
          onPress={() =>
            abiSheet.current?.open({
              title: 'Preferred build',
              selected: preferredAbi,
              options: [
                {
                  value: null,
                  label: 'This phone',
                  detail: phoneAbi ? `${phoneAbi}, then universal` : 'Best match first',
                },
                ...ABIS.map((a) => ({ value: a, label: a })),
              ],
              onSelect: setPreferredAbi,
            })
          }
        />
        <SettingRow
          icon="trash"
          title="Delete APK after install"
          on={deleteAfter}
          onToggle={setDeleteAfter}
        />
      </List>
    </View>
  );

  const appearance = (
    <View key="appearance">
      <SectionHeader title="Appearance" />
      <List inset={54}>
        <SettingRow
          icon="settings"
          title="Theme"
          value={THEMES[theme]}
          onPress={() =>
            themeSheet.current?.open({
              title: 'Theme',
              selected: theme,
              options: (Object.keys(THEMES) as (keyof typeof THEMES)[]).map((t) => ({
                value: t,
                label: THEMES[t],
              })),
              onSelect: (t) => {
                setTheme(t);
                UnistylesRuntime.setAdaptiveThemes(t === 'system');
                if (t !== 'system') UnistylesRuntime.setTheme(t);
              },
            })
          }
        />
      </List>
    </View>
  );

  const about = (
    <View key="about">
      <SectionHeader title="About" />
      <List inset={54}>
        <SettingRow
          icon="external"
          title="Open 4PDA"
          onPress={() => void Linking.openURL(ORIGIN)}
        />
      </List>
      <Text variant="caption" color="inkMuted" style={styles.footnote}>
        Grabby {Constants.expoConfig?.version} · an independent app, not made by 4PDA.
      </Text>
    </View>
  );

  // Signed out (or expired), the account moves to the top.
  const groups = signedIn
    ? [checking, notifications, filesGroup, account, appearance, about]
    : [account, checking, notifications, filesGroup, appearance, about];

  return (
    <>
      <Screen testID="settings">
        <TopBar large title="Settings" />
        {expiredAt && !signedIn ? (
          <>
            <Banner
              tone="warn"
              icon="user"
              title="Your 4PDA session expired"
              action="Sign in again"
              onAction={() => router.push('/sign-in')}
            >
              Files hidden from guests will fail to download until you sign in.
            </Banner>
            <Gap size={1} />
          </>
        ) : null}
        {groups}
      </Screen>
      <OptionsSheet ref={intervalSheet} />
      <OptionsSheet ref={abiSheet} />
      <OptionsSheet ref={themeSheet} />
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  footnote: { paddingHorizontal: theme.space[5], paddingTop: theme.space[4] },
}));
