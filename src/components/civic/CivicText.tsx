import type { ReactNode } from 'react';
import { Text, type TextProps } from 'react-native';

import { type, useTheme } from '../../theme';

export type TextVariant = 'body' | 'bodyStrong' | 'label' | 'caption';

type Props = Omit<TextProps, 'style'> & {
  variant?: TextVariant;
  muted?: boolean;
  children: ReactNode;
};

export function CivicText({ variant = 'body', muted = false, ...rest }: Props) {
  const { color } = useTheme();
  const t = type[variant];
  return (
    <Text
      {...rest}
      style={{
        color: muted ? color.textMuted : color.text,
        fontSize: t.size,
        lineHeight: t.line,
        fontWeight: String(t.weight) as '400',
      }}
    />
  );
}
