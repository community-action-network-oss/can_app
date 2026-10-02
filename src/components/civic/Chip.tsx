import { Pressable } from 'react-native';

import { Text } from '../ui/text';

type Props = { label: string; selected: boolean; onToggle: () => void };

// A toggle chip. 44pt target; selected state is shown by border and fill, never by colour alone (check mark).
export function Chip({ label, selected, onToggle }: Props) {
  return (
    <Pressable
      role="checkbox"
      aria-checked={selected}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onToggle}
      className={`min-h-11 px-4 py-2 rounded-full border-2 justify-center ${selected ? 'border-primary bg-can-surface-muted' : 'border-can-control-border bg-can-surface'}`}
    >
      <Text className="text-label text-can-text">{selected ? `✓ ${label}` : label}</Text>
    </Pressable>
  );
}
