import { fireEvent, render, screen } from '@testing-library/react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fs = jest.requireActual<any>('fs');
const root = jest.requireActual<{ resolve: (...a: string[]) => string }>('path').resolve('.');
const mockMem = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: async (k: string) => mockMem.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => void mockMem.set(k, v),
  deleteItemAsync: async (k: string) => void mockMem.delete(k),
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...a: unknown[]) => mockPush(...a), replace: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native/Libraries/Share/Share', () => ({ share: jest.fn(async () => ({})) }));

import Know from '../app/profile/know';
import Review from '../app/profile/index';
import { I18nProvider } from '../src/i18n';
import { emptyProfile, fromFile, toFile } from '../src/profile/model';
import { deleteProfile, loadProfile, saveProfile } from '../src/profile/store';

const wrap = (ui: React.ReactElement) => render(<I18nProvider>{ui}</I18nProvider>);
beforeEach(() => {
  mockMem.clear();
  mockPush.mockClear();
});

test('nothing is written until Next; Skip writes nothing', async () => {
  await wrap(<Know />);
  await fireEvent.press(await screen.findByLabelText('Law and rights'));
  expect(mockMem.size).toBe(0);
  await fireEvent.press(screen.getByLabelText('Skip this step'));
  expect(mockMem.size).toBe(0);
  await fireEvent.press(screen.getByLabelText('Next'));
  expect((await loadProfile()).know).toEqual(['law']);
  expect(mockPush).toHaveBeenCalledWith('/profile/give');
});

test('file round trip and bad file', () => {
  const p = { ...emptyProfile(), know: ['care' as const], places: ['Amsterdam'] };
  expect(fromFile(toFile(p))).toEqual(p);
  expect(fromFile('{"can_profile":1,"profile":{"know":["nope"]}}')).toBeNull();
  expect(fromFile('not json')).toBeNull();
});

test('delete wipes the store; review reads empty', async () => {
  await saveProfile({ ...emptyProfile(), languages: ['pl'] });
  await deleteProfile();
  expect(mockMem.size).toBe(0);
  await wrap(<Review />);
  expect(await screen.findByText(/Your profile is empty/)).toBeTruthy();
});

test('no fetch carries profile data (D-80) and src/profile never imports the api layer', async () => {
  const f = jest.spyOn(globalThis, 'fetch');
  await saveProfile({ ...emptyProfile(), know: ['law'], places: ['Amsterdam'] });
  const r = await wrap(<Review />);
  await fireEvent.press(await screen.findByLabelText('Delete my profile'));
  await fireEvent.press(screen.getByLabelText('Yes, delete it'));
  expect(f).not.toHaveBeenCalled();
  r.unmount();
  for (const dir of ['src/profile', 'app/profile']) {
    for (const file of fs.readdirSync(`${root}/${dir}`) as string[]) {
      const src = fs.readFileSync(`${root}/${dir}/${file}`, 'utf8') as string;
      expect(src).not.toMatch(/src\/api|\.\.\/api|fetch\(|openapi-fetch|XMLHttpRequest|sendBeacon/);
    }
  }
});
