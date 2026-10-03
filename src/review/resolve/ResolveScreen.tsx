import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';

import { api } from '../../api/client';
import { ApiError } from '../../api/errors';
import { unwrap } from '../../api/unwrap';
import type { components } from '../../api/schema';
import {
  Box,
  CivicButton,
  CivicHeading,
  CivicText,
  StatusMessage,
  TextField,
} from '../../components/civic';
import { useT, type MessageId } from '../../i18n';

type Rec = components['schemas']['PosterRecommendationDto'];
type Props = {
  id: string;
  /** Empty until the Guest badge (12-u22) and the Impacted only filter (12-u23) land. */
  guestBadgeSlot?: ReactNode;
  impactedFilterSlot?: ReactNode;
};

const kindOf = (e: unknown) => (e instanceof ApiError ? e.kind : undefined);
const plain = (p: string) => p.replaceAll('_', ' ');

function Card({
  rec,
  n,
  current,
  onDone,
}: {
  rec: Rec;
  n: number;
  current: unknown;
  onDone: () => void;
}) {
  const t = useT();
  const [reason, setReason] = useState('');
  const [needReason, setNeedReason] = useState(false);
  const resolve = useMutation({
    mutationFn: (decision: 'accept' | 'decline') =>
      unwrap(
        api.POST('/v1/recommendations/{id}/resolve', {
          params: { path: { id: rec.id } },
          body: { decision, reason: reason.trim() },
        }),
      ),
    onSuccess: onDone,
  });
  const answer = (d: 'accept' | 'decline') => {
    if (!reason.trim()) return setNeedReason(true);
    setNeedReason(false);
    resolve.mutate(d);
  };
  const err = resolve.error instanceof ApiError ? resolve.error : undefined;
  const target = (() => {
    const s = /^stage_plan\.([^.]+)(\.criteria)?$/.exec(rec.path);
    return s
      ? t(s[2] ? 'vreview.target.stageCriteria' : 'vreview.target.stage', { name: s[1]! })
      : plain(rec.path);
  })();
  const open = rec.status === 'open';
  return (
    <Box
      role="listitem"
      className="gap-2 p-3 rounded-md border border-can-border"
      testID="resolve-card"
    >
      <CivicText variant="bodyStrong">{t('vreview.resolve.reviewer', { n })}</CivicText>
      <CivicText>{`${t('vreview.rec.target')}: ${target}`}</CivicText>
      <CivicText>{`${t('vreview.rec.why')}: ${rec.reason}`}</CivicText>
      <CivicText variant="label">{t('vreview.resolve.diff')}</CivicText>
      {typeof current === 'string' && current ? (
        <CivicText testID="diff-removed">{`- ${t('vreview.resolve.removed')} ${current}`}</CivicText>
      ) : null}
      <CivicText testID="diff-added">{`+ ${t('vreview.resolve.added')} ${rec.recommendation}`}</CivicText>
      {rec.changedSince ? (
        <CivicText variant="caption">{t('vreview.rec.changed')}</CivicText>
      ) : null}
      <CivicText variant="bodyStrong">{t(`vreview.resolve.status.${rec.status}`)}</CivicText>
      {open ? (
        <>
          <TextField
            label={t('vreview.resolve.reason')}
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={600}
            error={
              needReason || err?.status === 400 ? t('vreview.resolve.reasonRequired') : undefined
            }
          />
          <CivicButton
            label={t('vreview.resolve.accept')}
            accessibilityLabel={`${t('vreview.resolve.accept')}: ${target}`}
            disabled={resolve.isPending}
            onPress={() => answer('accept')}
          />
          <CivicButton
            variant="secondary"
            label={t('vreview.resolve.decline')}
            accessibilityLabel={`${t('vreview.resolve.decline')}: ${target}`}
            disabled={resolve.isPending}
            onPress={() => answer('decline')}
          />
          {err && err.status !== 400 ? (
            <StatusMessage
              state="error"
              message={t(err.kind === 'offline' ? 'common.offline.banner' : 'common.error.generic')}
            />
          ) : null}
        </>
      ) : (
        <CivicText>{`${t('vreview.resolve.reason')}: ${rec.resolutionReason ?? ''}`}</CivicText>
      )}
    </Box>
  );
}

/*
 +--------------------------------------+
 | Review of your problem               |
 | In volunteer review                  |
 | 1 review finished, day 3             |
 | We need more volunteers. ...         |
 | 2 recommendations are still open...  |
 | [Edit] [Withdraw]                    |
 |--------------------------------------|
 | Recommendations from volunteers      |
 | Volunteer 1 / Applies to / Why       |
 |  - Removed: ...   + Added: ...       |
 |  Your reason [      ] [Accept][Decline]
 | [ Ask for the publication check ]    |
 +--------------------------------------+ */
