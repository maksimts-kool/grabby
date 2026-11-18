import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export interface ScreenProps {
  children: ReactNode;
  /** Wrap in a ScrollView (default). Lists that virtualise pass false and scroll themselves. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Pin content (e.g. an EmptyState) to the vertical centre of what's left. */
  centerContent?: boolean;
  testID?: string;
}

/** bg ground under the status bar; tab screens leave the bottom inset to the tab bar. */
export function Screen({
  children,
  scroll = true,
  refreshing,
  onRefresh,
  centerContent,
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  if (!scroll) {
    return (
      <View testID={testID} style={[styles.root, { paddingTop: insets.top }]}>
        {children}
      </View>
    );
  }
  return (
    <View testID={testID} style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, centerContent && styles.center]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              colors={[theme.colors.onLime]}
              progressBackgroundColor={theme.colors.lime}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Vertical gap of space-4 between blocks. */
export function Gap({ size = 4 }: { size?: 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 }) {
  return <View style={styles.gap(size)} />;
}

const styles = StyleSheet.create((theme) => ({
  root: { flex: 1, backgroundColor: theme.colors.bg },
  content: { paddingBottom: theme.space[6], flexGrow: 1 },
  center: { flexGrow: 1 },
  gap: (size: keyof typeof theme.space) => ({ height: theme.space[size] }),
}));
