import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { View } from 'react-native';

const mockMem = new Map<string, string>();
const mockPush = jest.fn();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockMem.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockMem.set(k, v),
  deleteItemAsync: async (k: string) => void mockMem.delete(k),
}));
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  useLocalSearchParams: () => ({ id: 'd1' }),
  usePathname: () => '/me/problems/d1/facts',
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('../../src/navigation/SessionContext', () => ({
  useSession: () => ({ status: 'member' }),
}));

import FactsRoute from '../../app/me/problems/[id]/facts';
import { clear, flush, load, resetMemory, save } from '../../src/drafts/draftStore';
import { I18nProvider } from '../../src/i18n';
import messages from '../forms/fixtures/problem.messages.json';
import schema from '../forms/fixtures/problem.schema.json';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const dto = (s: object, version = '1.0.0', hash = 'h1') => ({
  schema: s,
  schema_id: 'problem',
  schema_version: version,
  schema_hash: hash,
  policy_version: 'p1',
  messages,
});
let mockSchema: object;
let calls: { method: string; url: string; body?: any }[];
let reply: (req: Request) => Response | undefined;

beforeEach(async () => {
  mockMem.clear();
  resetMemory();
  mockPush.mockClear();
  mockSchema = schema;
  calls = [];
  reply = () => undefined;
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (r) => {
    const req = r as Request;
    const body = req.method === 'GET' ? undefined : await req.clone().json();
    calls.push({ method: req.method, url: req.url, body });
    const u = new URL(req.url);
    return (
      reply(req) ??
      (u.pathname.startsWith('/v1/content-schemas')
        ? json(200, dto(mockSchema, u.searchParams.get('version') ?? '1.0.0'))
        : json(200, {
            id: 'd1',
            version: 2,
            state: 'draft',
            updatedAt: 'x',
            schemaId: 'problem',
            schemaVersion: '1.0.0',
            schemaHash: 'h1',
          }))
    );
  });
});
afterEach(() => jest.restoreAllMocks());

const show = async (dir: 'ltr' | 'rtl' = 'ltr') =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
    >
      <I18nProvider>
        <View style={{ direction: dir }}>
          <FactsRoute />
        </View>
      </I18nProvider>
    </QueryClientProvider>,
  );

it('renders the first section from the schema with a11y labels, also in rtl', async () => {
  await show('rtl');
  expect(await screen.findByLabelText('What is the shared public condition?')).toBeTruthy();
  expect(screen.getByText(/^Section 1 of /)).toBeTruthy();
  expect(screen.getByText('Private. Only you can see this until it is published.')).toBeTruthy();
});

it('shows the parts owned by other screens as read-only links, never as inputs', async () => {
  await show();
  await screen.findByTestId('facts-section');
  for (const l of ['Trusted sources', 'When it is solved', 'Stages (optional)', 'Affected area'])
    expect(screen.getByLabelText(l)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Trusted sources'));
  expect(mockPush).toHaveBeenCalledWith('/me/problems/d1/sources');
  expect(screen.queryByTestId('slot-stage_plan')).toBeNull();
  expect(screen.getByTestId('context-profile')).toBeTruthy(); // calm "not available yet" row
});

it('a new optional field in the fixture appears with no code change', async () => {
  mockSchema = {
    ...schema,
    properties: {
      ...schema.properties,
      brand_new: {
        type: 'string',
        'x-ui': { widget: 'text', label_msg: 'x.new', order: 0, group: 'condition' },
      },
    },
  };
  await show();
  expect(await screen.findByLabelText('x.new')).toBeTruthy();
});

it('autosaves offline to the device pinned to the schema version', async () => {
  await show();
  await fireEvent.changeText(
    await screen.findByLabelText('What is the shared public condition?'),
    'Gaps in the pavement',
  );
  await flush();
  resetMemory();
  const d = await load();
  expect(d).toMatchObject({ schemaId: 'problem', schemaVersion: '1.0.0', schemaHash: 'h1' });
  expect(Object.values(d!.body)).toContain('Gaps in the pavement');
});

it('restores a draft pinned to its version and fetches that version', async () => {
  await save({
    schemaId: 'problem',
    schemaVersion: '0.9.0',
    schemaHash: 'h1',
    body: { condition: 'Old text' },
  });
  await flush();
  await show();
  expect(await screen.findByDisplayValue('Old text')).toBeTruthy();
  expect(calls.some((c) => c.url.includes('version=0.9.0'))).toBe(true);
});

it('a version no longer served keeps the draft read-only with the message', async () => {
  await save({
    schemaId: 'problem',
    schemaVersion: '0.1.0',
    schemaHash: 'h0',
    body: { condition: 'Old text' },
  });
  await flush();
  reply = (req) =>
    req.url.includes('version=0.1.0')
      ? json(404, { error: { code: 'schema_unknown', message: 'gone' } })
      : undefined;
  await show();
  expect(await screen.findByTestId('version-note')).toBeTruthy();
  expect(screen.getByText(/no longer available/)).toBeTruthy();
  expect(screen.queryByLabelText('Submit')).toBeNull();
});

it('submit sends content with the schema stamps and maps pointer errors to fields', async () => {
  const tiny = {
    ...schema,
    required: [],
    properties: {
      condition: (schema.properties as any).condition,
    },
  };
  mockSchema = tiny;
  reply = (req) =>
    req.method === 'PATCH'
      ? json(400, {
          error: {
            code: 'schema_invalid',
            message: 'bad',
            fieldErrors: { '/content/condition': 'Server says no' },
          },
        })
      : undefined;
  await show();
  await fireEvent.changeText(
    await screen.findByLabelText('What is the shared public condition?'),
    'Gaps in the pavement that last for months',
  );
  await fireEvent.press(await screen.findByLabelText('Submit'));
  await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
  const p = calls.find((c) => c.method === 'PATCH')!;
  expect(p.body).toMatchObject({ schemaVersion: '1.0.0', schemaHash: 'h1' });
  expect(p.body.content.condition).toContain('Gaps');
  expect(await screen.findByText('Server says no')).toBeTruthy();
});

afterAll(() => clear());
