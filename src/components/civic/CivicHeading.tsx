import type { ReactNode } from 'react';
import type { TextProps } from 'react-native';

import { Text } from '../ui/text';

type Props = Omit<TextProps, 'style' | 'role'> & { level?: 1 | 2 | 3; children: ReactNode };

// Full class strings so Tailwind can see them.
const cls = { 1: 'text-h1', 2: 'text-h2', 3: 'text-h3' } as const;

export function CivicHeading({ level = 1, ...rest }: Props) {
  return (
    <Text {...rest} role="heading" aria-level={level} className={`${cls[level]} text-can-text`} />
  );
}
