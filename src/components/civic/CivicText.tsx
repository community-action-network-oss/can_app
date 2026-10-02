import type { ReactNode } from 'react';
import type { TextProps } from 'react-native';

import { Text } from '../ui/text';

export type TextVariant = 'body' | 'bodyStrong' | 'label' | 'caption';

type Props = Omit<TextProps, 'style'> & {
  variant?: TextVariant;
  muted?: boolean;
  underline?: boolean;
  children: ReactNode;
};

const cls = {
  body: 'text-body',
  bodyStrong: 'text-body-strong',
  label: 'text-label',
  caption: 'text-caption',
} as const;

export function CivicText({ variant = 'body', muted = false, underline = false, ...rest }: Props) {
  return (
    <Text
      {...rest}
      className={`${cls[variant]} ${muted ? 'text-can-text-muted' : 'text-can-text'}${underline ? ' underline' : ''}`}
    />
  );
}
