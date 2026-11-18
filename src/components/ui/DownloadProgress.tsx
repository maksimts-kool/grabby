import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { meta } from '@/lib/format';
import { IconButton } from './IconButton';
import { ProgressBar } from './ProgressBar';
import { Text } from './Text';

export interface DownloadProgressProps {
  /** 0–100 */
  progress: number;
  transferred?: string;
  speed?: string;
  eta?: string;
  paused?: boolean;
  /** Shown instead of speed when paused: "Waiting for Wi‑Fi", "Paused". */
  reason?: string;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
}

/** The detail screen's primary button while its file downloads, in the same place. */
export function DownloadProgress(p: DownloadProgressProps) {
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.text}>
          <Text variant="title" style={styles.pct}>
            {p.paused ? 'Paused' : `${Math.round(p.progress)}%`}
          </Text>
          <Text variant="label" color="inkMuted" style={styles.meta} numberOfLines={1}>
            {meta(p.transferred, p.paused ? p.reason : p.speed, p.paused ? null : p.eta)}
          </Text>
        </View>
        <IconButton
          icon={p.paused ? 'play' : 'pause'}
          label={p.paused ? 'Resume' : 'Pause'}
          variant="tonal"
          onPress={p.paused ? p.onResume : p.onPause}
        />
        <IconButton icon="close" label="Cancel download" variant="tonal" onPress={p.onCancel} />
      </View>
      <ProgressBar value={p.progress} label="Download progress" />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    gap: theme.space[3],
    padding: theme.space[4],
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: theme.space[2] },
  text: { flex: 1, minWidth: 0 },
  pct: { fontFamily: theme.type.display.fontFamily },
  meta: { fontFamily: theme.type.caption.fontFamily },
}));
