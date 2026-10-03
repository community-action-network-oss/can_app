import { router } from 'expo-router';
import { useState } from 'react';

import { ApiError } from '../api/errors';
import {
  Box,
  CheckboxField,
  CivicButton,
  CivicHeading,
  CivicText,
  Row,
  StatusMessage,
} from '../components/civic';
import { useT } from '../i18n';
import { useSession } from '../navigation/SessionContext';
import { useFollowActions, useMyFollows, useStopAllEmails } from './api';

const isOffline = (e: unknown) =>
  e instanceof TypeError || (e instanceof ApiError && e.kind === 'offline');

// Follow is an explicit choice, never preselected. Email is a separate opt-in with its sentence in plain view.
export function FollowControl({ problemId }: { problemId: string }) {
  const t = useT();
  const { status } = useSession();
  const member = status === 'member';
  const q = useMyFollows(member);
  const { follow, unfollow, mute } = useFollowActions(problemId);
  const stop = useStopAllEmails();
  const [email, setEmail] = useState(false);
  const mine = q.data?.items.find((f) => f.problemId === problemId);
  const busy = follow.isPending || unfollow.isPending || mute.isPending || stop.isPending;
  const err = [follow, unfollow, mute, stop].find((m) => m.isError)?.error ?? q.error;

  if (status === 'loading') return null;
  if (!member)
    return (
      <Box className="gap-2" testID="follow-guest">
        <CivicHeading level={3}>{t('follow.title')}</CivicHeading>
        <CivicText muted>{t('follow.signin.why')}</CivicText>
        <CivicButton
          variant="secondary"
          label={t('follow.signin')}
          accessibilityLabel={t('follow.signin')}
          onPress={() =>
            router.push({ pathname: '/sign-in', params: { returnTo: `/problems/${problemId}` } })
          }
        />
      </Box>
    );
  if (q.isPending) return <StatusMessage state="loading" message={t('follow.loading')} />;

  const consent = <CivicText variant="caption">{t('follow.email.consent')}</CivicText>;
  return (
    <Box className="gap-2" testID="follow-control">
      <CivicHeading level={3}>{t('follow.title')}</CivicHeading>
      {err ? (
        <StatusMessage
          state="error"
          message={t(isOffline(err) ? 'common.offline.banner' : 'follow.error')}
        />
      ) : null}
      {!mine ? (
        <>
          <CheckboxField
            label={t('follow.email.label')}
            checked={email}
            onToggle={() => setEmail(!email)}
          />
          {consent}
          <CivicButton
            label={t('follow.follow')}
            accessibilityLabel={t('follow.follow')}
            disabled={busy}
            onPress={() => follow.mutate(email)}
          />
        </>
      ) : (
        <>
          <CivicText accessibilityLiveRegion="polite">
            {t(mine.muted ? 'follow.state.muted' : 'follow.state.following')}
          </CivicText>
          <CheckboxField
            label={t('follow.email.label')}
            checked={mine.emailUpdates}
            onToggle={() => !busy && follow.mutate(!mine.emailUpdates)}
          />
          {consent}
          <Row>
            <CivicButton
              variant="secondary"
              label={t(mine.muted ? 'follow.unmute' : 'follow.mute')}
              accessibilityLabel={t(mine.muted ? 'follow.unmute' : 'follow.mute')}
              disabled={busy}
              onPress={() => mute.mutate(!mine.muted)}
            />
            <CivicButton
              variant="secondary"
              label={t('follow.unfollow')}
              accessibilityLabel={t('follow.unfollow')}
              disabled={busy}
              onPress={() => unfollow.mutate()}
            />
            {mine.emailUpdates ? (
              <CivicButton
                variant="secondary"
                label={t('follow.stopAll')}
                accessibilityLabel={t('follow.stopAll')}
                disabled={busy}
                onPress={() => stop.mutate()}
              />
            ) : null}
          </Row>
        </>
      )}
    </Box>
  );
}
