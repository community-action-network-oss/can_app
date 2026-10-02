import { render, screen } from '@testing-library/react-native';

import { AppShell, EmergencyNotice } from '../src/components/civic';
import { I18nProvider } from '../src/i18n';
import { SessionContext, type Session } from '../src/navigation/SessionContext';

let mockPath = '/report';
jest.mock('expo-router', () => {
  const { View } = jest.requireActual('react-native');
  return {
    usePathname: () => mockPath,
    Link: ({ children }: { children: React.ReactElement }) => children,
    __esModule: true,
    View,
  };
});
jest.mock('expo-router/head', () => ({ __esModule: true, default: () => null }));

async function shell(session: Session) {
  return render(
    <I18nProvider>
      <SessionContext.Provider value={session}>
        <AppShell>{null}</AppShell>
      </SessionContext.Provider>
    </I18nProvider>,
  );
}

const hasReview = () => screen.queryAllByText('Review').length > 0;

test.each([
  [{ status: 'member', roles: ['auditor'] }, true],
  [{ status: 'member', roles: ['labeler'] }, true],
  [{ status: 'member', roles: [] }, false],
  [{ status: 'guest' }, false],
] as [Session, boolean][])('Review area for %j is %s', async (session, shown) => {
  await shell(session);
  expect(hasReview()).toBe(shown);
  expect(screen.getAllByText('Discover').length).toBeGreaterThan(0);
});

test('skip link is the first focusable element', async () => {
  const { toJSON } = await shell({ status: 'guest' });
  const first = JSON.stringify((toJSON() as { children: unknown[] }).children[0]);
  expect(first).toContain('Skip to main content');
});

test('active area exposes selected state, others do not', async () => {
  await shell({ status: 'guest' });
  expect(screen.getByRole('link', { name: 'Report', selected: true })).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Discover', selected: false })).toBeTruthy();
});

test('EmergencyNotice renders with no network call', async () => {
  const spy = jest.spyOn(globalThis, 'fetch');
  await render(
    <I18nProvider>
      <EmergencyNotice />
    </I18nProvider>,
  );
  expect(
    screen.getByText('If someone is in danger, contact your local emergency number.'),
  ).toBeTruthy();
  expect(spy).not.toHaveBeenCalled();
});

test('no count badges: nav labels are plain text', async () => {
  await shell({ status: 'member', roles: ['auditor'] });
  expect(screen.queryByText(/\d/)).toBeNull();
});
