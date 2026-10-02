import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockMem = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockMem.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockMem.set(k, v),
  deleteItemAsync: async (k: string) => void mockMem.delete(k),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), replace: jest.fn() },
}));

import Match from '../app/match';
import { I18nProvider } from '../src/i18n';
import { matchProblems, type Tagged } from '../src/match/match';
import { emptyProfile } from '../src/profile/model';
import { loadNotForMe } from '../src/profile/notForMe';
import { saveProfile } from '../src/profile/store';

const hn = (o: Partial<Tagged['help_needed']> = {}) => ({
  skill_groups: [],
  languages: [],
  coarse_place: null,
  topics: [],
  ...o,
});
const prob = (id: string, h = hn()) => ({
  id,
  title: `Problem ${id}`,
  coarseArea: null,
  help_needed: h,
});
const P = {
  ...emptyProfile(),
  know: ['law' as const],
  languages: ['pl' as const],
  places: ['Den Haag'],
};

test('matches skill, language, place, topic; keeps server order; hides not-for-me; caps at 5', () => {
  const items = [
    prob('a', hn({ skill_groups: ['law_and_rights'] })),
    prob('b', hn({ languages: ['pl-PL'] })),
    prob('c', hn({ coarse_place: 'den_haag' })),
    prob('d', hn({ topics: ['air'] })),
    prob('none', hn({ skill_groups: ['transport'] })),
  ];
  const p = { ...P, affects: ['air' as const] };
  const m = matchProblems(p, items);
  expect(m.map((x) => x.item.id)).toEqual(['a', 'b', 'c', 'd']);
  expect(m[0].reasons).toEqual([{ kind: 'skill', value: 'law' }]);
  expect(matchProblems(p, items, new Set(['a'])).map((x) => x.item.id)).toEqual(['b', 'c', 'd']);
  const many = Array.from({ length: 9 }, (_, i) => prob(`m${i}`, hn({ languages: ['pl'] })));
  expect(matchProblems(p, many)).toHaveLength(5);
  expect(matchProblems(emptyProfile(), items)).toEqual([]);
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const page = (items: unknown[]) => ({
  items,
  nextCursor: null,
  criteria: { order: 'published_at_desc', usesEngagementSignals: false },
});

const renderMatch = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
    >
      <I18nProvider>
        <Match />
      </I18nProvider>
    </QueryClientProvider>,
  );

const requestsFor = async (profile: typeof P | null) => {
  mockMem.clear();
  if (profile) await saveProfile(profile);
  const f = jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () => json(200, page([prob('x', hn({ languages: ['pl'] }))])));
  const r = await renderMatch();
  await waitFor(() => expect(screen.queryByText('Loading public problems')).toBeNull());
  const urls = f.mock.calls.map(([req]) => `${(req as Request).method} ${(req as Request).url}`);
  const heads = f.mock.calls.map(([req]) => [...(req as Request).headers.entries()].join());
  await r.unmount();
  f.mockRestore();
  return { urls, heads };
};

afterEach(() => jest.restoreAllMocks());

test('the request is identical with and without a profile (D-80)', async () => {
  const withP = await requestsFor(P);
  const without = await requestsFor(null);
  expect(withP).toEqual(without);
  expect(withP.urls).toHaveLength(1);
  expect(withP.urls[0]).toMatch(/\/v1\/problems\?limit=50$/);
  expect(withP.urls[0]).not.toMatch(/den|haag|pl|law|region|q=/i);
});

test('with profile: shows why, not-for-me hides, plain list link shows everything', async () => {
  mockMem.clear();
  await saveProfile(P);
  jest
    .spyOn(globalThis, 'fetch')
    .mockImplementation(async () =>
      json(200, page([prob('x', hn({ languages: ['pl'] })), prob('y', hn({ topics: ['air'] }))])),
    );
  await renderMatch();
  expect(await screen.findByText('Problem x')).toBeTruthy();
  expect(screen.getByText('You speak Polski. This problem needs Polski.')).toBeTruthy();
  expect(screen.queryByText('Problem y')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Not for me: Problem x'));
  expect(await screen.findByText('Nothing fits right now')).toBeTruthy();
  expect((await loadNotForMe()).has('x')).toBe(true);
  await fireEvent.press(screen.getByLabelText('See every public problem, newest activity first'));
  expect(screen.getByText('Problem x')).toBeTruthy();
  expect(screen.getByText('Problem y')).toBeTruthy();
});

test('without profile: setup prompt and plain list link; offline: error with retry', async () => {
  mockMem.clear();
  jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('network'));
  await renderMatch();
  expect(await screen.findByText(/Add a profile to see problems you can move/)).toBeTruthy();
  expect(await screen.findByText(/could not be loaded/)).toBeTruthy();
  expect(screen.getByLabelText('Try again')).toBeTruthy();
  expect(screen.getByLabelText('See every public problem, newest activity first')).toBeTruthy();
});
