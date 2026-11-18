import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import type { ColorToken, TypeVariant } from '@/theme/unistyles';

export interface TextProps extends RNTextProps {
  /** A type style from tokens.json: display, title, headline, bodyStrong, body, label, caption, version, versionLg. */
  variant?: TypeVariant;
  color?: ColorToken;
}

export function Text({ variant = 'body', color = 'ink', style, ...rest }: TextProps) {
  return <RNText {...rest} style={[styles.text(variant, color), style]} />;
}

const styles = StyleSheet.create((theme) => ({
  text: (variant: TypeVariant, color: ColorToken) => ({
    ...theme.type[variant],
    color: theme.colors[color],
  }),
}));
