import type { ReactNode } from 'react';
import { IntlProvider, useIntl } from 'react-intl';

import en from './en.json';

export type MessageId = keyof typeof en;

// Typed message ids: intl.formatMessage({ id: 'typo' }) fails tsc.
declare global {
  namespace FormatjsIntl {
    interface Message {
      ids: MessageId;
    }
  }
}

export const messages = en;

export function I18nProvider({ children }: { children: ReactNode }) {
  return (
    <IntlProvider locale="en" defaultLocale="en" messages={messages}>
      {children}
    </IntlProvider>
  );
}

/** Typed translate function: every UI string goes through this. */
export function useT() {
  const intl = useIntl();
  return (id: MessageId, values?: Record<string, string | number>) =>
    intl.formatMessage({ id }, values);
}
