import { TabList, TabSlot, TabTrigger, Tabs, type TabsSlotRenderOptions } from 'expo-router/ui';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { TabBar, TabBarItem } from '@/components/ui';
import { useUpdateCount } from '@/hooks/useLibrary';

type Descriptor = Parameters<NonNullable<React.ComponentProps<typeof TabSlot>['renderFn']>>[0];

/**
 * Three fixed tabs: Apps · Activity · Settings. Badge only on Apps; Downloads opens from My apps.
 *
 * Visited tabs stay mounted, in a fixed order, and switch by opacity alone. The stock tab
 * navigator moved the focused screen to the front with zIndex, which on Android re-inserts the
 * whole screen and redraws every view in it: most of the dropped frames on a tab switch.
 */
function renderScreen(descriptor: Descriptor, { isFocused, loaded }: TabsSlotRenderOptions) {
  if (!loaded && !isFocused) return null;
  return (
    <View
      key={descriptor.route.key}
      collapsable={false}
      pointerEvents={isFocused ? 'auto' : 'none'}
      importantForAccessibility={isFocused ? 'auto' : 'no-hide-descendants'}
      style={[styles.scene, !isFocused && styles.hidden]}
    >
      {descriptor.render()}
    </View>
  );
}

export default function TabsLayout() {
  const pending = useUpdateCount();
  return (
    <Tabs style={styles.root}>
      <TabSlot detachInactiveScreens={false} renderFn={renderScreen} style={styles.slot} />
      <TabList asChild>
        <TabBar>
          <TabTrigger name="index" href="/" asChild>
            <TabBarItem icon="apps" label="Apps" badge={pending} testID="tab-index" />
          </TabTrigger>
          <TabTrigger name="activity" href="/activity" asChild>
            <TabBarItem icon="bell" label="Activity" testID="tab-activity" />
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabBarItem icon="settings" label="Settings" testID="tab-settings" />
          </TabTrigger>
        </TabBar>
      </TabList>
    </Tabs>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  slot: { flex: 1 },
  scene: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.bg },
  hidden: { opacity: 0 },
}));
