import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { View } from 'react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  usePathname: () => '/policy/new',
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('../../src/navigation/SessionContext', () => ({
  useSession: () => ({ status: 'member' }),
}));

import NewRoute from '../../app/policy/new';
import { I18nProvider } from '../../src/i18n';
import messages from './fixtures/policy_proposal.messages.json';
import real from './fixtures/policy_proposal.schema.json';

// The renderer cannot show rule_id_list, slug_list or acknowledgement yet (reported). The flow tests drop those fields.
const UNSUPPORTED = [
  'rule_ids_and_dps_touched',
  'protected_core_check',
  'affected_jurisdictions',
  'affected_content_types',
];
const supported = {
  ...real,
  properties: Object.fromEntries(
    Object.entries(real.properties).filter(([k]) => !UNSUPPORTED.includes(k)),
  ),
  required: real.required.filter((k) => !UNSUPPORTED.includes(k)),
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let mockSchema: object;
let post: Response;
let posted: any;

beforeEach(() => {
  mockSchema = supported;
  posted = undefined;
  post = json(201, { id: 'p1' });
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (r) => {
    const req = r as Request;
    if (req.method === 'POST') {
      posted = { url: new URL(req.url).pathname, body: await req.clone().json() };
      return post;
    }
    return json(200, {
      schema: mockSchema,
      schema_id: 'policy_proposal',
      schema_version: '1.0.0',
      schema_hash: 'h1',
      policy_version: 'p1',
      messages,
    });
  });
  mockPush.mockClear();
});
afterEach(() => jest.restoreAllMocks());

const show = async (dir: 'ltr' | 'rtl' = 'ltr') =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
    >
      <I18nProvider>
        <View style={{ direction: dir }}>
          <NewRoute />
        </View>
      </I18nProvider>
    </QueryClientProvider>,
  );

const long = 'x'.repeat(60);
const fillAll = async () => {
  // walk the sections, filling every empty text box; list fields get one item first
  for (let i = 0; i < 6; i++) {
    for (const add of screen.queryAllByLabelText(/^Add another/)) await fireEvent.press(add);
    for (const box of screen.queryAllByDisplayValue('')) await fireEvent.changeText(box, long);
    const next = screen.queryByLabelText('Next');
    if (!next) break;
    await fireEvent.press(next);
  }
};

it('renders title, intro and the first section from the schema, also in rtl', async () => {
  await show('rtl');
  expect(await screen.findByText('Propose a policy change')).toBeTruthy();
  expect(screen.getByText(/^Describe the change in the fields below/)).toBeTruthy();
  expect(screen.getByText(/^Section 1 of /)).toBeTruthy();
});

it('the real schema needs three widgets the renderer lacks, and submit stays blocked', async () => {
  mockSchema = real;
  await show();
  await screen.findByTestId('schema-form');
  expect(await screen.findAllByText(/field type this app version cannot show/)).toBeTruthy();
});

it('submits the snake_case body to /v1/policy-proposals and opens the proposal', async () => {
  await show();
  await screen.findByTestId('schema-form');
  await fillAll();
  await fireEvent.press(await screen.findByLabelText('Submit'));
  await waitFor(() => expect(posted).toBeTruthy());
  expect(posted.url).toBe('/v1/policy-proposals');
  expect(posted.body.schemaVersion).toBe('1.0.0');
  expect(Object.keys(posted.body.content)).toContain('change_summary');
  await waitFor(() =>
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/policy/[id]', params: { id: 'p1' } }),
  );
});

it('shows the protected-core refusal with its reason beside the field', async () => {
  post = json(422, {
    error: {
      code: 'protected_core',
      message: 'Constitution I.2 protects this rule.',
      fieldErrors: { '/change_summary': 'Protected-core rules: R-1.' },
    },
  });
  await show();
  await screen.findByTestId('schema-form');
  await fillAll();
  await fireEvent.press(await screen.findByLabelText('Submit'));
  expect(await screen.findByText(/Constitution I\.2 protects this rule\./)).toBeTruthy();
  expect(screen.getByText('This change cannot be proposed here')).toBeTruthy();
  expect(screen.getByText(/Protected-core rules: R-1\./)).toBeTruthy();
  expect(mockPush).not.toHaveBeenCalled();
});

it('shows the per-account cap message on 429', async () => {
  post = json(429, { error: { code: 'rate_limited', message: 'cap' } });
  await show();
  await screen.findByTestId('schema-form');
  await fillAll();
  await fireEvent.press(await screen.findByLabelText('Submit'));
  expect(await screen.findByText(/reached the limit for policy proposals/)).toBeTruthy();
});
