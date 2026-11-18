/// <reference types="node" />
/**
 * Generates src/theme/tokens.ts from design/tokens.json (the Grabby design system).
 *
 *   bun scripts/gen-theme.ts          write the file
 *   bun scripts/gen-theme.ts --check  exit 1 if the file is out of date (CI)
 *
 * Output shape (see design/README in the design system, "Expo" section):
 * - colors.dark / colors.light, camelCased names ("surface-raised" → surfaceRaised)
 * - numbers, not "16px", for space / radius / size
 * - a type map of { fontFamily, fontSize, lineHeight, letterSpacing } per style, where
 *   fontFamily is the per-weight family name expo-google-fonts registers on Android.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

type ColorValue = string | Record<string, string>;
interface Token<V = string> {
  name: string;
  value: V;
  usage?: string;
}
interface TypeStyle {
  name: string;
  fontSize: string;
  lineHeight: string;
  fontWeight: number;
  letterSpacing?: string;
  usage?: string;
}
interface Tokens {
  color: { themes: { id: string }[]; tokens: Token<ColorValue>[] };
  type: { groups: { family: 'sans' | 'mono'; styles: TypeStyle[] }[] };
  spacing: { tokens: Token[] };
  radius: { tokens: Token[] };
  size: { tokens: Token[] };
  shadow: { tokens: Token<ColorValue>[] };
}

const root = resolve(import.meta.dirname, '..');
const tokens: Tokens = JSON.parse(readFileSync(resolve(root, 'design/tokens.json'), 'utf8'));

const camel = (s: string) => s.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const px = (v: string) => {
  const n = Number.parseFloat(v);
  if (Number.isNaN(n)) throw new Error(`Not a length: ${v}`);
  return n;
};

const FAMILIES: Record<'sans' | 'mono', Record<number, string>> = {
  sans: {
    400: 'Onest_400Regular',
    500: 'Onest_500Medium',
    600: 'Onest_600SemiBold',
    700: 'Onest_700Bold',
  },
  mono: {
    500: 'JetBrainsMono_500Medium',
    600: 'JetBrainsMono_600SemiBold',
  },
};

const themeIds = tokens.color.themes.map((t) => t.id);
const primary = themeIds[0];

function themed(list: Token<ColorValue>[]) {
  const out: Record<string, Record<string, string>> = {};
  for (const id of themeIds) out[id] = {};
  for (const t of list) {
    for (const id of themeIds) {
      const v = typeof t.value === 'string' ? t.value : (t.value[id] ?? t.value[primary]);
      out[id][camel(t.name)] = v;
    }
  }
  return out;
}

const colors = themed(tokens.color.tokens);
const shadow = themed(tokens.shadow.tokens);

const space: Record<number, number> = {};
for (const t of tokens.spacing.tokens) space[Number(t.name.replace('space-', ''))] = px(t.value);

const radius: Record<string, number> = {};
for (const t of tokens.radius.tokens) radius[t.name.replace('radius-', '')] = px(t.value);

const size: Record<string, number> = {};
for (const t of tokens.size.tokens) size[camel(t.name)] = px(t.value);

const type: Record<string, Record<string, string | number>> = {};
for (const group of tokens.type.groups) {
  for (const s of group.styles) {
    const fontSize = px(s.fontSize);
    const family = FAMILIES[group.family][s.fontWeight];
    if (!family) throw new Error(`No ${group.family} font file for weight ${s.fontWeight}`);
    const style: Record<string, string | number> = {
      fontFamily: family,
      fontSize,
      lineHeight: px(s.lineHeight),
    };
    if (s.letterSpacing?.endsWith('em')) {
      style.letterSpacing = Math.round(px(s.letterSpacing) * fontSize * 100) / 100;
    }
    type[camel(s.name)] = style;
  }
}

const body = `// Generated from design/tokens.json by scripts/gen-theme.ts — do not edit by hand.
// Run \`bun run theme\` after changing the tokens.

export const colors = ${JSON.stringify(colors, null, 2)} as const;

export const shadow = ${JSON.stringify(shadow, null, 2)} as const;

export const space = ${JSON.stringify(space, null, 2).replace(/"(\d+)":/g, '$1:')} as const;

export const radius = ${JSON.stringify(radius, null, 2)} as const;

export const size = ${JSON.stringify(size, null, 2)} as const;

export const type = ${JSON.stringify(type, null, 2)} as const;
`;

const target = resolve(root, 'src/theme/tokens.ts');
if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(target, 'utf8');
  } catch {}
  if (current !== body) {
    console.error('src/theme/tokens.ts is out of date — run `bun run theme`.');
    process.exit(1);
  }
  console.log('Theme tokens are up to date.');
} else {
  writeFileSync(target, body);
  console.log(`Wrote ${target}`);
}
