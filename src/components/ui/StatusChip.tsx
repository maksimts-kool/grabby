import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { ColorToken } from '@/theme/unistyles';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ChipTone =
  'update' | 'downloading' | 'queued' | 'ready' | 'failed' | 'latest' | 'tracking' | 'beta' | 'fit';

const ICON: Record<ChipTone, IconName> = {
  update: 'update',
  latest: 'check',
  downloading: 'download',
  ready: 'box',
  failed: 'alert',
  queued: 'clock',
  tracking: 'bell',
  beta: 'beta',
  fit: 'chip',
};

const WORD: Record<ChipTone, string> = {
  update: 'Update',
  latest: 'Latest',
  downloading: 'Downloading',
  ready: 'Ready to install',
  failed: 'Failed',
  queued: 'Queued',
  tracking: 'Tracking',
  beta: 'Beta',
  fit: 'Fits this phone',
};

type Ground = 'amber' | 'lime' | 'danger' | 'neutral';
const GROUND: Record<ChipTone, Ground> = {
  update: 'amber',
  downloading: 'lime',
  ready: 'lime',
  fit: 'lime',
  tracking: 'lime',
  failed: 'danger',
  latest: 'neutral',
  queued: 'neutral',
  beta: 'neutral',
};
const INK: Record<Ground, ColorToken> = {
  amber: 'amberInk',
  lime: 'limeInk',
  danger: 'danger',
  neutral: 'inkMuted',
};

/** A small pill naming a state — always icon + word, never colour alone. */
export function StatusChip({
  tone = 'latest',
  icon,
  children,
}: {
  tone?: ChipTone;
  icon?: IconName;
  children?: string;
}) {
  const ground = GROUND[tone];
  styles.useVariants({ ground });
  return (
    <View style={styles.chip}>
      <Icon name={icon ?? ICON[tone]} size={14} color={INK[ground]} />
      <Text variant="caption" color={INK[ground]} style={styles.text} numberOfLines={1}>
        {children ?? WORD[tone]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[1],
    height: 24,
    paddingLeft: theme.space[2],
    paddingRight: 10,
    borderRadius: theme.radius.pill,
    flexShrink: 0,
    variants: {
      ground: {
        amber: { backgroundColor: theme.colors.amberSoft },
        lime: { backgroundColor: theme.colors.limeSoft },
        danger: { backgroundColor: theme.colors.dangerSoft },
        neutral: { backgroundColor: theme.colors.surfaceRaised },
      },
    },
  },
  text: { fontFamily: theme.type.label.fontFamily },
}));
