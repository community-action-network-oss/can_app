import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockPush = jest.fn();
let mockParams: Record<string, string> = { id: 'p1' };
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  useLocalSearchParams: () => mockParams,
  usePathname: () => '/problems/p1/add',
  useRouter: () => ({ replace: jest.fn(), push: mockPush }),
}));
jest.mock('../src/navigation/SessionContext', () => ({
  useSession: () => ({ status: 'member', handle: 'ann', roles: ['member'] }),
}));

import AddRoute from '../app/problems/[id]/add';
import { ContributionList } from '../src/contributions/ContributionList';
import { I18nProvider } from '../src/i18n';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const errBody = (status: number, code: string, extra: object = {}) =>
  json(status, { error: { code, message: 'x', ...extra } });

const schema = {
  id: 'contribution.observation',
  type: 'object',
  required: ['type', 'target', 'claim'],
  properties: {
    type: { const: 'observation', 'x-ui': { widget: 'hidden' } },
    target: { type: 'string', 'x-ui': { widget: 'hidden' } },
    claim: {
      type: 'string',
      minLength: 5,
      'x-ui': { widget: 'textarea', label_msg: 'c.claim', order: 3 },
    },
  },
};
const dto = {
  schema,
  messages: { 'c.claim': 'Your claim' },
  schema_version: '1.0.0',
  schema_hash: 'h1',
  schema_id: 'contribution.observation',
  policy_version: 'v1',
};

const item = (o: object) => ({
  id: 'c1',
  type: 'observation',
  status: 'accepted',
  authorHandle: 'bo',
  createdAt: '2026-10-01T10:00:00Z',
  body: { claim: 'Bags piled up' },
  evidenceRefs: [],
  forLaterStage: false,
  stageId: null,
  tombstonedAt: null,
  answersContributionId: null,
  ...o,
});

let allowance: () => Response;
let posts: { path: string; body: any }[];
let postRes: () => Response;
let listItems: object[];
let allowed: string[];

