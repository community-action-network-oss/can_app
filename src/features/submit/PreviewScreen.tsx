import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { api } from '../../api/client';
import { ApiError } from '../../api/errors';
import { unwrap } from '../../api/unwrap';
import { Box, CivicButton, CivicHeading, CivicText, StatusMessage } from '../../components/civic';
import { fieldsOf, msg, type Schema } from '../../forms/schema/model';
import { useContentSchema } from '../../forms/schema/useContentSchema';
import { useT, type MessageId } from '../../i18n';
import { pointerToPath } from './schemaParts';

const EXPLAIN: Record<string, MessageId> = {
  'publish.review_first': 'submit.preview.explain.review_first',
  'publish.fields_public': 'submit.preview.explain.fields_public',
  'publish.handle_shown': 'submit.preview.explain.handle_shown',
  'publish.flags_kept_not_public': 'submit.preview.explain.flags_kept',
};

function Value({ v }: { v: unknown }) {
  if (v == null || v === '') return null;
  if (Array.isArray(v))
    return (
      <Box className="gap-1">
        {v.map((x, i) => (
          <Value key={i} v={x} />
        ))}
      </Box>
    );
  if (typeof v === 'object')
    return (
      <Box className="gap-1">
        {Object.entries(v as object).map(([k, x]) => (
          <Box key={k} className="gap-1">
            <CivicText variant="caption" muted>
              {k.replace(/_/g, ' ')}
            </CivicText>
            <Value v={x} />
          </Box>
        ))}
      </Box>
    );
  return <CivicText>{String(v)}</CivicText>;
}

/** WF-SUBMIT-4: exactly what people would see, with the safety check result. Sending belongs to the workspace. */
export function PreviewScreen({ id }: { id: string }) {
  const t = useT();
  const qc = useQueryClient();
  const schemaQ = useContentSchema('problem');
  const preview = useQuery({
    queryKey: ['draft-preview', id],
    queryFn: () => unwrap(api.GET('/v1/drafts/{id}/preview', { params: { path: { id } } })),
    gcTime: 0,
    retry: false,
  });
  const checks = useQuery({
    queryKey: ['draft-checks', id],
    queryFn: () => unwrap(api.POST('/v1/drafts/{id}/checks', { params: { path: { id } } })),
    retry: false,
  });
  const keep = useMutation({
    mutationFn: (flagIds: string[]) =>
      unwrap(
        api.POST('/v1/drafts/{id}/checks/keep', {
          params: { path: { id } },
          body: { flagIds },
        }),
      ),
    onSuccess: (r) => {
      qc.setQueryData(['draft-checks', id], r);
      void preview.refetch();
    },
  });
  const edit = (
    <CivicButton
      variant="secondary"
      label={t('submit.preview.edit')}
      accessibilityLabel={t('submit.preview.edit')}
      onPress={() => router.push({ pathname: '/me/problems/[id]/facts', params: { id } })}
    />
  );

  if (!preview.data) {
    if (preview.error) {
      const offline = preview.error instanceof ApiError && preview.error.kind === 'offline';
      return (
        <>
          <StatusMessage
            state="error"
            message={t(offline ? 'common.offline.banner' : 'detail.error')}
            action={{
              label: t('common.error.retry'),
              accessibilityLabel: t('common.error.retry'),
              onPress: () => void preview.refetch(),
            }}
          />
          {edit}
        </>
      );
    }
    return <StatusMessage state="loading" message={t('common.loading')} />;
  }

  const schema = schemaQ.data?.schema as Schema | undefined;
  const labels = new Map(
    schema
      ? fieldsOf(schema, schema).map((f) => [
          f.key,
          msg(schemaQ.data?.messages ?? {}, f.node['x-ui']?.label_msg) || f.key,
        ])
      : [],
  );
  const flags = checks.data?.flags ?? [];
  const hard = flags.filter((f) => f.severity === 'hard');
  const review = flags.filter((f) => f.severity === 'review' && !f.kept);
  const where = (field: string) => pointerToPath(field).split('.')[0] || field;

  return (
    <Box className="gap-4" testID="preview">
      <CivicHeading level={1}>{t('submit.preview.title')}</CivicHeading>
      <CivicText variant="caption">{t('submit.preview.masked')}</CivicText>
      <CivicText variant="caption" muted>
        {t('submit.preview.handle', { handle: preview.data.handle })}
      </CivicText>
      {Object.entries(preview.data.public).map(([k, v]) => (
        <Box key={k} className="gap-1" testID={`preview-${k}`}>
          <CivicHeading level={3}>{labels.get(k) ?? k.replace(/_/g, ' ')}</CivicHeading>
          <Value v={v} />
        </Box>
      ))}
      {hard.length || review.length ? (
        <Box className="gap-2" testID="preview-flags">
          <CivicHeading level={2}>{t('submit.flags.title')}</CivicHeading>
          {hard.map((f) => (
            <CivicText key={f.id}>
              {t('submit.flags.hard', { part: labels.get(where(f.field)) ?? where(f.field) })}
            </CivicText>
          ))}
          {review.map((f) => (
            <Box key={f.id} className="gap-1">
              <CivicText>
                {t('submit.flags.review', { part: labels.get(where(f.field)) ?? where(f.field) })}
              </CivicText>
              <CivicButton
                variant="secondary"
                label={t('submit.flags.keep')}
                accessibilityLabel={`${t('submit.flags.keep')}: ${labels.get(where(f.field)) ?? where(f.field)}`}
                onPress={() => keep.mutate([f.id])}
              />
            </Box>
          ))}
        </Box>
      ) : null}
      <Box className="gap-1">
        {preview.data.explanationIds.map((e) =>
          EXPLAIN[e] ? (
            <CivicText key={e} variant="caption">
              {t(EXPLAIN[e])}
            </CivicText>
          ) : null,
        )}
      </Box>
      {edit}
    </Box>
  );
}
