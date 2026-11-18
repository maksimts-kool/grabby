import { Pressable, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { meta } from '@/lib/format';
import { StatusChip } from './StatusChip';
import { Text } from './Text';

export interface FileOptionProps {
  /** File name exactly as posted. */
  name: string;
  abi?: string | null;
  size?: string;
  /** "Mod", "Lite" */
  note?: string | null;
  selected?: boolean;
  /** Shows "Fits this phone". */
  recommended?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

/** One APK attached to the topic's post, as a radio choice. */
export function FileOption({
  name,
  abi,
  size,
  note,
  selected,
  recommended,
  disabled,
  onPress,
}: FileOptionProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: !!selected, disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled || !onPress}
      style={[styles.option, selected && styles.selected]}
    >
      <View style={[styles.radio, selected && styles.radioOn]} />
      <View style={styles.text}>
        <Text variant="version" numberOfLines={1} ellipsizeMode="middle">
          {name}
        </Text>
        <Text variant="caption" color="inkMuted" style={styles.meta} numberOfLines={1}>
          {meta(abi, size, note)}
        </Text>
      </View>
      {recommended ? <StatusChip tone="fit" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[4],
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.line,
  },
  selected: {
    borderWidth: 2,
    borderColor: theme.colors.limeInk,
    padding: theme.space[3] - 1,
    paddingHorizontal: theme.space[4] - 1,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.lineStrong,
  },
  radioOn: { borderWidth: 6, borderColor: theme.colors.limeInk },
  text: { flex: 1, minWidth: 0 },
  meta: { marginTop: 2 },
}));
