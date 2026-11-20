import { useEffect, type ReactNode } from 'react';
import { Pressable, View, type PressableProps, type ViewProps } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

/**
 * Bottom navigation, three fixed tabs: Apps · Activity · Settings. Built for expo-router's
 * headless tabs: `<TabList asChild><TabBar>` with one `<TabTrigger asChild><TabBarItem>` per tab.
 * Active: lime pill behind the icon (grows from the centre, 200 ms ease-out), ink label.
 * Badge (amber) only on Apps.
 */
export function TabBar({ style, children, ...rest }: ViewProps & { children: ReactNode }) {
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  return (
    <View
      {...rest}
      style={[
        style,
        styles.bar,
        { paddingBottom: insets.bottom, height: theme.size.tabbarH + insets.bottom },
      ]}
    >
      {children}
    </View>
  );
}

export interface TabBarItemProps extends Omit<PressableProps, 'children'> {
  icon: IconName;
  label: string;
  /** Count on the amber badge; hidden when 0. */
  badge?: number;
  /** Set by TabTrigger. */
  isFocused?: boolean;
  testID?: string;
}

export function TabBarItem({
  icon,
  label,
  badge,
  isFocused = false,
  style: _style,
  ...pressable
}: TabBarItemProps) {
  return (
    <Pressable
      {...pressable}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={badge ? `${label}, ${badge} new` : label}
      style={styles.tab}
    >
      <View style={styles.indicator}>
        <Pill focused={isFocused} />
        <Icon name={icon} size={22} color={isFocused ? 'onLime' : 'inkMuted'} />
        {badge ? (
          <View style={styles.count}>
            <Text
              variant="caption"
              color="onAmber"
              style={styles.countText}
              allowFontScaling={false}
            >
              {String(badge)}
            </Text>
          </View>
        ) : null}
      </View>
      <Text variant="caption" color={isFocused ? 'ink' : 'inkMuted'} style={styles.label}>
        {label}
      </Text>
    </Pressable>
  );
}

function Pill({ focused }: { focused: boolean }) {
  const t = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    t.value = withTiming(focused ? 1 : 0, {
      duration: focused ? 200 : 120,
      easing: Easing.out(Easing.cubic),
    });
  }, [focused, t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value,
    transform: [{ scaleX: 0.5 + 0.5 * t.value }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.pill, style]} />;
}

const styles = StyleSheet.create((theme) => ({
  bar: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: theme.space[2],
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.line,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.space[1] },
  indicator: {
    width: 60,
    height: 32,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.lime,
  },
  label: { fontFamily: theme.type.label.fontFamily },
  count: {
    position: 'absolute',
    top: -4,
    right: 6,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: theme.colors.amber,
    borderWidth: 2,
    borderColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontFamily: theme.type.display.fontFamily, fontSize: 11, lineHeight: 14 },
}));
