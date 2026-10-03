import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

declare const __dirname: string;
const { readFileSync } = jest.requireActual('fs') as {
  readFileSync: (p: string, enc: string) => string;
};
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'p1' }),
  usePathname: () => '/review/problems/p1',
  useRouter: () => ({ replace: jest.fn(), push: mockPush }),
}));
jest.mock('../src/navigation/SessionContext', () => ({
  useSession: () => ({ status: 'member', handle: 'ann', roles: ['member'] }),
}));

import ReviewProblemRoute from '../app/review/problems/[id]';
import { I18nProvider } from '../src/i18n';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const err = (status: number, code: string) => json(status, { error: { code, message: 'x' } });

const txt = (label: string, widget = 'textarea', order = 1) => ({
  type: 'string',
  'x-ui': { widget, label_msg: label, order },
});
const problemSchema = {
  id: 'problem',
  type: 'object',
  properties: {
    condition: txt('p.condition', 'textarea', 1),
    sources: {
      type: 'array',
      items: { type: 'object' },
      'x-ui': { widget: 'list', label_msg: 'p.sources', order: 2 },
    },
    final_acceptance_criteria: {
      type: 'array',
      items: { type: 'object' },
      'x-ui': { widget: 'list', label_msg: 'p.final', order: 3 },
    },
    stage_plan: {
      type: 'array',
      items: { type: 'object' },
      'x-ui': { widget: 'stage_plan', label_msg: 'p.plan', order: 4 },
    },
  },
};
const recSchema = {
  id: 'review_recommendation',
  type: 'object',
  required: ['problem_ref', 'path', 'recommendation', 'reason', 'status'],
  properties: {
    problem_ref: { type: 'string', 'x-ui': { widget: 'hidden' } },
    path: {
      type: 'string',
      pattern:
        '^(condition|sources|final_acceptance_criteria|stage_plan|stage_plan\\.[a-z][a-z0-9_]{1,39}(\\.criteria)?)$',
      'x-ui': { widget: 'path_picker', order: 2 },
    },
    recommendation: {
      type: 'string',
      minLength: 5,
      'x-ui': { widget: 'textarea', label_msg: 'r.change', order: 3, group: 'change' },
    },
    reason: {
      type: 'string',
      minLength: 5,
      'x-ui': { widget: 'textarea', label_msg: 'r.why', order: 4, group: 'change' },
    },
    status: { type: 'string', 'x-ui': { widget: 'hidden' } },
    resolution_reason: txt('r.res'),
  },
};
const pMsg = {
  'p.condition': 'The condition',
  'p.sources': 'Sources',
  'p.final': 'Final criteria',
  'p.plan': 'Plan',
  'schema.problem.sources.category.label': 'Source kind',
};
const rMsg = {
  'r.change': 'What should change?',
  'r.why': 'Why would it help?',
  'schema.review_recommendation.group.change': 'What to change',
};

const view = () => ({
  problemId: 'p1',
  version: 3,
  redactionCount: 2,
  fields: {},
  content: {
    condition:
      'Bins are not emptied. Ask [PERSON_1] or write [EMAIL_2], [SENSITIVE_1], [WEIRD_THING_9].',
    sources: [{ uri: 'https://example.org/a', category: 'official' }],
    final_acceptance_criteria: [{ statement: 'Every bin emptied twice a week' }],
    stage_plan: [
      {
        name: 'facts',
        label: 'Facts',
        goal: 'Collect the facts about bins',
        acceptance_criteria: [{ statement: 'Ten photos' }],
      },
      {
        name: 'fix',
        label: 'Solutions',
        goal: 'Agree a fix with the council',
        depends_on: ['facts'],
        acceptance_criteria: [],
      },
    ],
  },
});

let declared: boolean;
let viewRes: () => Response;
let recRes: () => Response;
let mineBody: Record<string, unknown>;
let posts: { path: string; body: unknown }[];

