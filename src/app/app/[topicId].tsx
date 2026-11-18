import { useMutation, useQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { AppActionsSheet, type AppActionsSheetRef } from '@/components/AppActionsSheet';
import {
  AppIcon,
  Banner,
  Button,
  Changelog,
  DownloadProgress,
  EmptyState,
  FileOption,
  Gap,
  List,
  Screen,
  SectionHeader,
  SettingRow,
  Skeleton,
  SkeletonGroup,
  StatusChip,
  Text,
  TopBar,
  VersionDelta,
  useSnackbar,
} from '@/components/ui';
import { fetchTopic, FourPdaError } from '@/fourpda/client';
import type { Topic } from '@/fourpda/parseTopic';
import { topicUrl } from '@/fourpda/urls';
import { useApp, type LibraryItem } from '@/hooks/useLibrary';
import { useRowActions } from '@/hooks/useRowActions';
import { useNow, useSystemState } from '@/hooks/useSystemState';
import { abiFromFileName } from '@/lib/abi';
import {
  formatEta,
  formatRelative,
  formatSize,
  formatSpeed,
  formatTransferred,
  meta,
} from '@/lib/format';
import { useSetting } from '@/lib/settings';
import { native } from '@/native';
import { rememberFile, setNotifyBetas, trackTopic } from '@/services/apps';
import { refreshTopic } from '@/services/checker';
import { cancel, failureText, pause, resume } from '@/services/downloads';

/** "16.11.2026" → "16 Nov" */
function postedDate(ddmmyyyy: string | null) {
  const m = ddmmyyyy?.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return undefined;
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${Number(m[1])} ${months[Number(m[2]) - 1]}`;
}

export default function AppDetailScreen() {
  const params = useLocalSearchParams<{ topicId: string }>();
  const topicId = Number(params.topicId);
  const { loaded, item } = useApp(topicId);
  const sheet = useRef<AppActionsSheetRef>(null);

  // A topic that isn't tracked (opened from a pasted link) is shown as a preview with Track.
  const preview = useQuery({
    queryKey: ['topic', topicId],
    queryFn: async () => {
      const r = await fetchTopic(topicId);
      if (r.status !== 'ok') throw new Error('not-modified');
      return r;
    },
    enabled: loaded && !item && Number.isFinite(topicId),
  });

  const bar = (
    <TopBar
      back
      actions={[
        {
          icon: 'external',
          label: 'Open topic on 4PDA',
          onPress: () => void Linking.openURL(topicUrl(topicId)),
        },
        ...(item
          ? [{ icon: 'more' as const, label: 'More', onPress: () => sheet.current?.open(item.app) }]
          : []),
      ]}
    />
  );

  if (!loaded || (!item && preview.isPending)) {
    return (
      <Screen testID="app-detail-loading">
        {bar}
        <LoadingBody />
      </Screen>
    );
  }

  if (!item) {
    if (preview.isError || !preview.data) {
      const code = preview.error instanceof FourPdaError ? preview.error.code : 'parse';
      return (
        <Screen centerContent>
          {bar}
          <EmptyState
            icon={code === 'network' ? 'offline' : 'alert'}
            tone="danger"
            title={
              code === 'not-found'
                ? 'This topic doesn’t exist'
                : code === 'network'
                  ? 'Couldn’t reach 4PDA'
                  : 'Couldn’t read this topic'
            }
            action={code === 'network' ? 'Retry' : undefined}
            onAction={() => void preview.refetch()}
            secondary="Open topic on 4PDA"
            onSecondary={() => void Linking.openURL(topicUrl(topicId))}
          >
            {code === 'sign-in'
              ? 'This topic is visible to signed-in members only.'
              : 'Check the link, or open the topic in the browser.'}
          </EmptyState>
        </Screen>
      );
    }
    return (
      <Preview topic={preview.data.topic} lastModified={preview.data.lastModified} bar={bar} />
    );
  }

  return (
    <>
      <Tracked item={item} bar={bar} />
      <AppActionsSheet ref={sheet} onUntracked={() => router.back()} />
    </>
  );
}

function LoadingBody() {
  return (
    <SkeletonGroup>
      <View style={styles.head}>
        <Skeleton width={72} height={72} radius={24} />
        <View style={[styles.id, styles.skeletonId]}>
          <Skeleton width="50%" height={22} />
          <Skeleton width="80%" height={12} />
          <Skeleton width="65%" height={14} />
        </View>
      </View>
      <View style={styles.pad}>
        <Skeleton height={48} radius={999} />
      </View>
      <SectionHeader title="File" />
      <View style={[styles.pad, styles.stack]}>
        <Skeleton height={62} radius={14} />
        <Skeleton height={62} radius={14} />
      </View>
      <SectionHeader title="What’s new" />
      <View style={[styles.pad, styles.stack]}>
        <Skeleton width="30%" height={14} />
        <Skeleton width="90%" />
        <Skeleton width="75%" />
        <Skeleton width="82%" />
      </View>
    </SkeletonGroup>
  );
}

function Header({
  name,
  iconSrc,
  sub,
  version,
}: {
  name: string;
  iconSrc?: string | null;
  sub: string;
  version: React.ReactNode;
}) {
  return (
    <View style={styles.head}>
      <AppIcon name={name} src={iconSrc} size="lg" />
      <View style={styles.id}>
        <Text variant="title" numberOfLines={2} accessibilityRole="header">
          {name}
        </Text>
        <Text variant="label" color="inkMuted" style={styles.sub} numberOfLines={1}>
          {sub}
        </Text>
        {version}
      </View>
    </View>
  );
}

function Tracked({ item, bar }: { item: LibraryItem; bar: React.ReactNode }) {
  const { app, files, download } = item;
  const now = useNow();
  const system = useSystemState();
  const actions = useRowActions();
  const snackbar = useSnackbar();
  const [betasGlobal] = useSetting('notifyBetas');
  const [chosen, setChosen] = useState<number | null>(null);
  const recheck = useMutation({ mutationFn: () => refreshTopic(app.topicId) });

  const active =
    download && ['queued', 'downloading', 'paused'].includes(download.status) ? download : null;
  const selected = active?.attachId ?? chosen ?? item.file?.attachId ?? null;
  const selectedFile = files.find((f) => f.attachId === selected) ?? item.file;
  const upToDate = !item.update && !!app.installedVersion;

  const sub = meta(
    app.category,
    app.latestMod && `mod ${app.latestMod}`,
    upToDate
      ? app.lastCheckedAt && `checked ${formatRelative(app.lastCheckedAt, now)}`
      : app.latestSeenAt && `topic updated ${formatRelative(app.latestSeenAt, now)}`,
  );
  const version = upToDate ? (
    <View style={styles.row}>
      <VersionDelta to={app.installedVersion} size="lg" />
      <StatusChip tone="latest">Up to date</StatusChip>
    </View>
  ) : (
    <VersionDelta from={app.installedVersion} to={app.latestVersion} size="lg" />
  );

  let primary: React.ReactNode;
  if (active) {
    const pct = active.bytesTotal ? (active.bytesDone / active.bytesTotal) * 100 : 0;
    const eta =
      active.speed && active.bytesTotal
        ? formatEta((active.bytesTotal - active.bytesDone) / active.speed)
        : undefined;
    primary = (
      <DownloadProgress
        progress={pct}
        transferred={
          active.bytesDone ? formatTransferred(active.bytesDone, active.bytesTotal) : undefined
        }
        speed={
          active.speed
            ? formatSpeed(active.speed)
            : active.status === 'queued'
              ? 'Waiting to start'
              : undefined
        }
        eta={eta}
        paused={active.status === 'paused'}
        reason={active.pauseReason === 'wifi' ? 'Waiting for Wi‑Fi' : 'Paused'}
        onPause={() => void pause(active.id)}
        onResume={() => void resume(active.id)}
        onCancel={() => void cancel(active.id)}
      />
    );
  } else if (download?.status === 'ready') {
    primary = (
      <Button
        block
        icon="box"
        disabled={!system.installAllowed}
        onPress={() => void actions.installById(download.id)}
        testID="install"
      >
        Install
      </Button>
    );
  } else if (item.update && selectedFile) {
    const size = selectedFile.sizeBytes ? ` (${formatSize(selectedFile.sizeBytes)})` : '';
    primary = (
      <Button
        block
        icon="download"
        onPress={() => void actions.start(app.topicId, selectedFile.attachId)}
        testID="update"
      >
        {`${app.installedVersion ? 'Update' : 'Download'}${size}`}
      </Button>
    );
  } else if (upToDate && app.packageName) {
    primary = (
      <Button
        block
        variant="secondary"
        icon="external"
        onPress={() => native.openApp(app.packageName!)}
      >
        {`Open ${app.title}`}
      </Button>
    );
  }

  const noFiles = !files.length;

  return (
    <Screen refreshing={recheck.isPending} onRefresh={() => recheck.mutate()} testID="app-detail">
      {bar}
      <Header name={app.title} iconSrc={app.iconUri} sub={sub} version={version} />

      {download?.status === 'failed' ? (
        <>
          <Banner
            tone="danger"
            title={failureText(download.error)}
            action={download.error === 'sign-in' ? 'Sign in to 4PDA' : 'Retry'}
            onAction={() =>
              download.error === 'sign-in' ? router.push('/sign-in') : void resume(download.id)
            }
          />
          <Gap />
        </>
      ) : null}
      {download?.status === 'ready' && !system.installAllowed ? (
        <>
          <Banner
            tone="warn"
            icon="shield"
            title="Install permission is off"
            action="Allow"
            onAction={native.openInstallPermissionSettings}
          >
            Android blocks installs from Grabby until you allow it.
          </Banner>
          <Gap />
        </>
      ) : null}
      {app.latestMod && item.update && app.installedVersion ? (
        <>
          <Banner tone="warn" icon="shield" title={`${app.latestVersion} is a mod`}>
            {`Posted as ${app.latestMod}. Mods are signed differently, so Android may refuse to install it over your copy until you uninstall that first.`}
          </Banner>
          <Gap />
        </>
      ) : null}
      {noFiles && item.update ? (
        <>
          <Banner
            tone="warn"
            title="Couldn’t find an APK in this topic"
            action="Open topic on 4PDA"
            onAction={() => void Linking.openURL(topicUrl(app.topicId))}
          >
            The first post may have changed its format, or the files are in a later post.
          </Banner>
          <Gap />
        </>
      ) : null}

      {primary ? <View style={styles.pad}>{primary}</View> : null}

      {upToDate ? (
        <>
          <SectionHeader title="Alerts" />
          <List inset={54}>
            <SettingRow
              icon="beta"
              title="Notify about betas"
              detail="For this app only"
              on={app.notifyBetas ?? betasGlobal}
              onToggle={(on) => void setNotifyBetas(app.topicId, on)}
            />
          </List>
        </>
      ) : null}

      <SectionHeader title="File" />
      <View style={[styles.pad, styles.stack]}>
        {noFiles ? (
          <>
            <FileOption
              name="No files found in the first post"
              abi="Pick one on 4PDA, then come back"
            />
            <Gap size={1} />
            <Button
              block
              variant="outline"
              icon="update"
              loading={recheck.isPending}
              onPress={() => recheck.mutate()}
            >
              Check the topic again
            </Button>
          </>
        ) : (
          files.map((f) => (
            <FileOption
              key={f.attachId}
              name={f.name}
              abi={abiFromFileName(f.name)}
              size={f.sizeBytes ? formatSize(f.sizeBytes) : undefined}
              note={
                /\bmod\b|_mod/i.test(f.name)
                  ? 'Mod'
                  : /\blite\b|_lite/i.test(f.name)
                    ? 'Lite'
                    : null
              }
              selected={f.attachId === selected}
              recommended={f.attachId === item.file?.attachId && abiFromFileName(f.name) !== null}
              disabled={!!active && f.attachId !== active.attachId}
              onPress={
                active
                  ? undefined
                  : () => {
                      setChosen(f.attachId);
                      void rememberFile(app.topicId, f.name);
                      snackbar({ message: 'Grabby will pick this build next time too' });
                    }
              }
            />
          ))
        )}
      </View>

      {app.changelog.length && app.latestVersion ? (
        <>
          <SectionHeader title="What’s new" />
          <View style={styles.pad}>
            <Changelog
              version={app.latestVersion}
              date={postedDate(app.headerUpdated)}
              beta={app.latestIsBeta}
              items={app.changelog}
            />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function Preview({
  topic,
  lastModified,
  bar,
}: {
  topic: Topic;
  lastModified: string | null;
  bar: React.ReactNode;
}) {
  const snackbar = useSnackbar();
  const track = useMutation({
    mutationFn: async () => {
      const pkg = topic.packageName ? await native.getPackage(topic.packageName) : null;
      await trackTopic(topic, lastModified, pkg);
    },
    onSuccess: () => snackbar({ message: `Tracking ${topic.title}` }),
  });
  return (
    <Screen testID="app-preview">
      {bar}
      <Header
        name={topic.title}
        sub={meta(topic.category, topic.mod && `mod ${topic.mod}`, topic.description) || 'From 4PDA'}
        version={<VersionDelta to={topic.version} size="lg" highlight />}
      />
      <View style={styles.pad}>
        <Button
          block
          icon="plus"
          loading={track.isPending}
          onPress={() => track.mutate()}
          testID="track"
        >
          Track
        </Button>
      </View>
      {topic.files.length ? (
        <>
          <SectionHeader title="Files" />
          <View style={[styles.pad, styles.stack]}>
            {topic.files.map((f) => (
              <FileOption
                key={f.attachId}
                name={f.name}
                abi={abiFromFileName(f.name)}
                size={f.sizeBytes ? formatSize(f.sizeBytes) : undefined}
              />
            ))}
          </View>
        </>
      ) : null}
      {topic.changelog.length && topic.version ? (
        <>
          <SectionHeader title="What’s new" />
          <View style={styles.pad}>
            <Changelog
              version={topic.version}
              date={postedDate(topic.headerUpdated)}
              beta={topic.isBeta}
              items={topic.changelog}
            />
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[4],
    paddingTop: theme.space[1],
    paddingHorizontal: theme.space[4],
    paddingBottom: theme.space[5],
  },
  id: { flex: 1, minWidth: 0 },
  skeletonId: { gap: theme.space[2] },
  sub: { marginTop: 2, marginBottom: 6, fontFamily: theme.type.caption.fontFamily },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space[2], flexWrap: 'wrap' },
  pad: { paddingHorizontal: theme.gutter },
  stack: { gap: theme.space[3] },
}));
