import { useColorScheme } from 'react-native';

import tokens from './tokens.json';

export { tokens };
export type Palette = Record<keyof typeof tokens.themes.light.color, string>;

const palettes = Object.fromEntries(
  (['light', 'dark'] as const).map((mode) => [
    mode,
    Object.fromEntries(Object.entries(tokens.themes[mode].color).map(([k, v]) => [k, v.value])),
  ]),
) as Record<'light' | 'dark', Palette>;

export const space = (n: keyof typeof tokens.space & `${number}`) => tokens.space[n];
export const { radius, size } = tokens;
export const type = tokens.type.scale;

export function useTheme() {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { mode, color: palettes[mode], status: tokens.themes[mode].status };
}
