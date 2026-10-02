import type { PressableProps } from 'react-native';

import { Button, ButtonText } from '../ui/button';

// Every button must say what it does: accessibilityLabel is required, not optional.
type Props = Omit<PressableProps, 'style' | 'children' | 'role' | 'accessibilityRole'> & {
  label: string;
  accessibilityLabel: string;
  variant?: 'primary' | 'secondary';
};

// min-h/min-w-11 = 44pt (size.minTarget). Focus ring comes from the gluestack Button (ring-2 on focus-visible).
const base = 'min-h-11 min-w-11 px-4 py-2 border-2';
const styles = {
  primary: { button: `${base} border-primary`, text: 'text-label' },
  secondary: {
    button: `${base} bg-can-surface border-can-control-border data-[hover=true]:bg-can-surface-muted data-[active=true]:bg-can-surface-muted`,
    text: 'text-label text-can-text',
  },
};

export function CivicButton({ label, variant = 'primary', disabled, ...rest }: Props) {
  const s = styles[variant];
  return (
    <Button
      {...rest}
      role="button"
      variant="default"
      className={s.button}
      disabled={disabled}
      isDisabled={!!disabled}
      accessibilityState={{ disabled: !!disabled }}
    >
      <ButtonText className={s.text}>{label}</ButtonText>
    </Button>
  );
}
