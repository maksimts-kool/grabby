import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

export interface ProgressBarProps {
  /** 0–100 */
  value?: number;
  /** While resolving the link / waiting for the first bytes. */
  indeterminate?: boolean;
  /** Accessibility name. */
  label?: string;
}

/**
 * A 6 dp pill: lime-ink fill on a surface-raised track. Width animates linearly —
 * it should feel like bytes, not decoration. Always pair it with numbers.
 */
export function ProgressBar({ value = 0, indeterminate, label }: ProgressBarProps) {
  const v = Math.max(0, Math.min(100, value));
  const width = useSharedValue(v);
  const slide = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(v, { duration: 200, easing: Easing.linear });
  }, [v, width]);

  useEffect(() => {
    if (!indeterminate) return;
    slide.value = 0;
    slide.value = withRepeat(
      withTiming(1, {
        duration: 1300,
        easing: Easing.inOut(Easing.ease),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
    );
    return () => cancelAnimation(slide);
  }, [indeterminate, slide]);

  const fill = useAnimatedStyle(() =>
    indeterminate
      ? { width: '35%', left: `${-35 + slide.value * 135}%` }
      : { width: `${width.value}%`, left: 0 },
  );

  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={indeterminate ? undefined : { min: 0, max: 100, now: Math.round(v) }}
    >
      <Animated.View style={[styles.fill, fill]} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  track: {
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceRaised,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.limeInk,
  },
}));
