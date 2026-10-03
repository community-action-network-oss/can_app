import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';

import { api } from '../../api/client';
import { ApiError } from '../../api/errors';
import { unwrap } from '../../api/unwrap';
import {
  Box,
  CheckboxField,
  CivicButton,
  CivicHeading,
  CivicText,
  StatusMessage,
} from '../../components/civic';
import { withoutFields } from '../../features/submit/schemaParts';
import { SchemaForm } from '../../forms/schema/SchemaForm';
import { fieldsOf, msg, type Schema, type Value } from '../../forms/schema/model';
import { useContentSchema } from '../../forms/schema/useContentSchema';
import { useT, type MessageId } from '../../i18n';
import { useSession } from '../../navigation/SessionContext';
import { MaskedText } from './MaskedText';

type Messages = Record<string, unknown>;
type Stage = {
  name: string;
  label?: string;
  goal?: string;
  depends_on?: string[];
  acceptance_criteria?: unknown[];
};
type Props = {
  id: string;
  /** Empty until the Guest badge (12-u22) and the Impacted only filter (12-u23) land. */
  guestBadgeSlot?: ReactNode;
  impactedFilterSlot?: ReactNode;
};

const SERVER_SET = ['problem_ref', 'path', 'status', 'resolution_reason'];
const label = (m: Messages, path: string, key: string) =>
  typeof m[`schema.problem.${path}.label`] === 'string'
    ? (m[`schema.problem.${path}.label`] as string)
    : key.replaceAll('_', ' ');

/** Any masked value, read-only. Labels come from the problem schema messages. */
function Shown({ v, path, m }: { v: unknown; path: string; m: Messages }) {
  if (v == null || v === '') return null;
  if (typeof v === 'string') return <MaskedText text={v} />;
  if (typeof v !== 'object') return <CivicText>{String(v)}</CivicText>;
  if (Array.isArray(v))
    return (
      <Box className="gap-2">
        {v.map((x, i) => (
          <Box key={i} className="gap-1 ps-2 border-s border-can-border">
            <Shown v={x} path={path} m={m} />
          </Box>
        ))}
      </Box>
    );
  return (
    <Box className="gap-1">
      {Object.entries(v).map(([k, x]) => (
        <Box key={k} className="gap-1">
          {typeof x === 'object' && x !== null ? (
            <CivicText variant="label">{label(m, `${path}.${k}`, k)}</CivicText>
          ) : (
            <CivicText variant="label" muted>
              {label(m, `${path}.${k}`, k)}
            </CivicText>
          )}
          <Shown v={x} path={`${path}.${k}`} m={m} />
        </Box>
      ))}
    </Box>
  );
}

function kindOf(e: unknown) {
  return e instanceof ApiError ? e.kind : undefined;
}

/*
 +--------------------------------------+
 | Review a problem                     |
 | (gate) [ ] I know this problem ...   |
 |        [ Start reviewing ]           |
 |--------------------------------------|
 | Personal details are hidden.         |
 | Facts: text with (hidden name) chips |
 |   [ Recommend a change ]             |
 | Stage 2: Solutions (after Facts)     |
 |   [ Recommend a change ] x2          |
 | Recommend a change: Applies to ...   |
 |   [schema form]  [ Send ]            |
 | Your recommendations 2               |
 | [ I have finished my review ]        |
 +--------------------------------------+ */
