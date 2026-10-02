import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  router: {
    push: (...a: unknown[]) => mockPush(...a),
    replace: (...a: unknown[]) => mockReplace(...a),
  },
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/sign-in',
  useLocalSearchParams: () => mockParams,
}));

import { CodeEntryScreen } from '../src/auth/CodeEntryScreen';
import { clearPending, getPending, setPending } from '../src/auth/pending';
import { SignInScreen } from '../src/auth/SignInScreen';
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

const go = async (email = EMAIL) => {
  await fireEvent.changeText(screen.getByLabelText('Email'), email);
  await fireEvent.press(screen.getByLabelText('Send me a code'));
};
const codes = () => calls.filter((c) => c.path === '/v1/auth/code');
const GENERIC = json(200, {});

it('shows the empty state', async () => {
  await show(<SignInScreen />);
  expect(screen.getByText(/We will email you a 6 digit code/)).toBeTruthy();
  expect(screen.getByText(/You can read everything without one/)).toBeTruthy();
});

const afterSend: string[] = [];
it.each([EMAIL, 'nobody@example.org'])(
  'neutral outcome for %s: same navigation, no email on screen',
  async (addr) => {
    const view = await show(<SignInScreen />);
    await go(addr);
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/sign-in/code'));
    expect(getPending()).toEqual({ email: addr, flow: 'signin' });
    const tree = JSON.stringify(view.toJSON());
    expect(tree).not.toContain('@example.org');
    afterSend.push(tree);
    if (afterSend.length === 2) expect(afterSend[0]).toBe(afterSend[1]);
  },
);

it('passes only a safe returnTo on', async () => {
  mockParams = { returnTo: '/problems/p1' };
  await show(<SignInScreen />);
  await go();
  await waitFor(() =>
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/sign-in/code',
      params: { returnTo: '/problems/p1' },
    }),
  );
});

it('drops a rejected returnTo', async () => {
  mockParams = { returnTo: '//evil.example' };
  await show(<SignInScreen />);
  await go();
  await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/sign-in/code'));
});

it('rate limited shows the wait and does not navigate', async () => {
  handler = () =>
    json(429, { error: { code: 'rate_limited', message: 'x' } }, { 'Retry-After': '600' });
  await show(<SignInScreen />);
  await go();
  await screen.findByText('Too many tries. Please wait 10 minutes and try again.');
  expect(mockPush).not.toHaveBeenCalled();
});

it('offline keeps the typed email', async () => {
  globalThis.fetch = jest.fn(async () => {
    throw new TypeError('Network request failed');
  }) as never;
  await show(<SignInScreen />);
  await go();
  await screen.findByText(/You are offline/);
  expect(screen.getByLabelText('Email').props.value).toBe(EMAIL);
});

it('rejects a malformed address without calling the server', async () => {
  await show(<SignInScreen />);
  await go('nope');
  await screen.findByText('That does not look like an email address.');
  expect(codes()).toHaveLength(0);
});

describe('code entry (sign-in flow)', () => {
  const verifyFails = () =>
    (handler = (p) =>
      p === '/v1/auth/verify'
        ? json(400, { error: { code: 'invalid_code', message: 'x' } })
        : GENERIC.clone());

  it('wrong or expired code shows the message, keeps the code', async () => {
    setPending(EMAIL, 'signin');
    verifyFails();
    await show(<CodeEntryScreen />);
    await fireEvent.changeText(screen.getByLabelText('6 digit code'), '000000');
    await fireEvent.press(screen.getByLabelText('Continue'));
    await screen.findByText(/That code is not right, or it has expired/);
    expect(screen.getByLabelText('6 digit code').props.value).toBe('000000');
  });

  it('rate limited verify shows the wait', async () => {
    setPending(EMAIL, 'signin');
    handler = (p) =>
      p === '/v1/auth/verify'
        ? json(429, { error: { code: 'rate_limited', message: 'x' } }, { 'Retry-After': '120' })
        : GENERIC.clone();
    await show(<CodeEntryScreen />);
    await fireEvent.changeText(screen.getByLabelText('6 digit code'), '123456');
    await fireEvent.press(screen.getByLabelText('Continue'));
    await screen.findByText('Too many tries. Please wait 2 minutes and try again.');
  });

  it('honours a safe returnTo after verify', async () => {
    setPending(EMAIL, 'signin');
    mockParams = { returnTo: '/problems/p1' };
    await show(<CodeEntryScreen />);
    await fireEvent.changeText(screen.getByLabelText('6 digit code'), '123456');
    await fireEvent.press(screen.getByLabelText('Continue'));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/problems/p1'));
  });

  describe('resend countdown', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('is disabled for 30s, ticks outside any live region, then sends once and locks again', async () => {
      setPending(EMAIL, 'signin');
      await show(<CodeEntryScreen />);
      const resend = () => screen.getByLabelText('Send a new code');
      expect(resend().props.accessibilityState.disabled).toBe(true);
      screen.getByText('You can ask for a new code in 30 seconds.');
      await act(async () => {
        jest.advanceTimersByTime(10_000);
      });
      screen.getByText('You can ask for a new code in 20 seconds.');
      // the ticking text is not announced; nothing on screen is a live region yet
      expect(screen.queryByRole('status')).toBeNull();
      await act(async () => {
        jest.advanceTimersByTime(20_000);
      });
      expect(screen.queryByText(/You can ask for a new code in/)).toBeNull();
      expect(resend().props.accessibilityState.disabled).toBe(false);
      await fireEvent.press(resend());
      await screen.findByText(/we sent a new code/);
      expect(screen.getAllByRole('status')).toHaveLength(1);
      expect(codes()).toHaveLength(1);
      expect(resend().props.accessibilityState.disabled).toBe(true);
      screen.getByText('You can ask for a new code in 30 seconds.');
    });
  });
});
