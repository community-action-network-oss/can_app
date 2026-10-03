import { router } from 'expo-router';

import { ApiError } from '../api/errors';
import { Box, CivicButton, CivicHeading, CivicText, StatusMessage } from '../components/civic';
import { useStopAllEmails, useMyFollows } from '../follow/api';
import { useT } from '../i18n';
import { useSession } from '../navigation/SessionContext';
import { useMarkRead, useNotifications } from './api';

// "Updates": what happened on problems you chose to follow. Newest first, never ranked, no counts.
export function NotificationsScreen() {
  const t = useT();
  const { status } = useSession();
  const member = status === 'member';
  const q = useNotifications();
  const follows = useMyFollows(member);
  const stop = useStopAllEmails();
  const { one, all } = useMarkRead();

  if (!member)
    return (
      <>
        <CivicHeading level={1}>{t('updates.title')}</CivicHeading>
        <CivicText>{t('updates.signin.why')}</CivicText>
        <CivicButton
          label={t('follow.signin')}
          accessibilityLabel={t('follow.signin')}
          onPress={() =>
            router.push({ pathname: '/sign-in', params: { returnTo: '/me/notifications' } })
          }
        />
      </>
    );

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const offline = q.error instanceof ApiError && q.error.kind === 'offline';
  const emailOn = follows.data?.items.some((f) => f.emailUpdates);
  const failed = one.isError || all.isError || stop.isError;
  return (
    <>
      <CivicHeading level={1}>{t('updates.title')}</CivicHeading>
      <CivicText muted>{t('updates.intro')}</CivicText>
      {q.isPending ? <StatusMessage state="loading" message={t('updates.loading')} /> : null}
      {q.isError ? (
        <StatusMessage
          state="error"
          message={t(offline ? 'common.offline.banner' : 'updates.error')}
          action={{
            label: t('common.error.retry'),
            accessibilityLabel: t('common.error.retry'),
            onPress: () => void q.refetch(),
          }}
        />
      ) : null}
      {failed ? <StatusMessage state="error" message={t('follow.error')} /> : null}
      {q.isSuccess && items.length === 0 ? (
        <StatusMessage state="empty" message={t('updates.empty')} />
      ) : null}
      {items.length > 0 ? (
        <CivicButton
          variant="secondary"
          label={t('updates.readAll')}
          accessibilityLabel={t('updates.readAll')}
          disabled={all.isPending}
          onPress={() => all.mutate()}
        />
      ) : null}
      {items.map((n) => (
        <Box key={n.id} className="gap-1 border-b border-can-border py-3" testID="update-item">
          <CivicText variant={n.read ? 'body' : 'bodyStrong'}>{n.label}</CivicText>
          <CivicText muted>
            {n.problemTitle || t('list.card.untitled')} ·{' '}
            {t('updates.when', { date: Date.parse(n.createdAt) })}
          </CivicText>
          <CivicText variant="caption">{t(n.read ? 'updates.read' : 'updates.unread')}</CivicText>
          <Box className="flex-row flex-wrap gap-2">
            <CivicButton
              variant="secondary"
              label={t('updates.open')}
              accessibilityLabel={t('updates.open.a11y', { title: n.problemTitle ?? '' })}
              onPress={() => router.push(`/problems/${n.problemId}` as never)}
            />
            {n.read ? null : (
              <CivicButton
                variant="secondary"
                label={t('updates.markRead')}
                accessibilityLabel={t('updates.markRead.a11y', { title: n.problemTitle ?? '' })}
                disabled={one.isPending}
                onPress={() => one.mutate(n.id)}
              />
            )}
          </Box>
        </Box>
      ))}
      {q.hasNextPage ? (
        <CivicButton
          variant="secondary"
          label={t('updates.older')}
          accessibilityLabel={t('updates.older')}
          disabled={q.isFetchingNextPage}
          onPress={() => void q.fetchNextPage()}
        />
      ) : null}
      {emailOn ? (
        <Box className="gap-2">
          <CivicText>{t('updates.email.on')}</CivicText>
          <CivicButton
            variant="secondary"
            label={t('follow.stopAll')}
            accessibilityLabel={t('follow.stopAll')}
            disabled={stop.isPending}
            onPress={() => stop.mutate()}
          />
        </Box>
      ) : null}
    </>
  );
}
