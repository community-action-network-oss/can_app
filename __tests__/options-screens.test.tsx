import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

const mockPush = jest.fn();
let mockParams: Record<string, string> = { id: 'p1', stageId: 's1' };
let mockStatus = 'member';
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  useLocalSearchParams: () => mockParams,
  usePathname: () => '/problems/p1/stages/s1/options',
  useRouter: () => ({ replace: jest.fn(), push: mockPush }),
}));
jest.mock('../src/navigation/SessionContext', () => ({
  useSession: () => ({ status: mockStatus, handle: 'ann', roles: [] }),
}));
let mockWidth = 800;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: 800, scale: 1, fontScale: 1 }),
}));

import OptionRoute from '../app/problems/[id]/stages/[stageId]/option';
import OptionsRoute from '../app/problems/[id]/stages/[stageId]/options';
import { I18nProvider } from '../src/i18n';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const schema = {
  type: 'object',
  required: ['summary'],
  properties: {
    summary: {
      type: 'string',
      minLength: 3,
      'x-ui': { widget: 'textarea', label_msg: 'l.s', order: 1 },
    },
  },
};
const dto = { schema, messages: { 'l.s': 'Summary' }, schema_version: '1.0.0', schema_hash: 'h1' };
const imp = {
  id: 'i1',
  authorHandle: 'cy',
  pendingReview: true,
  content: { summary: 'x' },
  createdAt: 'z',
};
const opt = (id: string, o: object = {}) => ({
  id,
  stageId: 's1',
  authorHandle: 'bo',
  status: 'public',
  pendingReview: false,
  forLaterStage: false,
  content: { summary: 'Weekly pickup' },
  improvements: [],
  createdAt: 'z',
  ...o,
});
const rows = (ids: string[]) =>
  ['mechanism', 'authority', 'cost', 'risks'].map((field) => ({
    field,
    cells: ids.map((optionId) => ({
      optionId,
      value: field === 'cost' ? null : `${field}-${optionId}`,
    })),
  }));

let data: object;
let allowance: object;
let posts: { path: string; body: any }[];
let postRes: () => Response;

beforeEach(() => {
  mockPush.mockClear();
  mockWidth = 800;
  mockStatus = 'member';
  posts = [];
  allowance = { limit: 4, remaining: 2, resetsAt: null };
  postRes = () => json(201, opt('new'));
  data = {
    items: [
      opt('a'),
      opt('b', { improvements: [imp] }),
      opt('c', { pendingReview: true, status: 'pending' }),
    ],
    criteria: { order: 'created_at_asc', usesEngagementSignals: false },
    comparison: { rows: rows(['a', 'b']) },
  };
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (r) => {
    const req = r as Request;
    const path = new URL(req.url).pathname;
    if (path.startsWith('/v1/content-schemas/')) return json(200, dto);
    if (path.endsWith('/reply-allowance')) return json(200, allowance);
    if (req.method === 'POST') {
      posts.push({ path, body: await req.json() });
      return postRes();
    }
    return json(200, data);
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

describe('options comparison', () => {
  it('shows a table with the four rows, the plain order line, own awaiting label, and no scoring', async () => {
    await wrap(<OptionsRoute />);
    expect(await screen.findByText('Shown in the order they were added. No ranking.')).toBeTruthy();
    expect(screen.getByTestId('options-table')).toBeTruthy();
    for (const r of ['How it would work', 'Who may do it', 'Cost', 'Risks'])
      expect(screen.getByText(r)).toBeTruthy();
    expect(screen.getByText('mechanism-a')).toBeTruthy();
    expect(screen.getAllByText('Not said').length).toBe(2);
    expect(screen.getAllByText('Awaiting review').length).toBe(2); // option c and improvement i1
    expect(screen.getByTestId('improvement-i1')).toBeTruthy();
    expect(screen.queryByText(/score|rank \d|vote|like/i)).toBeNull();
  });

  it('stacks at narrow width', async () => {
    mockWidth = 360;
    await wrap(<OptionsRoute />);
    expect(await screen.findByTestId('stack-a')).toBeTruthy();
    expect(screen.queryByTestId('options-table')).toBeNull();
  });

  it('waits for two options and shows a withdrawn placeholder', async () => {
    data = {
      items: [opt('a', { content: null, status: 'withdrawn', improvements: [imp] })],
      criteria: { order: 'created_at_asc', usesEngagementSignals: false },
      comparison: null,
    };
    await wrap(<OptionsRoute />);
    expect(await screen.findByText(/Options can be set side by side/)).toBeTruthy();
    expect(screen.getByText(/was withdrawn/)).toBeTruthy();
  });

  it('reads an option through the schema, read only', async () => {
    await wrap(<OptionsRoute />);
    await fireEvent.press((await screen.findAllByLabelText('Read option 1'))[0]!);
    expect(await screen.findByText('Summary')).toBeTruthy();
  });

  it('guests read only: no add button', async () => {
    mockStatus = 'guest';
    await wrap(<OptionsRoute />);
    await screen.findByTestId('options-table');
    expect(screen.queryByLabelText('Suggest an option')).toBeNull();
    expect(screen.queryByLabelText(/Suggest an improvement/)).toBeNull();
  });

  it('shows the empty state', async () => {
    data = {
      items: [],
      criteria: { order: 'created_at_asc', usesEngagementSignals: false },
      comparison: null,
    };
    await wrap(<OptionsRoute />);
    expect(await screen.findByText('No options yet.')).toBeTruthy();
  });
});

describe('option form', () => {
  it('renders the schema through the form, shows the allowance, and posts to the stage route', async () => {
    await wrap(<OptionRoute />);
    expect(await screen.findByText('2 of 4 replies left today')).toBeTruthy();
    await fireEvent.changeText(await screen.findByLabelText(/Summary/), 'Add bins');
    await fireEvent.press(await screen.findByRole('button', { name: 'Post' }));
    expect(await screen.findByText(/Sent\./)).toBeTruthy();
    expect(posts[0]).toMatchObject({
      path: '/v1/stages/s1/options',
      body: { content: { summary: 'Add bins' }, schemaVersion: '1.0.0', schemaHash: 'h1' },
    });
  });

  it('turns Post off at zero, keeps the draft, and handles 429 from the server', async () => {
    postRes = () =>
      json(429, {
        error: {
          code: 'reply_limit_reached',
          message: 'x',
          limit: 4,
          remaining: 0,
          resetsAt: '2026-10-04T14:30:00Z',
        },
      });
    await wrap(<OptionRoute />);
    const f = await screen.findByLabelText(/Summary/);
    await fireEvent.changeText(f, 'Add bins');
    allowance = { limit: 4, remaining: 0, resetsAt: '2026-10-04T14:30:00Z' };
    await fireEvent.press(await screen.findByRole('button', { name: 'Post' }));
    expect(await screen.findByText('You have used your replies for today')).toBeTruthy();
    expect(screen.getByDisplayValue('Add bins')).toBeTruthy();
  });

  it('says options are locked on 409', async () => {
    postRes = () => json(409, { error: { code: 'option_locked', message: 'x' } });
    await wrap(<OptionRoute />);
    await fireEvent.changeText(await screen.findByLabelText(/Summary/), 'Add bins');
    await fireEvent.press(await screen.findByRole('button', { name: 'Post' }));
    expect(await screen.findByText(/options can no longer be added/)).toBeTruthy();
  });
});
