import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { sessionEvents } from '../src/api/session-events';
import { TextField } from '../src/components/civic';
import { I18nProvider } from '../src/i18n';
import { useSession } from '../src/navigation/SessionContext';
import { useRequireAuth } from '../src/session/RequireAuth';
import { safeReturnTo } from '../src/session/returnTo';
import { SessionExpiredSheet } from '../src/session/SessionExpiredSheet';
import { SessionProvider, useSessionActions } from '../src/session/SessionProvider';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  usePathname: () => '/report/new',
  useRouter: () => ({ replace: mockReplace, push: mockPush }),
}));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let calls: string[] = [];
function mockFetch(me: () => Response) {
  calls = [];
  globalThis.fetch = jest.fn(async (req: Request) => {
    calls.push(`${req.method} ${new URL(req.url).pathname}`);
    return new URL(req.url).pathname === '/v1/auth/logout'
      ? new Response(null, { status: 204 })
      : me();
  }) as never;
}

let mockActions: ReturnType<typeof useSessionActions>;
function Probe() {
  const s = useSession();
  mockActions = useSessionActions();
  const ok = useRequireAuth();
  return (
    <Text>
      {s.status}:{s.handle ?? '-'}:{String(ok)}
    </Text>
  );
}

async function mount(extra?: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const r = await render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <SessionProvider>
          <Probe />
          {extra}
        </SessionProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
  return { qc, r };
}

beforeEach(() => {
  mockReplace.mockClear();
  mockPush.mockClear();
});

test('boots as guest on 401 and routes to sign-in with returnTo', async () => {
  mockFetch(() => json(401, { error: { code: 'unauthenticated', message: 'no' } }));
  const { r } = await mount();
  expect(await screen.findByText('guest:-:false')).toBeTruthy();
  await waitFor(() =>
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/sign-in',
      params: { returnTo: '/report/new' },
    }),
  );
  await r.unmount();
});

test('boots as member and does not redirect', async () => {
  mockFetch(() => json(200, { handle: 'quiet-heron-12', role: 'member' }));
  const { r } = await mount();
  expect(await screen.findByText('member:quiet-heron-12:true')).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
  await r.unmount();
});

test('session_expired shows the sheet over the screen and typed input stays', async () => {
  mockFetch(() => json(200, { handle: 'quiet-heron-12', role: 'member' }));
  const { r } = await mount(
    <>
      <TextField label="Notes" value="half written" onChangeText={() => {}} />
      <SessionExpiredSheet />
    </>,
  );
  await screen.findByText('member:quiet-heron-12:true');
  expect(screen.queryByText('You were signed out')).toBeNull();
  await act(async () => sessionEvents.emitExpired());
  expect(await screen.findByText('You were signed out')).toBeTruthy();
  expect(screen.getByDisplayValue('half written')).toBeTruthy();
  expect(mockReplace).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByLabelText('Sign in again'));
  expect(mockPush).toHaveBeenCalledWith({
    pathname: '/sign-in',
    params: { returnTo: '/report/new' },
  });
  await r.unmount();
});

test('returnTo rejects absolute and protocol-relative URLs', () => {
  expect(safeReturnTo('/report/new?x=1')).toBe('/report/new?x=1');
  for (const bad of ['https://evil.test', '//evil.test', '/\\evil.test', 'javascript:1', '', 5])
    expect(safeReturnTo(bad)).toBe('/');
});

test('logout posts, then clears the cache and the session', async () => {
  mockFetch(() => json(200, { handle: 'quiet-heron-12', role: 'member' }));
  const { qc, r } = await mount();
  await screen.findByText('member:quiet-heron-12:true');
  qc.setQueryData(['problems'], [1]);
  await act(async () => mockActions.clear());
  expect(calls).toContain('POST /v1/auth/logout');
  expect(qc.getQueryData(['problems'])).toBeUndefined();
  expect(await screen.findByText(/^guest:-/)).toBeTruthy();
  await r.unmount();
});
