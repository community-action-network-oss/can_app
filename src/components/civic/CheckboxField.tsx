import { Pressable } from 'react-native';

import { Box } from '../ui/box';
import { Text } from '../ui/text';
import { FieldError } from './FormField';

type Props = { label: string; checked: boolean; onToggle: () => void; error?: string };

// Check mark glyph plus box border: state is never colour alone. 44pt target.
export function CheckboxField({ label, checked, onToggle, error }: Props) {
  return (
    <Box className="gap-1">
      <Pressable
        role="checkbox"
        aria-checked={checked}
        accessibilityLabel={label}
        accessibilityState={{ checked }}
        onPress={onToggle}
        className="min-h-11 flex-row items-center gap-2"
      >
        <Text className="text-label text-can-text border-2 border-can-control-border px-2">
          {checked ? '✓' : ' '}
        </Text>
        <Text className="text-body text-can-text flex-1">{label}</Text>
      </Pressable>
      {error ? <FieldError message={error} /> : null}
    </Box>
  );
}
