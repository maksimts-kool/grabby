import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Text } from './ui';

export interface Option<T> {
  value: T;
  label: string;
  detail?: string;
}

export interface OptionsSheetRef<T> {
  open: (config: {
    title: string;
    options: Option<T>[];
    selected: T;
    onSelect: (value: T) => void;
  }) => void;
}

/** A picker sheet for chevron settings: "Every 1 h / 3 h / 6 h / 12 h / Daily". */
function OptionsSheetInner<T>(_: object, ref: React.ForwardedRef<OptionsSheetRef<T>>) {
  const sheet = useRef<BottomSheetModal>(null);
  const { theme } = useUnistyles();
  const insets = useSafeAreaInsets();
  const [config, setConfig] = useState<Parameters<OptionsSheetRef<T>['open']>[0] | null>(null);

  useImperativeHandle(ref, () => ({
    open: (c) => {
      setConfig(c);
      sheet.current?.present();
    },
  }));

  return (
    <BottomSheetModal
      ref={sheet}
      enableDynamicSizing
      backdropComponent={(props) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} />
      )}
      backgroundStyle={{ backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.lineStrong }}
    >
      <BottomSheetView style={{ paddingBottom: insets.bottom + theme.space[3] }}>
        {config ? (
          <>
            <Text variant="headline" style={styles.title}>
              {config.title}
            </Text>
            {config.options.map((o) => {
              const selected = o.value === config.selected;
              return (
                <Pressable
                  key={String(o.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  android_ripple={{ color: theme.ripple.neutral }}
                  onPress={() => {
                    config.onSelect(o.value);
                    sheet.current?.dismiss();
                  }}
                  style={styles.option}
                >
                  <View style={[styles.radio, selected && styles.radioOn]} />
                  <View style={styles.text}>
                    <Text variant="body">{o.label}</Text>
                    {o.detail ? (
                      <Text variant="label" color="inkMuted" style={styles.detail}>
                        {o.detail}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </>
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

export const OptionsSheet = forwardRef(OptionsSheetInner) as <T>(props: {
  ref?: React.Ref<OptionsSheetRef<T>>;
}) => React.ReactElement;

const styles = StyleSheet.create((theme) => ({
  title: { paddingHorizontal: theme.space[5], paddingBottom: theme.space[2] },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space[4],
    minHeight: theme.size.touchMin + 8,
    paddingHorizontal: theme.space[5],
    paddingVertical: theme.space[2],
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.lineStrong,
  },
  radioOn: { borderWidth: 6, borderColor: theme.colors.limeInk },
  text: { flex: 1 },
  detail: { fontFamily: theme.type.body.fontFamily },
}));
