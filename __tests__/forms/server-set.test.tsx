import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { I18nProvider } from '../../src/i18n';
import { SchemaForm } from '../../src/forms/schema/SchemaForm';
import type { Schema, Value } from '../../src/forms/schema/model';
import choice from './fixtures/stage_choice.schema.json';
import choiceMessages from './fixtures/stage_choice.messages.json';

const submit = jest.fn();
function H({ initial = {} }: { initial?: Value }) {
  const [v, setV] = useState<Value>(initial);
  return (
    <SchemaForm
      schema={choice as unknown as Schema}
      messages={choiceMessages}
      value={v}
      onChange={setV}
      onSubmit={(a) => submit(a)}
    />
  );
}
const open = (initial?: Value) =>
  render(
    <I18nProvider>
      <H initial={initial} />
    </I18nProvider>,
  );
const next = async () => fireEvent.press(await screen.findByRole('button', { name: 'Next' }));
/** Walk to the section that holds the legal group (or the last one if it is absent). */
const toLegal = async () => {
  for (let i = 0; i < 6 && !screen.queryByTestId('legal-gate-view'); i++)
    if (screen.queryByRole('button', { name: 'Next' })) await next();
};

beforeEach(() => submit.mockClear());

describe('server-set fields (stage_choice 2.0.0)', () => {
  it('shows no legal section or editable legal fields, and submits no legal_gate_record', async () => {
    await open({
      stage_ref: 'design_prevention',
      decision_method: 'steward',
      decider_role: 'Problem poster',
      authority: 'The stage plan names the poster.',
      rationale: 'Cheapest and lawful, after community input.',
      legal_gate_record: { layer: 'both', result: 'passed' },
    });
    await toLegal();
    expect(screen.queryByTestId('legal-gate-view')).toBeTruthy();
    expect(screen.queryByLabelText(/constraint/i)).toBeNull();
    while (screen.queryByRole('button', { name: 'Next' })) await next();
    await fireEvent.press(await screen.findByRole('button', { name: /Send|Submit|Record/i }));
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0][0]).not.toHaveProperty('legal_gate_record');
  });

  it('hides a server-set field the host passes no value for', async () => {
    await open();
    await toLegal();
    expect(screen.queryByTestId('legal-gate-view')).toBeNull();
    expect(screen.queryByLabelText(/constraint/i)).toBeNull();
  });

  it('renders a host value read-only as findings with plain labels and ids, no article text', async () => {
    await open({
      legal_gate_record: {
        findings: [
          {
            layer: 'L4',
            finding: 'unjudged',
            blocks: false,
            article_ids: ['nl-art-12'],
            corpus_version: 'nl@1',
          },
          { layer: 'L6', finding: 'weird', blocks: false, article_ids: [], corpus_version: null },
        ],
      },
    });
    await toLegal();
    expect(await screen.findByText('Found a rule that still needs a legal check')).toBeTruthy();
    expect(screen.getByText('Not checked yet')).toBeTruthy();
    expect(screen.getByText('Articles: nl-art-12')).toBeTruthy();
    expect(screen.getByText('Law collection version: nl@1')).toBeTruthy();
  });
});
