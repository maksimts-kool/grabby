import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { View, type DimensionValue } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

const Pulse = createContext<SharedValue<number> | null>(null);

/** One shared loop drives every placeholder below it; still with Reduce motion on. */
export function SkeletonGroup({ children }: { children: ReactNode }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.45, {
        duration: 700,
        easing: Easing.inOut(Easing.ease),
        reduceMotion: ReduceMotion.System,
      }),
      -1,
      true,
    );
    // An endless loop outlives its screen unless it's stopped.
    return () => cancelAnimation(opacity);
  }, [opacity]);
  return <Pulse.Provider value={opacity}>{children}</Pulse.Provider>;
}

function usePulse() {
  const shared = useContext(Pulse);
  return useAnimatedStyle(() => ({ opacity: shared ? shared.value : 1 }));
}

export interface SkeletonProps {
  /** An AppRow-shaped placeholder. */
  row?: boolean;
  /** Row: % of the name bar. Bar: any width. */
  width?: number | DimensionValue;
  height?: number;
  radius?: number;
  /** Row: include the trailing button. */
  action?: boolean;
}

/** A grey placeholder in the exact shape of the content that's loading. */
export function Skeleton({ row, width, height = 12, radius, action }: SkeletonProps) {
  const pulse = usePulse();
  if (row) {
    const w = typeof width === 'number' ? width : 55;
    return (
      <View style={styles.row} importantForAccessibility="no-hide-descendants">
        <Animated.View style={[styles.bar, styles.icon, pulse]} />
        <View style={styles.main}>
          <Animated.View style={[styles.bar, { width: `${w}%`, height: 14 }, pulse]} />
          <Animated.View
            style={[
              styles.bar,
              { width: `${Math.max(w - 20, 20)}%`, height: 10, marginTop: 6 },
              pulse,
            ]}
          />
        </View>
        {action ? <Animated.View style={[styles.bar, styles.button, pulse]} /> : null}
      </View>
    );
  }
  return (
    <Animated.View
      importantForAccessibility="no"
      style={[
        styles.bar,
        { width: width ?? '100%', height },
        radius !== undefined && { borderRadius: radius },
        pulse,
      ]}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  bar: { backgroundColor: theme.colors.surfaceRaised, borderRadius: theme.radius.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
    minHeight: theme.size.rowMin,
    paddingVertical: theme.space[3],
    paddingLeft: theme.space[4],
    paddingRight: theme.space[3],
  },
  icon: { width: 48, height: 48, borderRadius: theme.radius.md },
  main: { flex: 1 },
  button: { width: 76, height: 36, borderRadius: theme.radius.pill },
}));
