import { Tabs } from 'expo-router/js-tabs';
import { useUnistyles } from 'react-native-unistyles';

import { TabBar } from '@/components/ui';
import { useLibrary } from '@/hooks/useLibrary';

/** Three fixed tabs: Apps · Activity · Settings. Badge only on Apps; Downloads opens from My apps. */
export default function TabsLayout() {
  const { theme } = useUnistyles();
  const { updates } = useLibrary();
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
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
