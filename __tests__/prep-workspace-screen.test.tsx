import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  useLocalSearchParams: () => ({ id: 'p1' }),
  usePathname: () => '/me/problems/p1',
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('../src/navigation/SessionContext', () => ({
  useSession: () => ({ status: 'member' }),
}));

import PrepRoute from '../app/me/problems/[id]/index';
import { I18nProvider } from '../src/i18n';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const part = (status: string, reason: string | null = null, flags: unknown[] = []) => ({
  status,
  reason,
  fieldErrors: {},
  flags,
});
let state = 'draft';
let parts: Record<string, ReturnType<typeof part>>;
let sent: unknown;
let patched: unknown;

beforeEach(() => {
  state = 'draft';
  sent = undefined;
  patched = undefined;
  parts = {
    facts: part('ready'),
    sources: part('not_finished', 'missing'),
    criteria: part('ready'),
    stages: part('ready', 'default_plan'),
  };
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (r) => {
    const req = r as Request;
    const u = new URL(req.url);
    if (u.pathname.endsWith('/preparation'))
      return json(200, { id: 'p1', state, version: 3, ready: false, ...parts });
    if (u.pathname.endsWith('/transitions')) {
      sent = await req.json();
      state = 'in_review';
      return json(200, {
        id: 'p1',
        state,
        label: 'In volunteer review',
        version: 4,
        pending: null,
      });
    }
    if (u.pathname.endsWith('/preview'))
      return json(200, { public: {}, explanationIds: [], handle: 'ana', timings: {} });
    if (u.pathname.endsWith('/checks'))
      return json(200, {
        checkId: 'c',
        ok: true,
        emergency: false,
        languageLabel: null,
        repostMatch: false,
        flags: [],
      });
    if (u.pathname.startsWith('/v1/content-schemas'))
      return json(200, {
        schema: { type: 'object', properties: {} },
        schema_id: 'problem',
        schema_version: '1',
        schema_hash: 'h',
        policy_version: 'p',
        messages: {},
      });
    if (req.method === 'PATCH') {
      patched = await req.json();
      return json(200, {
        id: 'p1',
        state,
        version: 4,
        updatedAt: 'x',
        schemaId: 'problem',
        schemaVersion: '1',
        schemaHash: 'h',
      });
    }
    return json(200, {
      id: 'p1',
      state,
      version: 3,
      updatedAt: 'x',
      schemaId: 'problem',
      schemaVersion: '1',
      schemaHash: 'h',
      content: {
        sources: [{ uri: 'https://blog.example/post', category: 'other', establishes: 'x' }],
      },
    });
  });
});
afterEach(() => jest.restoreAllMocks());

const open = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
    >
      <I18nProvider>
        <PrepRoute />
      </I18nProvider>
    </QueryClientProvider>,
  );

it('shows text status and progress from the API, trust hint, and disables send', async () => {
  await open();
  expect(await screen.findByText('3 of 4 parts ready')).toBeTruthy();
  expect(screen.getAllByText('Not finished')).toHaveLength(1);
  expect(screen.getAllByText('Ready')).toHaveLength(3);
  expect(await screen.findByText('△ Not verified')).toBeTruthy();
  expect(screen.getByText('Before you send, finish: Trusted sources')).toBeTruthy();
  expect(screen.getByLabelText('Send to volunteer review').props.accessibilityState.disabled).toBe(
    true,
  );
  await fireEvent.press(screen.getByLabelText('Edit: When it is solved'));
  expect(mockPush).toHaveBeenCalledWith('/me/problems/p1/criteria');
});

it('saves a no-source note with the version it last saw', async () => {
  await open();
  await fireEvent.changeText(
    await screen.findByLabelText('I do not have a source yet'),
    'None yet',
  );
  await fireEvent.press(screen.getByLabelText('Save this note'));
  await waitFor(() => expect(patched).toEqual({ noSourceNote: 'None yet', expectedVersion: 3 }));
});

it('previews, sends through T01, then shows in review without implying a person looked', async () => {
  parts.sources = part('ready', 'needs_evidence');
  await open();
  expect(await screen.findByText('Needs evidence')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Send to volunteer review'));
  expect(await screen.findByText('This is exactly what people would see')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Send now'));
  await waitFor(() => expect(sent).toEqual({ to: 'in_review', expectedVersion: 3 }));
  expect(await screen.findByText('In volunteer review')).toBeTruthy();
  expect(screen.getByText(/No person has looked at this/)).toBeTruthy();
  expect(screen.queryByLabelText('Send to volunteer review')).toBeNull();
});
