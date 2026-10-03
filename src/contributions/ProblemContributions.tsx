import { router } from 'expo-router';

import { Box, CivicButton, CivicHeading, CivicText } from '../components/civic';
import { useT } from '../i18n';
import { useSession } from '../navigation/SessionContext';
import { ContributionList } from './ContributionList';

// Overview section for contributions to the whole problem (stage ones live in the stage workspace).
export function ProblemContributions({ id, allowed }: { id: string; allowed: string[] }) {
  const t = useT();
  const { status } = useSession();
  const btn = (label: string, onPress: () => void) => (
    <CivicButton label={label} accessibilityLabel={label} onPress={onPress} />
  );
  return (
    <Box className="gap-3" testID="problem-contributions">
      <CivicHeading level={2}>{t('contrib.list.title')}</CivicHeading>
      <ContributionList problemId={id} problemLevel />
      {allowed.length
        ? btn(t('contrib.add.open'), () =>
            router.push({ pathname: '/problems/[id]/add', params: { id } }),
          )
        : null}
      {status === 'guest' ? (
        <>
          <CivicText muted>{t('contrib.add.signinWhy')}</CivicText>
          {btn(t('contrib.add.signin'), () =>
            router.push({ pathname: '/sign-in', params: { returnTo: `/problems/${id}/add` } }),
          )}
        </>
      ) : null}
    </Box>
  );
}
