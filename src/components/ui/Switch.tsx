import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export interface SwitchProps {
  value: boolean;
  onValueChange?: (next: boolean) => void;
  label?: string;
  disabled?: boolean;
  /** When the whole row toggles, the switch itself is decorative. */
  decorative?: boolean;
}

/**
 * Off: surface-raised track, line-strong outline, small knob. On: lime track, on-lime knob.
 * 150 ms ease-out; the stock Switch can't match the shape.
 */
export function Switch({ value, onValueChange, label, disabled, decorative }: SwitchProps) {
  const { theme } = useUnistyles();
  const t = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    t.value = withTiming(value ? 1 : 0, { duration: 150, easing: Easing.out(Easing.ease) });
  }, [value, t]);

  const off = theme.colors.surfaceRaised;
  const on = theme.colors.lime;
  const knobOff = theme.colors.lineStrong;
  const knobOn = theme.colors.onLime;
  const outline = theme.colors.lineStrong;

  const track = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(t.value, [0, 1], [off, on]),
    borderColor: interpolateColor(t.value, [0, 1], [outline, on]),
  }));
  const knob = useAnimatedStyle(() => {
    const size = 16 + 8 * t.value;
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      transform: [{ translateX: 6 + 16 * t.value }],
      backgroundColor: interpolateColor(t.value, [0, 1], [knobOff, knobOn]),
    };
  });

  return (
    <Pressable
      accessible={!decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'auto'}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled || decorative}
      onPress={() => onValueChange?.(!value)}
      hitSlop={8}
      style={disabled && styles.disabled}
    >
      <Animated.View style={[styles.track, track]}>
        <Animated.View style={knob} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  track: {
    width: 52,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    justifyContent: 'center',
  },
  disabled: { opacity: theme.disabledOpacity },
}));
