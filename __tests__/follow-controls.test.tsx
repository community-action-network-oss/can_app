import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
}));

import { SessionContext, type Session } from '../src/navigation/SessionContext';
import { FollowControl } from '../src/follow/FollowControl';
import { I18nProvider } from '../src/i18n';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const fol = (o: object = {}) => ({
  problemId: 'p1',
  title: 'Dirty canal',
  followedAt: '2026-01-01T00:00:00Z',
  emailUpdates: false,
  muted: false,
  ...o,
});

let follows: object[];
let calls: { method: string; path: string; body?: unknown }[];
beforeEach(() => {
  follows = [];
  calls = [];
  mockPush.mockReset();
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const req = input as Request;
    const path = new URL(req.url).pathname;
    const body =
      req.method === 'POST'
        ? await req
            .clone()
            .json()
            .catch(() => undefined)
        : undefined;
    if (req.method !== 'GET') calls.push({ method: req.method, path, body });
    if (path === '/v1/me/follows') return json(200, { items: follows });
    if (req.method === 'DELETE') {
      if (!path.includes('email-consent')) follows = [];
      return new Response(null, { status: 204 });
    }
    if (path === '/v1/follows') {
      follows = [fol({ emailUpdates: body.emailUpdates })];
      return json(201, follows[0]);
    }
    follows = [fol({ muted: path.endsWith('/mute') })];
    return json(200, follows[0]);
  });
});
afterEach(() => jest.restoreAllMocks());

const go = async (s: Session = { status: 'member' }) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
    >
      <I18nProvider>
        <SessionContext.Provider value={s}>
          <FollowControl problemId="p1" />
        </SessionContext.Provider>
      </I18nProvider>
    </QueryClientProvider>,
  );

test('guest sees a sign-in prompt and no controls', async () => {
  await go({ status: 'guest' });
  expect(screen.queryByLabelText('Mute')).toBeNull();
  expect(screen.queryByLabelText('Also email me updates')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Sign in to follow'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/sign-in',
    params: { returnTo: '/problems/p1' },
  });
});

test('nothing is preselected and the consent sentence shows before opting in', async () => {
  await go();
  expect(await screen.findByText(/We email you only about this problem/)).toBeTruthy();
  expect(screen.getByLabelText('Also email me updates').props.accessibilityState.checked).toBe(
    false,
  );
  expect(calls).toHaveLength(0);
  await fireEvent.press(screen.getByLabelText('Follow this problem'));
  expect(await screen.findByText('You follow this problem.')).toBeTruthy();
  expect(calls[0]).toEqual({
    method: 'POST',
    path: '/v1/follows',
    body: { problemId: 'p1', emailUpdates: false },
  });
});

test('email is a separate opt-in sent with the follow', async () => {
  await go();
  await fireEvent.press(await screen.findByLabelText('Also email me updates'));
  await fireEvent.press(screen.getByLabelText('Follow this problem'));
  await screen.findByText('You follow this problem.');
  expect(calls[0].body).toEqual({ problemId: 'p1', emailUpdates: true });
  expect(screen.getByLabelText('Stop all emails')).toBeTruthy();
});

test('mute, unmute and unfollow call the server', async () => {
  follows = [fol()];
  await go();
  await fireEvent.press(await screen.findByLabelText('Mute'));
  expect(await screen.findByText(/it is muted/)).toBeTruthy();
  expect(calls.at(-1)?.path).toBe('/v1/follows/p1/mute');
  await fireEvent.press(screen.getByLabelText('Unmute'));
  await screen.findByText('You follow this problem.');
  expect(calls.at(-1)?.path).toBe('/v1/follows/p1/unmute');
  await fireEvent.press(screen.getByLabelText('Unfollow'));
  expect(await screen.findByLabelText('Follow this problem')).toBeTruthy();
  expect(calls.at(-1)).toMatchObject({ method: 'DELETE', path: '/v1/follows/p1' });
});

test('stop all emails withdraws consent and keeps the follow', async () => {
  follows = [fol({ emailUpdates: true })];
  await go();
  await fireEvent.press(await screen.findByLabelText('Stop all emails'));
  expect(calls[0]).toMatchObject({ method: 'DELETE', path: '/v1/me/follows/email-consent' });
});

test('offline says so and changes nothing', async () => {
  await go();
  await screen.findByLabelText('Follow this problem');
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network'));
  await fireEvent.press(screen.getByLabelText('Follow this problem'));
  expect(await screen.findByText(/You are offline/)).toBeTruthy();
});