/** WF-VREVIEW-3. The publish button follows the server flag only; nothing here is a client rule. */
export function ResolveScreen({ id, guestBadgeSlot, impactedFilterSlot }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const router = useRouter();
  const [confirmW, setConfirmW] = useState(false);
  const statusKey = ['review-status', id];
  const recKey = ['poster-recs', id];
  const status = useQuery({
    queryKey: statusKey,
    retry: false,
    queryFn: () =>
      unwrap(api.GET('/v1/me/problems/{id}/review-status', { params: { path: { id } } })),
  });
  const recs = useQuery({
    queryKey: recKey,
    retry: false,
    queryFn: () =>
      unwrap(api.GET('/v1/me/problems/{id}/recommendations', { params: { path: { id } } })),
  });
  const draft = useQuery({
    queryKey: ['draft', id],
    retry: false,
    queryFn: () => unwrap(api.GET('/v1/drafts/{id}', { params: { path: { id } } })),
  });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: statusKey });
    void qc.invalidateQueries({ queryKey: recKey });
  };
  const publish = useMutation({
    mutationFn: () =>
      unwrap(api.POST('/v1/me/problems/{id}/request-publication', { params: { path: { id } } })),
    onSettled: refresh,
  });
  const withdraw = useMutation({
    mutationFn: () =>
      unwrap(
        api.POST('/v1/drafts/{id}/transitions', {
          params: { path: { id } },
          body: { to: 'withdrawn', expectedVersion: draft.data?.version },
        }),
      ),
    onSuccess: () => router.replace('/me' as never),
  });

  const fail = (kind: MessageId, retry?: () => unknown) => (
    <StatusMessage
      state="error"
      message={t(kind)}
      action={
        retry
          ? {
              label: t('common.error.retry'),
              accessibilityLabel: t('common.error.retry'),
              onPress: () => void retry(),
            }
          : undefined
      }
    />
  );
  const bad = status.error ?? recs.error;
  let body: ReactNode;
  if (bad) {
    const k = kindOf(bad);
    const again = () => {
      void status.refetch();
      void recs.refetch();
    };
    body =
      k === 'offline'
        ? fail('common.offline.banner', again)
        : k === 'session_expired' || k === 'unauthenticated'
          ? fail('session.expired.body')
          : k === 'not_found' || k === 'not_permitted'
            ? fail('vreview.resolve.gone')
            : fail('common.error.generic', again);
  } else if (!status.data || !recs.data) {
    body = <StatusMessage state="loading" message={t('common.loading')} />;
  } else {
    const s = status.data;
    const items = recs.data.items;
    const content = (draft.data?.content ?? {}) as Record<string, unknown>;
    const pubErr = publish.error instanceof ApiError ? publish.error : undefined;
    body = (
      <>
        <Box className="gap-1" accessibilityLiveRegion="polite" testID="resolve-status">
          <CivicText variant="bodyStrong">{t('lifecycle.chip.inReview')}</CivicText>
          <CivicText>
            {t('vreview.resolve.counts', { reviews: s.reviewCount, days: s.dayCount })}
          </CivicText>
          {s.needsReviewers ? (
            <CivicText testID="needs-reviewers">{t('vreview.resolve.needsReviewers')}</CivicText>
          ) : null}
          {s.openRecommendations > 0 ? (
            <CivicText testID="unresolved">
              {t('vreview.resolve.unresolved', { count: s.openRecommendations })}
            </CivicText>
          ) : null}
          <CivicText variant="caption" muted>
            {t('vreview.resolve.wait')}
          </CivicText>
        </Box>
        {guestBadgeSlot}
        {impactedFilterSlot}
        <Box className="gap-2">
          <CivicButton
            variant="secondary"
            label={t('prep.edit')}
            accessibilityLabel={t('prep.edit')}
            onPress={() => router.push(`/me/problems/${id}` as never)}
          />
          {confirmW ? (
            <>
              <CivicText>{t('vreview.resolve.withdraw.ask')}</CivicText>
              <CivicButton
                label={t('vreview.resolve.withdraw.yes')}
                accessibilityLabel={t('vreview.resolve.withdraw.yes')}
                disabled={withdraw.isPending}
                onPress={() => withdraw.mutate()}
              />
              <CivicButton
                variant="secondary"
                label={t('common.back')}
                accessibilityLabel={t('common.back')}
                onPress={() => setConfirmW(false)}
              />
              {withdraw.error ? fail('common.error.generic') : null}
            </>
          ) : (
            <CivicButton
              variant="secondary"
              label={t('vreview.resolve.withdraw')}
              accessibilityLabel={t('vreview.resolve.withdraw')}
              onPress={() => setConfirmW(true)}
            />
          )}
        </Box>
        <CivicHeading level={2}>{t('vreview.resolve.title')}</CivicHeading>
        {items.length === 0 ? (
          <CivicText testID="resolve-empty">{t('vreview.resolve.empty')}</CivicText>
        ) : (
          <Box className="gap-3" role="list">
            {items.map((r, i) => (
              <Card key={r.id} rec={r} n={i + 1} current={content[r.path]} onDone={refresh} />
            ))}
          </Box>
        )}
        {publish.isSuccess ? (
          <StatusMessage state="success" message={t('vreview.publish.recorded')} />
        ) : null}
        {pubErr ? (
          <StatusMessage
            state="error"
            message={t(
              pubErr.kind === 'offline' ? 'common.offline.banner' : 'vreview.publish.refused',
            )}
          />
        ) : null}
        {s.canRequestPublication ? null : (
          <CivicText testID="publish-why">{t('vreview.publish.notYet')}</CivicText>
        )}
        <CivicButton
          label={t('vreview.publish')}
          accessibilityLabel={t('vreview.publish')}
          disabled={!s.canRequestPublication || publish.isPending || publish.isSuccess}
          onPress={() => publish.mutate()}
        />
      </>
    );
  }
  return (
    <Box className="gap-4" testID="review-resolve">
      <CivicHeading level={1}>{t('vreview.resolve.screen')}</CivicHeading>
      {body}
    </Box>
  );
}
