import { useMemo, useState } from 'react';

import { Box, CivicHeading, CivicText } from '../../components/civic';
import { SchemaForm } from '../../forms/schema/SchemaForm';
import type { Schema, Value } from '../../forms/schema/model';
import { withoutFields } from '../../features/submit/schemaParts';
import { useT } from '../../i18n';

export type CriteriaEditorProps = {
  /** Who owns these criteria: 'problem' or a stage id. Only used to name test ids; the host decides where to save. */
  owner: string;
  /** The one top-level list field of `schema` that holds the criteria. Named by the host, never here. */
  fieldKey: string;
  schema: Schema;
  messages: Record<string, unknown>;
  items: Value[];
  /** Persist the whole list. May throw an ApiError; the host maps its field errors back in. */
  onSave: (items: Value[]) => unknown;
  busy?: boolean;
  readOnly?: boolean;
  /** Server field errors keyed by dotted path from the schema root. */
  fieldErrors?: Record<string, string>;
  formError?: string;
  /** Neutral notes per criterion (0-based index) from a deterministic check or a DP-CRITERIA hint. */
  notes?: Record<number, string>;
};

/** Keep only the criteria list field, and lift its example out so it can be labelled synthetic here. */
function narrow(schema: Schema, key: string): { schema: Schema; example?: string } {
  const node = schema.properties?.[key];
  const others = Object.keys(schema.properties ?? {}).filter((k) => k !== key);
  const base = withoutFields(schema, others);
  if (!node) return { schema: base };
  const { good, ...guidance } = node['x-guidance'] ?? {};
  return {
    example: good,
    schema: { ...base, properties: { [key]: { ...node, 'x-guidance': guidance } } },
  };
}

/*
 +------------------------------------+
 | When is this solved                |
 | Write final acceptance criteria... |
 | 2 criteria                         |
 | Example, synthetic: "..."          |
 | (i) This is hard to check: ...     |   neutral note, never red
 | Item 1                             |
 |   [schema fields, one per line]    |
 |   [Remove item 1]                  |
 | [Add another]                      |
 | At least one final criterion...    |  (only when none)
 | [Submit]                           |
 +------------------------------------+ */
/** Reusable criteria editor: final criteria today, per-stage criteria in the stage plan editor. No stage-plan logic here. */
export function CriteriaEditor(p: CriteriaEditorProps) {
  const t = useT();
  const { schema, example } = useMemo(() => narrow(p.schema, p.fieldKey), [p.schema, p.fieldKey]);
  const [edit, setEdit] = useState<Value | null>(null);
  const value = edit ?? { [p.fieldKey]: p.items };
  const list = (value[p.fieldKey] as Value[] | undefined) ?? [];
  const notes = Object.entries(p.notes ?? {});

  return (
    <Box className="gap-3" testID={`criteria-editor-${p.owner}`}>
      <CivicText variant="bodyStrong" testID="crit-count">
        {t('crit.count', { count: list.length })}
      </CivicText>
      {list.length === 0 ? (
        <CivicText testID="crit-required">{t('crit.required')}</CivicText>
      ) : null}
      {example ? (
        <CivicText variant="caption" muted testID="crit-example">
          {t('crit.example', { text: example })}
        </CivicText>
      ) : null}
      {notes.length ? (
        <Box className="gap-1" testID="crit-notes">
          <CivicHeading level={3}>{t('crit.hint.title')}</CivicHeading>
          {notes.map(([i, text]) => (
            <CivicText key={i} variant="caption">
              {`ⓘ ${t('crit.hint.item', { n: Number(i) + 1 })} ${t('crit.hint.vague', { hint: text })}`}
            </CivicText>
          ))}
        </Box>
      ) : null}
      <SchemaForm
        schema={schema}
        messages={p.messages}
        value={value}
        onChange={setEdit}
        onSubmit={(v) => p.onSave((v[p.fieldKey] as Value[] | undefined) ?? [])}
        readOnly={p.readOnly}
        busy={p.busy}
        fieldErrors={p.fieldErrors}
        formError={p.formError}
      />
    </Box>
  );
}
