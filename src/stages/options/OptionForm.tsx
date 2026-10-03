import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Box, CivicButton, CivicHeading, CivicText, StatusMessage } from '../../components/civic';
import { ReplyAllowance, timeOf } from '../../contributions/ReplyAllowance';
import { useReplyAllowance, type PostFailure } from '../../contributions/api';
import { SchemaForm } from '../../forms/schema/SchemaForm';
import type { Schema, Value } from '../../forms/schema/model';
import { useContentSchema } from '../../forms/schema/useContentSchema';
import { useT } from '../../i18n';
import { postOption } from './api';

// '/content/a/b' or '/body/a' -> 'a.b'
const path = (p: string) =>
  p
    .replace(/^\/(content|body)\/?/, '')
    .split('/')
    .filter(Boolean)
    .join('.');

// WF-PROPOSAL-2, now the option form of a stage. A shell: the fields come from the stage_option schema.
// Adding an option is a reply (D-85): it uses the same allowance as the contribution screen.
export function OptionForm({ problemId, stageId }: { problemId: string; stageId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const schemaQ = useContentSchema('stage_option');
  const allowance = useReplyAllowance(problemId);
  const [value, setValue] = useState<Value>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [fail, setFail] = useState<PostFailure | null>(null);
  const [capped, setCapped] = useState<string | null | undefined>(undefined);

  const limit = allowance.data?.limit;
  const remaining = capped !== undefined ? 0 : allowance.data?.remaining;
  const resetsAt = capped !== undefined ? capped : (allowance.data?.resetsAt ?? null);
  const atLimit = remaining === 0;
  const at = resetsAt ? new Date(resetsAt) : null;

  useEffect(() => {
    if (!atLimit || !at) return;
    const id = setTimeout(
      () => void allowance.refetch().then(() => setCapped(undefined)),
      Math.max(0, +at - Date.now()),
    );
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atLimit, resetsAt]);

  const onSubmit = async (answers: Value) => {
    if (!schemaQ.data) return;
    setBusy(true);
    setFail(null);
    const f = await postOption(stageId, answers, {
      schemaVersion: schemaQ.data.schema_version,
      schemaHash: schemaQ.data.schema_hash,
    });
    setBusy(false);
    if (!f) {
      setSent(true);
      setValue({});
      void allowance.refetch();
      void qc.invalidateQueries({ queryKey: ['stage-options', stageId] });
      return;
    }
    if (f.code === 'reply_limit_reached') {
      setCapped(f.resetsAt ?? null);
      void allowance.refetch().then(() => setCapped(undefined));
    }
    setFail(f);
  };

  const back = () =>
    router.push({
      pathname: '/problems/[id]/stages/[stageId]/options',
      params: { id: problemId, stageId },
    });
  const message = (): string | undefined => {
    if (!fail || fail.code === 'reply_limit_reached' || fail.code === 'validation_failed')
      return undefined;
    if (fail.offline) return t('common.offline.banner');
    if (fail.status === 409) return t('option.locked');
    return t('common.error.generic');
  };
  const schema = schemaQ.data?.schema as Schema | undefined;

  return (
    <Box className="gap-4" testID="option-form">
      <CivicButton
        variant="secondary"
        label={t('option.back')}
        accessibilityLabel={t('option.back')}
        onPress={back}
      />
      <CivicHeading level={1}>{t('stage.option.add')}</CivicHeading>
      {limit !== undefined && remaining !== undefined ? (
        <ReplyAllowance limit={limit} remaining={remaining} resetsAt={resetsAt} />
      ) : allowance.isError ? (
        <CivicText variant="caption">{t('contrib.add.allowanceError')}</CivicText>
      ) : null}
      {atLimit && limit !== undefined ? (
        <Box className="gap-1 p-3 rounded-md border-2 border-can-border" testID="reply-limit">
          <CivicHeading level={2}>{t('reply.limit.title')}</CivicHeading>
          <CivicText
            accessibilityLabel={
              at ? t('reply.a11y.blocked', { time: timeOf(at), limit }) : undefined
            }
          >
            {t('reply.limit.body', { time: at ? timeOf(at) : '' })}
          </CivicText>
          <CivicText>{t('reply.limit.draft')}</CivicText>
        </Box>
      ) : null}
      {sent ? <StatusMessage state="success" message={t('option.sent')} /> : null}
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
      ) : (
        <>
          <CivicText variant="caption">{t('option.review')}</CivicText>
          <SchemaForm
            schema={schema}
            messages={(schemaQ.data?.messages ?? {}) as Record<string, unknown>}
            value={value}
            onChange={setValue}
            onSubmit={(a) => void onSubmit(a)}
            submitLabel={t('contrib.add.post')}
            submitDisabled={atLimit}
            busy={busy}
            fieldErrors={Object.fromEntries(
              Object.entries(fail?.fieldErrors ?? {}).map(([k, v]) => [path(k), v]),
            )}
            formError={message()}
          />
        </>
      )}
    </Box>
  );
}
