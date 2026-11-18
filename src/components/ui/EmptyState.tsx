import { ActivityIndicator, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { TONE_INK, type Tone } from './ActivityItem';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Logo } from './Logo';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';

export interface EmptyStateProps {
  /** What's missing: "No apps yet", "Nothing downloading". */
  title: string;
  /** One or two sentences: what fills it, or what to do. */
  children?: string;
  icon?: IconName;
  tone?: Tone;
  /** The mark instead of an icon — empty My apps only. */
  logo?: boolean;
  /** Spinner instead of the icon, for one long first-time job. */
  busy?: boolean;
  /** 0–100, or null for indeterminate. Omit for none. */
  progress?: number | null;
  action?: string;
  actionIcon?: IconName;
  onAction?: () => void;
  secondary?: string;
  onSecondary?: () => void;
}

/** Centred message for a whole screen or result area with nothing to show yet. */
export function EmptyState(props: EmptyStateProps) {
  const { theme } = useUnistyles();
  const tone = props.busy ? 'success' : (props.tone ?? 'neutral');
  styles.useVariants({ tone });
  return (
    <View style={styles.wrap}>
      {props.logo ? (
        <Logo size={64} />
      ) : (
        <View style={styles.icon}>
          {props.busy ? (
            <ActivityIndicator size={24} color={theme.colors.limeInk} />
          ) : (
            <Icon name={props.icon ?? 'box'} size={28} color={TONE_INK[tone]} />
          )}
        </View>
      )}
      <Text variant="headline" style={styles.title} accessibilityRole="header">
        {props.title}
      </Text>
      {props.children ? (
        <Text variant="body" color="inkMuted" style={styles.text}>
          {props.children}
        </Text>
      ) : null}
      {props.progress !== undefined ? (
        <View style={styles.progress}>
          <ProgressBar
            value={props.progress ?? 0}
            indeterminate={props.progress === null}
            label={props.title}
          />
        </View>
      ) : null}
      {props.action || props.secondary ? (
        <View style={styles.actions}>
          {props.action ? (
            <Button icon={props.actionIcon} onPress={props.onAction} testID="empty-action">
              {props.action}
            </Button>
          ) : null}
          {props.secondary ? (
            <Button variant="ghost" onPress={props.onSecondary} testID="empty-secondary">
              {props.secondary}
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: {
    alignItems: 'center',
    gap: theme.space[3],
    paddingVertical: theme.space[10],
    paddingHorizontal: theme.space[8],
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    variants: {
      tone: {
        neutral: { backgroundColor: theme.colors.surfaceRaised },
        update: { backgroundColor: theme.colors.amberSoft },
        success: { backgroundColor: theme.colors.limeSoft },
        danger: { backgroundColor: theme.colors.dangerSoft },
      },
    },
  },
  title: { marginTop: theme.space[2], textAlign: 'center' },
  text: { maxWidth: 280, textAlign: 'center', fontSize: 14, lineHeight: 20 },
  progress: { width: 200, marginTop: theme.space[1] },
  actions: { alignItems: 'center', gap: theme.space[1], marginTop: theme.space[3] },
}));
