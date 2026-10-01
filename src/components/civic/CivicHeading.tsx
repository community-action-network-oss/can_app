import type { ReactNode } from 'react';
import { Text, type TextProps } from 'react-native';

import { type, useTheme } from '../../theme';

type Props = Omit<TextProps, 'style' | 'role'> & { level?: 1 | 2 | 3; children: ReactNode };

export function CivicHeading({ level = 1, ...rest }: Props) {
  const { color } = useTheme();
  const t = type[`h${level}` as const];
  return (
    <Text
      {...rest}
      role="heading"
      aria-level={level}
      style={{
        color: color.text,
        fontSize: t.size,
        lineHeight: t.line,
        fontWeight: String(t.weight) as '700',
      }}
    />
  );
}
