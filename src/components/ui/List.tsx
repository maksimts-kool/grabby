import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export interface ListProps {
  children: ReactNode;
  /** Where the hairline divider starts: past the icon. 76 app rows, 54 settings, 68 activity. */
  inset?: number;
  /** No card, no gutter — full-bleed lists. */
  flush?: boolean;
}

/** The grouped container for rows: surface card, radius-md, 16 gutter, inset hairlines. */
export function List({ children, inset = 76, flush }: ListProps) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[styles.list, flush && styles.flush]} accessibilityRole="list">
      {items.map((child, i) => (
        <Fragment key={child.key ?? i}>
          {i > 0 ? <View style={[styles.divider, { marginLeft: inset }]} /> : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: {
    marginHorizontal: theme.gutter,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    overflow: 'hidden',
  },
  flush: { marginHorizontal: 0, borderRadius: 0, backgroundColor: 'transparent' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.line },
}));
