import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { I18nProvider } from '../../src/i18n';
import { SchemaForm } from '../../src/forms/schema/SchemaForm';
import { useContentSchema } from '../../src/forms/schema/useContentSchema';
import type { Schema, Value } from '../../src/forms/schema/model';
import problem from './fixtures/problem.schema.json';
import problemMessages from './fixtures/problem.messages.json';

type Over = Partial<React.ComponentProps<typeof SchemaForm>>;
let mockSubmit = jest.fn();
function Harness({
  schema,
  messages = {},
  initial = {},
  ...over
}: { schema: unknown; messages?: Record<string, unknown>; initial?: Value } & Over) {
  const [v, setV] = useState<Value>(initial);
  return (
    <SchemaForm
      schema={schema as Schema}
      messages={messages}
      value={v}
      onChange={setV}
      onSubmit={(a, u) => mockSubmit(a, u)}
      {...over}
    />
  );
}
const show = (props: React.ComponentProps<typeof Harness>, dir: 'ltr' | 'rtl' = 'ltr') =>
  render(
    <I18nProvider>
      <View style={{ direction: dir }}>
        <Harness {...props} />
      </View>
    </I18nProvider>,
  );
beforeEach(() => {
  mockSubmit = jest.fn();
});

const field = (widget: string, extra: Record<string, unknown> = {}, group = 'g1') => ({
  type: 'string',
  'x-ui': { widget, label_msg: `m.${widget}`, order: 1, group },
  ...extra,
});

it('renders the real problem schema: group label, label, why, synthetic example, progress, version', async () => {
  await show({ schema: problem, messages: problemMessages });
  expect(screen.getByText('Section 1 of 7: The condition')).toBeTruthy();
  expect(screen.getByText(/needed fields answered/)).toBeTruthy();
  expect(screen.getByText('Form version 1.0.0')).toBeTruthy();
  expect(screen.getByLabelText('What is the shared public condition?')).toBeTruthy();
  expect(screen.getByText(/^Why we ask: /)).toBeTruthy();
  expect(screen.getByText(/^Example, synthetic: Many streets/)).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Next'));
  expect(screen.getByText(/^Section 2 of 7/)).toBeTruthy();
  expect(screen.getByLabelText('Back')).toBeTruthy();
});

it('shows a field added in a new schema version with no code change', async () => {
  const bumped = JSON.parse(JSON.stringify(problem));
  bumped.version = '1.1.0';
  bumped.properties.extra_note = field('textarea', { maxLength: 100 });
  bumped.properties.extra_note['x-ui'].group = 'condition';
  bumped.properties.extra_note['x-ui'].order = 99;
  const messages = { ...problemMessages, 'm.textarea': 'A brand new question' };
  await show({ schema: bumped, messages });
  expect(screen.getByText('Form version 1.1.0')).toBeTruthy();
  expect(screen.getByLabelText('A brand new question')).toBeTruthy();
});

const everything = {
  id: 't',
  version: '2.0.0',
  type: 'object',
  required: ['name', 'link', 'pick', 'items', 'ack'],
  properties: {
    name: field('text', { minLength: 3, maxLength: 10 }),
    link: field('url'),
    when: field('date'),
    pick: { ...field('select'), enum: ['a_b', 'c'] },
    ack: {
      type: 'boolean',
      const: true,
      'x-ui': { widget: 'checkbox', label_msg: 'm.ack', order: 5, group: 'g1' },
    },
    items: {
      type: 'array',
      minItems: 1,
      maxItems: 2,
      items: { type: 'string', minLength: 3 },
      'x-ui': { widget: 'list', label_msg: 'm.items', order: 6, group: 'g1' },
    },
    rows: {
      type: 'array',
      items: { type: 'object', required: ['q'], properties: { q: field('text') } },
      'x-ui': { widget: 'list', label_msg: 'm.rows', order: 7, group: 'g1' },
    },
    box: {
      type: 'object',
      properties: { inner: field('text') },
      'x-ui': { widget: 'group', label_msg: 'm.box', order: 8, group: 'g1' },
    },
    ro: {
      type: 'string',
      'x-ui': { widget: 'readonly', label_msg: 'm.ro', order: 9, group: 'g1' },
    },
    plan: {
      type: 'array',
      'x-ui': { widget: 'stage_plan', label_msg: 'm.plan', order: 10, group: 'g1' },
    },
    area: {
      type: 'object',
      'x-ui': { widget: 'area_picker', label_msg: 'm.area', order: 11, group: 'g1' },
    },
    hid: { const: 'x', 'x-ui': { widget: 'hidden', label_msg: 'm.hid', order: 12, group: 'g1' } },
    tax: field('taxonomy_pick', { 'x-checks': { allow_unknown: true } }),
  },
};
for (const [k, n] of Object.entries(everything.properties))
  (n as { 'x-ui': { label_msg: string } })['x-ui'].label_msg = `m.${k}`;
