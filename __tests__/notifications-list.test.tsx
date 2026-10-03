import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

import { AREAS } from '../src/navigation/areas';
import { SessionContext, type Session } from '../src/navigation/SessionContext';
import { I18nProvider } from '../src/i18n';
import { NotificationsScreen } from '../src/notifications/NotificationsScreen';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const note = (id: string, read: boolean) => ({
  id,
  kind: 'stage_changed',
  label: `Stage changed ${id}`,
  problemId: 'p1',
  problemTitle: 'Dirty canal',
  read,
  createdAt: '2026-02-02T12:00:00Z',
});

let items: ReturnType<typeof note>[];
let calls: string[];
beforeEach(() => {
  items = [note('n1', false), note('n2', true)];
  calls = [];
  mockPush.mockReset();
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const req = input as Request;
    const path = new URL(req.url).pathname;
    if (req.method !== 'GET') calls.push(`${req.method} ${path}`);
    if (path === '/v1/me/notifications') return json(200, { items, nextCursor: null });
    if (path === '/v1/me/follows') return json(200, { items: [] });
    items = items.map((n) =>
      path.endsWith('read-all') || path.includes(`/${n.id}/`) ? { ...n, read: true } : n,
    );
    return new Response(null, { status: 204 });
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
          <NotificationsScreen />
        </SessionContext.Provider>
      </I18nProvider>
    </QueryClientProvider>,
  );

test('lists updates in server order with plain read state and a link to the problem', async () => {
  await go();
  expect(await screen.findByText('Stage changed n1')).toBeTruthy();
  expect(screen.getAllByTestId('update-item')).toHaveLength(2);
  expect(screen.getByText('Not read yet')).toBeTruthy();
  expect(screen.getByText('Read')).toBeTruthy();
  await fireEvent.press(screen.getAllByLabelText('Open problem: Dirty canal')[0]);
  expect(mockPush).toHaveBeenCalledWith('/problems/p1');
});

test('mark one and mark all as read', async () => {
  await go();
  await fireEvent.press(await screen.findByLabelText('Mark as read: Dirty canal'));
  await waitFor(() => expect(calls).toContain('POST /v1/me/notifications/n1/read'));
  await waitFor(() => expect(screen.queryByLabelText('Mark as read: Dirty canal')).toBeNull());
  await fireEvent.press(screen.getByLabelText('Mark all as read'));
  await waitFor(() => expect(calls).toContain('POST /v1/me/notifications/read-all'));
  await waitFor(() => expect(screen.queryAllByText('Not read yet')).toHaveLength(0));
});

test('empty state is calm', async () => {
  items = [];
  await go();
  expect(await screen.findByText(/No updates yet/)).toBeTruthy();
  expect(screen.queryByLabelText('Mark all as read')).toBeNull();
});

test('guest gets a sign-in prompt', async () => {
  await go({ status: 'guest' });
  expect(screen.getByLabelText('Sign in to follow')).toBeTruthy();
  expect(screen.queryByTestId('update-item')).toBeNull();
});

test('no numeric badge anywhere: nav labels carry no digits and the list shows no counts', async () => {
  await go();
  await screen.findByText('Stage changed n1');
  expect(AREAS.every((a) => a.href !== '/me/notifications')).toBe(true);
  expect(screen.queryByText(/^\d+$/)).toBeNull();
  expect(screen.queryByText(/unread|\(\d+\)/i)).toBeNull();
});
