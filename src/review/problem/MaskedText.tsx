import type { ReactNode } from 'react';

import { CivicText } from '../../components/civic';
import { useT, type MessageId } from '../../i18n';

const TOKEN = /\[([A-Z][A-Z_]*?)_(\d+)\]/g;
const KIND: Record<string, MessageId> = {
  PERSON: 'vreview.hidden.name',
  EMAIL: 'vreview.hidden.contact',
  PHONE: 'vreview.hidden.contact',
  HANDLE: 'vreview.hidden.contact',
};

/** Masked text: each [KIND_n] token becomes a calm chip. Nothing here tries to reveal what was hidden. */
export function MaskedText({ text, muted }: { text: string; muted?: boolean }) {
  const t = useT();
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const label = t(KIND[m[1]!] ?? 'vreview.hidden.detail');
    parts.push(
      <CivicText key={m.index} variant="label" muted accessibilityLabel={label} testID="mask-chip">
        {`(${label})`}
      </CivicText>,
    );
    last = m.index + m[0].length;
  }
  parts.push(text.slice(last));
  return <CivicText muted={muted}>{parts}</CivicText>;
}
