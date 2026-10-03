import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';

import { Box, CivicButton, CivicHeading, StatusMessage } from '../components/civic';
import { useStage, type PostFailure } from '../contributions/api';
import { SchemaForm } from '../forms/schema/SchemaForm';
import type { Schema, Value } from '../forms/schema/model';
import { stageChoices } from '../forms/schema/stageChoices';
import { useContentSchema } from '../forms/schema/useContentSchema';
import { useT } from '../i18n';
import { postChoice } from './api';
import { optionLabel } from './optionLabel';

// '/a/b' -> 'a.b'
const path = (p: string) => p.split('/').filter(Boolean).join('.');

// WF-DECREC-2 as the "make the choice" action of WF-STAGE-1. A shell: the fields come from the stage_choice schema.
export function ChoiceForm({ problemId, stageId }: { problemId: string; stageId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const schemaQ = useContentSchema('stage_choice');
  const stage = useStage(stageId);
  const [value, setValue] = useState<Value>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [fail, setFail] = useState<PostFailure | null>(null);

  const back = () =>
    router.push({
      pathname: '/problems/[id]/stages/[stageId]/decision',
      params: { id: problemId, stageId },
    });

  const onSubmit = async (answers: Value) => {
    if (!schemaQ.data) return;
    setBusy(true);
    setFail(null);
    const f = await postChoice(stageId, answers, {
      schemaVersion: schemaQ.data.schema_version,
      schemaHash: schemaQ.data.schema_hash,
    });
    setBusy(false);
    if (f?.code === 'gate_blocked' || !f) {
      // a blocked gate also changes the stage (it becomes blocked), so refresh everything it shows
      void qc.invalidateQueries({ queryKey: ['stages'] });
      void qc.invalidateQueries({ queryKey: ['stage-decision', stageId] });
    }
    if (!f) setDone(true);
    else setFail(f);
  };

  const message = (): string | undefined => {
    if (!fail || fail.code === 'needs_revision' || fail.code === 'validation_failed')
      return undefined;
    if (fail.offline) return t('common.offline.banner');
    if (fail.code === 'gate_held') return t('choice.held');
    if (fail.code === 'gate_blocked') return t('choice.blocked');
    if (fail.status === 409) return t('choice.locked');
    if (fail.status === 403) return t('choice.notAllowed');
    return t('common.error.generic');
  };
  const schema = schemaQ.data?.schema as Schema | undefined;
  const choices = stageChoices(stage.data);
  const opts = (stage.data?.options ?? []).filter((o) => o.status === 'public');
  if (choices)
    choices.ref = {
      options: opts.map((o, i) => ({ value: o.id, label: optionLabel(o, i + 1, t) })),
    };

  return (
    <Box className="gap-4" testID="choice-form">
      <CivicButton
        variant="secondary"
        label={t('choice.back')}
        accessibilityLabel={t('choice.back')}
        onPress={back}
      />
      <CivicHeading level={1}>{t('choice.new.title')}</CivicHeading>
      {done ? <StatusMessage state="success" message={t('choice.sent')} /> : null}
      {fail && message() ? <StatusMessage state="error" message={message() as string} /> : null}
      {!schema ? (
        schemaQ.isError ? (
          <StatusMessage
            state="error"
            message={t('contrib.add.formError')}
            action={{
              label: t('common.error.retry'),
              accessibilityLabel: t('common.error.retry'),
              onPress: () => void schemaQ.refetch(),
            }}
          />
        ) : (
          <StatusMessage state="loading" message={t('contrib.add.loading')} />
        )
      ) : done ? null : (
        <SchemaForm
          schema={schema}
          messages={(schemaQ.data?.messages ?? {}) as Record<string, unknown>}
          value={value}
          onChange={setValue}
          onSubmit={(a) => void onSubmit(a)}
          submitLabel={t('choice.record')}
          choices={choices}
          busy={busy}
          fieldErrors={Object.fromEntries(
            Object.entries(fail?.fieldErrors ?? {}).map(([k, v]) => [path(k), v]),
          )}
        />
      )}
    </Box>
  );
}