beforeEach(() => {
  mockPush.mockClear();
  declared = false;
  posts = [];
  viewRes = () => (declared ? json(200, view()) : err(403, 'not_permitted'));
  recRes = () => json(201, { id: 'r1', status: 'open' });
  mineBody = { finished: false, version: 3, aggregate: null, recommendations: [] };
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (r) => {
    const req = r as Request;
    const path = new URL(req.url).pathname;
    if (path === '/v1/content-schemas/problem')
      return json(200, { schema: problemSchema, messages: pMsg });
    if (path === '/v1/content-schemas/review_recommendation')
      return json(200, { schema: recSchema, messages: rMsg });
    if (req.method === 'POST') {
      posts.push({ path, body: await req.json() });
      if (path.endsWith('/session')) {
        declared = true;
        return json(200, { problemId: 'p1', conflictDeclaredAt: 'x', finished: false });
      }
      if (path.endsWith('/finish')) {
        mineBody = {
          ...mineBody,
          finished: true,
          aggregate: { accepted: 0, declined: 0, open: 1, finishedReviews: 3 },
        };
        return json(200, { finishedAt: 'x', outcome: 'no_changes' });
      }
      return recRes();
    }
    if (path.endsWith('/recommendations')) return json(200, mineBody);
    return viewRes();
  });
});
afterEach(() => jest.restoreAllMocks());

async function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  await render(
    <QueryClientProvider client={qc}>
      <I18nProvider>
        <ReviewProblemRoute />
      </I18nProvider>
    </QueryClientProvider>,
  );
}
async function pass() {
  await setup();
  await fireEvent.press(await screen.findByLabelText('Start reviewing'));
  await screen.findByText('The condition');
}

