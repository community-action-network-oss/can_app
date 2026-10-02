import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockSetParams = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: {
    push: (...a: unknown[]) => mockPush(...a),
    setParams: (p: unknown) => mockSetParams(p),
  },
  useLocalSearchParams: () => mockParams,
}));

import Home from '../app/index';
import { I18nProvider } from '../src/i18n';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const prob = (id: string, o: object = {}) => ({
  id,
  title: `Problem ${id}`,
  coarseArea: 'Centrum',
  help_needed: {},
  investigationNeeded: false,
  isSeed: false,
  jurisdiction: 'Amsterdam',
  label: 'Open: gathering facts',
  policyVersion: null,
  publishedAt: '2026-01-01T00:00:00Z',
  reopened: false,
  state: 'gathering',
  syntheticEvidence: false,
  transitional: false,
  ...o,
});
const page = (items: unknown[], nextCursor: string | null = null, uses = false) => ({
  items,
  nextCursor,
  criteria: { order: 'published_at_desc', usesEngagementSignals: uses },
});

let routes: (url: URL) => Response | Promise<Response>;
const urls: URL[] = [];
beforeEach(() => {
  urls.length = 0;
  mockParams = {};
  routes = (u) =>
    u.pathname === '/health'
      ? json(200, { status: 'ok', db: 'ok' })
      : u.pathname === '/v1/jurisdictions'
        ? json(200, {
            items: [
              {
                id: 'ams',
                name: 'Amsterdam',
                kind: 'city',
                isFictional: false,
                emergencyNotice: null,
              },
            ],
          })
        : json(200, page([prob('a')]));
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (req) => {
    const u = new URL((req as Request).url);
    urls.push(u);
    return routes(u);
  });
});
afterEach(() => jest.restoreAllMocks());

const renderHome = async () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
    >
      <I18nProvider>
        <Home />
      </I18nProvider>
    </QueryClientProvider>,
  );
const problemUrls = () => urls.filter((u) => u.pathname === '/v1/problems');

test('first page with label text, order disclosure, policy text, seed and flags; no counts', async () => {
  routes = (u) =>
    u.pathname === '/v1/problems'
      ? json(
          200,
          page([
            prob('a', {
              isSeed: true,
              investigationNeeded: true,
              policyVersion: 'v2',
              reopened: true,
            }),
            prob('b', { title: '' }),
          ]),
        )
      : json(200, { items: [] });
  await renderHome();
  expect(await screen.findByText('Problem a')).toBeTruthy();
  expect(screen.getByText('Sorted by date published. Engagement is not used.')).toBeTruthy();
  expect(screen.getAllByText(/◆ Open: gathering facts/)).toHaveLength(2);
  expect(screen.getByText('Seed problem, synthetic evidence')).toBeTruthy();
  expect(screen.getByText(/Needs investigation/)).toBeTruthy();
  expect(screen.getByText('Reopened under policy v2')).toBeTruthy();
  expect(screen.getByText('Untitled problem')).toBeTruthy();
  expect(screen.queryByText(/contribution|likes|trending/i)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Open: Problem a'));
  expect(mockPush).toHaveBeenCalledWith('/problems/a');
  // existing entries stay reachable
  expect(screen.getByLabelText('Set up my profile')).toBeTruthy();
  expect(screen.getByLabelText('Problems you can move')).toBeTruthy();
});

test('engagement ordering is never claimed away', async () => {
  routes = (u) =>
    u.pathname === '/v1/problems'
      ? json(200, page([prob('a')], null, true))
      : json(200, { items: [] });
  await renderHome();
  expect(await screen.findByText('Problem a')).toBeTruthy();
  expect(screen.queryByText(/Engagement is not used/)).toBeNull();
});

test('load more appends with the cursor', async () => {
  routes = (u) =>
    u.pathname === '/v1/problems'
      ? json(200, u.searchParams.get('cursor') ? page([prob('b')]) : page([prob('a')], 'c1'))
      : json(200, { items: [] });
  await renderHome();
  await fireEvent.press(await screen.findByLabelText('Load more'));
  expect(await screen.findByText('Problem b')).toBeTruthy();
  expect(screen.getByText('Problem a')).toBeTruthy();
  expect(problemUrls()[1].searchParams.get('cursor')).toBe('c1');
});

test('filters come from the URL, changes write the URL and refetch', async () => {
  mockParams = { q: 'noise', jurisdictionId: 'ams' };
  await renderHome();
  await screen.findByText('Problem a');
  const u = problemUrls()[0];
  expect(u.searchParams.get('q')).toBe('noise');
  expect(u.searchParams.get('jurisdictionId')).toBe('ams');
  await fireEvent.press(await screen.findByLabelText('Open: gathering facts'));
  expect(mockSetParams).toHaveBeenLastCalledWith({
    q: 'noise',
    state: 'gathering',
    jurisdictionId: 'ams',
  });
  await fireEvent.press(screen.getByLabelText('Clear filters'));
  expect(mockSetParams).toHaveBeenLastCalledWith({
    q: undefined,
    state: undefined,
    jurisdictionId: undefined,
  });
});

test('empty and filtered-empty give a next action', async () => {
  routes = (u) => (u.pathname === '/v1/problems' ? json(200, page([])) : json(200, { items: [] }));
  await renderHome();
  expect(await screen.findByText('No problems here yet')).toBeTruthy();
  expect(screen.getByLabelText('Report a public problem')).toBeTruthy();
  await screen.unmount();
  mockParams = { q: 'zzz' };
  await renderHome();
  expect(await screen.findByText(/Nothing matches these filters/)).toBeTruthy();
  expect(screen.getByLabelText('Clear filters')).toBeTruthy();
});

test('error keeps filters and retry recovers', async () => {
  mockParams = { q: 'zzz' };
  let fail = true;
  routes = (u) =>
    u.pathname === '/v1/problems'
      ? fail
        ? json(500, { error: { code: 'internal', message: 'x' } })
        : json(200, page([prob('a')]))
      : json(200, { items: [] });
  await renderHome();
  expect(await screen.findByText(/could not be loaded. Your filters are kept/)).toBeTruthy();
  fail = false;
  await fireEvent.press(screen.getAllByLabelText('Try again')[0]);
  expect(await screen.findByText('Problem a')).toBeTruthy();
  expect(problemUrls().at(-1)?.searchParams.get('q')).toBe('zzz');
});

test('offline after load: banner and cached items stay', async () => {
  routes = (u) =>
    u.pathname === '/v1/problems' ? json(200, page([prob('a')], 'c1')) : json(200, { items: [] });
  await renderHome();
  const more = await screen.findByLabelText('Load more');
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network'));
  await fireEvent.press(more);
  expect(await screen.findByText(/You are offline/)).toBeTruthy();
  expect(screen.getByText('Problem a')).toBeTruthy();
});
