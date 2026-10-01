import { fireEvent, render, screen } from '@testing-library/react-native';

import { CivicButton, CivicHeading, StatusMessage } from '../src/components/civic';

test('button exposes role, label and calls onPress', async () => {
  const onPress = jest.fn();
  await render(<CivicButton label="Try again" accessibilityLabel="Try again" onPress={onPress} />);
  const btn = screen.getByRole('button', { name: 'Try again' });
  await fireEvent.press(btn);
  expect(onPress).toHaveBeenCalledTimes(1);
});

test('disabled button reports disabled state', async () => {
  await render(<CivicButton label="Save" accessibilityLabel="Save" disabled />);
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});

test('heading has heading role and level', async () => {
  await render(<CivicHeading level={2}>Title</CivicHeading>);
  expect(screen.getByRole('heading', { name: 'Title' }).props['aria-level']).toBe(2);
});

test('error StatusMessage is an alert, others are status', async () => {
  const { rerender } = await render(<StatusMessage state="error" message="Broken" />);
  expect(screen.getByTestId('status-message').props.role).toBe('alert');
  await rerender(<StatusMessage state="success" message="Fine" />);
  expect(screen.getByTestId('status-message').props.role).toBe('status');
});
