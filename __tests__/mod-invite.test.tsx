import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

let mockRoles: string[] = ['moderator'];
jest.mock('expo-router', () => ({
  usePathname: () => '/review/invites',
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('../src/navigation/SessionContext', () => ({
  useSession: () => ({ status: 'member', roles: mockRoles }),
}));

import InvitesRoute from '../app/review/invites';
import { I18nProvider } from '../src/i18n';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const CODE = 'ABCD-EFGH-JKMN-PQRS';
const row = { id: 'i1', issuedAt: '2026-10-01T10:00:00Z', expiresAt: '2026-10-15T10:00:00Z' };

let rows: unknown[];
let listStatus: number;
let postStatus: number;
let posted: unknown;
let gets: number;

beforeEach(() => {
  rows = [{ ...row, redeemed: false }];
  listStatus = 200;
  postStatus = 201;
  posted = undefined;
  gets = 0;
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (r) => {
    const req = r as Request;
    if (req.method === 'POST') {
      posted = await req.json();
      return postStatus === 201
        ? json(201, { code: CODE, expiresAt: '2026-10-17T10:00:00Z' })
        : json(429, { error: { code: 'rate_limited', message: 'no' } });
    }
    gets += 1;
    return listStatus === 200
      ? json(200, rows)
      : json(500, { error: { code: 'internal', message: 'no' } });
  });
});
afterEach(() => jest.restoreAllMocks());

async function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const ui = (
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <InvitesRoute />
      </I18nProvider>
    </QueryClientProvider>
  );
  return { qc, ...(await render(ui)), ui };
}

const issue = async () => {
  fireEvent.press(await screen.findByLabelText('Create code'));
  return screen.findByTestId('invite-code');
};

describe('steward invite screen', () => {
  it('lists invites without codes and issues one with the chosen days', async () => {
    await setup();
    expect(await screen.findByText(/Not used yet/)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Days until it expires'), '7');
    const code = await issue();
    expect(code.props.children).toBe(CODE);
    expect(posted).toEqual({ expiresInDays: 7 });
    expect(screen.getByText(/shown once/)).toBeTruthy();
    expect(screen.getByText(/exactly as shown/)).toBeTruthy();
    expect(code.props.selectable).toBe(true);
    await waitFor(() => expect(gets).toBe(2));
  });

  it('admins may issue too', async () => {
    mockRoles = ['admin'];
    await setup();
    expect(await screen.findByLabelText('Create code')).toBeTruthy();
    mockRoles = ['moderator'];
  });

  it('the steward role from /v1/me/roles may issue too', async () => {
    mockRoles = ['member', 'steward'];
    await setup();
    expect(await screen.findByLabelText('Create code')).toBeTruthy();
    mockRoles = ['moderator'];
  });

  it('shows the code once: not in the query or mutation cache, gone after Done', async () => {
    const { qc } = await setup();
    await issue();
    const dump = JSON.stringify([
      qc
        .getQueryCache()
        .getAll()
        .map((q) => q.state.data),
      qc
        .getMutationCache()
        .getAll()
        .map((m) => m.state),
    ]);
    expect(dump).not.toContain(CODE);
    await fireEvent.press(screen.getByLabelText('I have saved the code'));
    await waitFor(() => expect(screen.queryByTestId('invite-code')).toBeNull());
  });

  it('rejects days outside 1 to 30 without calling the server', async () => {
    await setup();
    const input = await screen.findByLabelText('Days until it expires');
    fireEvent.changeText(input, '31');
    expect(await screen.findByText('Enter a whole number from 1 to 30.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Create code'));
    expect(posted).toBeUndefined();
  });

  it('says so when the daily limit is reached', async () => {
    postStatus = 429;
    await setup();
    fireEvent.press(await screen.findByLabelText('Create code'));
    expect(await screen.findByText(/most invites allowed for today/)).toBeTruthy();
  });

  it('shows the empty state', async () => {
    rows = [];
    await setup();
    expect(await screen.findByText('You have not issued any invites yet.')).toBeTruthy();
  });

  it('shows an error with retry when the list fails', async () => {
    listStatus = 500;
    await setup();
    expect(await screen.findByLabelText('Try again')).toBeTruthy();
  });

  it('has no queue or appeals tabs', async () => {
    await setup();
    await screen.findByLabelText('Create code');
    expect(screen.queryByText(/queue|appeal/i)).toBeNull();
  });
});

describe('member', () => {
  it('is not permitted and the list is never requested', async () => {
    mockRoles = ['member'];
    await setup();
    expect(await screen.findByText('Only stewards and admins can issue invites.')).toBeTruthy();
    expect(gets).toBe(0);
    expect(screen.queryByLabelText('Create code')).toBeNull();
    mockRoles = ['moderator'];
  });
});