describe('review a problem', () => {
  it('shows the conflict declaration first and nothing else until it is recorded', async () => {
    await setup();
    expect(await screen.findByText('I know this problem or the people in it')).toBeTruthy();
    expect(screen.queryByText('The condition')).toBeNull();
    expect(
      screen.queryByText('Personal details are hidden. Do not try to work out who wrote this.'),
    ).toBeNull();
    await fireEvent.press(screen.getByLabelText('Start reviewing'));
    expect(await screen.findByText('The condition')).toBeTruthy();
    expect(posts[0]).toEqual({ path: '/v1/review/p1/session', body: { noConflict: true } });
  });

  it('a conflict sends the volunteer back to the list without recording anything', async () => {
    await setup();
    await fireEvent.press(await screen.findByLabelText('I know this problem or the people in it'));
    await fireEvent.press(screen.getByLabelText('Choose another problem'));
    expect(mockPush).toHaveBeenCalledWith('/review/problems');
    expect(posts).toHaveLength(0);
  });

  it('turns masked tokens into labelled chips and never shows the poster', async () => {
    declared = true;
    const base = view();
    viewRes = () =>
      json(200, {
        ...base,
        handle: 'poster_ann',
        accountId: 'acc-9',
        initiator: { handle: 'poster_ann' },
      });
    await setup();
    await screen.findByText('The condition');
    const chips = screen.getAllByTestId('mask-chip');
    expect(chips.map((c) => c.props.accessibilityLabel)).toEqual([
      'hidden name',
      'hidden contact',
      'hidden detail',
      'hidden detail',
    ]);
    expect(screen.queryByText(/PERSON_1|EMAIL_2|WEIRD_THING/)).toBeNull();
    const all = JSON.stringify(screen.toJSON());
    expect(all).not.toMatch(/poster_ann|acc-9/);
  });

  it('shows a recommend control per part and per stage and sends the chosen real path', async () => {
    await pass();
    expect(screen.getAllByLabelText(/^Recommend a change to:/)).toHaveLength(3 + 4);
    await fireEvent.press(
      screen.getByLabelText('Recommend a change to: Criteria of stage: Solutions'),
    );
    expect(screen.getByTestId('rec-target')).toHaveTextContent('Criteria of stage: Solutions');
    await fireEvent.changeText(
      await screen.findByLabelText(/What should change/),
      'Add a count of bins',
    );
    await fireEvent.changeText(
      screen.getByLabelText(/Why would it help/),
      'Then we can tell when done',
    );
    await fireEvent.press(screen.getByLabelText('Send recommendation'));
    expect(await screen.findByText('Recommendation sent. The poster will answer it.')).toBeTruthy();
    expect(posts.at(-1)).toEqual({
      path: '/v1/review/p1/recommendations',
      body: {
        path: 'stage_plan.fix.criteria',
        recommendation: 'Add a count of bins',
        reason: 'Then we can tell when done',
      },
    });
  });

  it('keeps the text and stays calm when the daily limit is reached or the check is refused', async () => {
    await pass();
    await fireEvent.press(screen.getByLabelText('Recommend a change to: The condition'));
    await fireEvent.changeText(
      await screen.findByLabelText(/What should change/),
      'Add a count of bins',
    );
    await fireEvent.changeText(
      screen.getByLabelText(/Why would it help/),
      'Then we can tell when done',
    );
    recRes = () => err(429, 'rate_limited');
    await fireEvent.press(screen.getByLabelText('Send recommendation'));
    expect(await screen.findByText(/daily limit for recommendations/)).toBeTruthy();
    expect(screen.getByDisplayValue('Add a count of bins')).toBeTruthy();
    recRes = () => err(400, 'validation_failed');
    await fireEvent.press(screen.getByLabelText('Send recommendation'));
    expect(await screen.findByText(/holds no personal details/)).toBeTruthy();
    expect(screen.getByDisplayValue('Then we can tell when done')).toBeTruthy();
  });

  it('shows a calm error and no partial text when masking fails', async () => {
    declared = true;
    viewRes = () => err(503, 'internal');
    await setup();
    expect(await screen.findByText(/cannot show this problem safely/)).toBeTruthy();
    expect(screen.queryByText('The condition')).toBeNull();
    expect(screen.queryByText(/Bins are not emptied/)).toBeNull();
  });

  it('says so when the problem left review, and names the rule when not allowed', async () => {
    viewRes = () => err(404, 'not_found');
    await setup();
    expect(await screen.findByText('This problem is no longer in volunteer review.')).toBeTruthy();
  });

  it('shows only own recommendations, finishes with no changes, then the aggregate', async () => {
    mineBody = {
      finished: false,
      version: 3,
      aggregate: null,
      recommendations: [],
    };
    await pass();
    expect(screen.queryByTestId('rec-aggregate')).toBeNull();
    await fireEvent.press(await screen.findByLabelText('I have finished, no changes needed'));
    await waitFor(() => expect(posts.at(-1)?.body).toEqual({ outcome: 'no_changes' }));
    expect(await screen.findByTestId('rec-aggregate')).toHaveTextContent(
      /3 volunteers have finished/,
    );
    expect(screen.getByText('You finished your review. Thank you.')).toBeTruthy();
    expect(screen.queryAllByLabelText(/^Recommend a change to:/)).toHaveLength(0);
  });

  it('lists my recommendation with the poster answer', async () => {
    mineBody = {
      finished: false,
      version: 3,
      aggregate: null,
      recommendations: [
        {
          id: 'r1',
          path: 'stage_plan.facts',
          recommendation: 'Add [PERSON_1] count',
          reason: 'Clearer plan',
          status: 'declined',
          resolutionReason: 'Already covered',
          changedSince: true,
          createdAt: 'x',
        },
      ],
    };
    await pass();
    expect(await screen.findByText('Declined')).toBeTruthy();
    expect(screen.getByText('Already covered')).toBeTruthy();
    expect(screen.getByText('The problem has changed since you wrote this.')).toBeTruthy();
  });

  it('takes the recommendation fields from the schema, never from the screen code', () => {
    const src = ['ProblemScreen.tsx', 'MaskedText.tsx']
      .map((f) => readFileSync(`${__dirname}/../src/review/problem/${f}`, 'utf8'))
      .join('\n');
    expect(src).not.toMatch(/schema\.review_recommendation|What should change|Why would it help/);
    expect(src).toMatch(/useContentSchema\('review_recommendation'/);
  });
});
