import { ActivityIndicator, Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { ColorToken } from '@/theme/unistyles';
import { Icon, type IconName } from './Icon';
import { Spin } from './Spin';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  /** primary (lime) is the one thing the screen region is for. */
  variant?: ButtonVariant;
  /** sm 36 · md 48 · lg 56. sm gets hitSlop so its target still reaches 48. */
  size?: ButtonSize;
  icon?: IconName;
  block?: boolean;
  /** A spinner replaces the icon; the label stays. */
  loading?: boolean;
  /** The icon itself turns (checking); the button stays pressable-looking but inert. */
  spinning?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  /** Verb first, sentence case, no full stop: "Update (18 MB)". */
  children: string;
  testID?: string;
}

const LABEL: Record<ButtonVariant, ColorToken> = {
  primary: 'onLime',
  secondary: 'ink',
  outline: 'ink',
  ghost: 'limeInk',
  danger: 'danger',
};

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  block,
  loading,
  spinning,
  disabled,
  onPress,
  children,
  testID,
}: ButtonProps) {
  const { theme } = useUnistyles();
  styles.useVariants({ variant, size });
  const label = LABEL[variant];
  const ripple = variant === 'primary' ? theme.ripple.onLime : theme.ripple.neutral;
  return (
    <View style={[styles.clip, block && styles.block, disabled && styles.disabled]}>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={children}
        accessibilityState={{ disabled: !!disabled, busy: !!loading || !!spinning }}
        disabled={disabled || loading || spinning}
        onPress={onPress}
        android_ripple={{ color: ripple }}
        hitSlop={size === 'sm' ? 6 : undefined}
        style={styles.button}
      >
        {loading ? (
          <ActivityIndicator size={size === 'sm' ? 14 : 18} color={theme.colors[label]} />
        ) : icon ? (
          <Spin active={!!spinning}>
            <Icon name={icon} size={size === 'sm' ? 16 : 20} color={label} />
          </Spin>
        ) : null}
        <Text variant="bodyStrong" color={label} style={styles.label} numberOfLines={1}>
          {children}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  clip: {
    borderRadius: theme.radius.pill,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  block: { alignSelf: 'stretch' },
  disabled: { opacity: theme.disabledOpacity },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space[2],
    variants: {
      size: {
        sm: { height: 36, paddingHorizontal: theme.space[4] },
        md: { height: 48, paddingHorizontal: theme.space[6] },
        lg: { height: 56, paddingHorizontal: theme.space[8] },
      },
      variant: {
        primary: { backgroundColor: theme.colors.lime },
        secondary: { backgroundColor: theme.colors.surfaceRaised },
        outline: { borderWidth: 1, borderColor: theme.colors.lineStrong },
        ghost: { paddingHorizontal: theme.space[3] },
        danger: { backgroundColor: theme.colors.dangerSoft },
      },
    },
  },
  label: {
    variants: {
      size: {
        sm: { fontSize: 14, lineHeight: 18 },
        md: { fontSize: 15, lineHeight: 20 },
        lg: { fontSize: 16, lineHeight: 20 },
      },
      variant: {},
    },
  },
}));
