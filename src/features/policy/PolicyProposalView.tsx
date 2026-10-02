import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking } from 'react-native';

import { api } from '../../api/client';
import type { components } from '../../api/schema';
import { ApiError } from '../../api/errors';
import { unwrap } from '../../api/unwrap';
import { Box, CivicButton, CivicHeading, CivicText, StatusMessage } from '../../components/civic';
import { SchemaForm } from '../../forms/schema/SchemaForm';
import type { Schema, Value } from '../../forms/schema/model';
import { useContentSchema } from '../../forms/schema/useContentSchema';
import { useT, type MessageId } from '../../i18n';

type Proposal = components['schemas']['PolicyProposalDto'];
const ROLLOUT = ['shadow', 'canary', 'full'] as const;
const PANEL = {
  not_started: 'open',
  waiting_for_panel: 'open',
  ratified: 'done',
  closed: 'declined',
} as const;
const noop = () => undefined;

/** The submitted body, read-only. One read-only SchemaForm over the real schema: readers page through sections with Back and Next. */
function Summary({ p }: { p: Proposal }) {
  const t = useT();
  const q = useContentSchema('policy_proposal', { version: p.schemaVersion });
  const [value] = useState<Value>(p.body as Value);
  if (!q.data) return <CivicText>{p.changeSummary}</CivicText>;
  const schema = q.data.schema as Schema;
  return (
    <Box className="gap-4" testID="policy-summary">
      <CivicHeading level={2}>{t('policy.view.summary')}</CivicHeading>
      <SchemaForm
        readOnly
        schema={schema}
        messages={q.data.messages}
        value={value}
        onChange={noop}
        onSubmit={noop}
      />
    </Box>
  );
}

function Eval({ p }: { p: Proposal }) {
  const t = useT();
  return (
    <Box className="gap-2" testID="policy-eval">
      <CivicHeading level={2}>{t('policy.eval.title')}</CivicHeading>
      <CivicText muted>{t('policy.eval.recorded')}</CivicText>
      {p.eval?.length ? (
        <Box role="list" className="gap-1">
          {p.eval.map((r) => (
            <Box key={r.name} role="listitem">
              <CivicText variant={r.status === 'passed' ? 'body' : 'bodyStrong'}>
                {`${r.status === 'passed' ? '✓' : '✕'} ${t(
                  r.status === 'passed' ? 'policy.eval.row.pass' : 'policy.eval.row.fail',
                  { name: r.name },
                )}`}
              </CivicText>
            </Box>
          ))}
        </Box>
      ) : (
        <CivicText>{t('policy.eval.none')}</CivicText>
      )}
    </Box>
  );
}

function Replay({ p }: { p: Proposal }) {
  const t = useT();
  const r = p.replay;
  return (
    <Box className="gap-2" testID="policy-replay">
      <CivicHeading level={2}>{t('policy.replay.title')}</CivicHeading>
      {r ? (
        <>
          {r.verdict === 'blocked' ? (
            <CivicText variant="bodyStrong">{`✕ ${t('policy.replay.blocked')}`}</CivicText>
          ) : null}
          <CivicText>{t('policy.replay.body', { flips: r.changed, total: r.of })}</CivicText>
          <CivicText>{t('policy.replay.expected', { count: r.expected })}</CivicText>
          <CivicText>{t('policy.replay.unexpected', { count: r.unexpected })}</CivicText>
          <CivicText>{t('policy.replay.stricter', { count: r.stricter })}</CivicText>
          <CivicText>{t('policy.replay.morePermissive', { count: r.morePermissive })}</CivicText>
          <CivicText muted>{t('policy.replay.masked')}</CivicText>
        </>
      ) : (
        <CivicText>{t('policy.replay.none')}</CivicText>
      )}
    </Box>
  );
}

