import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ReactNode } from 'react';

let mockStatus = 'member';
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  useLocalSearchParams: () => ({ id: 'p1', stageId: 's1' }),
  usePathname: () => '/x',
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
}));
jest.mock('../src/navigation/SessionContext', () => ({
  useSession: () => ({ status: mockStatus, handle: 'ann', roles: [] }),
}));

import { I18nProvider } from '../src/i18n';
import { StageControls } from '../src/stages/controls/StageControls';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
let st: any;
let posts: { path: string; body: any }[];
let postRes: () => Response;
beforeEach(() => {
  mockStatus = 'member';
  posts = [];
  postRes = () => json(200, {});
  st = { id: 's1', state: 'ready', chip: 'Ready', allowedStageTransitions: [] };
  jest.spyOn(globalThis, 'fetch').mockImplementation(async (r) => {
    const req = r as Request;
    const path = new URL(req.url).pathname;
    if (req.method === 'POST') {
      const text = await req.text();
      posts.push({ path, body: text ? JSON.parse(text) : null });
      return postRes();
    }
    return json(200, st);
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
const tr = (to: string, requires: string[] = []) => ({ to, requires, mode: 'direct' });

describe('stage controls', () => {
  it('shows exactly the actions the API allows, and starts a ready stage', async () => {
    st.allowedStageTransitions = [tr('active'), tr('blocked', ['blocker', 'attempts'])];
    await wrap(<StageControls stageId="s1" />);
    await fireEvent.press(await screen.findByLabelText('Start this stage'));
    expect(screen.getByLabelText('Mark as blocked')).toBeTruthy();
    expect(screen.queryByLabelText('Send evidence for checking')).toBeNull();
    await screen.findByTestId('stage-controls');
    expect(posts[0]).toMatchObject({ path: '/v1/stages/s1/start' });
  });

  it('shows nothing for a guest', async () => {
    mockStatus = 'guest';
    st.allowedStageTransitions = [tr('active')];
    await wrap(<StageControls stageId="s1" />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('stage-controls')).toBeNull();
    expect(screen.queryByLabelText('Start this stage')).toBeNull();
  });

  it('shows no buttons when the API lists none', async () => {
    await wrap(<StageControls stageId="s1" />);
    await screen.findByTestId('stage-controls');
    expect(screen.queryByLabelText('Start this stage')).toBeNull();
  });

  it('shows Checking evidence while the stage is resolving', async () => {
    st = { ...st, state: 'resolving', chip: 'Checking evidence' };
    await wrap(<StageControls stageId="s1" />);
    expect(await screen.findByText(/The evidence is being checked/)).toBeTruthy();
    expect(screen.queryByText(/moderator/i)).toBeNull();
  });

  it('collects what a block needs, sends lists as lists, and shows server field errors', async () => {
    st = {
      ...st,
      state: 'active',
      allowedStageTransitions: [tr('blocked', ['blocker', 'attempts'])],
    };
    postRes = () =>
      json(400, {
        error: { code: 'validation_failed', message: 'x', fieldErrors: { blocker: 'Too vague.' } },
      });
    await wrap(<StageControls stageId="s1" />);
    await fireEvent.press(await screen.findByLabelText('Mark as blocked'));
    await fireEvent.press(screen.getAllByLabelText('Mark as blocked')[0]!);
    expect((await screen.findAllByText('This field is needed')).length).toBe(2);
    await fireEvent.changeText(screen.getByLabelText('blocker'), 'Permit rule');
    await fireEvent.changeText(screen.getByLabelText('attempts'), 'asked city\nasked ward');
    await fireEvent.press(screen.getAllByLabelText('Mark as blocked')[0]!);
    expect(await screen.findByText('Too vague.')).toBeTruthy();
    expect(posts[0]!.body).toMatchObject({
      blocker: 'Permit rule',
      attempts: ['asked city', 'asked ward'],
    });
  });

  it('explains unblock on a stuck problem in plain words', async () => {
    st = {
      ...st,
      state: 'blocked',
      allowedStageTransitions: [tr('active', ['clearedNote', 'evidence'])],
    };
    postRes = () => json(409, { error: { code: 'problem_not_active', message: 'x' } });
    await wrap(<StageControls stageId="s1" />);
    await fireEvent.press(await screen.findByLabelText('Clear the block'));
    await fireEvent.changeText(screen.getByLabelText('cleared note'), 'Fixed');
    await fireEvent.changeText(screen.getByLabelText('evidence'), 'https://x.org/a');
    await fireEvent.press(screen.getAllByLabelText('Clear the block')[0]!);
    expect(await screen.findByText(/This problem is not active right now/)).toBeTruthy();
  });
});
