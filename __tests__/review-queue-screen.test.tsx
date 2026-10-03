import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  usePathname: () => '/review/problems',
  useRouter: () => ({ replace: jest.fn(), push: mockPush }),
}));
jest.mock('../src/navigation/SessionContext', () => ({
  useSession: () => ({ status: 'member', handle: 'ann', roles: ['member'] }),
}));

import ReviewProblemsRoute from '../app/review/problems';
import { I18nProvider } from '../src/i18n';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const err = (status: number, code: string) => json(status, { error: { code, message: 'x' } });
const item = (over = {}) => ({
  problemId: 'p1',
  coarseArea: 'Amsterdam',
  title: 'Secret title of Jan de Vries',
  stageCount: 4,
  sourceCount: 1,
  mine: 'new',
  ...over,
});

let optedIn: boolean;
let items: unknown[];
let queueRes: () => Response;
let calls: string[];

beforeEach(() => {
  mockPush.mockClear();
  optedIn = true;
  items = [item(), item({ problemId: 'p2', coarseArea: null, mine: 'finished', sourceCount: 0 })];
  queueRes = () => json(200, { items });
  calls = [];
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (r) => {
    const req = r as Request;
    const path = new URL(req.url).pathname;
    calls.push(`${req.method} ${path}`);
    if (path === '/v1/me/review-opt-in') {
      if (req.method === 'POST') optedIn = true;
      if (req.method === 'DELETE') optedIn = false;
      return json(200, { optedIn, since: optedIn ? '2026-10-03T10:00:00Z' : null });
    }
    return queueRes();
  });
});
afterEach(() => jest.restoreAllMocks());

async function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <ReviewProblemsRoute />
      </I18nProvider>
    </QueryClientProvider>,
  );
  return qc;
}

describe('volunteer review queue', () => {
  it('lists place and structure only, never titles or handles', async () => {
    await setup();
    expect(await screen.findByText('Amsterdam, 4 stages, 1 source')).toBeTruthy();
    expect(screen.getByText('No place given, 4 stages, no sources')).toBeTruthy();
    expect(screen.getByText('You finished this one')).toBeTruthy();
    expect(screen.queryByText(/Secret title|Jan de Vries/)).toBeNull();
    expect(screen.queryByText(/ann/)).toBeNull();
    expect(screen.getByText(/Personal details are hidden/)).toBeTruthy();
  });

  it('opens the review screen for an item', async () => {
    await setup();
    fireEvent.press(await screen.findByLabelText('Review this problem: Amsterdam'));
    expect(mockPush).toHaveBeenCalledWith('/review/problems/p1');
  });

  it('shows the empty state', async () => {
    items = [];
    await setup();
    expect(await screen.findByText('Nothing to review right now.')).toBeTruthy();
  });

  it('opts in at once, announces it and loads the queue', async () => {
    optedIn = false;
    await setup();
    expect(await screen.findByText('Review as a volunteer')).toBeTruthy();
    expect(calls).not.toContain('GET /v1/review/queue');
    fireEvent.press(screen.getByLabelText('Turn on volunteer review'));
    expect(await screen.findByText('Volunteer review is on.')).toBeTruthy();
    expect(await screen.findByText('Amsterdam, 4 stages, 1 source')).toBeTruthy();
    expect(calls).toContain('POST /v1/me/review-opt-in');
  });

  it('opts out at once and hides the queue', async () => {
    await setup();
    fireEvent.press(await screen.findByLabelText('Turn off volunteer review'));
    expect(await screen.findByText(/Volunteer review is off/)).toBeTruthy();
    expect(screen.queryByText('Amsterdam, 4 stages, 1 source')).toBeNull();
    expect(screen.getByLabelText('Turn on volunteer review')).toBeTruthy();
    expect(calls).toContain('DELETE /v1/me/review-opt-in');
  });

  it('shows a calm error with retry, then recovers', async () => {
    queueRes = () => err(500, 'internal');
    await setup();
    expect(await screen.findByText(/Something went wrong/)).toBeTruthy();
    queueRes = () => json(200, { items });
    fireEvent.press(screen.getByLabelText('Try again'));
    expect(await screen.findByText('Amsterdam, 4 stages, 1 source')).toBeTruthy();
  });

  it('says rate limited and not permitted in plain words', async () => {
    queueRes = () => err(429, 'rate_limited');
    await setup();
    expect(await screen.findByText(/too many requests/)).toBeTruthy();
  });

  it('not permitted on the queue', async () => {
    queueRes = () => err(403, 'not_permitted');
    await setup();
    expect(await screen.findByText(/not available to this account/)).toBeTruthy();
  });

  it('offline', async () => {
    queueRes = () => {
      throw new TypeError('Network request failed');
    };
    await setup();
    await waitFor(() => expect(screen.getByText(/You are offline/)).toBeTruthy());
  });
});
