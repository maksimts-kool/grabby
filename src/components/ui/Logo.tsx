import Svg, { Path, Rect } from 'react-native-svg';
import { useUnistyles } from 'react-native-unistyles';

/** The Grabby mark: a lime squircle with a down arrow landing on a bar. Never recolour it. */
export function Logo({ size = 64 }: { size?: number }) {
  const { theme } = useUnistyles();
  return (
    <Svg width={size} height={size} viewBox="0 0 108 108" accessibilityLabel="Grabby">
      <Rect width={108} height={108} rx={28} fill={theme.colors.lime} />
      <Path
        d="M54 24v40M37 48l17 17 17-17"
        fill="none"
        stroke={theme.colors.onLime}
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x={30} y={75} width={48} height={9} rx={4.5} fill={theme.colors.onLime} />
    </Svg>
  );
}
