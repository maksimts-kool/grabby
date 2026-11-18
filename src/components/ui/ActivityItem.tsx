import { Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { ColorToken } from '@/theme/unistyles';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type Tone = 'update' | 'success' | 'danger' | 'neutral';

export const TONE_INK: Record<Tone, ColorToken> = {
  update: 'amberInk',
  success: 'limeInk',
  danger: 'danger',
  neutral: 'inkMuted',
};

export interface ActivityItemProps {
  tone?: Tone;
  icon?: IconName;
  title: string;
  text?: string | null;
  time?: string;
  onPress?: () => void;
}

/** One entry in Activity: everything Grabby sent, or would have sent, as a notification. */
export function ActivityItem({
  tone = 'neutral',
  icon = 'bell',
  title,
  text,
  time,
  onPress,
}: ActivityItemProps) {
  const { theme } = useUnistyles();
  styles.useVariants({ tone });
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={onPress}
      disabled={!onPress}
      android_ripple={{ color: theme.ripple.neutral }}
      style={styles.row}
    >
      <View style={styles.icon}>
        <Icon name={icon} size={20} color={TONE_INK[tone]} />
      </View>
      <View style={styles.text}>
        <Text variant="bodyStrong" style={styles.title}>
          {title}
        </Text>
        {text ? (
          <Text variant="label" color="inkMuted" style={styles.body}>
            {text}
          </Text>
        ) : null}
      </View>
      {time ? (
        <Text variant="caption" color="inkMuted" style={styles.time}>
          {time}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.space[3],
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[4],
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  text: { flex: 1, minWidth: 0, paddingTop: 1 },
  title: { fontSize: 14, lineHeight: 20 },
  body: { fontFamily: theme.type.body.fontFamily },
  time: { paddingTop: 2 },
}));
