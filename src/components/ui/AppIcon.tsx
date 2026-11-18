import { Image } from 'expo-image';
import { useState } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Text } from './Text';

export const TILES = ['moss', 'rust', 'sea', 'plum', 'slate', 'sand'] as const;
export type Tile = (typeof TILES)[number];

const TILE_COLOR = {
  moss: 'tileMoss',
  rust: 'tileRust',
  sea: 'tileSea',
  plum: 'tilePlum',
  slate: 'tileSlate',
  sand: 'tileSand',
} as const;

export function tileFor(name: string): Tile {
  return TILES[(name.charCodeAt(0) || 0) % TILES.length];
}

export interface AppIconProps {
  name: string;
  /** The app's real icon (file://, data: or https: from the topic). Wins when it loads square. */
  src?: string | null;
  tile?: Tile;
  /** sm 40 · md 48 · lg 72 */
  size?: 'sm' | 'md' | 'lg';
  letter?: string;
}

/** The app's real launcher icon, or a monogram tile until Grabby has one. */
export function AppIcon({ name, src, tile, size = 'md', letter }: AppIconProps) {
  styles.useVariants({ size });
  const t = tile ?? tileFor(name);
  const glyph =
    letter ??
    name
      .replace(/[^A-Za-z0-9Ѐ-ӿ]/g, '')
      .charAt(0)
      .toUpperCase();
  // A topic picture that fails, or isn't square (a banner, a screenshot), falls back to the tile.
  const [rejected, setRejected] = useState<string | null>(null);
  if (src && rejected !== src) {
    return (
      <Image
        source={{ uri: src }}
        style={styles.icon}
        contentFit="cover"
        cachePolicy="disk"
        recyclingKey={src}
        onError={() => setRejected(src)}
        onLoad={({ source }) => {
          const ratio = source.width / Math.max(source.height, 1);
          if (ratio < 0.85 || ratio > 1.18) setRejected(src);
        }}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.icon, styles.tile(t)]} accessibilityRole="image" accessibilityLabel={name}>
      <Text
        variant="title"
        color={t === 'sand' ? 'onTileDark' : 'onTile'}
        style={styles.letter}
        allowFontScaling={false}
      >
        {glyph}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    variants: {
      size: {
        sm: { width: 40, height: 40, borderRadius: theme.radius.sm },
        md: { width: 48, height: 48, borderRadius: theme.radius.md },
        lg: { width: 72, height: 72, borderRadius: theme.radius.lg },
      },
    },
  },
  tile: (t: Tile) => ({ backgroundColor: theme.colors[TILE_COLOR[t]] }),
  letter: {
    fontFamily: theme.type.display.fontFamily,
    variants: {
      size: {
        sm: { fontSize: 17, lineHeight: 22 },
        md: { fontSize: 20, lineHeight: 26 },
        lg: { fontSize: 30, lineHeight: 36 },
      },
    },
  },
}));
