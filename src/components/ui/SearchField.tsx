import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from './Icon';
import { IconButton } from './IconButton';

export interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  label?: string;
  /** Empty field: trailing button reads the clipboard for a topic link. */
  onPasteLink?: () => void;
  autoFocus?: boolean;
  onSubmitEditing?: () => void;
}

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search 4PDA or paste a topic link',
  label = 'Search',
  onPasteLink,
  autoFocus,
  onSubmitEditing,
}: SearchFieldProps) {
  const { theme } = useUnistyles();
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, focused && styles.focused]}>
      <Icon name="search" size={22} color="inkMuted" />
      <TextInput
        testID="search-input"
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.inkMuted}
        accessibilityLabel={label}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        selectionColor={theme.colors.limeInk}
        cursorColor={theme.colors.limeInk}
      />
      {value ? (
        <IconButton
          icon="close"
          label="Clear"
          size="sm"
          color="inkMuted"
          onPress={() => onChangeText('')}
        />
      ) : (
        <IconButton
          icon="link"
          label="Paste link"
          size="sm"
          color="inkMuted"
          onPress={onPasteLink}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[3],
    height: 52,
    marginHorizontal: theme.gutter,
    paddingLeft: theme.space[4],
    paddingRight: theme.space[1],
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceRaised,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  focused: { borderColor: theme.colors.focus },
  input: {
    flex: 1,
    minWidth: 0,
    ...theme.type.body,
    color: theme.colors.ink,
    paddingVertical: 0,
  },
}));
