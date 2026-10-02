import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: {
    push: (...a: unknown[]) => mockPush(...a),
    replace: (...a: unknown[]) => mockReplace(...a),
  },
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/sign-up',
  useLocalSearchParams: () => mockParams,
}));

import { CodeEntryScreen } from '../src/auth/CodeEntryScreen';
import { clearPending, getPending, setPending } from '../src/auth/pending';
import { SignUpScreen } from '../src/auth/SignUpScreen';
import { I18nProvider } from '../src/i18n';
import { SessionProvider } from '../src/session/SessionProvider';

const EMAIL = 'ada.lovelace@example.org';
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

let calls: { path: string; body: unknown }[] = [];
let handler: (path: string) => Response | Promise<Response>;
beforeEach(() => {
  calls = [];
  mockPush.mockClear();
  mockReplace.mockClear();
  mockParams = {};
  clearPending();
  handler = (p) =>
    p === '/v1/me' ? json(200, { handle: 'QuietHeron42', role: 'member' }) : json(200, {});
  globalThis.fetch = jest.fn(async (req: Request) => {
    const path = new URL(req.url).pathname;
    calls.push({
      path,
      body:
        req.method === 'POST'
          ? await req
              .clone()
              .json()
              .catch(() => null)
          : null,
    });
    return handler(path);
  }) as never;
});

const show = async (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <SessionProvider>{ui}</SessionProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
};
const fill = async (invite = 'ABCD-EFGH', age = true) => {
  await fireEvent.changeText(screen.getByLabelText('Invite code'), invite);
  await fireEvent.changeText(screen.getByLabelText('Email'), EMAIL);
  if (age) await fireEvent.press(screen.getByLabelText('I am 18 or older'));
  await fireEvent.press(screen.getByLabelText('Send me a code'));
};
const signups = () => calls.filter((c) => c.path === '/v1/auth/signup');

it('shows the empty form with emergency notice and the email promise', async () => {
  await show(<SignUpScreen />);
  expect(screen.getByText('Create your account')).toBeTruthy();
  expect(
    screen.getByText('If someone is in danger, contact your local emergency number.'),
  ).toBeTruthy();
  expect(screen.getByText('Your email is never shown.')).toBeTruthy();
});

it('happy path: sends ageConfirmed, keeps the email in memory only, clears the field, goes to the code screen', async () => {
  await show(<SignUpScreen />);
  await fill();
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/sign-in/code'));
  expect(signups()[0].body).toEqual({ inviteCode: 'ABCD-EFGH', email: EMAIL, ageConfirmed: true });
  expect(mockPush.mock.calls[0]).toEqual(['/sign-in/code']); // no params, no email in the URL
  expect(getPending().email).toBe(EMAIL);
  expect(JSON.stringify(screen.toJSON())).not.toContain(EMAIL);
});

it('blocks submit when the 18+ box is unchecked', async () => {
  await show(<SignUpScreen />);
  await fill('ABCD-EFGH', false);
  await screen.findByText('Please confirm you are 18 or older to go on.');
  expect(signups()).toHaveLength(0);
});

it('invalid invite shows the generic message beside the invite field and keeps input', async () => {
  handler = () => json(400, { error: { code: 'invalid_invite', message: 'x' } });
  await show(<SignUpScreen />);
  await fill();
  await screen.findByText('That invite code did not work. Check it and try again.');
  expect(screen.getByLabelText('Email').props.value).toBe(EMAIL);
  expect(mockPush).not.toHaveBeenCalled();
});

it('rate limited shows the calm text with the wait', async () => {
  handler = () =>
    json(429, { error: { code: 'rate_limited', message: 'x' } }, { 'Retry-After': '600' });
  await show(<SignUpScreen />);
  await fill();
  await screen.findByText('Too many tries. Please wait 10 minutes and try again.');
});

it('offline shows the shared banner and keeps input', async () => {
  globalThis.fetch = jest.fn(async () => {
    throw new TypeError('Network request failed');
  }) as never;
  await show(<SignUpScreen />);
  await fill();
  await screen.findByText(/You are offline/);
  expect(screen.getByLabelText('Invite code').props.value).toBe('ABCD-EFGH');
});

describe('code entry', () => {
  it('without a pending email offers to start again', async () => {
    await show(<CodeEntryScreen />);
    expect(screen.getByText(/Start again to get a code/)).toBeTruthy();
  });

  it('verifies, refreshes the session, and goes to /welcome after sign-up', async () => {
    setPending(EMAIL, 'signup');
    await show(<CodeEntryScreen />);
    const input = screen.getByLabelText('6 digit code');
    expect(input.props.autoComplete).toBe('one-time-code');
    expect(input.props.inputMode).toBe('numeric');
    await fireEvent.changeText(input, '123456');
    await fireEvent.press(screen.getByLabelText('Continue'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/welcome'));
    expect(calls.find((c) => c.path === '/v1/auth/verify')?.body).toEqual({
      email: EMAIL,
      code: '123456',
    });
    expect(calls.filter((c) => c.path === '/v1/me').length).toBeGreaterThan(1);
    expect(getPending().email).toBeUndefined();
    expect(JSON.stringify(screen.toJSON())).not.toContain(EMAIL);
  });

  it('sign-in flow goes to a safe returnTo only', async () => {
    setPending(EMAIL, 'signin');
    mockParams = { returnTo: 'https://evil.example' };
    await show(<CodeEntryScreen />);
    await fireEvent.changeText(screen.getByLabelText('6 digit code'), '123456');
    await fireEvent.press(screen.getByLabelText('Continue'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
  });

  it('wrong code shows the message and keeps the code', async () => {
    setPending(EMAIL, 'signup');
    handler = (p) =>
      p === '/v1/auth/verify'
        ? json(400, { error: { code: 'invalid_code', message: 'x' } })
        : json(200, {});
    await show(<CodeEntryScreen />);
    await fireEvent.changeText(screen.getByLabelText('6 digit code'), '000000');
    await fireEvent.press(screen.getByLabelText('Continue'));
    await screen.findByText(/That code is not right/);
    expect(screen.getByLabelText('6 digit code').props.value).toBe('000000');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
