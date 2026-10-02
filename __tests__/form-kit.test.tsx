import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text, TextInput } from 'react-native';
import { z } from 'zod';

import { ApiError } from '../src/api/errors';
import { CheckboxField, FormError, SubmitButton, TextField } from '../src/components/civic';
import { useServerForm } from '../src/forms/useServerForm';
import { I18nProvider } from '../src/i18n';

const schema = z.object({
  name: z.string().min(1, 'Name is needed'),
  address: z.object({ city: z.string().min(1, 'City is needed') }),
});
let mockOnSubmit = jest.fn(async (..._a: unknown[]) => {});
let mockApi: { submit: () => Promise<void>; applyApiError: (e: unknown) => void };

function Demo() {
  const { bind, submit, formError, busy, applyApiError } = useServerForm(schema, {
    defaultValues: { name: '', address: { city: '' } },
  });
  mockApi = { submit: submit((v) => mockOnSubmit(v)) as never, applyApiError };
  const { error: ne, ...name } = bind('name');
  const { error: ce, ...city } = bind('address.city');
  return (
    <>
      <FormError message={formError} />
      <TextField label="Your name" required error={ne} {...name} maxLength={300} />
      <TextField label="City" error={ce} {...city} />
      <SubmitButton label="Save" busy={busy} onPress={() => void mockApi.submit()} />
    </>
  );
}
const show = () =>
  render(
    <I18nProvider>
      <Demo />
    </I18nProvider>,
  );

const inst = (l: string) => (screen.getByLabelText(l) as unknown as { instance: never }).instance;
beforeEach(() => {
  mockOnSubmit = jest.fn(async () => {});
});

it('always renders the label and a counter, with no truncation', async () => {
  await show();
  const label = screen.getByText(/Your name/);
  expect(label.props.numberOfLines).toBeUndefined();
  expect(screen.getByText('(needed)', { exact: false })).toBeTruthy();
  expect(screen.getByText('0 / 300 characters')).toBeTruthy();
  expect(screen.getByLabelText('Your name')).toBeTruthy();
});

it('shows error text with an icon and focuses the first invalid field', async () => {
  await show();
  const focus = jest.spyOn(TextInput.prototype, 'focus');
  await fireEvent.press(screen.getByLabelText('Save'));
  await waitFor(() => expect(screen.getAllByTestId('field-error')).toHaveLength(2));
  expect(screen.getByText('Name is needed')).toBeTruthy();
  expect(screen.getAllByTestId('field-error-icon', { includeHiddenElements: true })).toHaveLength(
    2,
  );
  expect(focus).toHaveBeenCalled();
});

it('maps server fieldErrors by dotted path, keeps input, and focuses the field', async () => {
  mockOnSubmit = jest.fn(async () => {
    throw new ApiError(422, 'validation_failed', 'bad', 'validation', {
      'address.city': 'We do not know that city',
    });
  });
  await show();
  await fireEvent.changeText(screen.getByLabelText('Your name'), 'Sam');
  await fireEvent.changeText(screen.getByLabelText('City'), 'Nowhere');
  const focus = jest.spyOn(TextInput.prototype, 'focus');
  await fireEvent.press(screen.getByLabelText('Save'));
  await waitFor(() => expect(screen.getByText('We do not know that city')).toBeTruthy());
  expect(screen.getByLabelText('Your name').props.value).toBe('Sam');
  expect(screen.getByLabelText('City').props.value).toBe('Nowhere');
  await waitFor(() => expect(focus).toHaveBeenCalled());
});

it('shows a form-level alert for non-field errors and keeps input', async () => {
  mockOnSubmit = jest.fn(async () => {
    throw new ApiError(500, 'internal', 'x', 'server');
  });
  await show();
  await fireEvent.changeText(screen.getByLabelText('Your name'), 'Sam');
  await fireEvent.changeText(screen.getByLabelText('City'), 'Leeds');
  await fireEvent.press(screen.getByLabelText('Save'));
  await waitFor(() => expect(screen.getByText(/Something went wrong/)).toBeTruthy());
  expect(screen.getByLabelText('Your name').props.value).toBe('Sam');
});

it('disables the submit button while busy and says so in text', async () => {
  let release = () => {};
  mockOnSubmit = jest.fn(() => new Promise<void>((r) => (release = r)));
  await show();
  await fireEvent.changeText(screen.getByLabelText('Your name'), 'Sam');
  await fireEvent.changeText(screen.getByLabelText('City'), 'Leeds');
  await fireEvent.press(screen.getByLabelText('Save'));
  await waitFor(() => expect(screen.getByLabelText('Sending')).toBeTruthy());
  expect(screen.getByLabelText('Sending').props.accessibilityState.disabled).toBe(true);
  await act(async () => release());
});

it('checkbox shows a check mark and its error text', async () => {
  const toggle = jest.fn();
  await render(
    <I18nProvider>
      <CheckboxField label="I agree" checked onToggle={toggle} error="Please agree" />
      <Text>end</Text>
    </I18nProvider>,
  );
  expect(screen.getByText('✓')).toBeTruthy();
  expect(screen.getByText('Please agree')).toBeTruthy();
  await fireEvent.press(screen.getByRole('checkbox'));
  expect(toggle).toHaveBeenCalled();
});
