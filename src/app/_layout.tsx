import { Onest_400Regular } from '@expo-google-fonts/onest/400Regular';
import { Onest_500Medium } from '@expo-google-fonts/onest/500Medium';
import { Onest_600SemiBold } from '@expo-google-fonts/onest/600SemiBold';
import { Onest_700Bold } from '@expo-google-fonts/onest/700Bold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { JetBrainsMono_600SemiBold } from '@expo-google-fonts/jetbrains-mono/600SemiBold';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { AppState, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { SnackbarProvider, Text } from '@/components/ui';
import { db } from '@/db/client';
import { useSetting } from '@/lib/settings';
import { refreshInstalled } from '@/services/apps';
import { scheduleBackgroundCheck } from '@/services/background';
import { queueAllUpdates, startDownloadService } from '@/services/downloads';
import { handleNotificationResponses, setupNotifications } from '@/services/notifications';
import { isSignedIn } from '@/services/session';
import migrations from '../../drizzle/migrations';

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 60_000, refetchOnWindowFocus: false },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Onest_400Regular,
    Onest_500Medium,
    Onest_600SemiBold,
    Onest_700Bold,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
  });
  const migration = useMigrations(db, migrations);
  const ready = (fontsLoaded || !!fontError) && (migration.success || !!migration.error);

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;
  if (migration.error) return <StartupError message={migration.error.message} />;

  return (
    <GestureHandlerRootView style={styles.root}>
      <QueryClientProvider client={queryClient}>
        <BottomSheetModalProvider>
          <SnackbarProvider>
            <Startup />
            <Navigator />
          </SnackbarProvider>
        </BottomSheetModalProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function Navigator() {
  const [onboarded] = useSetting('onboarded');
  const { theme } = useUnistyles();
  return (
    <>
      <StatusBar style={theme.mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.bg } }}
      >
        {/* Explicit targets: the default fallback is the shortest unguarded route name. */}
        <Stack.Protected guard={!onboarded} redirectTo="/">
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={onboarded} redirectTo="/onboarding">
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add" />
          <Stack.Screen name="app/[topicId]" />
          <Stack.Screen
            name="install/[id]"
            options={{ presentation: 'transparentModal', animation: 'none' }}
          />
        </Stack.Protected>
        <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}

/** One-time wiring once the database is ready. */
function Startup() {
  useEffect(() => {
    setupNotifications().catch(() => {});
    startDownloadService().catch(() => {});
    scheduleBackgroundCheck().catch(() => {});
    isSignedIn().catch(() => {});
    refreshInstalled().catch(() => {});
    const stopResponses = handleNotificationResponses(() => void queueAllUpdates());
    // Installs and permission changes happen outside the app: re-read on return.
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      refreshInstalled().catch(() => {});
      isSignedIn().catch(() => {});
    });
    return () => {
      stopResponses();
      sub.remove();
    };
  }, []);
  return null;
}

function StartupError({ message }: { message: string }) {
  return (
    <View style={styles.error}>
      <Text variant="headline">Grabby couldn’t open its database</Text>
      <Text variant="body" color="inkMuted">
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  error: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.space[2],
    padding: theme.space[6],
    backgroundColor: theme.colors.bg,
  },
}));
