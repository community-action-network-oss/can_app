import type { ReactNode } from 'react';

import { useT } from '../../i18n';
import { Box } from '../ui/box';
import { CivicText } from './CivicText';

type Props = {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
};

/** Visible label (never truncated), hint, control, then an error row: glyph plus text, never colour alone. */
export function FormField({ label, hint, error, required, children }: Props) {
  const t = useT();
  return (
    <Box className="gap-1">
      <CivicText variant="label">
        {label}
        {required ? ` (${t('common.field.needed')})` : ''}
      </CivicText>
      {hint ? (
        <CivicText variant="caption" muted>
          {hint}
        </CivicText>
      ) : null}
      {children}
      {error ? <FieldError message={error} /> : null}
    </Box>
  );
}

export function FieldError({ message }: { message: string }) {
  return (
    <Box
      role="alert"
      accessibilityLiveRegion="assertive"
      testID="field-error"
      className="flex-row gap-2 items-start"
    >
      <CivicText variant="bodyStrong" accessibilityElementsHidden testID="field-error-icon">
        {'⚠'}
      </CivicText>
      <CivicText variant="caption" className="flex-1">
        {message}
      </CivicText>
    </Box>
  );
}
