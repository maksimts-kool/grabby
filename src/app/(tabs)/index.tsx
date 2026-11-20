import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { AppActionsSheet, type AppActionsSheetRef } from '@/components/AppActionsSheet';
import { block, card, CardList, type CardListItem } from '@/components/CardList';
import {
  AppRow,
  Banner,
  EmptyState,
  Gap,
  SearchField,
  SectionHeader,
  Skeleton,
  SkeletonGroup,
  TopBar,
  UpdateSummary,
  useSnackbar,
} from '@/components/ui';
import { useCheck } from '@/hooks/useCheck';
import { fileSize, rowStatus, useLibrary, type LibraryItem } from '@/hooks/useLibrary';
import { useInstalling, useRowActions, useStarting } from '@/hooks/useRowActions';
import { useNow } from '@/hooks/useSystemState';
import { formatClock, formatRelative, formatTransferred, formatSpeed } from '@/lib/format';
import { queueAllUpdates } from '@/services/downloads';

const SKELETON_WIDTHS = [62, 48, 70, 55, 40];

/** My apps: the update summary, then tracked apps in "Updates available" and "Up to date". */
export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const lib = useLibrary();
  const check = useCheck();
  const actions = useRowActions();
  const installing = useInstalling();
  const starting = useStarting();
  const snackbar = useSnackbar();
  const sheet = useRef<AppActionsSheetRef>(null);
  const now = useNow();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  const updateAll = async () => {
    setBusy(true);
    try {
      const n = await queueAllUpdates();
      snackbar({
        message: n ? `${n} ${n === 1 ? 'update' : 'updates'} queued` : 'Nothing to download yet',
        action: n ? 'View' : undefined,
        onAction: () => router.push('/downloads'),
      });
    } finally {
      setBusy(false);
    }
  };

  const ready = lib.items.filter((i) => i.download?.status === 'ready').length;
  const topBar = (subtitle: string) => (
    <TopBar
      large
      title="My apps"
      subtitle={subtitle}
      actions={[
        ...(lib.items.length
          ? [
              {
                icon: 'download' as const,
                label: ready ? `Downloads, ${ready} ready to install` : 'Downloads',
                badge: ready > 0,
                onPress: () => router.push('/downloads'),
                testID: 'downloads',
              },
            ]
          : []),
        { icon: 'plus', label: 'Add app', onPress: () => router.push('/add'), testID: 'add-app' },
      ]}
    />
  );

  if (!lib.loaded) return <View style={[styles.root, { paddingTop: insets.top }]} />;

  // Empty: the only place the logo appears after onboarding.
  if (!lib.items.length) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]} testID="library-empty">
        {topBar('Nothing tracked yet')}
        <View style={styles.centre}>
          <EmptyState
            logo
            title="No apps yet"
            action="Add app"
            actionIcon="plus"
            onAction={() => router.push('/add')}
          >
            Add apps from 4PDA topics and Grabby will tell you when a new version is posted.
          </EmptyState>
        </View>
      </View>
    );
  }

  const firstCheck = !lib.lastChecked && check.checking;
  const offline =
    !check.checking &&
    (check.lastResult?.skipped === 'offline' ||
      check.lastResult?.failed.some((f) => f.code === 'network'));
  const subtitle = firstCheck
    ? `Checking ${lib.items.length} topics…`
    : `${lib.items.length} tracked from 4PDA`;

  const row = (item: LibraryItem) => {
    const { status, note } = rowStatus(item);
    const d = item.download;
    const progress = d?.bytesTotal ? (d.bytesDone / d.bytesTotal) * 100 : 0;
    return {
      key: String(item.app.topicId),
      node: (
        <AppRow
          testID={`app-row-${item.app.topicId}`}
          name={item.app.title}
          iconSrc={item.app.iconUri ?? item.app.topicIconUrl}
          status={status}
          note={note}
          installed={item.app.installedVersion}
          latest={item.app.latestVersion}
          size={fileSize(item)}
          progress={progress}
          transferred={d ? formatTransferred(d.bytesDone, d.bytesTotal) : undefined}
          speed={d?.speed ? formatSpeed(d.speed) : undefined}
          onPress={() => router.push(`/app/${item.app.topicId}`)}
          onLongPress={() => sheet.current?.open(item.app)}
          onAction={() => actions.act(item)}
          installing={!!d && installing.includes(d.id)}
          actionLoading={starting.includes(item.app.topicId)}
        />
      ),
    };
  };

  const needle = query.trim().toLowerCase();
  const match = (i: LibraryItem) => !needle || i.app.title.toLowerCase().includes(needle);
  const updates = lib.updates.filter(match);
  const upToDate = lib.upToDate.filter(match);

  const items: CardListItem[] = [block('top', topBar(subtitle))];
  if (offline) {
    items.push(
      block(
        'offline',
        <Banner
          tone="danger"
          icon="offline"
          title="Couldn’t reach 4PDA"
          action="Retry now"
          onAction={() => void check.run()}
        >
          {lib.lastChecked
            ? `Showing what Grabby found at ${formatClock(lib.lastChecked)}. It tries again on the next check.`
            : 'Grabby tries again on the next check.'}
        </Banner>,
      ),
      block('offline-gap', <Gap />),
    );
  }

  if (firstCheck) {
    items.push(
      block(
        'summary-skeleton',
        <SkeletonGroup>
          <View style={styles.summarySkeleton}>
            <Skeleton width="55%" height={28} />
            <Skeleton width="40%" height={12} />
            <Skeleton height={48} radius={999} />
          </View>
        </SkeletonGroup>,
      ),
      block(
        'checking',
        <SectionHeader
          title={
            check.progress
              ? `Checking ${check.progress.done + 1} of ${check.progress.total}`
              : 'Checking'
          }
        />,
      ),
      ...card(
        'skeleton',
        SKELETON_WIDTHS.map((w, i) => ({
          key: String(i),
          node: (
            <SkeletonGroup>
              <Skeleton row width={w} action />
            </SkeletonGroup>
          ),
        })),
      ),
    );
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <CardList items={items} />
      </View>
    );
  }

  items.push(
    block(
      'summary',
      <UpdateSummary
        count={lib.updates.length}
        size={lib.updateSize}
        checked={lib.lastChecked ? `checked ${formatRelative(lib.lastChecked, now)}` : undefined}
        tracked={lib.items.length}
        checking={check.checking}
        busy={busy}
        onCheck={() => void check.run()}
        onUpdateAll={() => void updateAll()}
      />,
    ),
  );
  // Always shown under the summary: filters the lists without hiding the summary, and there's
  // no toggle to close it, only Clear.
  if (lib.items.length > 1) {
    items.push(
      block('search-gap', <Gap />),
      block(
        'search',
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder="Search your apps"
          label="Search your apps"
        />,
      ),
    );
  }
  if (updates.length) {
    items.push(
      block('updates-h', <SectionHeader title="Updates available" />),
      ...card('updates', updates.map(row)),
    );
  }
  if (upToDate.length) {
    items.push(
      block('latest-h', <SectionHeader title="Up to date" count={upToDate.length} />),
      ...card('latest', upToDate.map(row)),
    );
  }
  if (needle && !updates.length && !upToDate.length) {
    items.push(
      block('no-match', <EmptyState icon="search" title={`No tracked app matches “${query}”`} />),
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="library">
      <CardList items={items} refreshing={false} onRefresh={() => void check.run()} />
      <AppActionsSheet ref={sheet} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  centre: { flex: 1, justifyContent: 'center' },
  summarySkeleton: {
    marginHorizontal: theme.gutter,
    padding: theme.space[5],
    gap: theme.space[3],
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
}));
