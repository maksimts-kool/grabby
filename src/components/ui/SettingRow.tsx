import { Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon, type IconName } from './Icon';
import { Switch } from './Switch';
import { Text } from './Text';

export interface SettingRowProps {
  icon?: IconName;
  title: string;
  /** Explains a consequence, not the title again. */
  detail?: string;
  value?: string;
  /** Presence makes it a switch row; the whole row toggles. */
  on?: boolean;
  onToggle?: (next: boolean) => void;
  control?: 'switch' | 'chevron' | 'none';
  tone?: 'danger';
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}

export function SettingRow({
  icon,
  title,
  detail,
  value,
  on,
  onToggle,
  control,
  tone,
  onPress,
  disabled,
  testID,
}: SettingRowProps) {
  const { theme } = useUnistyles();
  const kind = control ?? (on !== undefined ? 'switch' : 'chevron');
  const danger = tone === 'danger';
  const press = kind === 'switch' ? () => onToggle?.(!on) : onPress;
  return (
    <Pressable
      testID={testID}
      accessibilityRole={kind === 'switch' ? 'switch' : 'button'}
      accessibilityState={
        kind === 'switch' ? { checked: !!on, disabled: !!disabled } : { disabled: !!disabled }
      }
      accessibilityHint={detail}
      onPress={press}
      disabled={disabled || !press}
      android_ripple={{ color: theme.ripple.neutral }}
      style={[styles.row, disabled && styles.disabled]}
    >
      {icon ? <Icon name={icon} size={22} color={danger ? 'danger' : 'inkMuted'} /> : null}
      <View style={styles.text}>
        <Text variant="body" color={danger ? 'danger' : 'ink'}>
          {title}
        </Text>
        {detail ? (
          <Text variant="label" color="inkMuted" style={styles.detail}>
            {detail}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="body" color="inkMuted" style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {kind === 'switch' ? <Switch value={!!on} decorative label={title} /> : null}
      {kind === 'chevron' ? <Icon name="chevron" size={18} color="inkMuted" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[4],
    minHeight: 64,
    paddingVertical: theme.space[3],
    paddingHorizontal: theme.space[4],
  },
  disabled: { opacity: theme.disabledOpacity },
  text: { flex: 1, minWidth: 0 },
  detail: { marginTop: 1, fontFamily: theme.type.body.fontFamily },
  value: { fontFamily: theme.type.caption.fontFamily, fontSize: 14, lineHeight: 20, flexShrink: 0 },
}));
