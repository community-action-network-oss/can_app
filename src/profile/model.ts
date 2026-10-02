import { z } from 'zod';

// Closed lists only: no free text except coarse place names, so a profile holds no name, contact, employer or identifier.
export const KNOW = [
  'care',
  'food',
  'admin',
  'trades',
  'law',
  'teaching',
  'transport',
  'tech',
  'research',
  'organising',
] as const;
export const TIME = ['few', 'some', 'lots'] as const;
export const KINDS = ['evidence', 'local', 'skill', 'translation', 'review'] as const;
export const LANGS = ['en', 'nl', 'pl', 'de', 'fr', 'es', 'tr', 'ar'] as const;
export const TOPICS = [
  'housing',
  'air',
  'waste',
  'water',
  'streets',
  'noise',
  'health',
  'schools',
] as const;

const subset = <T extends readonly [string, ...string[]]>(a: T) => z.array(z.enum(a)).max(a.length);

export const ProfileSchema = z.object({
  know: subset(KNOW),
  time: z.enum(TIME).nullable(),
  kinds: subset(KINDS),
  places: z.array(z.string().trim().min(1).max(40)).max(10),
  languages: subset(LANGS),
  affects: subset(TOPICS),
  causes: subset(TOPICS),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const emptyProfile = (): Profile => ({
  know: [],
  time: null,
  kinds: [],
  places: [],
  languages: [],
  affects: [],
  causes: [],
});

export const isEmpty = (p: Profile) => JSON.stringify(p) === JSON.stringify(emptyProfile());

const FILE_V = 1;
export const toFile = (p: Profile) => JSON.stringify({ can_profile: FILE_V, profile: p }, null, 2);

/** Returns the profile, or null when the text is not a valid profile file. */
export function fromFile(text: string): Profile | null {
  try {
    const j = JSON.parse(text);
    if (j?.can_profile !== FILE_V) return null;
    const r = ProfileSchema.safeParse(j.profile);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
