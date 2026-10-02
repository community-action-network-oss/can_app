import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  useLocalSearchParams: () => ({ id: 'p1' }),
}));

import { I18nProvider } from '../src/i18n';
import { layoutDag, neighbor } from '../src/stages/layoutDag';
import { StageSection } from '../src/stages/StageSection';

const node = (o: {
  id: string;
  name: string;
  label: string;
  ordinal: number;
  state: string;
  chip: string;
  current?: boolean;
  dependsOn?: string[];
}) => ({
  goal: 'g',
  decisionMethod: 'poster',
  needsChoice: false,
  required: true,
  criteriaTotal: 0,
  criteriaWithEvidence: 0,
  dependsOn: [],
  current: false,
  ...o,
});
const stages = [
  node({ id: 'a', name: 'facts', label: 'Facts', ordinal: 1, state: 'resolved', chip: 'Done' }),
  node({
    id: 'b',
    name: 'sol',
    label: 'Solutions',
    ordinal: 2,
    state: 'active',
    chip: 'In progress',
    current: true,
    dependsOn: ['a'],
  }),
  node({
    id: 'c',
    name: 'fund',
    label: 'Funding',
    ordinal: 3,
    state: 'ready',
    chip: 'Ready',
    current: true,
  }),
  node({
    id: 'd',
    name: 'pilot',
    label: 'Pilot',
    ordinal: 4,
    state: 'blocked',
    chip: 'Blocked',
    dependsOn: ['b'],
  }),
];
const edges = [
  { from: 'a', to: 'b' },
  { from: 'b', to: 'd' },
];
const map = (o: object = {}) => ({
  problemId: 'p1',
  problemState: 'active',
  planVersion: 1,
  label: null,
  activeStages: 2,
  stages,
  edges,
  finalCriteria: [{ ref: 1, statement: 'Canal is clean', measure: 'm', deadline: null }],
  ...o,
});
let body: unknown = map();
beforeEach(() => {
  mockPush.mockClear();
  body = map();
  jest.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  );
});
afterEach(() => jest.restoreAllMocks());
const go = async () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
    >
      <I18nProvider>
        <StageSection problemId="p1" />
      </I18nProvider>
    </QueryClientProvider>,
  );

test('layout: layers by longest path, list order within a layer, arrow keys', () => {
  const l = layoutDag(stages, edges);
  expect(l.pos.a).toEqual({ layer: 0, row: 0 });
  expect(l.pos.c).toEqual({ layer: 0, row: 1 });
  expect(l.pos.b.layer).toBe(1);
  expect(l.pos.d.layer).toBe(2);
  expect(neighbor(l, 'a', 'ArrowRight')).toBe('b');
  expect(neighbor(l, 'a', 'ArrowDown')).toBe('c');
  expect(neighbor(l, 'd', 'ArrowLeft')).toBe('b');
  expect(neighbor(l, 'a', 'ArrowLeft')).toBeNull();
});

test('graph and list show the same nodes; chips are text; several active; one h2', async () => {
  await go();
  expect(await screen.findByText('Active: 2 stages in progress')).toBeTruthy();
  for (const s of stages)
    expect(screen.getByLabelText(new RegExp(`^${s.label}, ${s.chip}`))).toBeTruthy();
  expect(screen.getAllByText('* Current')).toHaveLength(2);
  await fireEvent.press(screen.getByLabelText('List'));
  expect(screen.getByText('2 Solutions')).toBeTruthy();
  expect(screen.getByText('(Blocked)')).toBeTruthy();
  expect(screen.getByText('Starts after: Facts')).toBeTruthy();
  expect(screen.getByText('Final criteria: after Funding, Pilot')).toBeTruthy();
  const order = screen
    .getAllByText(/^\d (Facts|Solutions|Funding|Pilot)$/)
    .map((n) => n.props.children);
  expect(order).toEqual(['1 Facts', '2 Solutions', '3 Funding', '4 Pilot']);
  await fireEvent.press(screen.getAllByLabelText(/Open this stage/)[0]);
  expect(mockPush).toHaveBeenCalledWith('/problems/p1/stages/b');
});

test('one active stage chip; empty plan shows only final criteria; change is a placeholder', async () => {
  body = map({ activeStages: 1, stages: [], edges: [] });
  await go();
  expect(await screen.findByText(/no stage plan yet/)).toBeTruthy();
  expect(screen.getByText('Final criteria')).toBeTruthy();
  expect(screen.getByText('1. Canal is clean')).toBeTruthy();
  expect(screen.getByText('Active: stage')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Propose a change to the plan'));
  expect(screen.getByText(/coming soon/)).toBeTruthy();
});

test('error and 404 do not break the page', async () => {
  jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(
      new Response('{}', { status: 404, headers: { 'content-type': 'application/json' } }),
    );
  await go();
  expect(await screen.findByText(/could not be loaded/)).toBeTruthy();
});
