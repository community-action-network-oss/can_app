import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  Box,
  ChoiceField,
  CivicButton,
  CivicHeading,
  CivicText,
  StatusMessage,
} from '../components/civic';
import { SchemaForm } from '../forms/schema/SchemaForm';
import { msg, type Schema, type Value } from '../forms/schema/model';
import { useContentSchema } from '../forms/schema/useContentSchema';
import { useT, type MessageId } from '../i18n';
import { useProblem } from '../problems/useProblem';
import {
  postContribution,
  useReplyAllowance,
  useStage,
  type Flag,
  type CreateBody,
  type PostFailure,
} from './api';
import { ReplyAllowance, timeOf } from './ReplyAllowance';

// '/body/evidence_refs/0/url' -> 'evidence_refs.0.url'
const bodyPath = (p: string) =>
  p
    .replace(/^\/body\/?/, '')
    .split('/')
    .filter(Boolean)
    .join('.');

const later = (a: Date | null, b: Date | null) => (a && b ? (a > b ? a : b) : (a ?? b));

// WF-CONTRIB-2. A shell: the form comes from the contribution schema; no field is named here (D-58).
export function AddContribution({ problemId, stageId }: { problemId: string; stageId?: string }) {
  const t = useT();
  const qc = useQueryClient();
  const problem = useProblem(problemId);
  const stage = useStage(stageId);
  const allowance = useReplyAllowance(problemId);
  const [type, setType] = useState<string>();
  const [value, setValue] = useState<Value>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [fail, setFail] = useState<PostFailure | null>(null);
  const [kept, setKept] = useState<string[]>([]);
  const [capped, setCapped] = useState<{ limit: number; resetsAt: string | null } | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<Date | null>(null);
  const [cooldownMinutes, setCooldownMinutes] = useState(1);

  // Not shown as a ticking clock: one timer lifts the block when the wait is over.
  useEffect(() => {
    if (!cooldownUntil) return;
    const id = setTimeout(() => setCooldownUntil(null), Math.max(0, +cooldownUntil - Date.now()));
    return () => clearTimeout(id);
  }, [cooldownUntil]);

  // A proposed solution aimed at a stage uses the stage_option form.
  const schemaType = stageId && type === 'proposed_solution' ? 'stage_option' : type;
  const schemaQ = useContentSchema(`contribution.${schemaType}`, { enabled: !!type });

  const allowed = (stageId ? stage.data : problem.data)?.allowedContributionTypes;
  if (!allowed) {
    const err = stageId ? stage.error : problem.error;
    return err ? (
      <StatusMessage state="error" message={t('detail.error')} />
    ) : (
      <StatusMessage state="loading" message={t('common.loading')} />
    );
  }

  const limit = capped?.limit ?? allowance.data?.limit;
  const remaining = capped ? 0 : allowance.data?.remaining;
  const resetsAt = capped ? capped.resetsAt : (allowance.data?.resetsAt ?? null);
  const blockedAt = later(remaining === 0 && resetsAt ? new Date(resetsAt) : null, cooldownUntil);
  const atLimit = remaining === 0;
  const waiting = atLimit || !!cooldownUntil;

  const pick = (v: string) => {
    setType(v);
    setValue({ type: v, target: problemId });
    setFail(null);
    setSent(false);
    setKept([]);
  };

  const onSubmit = async (answers: Value) => {
    if (!type || !schemaQ.data) return;
    setBusy(true);
    setFail(null);
    const f = await postContribution(problemId, {
      type: type as CreateBody['type'],
      ...(stageId ? { stageId } : {}),
      body: { ...answers, type },
      schemaVersion: schemaQ.data.schema_version,
      schemaHash: schemaQ.data.schema_hash,
      ...(kept.length ? { keptFlagIds: kept } : {}),
    });
    setBusy(false);
    if (!f) {
      setSent(true);
      setValue({ type, target: problemId });
      setKept([]);
      void allowance.refetch();
      void qc.invalidateQueries({ queryKey: ['contributions', problemId] });
      return;
    }
    if (f.code === 'reply_limit_reached') {
      setCapped({ limit: limit ?? 0, resetsAt: f.resetsAt ?? null });
      void allowance.refetch().then(() => setCapped(null));
    } else if (f.code === 'cooldown_active') {
      const secs = f.retryAfterSeconds ?? 60;
      setCooldownUntil(new Date(Date.now() + secs * 1000));
      setCooldownMinutes(Math.max(1, Math.ceil(secs / 60)));
    }
    setFail(f);
  };

  const schema = schemaQ.data?.schema as Schema | undefined;
  const messages = (schemaQ.data?.messages ?? {}) as Record<string, unknown>;
  const labelOf = (field: string) => {
    const key = bodyPath(field).split('.')[0] ?? field;
    const l = msg(
      messages,
      (schema?.properties?.[key]?.['x-ui'] as { label_msg?: string })?.label_msg,
    );
    return l || key;
  };
  const flags = (fail?.flags ?? []).filter((x) => !kept.includes(x.id));
  const fieldErrors = Object.fromEntries(
    Object.entries(fail?.fieldErrors ?? {}).map(([k, v]) => [bodyPath(k), v]),
  );
  const stageState = stage.data?.chip;
  const message = (): string | undefined => {
    if (!fail) return undefined;
    if (fail.offline) return t('common.offline.banner');
    if (fail.code === 'cooldown_active')
      return t('contrib.add.cooldown', {
        minutes: Math.max(1, Math.ceil((fail.retryAfterSeconds ?? 60) / 60)),
      });
    if (fail.code === 'not_allowed_in_state')
      return stageState
        ? t('contrib.add.notAllowedStage', { state: stageState })
        : t('contrib.add.notAllowed');
    if (fail.code === 'reply_limit_reached' || fail.code === 'validation_failed') return undefined;
    return t('common.error.generic');
  };

  return (
    <Box className="gap-4" testID="add-contribution">
      <CivicButton
        variant="secondary"
        label={t('contrib.add.back')}
        accessibilityLabel={t('contrib.add.back')}
        onPress={() => router.push({ pathname: '/problems/[id]', params: { id: problemId } })}
      />
      <CivicHeading level={1}>{t('contrib.add.title')}</CivicHeading>
      {limit !== undefined && remaining !== undefined ? (
        <ReplyAllowance limit={limit} remaining={remaining} resetsAt={resetsAt} until={blockedAt} />
      ) : allowance.isError ? (
        <CivicText variant="caption">{t('contrib.add.allowanceError')}</CivicText>
      ) : null}
      {atLimit && limit !== undefined ? (
        <Box className="gap-1 p-3 rounded-md border-2 border-can-border" testID="reply-limit">
          <CivicHeading level={2}>{t('reply.limit.title')}</CivicHeading>
          <CivicText
            accessibilityLabel={
              blockedAt ? t('reply.a11y.blocked', { time: timeOf(blockedAt), limit }) : undefined
            }
          >
            {t('reply.limit.body', { time: blockedAt ? timeOf(blockedAt) : '' })}
          </CivicText>
          <CivicText>{t('reply.limit.draft')}</CivicText>
        </Box>
      ) : null}
      {cooldownUntil && !atLimit ? (
        <CivicText testID="cooldown-note">
          {t('contrib.add.cooldown', {
            minutes: cooldownMinutes,
          })}
        </CivicText>
      ) : null}
      {allowed.length === 0 ? (
        <CivicText>{t('contrib.add.none')}</CivicText>
      ) : (
        <ChoiceField
          label={t('contrib.add.type')}
          options={allowed.map((a) => ({ value: a, label: t(`contrib.type.${a}` as MessageId) }))}
          value={type}
          onChange={pick}
        />
      )}
      {sent ? <StatusMessage state="success" message={t('contrib.add.sent')} /> : null}
      {type && !schema ? (
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
      ) : null}
      {type && schema ? (
        <>
          <CivicText variant="caption">{t('contrib.add.review')}</CivicText>
          <CivicText variant="caption">{t('contrib.add.reflect')}</CivicText>
          <SchemaForm
            schema={schema}
            messages={messages}
            value={value}
            onChange={setValue}
            onSubmit={(a) => void onSubmit(a)}
            submitLabel={t('contrib.add.post')}
            submitDisabled={waiting}
            busy={busy}
            fieldErrors={fieldErrors}
            formError={message()}
          />
          {flags.length ? (
            <Box className="gap-2" testID="contrib-flags">
              <CivicHeading level={2}>{t('contrib.add.flagsTitle')}</CivicHeading>
              {flags.map((f: Flag) =>
                f.severity === 'hard' ? (
                  <CivicText key={f.id}>
                    {t('submit.flags.hard', { part: labelOf(f.field) })}
                  </CivicText>
                ) : (
                  <Box key={f.id} className="gap-1">
                    <CivicText>{t('submit.flags.review', { part: labelOf(f.field) })}</CivicText>
                    <CivicButton
                      variant="secondary"
                      label={t('submit.flags.keep')}
                      accessibilityLabel={`${t('submit.flags.keep')}: ${labelOf(f.field)}`}
                      onPress={() => setKept([...kept, f.id])}
                    />
                  </Box>
                ),
              )}
            </Box>
          ) : null}
        </>
      ) : null}
    </Box>
  );
}
