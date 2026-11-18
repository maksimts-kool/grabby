import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { ColorToken } from '@/theme/unistyles';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type BannerTone = 'info' | 'warn' | 'danger' | 'success';

const ICON: Record<BannerTone, IconName> = {
  info: 'link',
  warn: 'alert',
  danger: 'alert',
  success: 'check',
};
const INK: Record<BannerTone, ColorToken> = {
  info: 'inkMuted',
  warn: 'amberInk',
  danger: 'danger',
  success: 'limeInk',
};

export interface BannerProps {
  /** danger = something failed; warn = a setting or permission is in the way; info = working as configured. */
  tone?: BannerTone;
  icon?: IconName;
  /** What's wrong. */
  title?: string;
  /** Why — one sentence. */
  children?: string;
  /** The fix. */
  action?: string;
  onAction?: () => void;
  testID?: string;
}

/** An inline message about something the user can fix, at the top of what it affects. */
export function Banner({
  tone = 'info',
  icon,
  title,
  children,
  action,
  onAction,
  testID,
}: BannerProps) {
  styles.useVariants({ tone });
  return (
    <View
      testID={testID}
      style={styles.banner}
      accessibilityRole={tone === 'danger' ? 'alert' : 'summary'}
      accessibilityLiveRegion={tone === 'danger' ? 'assertive' : 'polite'}
    >
      <View style={styles.icon}>
        <Icon name={icon ?? ICON[tone]} size={22} color={INK[tone]} />
      </View>
      <View style={styles.body}>
        {title ? <Text variant="bodyStrong">{title}</Text> : null}
        {children ? (
          <Text variant="label" color="inkMuted" style={styles.text}>
            {children}
          </Text>
        ) : null}
        {action ? (
          <Pressable
            accessibilityRole="button"
            onPress={onAction}
            hitSlop={6}
            style={styles.action}
          >
            <Text variant="label" color="limeInk" style={styles.actionText}>
              {action}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  banner: {
    flexDirection: 'row',
    gap: theme.space[3],
    marginHorizontal: theme.gutter,
    padding: theme.space[4],
    borderRadius: theme.radius.md,
    variants: {
      tone: {
        info: { backgroundColor: theme.colors.surfaceRaised },
        warn: { backgroundColor: theme.colors.amberSoft },
        danger: { backgroundColor: theme.colors.dangerSoft },
        success: { backgroundColor: theme.colors.limeSoft },
      },
    },
  },
  icon: { marginTop: 1 },
  body: { flex: 1, minWidth: 0 },
  text: { fontFamily: theme.type.body.fontFamily },
  action: {
    alignSelf: 'flex-start',
    height: 36,
    justifyContent: 'center',
    marginTop: theme.space[2],
    marginLeft: -theme.space[3],
    paddingHorizontal: theme.space[3],
    borderRadius: theme.radius.pill,
  },
  actionText: { fontSize: 14 },
}));
