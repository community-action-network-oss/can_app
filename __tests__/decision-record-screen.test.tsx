import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockPush = jest.fn();
let mockStatus = 'member';
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  useLocalSearchParams: () => ({ id: 'p1', stageId: 's1' }),
  usePathname: () => '/problems/p1/stages/s1/decision',
  useRouter: () => ({ replace: jest.fn(), push: mockPush }),
}));
jest.mock('../src/navigation/SessionContext', () => ({
  useSession: () => ({ status: mockStatus, handle: 'ann', roles: [] }),
}));

import ChoiceRoute from '../app/problems/[id]/stages/[stageId]/choice';
import DecisionRoute from '../app/problems/[id]/stages/[stageId]/decision';
import { I18nProvider } from '../src/i18n';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const O1 = '11111111-1111-4111-8111-111111111111';
const schema = {
  type: 'object',
  required: ['rationale', 'legal_gate_record'],
  properties: {
    chosen_option_ids: {
      type: 'array',
      items: { type: 'string', 'x-ui': { widget: 'ref', label_msg: 'l.o' } },
      'x-ui': { widget: 'list', label_msg: 'l.ids', order: 1 },
    },
    rationale: { type: 'string', 'x-ui': { widget: 'textarea', label_msg: 'l.r', order: 2 } },
    legal_gate_record: {
      type: 'object',
      required: ['constraint_checked'],
      properties: {
        constraint_checked: { type: 'string', 'x-ui': { widget: 'textarea', label_msg: 'l.c' } },
      },
      'x-ui': { widget: 'legal_gate', label_msg: 'l.g', order: 3 },
    },
  },
};
const sdto = {
  schema,
  messages: {
    'l.ids': 'Chosen options',
    'l.o': 'Option',
    'l.r': 'Why',
    'l.g': 'Legal check record',
    'l.c': 'What was checked',
  },
  schema_version: '1.0.0',
  schema_hash: 'h1',
};
const gate = {
  checkedAt: 'z',
  packVersion: '1.0.0',
  outcome: 'clear',
  findings: [
    {
      layer: 'L4',
      finding: 'constrains',
      blocks: true,
      article_ids: ['nl-art-12'],
      corpus_version: 'nl@1.0.0+abc',
    },
    { layer: 'L6', finding: 'none_found', blocks: false, article_ids: [], corpus_version: null },
  ],
};
const rec = (o: object = {}) => ({
  id: 'd1',
  stageChoiceId: 'c1',
  method: 'poster_after_input',
  rationale: 'Cheapest and lawful',
  deciderHandle: 'ann',
  authority: 'initiator',
  dissentNotes: ['Bo prefers B'],
  policyVersion: '1.0.0',
  transitional: true,
  transitionalNote: null,
  decidedAt: 'z',
  decidedUnder: null,
  withdrawn: false,
  legalGate: gate,
  ...o,
});
const stage = (o: object = {}) => ({
  id: 's1',
  name: 'pick',
  label: 'Pick',
  state: 'active',
  chip: 'In progress',
  needsChoice: true,
  criteria: [],
  options: [
    { id: O1, status: 'public', content: { summary: 'Weekly pickup' }, authorHandle: 'bo' },
  ],
  choice: null,
  allowedStageTransitions: [{ to: 'resolving', mode: 'direct', requires: [] }],
  ...o,
});

let decision: object;
let st: object;
let posts: { path: string; body: any }[];
let postRes: () => Response;
beforeEach(() => {
  mockStatus = 'member';
  posts = [];
  postRes = () => json(201, {});
  decision = { stageId: 's1', choiceGate: 'recorded', items: [rec()] };
  st = stage({ choice: { optionIds: [O1], steps: null } });
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (r) => {
    const req = r as Request;
    const path = new URL(req.url).pathname;
    if (path.startsWith('/v1/content-schemas/')) return json(200, sdto);
    if (path === '/v1/stages/s1/decision') return json(200, decision);
    if (path === '/v1/stages/s1') return json(200, st);
    if (req.method === 'POST') {
      posts.push({ path, body: await req.json() });
      return postRes();
    }
    return json(404, {});
  });
});
afterEach(() => jest.restoreAllMocks());

const wrap = (ui: ReactNode) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={qc}>
      <I18nProvider>{ui}</I18nProvider>
    </QueryClientProvider>,
  );
};

