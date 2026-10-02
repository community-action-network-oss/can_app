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

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let mockSchema: object;
let post: Response;
let posted: any;

beforeEach(() => {
  mockSchema = real;
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
const sample = (label: string) =>
  /Rules and decision points/.test(label)
    ? 'DP-FRAMING'
    : /Examples that led/.test(label)
      ? 'audit:a_2041'
      : /Jurisdictions|Content types/.test(label)
        ? 'nl'
        : long;
const fillAll = async () => {
  // walk the sections: every list gets one row, every empty box a value that fits its schema, protected check ticked
  for (let i = 0; i < 6; i++) {
    for (const add of screen.queryAllByLabelText(/^Add another/)) await fireEvent.press(add);
    for (const box of screen.queryAllByDisplayValue(''))
      await fireEvent.changeText(
        box,
        sample(String(box.props['aria-label'] ?? box.props.accessibilityLabel ?? '')),
      );
    const ack = screen.queryByLabelText(/^I checked that this does not change/);
    if (ack) await fireEvent.press(ack);
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

it('the real schema renders its list and acknowledgement widgets with nothing unsupported', async () => {
  await show();
  await screen.findByTestId('schema-form');
  expect(screen.queryAllByText(/field type this app version cannot show/)).toHaveLength(0);
  expect(screen.getAllByText(/^Rules and decision points this touches/).length).toBeGreaterThan(0);
  expect(screen.getByLabelText(/^Add another: Rules and decision points/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText(/^Add another: Rules and decision points/));
  expect(screen.getByLabelText('Rules and decision points this touches: Item 1')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Remove item 1'));
  expect(screen.queryByLabelText('Rules and decision points this touches: Item 1')).toBeNull();
});

it('submits the snake_case body to /v1/policy-proposals and opens the proposal', async () => {
  await show();
  await screen.findByTestId('schema-form');
  await fillAll();
  await fireEvent.press(await screen.findByLabelText('Submit'));
  await waitFor(() => expect(posted).toBeTruthy());
  expect(posted.url).toBe('/v1/policy-proposals');
  expect(posted.body.schemaVersion).toBe('1.0.0');
  const c = posted.body.content;
  expect(Object.keys(c)).toContain('change_summary');
  expect(c.rule_ids_and_dps_touched).toEqual(['DP-FRAMING']);
  expect(c.affected_jurisdictions).toEqual(['nl']);
  expect(c.protected_core_check).toEqual({ acknowledged: true, touches_protected_core: false });
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
  // banner plus the field itself, whose section is now open
  expect(screen.getAllByText(/Protected-core rules: R-1\./)).toHaveLength(2);
  expect(mockPush).not.toHaveBeenCalled();
});

it('lands a server pointer error on a row of the rule id list', async () => {
  post = json(400, {
    error: {
      code: 'invalid',
      message: 'bad',
      fieldErrors: { '/content/rule_ids_and_dps_touched/0': 'Unknown rule id.' },
    },
  });
  await show();
  await screen.findByTestId('schema-form');
  await fillAll();
  await fireEvent.press(await screen.findByLabelText('Submit'));
  await waitFor(() => expect(posted).toBeTruthy());
  expect(await screen.findByText(/Unknown rule id\./)).toBeTruthy();
});

it('blocks submit until the protected check is ticked and rule ids fit the pattern', async () => {
  await show();
  await screen.findByTestId('schema-form');
  await fireEvent.press(await screen.findByLabelText(/^Add another: Rules/));
  await fireEvent.changeText(
    screen.getByLabelText('Rules and decision points this touches: Item 1'),
    'the privacy stuff',
  );
  await fireEvent.press(await screen.findByLabelText('Next'));
  expect(posted).toBeUndefined();
});

it('shows the per-account cap message on 429', async () => {
  post = json(429, { error: { code: 'rate_limited', message: 'cap' } });
  await show();
  await screen.findByTestId('schema-form');
  await fillAll();
  await fireEvent.press(await screen.findByLabelText('Submit'));
  expect(await screen.findByText(/reached the limit for policy proposals/)).toBeTruthy();
});
