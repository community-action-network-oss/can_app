import { Platform } from 'react-native';

import { parseApiError } from '../src/api/errors';
import { sessionEvents } from '../src/api/session-events';
import { unwrap } from '../src/api/unwrap';

// The client reads Platform and document at call/load time: fake a web runtime first.
Platform.OS = 'web';
const doc = { cookie: '' };
(globalThis as any).document = doc;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { api } = require('../src/api/client') as typeof import('../src/api/client');

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const envelope = (code: string, extra = {}) => ({ error: { code, message: 'm', ...extra } });

// Paths are cast: the tests exercise infrastructure, not the contract.
const post = () => (api as any).POST('/anything', { body: {} });
const get = () => (api as any).GET('/health');

afterEach(() => {
  jest.restoreAllMocks();
  doc.cookie = '';
});

test('CSRF header on POST only, with credentials', async () => {
  doc.cookie = 'a=1; can_csrf=tok123';
  const spy = jest.spyOn(globalThis, 'fetch').mockImplementation(async () => json(200, {}));
  await post();
  await get();
  const [p, g] = spy.mock.calls.map((c) => c[0] as Request);
  expect(p.headers.get('X-CAN-CSRF')).toBe('tok123');
  expect(g.headers.get('X-CAN-CSRF')).toBeNull();
  expect(p.credentials).toBe('include');
});

test('envelope parsed with fieldErrors', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(json(400, envelope('validation_failed', { fieldErrors: { 'a.b': 'bad' } })));
  const err = await unwrap(post()).catch((e) => e);
  expect(err).toMatchObject({
    status: 400,
    code: 'validation_failed',
    kind: 'validation',
    fieldErrors: { 'a.b': 'bad' },
  });
});

test('401 session_expired emits once per response', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => json(401, envelope('session_expired')));
  const handler = jest.fn();
  const off = sessionEvents.subscribe(handler);
  const err = await unwrap(get()).catch((e) => e);
  expect(handler).toHaveBeenCalledTimes(1);
  expect(err.kind).toBe('session_expired');
  off();
  await get();
  expect(handler).toHaveBeenCalledTimes(1);
});

test('401 unauthenticated does not emit', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(json(401, envelope('unauthenticated')));
  const handler = jest.fn();
  const off = sessionEvents.subscribe(handler);
  const err = await unwrap(get()).catch((e) => e);
  off();
  expect(handler).not.toHaveBeenCalled();
  expect(err.kind).toBe('unauthenticated');
});

test('network failure becomes offline', async () => {
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
  expect(await unwrap(get()).catch((e) => e)).toMatchObject({ kind: 'offline', status: 0 });
});

test.each([
  [429, 'rate_limited', 'rate_limited'],
  [403, 'not_permitted', 'not_permitted'],
  [404, 'not_found', 'not_found'],
  [409, 'conflict', 'validation'],
  [500, 'internal', 'server'],
  [503, 'policy_unavailable', 'server'],
])('%i %s maps to kind %s', async (status, code, kind) => {
  const res = await parseApiError(json(status, envelope(code)));
  expect(res).toMatchObject({ status, code, kind });
});

test('no envelope (proxy 502) is server/unknown', async () => {
  const res = await parseApiError(new Response('<html>Bad Gateway</html>', { status: 502 }));
  expect(res).toMatchObject({ status: 502, code: 'unknown', kind: 'server' });
});

test('unwrap returns data on success', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(json(200, { status: 'ok' }));
  expect(await unwrap(get())).toEqual({ status: 'ok' });
});