function Ratification({ p }: { p: Proposal }) {
  const t = useT();
  return (
    <Box className="gap-2" testID="policy-ratify">
      <CivicHeading level={2}>{t('policy.ratify.title')}</CivicHeading>
      <CivicText>{t('policy.ratify.panel')}</CivicText>
      <CivicText variant="bodyStrong">
        {t('policy.ratify.status', { state: PANEL[p.ratification.panelStatus] })}
      </CivicText>
      {p.ratification.transitional ? (
        <CivicText testID="policy-transitional">{t('policy.ratify.transitional')}</CivicText>
      ) : null}
      <CivicText>{t('policy.ratify.dissent')}</CivicText>
      <CivicText muted>{t('policy.ratify.dissentNone')}</CivicText>
    </Box>
  );
}

function Rollout({ p }: { p: Proposal }) {
  const t = useT();
  return (
    <Box className="gap-2" testID="policy-rollout">
      <CivicHeading level={2}>{t('policy.rollout.title')}</CivicHeading>
      <Box role="list" className="gap-1">
        {ROLLOUT.map((s) => {
          const at = p.rollout.find((r) => r.stage === s)?.at;
          const stage = t(`policy.stage.${s}` as MessageId);
          return (
            <Box key={s} role="listitem">
              <CivicText>
                {at
                  ? t('policy.rollout.reached', { stage, date: new Date(at).getTime() })
                  : t('policy.rollout.pending', { stage })}
                {p.stage === s ? ` (${t('policy.rollout.current')})` : ''}
              </CivicText>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/** WF-POLICY-2. Read-only for everyone; no ratification or maintainer actions in this unit. */
export function PolicyProposalView({ id }: { id: string }) {
  const t = useT();
  const q = useQuery({
    queryKey: ['policy-proposal', id],
    retry: false,
    queryFn: () => unwrap(api.GET('/v1/policy-proposals/{id}', { params: { path: { id } } })),
  });
  const back = (
    <CivicButton
      variant="secondary"
      label={t('policy.view.back')}
      accessibilityLabel={t('policy.view.back')}
      onPress={() => router.push('/policy')}
    />
  );
  const p = q.data;
  if (!p) {
    if (q.isPending) return <StatusMessage state="loading" message={t('policy.view.loading')} />;
    if (q.error instanceof ApiError && q.error.kind === 'not_found')
      return (
        <>
          <CivicHeading level={1}>{t('policy.view.notFound.title')}</CivicHeading>
          <CivicText>{t('policy.view.notFound.body')}</CivicText>
          {back}
        </>
      );
    return (
      <>
        <StatusMessage
          state="error"
          message={t(
            q.error instanceof ApiError && q.error.kind === 'offline'
              ? 'common.offline.banner'
              : 'common.error.generic',
          )}
          action={{
            label: t('common.error.retry'),
            accessibilityLabel: t('common.error.retry'),
            onPress: () => void q.refetch(),
          }}
        />
        {back}
      </>
    );
  }
  const pr = p.prUrl?.startsWith('https://') ? p.prUrl : null;
  return (
    <Box className="gap-6" testID="policy-proposal-view">
      <Box className="gap-1">
        <CivicHeading level={1}>{t('policy.view.title')}</CivicHeading>
        <CivicText variant="bodyStrong" testID="policy-stage">
          {t('policy.stage.line', { stage: t(`policy.stage.${p.stage}` as MessageId) })}
        </CivicText>
        {p.blockedReason ? (
          <CivicText>{t('policy.view.blocked', { reason: p.blockedReason })}</CivicText>
        ) : null}
        {pr ? (
          <CivicButton
            variant="secondary"
            label={t('policy.view.pr')}
            accessibilityLabel={t('policy.view.pr')}
            onPress={() => void Linking.openURL(pr)}
          />
        ) : null}
      </Box>
      <Summary p={p} />
      <Eval p={p} />
      <Replay p={p} />
      <Ratification p={p} />
      <Rollout p={p} />
      {back}
    </Box>
  );
}
