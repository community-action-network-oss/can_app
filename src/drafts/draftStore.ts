// Single local draft per device (slice 1). Never touches the network and never stores tokens, email or session data.
import { z } from 'zod';

import { deleteText, readText, writeText } from './secureText';

export const DraftSchema = z.object({
  localId: z.string(),
  serverId: z.string().optional(),
  schemaId: z.string(),
  schemaVersion: z.union([z.string(), z.number()]),
  schemaHash: z.string(),
  /** Answers keyed by the pinned content schema (D-58); nested lists and the stage plan live inside. */
  body: z.record(z.string(), z.unknown()),
  /** The SchemaForm `$unknown` map (second onSubmit argument). */
  unknown: z.record(z.string(), z.unknown()),
  section: z.string().optional(),
  updatedAt: z.number(),
  version: z.number(),
});
export type Draft = z.infer<typeof DraftSchema>;
export type DraftPatch = Partial<Omit<Draft, 'localId' | 'version' | 'updatedAt'>>;

export const DEBOUNCE_MS = 400;

let cache: Draft | null = null;
let loaded = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let waiters: { ok: () => void; no: (e: unknown) => void }[] = [];

const newId = () => `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Pure: the next draft after a patch. A first draft needs the schema identity. */
export function applyPatch(prev: Draft | null, patch: DraftPatch, now = Date.now()): Draft {
  const base = prev ?? {
    localId: newId(),
    schemaId: patch.schemaId,
    schemaVersion: patch.schemaVersion,
    schemaHash: patch.schemaHash,
    body: {},
    unknown: {},
    updatedAt: now,
    version: 0,
  };
  const next = { ...base, ...patch, updatedAt: now, version: base.version + 1 };
  return DraftSchema.parse(next); // throws if a first draft lacks schemaId, schemaVersion or schemaHash
}

/** The saved draft, or null. A damaged or unreadable store reads as no draft. */
export async function load(): Promise<Draft | null> {
  if (loaded) return cache;
  try {
    const text = await readText();
    const parsed = text ? DraftSchema.safeParse(JSON.parse(text)) : null;
    cache = parsed?.success ? parsed.data : null;
  } catch {
    cache = null;
  }
  loaded = true;
  return cache;
}

/** Writes now what is waiting in the debounce window. Rejects when storage fails; memory keeps the draft. */
export async function flush(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  const mine = waiters;
  waiters = [];
  try {
    if (cache) await writeText(JSON.stringify(cache));
    mine.forEach((w) => w.ok());
  } catch (e) {
    mine.forEach((w) => w.no(e));
  }
}

/**
 * Merges a patch into the draft and writes it after 400 ms of quiet. Calls inside the window coalesce
 * into one write; every caller's promise settles when that write does. Call load() first.
 */
export function save(patch: DraftPatch): Promise<void> {
  cache = applyPatch(cache, patch);
  loaded = true;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), DEBOUNCE_MS);
  return new Promise((ok, no) => waiters.push({ ok, no }));
}

export async function clear(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  const mine = waiters;
  waiters = [];
  mine.forEach((w) => w.ok());
  cache = null;
  loaded = true;
  await deleteText();
}

/** For the logout choice "Delete the draft on this device". Never called silently. */
export const purgeLocalDraft = clear;

/** Slice 1 keeps one draft per device. */
export async function listLocal(): Promise<Draft[]> {
  const d = await load();
  return d ? [d] : [];
}

/** Test seam: forgets the in-memory state without touching storage. */
export function resetMemory() {
  if (timer) clearTimeout(timer);
  timer = null;
  waiters = [];
  cache = null;
  loaded = false;
}
