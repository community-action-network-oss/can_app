import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({ id: 'p1' }),
  usePathname: () => '/me/problems/p1/stages',
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('../src/navigation/SessionContext', () => ({
  useSession: () => ({ status: 'member' }),
}));

import StagesRoute from '../app/me/problems/[id]/stages';
import { I18nProvider } from '../src/i18n';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const str = (label: string, widget = 'text') => ({
  type: 'string',
  'x-ui': { widget, label_msg: label },
});
const schema = {
  type: 'object',
  properties: {
    stage_plan: {
      type: 'array',
      items: { $ref: '#/$defs/stage_node' },
      'x-ui': { widget: 'stage_plan', label_msg: 'm.plan' },
    },
  },
  $defs: {
    stage_node: {
      type: 'object',
      properties: {
        acceptance_criteria: {
          type: 'array',
          minItems: 1,
          items: { type: 'object', required: ['statement'], properties: { statement: str('m.s') } },
          'x-ui': { widget: 'list', label_msg: 'm.crit' },
        },
      },
    },
  },
};
const messages = { 'm.plan': 'Plan', 'm.s': 'The criterion', 'm.crit': 'Criteria' };
const stage = (name: string, label: string, deps: string[] = []) => ({
  name,
  label,
  goal: 'A goal long enough',
  acceptance_criteria: [{ statement: 'It is done', measure: 'Counted' }],
  depends_on: deps,
});
const tpl = {
  id: 'classic-5',
  name: 'Five steps',
  finalCriteria: [],
  stages: ['facts', 'solutions'].map((n, i) => ({
    name: n,
    label: n === 'facts' ? 'Gathering facts' : 'Developing solutions',
    goal: 'g',
    criteria: [{ statement: 's', measure: 'm' }],
    decisionMethod: 'poster_after_input',
    dependsOn: i ? ['facts'] : [],
    needsChoice: true,
    required: true,
  })),
};

let state = 'draft';
let content: Record<string, unknown>;
let put: { stages: Record<string, unknown>[]; expectedVersion: number } | undefined;
let lastCheck: { stages: Record<string, unknown>[] } | undefined;

beforeEach(() => {
  state = 'draft';
  content = {};
  put = undefined;
  lastCheck = undefined;
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (r) => {
    const req = r as Request;
    const u = new URL(req.url);
    if (u.pathname.endsWith('/stage-templates')) return json(200, { items: [tpl] });
    if (u.pathname.endsWith('/stage-plan/validate')) {
      lastCheck = await req.json();
      const st = lastCheck!.stages as { name: string; depends_on?: string[] }[];
      const loop = st.find((a) =>
        (a.depends_on ?? []).some((d) =>
          st.find((b) => b.name === d)?.depends_on?.includes(a.name),
        ),
      );
      const issues = loop ? [{ code: 'cycle', path: st.map((s) => s.name) }] : [];
      return json(200, { ok: !loop, issues, fieldErrors: {}, stages: st });
    }
    if (req.method === 'PUT') {
      put = await req.json();
      return json(200, { id: 'p1', version: 4, template: null, stages: put!.stages, edges: [] });
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
        criteria: part,
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

const wrap = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
    >
      <I18nProvider>
        <StagesRoute />
      </I18nProvider>
    </QueryClientProvider>,
  );

it('starts from classic-5 and saves the plan with the seen version', async () => {
  await wrap();
  await fireEvent.press(await screen.findByLabelText('Start from classic-5'));
  expect(await screen.findByText('1 Gathering facts')).toBeTruthy();
  expect(screen.getByText('2 Developing solutions')).toBeTruthy();
  const save = await screen.findByLabelText('Save plan');
  await waitFor(() => expect(save.props.accessibilityState?.disabled).toBeFalsy());
  await fireEvent.press(save);
  await waitFor(() => expect(put?.expectedVersion).toBe(3));
  expect(put!.stages).toHaveLength(2);
  expect(put!.stages[0].auto_start).toBe(true);
  expect(await screen.findByText('Plan saved. You can keep editing.')).toBeTruthy();
});

it('edits depends_on with checkboxes, flags a cycle in words and blocks only saving the plan', async () => {
  content = { stage_plan: [stage('a', 'Alpha'), stage('b', 'Beta', ['a'])] };
  await wrap();
  await fireEvent.press(await screen.findByLabelText('Edit: Alpha'));
  expect(screen.getByText('Starts on its own when the stages before it are done')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Beta'));
  expect(
    await screen.findByText('⚠ These stages wait for each other: Alpha, Beta. Remove one link.'),
  ).toBeTruthy();
  await waitFor(() =>
    expect(screen.getByLabelText('Save plan').props.accessibilityState?.disabled).toBe(true),
  );
  await fireEvent.press(screen.getByLabelText('Beta'));
  await waitFor(() => expect(screen.queryByTestId('plan-issues')).toBeNull());
});

it('describes parallel stages in words and can add and remove a stage', async () => {
  content = { stage_plan: [stage('a', 'Alpha'), stage('b', 'Beta')] };
  await wrap();
  expect(await screen.findByText('Alpha, Beta run at the same time.')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Add a stage'));
  expect(await screen.findByText('3 New stage')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Remove this stage: New stage'));
  await waitFor(() => expect(screen.queryByText('3 New stage')).toBeNull());
});

it('is read only while the problem is in review', async () => {
  state = 'in_review';
  content = { stage_plan: [stage('a', 'Alpha')] };
  await wrap();
  expect(await screen.findByTestId('plan-readonly')).toBeTruthy();
  expect(screen.queryByLabelText('Save plan')).toBeNull();
  expect(screen.queryByLabelText('Edit: Alpha')).toBeNull();
});

it('refuses a published problem', async () => {
  state = 'active';
  await wrap();
  expect(await screen.findByText('You cannot open this problem here.')).toBeTruthy();
});
