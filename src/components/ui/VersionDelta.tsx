import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from './Text';

export interface VersionDeltaProps {
  /** Installed version. */
  from?: string | null;
  /** Latest version. */
  to?: string | null;
  size?: 'sm' | 'md' | 'lg';
  /** Show a single version in lime-ink. */
  highlight?: boolean;
}

/** Installed → new version, in mono, exactly as the topic posts them. */
export function VersionDelta({ from, to, size = 'md', highlight }: VersionDeltaProps) {
  const variant = size === 'lg' ? 'versionLg' : 'version';
  const small = size === 'sm' ? styles.small : undefined;
  if (from && to && from !== to) {
    return (
      <View style={styles.row} accessibilityLabel={`${from} to ${to}`}>
        <Text variant={variant} color="inkMuted" style={small} numberOfLines={1}>
          {from}
        </Text>
        <Text variant="caption" color="inkMuted">
          →
        </Text>
        <Text variant={variant} color="limeInk" style={small} numberOfLines={1}>
          {to}
        </Text>
      </View>
    );
  }
  return (
    <Text
      variant={variant}
      color={highlight ? 'limeInk' : 'inkMuted'}
      style={small}
      numberOfLines={1}
    >
      {to ?? from ?? ''}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  small: { fontSize: 12 },
});
