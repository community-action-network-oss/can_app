import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), setParams: jest.fn() },
  useLocalSearchParams: () => ({}),
}));

import Home from '../app/index';
import { I18nProvider } from '../src/i18n';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

async function renderHome() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <Home />
      </I18nProvider>
    </QueryClientProvider>,
  );
}

// the list on the same screen asks for problems; only /health is under test here
const route = (health: () => Response | Promise<Response>) => async (req: RequestInfo | URL) =>
  new URL((req as Request).url).pathname === '/health'
    ? health()
    : json(200, { items: [], nextCursor: null, criteria: {} });

afterEach(() => jest.restoreAllMocks());

test('loading, then ok', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(route(() => json(200, { status: 'ok', db: 'ok' })));
  await renderHome();
  expect(screen.getByText('Checking the connection to the server')).toBeTruthy();
  expect(await screen.findByText(/Connected to the server\. Everything is working/)).toBeTruthy();
});

test('degraded shows the database message', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(route(() => json(503, { status: 'degraded', db: 'down' })));
  await renderHome();
  expect(await screen.findByText(/The database is not responding/)).toBeTruthy();
});

test('network error shows retry, retry recovers', async () => {
  let n = 0;
  const spy = jest.spyOn(globalThis, 'fetch').mockImplementation(
    route(() => {
      if (n++ === 0) throw new TypeError('network');
      return json(200, { status: 'ok', db: 'ok' });
    }),
  );
  await renderHome();
  await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));
  expect(await screen.findByText(/Everything is working/)).toBeTruthy();
  expect(n).toBe(2);
  void spy;
});
