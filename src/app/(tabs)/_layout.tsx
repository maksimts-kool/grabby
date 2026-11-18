import { Tabs } from 'expo-router/js-tabs';
import { useUnistyles } from 'react-native-unistyles';

import { TabBar } from '@/components/ui';
import { useLibrary } from '@/hooks/useLibrary';

/** Four fixed tabs: Apps · Downloads · Activity · Settings. Badges only on Apps and Downloads. */
export default function TabsLayout() {
  const { theme } = useUnistyles();
  const { updates, items } = useLibrary();
  const ready = items.filter((i) => i.download?.status === 'ready').length;
  const pending = updates.filter((i) => !i.download).length;
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.bg },
        animation: 'shift',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Apps', tabBarBadge: pending || undefined }} />
      <Tabs.Screen
        name="downloads"
        options={{ title: 'Downloads', tabBarBadge: ready || undefined }}
      />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
