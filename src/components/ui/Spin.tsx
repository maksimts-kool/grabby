import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** One turn every 900 ms while active; eases back to rest when it stops. */
export function Spin({ active, children }: { active: boolean; children: React.ReactNode }) {
  const turn = useSharedValue(0);
  useEffect(() => {
    if (active) {
      turn.value = 0;
      turn.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1);
    } else {
      cancelAnimation(turn);
      turn.value = withTiming(Math.ceil(turn.value), {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [active, turn]);
  useEffect(() => () => cancelAnimation(turn), [turn]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
