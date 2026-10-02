import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { api } from '../../api/client';
import { ApiError } from '../../api/errors';
import { unwrap } from '../../api/unwrap';
import { Box, CivicButton, CivicHeading, CivicText, StatusMessage } from '../../components/civic';
import { mapFieldErrors } from '../../features/submit/schemaParts';
import type { Schema, Value } from '../../forms/schema/model';
import { useContentSchema } from '../../forms/schema/useContentSchema';
import { useT, type MessageId } from '../../i18n';
import { usePreparation, useServerDraft } from '../usePreparation';
import { CriteriaEditor } from './CriteriaEditor';

type Props = { id: string; fieldKey: string; onBack: () => void };
const EDITABLE = ['draft', 'needs_revision', 'in_review'];

/** WF-PREP-2 for the problem's final criteria: loads the draft, saves through PATCH /v1/drafts/{id}. */
export function CriteriaScreen({ id, fieldKey, onBack }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const prep = usePreparation(id);
  const draft = useServerDraft(id);
  const schemaQ = useContentSchema('problem', {
    version: draft.data?.schemaVersion ?? undefined,
    enabled: !!draft.data,
  });
  const [locked, setLocked] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: (finalAcceptanceCriteria: Value[]) =>
      unwrap(
        api.PATCH('/v1/drafts/{id}', {
          params: { path: { id } },
          body: { finalAcceptanceCriteria, expectedVersion: prep.data?.version ?? 0 },
        }),
      ),
    onSettled: () => {
      for (const k of ['prep', 'draft', 'draft-preview'])
        void qc.invalidateQueries({ queryKey: [k, id] });
    },
  });

  const loadErr = [prep, draft, schemaQ].map((q) => q.error).find((e) => e instanceof ApiError);
  if (loadErr instanceof ApiError || (prep.data && !EDITABLE.includes(prep.data.state))) {
    const kind = loadErr instanceof ApiError ? loadErr.kind : 'not_permitted';
    const msg: MessageId =
      kind === 'offline'
        ? 'common.offline.banner'
        : kind === 'not_permitted' || kind === 'not_found'
          ? 'prep.notPermitted'
          : kind === 'rate_limited'
            ? 'prep.rateLimited'
            : 'detail.error';
    const retry = kind === 'not_permitted' || kind === 'not_found' ? undefined : kind;
    return (
      <StatusMessage
        state="error"
        message={t(msg)}
        action={
          retry
            ? {
                label: t('common.error.retry'),
                accessibilityLabel: t('common.error.retry'),
                onPress: () =>
                  void Promise.all([prep.refetch(), draft.refetch(), schemaQ.refetch()]),
              }
            : undefined
        }
      />
    );
  }
  if (!prep.data || !draft.data || !schemaQ.data)
    return <StatusMessage state="loading" message={t('common.loading')} />;

  const err = save.error instanceof ApiError ? save.error : undefined;
  const items = (draft.data.content?.[fieldKey] as Value[] | undefined) ?? [];
  // Flags the server raised on a criterion (pointer /content/<key>/<n>/...) become neutral notes.
  const notes: Record<number, string> = {};
  for (const f of prep.data.criteria.flags) {
    const m = f.field.match(new RegExp(`^/content/${fieldKey}/(\\d+)`));
    if (m && !f.kept) notes[Number(m[1])] = f.suggestion ?? t('crit.hint.fallback');
  }
  const readOnly = locked || err?.kind === 'not_permitted';

  return (
    <Box className="gap-4" testID="criteria-screen">
      <CivicHeading level={1}>{t('crit.title')}</CivicHeading>
      <CivicText>{t('crit.body')}</CivicText>
      <CriteriaEditor
        owner="problem"
        fieldKey={fieldKey}
        schema={schemaQ.data.schema as Schema}
        messages={schemaQ.data.messages}
        items={items}
        notes={notes}
        readOnly={readOnly}
        busy={save.isPending}
        fieldErrors={mapFieldErrors(err?.status === 400 ? err.fieldErrors : undefined)}
        formError={
          err && !(err.status === 400 && err.fieldErrors)
            ? t(err.kind === 'not_permitted' ? 'prep.notPermitted' : 'common.error.generic')
            : undefined
        }
        onSave={async (list) => {
          setSaved(false);
          try {
            await save.mutateAsync(list);
            setSaved(true);
          } catch (e) {
            if (e instanceof ApiError && e.kind === 'not_permitted') setLocked(true);
          }
        }}
      />
      {saved ? <CivicText testID="crit-saved">{t('crit.saved')}</CivicText> : null}
      <CivicButton
        variant="secondary"
        label={t('common.back')}
        accessibilityLabel={t('common.back')}
        onPress={onBack}
      />
    </Box>
  );
}
