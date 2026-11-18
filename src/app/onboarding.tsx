import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import {
  Banner,
  Button,
  Gap,
  Icon,
  type IconName,
  Logo,
  Screen,
  StatusChip,
  Text,
} from '@/components/ui';
import { useSystemState } from '@/hooks/useSystemState';
import { settings, useSetting } from '@/lib/settings';
import { native } from '@/native';
import { requestNotifications } from '@/services/notifications';

function Step({
  icon,
  title,
  text,
  trail,
}: {
  icon: IconName;
  title: string;
  text: string;
  trail: ReactNode;
}) {
  return (
    <View style={styles.step}>
      <View style={styles.stepIcon}>
        <Icon name={icon} size={22} color="inkMuted" />
      </View>
      <View style={styles.stepText}>
        <Text variant="bodyStrong">{title}</Text>
        <Text variant="label" color="inkMuted" style={styles.stepSub}>
          {text}
        </Text>
      </View>
      {trail}
    </View>
  );
}

const allowed = (label = 'Allowed') => (
  <StatusChip tone="tracking" icon="check">
    {label}
  </StatusChip>
);

/**
 * First run, shown once: what Grabby does, then what it needs — notifications, the install
 * permission, and an optional 4PDA sign-in. Continue works with nothing granted; anything
 * missing comes back later as a banner at the moment it matters.
 */
export default function OnboardingScreen() {
  const system = useSystemState();
  const [signedIn] = useSetting('signedIn');
  const [refused, setRefused] = useState(false);

  const askNotifications = async () => {
    if (!system.notificationsCanAsk) return native.openNotificationSettings();
    const granted = await requestNotifications();
    setRefused(!granted);
  };

  const notificationsBlocked = !system.notifications && (refused || !system.notificationsCanAsk);

  const finish = () => {
    if (signedIn) {
      router.replace({ pathname: '/scan', params: { onboarding: '1' } });
    } else {
      settings.set('onboarded', true);
    }
  };

  return (
    <Screen testID="onboarding">
      <View style={styles.wrap}>
        <View style={styles.hero}>
          <Logo size={72} />
          <Text variant="display" style={styles.h1} accessibilityRole="header">
            {notificationsBlocked ? 'Almost there' : 'Your 4PDA apps, always on the latest build'}
          </Text>
          {notificationsBlocked ? null : (
            <Text variant="body" color="inkMuted">
              Pick apps from 4PDA topics. Grabby checks them in the background, tells you when a new
              APK is posted and installs it in two taps.
            </Text>
          )}
        </View>

        <View style={styles.steps}>
          <Step
            icon="bell"
            title="Notifications"
            text={
              notificationsBlocked
                ? 'Refused — you will only see updates inside the app'
                : 'To tell you about new versions'
            }
            trail={
              system.notifications ? (
                allowed()
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => void askNotifications()}
                  testID="allow-notifications"
                >
                  {notificationsBlocked ? 'Settings' : 'Allow'}
                </Button>
              )
            }
          />
          <View style={styles.divider} />
          <Step
            icon="shield"
            title="Install unknown apps"
            text="Android asks once for Grabby"
            trail={
              system.installAllowed ? (
                allowed()
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={native.openInstallPermissionSettings}
                  testID="allow-install"
                >
                  Allow
                </Button>
              )
            }
          />
          <View style={styles.divider} />
          <Step
            icon="user"
            title="4PDA account"
            text={signedIn ? 'Signed in' : 'Optional — some topics hide files from guests'}
            trail={
              signedIn ? (
                allowed('Done')
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  onPress={() => router.push('/sign-in')}
                  testID="sign-in"
                >
                  Sign in
                </Button>
              )
            }
          />
        </View>

        {notificationsBlocked ? (
          <>
            <Gap />
            <View style={styles.bannerWrap}>
              <Banner tone="warn" icon="bell" title="You can continue without notifications">
                Android won’t ask again, so turning them on later happens in system settings.
              </Banner>
            </View>
          </>
        ) : null}

        <View style={styles.foot}>
          <Button block size="lg" onPress={finish} testID="continue">
            Continue
          </Button>
          <Text variant="caption" color="inkMuted">
            Grabby is an independent app, not made by 4PDA.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { flexGrow: 1, paddingHorizontal: theme.gutter, paddingBottom: theme.space[3] },
  hero: {
    paddingTop: theme.space[8],
    paddingHorizontal: theme.space[1],
    paddingBottom: theme.space[6],
    gap: theme.space[2],
  },
  h1: { marginTop: theme.space[4] },
  steps: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
    paddingVertical: theme.space[3],
    paddingLeft: theme.space[4],
    paddingRight: theme.space[3],
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceRaised,
  },
  stepText: { flex: 1, minWidth: 0 },
  stepSub: { fontFamily: theme.type.body.fontFamily },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 68, backgroundColor: theme.colors.line },
  bannerWrap: { marginHorizontal: -theme.gutter },
  foot: {
    marginTop: 'auto',
    paddingTop: theme.space[6],
    alignItems: 'center',
    gap: theme.space[3],
  },
}));
