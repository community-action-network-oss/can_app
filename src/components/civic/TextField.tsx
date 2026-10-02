import { forwardRef } from 'react';
import type { TextInput, TextInputProps } from 'react-native';

import { useT } from '../../i18n';
import { Input, InputField } from '../ui/input';
import { CivicText } from './CivicText';
import { FormField } from './FormField';

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  accessibilityLabel?: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  onBlur?: () => void;
  inputMode?: TextInputProps['inputMode'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  /** Form mode: a visible label turns on FormField (hint, required, error, counter). Without it the field is bare. */
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, hint, error, required, accessibilityLabel, ...rest },
  ref,
) {
  const t = useT();
  const input = (
    <Input className="min-h-11 border-can-control-border" isInvalid={!!error}>
      <InputField
        {...rest}
        ref={ref as never}
        accessibilityLabel={accessibilityLabel ?? label}
        aria-label={accessibilityLabel ?? label}
        aria-invalid={!!error}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </Input>
  );
  if (!label) return input;
  return (
    <FormField label={label} hint={hint} error={error} required={required}>
      {input}
      {rest.maxLength ? (
        <CivicText variant="caption" muted testID="field-counter">
          {t('common.field.counter', { count: rest.value.length, max: rest.maxLength })}
        </CivicText>
      ) : null}
    </FormField>
  );
});
