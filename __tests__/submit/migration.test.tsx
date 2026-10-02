import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { View } from 'react-native';

const mockMem = new Map<string, string>();
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockMem.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockMem.set(k, v),
  deleteItemAsync: async (k: string) => void mockMem.delete(k),
}));
jest.mock('expo-router', () => ({
  router: {
    push: (...a: unknown[]) => mockPush(...a),
    replace: (...a: unknown[]) => mockReplace(...a),
  },
  useLocalSearchParams: () => ({ id: 'd1' }),
}));

import { clear, load, resetMemory, save } from '../../src/drafts/draftStore';
import { I18nProvider } from '../../src/i18n';
import { MigrationBanner } from '../../src/features/submit/MigrationBanner';
import { MigrationScreen } from '../../src/features/submit/MigrationScreen';
import { applyPlan, type Plan } from '../../src/features/submit/migrationPlan';
import { rememberVersion } from '../../src/features/submit/saveDraft';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const field = (label: string) => ({ type: 'string', 'x-ui': { widget: 'text', label_msg: label } });
const schemaDto = (version: string, props: object, messages: object) => ({
  schema: { type: 'object', properties: props },
  schema_id: 'problem',
  schema_version: version,
  schema_hash: `h${version}`,
  policy_version: 'p',
  messages,
});
const oldDto = schemaDto(
  '1.0.0',
  { place: field('m.place'), note: field('m.note') },
  { 'm.place': 'Where', 'm.note': 'Old note' },
);
const newDto = schemaDto(
  '2.0.0',
  { area: field('m.area'), reach: field('m.reach') },
  { 'm.area': 'Area', 'm.reach': 'Reach' },
);
const stamp = (v: string) => ({ schema_id: 'problem', schema_version: v, schema_hash: `h${v}` });
const major = (over: Partial<Plan> = {}): Plan => ({
  bump: 'major',
  state: 'pinned',
  current: stamp('1.0.0'),
  target: stamp('2.0.0'),
  grace_ends_at: '2999-01-01T00:00:00Z',
  new_required: ['reach'],
  dropped: [],
  mapping: [
    {
      from_path: 'place',
      to_path: 'area',
      transform: 'split',
      needs_confirmation: true,
      carried_value: 'Oak St' as never,
    },
    {
      from_path: 'note',
      to_path: '',
      transform: 'drop',
      needs_confirmation: true,
      carried_value: 'x' as never,
    },
  ],
  ...over,
});

let calls: { method: string; url: string; body?: any }[];
let plan: () => Response;
beforeEach(() => {
  mockMem.clear();
  resetMemory();
  mockPush.mockClear();
  mockReplace.mockClear();
  calls = [];
  rememberVersion('d1', 3);
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (r) => {
    const req = r as Request;
    const u = new URL(req.url);
    calls.push({
      method: req.method,
      url: req.url,
      body: req.method === 'GET' ? undefined : await req.clone().json(),
    });
    if (u.pathname.startsWith('/v1/content-schemas'))
      return json(200, u.searchParams.get('version') === '2.0.0' ? newDto : oldDto);
    if (req.method === 'POST')
      return json(200, {
        id: 'd1',
        version: 4,
        state: 'draft',
        updatedAt: 'x',
        schemaId: 'problem',
        schemaVersion: '2.0.0',
        schemaHash: 'h2.0.0',
      });
    return plan();
  });
});
afterEach(async () => {
  jest.restoreAllMocks();
  await clear();
});

const ui = (el: React.ReactElement, dir: 'ltr' | 'rtl' = 'ltr') =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
    >
      <I18nProvider>
        <View style={{ direction: dir }}>{el}</View>
      </I18nProvider>
    </QueryClientProvider>,
  );

it('minor bump: one-line notice, no buttons', async () => {
  plan = () => json(200, major({ bump: 'minor', state: 'migrated' }));
  await ui(<MigrationBanner id="d1" />);
  expect(await screen.findByText(/New optional fields were added/)).toBeTruthy();
  expect(screen.queryByLabelText('Move to the new version')).toBeNull();
});

it('major pinned: what changed, grace date, Move and Stay; Stay dismisses', async () => {
  plan = () => json(200, major());
  await ui(<MigrationBanner id="d1" />);
  expect(await screen.findByText(/You started on version 1.0.0/)).toBeTruthy();
  expect(await screen.findByText(/New or changed: .*Reach.*Area/)).toBeTruthy();
  expect(screen.getByText(/You can stay on your version until .*2999/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Move to the new version'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/submit/[id]/migrate', params: { id: 'd1' } });
  await fireEvent.press(screen.getByLabelText('Stay on my version'));
  expect(screen.queryByTestId('migration-banner')).toBeNull();
});

it('after the grace date Stay is not offered', async () => {
  plan = () => json(200, major({ grace_ends_at: '2000-01-01T00:00:00Z' }));
  await ui(<MigrationBanner id="d1" />);
  expect(await screen.findByText(/time to stay on your version has ended/)).toBeTruthy();
  expect(screen.getByLabelText('Move to the new version')).toBeTruthy();
  expect(screen.queryByLabelText('Stay on my version')).toBeNull();
});

it('unavailable: calm note, draft stays pinned', async () => {
  plan = () => json(409, { error: { code: 'schema_migration_unavailable', message: 'x' } });
  await ui(<MigrationBanner id="d1" />);
  expect(await screen.findByTestId('migration-unavailable')).toBeTruthy();
});

it('major: every row is confirmed, new fields are listed, then POST restamps the local draft', async () => {
  plan = () => json(200, major());
  void save({
    schemaId: 'problem',
    schemaVersion: '1.0.0',
    schemaHash: 'h1.0.0',
    body: { place: 'Oak St', note: 'x' },
  });
  await ui(<MigrationScreen id="d1" />, 'rtl');
  const go = await screen.findByLabelText('Move to the new version');
  expect(screen.getByText(/You will answer these after you move: Reach/)).toBeTruthy();
  expect(go.props.accessibilityState?.disabled ?? go.props['aria-disabled']).toBeTruthy();
  await fireEvent.press(go);
  expect(calls.some((c) => c.method === 'POST')).toBe(false);
  await fireEvent.press(screen.getByLabelText(/Move my answer from Where to Area: Oak St/));
  await fireEvent.press(screen.getByLabelText(/Remove my answer for Old note: x/));
  await fireEvent.press(screen.getByLabelText('Move to the new version'));
  await waitFor(() => expect(mockReplace).toHaveBeenCalled());
  const post = calls.find((c) => c.method === 'POST')!;
  expect(post.body).toEqual({
    expectedVersion: 3,
    mappings: [
      { from_path: 'place', to_path: 'area' },
      { from_path: 'note', to_path: '' },
    ],
  });
  const d = await load();
  expect(d?.schemaVersion).toBe('2.0.0');
  expect(d?.body).toEqual({ area: 'Oak St' });
});

it('applyPlan leaves skipped rows alone', () => {
  const p = major();
  expect(applyPlan({ place: 'a', note: 'b' }, p, new Set())).toEqual({ place: 'a', note: 'b' });
});
