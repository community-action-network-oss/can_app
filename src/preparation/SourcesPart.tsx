import { useState } from 'react';

import { ApiError } from '../api/errors';
import { Box, CivicButton, CivicText, TextField } from '../components/civic';
import { SchemaForm } from '../forms/schema/SchemaForm';
import type { Schema, Value } from '../forms/schema/model';
import { useContentSchema } from '../forms/schema/useContentSchema';
import { mapFieldErrors, withoutFields } from '../features/submit/schemaParts';
import { useT } from '../i18n';
import { TRUST, trustOf } from './trust';
import type { usePrepActions } from './usePreparation';

type Props = {
  /** The one top-level field this part edits. Named by the route, never here. */
  fieldKey: string;
  schemaVersion: string | null;
  content: Record<string, unknown> | null;
  actions: ReturnType<typeof usePrepActions>;
};

/** Sources editor: the schema's own source_ref list, narrowed to that one field, plus a trust hint beside each link. */
export function SourcesPart({ fieldKey, schemaVersion, content, actions }: Props) {
  const t = useT();
  const q = useContentSchema('problem', { version: schemaVersion ?? undefined });
  const saved = (content?.[fieldKey] as Record<string, unknown>[] | undefined) ?? [];
  const [edit, setEdit] = useState<Value | null>(null);
  const [note, setNote] = useState('');
  const err = actions.patch.error instanceof ApiError ? actions.patch.error : undefined;

  const save = async (v: Value) => {
    await actions.patch.mutateAsync({ sources: (v[fieldKey] as Record<string, unknown>[]) ?? [] });
    setEdit(null);
  };
  const schema = q.data ? onlyField(q.data.schema as Schema, fieldKey) : undefined;

  return (
    <Box className="gap-2" testID="prep-sources">
      <CivicText variant="bodyStrong">{t('prep.sources.title')}</CivicText>
      <CivicText>{t('prep.sources.body')}</CivicText>
      {saved.map((s, i) => {
        const trust = TRUST[trustOf(s.category)];
        return (
          <Box key={i} className="gap-1" testID="prep-source">
            <CivicText>{String(s.uri ?? '')}</CivicText>
            <CivicText variant="caption">{`${trust.icon} ${t(trust.id)}`}</CivicText>
          </Box>
        );
      })}
      <CivicText variant="caption" muted>
        {t('prep.trust.help')}
      </CivicText>
      {schema && q.data ? (
        <SchemaForm
          schema={schema}
          messages={q.data.messages}
          value={edit ?? { [fieldKey]: saved }}
          onChange={setEdit}
          onSubmit={(v) => save(v)}
          submitLabel={t('form.saveDraft')}
          busy={actions.patch.isPending}
          formError={err && !err.fieldErrors ? t('common.error.generic') : undefined}
          fieldErrors={mapFieldErrors(err?.status === 400 ? err.fieldErrors : undefined)}
        />
      ) : null}
      <TextField
        label={t('prep.noSource.label')}
        hint={t('prep.noSource.hint')}
        value={note}
        onChangeText={setNote}
        maxLength={300}
      />
      <CivicButton
        variant="secondary"
        label={t('prep.noSource.save')}
        accessibilityLabel={t('prep.noSource.save')}
        disabled={!note.trim() || actions.patch.isPending}
        onPress={() => actions.patch.mutate({ noSourceNote: note.trim() })}
      />
    </Box>
  );
}

/** The schema keeping only the named field (and its definitions). Nothing here knows a field. */
function onlyField(schema: Schema, key: string): Schema {
  const others = Object.keys(schema.properties ?? {}).filter((k) => k !== key);
  return withoutFields(schema, others);
}
