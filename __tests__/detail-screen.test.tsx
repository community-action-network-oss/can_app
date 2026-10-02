import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
let mockParams: Record<string, string> = { id: 'p1' };
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  useLocalSearchParams: () => mockParams,
}));

import ProblemScreen from '../app/problems/[id]';
import { I18nProvider } from '../src/i18n';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const detail = (o: object = {}) => ({
  id: 'p1',
  title: 'Dirty canal',
  authorHandle: 'ana',
  condition: 'Litter everywhere',
  affected: 'Residents',
  observed: 'Bags piled up',
  uncertain: 'Who is responsible',
  desiredOutcome: null,
  pauseReason: null,
  resumeCondition: null,
  duplicateOf: null,
  explanation: 'People are gathering facts.',
  nextAction: 'Add a source',
  label: 'Open: gathering facts',
  state: 'gathering',
  investigationNeeded: true,
  isSeed: false,
  syntheticEvidence: false,
  jurisdiction: 'Amsterdam',
  coarseArea: 'Centrum',
  help_needed: {},
  policyVersion: 'v2',
  reopened: false,
  transitional: true,
  reviewCount: 0,
  publishedAt: '2026-01-01T12:00:00Z',
  tombstone: null,
  ...o,
});
const ev = (id: string) => ({
  id,
  type: 'published',
  actor: 'ana',
  fromState: null,
  toState: 'gathering',
  reason: null,
  occurredAt: '2026-01-02T12:00:00Z',
});

let routes: (u: URL) => Response;
beforeEach(() => {
  mockParams = { id: 'p1' };
  routes = (u) =>
    u.pathname.endsWith('/events')
      ? json(200, { items: [ev('e1')], nextCursor: null })
      : json(200, detail());
  jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async (req) => routes(new URL((req as Request).url)));
});
afterEach(() => jest.restoreAllMocks());

const newClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
const go = async (client = newClient()) =>
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <ProblemScreen />
      </I18nProvider>
    </QueryClientProvider>,
  );

test('active problem: label, explanation, shapes, notices, one h1, handle without owner wording', async () => {
  await go();
  expect(await screen.findByText('◆ Open: gathering facts')).toBeTruthy();
  expect(screen.getByText('▲ Needs investigation')).toBeTruthy();
  expect(screen.getByText('People are gathering facts.')).toBeTruthy();
  expect(screen.getByText('Add a source')).toBeTruthy();
  expect(screen.getByText('Decided under policy v2')).toBeTruthy();
  expect(screen.getByText(/Transitional stewardship/)).toBeTruthy();
  expect(screen.getByText('Started by ana in Amsterdam, Centrum')).toBeTruthy();
  expect(screen.getByText('Bags piled up')).toBeTruthy();
  expect(screen.getByText('Who is responsible')).toBeTruthy();
  expect(await screen.findByText('Published')).toBeTruthy();
  expect(screen.queryByText(/initiator|owner|verified/i)).toBeNull();
  expect(screen.getAllByRole('heading').filter((h) => h.props['aria-level'] === 1)).toHaveLength(1);
  await fireEvent.press(screen.getByLabelText('Problems'));
  expect(mockPush).toHaveBeenCalledWith('/');
});

test('tombstone is a calm 200 view without author text', async () => {
  routes = () =>
    json(
      200,
      detail({
        title: null,
        authorHandle: null,
        condition: null,
        tombstone: { tombstone: true, tombstonedAt: '2026-03-03T12:00:00Z', reason: 'Withdrawn' },
      }),
    );
  await go();
  expect(await screen.findByText('This item is no longer shown')).toBeTruthy();
  expect(screen.getByText(/taken out of view on Mar 3, 2026/)).toBeTruthy();
  expect(screen.getByText('Withdrawn')).toBeTruthy();
  expect(screen.queryByText(/Started by|Dirty canal/)).toBeNull();
});

test('404 says not found and links back; no permission wording', async () => {
  routes = () => json(404, { error: { code: 'not_found', message: 'x' } });
  await go();
  expect(await screen.findByText('Not found')).toBeTruthy();
  expect(screen.queryByText(/permission|private/i)).toBeNull();
  expect(screen.getByLabelText('Problems')).toBeTruthy();
});

test('offline with cached data keeps the problem and shows the banner', async () => {
  const client = newClient();
  await go(client);
  await screen.findByText('Dirty canal');
  await screen.unmount();
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network'));
  await go(client);
  expect(await screen.findByText(/You are offline/)).toBeTruthy();
  expect(screen.getByText('Dirty canal')).toBeTruthy();
});

test('offline with nothing cached offers retry and a way back', async () => {
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network'));
  await go();
  expect(await screen.findByText(/You are offline/)).toBeTruthy();
  expect(screen.getByLabelText('Try again')).toBeTruthy();
  expect(screen.getByLabelText('Problems')).toBeTruthy();
});

test('timeline pages with the cursor', async () => {
  const seen: (string | null)[] = [];
  routes = (u) => {
    if (!u.pathname.endsWith('/events')) return json(200, detail());
    const c = u.searchParams.get('cursor');
    seen.push(c);
    return json(
      200,
      c
        ? { items: [{ ...ev('e2'), type: 'solved' }], nextCursor: null }
        : { items: [ev('e1')], nextCursor: 'c1' },
    );
  };
  await go();
  await fireEvent.press(await screen.findByLabelText('Load more'));
  expect(await screen.findByText('Marked solved')).toBeTruthy();
  expect(screen.getByText('Published')).toBeTruthy();
  expect(seen).toEqual([null, 'c1']);
});
