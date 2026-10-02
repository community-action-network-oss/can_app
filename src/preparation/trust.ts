import type { MessageId } from '../i18n';

export type Trust = 'high' | 'medium' | 'low' | 'unknown';

// Advice only, never blocking. The category ids come from the pinned schema's enum; an id we do not know reads as "unknown".
const BY_CATEGORY: Record<string, Trust> = {
  official_record: 'high',
  statistics_body: 'high',
  court_or_legislature: 'high',
  reputable_media: 'medium',
  research: 'medium',
  civil_society: 'medium',
  other: 'low',
};

export const trustOf = (category: unknown): Trust =>
  (typeof category === 'string' && BY_CATEGORY[category]) || 'unknown';

/** Text label id plus a glyph, so the hint never rests on colour alone. */
export const TRUST: Record<Trust, { id: MessageId; icon: string }> = {
  high: { id: 'prep.trust.high', icon: '✔' },
  medium: { id: 'prep.trust.medium', icon: '◐' },
  low: { id: 'prep.trust.low', icon: '△' },
  unknown: { id: 'prep.trust.unknown', icon: '?' },
};
