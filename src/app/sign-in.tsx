import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { WebView } from 'react-native-webview';

import { Banner, Screen, Text, TopBar, useSnackbar } from '@/components/ui';
import { LOGIN_URL } from '@/fourpda/urls';
import { isSignedIn } from '@/services/session';

/**
 * 4PDA's own login page in a browser view. Grabby keeps only the session cookie (shared with
 * fetch and the download worker through Android's cookie jar) — never the password.
 */
export default function SignInScreen() {
  const { theme } = useUnistyles();
  const snackbar = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [done, setDone] = useState(false);

  const checkSession = async (): Promise<void> => {
    if (done) return;
    if (await isSignedIn()) {
      setDone(true);
      snackbar({ message: 'Signed in to 4PDA' });
      if (router.canGoBack()) router.back();
    }
  };

  return (
    <Screen scroll={false} testID="sign-in">
      <TopBar back title="Sign in to 4PDA" />
      <Text variant="caption" color="inkMuted" style={styles.note}>
        This is 4PDA’s own page. Grabby keeps the session, never your password.
      </Text>
      {failed ? (
        <Banner
          tone="danger"
          icon="offline"
          title="Couldn’t reach 4PDA"
          action="Retry"
          onAction={() => setFailed(false)}
        >
          Check the connection and try again.
        </Banner>
      ) : (
        <View style={styles.web}>
          <WebView
            source={{ uri: LOGIN_URL }}
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => {
              setLoading(false);
              void checkSession();
            }}
            onNavigationStateChange={(): void => {
              void checkSession();
            }}
            onError={() => setFailed(true)}
            style={styles.webview}
          />
          {loading ? (
            <View style={styles.loading} pointerEvents="none">
              <ActivityIndicator color={theme.colors.limeInk} />
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  note: { paddingHorizontal: theme.space[5], paddingBottom: theme.space[3] },
  web: { flex: 1, backgroundColor: theme.colors.surface },
  webview: { flex: 1, backgroundColor: 'transparent' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
}));