const everyMsgs = Object.fromEntries(
  Object.keys(everything.properties).map((k) => [`m.${k}`, `L ${k}`]),
);

it('renders every widget kind and mounts slots', async () => {
  await show({
    schema: everything,
    messages: everyMsgs,
    slots: { stage_plan: () => <View testID="plan-editor" /> },
  });
  for (const l of [
    'L name',
    'L link',
    'L when',
    'L ack',
    'L items',
    'L rows',
    'L box',
    'L ro',
    'L area',
  ])
    expect(
      screen.queryAllByText(new RegExp(l)).length + screen.queryAllByLabelText(l).length,
    ).toBeGreaterThan(0);
  expect(screen.getByLabelText('c')).toBeTruthy();
  expect(screen.getByLabelText('a b')).toBeTruthy();
  expect(screen.getByTestId('plan-editor')).toBeTruthy();
  expect(screen.getByTestId('slot-area_picker')).toBeTruthy();
  expect(screen.queryByText(/L hid/)).toBeNull();
  await fireEvent.press(screen.getByLabelText('Add another: L rows'));
  expect(screen.getByLabelText('Remove item 1')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Add another: L items'));
  await fireEvent.press(screen.getByLabelText('Add another: L items'));
  expect(screen.queryAllByLabelText('Add another: L items')).toHaveLength(0); // maxItems 2
});

it('validates from the schema, shows inline errors, focuses the first invalid field and does not submit', async () => {
  await show({ schema: everything, messages: everyMsgs });
  const focus = jest.spyOn(TextInput.prototype, 'focus');
  await fireEvent.changeText(screen.getByLabelText('L name'), 'ab');
  await fireEvent.changeText(screen.getByLabelText('L link'), 'ftp://x');
  await fireEvent.press(screen.getByLabelText('Submit'));
  await waitFor(() => expect(screen.getAllByTestId('field-error').length).toBeGreaterThan(2));
  expect(screen.getByText('That is 2 characters. The least is 3.')).toBeTruthy();
  expect(screen.getByText('Use a web address that starts with https://')).toBeTruthy();
  await waitFor(() => expect(focus).toHaveBeenCalled());
  expect(mockSubmit).not.toHaveBeenCalled();
  focus.mockRestore();
});

it('submits valid answers without the reserved unknown map', async () => {
  await show({
    schema: everything,
    messages: everyMsgs,
    initial: {
      name: 'abcd',
      link: 'https://a.example',
      pick: 'c',
      items: ['abc'],
      ack: true,
      tax: 'x',
    },
  });
  await fireEvent.press(screen.getByLabelText('Submit'));
  await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
  const [answers, unknown] = mockSubmit.mock.calls[0];
  expect(answers.name).toBe('abcd');
  expect(answers.$unknown).toBeUndefined();
  expect(unknown).toEqual({});
});

it('offers "I do not know this yet" only where allowed, counts it answered and then needs the reason', async () => {
  await show({
    schema: everything,
    messages: everyMsgs,
    initial: { name: 'abcd', link: 'https://a.example', pick: 'c', items: ['abc'], ack: true },
  });
  expect(screen.getAllByLabelText('I do not know this yet')).toHaveLength(1);
  await fireEvent.press(screen.getByLabelText('I do not know this yet'));
  await fireEvent.press(screen.getByLabelText('Submit'));
  await waitFor(() => expect(screen.getByText('Say what would help find out')).toBeTruthy());
  await fireEvent.changeText(
    screen.getByLabelText(/^What would help find out\?/),
    'ask the office',
  );
  await fireEvent.press(screen.getByLabelText('Submit'));
  await waitFor(() => expect(mockSubmit).toHaveBeenCalled());
  expect(mockSubmit.mock.calls[0][1]).toEqual({ tax: 'ask the office' });
});

it('degrades an unknown widget to a placeholder, reports it, and blocks submit when required', async () => {
  const schema = {
    id: 't',
    required: ['h'],
    properties: {
      h: { type: 'string', 'x-ui': { widget: 'hologram', label_msg: 'm.h', group: 'g' } },
      ok: field('text', {}, 'g'),
    },
  };
  const seen = jest.fn();
  await show({ schema, messages: { 'm.h': 'Holo', 'm.text': 'Fine' }, onUnsupported: seen });
  expect(screen.getByText('Holo')).toBeTruthy();
  expect(screen.getAllByText(/cannot show/).length).toBe(1);
  expect(screen.getAllByText(/You cannot submit/).length).toBeGreaterThan(0);
  expect(screen.getByLabelText('Fine')).toBeTruthy();
  expect(seen).toHaveBeenCalledWith([{ path: 'h', widget: 'hologram', required: true }]);
  await fireEvent.press(screen.getByLabelText('Submit'));
  expect(mockSubmit).not.toHaveBeenCalled();
});

it('shows assisted marker, hints and server field errors; read-only hides controls', async () => {
  const schema = { id: 't', properties: { a: field('text') } };
  const hints = { a: { text: 'Check this', rule_id: 'R1', policy_version: 'base@1' } };
  await show({
    schema,
    messages: { 'm.text': 'Fine' },
    assisted: new Set(['a']),
    hints,
    fieldErrors: { a: 'Server says no' },
  });
  expect(screen.getByText(/Assisted/)).toBeTruthy();
  expect(screen.getByText('Check this')).toBeTruthy();
  expect(screen.getByText('Rule R1, policy base@1')).toBeTruthy();
  expect(screen.getByText('Server says no')).toBeTruthy();
});

it('read-only mode shows values and no buttons', async () => {
  const schema = { id: 't', properties: { a: field('text') } };
  await show({ schema, messages: { 'm.text': 'Fine' }, initial: { a: 'hello' }, readOnly: true });
  expect(screen.getByText('hello')).toBeTruthy();
  expect(screen.queryByLabelText('Submit')).toBeNull();
});

it('submitLabel replaces the final button label', async () => {
  const schema = { id: 't', properties: { a: field('text') } };
  await show({ schema, messages: { 'm.text': 'Fine' }, submitLabel: 'Save draft' });
  expect(screen.getByLabelText('Save draft')).toBeTruthy();
  expect(screen.queryByLabelText('Submit')).toBeNull();
});

it('read-only mode keeps section navigation and never submits', async () => {
  const schema = {
    id: 't',
    properties: { a: field('text', {}, 'g1'), b: field('text', {}, 'g2') },
  };
  await show({
    schema,
    messages: { 'm.text': 'Fine' },
    initial: { a: 'one', b: 'two' },
    readOnly: true,
  });
  expect(screen.getByText('one')).toBeTruthy();
  expect(screen.queryByLabelText('Back')).toBeNull();
  await fireEvent.press(screen.getByLabelText('Next'));
  expect(screen.getByText('two')).toBeTruthy();
  expect(screen.getByLabelText('Back')).toBeTruthy();
  expect(screen.queryByLabelText('Next')).toBeNull();
  expect(screen.queryByLabelText('Submit')).toBeNull();
});

it('label stays associated with its control and error in rtl', async () => {
  const schema = { id: 't', properties: { a: field('text', {}, 'g') }, required: ['a'] };
  const r = await show({ schema, messages: { 'm.text': 'Fine' } }, 'rtl');
  expect(screen.getByLabelText('Fine')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('Submit'));
  await waitFor(() => expect(screen.getByTestId('field-error')).toBeTruthy());
  expect(screen.getByTestId('field-error').props.role).toBe('alert');
  expect(r.toJSON()).toMatchSnapshot();
});

it('useContentSchema fetches by type and version and keys the cache on both', async () => {
  const body = {
    schema: { id: 'problem' },
    schema_id: 'problem',
    schema_version: '1.0.0',
    schema_hash: 'h',
    policy_version: 'p',
    messages: {},
  };
  const spy = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const { result } = await renderHook(() => useContentSchema('problem', { version: 'base@1' }), {
    wrapper,
  });
  await waitFor(() => expect(result.current.data?.schema_version).toBe('1.0.0'));
  expect(String((spy.mock.calls[0][0] as Request).url)).toContain(
    '/v1/content-schemas/problem?version=base%401',
  );
  expect(
    qc.getQueryCache().find({ queryKey: ['content-schema', 'problem', 'base@1'] }),
  ).toBeTruthy();
  spy.mockRestore();
});
