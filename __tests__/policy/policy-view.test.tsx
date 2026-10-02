import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a) },
  useLocalSearchParams: () => ({ id: 'p1' }),
}));

import ViewRoute from '../../app/policy/[id]';
import { I18nProvider } from '../../src/i18n';
import messages from './fixtures/policy_proposal.messages.json';
import real from './fixtures/policy_proposal.schema.json';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const proposal = (o: object = {}) => ({
  id: 'p1',
  stage: 'eval',
  blockedReason: null,
  body: { change_summary: 'Tighten rule R7' },
  changeSummary: 'Tighten rule R7',
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-02T10:00:00Z',
  eval: null,
  prUrl: null,
  protectedCoreFlag: false,
  ratification: { panelStatus: 'not_started', transitional: true },
  replay: null,
  rollout: [],
  schemaVersion: '1.0.0',
  ...o,
});

let status = 200;
let body: unknown;
beforeEach(() => {
  status = 200;
  body = proposal();
  mockPush.mockClear();
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (r) => {
    const url = new URL((r as Request).url);
    if (url.pathname.startsWith('/v1/content-schemas'))
      return json(200, {
        schema: real,
        schema_id: 'policy_proposal',
        schema_version: '1.0.0',
        schema_hash: 'h1',
        policy_version: 'p1',
        messages,
      });
    return json(status, body);
  });
});
afterEach(() => jest.restoreAllMocks());

const show = async (dir: 'ltr' | 'rtl' = 'ltr') =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })}
    >
      <I18nProvider>
        <View style={{ direction: dir }}>
          <ViewRoute />
        </View>
      </I18nProvider>
    </QueryClientProvider>,
  );

it('no reports yet: stage, empty states, transitional note, test-recording notice, no vote control', async () => {
  await show();
  expect(await screen.findByText('Stage: Automated tests')).toBeTruthy();
  expect(screen.getByText(/No test results yet/)).toBeTruthy();
  expect(screen.getByText(/No replay yet/)).toBeTruthy();
  expect(screen.getByText(/test recordings, not a live model/)).toBeTruthy();
  expect(screen.getByTestId('policy-transitional')).toBeTruthy();
  expect(screen.getByText('Waiting for the panel')).toBeTruthy();
  expect(screen.getByText('No dissent recorded yet.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /vote|approve|ratify/i })).toBeNull();
});

it('failed gate shows the blocking sentence as text with an icon, and the reason', async () => {
  body = proposal({
    stage: 'eval',
    blockedReason: 'injection.recall',
    eval: [
      { name: 'harm.recall', status: 'passed' },
      { name: 'injection.recall', status: 'did_not_pass' },
    ],
  });
  await show('rtl');
  expect(await screen.findByText('✓ harm.recall: Passed')).toBeTruthy();
  expect(
    screen.getByText('✕ injection.recall: Did not pass. This blocks the change.'),
  ).toBeTruthy();
  expect(screen.getByText('Why it went back: injection.recall')).toBeTruthy();
});

it('replay totals, ratified state and rollout dates come from the payload', async () => {
  body = proposal({
    stage: 'canary',
    replay: {
      changed: 14,
      of: 400,
      expected: 11,
      unexpected: 3,
      stricter: 9,
      morePermissive: 5,
      verdict: 'ok',
    },
    ratification: { panelStatus: 'ratified', transitional: false },
    rollout: [
      { stage: 'shadow', at: '2026-10-02T12:00:00Z' },
      { stage: 'canary', at: '2026-10-03T12:00:00Z' },
    ],
  });
  await show();
  expect(await screen.findByText(/14 of 400/)).toBeTruthy();
  expect(screen.getByText('11 match the examples that motivated the change.')).toBeTruthy();
  expect(screen.getByText(/^3 were not expected/)).toBeTruthy();
  expect(screen.getByText('9 would become stricter.')).toBeTruthy();
  expect(screen.getByText('5 would become more permissive.')).toBeTruthy();
  expect(screen.getByText('Ratified')).toBeTruthy();
  expect(screen.queryByTestId('policy-transitional')).toBeNull();
  expect(screen.getByText(/^Shadow: .*2026/)).toBeTruthy();
  expect(screen.getByText(/^Canary: .*2026.*\(Current\)/)).toBeTruthy();
  expect(screen.getByText('Full: not yet')).toBeTruthy();
});

it('a blocked replay verdict shows the blocking sentence', async () => {
  body = proposal({
    stage: 'eval',
    replay: {
      changed: 1,
      of: 2,
      expected: 0,
      unexpected: 1,
      stricter: 1,
      morePermissive: 0,
      verdict: 'blocked',
    },
  });
  await show();
  expect(await screen.findByText('✕ The replay is blocked. This blocks the change.')).toBeTruthy();
});

it('shows the read-only summary from the schema', async () => {
  await show();
  expect(await screen.findByTestId('policy-summary')).toBeTruthy();
});

it('404 shows not found', async () => {
  status = 404;
  body = { error: { code: 'not_found', message: 'x' } };
  await show();
  expect(await screen.findByText('Proposal not found')).toBeTruthy();
});
