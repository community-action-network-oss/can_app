import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { useSession } from '../src/navigation/SessionContext';
import { SessionProvider } from '../src/session/SessionProvider';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

let paths: string[];
function mockApi(me: () => Response, roles: () => Response) {
  paths = [];
  globalThis.fetch = jest.fn(async (req: Request) => {
    const p = new URL(req.url).pathname;
    paths.push(p);
    return p === '/v1/me/roles' ? roles() : me();
  }) as never;
}

function Probe() {
  const s = useSession();
  return (
    <Text>
      {s.status}:{(s.roles ?? []).join(',')}
    </Text>
  );
}

async function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={qc}>
      <SessionProvider>
        <Probe />
      </SessionProvider>
    </QueryClientProvider>,
  );
  return qc;
}

const member = () => json(200, { handle: 'ann', role: 'moderator' });

test('merges /v1/me/roles with the base role', async () => {
  mockApi(member, () => json(200, { roles: ['moderator', 'steward', 'auditor'] }));
  await mount();
  await waitFor(() => expect(screen.getByText('member:moderator,steward,auditor')).toBeTruthy());
});

test('base role only while roles load (no early links)', async () => {
  mockApi(member, () => new Promise<Response>(() => {}) as never);
  await mount();
  await waitFor(() => expect(screen.getByText('member:moderator')).toBeTruthy());
});

test('roles error falls back to the base role', async () => {
  mockApi(member, () => json(500, { error: { code: 'server', message: 'x' } }));
  await mount();
  await waitFor(() => expect(paths).toContain('/v1/me/roles'));
  await waitFor(() => expect(screen.getByText('member:moderator')).toBeTruthy());
});

test('signed out never fetches roles', async () => {
  mockApi(
    () => json(401, { error: { code: 'unauthenticated', message: 'no' } }),
    () => json(200, { roles: ['steward'] }),
  );
  await mount();
  await waitFor(() => expect(screen.getByText('guest:')).toBeTruthy());
  expect(paths).not.toContain('/v1/me/roles');
});
