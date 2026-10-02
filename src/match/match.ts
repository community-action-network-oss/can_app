// Deterministic on-device matcher (WF-MATCH-1, D-80). Pure: same profile + same list = same result.
// No ranking by engagement: the order is the server's (newest first). Never imports src/api.
import type { Profile } from '../profile/model';

export type Tagged = {
  id: string;
  help_needed: {
    skill_groups: string[];
    languages: string[];
    coarse_place: string | null;
    topics: string[];
  };
};

// Profile "know" slugs -> server spec-26 skill group ids.
export const GROUP_OF = {
  care: 'care_and_health',
  food: 'hospitality_and_food',
  admin: 'public_service_and_administration',
  trades: 'trades_and_repair',
  law: 'law_and_rights',
  teaching: 'teaching_and_childcare',
  transport: 'transport',
  tech: 'technology',
  research: 'research',
  organising: 'community_organising',
} as const;

export type Reason =
  | { kind: 'skill'; value: keyof typeof GROUP_OF }
  | { kind: 'language'; value: string }
  | { kind: 'topic'; value: string }
  | { kind: 'place'; value: string };

export const MAX_MATCHES = 5;

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
const primary = (tag: string) => tag.toLowerCase().split('-')[0];

export function reasonsFor(p: Profile, item: Tagged): Reason[] {
  const h = item.help_needed;
  const out: Reason[] = [];
  for (const k of p.know)
    if (h.skill_groups.includes(GROUP_OF[k])) out.push({ kind: 'skill', value: k });
  for (const l of p.languages)
    if (h.languages.some((x) => primary(x) === l)) out.push({ kind: 'language', value: l });
  for (const place of p.places)
    if (h.coarse_place && slug(place) === h.coarse_place) out.push({ kind: 'place', value: place });
  for (const t of new Set([...p.affects, ...p.causes]))
    if (h.topics.includes(t)) out.push({ kind: 'topic', value: t });
  return out;
}

/** Matching items in the given order, with why each matched. At most MAX_MATCHES; `hidden` is the not-for-me list. */
export function matchProblems<T extends Tagged>(
  p: Profile,
  items: readonly T[],
  hidden: ReadonlySet<string> = new Set(),
): { item: T; reasons: Reason[] }[] {
  const out: { item: T; reasons: Reason[] }[] = [];
  for (const item of items) {
    if (hidden.has(item.id)) continue;
    const reasons = reasonsFor(p, item);
    if (reasons.length) out.push({ item, reasons });
    if (out.length === MAX_MATCHES) break;
  }
  return out;
}
