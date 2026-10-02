import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({ id: 'd1' }),
  usePathname: () => '/me/problems/d1/preview',
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('../../src/navigation/SessionContext', () => ({
  useSession: () => ({ status: 'member' }),
}));

import PreviewRoute from '../../app/me/problems/[id]/preview';
import { I18nProvider } from '../../src/i18n';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let kept = false;
const result = () => ({
  checkId: 'c',
  ok: true,
  emergency: false,
  languageLabel: null,
  repostMatch: false,
  flags: [
    {
      id: 'x:person_name:0-3',
      field: '/content/affected',
      kind: 'person_name',
      ruleId: 'r',
      start: 0,
      end: 3,
      severity: 'review',
      kept,
    },
  ],
});
beforeEach(() => {
  kept = false;
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (r) => {
    const u = new URL((r as Request).url);
    if (u.pathname.endsWith('/preview'))
      return json(200, {
        public: { condition: 'Gaps in the pavement' },
        explanationIds: ['publish.review_first', 'publish.handle_shown'],
        handle: 'ana',
        timings: {},
      });
    if (u.pathname.endsWith('/keep')) kept = true;
    if (u.pathname.endsWith('/checks') || u.pathname.endsWith('/keep')) return json(200, result());
    return json(200, {
      schema: {},
      schema_id: 'problem',
      schema_version: '1',
      schema_hash: 'h',
      policy_version: 'p',
      messages: {},
    });
  });
});
afterEach(() => jest.restoreAllMocks());

it('shows exactly the public fields, the handle, and a keepable review flag', async () => {
  await render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
    >
      <I18nProvider>
        <PreviewRoute />
      </I18nProvider>
    </QueryClientProvider>,
  );
  expect(await screen.findByText('Gaps in the pavement')).toBeTruthy();
  expect(screen.getByText('Shown as @ana')).toBeTruthy();
  expect(screen.getByText('Your email is never shown.')).toBeTruthy();
  await fireEvent.press(await screen.findByLabelText(/^Keep as written/));
  await waitFor(() => expect(screen.queryByLabelText(/^Keep as written/)).toBeNull());
});
