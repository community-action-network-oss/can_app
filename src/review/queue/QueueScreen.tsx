import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { api } from '../../api/client';
import { ApiError } from '../../api/errors';
import { unwrap } from '../../api/unwrap';
import { Box, CivicButton, CivicHeading, CivicText, StatusMessage } from '../../components/civic';
import { useT, type MessageId } from '../../i18n';
import { useSession } from '../../navigation/SessionContext';
import { loadReviewOptIn, reviewOptInKey } from './optIn';

function errorId(e: unknown): MessageId {
  const kind = e instanceof ApiError ? e.kind : 'server';
  return kind === 'offline'
    ? 'common.offline.banner'
    : kind === 'rate_limited'
      ? 'vreview.error.rateLimited'
      : kind === 'not_permitted'
        ? 'vreview.error.notPermitted'
        : 'common.error.generic';
}

/*
 +--------------------------------------+
 | Problems to review                   |
 | (not opted in)                       |
 | Review as a volunteer                |
 | You can check problems before ...    |
 | [ Turn on volunteer review ]         |
 |--------------------------------------|
 | (opted in)                           |
 | [ Turn off volunteer review ]        |
 | Personal details are hidden. ...     |
 | Amsterdam, 4 stages, 2 sources       |
 |   You finished this one              |
 |   [ Review this problem ]            |
 | (empty) Nothing to review right now. |
 +--------------------------------------+ */
/** WF-VREVIEW-1. Place and structure only: no title, handle, count-as-status or ranking. */
export function QueueScreen() {
  const t = useT();
  const qc = useQueryClient();
  const router = useRouter();
  const { handle } = useSession();
  const key = reviewOptInKey(handle);
  const [said, setSaid] = useState<MessageId>();

  const optIn = useQuery({ queryKey: key, queryFn: loadReviewOptIn, staleTime: Infinity });
  const on = optIn.data?.optedIn === true;
  const queue = useQuery({
    queryKey: ['review-queue', handle],
    enabled: on,
    queryFn: () => unwrap(api.GET('/v1/review/queue')),
  });

  const toggle = useMutation({
    mutationFn: (next: boolean) =>
      unwrap(next ? api.POST('/v1/me/review-opt-in') : api.DELETE('/v1/me/review-opt-in')),
    onSuccess: (dto, next) => {
      qc.setQueryData(key, dto); // nav reads the same key, so Review problems appears or goes at once
      if (!next) qc.removeQueries({ queryKey: ['review-queue', handle] });
      setSaid(next ? 'vreview.optin.nowOn' : 'vreview.optin.nowOff');
    },
  });

  const retry = (f: () => unknown) => ({
    label: t('common.error.retry'),
    accessibilityLabel: t('common.error.retry'),
    onPress: () => void f(),
  });

  let body;
  if (optIn.error) {
    body = (
      <StatusMessage
        state="error"
        message={t(errorId(optIn.error))}
        action={retry(optIn.refetch)}
      />
    );
  } else if (!optIn.data) {
    body = <StatusMessage state="loading" message={t('common.loading')} />;
  } else {
    const switchButton = (
      <CivicButton
        label={t(on ? 'vreview.optin.off' : 'vreview.optin.on')}
        accessibilityLabel={t(on ? 'vreview.optin.off' : 'vreview.optin.on')}
        variant={on ? 'secondary' : 'primary'}
        disabled={toggle.isPending}
        onPress={() => toggle.mutate(!on)}
      />
    );
    body = (
      <>
        {on ? null : (
          <Box className="gap-2">
            <CivicHeading level={2}>{t('vreview.optin.title')}</CivicHeading>
            <CivicText>{t('vreview.optin.body')}</CivicText>
          </Box>
        )}
        {switchButton}
        {toggle.error ? (
          <StatusMessage state="error" message={t(errorId(toggle.error))} />
        ) : said ? (
          <StatusMessage state="success" message={t(said)} />
        ) : null}
        {on ? (
          <>
            <CivicText>{t('vreview.masked')}</CivicText>
            {queue.error ? (
              <StatusMessage
                state="error"
                message={t(errorId(queue.error))}
                action={retry(queue.refetch)}
              />
            ) : !queue.data ? (
              <StatusMessage state="loading" message={t('common.loading')} />
            ) : queue.data.items.length === 0 ? (
              <StatusMessage state="empty" message={t('vreview.queue.empty')} />
            ) : (
              queue.data.items.map((i) => {
                const place = i.coarseArea ?? t('vreview.queue.noPlace');
                return (
                  <Box
                    key={i.problemId}
                    role="listitem"
                    className="gap-1 border-b border-can-border pb-3"
                    testID="queue-item"
                  >
                    <CivicText>
                      {t('vreview.queue.shape', {
                        place,
                        stages: i.stageCount,
                        sources: i.sourceCount,
                      })}
                    </CivicText>
                    <CivicText variant="caption" muted>
                      {t(`vreview.mine.${i.mine}`)}
                    </CivicText>
                    <CivicButton
                      label={t('vreview.open')}
                      accessibilityLabel={t('vreview.open.label', { place })}
                      variant="secondary"
                      onPress={() => router.push(`/review/problems/${i.problemId}` as never)}
                    />
                  </Box>
                );
              })
            )}
          </>
        ) : null}
      </>
    );
  }

  return (
    <Box className="gap-4" testID="review-queue">
      <CivicHeading level={1}>{t('vreview.queue.title')}</CivicHeading>
      {body}
    </Box>
  );
}
