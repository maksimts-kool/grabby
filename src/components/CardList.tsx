import { FlashList } from '@shopify/flash-list';
import type { ReactElement, ReactNode } from 'react';
import { RefreshControl, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

/**
 * A virtualised screen made of blocks (top bar, banners, section headers) and grouped rows.
 * Rows of one section render as a single surface card (radius-md, 16 gutter, inset hairlines)
 * like `List`, but each row is its own FlashList cell.
 */
export type CardListItem =
  | { key: string; type: 'block'; node: ReactNode }
  | { key: string; type: 'row'; node: ReactNode; first: boolean; last: boolean; inset: number };

export function block(key: string, node: ReactNode): CardListItem {
  return { key, type: 'block', node };
}

/** Rows of one card. `inset` is where dividers start: 76 app rows, 54 settings, 68 activity. */
export function card(
  key: string,
  rows: { key: string; node: ReactNode }[],
  inset = 76,
): CardListItem[] {
  return rows.map((r, i) => ({
    key: `${key}:${r.key}`,
    type: 'row',
    node: r.node,
    first: i === 0,
    last: i === rows.length - 1,
    inset,
  }));
}

export interface CardListProps {
  items: CardListItem[];
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactElement | null;
  testID?: string;
}

export function CardList({ items, refreshing, onRefresh, footer, testID }: CardListProps) {
  const { theme } = useUnistyles();
  return (
    <FlashList
      testID={testID}
      data={items}
      keyExtractor={(item) => item.key}
      getItemType={(item) => item.type}
      contentContainerStyle={styles.content}
      ListFooterComponent={footer}
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
      renderItem={({ item }) =>
        item.type === 'block' ? (
          <>{item.node}</>
        ) : (
          <View style={[styles.row, item.first && styles.first, item.last && styles.last]}>
            {!item.first ? <View style={[styles.divider, { marginLeft: item.inset }]} /> : null}
            {item.node}
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  content: { paddingBottom: theme.space[6] },
  row: {
    marginHorizontal: theme.gutter,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  first: { borderTopLeftRadius: theme.radius.md, borderTopRightRadius: theme.radius.md },
  last: { borderBottomLeftRadius: theme.radius.md, borderBottomRightRadius: theme.radius.md },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.line },
}));
