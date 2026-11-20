import { useLiveQuery } from '@/db/live';
import { router } from 'expo-router';
import { useState } from 'react';

import {
  AppRow,
  Button,
  List,
  Screen,
  SectionHeader,
  StatusChip,
  TopBar,
  useSnackbar,
} from '@/components/ui';
import { db } from '@/db/client';
import { apps } from '@/db/schema';
import { fetchTopic, FourPdaError } from '@/fourpda/client';
import { trackTopic, untrack } from '@/services/apps';
import { native } from '@/native';

/** The 4PDA topics Grabby has been checked against. Only these can be added for now. */
const SUPPORTED = [
  { topicId: 181125, name: 'OsmAnd', note: 'Maps and navigation' },
  { topicId: 719545, name: 'Moovit', note: 'Public transport' },
] as const;

/** Pick one of the supported apps and start tracking it. */
export default function AddAppScreen() {
  const snackbar = useSnackbar();
  const [busy, setBusy] = useState<number | null>(null);
  const tracked = useLiveQuery(
    db
      .select({ id: apps.topicId, iconUri: apps.iconUri, topicIconUrl: apps.topicIconUrl })
      .from(apps),
  );
  const trackedIds = new Set(tracked.data.map((t) => t.id));
  const trackedIcon = (topicId: number) => {
    const t = tracked.data.find((a) => a.id === topicId);
    return t ? (t.iconUri ?? t.topicIconUrl) : null;
  };

  const track = async (topicId: number) => {
    setBusy(topicId);
    try {
      const r = await fetchTopic(topicId);
      if (r.status !== 'ok') return;
      const pkg = r.topic.packageName ? await native.getPackage(r.topic.packageName) : null;
      await trackTopic(r.topic, r.lastModified, pkg);
      snackbar({
        message: `Tracking ${r.topic.title}`,
        action: 'Undo',
        onAction: () => void untrack(topicId),
      });
    } catch (e) {
      const code = e instanceof FourPdaError ? e.code : 'parse';
      snackbar({
        message: code === 'network' ? 'Couldn’t reach 4PDA' : 'Couldn’t read this topic',
      });
    } finally {
      setBusy(null);
    }
  };

  const trailing = (topicId: number) =>
    trackedIds.has(topicId) ? (
      <StatusChip tone="tracking" />
    ) : (
      <Button
        size="sm"
        variant="secondary"
        icon="plus"
        loading={busy === topicId}
        onPress={() => void track(topicId)}
        testID={`track-${topicId}`}
      >
        Track
      </Button>
    );

  return (
    <Screen testID="add-app">
      <TopBar back title="Add app" />
      <SectionHeader title="Supported apps" />
      <List>
        {SUPPORTED.map((app) => (
          <AppRow
            key={app.topicId}
            name={app.name}
            iconSrc={trackedIcon(app.topicId)}
            status={trackedIds.has(app.topicId) ? 'tracked' : 'track'}
            note={app.note}
            trailing={trailing(app.topicId)}
            onPress={() => router.push(`/app/${app.topicId}`)}
          />
        ))}
      </List>
    </Screen>
  );
}
