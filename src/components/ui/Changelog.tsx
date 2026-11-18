import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { StatusChip } from './StatusChip';
import { Text } from './Text';

export interface ChangelogProps {
  version: string;
  date?: string;
  beta?: boolean;
  /** One entry per line, as posted (often Russian). */
  items: string[];
}

/** "What's new" for one version, from the topic post. */
export function Changelog({ version, date, beta, items }: ChangelogProps) {
  return (
    <View>
      <View style={styles.head}>
        <Text variant="versionLg">{version}</Text>
        {beta ? <StatusChip tone="beta" /> : null}
        {date ? (
          <Text variant="caption" color="inkMuted" style={styles.date}>
            {date}
          </Text>
        ) : null}
      </View>
      <View style={styles.list}>
        {items.map((item, i) => (
          <View key={i} style={styles.item}>
            <Text variant="body" color="inkMuted" style={styles.bullet}>
              •
            </Text>
            <Text variant="body" style={styles.itemText} selectable>
              {item}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.space[2] },
  date: { marginLeft: 'auto' },
  list: { marginTop: theme.space[2], gap: theme.space[1] },
  item: { flexDirection: 'row', gap: theme.space[2] },
  bullet: { fontSize: 14, lineHeight: 20 },
  itemText: { flex: 1, fontSize: 14, lineHeight: 20 },
}));
