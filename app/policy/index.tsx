import { router } from 'expo-router';

import { CivicButton, CivicHeading, Screen } from '../../src/components/civic';
import { useT } from '../../src/i18n';
import { useSession } from '../../src/navigation/SessionContext';

export default function PRoute() {
  const t = useT();
  const { status } = useSession();
  return (
    <Screen>
      <CivicHeading level={1}>{t('nav.policy')}</CivicHeading>
      {status === 'member' ? (
        <CivicButton
          label={t('policy.new.title')}
          accessibilityLabel={t('policy.new.title')}
          onPress={() => router.push('/policy/new')}
        />
      ) : null}
    </Screen>
  );
}
