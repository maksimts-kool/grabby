import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from './Text';

export interface SectionHeaderProps {
  /** Sentence case, no colon. */
  title: string;
  count?: number;
  /** A verb: "Pause all", "Clear". */
  action?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, count, action, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text variant="label" color="inkMuted" style={styles.title} accessibilityRole="header">
        {title}
        {count !== undefined ? <Text variant="label">{`  ${count}`}</Text> : null}
      </Text>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={6} style={styles.action}>
          <Text variant="label" color="limeInk">
            {action}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingTop: theme.space[4],
    paddingBottom: theme.space[1],
    paddingLeft: theme.space[5],
    paddingRight: theme.space[2],
  },
  title: { letterSpacing: 0.13 },
  action: {
    height: 36,
    paddingHorizontal: theme.space[3],
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
  },
}));
