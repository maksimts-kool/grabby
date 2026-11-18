import { useSegments } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Text } from './Text';

export interface SnackbarOptions {
  /** One line. Confirmations only — anything that needs fixing is a Banner. */
  message: string;
  action?: string;
  onAction?: () => void;
}

const Ctx = createContext<(options: SnackbarOptions) => void>(() => {});

/** Show a confirmation: 4 s, or 8 s with an action. One at a time — a new one replaces the old. */
export function useSnackbar() {
  return useContext(Ctx);
}

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<(SnackbarOptions & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const segments = useSegments();
  const { theme } = useUnistyles();
  const onTabs = segments[0] === '(tabs)';

  const show = useCallback((options: SnackbarOptions) => {
    setCurrent({ ...options, id: Date.now() });
  }, []);

  useEffect(() => {
    if (!current) return;
    timer.current = setTimeout(() => setCurrent(null), current.action ? 8000 : 4000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [current]);

  const bottom = insets.bottom + (onTabs ? theme.size.tabbarH : 0) + theme.space[3];

  return (
    <Ctx.Provider value={show}>
      {children}
      {current ? (
        <Animated.View
          key={current.id}
          entering={FadeInDown.duration(200)}
          exiting={FadeOutDown.duration(150)}
          style={[styles.host, { bottom }]}
          pointerEvents="box-none"
        >
          <View style={styles.bar} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Text variant="body" color="bg" style={styles.text} numberOfLines={2}>
              {current.message}
            </Text>
            {current.action ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  current.onAction?.();
                  setCurrent(null);
                }}
                style={styles.action}
              >
                <Text variant="label" color="limeInverse" style={styles.actionText}>
                  {current.action}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create((theme) => ({
  host: { position: 'absolute', left: theme.space[3], right: theme.space[3] },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[2],
    minHeight: 48,
    paddingVertical: theme.space[1],
    paddingLeft: theme.space[4],
    paddingRight: theme.space[1],
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.ink,
    boxShadow: theme.shadow.float,
  },
  text: { flex: 1, fontSize: 14, lineHeight: 20 },
  action: {
    height: 40,
    paddingHorizontal: theme.space[3],
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
  },
  actionText: { fontSize: 14 },
}));
