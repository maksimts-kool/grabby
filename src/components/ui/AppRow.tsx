import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { AppIcon, type Tile } from './AppIcon';
import { Button } from './Button';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { ProgressBar } from './ProgressBar';
import { StatusChip } from './StatusChip';
import { Text } from './Text';
import { VersionDelta } from './VersionDelta';

export type AppRowStatus =
  'update' | 'downloading' | 'queued' | 'ready' | 'failed' | 'latest' | 'track' | 'tracked';

export interface AppRowProps {
  name: string;
  tile?: Tile;
  iconSrc?: string | null;
  status?: AppRowStatus;
  installed?: string | null;
  latest?: string | null;
  /** Download size, already formatted ("18 MB"). */
  size?: string;
  /** 0–100 */
  progress?: number;
  transferred?: string;
  speed?: string;
  /** Category, "You have 0.27.2", or the failure sentence. */
  note?: string | null;
  /** Row body → app detail. */
  onPress?: () => void;
  /** Long-press → sheet with Open topic, Ignore this version, Stop tracking. */
  onLongPress?: () => void;
  /** The trailing button. Acts directly; never opens the detail screen. */
  onAction?: () => void;
  actionDisabled?: boolean;
  /** Replace the default trailing element. `null` removes it. */
  trailing?: ReactNode;
  testID?: string;
}

function Dot() {
  return (
    <Text variant="caption" color="inkMuted">
      ·
    </Text>
  );
}

/** One tracked (or findable) app: icon, name, a state-specific meta line, one trailing action. */
export function AppRow(props: AppRowProps) {
  const { theme } = useUnistyles();
  const { name, status = 'latest', installed, latest, size, note } = props;

  let line: ReactNode;
  let extra: ReactNode = null;
  let trail: ReactNode = null;
  const action = (label: string, variant: 'primary' | 'secondary', icon?: 'plus') => (
    <Button
      size="sm"
      variant={variant}
      icon={icon}
      onPress={props.onAction}
      disabled={props.actionDisabled}
    >
      {label}
    </Button>
  );
  const installedLine = installed ? (
    <Text variant="caption" color="inkMuted" numberOfLines={1}>
      Installed {installed}
    </Text>
  ) : null;

  switch (status) {
    case 'update':
      line = (
        <>
          <VersionDelta to={latest} highlight size="sm" />
          {size ? (
            <>
              <Dot />
              <Text variant="caption" color="inkMuted">
                {size}
              </Text>
            </>
          ) : null}
        </>
      );
      extra = installedLine;
      trail = action('Update', 'primary');
      break;
    case 'downloading':
      line = (
        <Text variant="caption" color="inkMuted" numberOfLines={1}>
          <Text variant="caption" style={styles.strong}>
            {Math.round(props.progress ?? 0)}%
          </Text>
          {props.transferred ? ` · ${props.transferred}` : ''}
          {props.speed ? ` · ${props.speed}` : ''}
        </Text>
      );
      extra = (
        <View style={styles.progress}>
          <ProgressBar value={props.progress} label={`Downloading ${name}`} />
        </View>
      );
      trail = <IconButton icon="pause" label="Pause" size="sm" onPress={props.onAction} />;
      break;
    case 'queued':
      line = (
        <>
          <VersionDelta to={latest} size="sm" />
          <Text variant="caption" color="inkMuted" numberOfLines={1}>
            {` · ${[size, 'Queued'].filter(Boolean).join(' · ')}`}
          </Text>
        </>
      );
      trail = <IconButton icon="close" label="Cancel" size="sm" onPress={props.onAction} />;
      break;
    case 'ready':
      line = (
        <>
          <VersionDelta to={latest} highlight size="sm" />
          <Dot />
          <Text variant="caption" color="inkMuted">
            Downloaded
          </Text>
        </>
      );
      extra = installedLine;
      trail = action('Install', 'primary');
      break;
    case 'failed':
      line = (
        <View style={styles.error}>
          <View style={styles.errorIcon}>
            <Icon name="alert" size={14} color="danger" />
          </View>
          <Text variant="caption" color="danger" style={styles.errorText}>
            {note || 'Download failed'}
          </Text>
        </View>
      );
      trail = action('Retry', 'secondary');
      break;
    case 'track':
    case 'tracked':
      line = (
        <>
          <VersionDelta to={latest} size="sm" />
          {note ? (
            <Text variant="caption" color="inkMuted" numberOfLines={1} style={styles.shrink}>
              {` · ${note}`}
            </Text>
          ) : null}
        </>
      );
      trail =
        status === 'track' ? action('Track', 'secondary', 'plus') : <StatusChip tone="tracking" />;
      break;
    default:
      line = (
        <>
          <VersionDelta to={installed ?? latest} size="sm" />
          <Text variant="caption" color="inkMuted" numberOfLines={1} style={styles.shrink}>
            {` · ${note || 'Up to date'}`}
          </Text>
        </>
      );
  }
  if (props.trailing !== undefined) trail = props.trailing;

  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      onPress={props.onPress}
      onLongPress={props.onLongPress}
      disabled={!props.onPress && !props.onLongPress}
      android_ripple={{ color: theme.ripple.neutral }}
      style={styles.row}
    >
      <AppIcon name={name} tile={props.tile} src={props.iconSrc} />
      <View style={styles.main}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.meta}>{line}</View>
        {extra}
      </View>
      {trail ? <View style={styles.trail}>{trail}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
    minHeight: theme.size.rowMin,
    paddingVertical: theme.space[3],
    paddingLeft: theme.space[4],
    paddingRight: theme.space[3],
  },
  main: { flex: 1, minWidth: 0, gap: 2 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' },
  strong: { color: theme.colors.ink, fontFamily: theme.type.label.fontFamily },
  shrink: { flexShrink: 1 },
  progress: { marginTop: 6 },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space[1], flexShrink: 1 },
  errorIcon: { marginTop: 1 },
  errorText: { flexShrink: 1 },
  trail: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: theme.space[1] },
}));
