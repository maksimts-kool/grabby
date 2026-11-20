import { desc } from 'drizzle-orm';
import { useLiveQuery } from '@/db/live';
import { router } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { block, card, CardList, type CardListItem } from '@/components/CardList';
import {
  ActivityItem,
  Banner,
  EmptyState,
  Gap,
  SectionHeader,
  TopBar,
  useSnackbar,
} from '@/components/ui';
import { db } from '@/db/client';
import { activity, type ActivityEntry } from '@/db/schema';
import { useNow, useSystemState } from '@/hooks/useSystemState';
import { formatClock, formatDay, meta } from '@/lib/format';
import { useSetting } from '@/lib/settings';
import { native } from '@/native';
import { clearActivity } from '@/services/activity';
import { checksDelayed } from '@/services/background';
import { requestNotifications } from '@/services/notifications';
import type { IconName } from '@/theme/icons';

/** Everything Grabby did or found, by day — including what it chose not to notify about. */
export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const system = useSystemState();
  const snackbar = useSnackbar();
  const now = useNow(60_000);
  const [lastCheckAt] = useSetting('lastCheckAt');
  const [nextCheckAt] = useSetting('nextCheckAt');
  const rows = useLiveQuery(db.select().from(activity).orderBy(desc(activity.at)).limit(500));

  const subtitle = lastCheckAt
    ? meta(
        `Last check ${formatClock(lastCheckAt)}`,
        nextCheckAt ? `next at ${formatClock(nextCheckAt)}` : null,
      )
    : nextCheckAt
      ? `First check at ${formatClock(nextCheckAt)}`
      : 'No checks yet';

  const clear = async () => {
    const saved = rows.data;
    await clearActivity();
    snackbar({
      message: 'Activity cleared',
      action: 'Undo',
      onAction: () => {
        // Drizzle queries are lazy: `void db.insert(…)` never ran. Await it (via then/catch).
        if (saved.length) {
          db.insert(activity)
            .values(saved)
            .catch(() => snackbar({ message: 'Couldn’t bring the activity back' }));
        }
      },
    });
  };

  const top = (
    <TopBar
      large
      title="Activity"
      subtitle={subtitle}
      actions={[
        ...(rows.data.length
          ? [{ icon: 'trash' as const, label: 'Clear activity', onPress: () => void clear() }]
          : []),
      ]}
    />
  );

  const banners: CardListItem[] = [];
  if (!system.notifications) {
    banners.push(
      block(
        'notif',
        <Banner
          tone="warn"
          icon="bell"
          title="Notifications are off"
          action="Turn on"
          onAction={async () => {
            if (!system.notificationsCanAsk || !(await requestNotifications()))
              native.openNotificationSettings();
          }}
        >
          Grabby can’t tell you about new versions. Everything still shows up here.
        </Banner>,
      ),
    );
  } else if (checksDelayed(now) && !system.batteryUnrestricted) {
    banners.push(
      block(
        'battery',
        <Banner
          tone="warn"
          icon="battery"
          title="Background checks are running late"
          action="Allow background activity"
          onAction={native.openBatteryOptimizationSettings}
        >
          Android’s battery saver is holding them back.
        </Banner>,
      ),
    );
  }
  if (banners.length) banners.push(block('banner-gap', <Gap size={1} />));

  if (rows.updatedAt !== undefined && !rows.data.length) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]} testID="activity-empty">
        {top}
        <CardList
          items={[
            ...banners,
            block(
              'empty',
              <View style={styles.empty}>
                <EmptyState icon="clock" title="Nothing yet">
                  {nextCheckAt
                    ? `The first background check runs around ${formatClock(nextCheckAt)}. Everything Grabby finds or does shows up here.`
                    : 'Everything Grabby finds or does shows up here.'}
                </EmptyState>
              </View>,
            ),
          ]}
        />
      </View>
    );
  }

  const days = new Map<string, ActivityEntry[]>();
  for (const entry of rows.data) {
    const day = formatDay(entry.at, now);
    days.set(day, [...(days.get(day) ?? []), entry]);
  }

  const open = (e: ActivityEntry) => {
    if (e.kind === 'download-failed' || e.kind === 'download-ready')
      return () => router.push('/downloads');
    if (e.kind === 'session-expired') return () => router.navigate('/settings');
    if (e.topicId) return () => router.push(`/app/${e.topicId}`);
    if (e.kind === 'updates-found') return () => router.navigate('/');
    return undefined;
  };

  const items: CardListItem[] = [block('top', top), ...banners];
  for (const [day, entries] of days) {
    items.push(
      block(`h-${day}`, <SectionHeader title={day} />),
      ...card(
        day,
        entries.map((e) => ({
          key: String(e.id),
          node: (
            <ActivityItem
              tone={e.tone}
              icon={e.icon as IconName}
              title={e.title}
              text={e.text}
              time={formatClock(e.at)}
              onPress={open(e)}
            />
          ),
        })),
        68,
      ),
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="activity">
      <CardList items={items} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  empty: { paddingTop: theme.space[10] },
}));
