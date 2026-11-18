import { router } from 'expo-router';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { IconName } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface TopBarAction {
  icon: IconName;
  label: string;
  badge?: boolean;
  /** The icon turns while its job runs (Check for updates). */
  spinning?: boolean;
  onPress?: () => void;
  testID?: string;
}

export interface TopBarProps {
  title?: string;
  /** Large bars only. */
  subtitle?: string;
  /** Large title on the four tab roots; small bar with a back arrow on pushed screens. */
  large?: boolean;
  back?: boolean;
  /** At most three, plain. */
  actions?: TopBarAction[];
}

export function TopBar({ title, subtitle, large, back, actions = [] }: TopBarProps) {
  const row = (
    <View style={[styles.row, large && styles.rowLarge, back && styles.rowBack]}>
      {back ? (
        <IconButton icon="back" label="Back" onPress={() => router.back()} testID="back" />
      ) : null}
      <Text variant="headline" numberOfLines={1} style={[styles.title, back && styles.titleBack]}>
        {large ? '' : title}
      </Text>
      {actions.slice(0, 3).map((a) => (
        <IconButton
          key={a.label}
          icon={a.icon}
          label={a.label}
          badge={a.badge}
          spinning={a.spinning}
          disabled={a.spinning}
          onPress={a.onPress}
          testID={a.testID}
        />
      ))}
    </View>
  );
  if (!large) return row;
  return (
    <View>
      {row}
      <View style={styles.large}>
        <Text variant="display" accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="label" color="inkMuted" style={styles.subtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: theme.size.topbarH,
    paddingLeft: theme.space[4],
    paddingRight: theme.space[1],
  },
  rowLarge: { height: 52 },
  rowBack: { paddingLeft: theme.space[1] },
  title: { flex: 1, minWidth: 0 },
  titleBack: { paddingLeft: theme.space[1] },
  large: {
    paddingLeft: theme.space[5],
    paddingRight: theme.space[4],
    paddingBottom: theme.space[4],
  },
  subtitle: { marginTop: 2, fontFamily: theme.type.caption.fontFamily },
}));
