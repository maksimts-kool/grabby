import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { meta } from '@/lib/format';
import { Button } from './Button';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface UpdateSummaryProps {
  count: number;
  /** Total, already formatted ("68 MB"). */
  size?: string;
  /** "checked 12 min ago" */
  checked?: string;
  /** Shown when count is 0. */
  tracked?: number;
  /** Spinner on the refresh button. */
  checking?: boolean;
  /** Update all in progress. */
  busy?: boolean;
  onUpdateAll?: () => void;
  onCheck?: () => void;
}

/** The card at the top of My apps: how many updates wait, how big, and the one button. */
export function UpdateSummary({
  count,
  size,
  checked,
  tracked,
  checking,
  busy,
  onUpdateAll,
  onCheck,
}: UpdateSummaryProps) {
  const check = (
    <IconButton
      icon="update"
      label="Check now"
      variant="tonal"
      loading={checking}
      disabled={checking}
      onPress={onCheck}
      testID="check-now"
    />
  );
  if (!count) {
    return (
      <View style={styles.card}>
        <View style={styles.head}>
          <View style={styles.text}>
            <View style={styles.clear}>
              <Icon name="check" size={28} color="limeInk" />
              <Text variant="title">All up to date</Text>
            </View>
            <Text variant="label" color="inkMuted" style={styles.sub}>
              {meta(
                tracked ? `${tracked} ${tracked === 1 ? 'app' : 'apps'} tracked` : null,
                checked,
              )}
            </Text>
          </View>
          {check}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.text}>
          <Text variant="display" accessibilityRole="header">
            <Text variant="display" color="amberInk">
              {count}
            </Text>
            {count === 1 ? ' update' : ' updates'}
          </Text>
          <Text variant="label" color="inkMuted" style={styles.sub}>
            {meta(size, checked)}
          </Text>
        </View>
        {check}
      </View>
      <Button icon="download" block loading={busy} onPress={onUpdateAll} testID="update-all">
        Update all
      </Button>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    marginHorizontal: theme.gutter,
    padding: theme.space[5],
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    gap: theme.space[4],
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.space[3],
  },
  text: { flex: 1, minWidth: 0 },
  clear: { flexDirection: 'row', alignItems: 'center', gap: theme.space[2] },
  sub: { marginTop: 2, fontFamily: theme.type.caption.fontFamily },
}));
