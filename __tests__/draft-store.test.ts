const mockMem = new Map<string, string>();
const mockFail = { on: false, sets: 0 };
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockMem.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => {
    mockFail.sets++;
    if (mockFail.on) throw new Error('quota');
    if (v.length > 2048) throw new Error('too large');
    mockMem.set(k, v);
  },
  deleteItemAsync: async (k: string) => void mockMem.delete(k),
}));

import {
  clear,
  DEBOUNCE_MS,
  flush,
  listLocal,
  load,
  purgeLocalDraft,
  resetMemory,
  save,
} from '../src/drafts/draftStore';
import { CHUNK, toChunks } from '../src/drafts/secureText';

const schema = { schemaId: 'problem', schemaVersion: 1, schemaHash: 'h1' };

beforeEach(async () => {
  jest.useFakeTimers();
  mockFail.on = false;
  mockFail.sets = 0;
  mockMem.clear();
  resetMemory();
});
afterEach(() => jest.useRealTimers());

const settle = async (p: Promise<void>) => {
  await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
  await p;
};

test('save then reload returns the same draft, including nested body and $unknown', async () => {
  const body = { title: 'Pothole', sources: [{ url: 'x' }], stagePlan: { stages: [1], edges: [] } };
  await settle(save({ ...schema, body, unknown: { 'a.b': 'not sure' }, section: 'prepare' }));
  resetMemory(); // a reload
  const d = await load();
  expect(d?.body).toEqual(body);
  expect(d?.unknown).toEqual({ 'a.b': 'not sure' });
  expect(d?.section).toBe('prepare');
  expect(await listLocal()).toHaveLength(1);
});

test('writes inside the window coalesce into one', async () => {
  const a = save({ ...schema, body: { t: 'a' } });
  await jest.advanceTimersByTimeAsync(100);
  const b = save({ body: { t: 'ab' } });
  expect(mockMem.size).toBe(0);
  await settle(b);
  await a;
  expect(mockFail.sets).toBe(2); // one chunk plus the count
  resetMemory();
  expect((await load())?.body).toEqual({ t: 'ab' });
});

test('long drafts are chunked under the item limit and round trip', async () => {
  const body = { story: 'é€'.repeat(2500) };
  await settle(save({ ...schema, body }));
  expect(mockMem.size).toBeGreaterThan(3);
  resetMemory();
  expect((await load())?.body).toEqual(body);
  await settle(save({ body: { story: 'short' } })); // shrinking removes stale chunks
  expect(mockMem.size).toBe(2);
  expect(toChunks('x'.repeat(CHUNK * 2 + 1))).toHaveLength(3);
});

test('a storage error rejects the save but the draft stays in memory', async () => {
  mockFail.on = true;
  const p = save({ ...schema, body: { t: 'kept' } });
  const caught = p.catch((e: Error) => e.message);
  await jest.advanceTimersByTimeAsync(DEBOUNCE_MS);
  expect(await caught).toBe('quota');
  expect((await load())?.body).toEqual({ t: 'kept' });
  mockFail.on = false;
  await flush(); // retry works once storage recovers
  resetMemory();
  expect((await load())?.body).toEqual({ t: 'kept' });
});

test('clear and purge remove the draft; damaged data reads as none', async () => {
  await settle(save({ ...schema, body: { t: 1 } }));
  await clear();
  expect(mockMem.size).toBe(0);
  expect(await load()).toBeNull();
  await settle(save({ ...schema, body: { t: 1 } }));
  await purgeLocalDraft();
  expect(mockMem.size).toBe(0);
  mockMem.set('can.draft.v1.n', '1');
  mockMem.set('can.draft.v1.0', '{not json');
  resetMemory();
  expect(await load()).toBeNull();
});

test('stores no session data and survives an expired session (independent of it)', async () => {
  await settle(save({ ...schema, body: { t: 'x' } }));
  expect([...mockMem.values()].join('')).not.toMatch(/token|email|session/i);
  expect(() => save({ body: {} })).not.toThrow();
  await flush();
});

test('a first draft without schema identity is refused', () => {
  expect(() => save({ body: {} })).toThrow();
});
