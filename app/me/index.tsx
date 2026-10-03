import { useRouter } from 'expo-router';

import { CivicButton, CivicHeading, Screen } from '../../src/components/civic';
import { useT } from '../../src/i18n';

export default function MyRoute() {
  const t = useT();
  const router = useRouter();
  return (
    <Screen>
      <CivicHeading level={1}>{t('nav.me')}</CivicHeading>
      <CivicButton
        variant="secondary"
        label={t('vreview.optin.title')}
        accessibilityLabel={t('vreview.optin.title')}
        onPress={() => router.push('/review/problems' as never)}
      />
    </Screen>
  );
}
