import { router } from 'expo-router';
import { useState } from 'react';

import { api } from '../../api/client';
import { ApiError } from '../../api/errors';
import { unwrap } from '../../api/unwrap';
import { Box, CivicHeading, CivicText, StatusMessage } from '../../components/civic';
import { SchemaForm } from '../../forms/schema/SchemaForm';
import { UNKNOWN_KEY, type Schema, type Value } from '../../forms/schema/model';
import { useContentSchema } from '../../forms/schema/useContentSchema';
import { useT } from '../../i18n';
import { mapFieldErrors } from '../submit/schemaParts';

/** WF-POLICY-1. Every field comes from the policy_proposal content schema; nothing here names one. */
export function PolicyProposalForm() {
  const t = useT();
  const q = useContentSchema('policy_proposal');
  const [value, setValue] = useState<Value>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<ApiError | undefined>();

  if (!q.data) {
    if (q.error)
      return (
        <StatusMessage
          state="error"
          message={t(
            q.error instanceof ApiError && q.error.kind === 'offline'
              ? 'common.offline.banner'
              : 'common.error.generic',
          )}
        />
      );
    return <StatusMessage state="loading" message={t('common.loading')} />;
  }
  const dto = q.data;

  const onSubmit = async (answers: Value, unknown: Record<string, string>) => {
    setBusy(true);
    setErr(undefined);
    try {
      const content = {
        ...answers,
        ...(Object.keys(unknown).length ? { [UNKNOWN_KEY]: unknown } : {}),
      };
      const made = await unwrap(
        api.POST('/v1/policy-proposals', {
          body: { content, schemaVersion: dto.schema_version, schemaHash: dto.schema_hash },
        }),
      );
      router.push({ pathname: '/policy/[id]', params: { id: made.id } } as never);
    } catch (e) {
      setErr(e instanceof ApiError ? e : new ApiError(0, 'unknown', '', 'server'));
    } finally {
      setBusy(false);
    }
  };

  const core = err?.code === 'protected_core';
  // Cap and offline get their own copy; field errors (400, 422) are shown beside their fields.
  const formError =
    !err || core || err.status === 400
      ? undefined
      : t(
          err.status === 429
            ? 'policy.new.cap'
            : err.kind === 'offline'
              ? 'common.offline.banner'
              : 'common.error.generic',
        );

  return (
    <Box className="gap-4" testID="policy-proposal-form">
      <CivicHeading level={1}>{t('policy.new.title')}</CivicHeading>
      <CivicText>{t('policy.new.body')}</CivicText>
      {core ? (
        <StatusMessage
          state="error"
          title={t('policy.new.protectedCore.title')}
          // Server text carries constitution I.2; the field reason is repeated here because its field may be in another section.
          message={[
            err!.message,
            ...Object.values(err!.fieldErrors ?? {}),
            t('policy.new.protectedCore.body'),
          ].join(' ')}
        />
      ) : null}
      <SchemaForm
        schema={dto.schema as Schema}
        messages={dto.messages}
        value={value}
        onChange={setValue}
        onSubmit={onSubmit}
        busy={busy}
        formError={formError}
        fieldErrors={mapFieldErrors(core || err?.status === 400 ? err?.fieldErrors : undefined)}
      />
    </Box>
  );
}
