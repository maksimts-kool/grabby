import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  AppRow,
  Banner,
  Button,
  EmptyState,
  Gap,
  List,
  Screen,
  SearchField,
  SectionHeader,
  Skeleton,
  SkeletonGroup,
  StatusChip,
  TopBar,
  useSnackbar,
} from '@/components/ui';
import { db } from '@/db/client';
import { apps } from '@/db/schema';
import { fetchTopic, FourPdaError, searchTopics } from '@/fourpda/client';
import { parseTopicLink } from '@/fourpda/urls';
import { trackTopic, untrack } from '@/services/apps';
import { native } from '@/native';

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const looksLikeLink = (s: string) => /^(https?:\/\/|www\.|[\w-]+\.[a-z]{2,}\/)/i.test(s.trim());

/** Find an app's 4PDA topic and start tracking it. */
export default function AddAppScreen() {
  const snackbar = useSnackbar();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const debounced = useDebounced(query.trim(), 300);
  const tracked = useLiveQuery(db.select({ id: apps.topicId }).from(apps));
  const trackedIds = new Set(tracked.data.map((t) => t.id));

  const isLink = looksLikeLink(debounced);
  const typedLinkId = isLink ? parseTopicLink(debounced) : null;

  const openTopic = (topicId: number) => {
    setQuery('');
    router.push(`/app/${topicId}`);
  };

  // A pasted topic link skips search and opens the topic as a preview. Only a change that turns
  // non-link text into a whole topic link counts as a paste: a link typed by hand (keyboards may
  // commit it in chunks) is already link-like at `https://`, before the id, so it can't open
  // `showtopic=1`, `=11`, … on the way. It waits for Open topic or the search key.
  const onChangeText = (text: string) => {
    const pasted = !looksLikeLink(query) && looksLikeLink(text);
    const linkId = pasted && looksLikeLink(text) ? parseTopicLink(text) : null;
    if (linkId) openTopic(linkId);
    else setQuery(text);
  };

  const onSubmit = () => {
    const linkId = looksLikeLink(query) ? parseTopicLink(query) : null;
    if (linkId) openTopic(linkId);
  };

  const search = useQuery({
    queryKey: ['search', debounced],
    queryFn: ({ signal }) => searchTopics(debounced, signal),
    enabled: debounced.length >= 2 && !isLink,
    placeholderData: keepPreviousData,
    retry: false,
  });

  const pasteLink = async () => {
    const text = await Clipboard.getStringAsync();
    const id = parseTopicLink(text);
    if (id) router.push(`/app/${id}`);
    else snackbar({ message: 'No 4PDA topic link on the clipboard' });
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

  const signInNeeded = search.error instanceof FourPdaError && search.error.code === 'sign-in';
  const searchFailed = search.isError && !signInNeeded;
  const hits = search.data ?? [];
  const showResults = debounced.length >= 2 && !isLink;

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
      >
        Track
      </Button>
    );

  return (
    <Screen testID="add-app">
      <TopBar back title="Add app" />
      <SearchField
        value={query}
        onChangeText={onChangeText}
        onPasteLink={() => void pasteLink()}
        onSubmitEditing={onSubmit}
        autoFocus
      />
      <Gap />

      {typedLinkId ? (
        <Banner
          tone="info"
          icon="link"
          title="That’s a 4PDA topic link"
          action="Open topic"
          onAction={() => openTopic(typedLinkId)}
        >
          Open it to see the files and start tracking.
        </Banner>
      ) : isLink ? (
        <Banner tone="danger" icon="link" title="That link isn’t a 4PDA topic">
          Topic links look like 4pda.to/forum/index.php?showtopic=…
        </Banner>
      ) : null}

      {!showResults && !isLink ? (
        <Banner
          tone="info"
          icon="link"
          title="Have a topic link?"
          action="Paste from clipboard"
          onAction={() => void pasteLink()}
        >
          Grabby reads the first post of the topic for files.
        </Banner>
      ) : null}

      {showResults && signInNeeded ? (
        <Banner
          tone="warn"
          icon="user"
          title="Sign in to search 4PDA"
          action="Sign in"
          onAction={() => router.push('/sign-in')}
        >
          4PDA only lets members search. You can still paste a topic link.
        </Banner>
      ) : null}
      {showResults && searchFailed ? (
        <Banner
          tone="danger"
          icon="offline"
          title="Couldn’t reach 4PDA"
          action="Retry"
          onAction={() => void search.refetch()}
        >
          Check the connection, or paste a topic link instead.
        </Banner>
      ) : null}

      {showResults && !search.isError ? (
        search.isPending ? (
          <>
            <SectionHeader title="Topics on 4PDA" />
            <SkeletonGroup>
              <List>
                {[62, 48, 70].map((w) => (
                  <Skeleton key={w} row width={w} action />
                ))}
              </List>
            </SkeletonGroup>
          </>
        ) : hits.length ? (
          <>
            <SectionHeader title="Topics on 4PDA" />
            <List>
              {hits.slice(0, 30).map((h) => (
                <AppRow
                  key={h.topicId}
                  name={h.title}
                  status={trackedIds.has(h.topicId) ? 'tracked' : 'track'}
                  note={h.description}
                  trailing={trailing(h.topicId)}
                  onPress={() => router.push(`/app/${h.topicId}`)}
                />
              ))}
            </List>
          </>
        ) : (
          <EmptyState icon="search" title={`Nothing on 4PDA for “${debounced}”`}>
            Check the spelling or try the app’s English name. Or paste a topic link.
          </EmptyState>
        )
      ) : null}
    </Screen>
  );
}