beforeEach(() => {
  mockPush.mockClear();
  mockParams = { id: 'p1' };
  posts = [];
  allowed = ['observation', 'evidence', 'proposed_solution'];
  listItems = [];
  allowance = () => json(200, { limit: 4, remaining: 2, resetsAt: null });
  postRes = () => json(201, item({ status: 'pending_review' }));
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (r) => {
    const req = r as Request;
    const path = new URL(req.url).pathname;
    if (path === '/v1/problems/p1')
      return json(200, { id: 'p1', allowedContributionTypes: allowed });
    if (path === '/v1/stages/s1')
      return json(200, {
        id: 's1',
        chip: 'Open',
        name: 'map',
        label: 'Map',
        criteria: [],
        allowedContributionTypes: ['risk'],
      });
    if (path.startsWith('/v1/content-schemas/')) return json(200, dto);
    if (path.endsWith('/reply-allowance')) return allowance();
    if (req.method === 'POST') {
      posts.push({ path, body: await req.json() });
      return postRes();
    }
    return json(200, { criteria: {}, items: listItems });
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

async function writeClaim() {
  await fireEvent.press(await screen.findByRole('radio', { name: 'Observations' }));
  await fireEvent.changeText(await screen.findByLabelText(/Your claim/), 'Bags are piled up here');
}

describe('contribution list', () => {
  it('groups by type with plain headings, labels own pending and later-stage items, shows tombstones, and no counts', async () => {
    listItems = [
      item({ id: 'a', status: 'pending_review' }),
      item({
        id: 'b',
        type: 'risk',
        forLaterStage: true,
        evidenceRefs: [{ url: 'https://x.org/a', category: 'news', note: null }],
      }),
      item({ id: 'c', status: 'tombstoned', tombstonedAt: '2026-10-02T10:00:00Z', body: null }),
    ];
    await wrap(<ContributionList problemId="p1" problemLevel />);
    expect(await screen.findByText('Observations')).toBeTruthy();
    expect(screen.getByText('Risks')).toBeTruthy();
    expect(screen.getByText('Awaiting review')).toBeTruthy();
    expect(screen.getByText('For a later stage')).toBeTruthy();
    expect(screen.getByTestId('contrib-tombstone')).toBeTruthy();
    expect(screen.getByLabelText('https://x.org/a (opens in a new tab)')).toBeTruthy();
    expect(screen.queryByText(/like|vote|upvote|\b\d+ (replies|contributions)\b/i)).toBeNull();
  });

  it('shows the calm empty state', async () => {
    await wrap(<ContributionList problemId="p1" problemLevel />);
    expect(await screen.findByText('No contributions yet. Add the first.')).toBeTruthy();
  });
});

describe('add contribution', () => {
  it('shows the allowance and the nudge before anything is written, and offers exactly the API types', async () => {
    await wrap(<AddRoute />);
    expect(await screen.findByText('2 of 4 replies left today')).toBeTruthy();
    expect(screen.getByText(/Make it count/)).toBeTruthy();
    expect(screen.queryByText(/Next reply possible/)).toBeNull();
    const radios = await screen.findAllByRole('radio');
    expect(radios.map((r) => r.props.accessibilityLabel)).toEqual([
      'Observations',
      'Evidence',
      'Proposed solutions',
    ]);
    expect(screen.queryByTestId('schema-form')).toBeNull();
  });

  it('uses the stage types when a stage is given and renders the schema form without field names', async () => {
    mockParams = { id: 'p1', stageId: 's1' };
    await wrap(<AddRoute />);
    const radios = await screen.findAllByRole('radio');
    expect(radios.map((r) => r.props.accessibilityLabel)).toEqual(['Risks']);
    await fireEvent.press(radios[0]);
    expect(await screen.findByLabelText(/Your claim/)).toBeTruthy();
  });

  it('with 1 left also shows when the next slot frees', async () => {
    allowance = () => json(200, { limit: 4, remaining: 1, resetsAt: '2026-10-03T14:30:00Z' });
    await wrap(<AddRoute />);
    expect(await screen.findByText('1 of 4 replies left today')).toBeTruthy();
    expect(screen.getByText(/^Next reply possible at /)).toBeTruthy();
  });

  it('posts, then refetches the allowance', async () => {
    let n = 0;
    allowance = () =>
      json(200, { limit: 4, remaining: n++ === 0 ? 2 : 1, resetsAt: '2026-10-03T14:30:00Z' });
    await wrap(<AddRoute />);
    await screen.findByText('2 of 4 replies left today');
    await writeClaim();
    await fireEvent.press(screen.getByLabelText('Post'));
    expect(await screen.findByText(/Sent\./)).toBeTruthy();
    expect(await screen.findByText('1 of 4 replies left today')).toBeTruthy();
    expect(posts[0]).toEqual({
      path: '/v1/contributions/by-problem/p1',
      body: expect.objectContaining({
        type: 'observation',
        body: { type: 'observation', target: 'p1', claim: 'Bags are piled up here' },
        schemaVersion: '1.0.0',
        schemaHash: 'h1',
      }),
    });
  });

  it('at 0 left disables Post, says why with the reset time, and keeps the form editable', async () => {
    allowance = () => json(200, { limit: 4, remaining: 0, resetsAt: '2026-10-03T14:30:00Z' });
    await wrap(<AddRoute />);
    expect(await screen.findByText('You have used your replies for today')).toBeTruthy();
    expect(screen.getByText('No replies left today')).toBeTruthy();
    expect(screen.getByText(/^You can reply again at /)).toBeTruthy();
    expect(screen.getByText('Your draft is kept.')).toBeTruthy();
    await writeClaim();
    expect(screen.getByLabelText(/Your claim/).props.value).toBe('Bags are piled up here');
    expect(screen.getByLabelText('Post').props.accessibilityState.disabled).toBe(true);
    expect(posts).toHaveLength(0);
  });

  it('handles 429 reply_limit_reached from another device and keeps the text', async () => {
    await wrap(<AddRoute />);
    await screen.findByText('2 of 4 replies left today');
    await writeClaim();
    postRes = () =>
      errBody(429, 'reply_limit_reached', {
        limit: 4,
        remaining: 0,
        resetsAt: '2026-10-03T14:30:00Z',
      });
    allowance = () => json(200, { limit: 4, remaining: 0, resetsAt: '2026-10-03T14:30:00Z' });
    await fireEvent.press(screen.getByLabelText('Post'));
    expect(await screen.findByText('You have used your replies for today')).toBeTruthy();
    expect(screen.getByLabelText(/Your claim/).props.value).toBe('Bags are piled up here');
    expect(screen.getByLabelText('Post').props.accessibilityState.disabled).toBe(true);
  });

  it('shows the cooldown in minutes, keeps the text and turns Post off', async () => {
    await wrap(<AddRoute />);
    await screen.findByText('2 of 4 replies left today');
    await writeClaim();
    postRes = () => errBody(429, 'cooldown_active', { retryAfterSeconds: 120 });
    await fireEvent.press(screen.getByLabelText('Post'));
    expect(
      (await screen.findAllByText('You can add another contribution in about 2 minutes.')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Your claim/).props.value).toBe('Bags are piled up here');
    expect(screen.getByLabelText('Post').props.accessibilityState.disabled).toBe(true);
  });

  it('names the stage state on a disallowed pair', async () => {
    mockParams = { id: 'p1', stageId: 's1' };
    await wrap(<AddRoute />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Risks' }));
    await fireEvent.changeText(await screen.findByLabelText(/Your claim/), 'Too risky to do');
    postRes = () => errBody(409, 'not_allowed_in_state');
    await fireEvent.press(screen.getByLabelText('Post'));
    expect(
      await screen.findByText(
        'This stage is Open. That kind of contribution is not open right now.',
      ),
    ).toBeTruthy();
  });

  it('maps field errors to the field and lets a review flag be kept as written', async () => {
    await wrap(<AddRoute />);
    await screen.findByText('2 of 4 replies left today');
    await writeClaim();
    postRes = () =>
      errBody(400, 'validation_failed', {
        fieldErrors: { '/body/claim': 'Remove the phone number' },
        flags: [
          { id: 'f1', field: '/body/claim', kind: 'person', ruleId: 'r', severity: 'review' },
        ],
      });
    await fireEvent.press(screen.getByLabelText('Post'));
    expect(await screen.findByText('Remove the phone number')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Keep as written: Your claim'));
    postRes = () => json(201, item({ status: 'pending_review' }));
    await fireEvent.press(screen.getByLabelText('Post'));
    await screen.findByText(/Sent\./);
    expect(posts.at(-1)?.body.keptFlagIds).toEqual(['f1']);
  });
});
