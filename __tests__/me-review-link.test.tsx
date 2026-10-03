import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

import MyRoute from '../app/me';
import { I18nProvider } from '../src/i18n';

it('links to the volunteer review opt-in', async () => {
  await render(
    <I18nProvider>
      <MyRoute />
    </I18nProvider>,
  );
  await fireEvent.press(screen.getByLabelText('Review as a volunteer'));
  expect(mockPush).toHaveBeenCalledWith('/review/problems');
});
