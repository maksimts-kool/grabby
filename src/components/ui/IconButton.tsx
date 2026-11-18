import { ActivityIndicator, Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { ColorToken } from '@/theme/unistyles';
import { Icon, type IconName } from './Icon';
import { Spin } from './Spin';

export interface IconButtonProps {
  icon: IconName;
  /** Required: the accessibility label ("Pause", "Open topic on 4PDA"). */
  label: string;
  /** tonal (surface-raised ground) only for "Check now" and the download controls. */
  variant?: 'plain' | 'tonal';
  /** md 48 · sm 40 */
  size?: 'sm' | 'md';
  /** Amber dot. */
  badge?: boolean;
  loading?: boolean;
  /** Turns the icon itself (Check now's arrows) instead of swapping in a spinner. */
  spinning?: boolean;
  color?: ColorToken;
  disabled?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function IconButton({
  icon,
  label,
  variant = 'plain',
  size = 'md',
  badge,
  loading,
  spinning,
  color = 'ink',
  disabled,
  onPress,
  testID,
}: IconButtonProps) {
  const { theme } = useUnistyles();
  styles.useVariants({ variant, size });
  return (
    <View style={[styles.clip, disabled && !spinning && styles.disabled]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: !!disabled, busy: !!loading || !!spinning }}
        disabled={disabled}
        onPress={onPress}
        android_ripple={{ color: theme.ripple.neutral, borderless: variant === 'plain' }}
        hitSlop={size === 'sm' ? 4 : undefined}
        style={styles.button}
      >
        {loading ? (
          <ActivityIndicator size={size === 'sm' ? 16 : 20} color={theme.colors[color]} />
        ) : (
          <Spin active={!!spinning}>
            <Icon name={icon} size={size === 'sm' ? 20 : 24} color={color} />
          </Spin>
        )}
      </Pressable>
      {badge ? <View style={styles.badge} pointerEvents="none" /> : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  clip: { borderRadius: theme.radius.pill },
  disabled: { opacity: theme.disabledOpacity },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
    variants: {
      size: {
        md: { width: 48, height: 48 },
        sm: { width: 40, height: 40 },
      },
      variant: {
        plain: {},
        tonal: { backgroundColor: theme.colors.surfaceRaised },
      },
    },
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.amber,
    borderWidth: 2,
    borderColor: theme.colors.bg,
  },
}));
