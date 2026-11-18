import { desc, inArray, not } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { block, card, CardList, type CardListItem } from '@/components/CardList';
import {
  AppRow,
  Banner,
  Button,
  EmptyState,
  Gap,
  SectionHeader,
  TopBar,
  useSnackbar,
} from '@/components/ui';
import { db } from '@/db/client';
import { apps, downloads, type Download } from '@/db/schema';
import { useCheck } from '@/hooks/useCheck';
import { useRowActions } from '@/hooks/useRowActions';
import { useSystemState } from '@/hooks/useSystemState';
import { formatSize, formatSpeed, formatTransferred, meta } from '@/lib/format';
import { useSetting } from '@/lib/settings';
import { native } from '@/native';
import {
  cancel,
  deleteInstalledApks,
  failureText,
  installedApks,
  onInstallResult,
  pause,
  pauseAll,
  resume,
  resumeAll,
  retry,
  allowMobileDataOnce,
} from '@/services/downloads';

/** The queue: what's moving, what waits, what's ready for the install tap, what failed and why. */
export default function DownloadsScreen() {
  const insets = useSafeAreaInsets();
  const system = useSystemState(5000);
  const check = useCheck();
  const actions = useRowActions();
  const snackbar = useSnackbar();
  const [wifiOnly] = useSetting('wifiOnly');
  const rows = useLiveQuery(
    db
      .select()
      .from(downloads)
      .where(not(inArray(downloads.status, ['cancelled', 'installed'])))
      .orderBy(desc(downloads.createdAt)),
  );
  const appRows = useLiveQuery(db.select().from(apps));
  const installed = useLiveQuery(installedApks());

  useEffect(
    () =>
      onInstallResult((e) => {
        if (e.status === 'aborted') snackbar({ message: 'Install cancelled' });
        else if (!['success', 'pending-user'].includes(e.status)) {
          snackbar({
            message:
              e.status === 'storage'
                ? 'Not enough space to install'
                : 'Android couldn’t install this file',
          });
        }
      }),
    [snackbar],
  );

  const app = (d: Download) => appRows.data.find((a) => a.topicId === d.topicId);
  const active = rows.data.filter((d) => d.status === 'downloading' || d.status === 'queued');
  const paused = rows.data.filter((d) => d.status === 'paused');
  const ready = rows.data.filter((d) => d.status === 'ready');
  const failed = rows.data.filter((d) => d.status === 'failed');
  const waitingForWifi =
    wifiOnly && system.network !== 'wifi' && active.some((d) => d.status === 'queued' && d.workId);
  const storageFail = failed.find((d) => d.error === 'storage');
  const freeable = installed.data.reduce((sum, d) => sum + (d.bytesTotal ?? 0), 0);

  const subtitle = waitingForWifi
    ? 'Paused · waiting for Wi‑Fi'
    : active.length
      ? meta(`${active.length} in progress`, system.network === 'wifi' ? 'on Wi‑Fi' : null)
      : ready.length
        ? `${ready.length} ready to install`
        : failed.length
          ? `${failed.length} failed`
          : undefined;

  const row = (d: Download) => {
    const a = app(d);
    const name = a?.title ?? d.fileName;
    const progress = d.bytesTotal ? (d.bytesDone / d.bytesTotal) * 100 : 0;
    const common = {
      name,
      iconSrc: a?.iconUri,
      installed: a?.installedVersion,
      latest: d.version,
      size: d.bytesTotal ? formatSize(d.bytesTotal) : undefined,
      onPress: () => router.push(`/app/${d.topicId}`),
    };
    let node;
    switch (d.status) {
      case 'downloading':
        node = (
          <AppRow
            {...common}
            status="downloading"
            progress={progress}
            transferred={formatTransferred(d.bytesDone, d.bytesTotal)}
            speed={d.speed ? formatSpeed(d.speed) : undefined}
            onAction={() => void pause(d.id)}
          />
        );
        break;
      case 'queued':
        node = <AppRow {...common} status="queued" onAction={() => void cancel(d.id)} />;
        break;
      case 'paused':
        node = (
          <AppRow
            {...common}
            status="queued"
            note="Paused"
            trailing={
              <Button
                size="sm"
                variant="secondary"
                icon={undefined}
                onPress={() => void resume(d.id)}
              >
                Resume
              </Button>
            }
          />
        );
        break;
      case 'ready':
        node = (
          <AppRow
            {...common}
            status="ready"
            actionDisabled={!system.installAllowed}
            onAction={() => void actions.installById(d.id)}
          />
        );
        break;
      default:
        node = (
          <AppRow
            {...common}
            status="failed"
            note={failureText(d.error)}
            trailing={
              d.error === 'sign-in' ? (
                <Button size="sm" variant="secondary" onPress={() => router.push('/sign-in')}>
                  Sign in
                </Button>
              ) : undefined
            }
            onAction={() => void retry(d.id)}
          />
        );
    }
    return { key: String(d.id), node };
  };

  const items: CardListItem[] = [
    block('top', <TopBar large title="Downloads" subtitle={subtitle} />),
  ];

  if (rows.updatedAt !== undefined && !rows.data.length) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]} testID="downloads-empty">
        <TopBar large title="Downloads" />
        <View style={styles.centre}>
          <EmptyState
            icon="download"
            title="Nothing downloading"
            secondary={check.checking ? 'Checking…' : 'Check for updates'}
            onSecondary={() => void check.run()}
          >
            Updates you start show up here. Finished files wait here until you install them.
          </EmptyState>
        </View>
      </View>
    );
  }

  if (ready.length && !system.installAllowed) {
    items.push(
      block(
        'perm',
        <Banner
          tone="warn"
          icon="shield"
          title="Install permission is off"
          action="Open settings"
          onAction={native.openInstallPermissionSettings}
        >
          Android blocks installs from Grabby until you allow it.
        </Banner>,
      ),
    );
  } else if (storageFail) {
    const a = app(storageFail);
    items.push(
      block(
        'storage',
        <Banner
          tone="danger"
          icon="folder"
          title={`Not enough space for ${a?.title ?? storageFail.fileName}${storageFail.bytesTotal ? ` (${formatSize(storageFail.bytesTotal)})` : ''}`}
          action={
            installed.data.length
              ? `Delete ${installed.data.length} installed APKs · ${formatSize(freeable)}`
              : undefined
          }
          onAction={async () => {
            const freed = await deleteInstalledApks();
            snackbar({ message: `${formatSize(freed)} freed` });
            await retry(storageFail.id);
          }}
        >
          Free up space on the phone or let Grabby remove files it no longer needs.
        </Banner>,
      ),
    );
  } else if (waitingForWifi) {
    items.push(
      block(
        'wifi',
        <Banner
          tone="info"
          icon="wifi"
          title="Waiting for Wi‑Fi"
          action="Use mobile data this once"
          onAction={() => void allowMobileDataOnce()}
        >
          Downloads resume on Wi‑Fi — you set this in Settings.
        </Banner>,
      ),
    );
  }
  if (items.length > 1) items.push(block('banner-gap', <Gap size={1} />));

  if (active.length) {
    items.push(
      block(
        'active-h',
        <SectionHeader
          title={waitingForWifi ? 'Queued' : 'In progress'}
          count={waitingForWifi ? active.length : undefined}
          action="Pause all"
          onAction={() => void pauseAll()}
        />,
      ),
      ...card('active', active.map(row)),
    );
  }
  if (paused.length) {
    items.push(
      block(
        'paused-h',
        <SectionHeader title="Paused" action="Resume all" onAction={() => void resumeAll()} />,
      ),
      ...card('paused', paused.map(row)),
    );
  }
  if (ready.length) {
    items.push(
      block('ready-h', <SectionHeader title="Ready to install" />),
      ...card('ready', ready.map(row)),
    );
  }
  if (failed.length) {
    items.push(
      block('failed-h', <SectionHeader title="Failed" />),
      ...card('failed', failed.map(row)),
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="downloads">
      <CardList items={items} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  centre: { flex: 1, justifyContent: 'center' },
}));
