import { Pressable } from 'react-native';

import { Box } from '../ui/box';
import { Text } from '../ui/text';
import { FormField } from './FormField';

type Props = {
  label: string;
  hint?: string;
  options: { value: string; label: string }[];
  value: string | undefined;
  onChange: (v: string) => void;
  error?: string;
  required?: boolean;
};

/** Single choice as a radio group. Selection shows a mark and a heavier border, never colour alone. 44pt targets. */
export function ChoiceField({ label, hint, options, value, onChange, error, required }: Props) {
  return (
    <FormField label={label} hint={hint} error={error} required={required}>
      <Box role="radiogroup" accessibilityLabel={label} className="gap-1">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              role="radio"
              aria-checked={on}
              accessibilityLabel={o.label}
              accessibilityState={{ checked: on }}
              onPress={() => onChange(o.value)}
              className={`min-h-11 flex-row items-center gap-2 px-2 border-2 ${on ? 'border-primary' : 'border-can-control-border'}`}
            >
              <Text className="text-label text-can-text">{on ? '(•)' : '( )'}</Text>
              <Text className="text-body text-can-text flex-1">{o.label}</Text>
            </Pressable>
          );
        })}
      </Box>
    </FormField>
  );
}