/** WF-VREVIEW-2. The volunteer never sees the poster; the server masks every text before it arrives. */
export function ProblemScreen({ id, guestBadgeSlot, impactedFilterSlot }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const router = useRouter();
  const { handle } = useSession();
  const viewKey = ['review-problem', handle, id];
  const mineKey = ['review-mine', handle, id];
  const [conflict, setConflict] = useState(false);
  const [target, setTarget] = useState<string>();
  const [text, setText] = useState<Value>({});
  const [sent, setSent] = useState(false);

  const view = useQuery({
    queryKey: viewKey,
    retry: false,
    queryFn: () =>
      unwrap(api.GET('/v1/review/{problemId}', { params: { path: { problemId: id } } })),
  });
  const problemSchema = useContentSchema('problem', { enabled: !!view.data });
  const recSchema = useContentSchema('review_recommendation', { enabled: !!view.data });
  const mine = useQuery({
    queryKey: mineKey,
    enabled: !!view.data,
    retry: false,
    queryFn: () =>
      unwrap(
        api.GET('/v1/review/{problemId}/recommendations', { params: { path: { problemId: id } } }),
      ),
  });

  const declare = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/review/{problemId}/session', {
          params: { path: { problemId: id } },
          body: { noConflict: true },
        }),
      ),
    onSuccess: () => void view.refetch(),
  });
  const send = useMutation({
    mutationFn: (v: Value) =>
      unwrap(
        api.POST('/v1/review/{problemId}/recommendations', {
          params: { path: { problemId: id } },
          body: {
            path: target ?? '',
            recommendation: String(v.recommendation ?? ''),
            reason: String(v.reason ?? ''),
          },
        }),
      ),
    onSuccess: () => {
      setSent(true);
      setTarget(undefined);
      setText({});
      void qc.invalidateQueries({ queryKey: mineKey });
    },
  });
  const finish = useMutation({
    mutationFn: (outcome: 'recommendations' | 'no_changes') =>
      unwrap(
        api.POST('/v1/review/{problemId}/finish', {
          params: { path: { problemId: id } },
          body: { outcome },
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: mineKey }),
  });

  const problem = (
    kind: MessageId,
    action?: { label: string; accessibilityLabel: string; onPress: () => void },
  ) => <StatusMessage state="error" message={t(kind)} action={action} />;
  const retry = (f: () => unknown) => ({
    label: t('common.error.retry'),
    accessibilityLabel: t('common.error.retry'),
    onPress: () => void f(),
  });
  const failure = (e: unknown, refetch: () => unknown) => {
    const kind = kindOf(e);
    if (kind === 'offline') return problem('common.offline.banner', retry(refetch));
    if (kind === 'session_expired' || kind === 'unauthenticated')
      return problem('session.expired.body');
    if (kind === 'not_found') return problem('vreview.error.gone');
    if (kind === 'rate_limited') return problem('vreview.error.rateLimited', retry(refetch));
    if (e instanceof ApiError && e.status === 503)
      return problem('vreview.error.masking', retry(refetch));
    return problem('common.error.generic', retry(refetch));
  };

  let body: ReactNode;
  if (view.error && kindOf(view.error) === 'not_permitted' && !declare.error) {
    // No session yet (or not allowed at all): the conflict declaration comes first, nothing else is shown.
    body = (
      <Box className="gap-3" testID="conflict-gate">
        <CheckboxField
          label={t('vreview.conflict')}
          checked={conflict}
          onToggle={() => setConflict(!conflict)}
        />
        <CivicText variant="caption">{t('vreview.conflict.help')}</CivicText>
        <CivicButton
          label={t(conflict ? 'vreview.conflict.leave' : 'vreview.conflict.start')}
          accessibilityLabel={t(conflict ? 'vreview.conflict.leave' : 'vreview.conflict.start')}
          disabled={declare.isPending}
          onPress={() => (conflict ? router.push('/review/problems' as never) : declare.mutate())}
        />
      </Box>
    );
  } else if (declare.error && kindOf(declare.error) === 'not_permitted') {
    body = problem('vreview.error.notAllowed');
  } else if (view.error) {
    body = failure(view.error, view.refetch);
  } else if (declare.error) {
    body = failure(declare.error, declare.reset);
  } else if (!view.data || !problemSchema.data || !recSchema.data) {
    const err = problemSchema.error ?? recSchema.error;
    body = err ? (
      failure(err, () => {
        void problemSchema.refetch();
        void recSchema.refetch();
      })
    ) : (
      <StatusMessage state="loading" message={t('common.loading')} />
    );
  } else {
    const schema = problemSchema.data.schema as Schema;
    const m = problemSchema.data.messages as Messages;
    const content = view.data.content as Record<string, unknown>;
    const stages = (Array.isArray(content.stage_plan) ? content.stage_plan : []) as Stage[];
    const pathNode = (recSchema.data.schema as Schema).properties?.path;
    const allowed = pathNode?.pattern ? new RegExp(pathNode.pattern) : undefined;
    const open = !mine.data?.finished;
    const stageOf = (name: string) => stages.find((s) => s.name === name);

    const targetName = (p: string): string => {
      const s = /^stage_plan\.([^.]+)(\.criteria)?$/.exec(p);
      if (!s) {
        const n = schema.properties?.[p];
        return msg(m, n?.['x-ui']?.label_msg) || p;
      }
      const st = stageOf(s[1]!);
      const nm = st?.label ?? s[1]!;
      return t(s[2] ? 'vreview.target.stageCriteria' : 'vreview.target.stage', { name: nm });
    };
    const add = (p: string) =>
      open && allowed?.test(p) ? (
        <CivicButton
          label={t('vreview.rec.add')}
          accessibilityLabel={t('vreview.rec.add.label', { target: targetName(p) })}
          variant="secondary"
          onPress={() => {
            setTarget(p);
            setSent(false);
          }}
        />
      ) : null;

    const formSchema = withoutFields(recSchema.data.schema as Schema, SERVER_SET);
    const sendErr = send.error instanceof ApiError ? send.error : undefined;
    const formError = !sendErr
      ? undefined
      : sendErr.kind === 'offline'
        ? t('common.offline.banner')
        : sendErr.kind === 'rate_limited'
          ? t('vreview.error.dailyLimit')
          : sendErr.status === 503
            ? t('vreview.error.recheck')
            : sendErr.status === 400
              ? t('vreview.error.refused')
              : t('common.error.generic');

    body = (
      <>
        <CivicText>{t('vreview.masked')}</CivicText>
        {fieldsOf(schema, schema)
          .filter((f) => f.widget !== 'hidden' && f.key !== 'stage_plan' && content[f.key] != null)
          .map((f) => (
            <Box
              key={f.key}
              className="gap-2 border-b border-can-border pb-3"
              testID={`part-${f.key}`}
            >
              <CivicHeading level={3}>{msg(m, f.node['x-ui']?.label_msg) || f.key}</CivicHeading>
              <Shown v={content[f.key]} path={f.key} m={m} />
              {add(f.key)}
            </Box>
          ))}
        <Box className="gap-3" role="list" testID="part-stage_plan">
          {stages.map((s, i) => (
            <Box
              key={s.name}
              role="listitem"
              className="gap-2 p-3 rounded-md border border-can-border"
            >
              <CivicText variant="bodyStrong">
                {t('vreview.stage.heading', { n: i + 1, name: s.label ?? s.name })}
              </CivicText>
              {s.goal ? <MaskedText text={s.goal} /> : null}
              {s.depends_on?.length ? (
                <CivicText muted>
                  {t('stagemap.after', {
                    names: s.depends_on.map((d) => stageOf(d)?.label ?? d).join(', '),
                  })}
                </CivicText>
              ) : null}
              {add(`stage_plan.${s.name}`)}
              <Shown v={s.acceptance_criteria} path="stage_plan.acceptance_criteria" m={m} />
              {add(`stage_plan.${s.name}.criteria`)}
            </Box>
          ))}
        </Box>

        {target ? (
          <Box className="gap-3" testID="rec-panel">
            <CivicHeading level={2}>{t('vreview.rec.add')}</CivicHeading>
            <CivicText variant="bodyStrong">{t('vreview.rec.target')}</CivicText>
            <CivicText testID="rec-target">{targetName(target)}</CivicText>
            <SchemaForm
              schema={formSchema}
              messages={recSchema.data.messages}
              value={text}
              onChange={setText}
              submitLabel={t('vreview.rec.send')}
              busy={send.isPending}
              formError={formError}
              fieldErrors={sendErr?.status === 400 ? sendErr.fieldErrors : undefined}
              onSubmit={(v) => send.mutateAsync(v).catch(() => undefined)}
            />
            <CivicButton
              label={t('common.back')}
              accessibilityLabel={t('common.back')}
              variant="secondary"
              onPress={() => setTarget(undefined)}
            />
          </Box>
        ) : null}
        {sent ? <StatusMessage state="success" message={t('vreview.rec.sent')} /> : null}

        <Box className="gap-2" testID="rec-mine">
          <CivicHeading level={2}>
            {`${t('vreview.rec.mine')} ${mine.data?.recommendations.length ?? ''}`.trim()}
          </CivicHeading>
          {guestBadgeSlot}
          {impactedFilterSlot}
          {mine.error ? failure(mine.error, mine.refetch) : null}
          {mine.data?.recommendations.map((r) => (
            <Box key={r.id} className="gap-1 border-b border-can-border pb-2" testID="rec-item">
              <CivicText variant="bodyStrong">{targetName(r.path)}</CivicText>
              <MaskedText text={r.recommendation} />
              <MaskedText text={r.reason} muted />
              <CivicText variant="label">{t(`vreview.resolve.status.${r.status}`)}</CivicText>
              {r.resolutionReason ? <MaskedText text={r.resolutionReason} /> : null}
              {r.changedSince ? (
                <CivicText variant="caption">{t('vreview.rec.changed')}</CivicText>
              ) : null}
            </Box>
          ))}
          {mine.data?.aggregate ? (
            <CivicText testID="rec-aggregate">
              {t('vreview.aggregate', mine.data.aggregate)}
            </CivicText>
          ) : null}
        </Box>

        {mine.data && open ? (
          <>
            <CivicButton
              label={t(mine.data.recommendations.length ? 'vreview.finish' : 'vreview.finish.none')}
              accessibilityLabel={t(
                mine.data.recommendations.length ? 'vreview.finish' : 'vreview.finish.none',
              )}
              disabled={finish.isPending}
              onPress={() =>
                finish.mutate(mine.data.recommendations.length ? 'recommendations' : 'no_changes')
              }
            />
            {finish.error ? (
              <StatusMessage state="error" message={t('common.error.generic')} />
            ) : null}
          </>
        ) : mine.data ? (
          <StatusMessage state="success" message={t('vreview.finished')} />
        ) : null}
      </>
    );
  }

  return (
    <Box className="gap-4" testID="review-problem">
      <CivicHeading level={1}>{t('vreview.problem.title')}</CivicHeading>
      {body}
    </Box>
  );
}
