import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { App } from '@/db/schema';
import { topicUrl } from '@/fourpda/urls';
import { ignoreVersion, setNotifyBetas, untrack } from '@/services/apps';
import { Icon, type IconName, Text, useSnackbar } from './ui';

export interface AppActionsSheetRef {
  open: (app: App) => void;
}

/**
 * Long-press on a row, or More on the detail screen: Open topic, Ignore this version,
 * beta alerts for this app, Copy topic link, Stop tracking (with Undo).
 */
export const AppActionsSheet = forwardRef<AppActionsSheetRef, { onUntracked?: () => void }>(
  function AppActionsSheet({ onUntracked }, ref) {
    const sheet = useRef<BottomSheetModal>(null);
    const [app, setApp] = useState<App | null>(null);
    const { theme } = useUnistyles();
    const insets = useSafeAreaInsets();
    const snackbar = useSnackbar();

    useImperativeHandle(ref, () => ({
      open: (a) => {
        setApp(a);
        sheet.current?.present();
      },
    }));

    const close = () => sheet.current?.dismiss();
    const act = (fn: () => unknown) => () => {
      close();
      void fn();
    };

    type Item = { icon: IconName; label: string; danger?: boolean; run: () => unknown };
    const list: (Item | null)[] = app
      ? [
          {
            icon: 'external',
            label: 'Open topic on 4PDA',
            run: () => Linking.openURL(topicUrl(app.topicId)),
          },
          app.latestVersion && app.ignoredVersion !== app.latestVersion
            ? {
                icon: 'close' as const,
                label: `Ignore ${app.latestVersion}`,
                run: async () => {
                  await ignoreVersion(app.topicId, app.latestVersion);
                  snackbar({
                    message: `${app.latestVersion} ignored`,
                    action: 'Undo',
                    onAction: () => void ignoreVersion(app.topicId, app.ignoredVersion),
                  });
                },
              }
            : null,
          {
            icon: 'beta' as const,
            label: app.notifyBetas ? 'Stop beta alerts for this app' : 'Notify about betas',
            run: () => setNotifyBetas(app.topicId, !app.notifyBetas),
          },
          {
            icon: 'link' as const,
            label: 'Copy topic link',
            run: async () => {
              await Clipboard.setStringAsync(topicUrl(app.topicId));
              snackbar({ message: 'Topic link copied' });
            },
          },
          {
            icon: 'trash' as const,
            label: 'Stop tracking',
            danger: true,
            run: async () => {
              await untrack(app.topicId);
              onUntracked?.();
              snackbar({ message: `Stopped tracking ${app.title}` });
            },
          },
        ]
      : [];
    const items = list.filter((x): x is Item => x !== null);

    return (
      <BottomSheetModal
        ref={sheet}
        enableDynamicSizing
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
        )}
        backgroundStyle={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg }}
        handleIndicatorStyle={{ backgroundColor: theme.colors.lineStrong }}
      >
        <BottomSheetView style={[styles.body, { paddingBottom: insets.bottom + theme.space[3] }]}>
          {app ? (
            <Text variant="headline" style={styles.title} numberOfLines={1}>
              {app.title}
            </Text>
          ) : null}
          <View>
            {items.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="button"
                onPress={act(item.run)}
                android_ripple={{ color: theme.ripple.neutral }}
                style={styles.item}
              >
                <Icon name={item.icon} size={22} color={item.danger ? 'danger' : 'inkMuted'} />
                <Text variant="body" color={item.danger ? 'danger' : 'ink'}>
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create((theme) => ({
  body: { paddingTop: theme.space[1] },
  title: { paddingHorizontal: theme.space[5], paddingBottom: theme.space[2] },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[4],
    minHeight: theme.size.touchMin + 8,
    paddingHorizontal: theme.space[5],
  },
}));
