import { router } from 'expo-router';

import { CivicButton, CivicHeading, CivicText, Screen } from '../../src/components/civic';
import { useT } from '../../src/i18n';

export default function Welcome() {
  const t = useT();
  return (
    <Screen>
      <CivicHeading level={1}>{t('profile.welcome.title')}</CivicHeading>
      <CivicText>{t('profile.welcome.body')}</CivicText>
      <CivicText variant="bodyStrong">{t('profile.welcome.local')}</CivicText>
      <CivicButton
        label={t('profile.welcome.start')}
        accessibilityLabel={t('profile.welcome.start')}
        onPress={() => router.push('/profile/know')}
      />
      <CivicButton
        variant="secondary"
        label={t('profile.welcome.skip')}
        accessibilityLabel={t('profile.welcome.skip')}
        onPress={() => router.replace('/')}
      />
      <CivicText variant="caption" muted>
        {t('profile.later')}
      </CivicText>
    </Screen>
  );
}
