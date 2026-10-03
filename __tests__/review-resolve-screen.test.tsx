import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'p1' }),
  usePathname: () => '/me/problems/p1/review',
  useRouter: () => ({ replace: jest.fn(), push: mockPush }),
  router: { push: jest.fn(), replace: jest.fn() },
}));
jest.mock('../src/navigation/SessionContext', () => ({
  useSession: () => ({ status: 'member', handle: 'ann', roles: ['member'] }),
}));

import ResolveRoute from '../app/me/problems/[id]/review';
import { I18nProvider } from '../src/i18n';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let status: Record<string, unknown>;
let items: Record<string, unknown>[];
let posts: { path: string; body: unknown }[];
let resolveRes: () => Response;
let listRes: (() => Response) | undefined;

const rec = (o: Record<string, unknown> = {}) => ({
  id: 'r1',
  openedAt: 'x',
  path: 'condition',
  reason: 'Too vague',
  recommendation: 'Say which street',
  resolutionReason: null,
  status: 'open',
  changedSince: false,
  volunteer: 'Volunteer 1',
  ...o,
});

beforeEach(() => {
  posts = [];
  mockPush.mockClear();
  listRes = undefined;
  status = {
    canRequestPublication: false,
    dayCount: 3,
    needsReviewers: false,
    openRecommendations: 1,
    quorumMet: false,
    reviewCount: 1,
  };
  items = [rec(), rec({ id: 'r2', status: 'declined', resolutionReason: 'Already covered' })];
  resolveRes = () => json(200, { id: 'r1', status: 'accepted', resolutionReason: 'ok' });
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (r) => {
    const req = r as Request;
    const path = new URL(req.url).pathname;
    if (req.method === 'POST') {
      posts.push({ path, body: await req.json().catch(() => null) });
      if (path.endsWith('/resolve')) return resolveRes();
      if (path.endsWith('/request-publication')) return json(200, { requested: true });
      return json(200, {});
    }
    if (path.endsWith('/review-status')) return json(200, status);
    if (path.endsWith('/recommendations')) return listRes ? listRes() : json(200, { items });
    if (path === '/v1/drafts/p1')
      return json(200, {
        id: 'p1',
        state: 'in_review',
        version: 4,
        content: { condition: 'Bins are not emptied' },
      });
    return json(404, { error: { code: 'not_found', message: 'x' } });
  });
});
afterEach(() => jest.restoreAllMocks());

async function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <ResolveRoute />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe('resolve recommendations', () => {
  it('shows status, numbered volunteers, a worded diff and declines with reasons', async () => {
    await setup();
    expect(await screen.findByText('In volunteer review')).toBeTruthy();
    expect(screen.getByText('1 review finished, day 3')).toBeTruthy();
    expect(screen.getByTestId('unresolved')).toBeTruthy();
    expect(screen.getAllByText('Volunteer 1').length).toBe(1);
    expect(screen.getByText('Volunteer 2')).toBeTruthy();
    expect(screen.queryByText(/ann/)).toBeNull();
    expect(screen.getAllByTestId('diff-removed')[0]!.props.children).toBe(
      '- Removed: Bins are not emptied',
    );
    expect(screen.getAllByTestId('diff-added')[0]!.props.children).toBe(
      '+ Added: Say which street',
    );
    expect(screen.getByText('Your reason: Already covered')).toBeTruthy();
  });

  it('asks for a reason before accept or decline and sends nothing without one', async () => {
    await setup();
    await fireEvent.press(await screen.findByLabelText('Accept: condition'));
    expect(await screen.findByText(/A reason is needed/)).toBeTruthy();
    expect(posts).toHaveLength(0);
  });

  it('records an accept with its reason', async () => {
    await setup();
    await fireEvent.changeText(await screen.findByLabelText('Your reason'), 'Good point');
    await fireEvent.press(screen.getByLabelText('Accept: condition'));
    await screen.findByText('In volunteer review');
    expect(posts[0]).toEqual({
      path: '/v1/recommendations/r1/resolve',
      body: { decision: 'accept', reason: 'Good point' },
    });
  });

  it('shows the reason message when the server refuses a short reason', async () => {
    resolveRes = () => json(400, { error: { code: 'validation_failed', message: 'x' } });
    await setup();
    await fireEvent.changeText(await screen.findByLabelText('Your reason'), 'no');
    await fireEvent.press(screen.getByLabelText('Decline: condition'));
    expect(await screen.findByText(/A reason is needed/)).toBeTruthy();
  });

  it('keeps the publish button off until the server flag allows it, then records the request', async () => {
    await setup();
    const btn = await screen.findByLabelText('Ask for the publication check');
    expect(btn.props.accessibilityState?.disabled ?? btn.props['aria-disabled']).toBeTruthy();
    expect(screen.getByTestId('publish-why')).toBeTruthy();
    expect(posts).toHaveLength(0);
  });

  it('enables publish from the flag and says the request is recorded, not published', async () => {
    status = { ...status, canRequestPublication: true };
    await setup();
    await fireEvent.press(await screen.findByLabelText('Ask for the publication check'));
    expect(await screen.findByText(/not public yet/)).toBeTruthy();
    expect(posts[0]!.path).toBe('/v1/me/problems/p1/request-publication');
  });

  it('calls for reviewers and shows the empty state', async () => {
    status = { ...status, needsReviewers: true, openRecommendations: 0, reviewCount: 0 };
    items = [];
    await setup();
    expect(await screen.findByTestId('needs-reviewers')).toBeTruthy();
    expect(screen.getByTestId('resolve-empty')).toBeTruthy();
  });

  it('shows the error state with a retry', async () => {
    listRes = () => json(500, { error: { code: 'internal', message: 'x' } });
    await setup();
    expect(await screen.findByLabelText('Try again')).toBeTruthy();
  });

  it('withdraw asks first', async () => {
    await setup();
    await fireEvent.press(await screen.findByLabelText('Withdraw this problem'));
    await fireEvent.press(screen.getByLabelText('Yes, withdraw it'));
    await screen.findByText('In volunteer review').catch(() => undefined);
    expect(posts.some((p) => p.path === '/v1/drafts/p1/transitions')).toBe(true);
  });
});
