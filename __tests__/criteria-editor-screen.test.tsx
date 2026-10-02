import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  useLocalSearchParams: () => ({ id: 'p1' }),
  usePathname: () => '/me/problems/p1/criteria',
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('../src/navigation/SessionContext', () => ({
  useSession: () => ({ status: 'member' }),
}));

import CriteriaRoute from '../app/me/problems/[id]/criteria';
import { CriteriaEditor } from '../src/preparation/criteria';
import { I18nProvider } from '../src/i18n';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const str = (label: string, widget = 'textarea') => ({
  type: 'string',
  minLength: 1,
  'x-ui': { widget, label_msg: label },
});
// The list field and its item fields are named only inside this fixture, like the real schema does.
const schema = {
  type: 'object',
  required: ['final_acceptance_criteria'],
  properties: {
    final_acceptance_criteria: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'object',
        required: ['a'],
        properties: { a: str('m.a'), b: str('m.b', 'text') },
      },
      'x-ui': { widget: 'list', label_msg: 'm.list', group: 'g' },
      'x-guidance': { good: 'Under 5 days for 90 percent of cases.' },
    },
  },
};
const messages = { 'm.a': 'The criterion', 'm.b': 'Target', 'm.list': 'Criteria' };

let state = 'draft';
let content: unknown;
let patched: unknown;
let patchStatus = 200;
let flags: unknown[] = [];

beforeEach(() => {
  state = 'draft';
  content = { final_acceptance_criteria: [{ a: 'Bins emptied twice a week', b: '2 per week' }] };
  patched = undefined;
  patchStatus = 200;
  flags = [];
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (r) => {
    const req = r as Request;
    const u = new URL(req.url);
    if (req.method === 'PATCH') {
      patched = await req.json();
      if (patchStatus === 400)
        return json(400, {
          error: {
            code: 'validation_failed',
            message: 'no',
            fieldErrors: { '/content/final_acceptance_criteria': 'At least one is needed' },
          },
        });
      if (patchStatus === 403)
        return json(403, { error: { code: 'not_permitted', message: 'no' } });
      return json(200, { id: 'p1', state, version: 4, updatedAt: 'x' });
    }
    if (u.pathname.endsWith('/preparation')) {
      const part = { status: 'ready', reason: null, fieldErrors: {}, flags: [] };
      return json(200, {
        id: 'p1',
        state,
        version: 3,
        ready: false,
        facts: part,
        sources: part,
        stages: part,
        criteria: { ...part, flags },
      });
    }
    if (u.pathname.startsWith('/v1/content-schemas'))
      return json(200, {
        schema,
        schema_id: 'problem',
        schema_version: '1',
        schema_hash: 'h',
        policy_version: 'p',
        messages,
      });
    return json(200, {
      id: 'p1',
      state,
      version: 3,
      updatedAt: 'x',
      schemaId: 'problem',
      schemaVersion: '1',
      schemaHash: 'h',
      content,
    });
  });
});
afterEach(() => jest.restoreAllMocks());

const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
    >
      <I18nProvider>{ui}</I18nProvider>
    </QueryClientProvider>,
  );

it('shows the criteria from the schema, a synthetic example, and saves with the seen version', async () => {
  await wrap(<CriteriaRoute />);
  expect(await screen.findByText('1 criterion')).toBeTruthy();
  expect(
    screen.getByText('Example, synthetic: Under 5 days for 90 percent of cases.'),
  ).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('The criterion'), 'Bins emptied three times');
  await fireEvent.press(screen.getByLabelText('Submit'));
  await waitFor(() =>
    expect(patched).toEqual({
      finalAcceptanceCriteria: [{ a: 'Bins emptied three times', b: '2 per week' }],
      expectedVersion: 3,
    }),
  );
  expect(await screen.findByText('Saved. You can keep editing.')).toBeTruthy();
});

it('says one criterion is needed when the list is empty, and maps the server refusal to the field', async () => {
  content = { final_acceptance_criteria: [] };
  patchStatus = 400;
  await wrap(<CriteriaRoute />);
  expect(await screen.findByText('No criteria yet.')).toBeTruthy();
  expect(screen.getByText('At least one final criterion is needed.')).toBeTruthy();
  await fireEvent.press(await screen.findByLabelText('Add another: Criteria'));
  await fireEvent.changeText(screen.getByLabelText('The criterion'), 'Something we can count');
  await fireEvent.press(screen.getByLabelText('Submit'));
  expect(await screen.findByText('At least one is needed')).toBeTruthy();
});

it('shows a server flag as a neutral note with text and an icon', async () => {
  flags = [
    {
      id: 'f',
      field: '/content/final_acceptance_criteria/0/x',
      kept: false,
      suggestion: 'add a number',
    },
  ];
  await wrap(<CriteriaRoute />);
  expect(await screen.findByText('ⓘ Item 1. This is hard to check: add a number')).toBeTruthy();
});

it('turns read only when the server says you may not edit', async () => {
  patchStatus = 403;
  await wrap(<CriteriaRoute />);
  await fireEvent.press(await screen.findByLabelText('Submit'));
  expect(await screen.findByText('You cannot open this problem here.')).toBeTruthy();
  await waitFor(() => expect(screen.queryByLabelText('Submit')).toBeNull());
});

it('refuses a problem that is not editable', async () => {
  state = 'active';
  await wrap(<CriteriaRoute />);
  expect(await screen.findByText('You cannot open this problem here.')).toBeTruthy();
});

it('CriteriaEditor works for a stage owner from the same code', async () => {
  const onSave = jest.fn();
  await wrap(
    <CriteriaEditor
      owner="stage-2"
      fieldKey="final_acceptance_criteria"
      schema={schema as never}
      messages={messages}
      items={[{ a: 'Pilot ran for 8 weeks', b: 'x' }]}
      onSave={onSave}
    />,
  );
  expect(screen.getByTestId('criteria-editor-stage-2')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Submit'));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith([{ a: 'Pilot ran for 8 weeks', b: 'x' }]),
  );
});
