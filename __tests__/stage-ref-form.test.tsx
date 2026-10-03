import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

let mockParams: Record<string, string> = { id: 'p1', stageId: 's1' };
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => mockParams,
  usePathname: () => '/x',
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));
jest.mock('../src/navigation/SessionContext', () => ({
  useSession: () => ({ status: 'member', handle: 'ann', roles: [] }),
}));

import AddRoute from '../app/problems/[id]/add';
import OptionRoute from '../app/problems/[id]/stages/[stageId]/option';
import { I18nProvider } from '../src/i18n';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Trimmed from can_policy content-schemas/stage_option (v1): the widgets the renderer lacked.
const optionSchema = {
  type: 'object',
  required: ['stage_ref', 'cost_estimate', 'how'],
  properties: {
    stage_ref: { type: 'string', 'x-ui': { widget: 'stage_ref', label_msg: 'l.stage', order: 1 } },
    cost_estimate: {
      type: 'object',
      required: ['band'],
      'x-ui': { widget: 'cost_estimate', label_msg: 'l.cost', order: 2 },
      properties: {
        band: { enum: ['none', '<1k'], 'x-ui': { widget: 'select', label_msg: 'l.band' } },
        amount: { type: 'number', 'x-ui': { widget: 'number', label_msg: 'l.amount' } },
      },
    },
    how: {
      type: 'array',
      minItems: 1,
      'x-ui': { widget: 'list', label_msg: 'l.how', order: 3 },
      items: {
        type: 'object',
        required: ['criterion_ref'],
        properties: {
          criterion_ref: {
            type: 'integer',
            'x-ui': { widget: 'criterion_ref', label_msg: 'l.crit' },
          },
        },
      },
    },
  },
};
const improveSchema = {
  type: 'object',
  required: ['improves'],
  properties: {
    type: { const: 'proposal_improvement', 'x-ui': { widget: 'hidden' } },
    improves: { type: 'string', 'x-ui': { widget: 'ref', label_msg: 'l.imp', order: 1 } },
  },
};
const msgs = {
  'l.stage': 'Stage',
  'l.cost': 'Cost',
  'l.band': 'Band',
  'l.amount': 'Amount',
  'l.how': 'How it meets criteria',
  'l.crit': 'Criterion',
  'l.imp': 'Improves',
};
let posts: { path: string; body: any }[];

beforeEach(() => {
  posts = [];
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (r) => {
    const req = r as Request;
    const path = new URL(req.url).pathname;
    if (path.startsWith('/v1/content-schemas/'))
      return json(200, {
        schema: path.includes('stage_option') ? optionSchema : improveSchema,
        messages: msgs,
        schema_version: '1.0.0',
        schema_hash: 'h',
      });
    if (path.endsWith('/reply-allowance'))
      return json(200, { limit: 4, remaining: 3, resetsAt: null });
    if (req.method === 'POST') {
      posts.push({ path, body: await req.json() });
      return json(201, {});
    }
    return json(200, {
      id: 's1',
      name: 'map_faults',
      label: 'Map the faults',
      allowedContributionTypes: ['proposal_improvement'],
      criteria: [{ ref: 1, statement: 'No outage for 30 days' }],
    });
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

it('renders stage, cost and criterion pickers and posts the stage name and criterion number', async () => {
  mockParams = { id: 'p1', stageId: 's1' };
  await wrap(<OptionRoute />);
  expect(await screen.findByLabelText(/Stage/)).toBeTruthy();
  expect(screen.queryByTestId('unsupported-stage_ref')).toBeNull();
  await fireEvent.press(await screen.findByLabelText('none'));
  await fireEvent.changeText(screen.getByLabelText(/Amount/), '12a0');
  await fireEvent.press(screen.getByLabelText(/Add/));
  await fireEvent.press(await screen.findByLabelText(/1\. No outage/));
  await fireEvent.press(await screen.findByRole('button', { name: 'Post' }));
  expect(await screen.findByText(/Sent\./)).toBeTruthy();
  expect(posts[0]!.body.content).toEqual({
    stage_ref: 'map_faults',
    cost_estimate: { band: 'none', amount: 120 },
    how: [{ criterion_ref: 1 }],
  });
});

it('opens the improvement form with the option id filled in', async () => {
  mockParams = { id: 'p1', stageId: 's1', improves: 'opt-7' };
  await wrap(<AddRoute />);
  expect(await screen.findByDisplayValue('opt-7')).toBeTruthy();
  await fireEvent.press(await screen.findByRole('button', { name: 'Post' }));
  expect(await screen.findByText(/Sent\./)).toBeTruthy();
  expect(posts[0]!.body.body.improves).toBe('opt-7');
});
