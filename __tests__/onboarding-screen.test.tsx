import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: {
    push: (...a: unknown[]) => mockPush(...a),
    replace: (...a: unknown[]) => mockReplace(...a),
  },
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  usePathname: () => '/welcome',
}));

import { WelcomeScreen } from '../src/auth/WelcomeScreen';
import { I18nProvider } from '../src/i18n';
import { SessionProvider } from '../src/session/SessionProvider';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let regen: () => Response;
let regenCalls = 0;
let me = 'QuietHeron42';
beforeEach(() => {
  regenCalls = 0;
  me = 'QuietHeron42';
  mockReplace.mockClear();
  mockPush.mockClear();
  regen = () => {
    me = 'BraveOtter7';
    return json(200, { handle: 'BraveOtter7' });
  };
  globalThis.fetch = jest.fn(async (req: Request) => {
    const p = new URL(req.url).pathname;
    if (p === '/v1/me/handle/regenerate') {
      regenCalls++;
      return regen();
    }
    return json(200, { handle: me, role: 'member' });
  }) as never;
});

const show = async () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <SessionProvider>
          <WelcomeScreen />
        </SessionProvider>
      </I18nProvider>
    </QueryClientProvider>,
  );
};

it('shows the generated name and the email promise', async () => {
  await show();
  await screen.findByText('Your public name is QuietHeron42. Your email is never shown.');
  expect(screen.getByLabelText('Try another name')).toBeTruthy();
  expect(screen.getByLabelText(/Optional: set up a profile/)).toBeTruthy();
});

it('regenerates once, shows the new name, then replaces the button with the note', async () => {
  await show();
  await screen.findByText(/QuietHeron42/);
  await fireEvent.press(screen.getByLabelText('Try another name'));
  await screen.findByText('Your public name is BraveOtter7. Your email is never shown.');
  expect(screen.queryByLabelText('Try another name')).toBeNull();
  expect(screen.getByText(/can be changed once, and that is done/)).toBeTruthy();
  expect(regenCalls).toBe(1);
});

it('a 403 from the server reads as the same used note', async () => {
  regen = () => json(403, { error: { code: 'not_permitted', message: 'x' } });
  await show();
  await screen.findByText(/QuietHeron42/);
  await fireEvent.press(screen.getByLabelText('Try another name'));
  await screen.findByText(/can be changed once, and that is done/);
  expect(screen.queryByLabelText('Try another name')).toBeNull();
});

it('continue goes home', async () => {
  await show();
  await fireEvent.press(screen.getByLabelText('Continue'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/'));
});
