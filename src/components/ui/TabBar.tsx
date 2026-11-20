import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

const TABS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'apps', label: 'Apps' },
  activity: { icon: 'bell', label: 'Activity' },
  settings: { icon: 'settings', label: 'Settings' },
};

/**
 * Bottom navigation, three fixed tabs: Apps · Activity · Settings.
 * Active: lime pill behind the icon (grows from the centre, 200 ms ease-out), ink label. Badge (amber) only on Apps,
 * passed through the screen's `tabBarBadge` option.
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const { theme } = useUnistyles();
  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: insets.bottom, height: theme.size.tabbarH + insets.bottom },
      ]}
    >
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = index === state.index;
        const badge = descriptors[route.key]?.options.tabBarBadge;
        const onPress = () => {
          const event = emitter.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <Pressable
            key={route.key}
            testID={`tab-${route.name}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={badge ? `${tab.label}, ${badge} new` : tab.label}
            onPress={onPress}
            onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
            style={styles.tab}
          >
            <View style={styles.indicator}>
              <Pill focused={focused} />
              <Icon name={tab.icon} size={22} color={focused ? 'onLime' : 'inkMuted'} />
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
            <Text variant="caption" color={focused ? 'ink' : 'inkMuted'} style={styles.label}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
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
