import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Button, EmptyState, Screen, TopBar } from '@/components/ui';
import { FourPdaError } from '@/fourpda/client';
import { settings, useSetting } from '@/lib/settings';
import { scanPhone, type ScanProgress } from '@/services/scan';

/** "Looking for your apps on 4PDA": matches installed apps to topics, with real progress. */
export default function ScanScreen() {
  const { onboarding } = useLocalSearchParams<{ onboarding?: string }>();
  const [signedIn] = useSetting('signedIn');
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const abort = useRef<AbortController | null>(null);

  const leave = (to: '/add' | '/') => {
    abort.current?.abort();
    if (onboarding) {
      settings.set('onboarded', true);
      // The guard swaps the stack to the tabs; then open Add app with the matches.
      if (to === '/add') setTimeout(() => router.push('/add'), 0);
    } else if (to === '/add') {
      router.replace('/add');
    } else {
      router.back();
    }
  };

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    abort.current = controller;
    scanPhone(setProgress, controller.signal)
      .then(() => {
        if (!controller.signal.aborted) leave('/add');
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        const code = e instanceof FourPdaError ? e.code : 'unknown';
        setError(code);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn, attempt]);

  const pct = progress && progress.total ? (progress.done / progress.total) * 100 : null;

  let body;
  if (!signedIn) {
    body = (
      <EmptyState
        icon="user"
        tone="update"
        title="Sign in to match your apps"
        action="Sign in to 4PDA"
        onAction={() => router.push('/sign-in')}
        secondary="Skip — add apps myself"
        onSecondary={() => leave('/')}
      >
        4PDA only lets members search, and Grabby looks up each installed app by name.
      </EmptyState>
    );
  } else if (error) {
    body = (
      <EmptyState
        icon={error === 'network' ? 'offline' : 'alert'}
        tone="danger"
        title={
          error === 'network'
            ? 'Couldn’t reach 4PDA'
            : error === 'sign-in'
              ? 'Your 4PDA session expired'
              : 'The scan stopped'
        }
        action={error === 'sign-in' ? 'Sign in again' : 'Retry'}
        onAction={() => {
          if (error === 'sign-in') return router.push('/sign-in');
          setError(null);
          setAttempt((a) => a + 1);
        }}
        secondary="Skip — add apps myself"
        onSecondary={() => leave('/')}
      >
        {progress?.matches
          ? `${progress.matches} matches so far are kept.`
          : 'Nothing was matched yet.'}
      </EmptyState>
    );
  } else {
    body = (
      <EmptyState busy title="Looking for your apps on 4PDA" progress={pct}>
        {progress
          ? `Checked ${progress.done} of ${progress.total} installed apps. Matches appear on the next screen.`
          : 'Reading the apps on this phone…'}
      </EmptyState>
    );
  }

  return (
    <Screen centerContent testID="scan">
      {onboarding ? null : <TopBar back title="Scan this phone" />}
      <View style={styles.centre}>{body}</View>
      {signedIn && !error ? (
        <View style={styles.foot}>
          <Button
            variant="ghost"
            onPress={() => leave(progress?.matches ? '/add' : '/')}
            testID="skip-scan"
          >
            {progress?.matches
              ? `Stop — show ${progress.matches} matches`
              : 'Skip — add apps myself'}
          </Button>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  centre: { flex: 1, justifyContent: 'center' },
  foot: { alignItems: 'center', paddingBottom: theme.space[4] },
}));
