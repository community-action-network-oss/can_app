import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  Box,
  CivicButton,
  CivicHeading,
  CivicText,
  Screen,
  StatusMessage,
} from '../src/components/civic';
import { useT } from '../src/i18n';
import { matchProblems, type Reason } from '../src/match/match';
import { fetchPublicProblems } from '../src/match/problems';
import { addNotForMe, loadNotForMe } from '../src/profile/notForMe';
import { isEmpty } from '../src/profile/model';
import { useSavedProfile } from '../src/profile/useProfile';

// WF-MATCH-1. The query key and fetch carry nothing from the profile; matching happens below, on the device.
export default function Match() {
  const t = useT();
  const { profile, ready } = useSavedProfile();
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [all, setAll] = useState(false);
  const list = useQuery({ queryKey: ['problems', 'public'], queryFn: fetchPublicProblems });

  useEffect(() => {
    void loadNotForMe().then(setHidden);
  }, []);

  const why = (r: Reason) =>
    r.kind === 'skill'
      ? t('match.why.skill', { group: t(`profile.know.${r.value}`) })
      : r.kind === 'language'
        ? t('match.why.language', { language: t(`profile.lang.${r.value}` as 'profile.lang.en') })
        : r.kind === 'topic'
          ? t('match.why.topic', { topic: t(`profile.topic.${r.value}` as 'profile.topic.air') })
          : t('match.why.place', { place: r.value });

  const items = list.data ?? [];
  const noProfile = ready && isEmpty(profile);
  const matches = ready && !noProfile ? matchProblems(profile, items, hidden) : [];
  const open = (id: string) => router.push(`/problems/${id}` as never);

  return (
    <Screen>
      <CivicHeading level={1}>{t('match.title')}</CivicHeading>
      <CivicText>{t('match.intro')}</CivicText>
      <CivicText variant="caption" muted>
        {t('match.local')}
      </CivicText>

      {list.isError ? (
        <StatusMessage
          state="error"
          message={t('match.error')}
          action={{
            label: t('common.error.retry'),
            accessibilityLabel: t('common.error.retry'),
            onPress: () => void list.refetch(),
          }}
        />
      ) : list.isPending ? (
        <StatusMessage state="loading" message={t('match.loading')} />
      ) : null}

      {!all && noProfile ? (
        <>
          <CivicText>{t('match.noProfile')}</CivicText>
          <CivicButton
            label={t('match.setup')}
            accessibilityLabel={t('match.setup')}
            onPress={() => router.push('/profile/welcome')}
          />
        </>
      ) : null}

      {!all && !noProfile && list.data && matches.length === 0 ? (
        <StatusMessage
          state="empty"
          title={t('match.empty.title')}
          message={t('match.empty.body')}
        />
      ) : null}

      {(all ? items.map((item) => ({ item, reasons: [] as Reason[] })) : matches).map(
        ({ item, reasons }) => (
          <Box
            key={item.id}
            className="gap-2 p-4 rounded-md border border-can-border bg-can-surface"
          >
            <CivicHeading level={2}>{item.title}</CivicHeading>
            {item.coarseArea ? <CivicText muted>{item.coarseArea}</CivicText> : null}
            {reasons.length ? (
              <>
                <CivicText variant="bodyStrong">{t('match.why')}</CivicText>
                {reasons.map((r) => (
                  <CivicText key={`${r.kind}:${r.value}`}>{why(r)}</CivicText>
                ))}
              </>
            ) : null}
            <CivicButton
              label={t('match.open')}
              accessibilityLabel={`${t('match.open')}: ${item.title}`}
              onPress={() => open(item.id)}
            />
            {!all ? (
              <CivicButton
                variant="secondary"
                label={t('match.notForMe')}
                accessibilityLabel={`${t('match.notForMe')}: ${item.title}`}
                onPress={() => void addNotForMe(item.id).then(setHidden)}
              />
            ) : null}
          </Box>
        ),
      )}

      <CivicButton
        variant="secondary"
        label={all ? t('match.plainList.hide') : t('match.plainList')}
        accessibilityLabel={all ? t('match.plainList.hide') : t('match.plainList')}
        onPress={() => setAll(!all)}
      />
      <CivicButton
        variant="secondary"
        label={t('match.edit')}
        accessibilityLabel={t('match.edit')}
        onPress={() => router.push('/profile')}
      />
      <CivicText variant="caption" muted>
        {t('match.notify.off')}
      </CivicText>
    </Screen>
  );
}
