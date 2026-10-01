import { useState } from 'react';
import { Pressable, Text, type PressableProps } from 'react-native';

import { radius, size, space, type, useTheme } from '../../theme';

// Every button must say what it does: accessibilityLabel is required, not optional.
type Props = Omit<PressableProps, 'style' | 'children' | 'role' | 'accessibilityRole'> & {
  label: string;
  accessibilityLabel: string;
  variant?: 'primary' | 'secondary';
};

export function CivicButton({
  label,
  variant = 'primary',
  disabled,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const { color } = useTheme();
  const [focused, setFocused] = useState(false);
  const primary = variant === 'primary';
  return (
    <Pressable
      {...rest}
      role="button"
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={({ pressed }) => ({
        minHeight: size.minTarget,
        minWidth: size.minTarget,
        paddingHorizontal: space('4'),
        paddingVertical: space('2'),
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? color.primary : color.surface,
        borderWidth: size.focusRingWidth,
        borderColor: focused ? color.focus : primary ? color.primary : color.controlBorder,
        opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      <Text
        style={{
          color: primary ? color.onPrimary : color.text,
          fontSize: type.label.size,
          lineHeight: type.label.line,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
