import { StyleSheet } from 'react-native-unistyles';

import { settings } from '@/lib/settings';
import { colors, radius, shadow, size, space, type } from './tokens';

/** `#rrggbb` + alpha (0–1) → `#rrggbbaa`. */
export function alpha(hex: string, a: number): string {
  const byte = Math.round(Math.min(1, Math.max(0, a)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${byte}`;
}

function makeTheme(mode: 'dark' | 'light') {
  const c = colors[mode];
  return {
    mode,
    colors: c,
    shadow: { float: shadow[mode].shadowFloat },
    // Pressed state: Android ripple, on-lime 16% on lime, ink 10% elsewhere.
    ripple: { onLime: alpha(c.onLime, 0.16), neutral: alpha(c.ink, 0.1) },
    space,
    radius,
    size,
    type,
    disabledOpacity: 0.45,
    gutter: space[4],
  } as const;
}

export const darkTheme = makeTheme('dark');
export const lightTheme = makeTheme('light');

export type AppTheme = ReturnType<typeof makeTheme>;
export type ColorToken = keyof AppTheme['colors'];
export type TypeVariant = keyof AppTheme['type'];

type AppThemes = {
  dark: typeof darkTheme;
  light: typeof lightTheme;
};

declare module 'react-native-unistyles' {
  // Declaration merging is how Unistyles learns the theme type.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesThemes extends AppThemes {}
}

// Dark is the primary theme. "system" follows the OS; the user can pin one in Settings.
const preference = settings.getTheme();

StyleSheet.configure({
  themes: { dark: darkTheme, light: lightTheme },
  settings: preference === 'system' ? { adaptiveThemes: true } : { initialTheme: preference },
});
