import Svg, { Path } from 'react-native-svg';
import { useUnistyles } from 'react-native-unistyles';

import { ICON_PATHS, type IconName } from '@/theme/icons';
import type { ColorToken } from '@/theme/unistyles';

export type { IconName };

export interface IconProps {
  name: IconName;
  /** 24 in icon buttons and the top bar, 22 in tabs/settings/banners, 20 in buttons, 14 in chips. */
  size?: number;
  color?: ColorToken;
}

export function Icon({ name, size = 20, color = 'ink' }: IconProps) {
  const { theme } = useUnistyles();
  const stroke = theme.colors[color];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" pointerEvents="none">
      {ICON_PATHS[name].map((d) => (
        <Path
          key={d}
          d={d}
          stroke={stroke}
          strokeWidth={name === 'more' ? 2.8 : 1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ))}
    </Svg>
  );
}