describe('choice record', () => {
  it('shows the choice, method, reason, dissent and policy label as text', async () => {
    await wrap(<DecisionRoute />);
    expect(await screen.findByText(/Option 1: Weekly pickup/)).toBeTruthy();
    expect(screen.getByText('How it was decided: poster after input')).toBeTruthy();
    expect(screen.getByText('Why: Cheapest and lawful')).toBeTruthy();
    expect(screen.getByText('Bo prefers B')).toBeTruthy();
    expect(screen.getByText('Policy 1.0.0, transitional stewardship')).toBeTruthy();
    expect(screen.getByText(/decision record is transitional/)).toBeTruthy();
    expect(screen.queryByLabelText('Make the choice')).toBeNull();
  });

  it('shows the legal gate per layer with article ids and corpus version, never article text', async () => {
    await wrap(<DecisionRoute />);
    expect(await screen.findByText('National law')).toBeTruthy();
    expect(screen.getByText('A rule limits this (blocks this choice)')).toBeTruthy();
    expect(screen.getByText('Articles: nl-art-12')).toBeTruthy();
    expect(screen.getByText('Law collection version: nl@1.0.0+abc')).toBeTruthy();
    expect(screen.getByText('No rule found')).toBeTruthy();
  });

  it('shows an empty state and offers the form only to the poster of an active stage', async () => {
    decision = { stageId: 's1', choiceGate: 'missing', items: [] };
    st = stage();
    await wrap(<DecisionRoute />);
    expect(await screen.findByText(/No choice yet/)).toBeTruthy();
    await fireEvent.press(await screen.findByLabelText('Make the choice'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/problems/[id]/stages/[stageId]/choice',
      params: { id: 'p1', stageId: 's1' },
    });
  });

  it('offers no choice action to a non-decider', async () => {
    decision = { stageId: 's1', choiceGate: 'missing', items: [] };
    st = stage({ allowedStageTransitions: [] });
    await wrap(<DecisionRoute />);
    await screen.findByText(/No choice yet/);
    expect(screen.queryByLabelText('Make the choice')).toBeNull();
  });

  it('offers no choice action to a guest', async () => {
    mockStatus = 'guest';
    decision = { stageId: 's1', choiceGate: 'missing', items: [] };
    st = stage();
    await wrap(<DecisionRoute />);
    await screen.findByText(/No choice yet/);
    expect(screen.queryByLabelText('Make the choice')).toBeNull();
  });

  it('shows a withdrawn choice as withdrawn', async () => {
    decision = { stageId: 's1', choiceGate: 'missing', items: [rec({ withdrawn: true })] };
    await wrap(<DecisionRoute />);
    expect(await screen.findByText('An earlier choice was withdrawn.')).toBeTruthy();
  });
});

describe('choice form', () => {
  const fill = async () => {
    await fireEvent.changeText(await screen.findByLabelText(/Why/), 'Cheapest');
    await fireEvent.changeText(await screen.findByLabelText(/What was checked/), 'Roads act');
  };

  it('comes from the schema, picks options from the stage, and posts the answers', async () => {
    await wrap(<ChoiceRoute />);
    await fill();
    await fireEvent.press(await screen.findByLabelText('Add another: Chosen options'));
    await fireEvent.press(await screen.findByText(/Option 1: Weekly pickup/));
    await fireEvent.press(await screen.findByRole('button', { name: 'Record the choice' }));
    expect(await screen.findByText('The choice is recorded.')).toBeTruthy();
    expect(posts[0]).toMatchObject({
      path: '/v1/stages/s1/choice',
      body: {
        content: { rationale: 'Cheapest', chosen_option_ids: [O1] },
        schemaVersion: '1.0.0',
        schemaHash: 'h1',
      },
    });
  });

  it.each([
    ['gate_held', /cannot confirm this option is lawful yet.*Nothing is lost/],
    ['gate_blocked', /A law blocks this choice\. Nothing was recorded/],
  ])('explains %s in plain words', async (code, re) => {
    postRes = () => json(409, { error: { code, message: 'x' } });
    await wrap(<ChoiceRoute />);
    await fill();
    await fireEvent.press(await screen.findByRole('button', { name: 'Record the choice' }));
    expect(await screen.findByText(re)).toBeTruthy();
  });

  it('shows needs_revision field hints beside the fields', async () => {
    postRes = () =>
      json(400, {
        error: { code: 'needs_revision', message: 'x', fieldErrors: { '/rationale': 'Say more.' } },
      });
    await wrap(<ChoiceRoute />);
    await fill();
    await fireEvent.press(await screen.findByRole('button', { name: 'Record the choice' }));
    expect(await screen.findByText('Say more.')).toBeTruthy();
  });
});
