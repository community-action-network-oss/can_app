import { CivicHeading, Screen } from '../src/components/civic';
import { useT } from '../src/i18n';

export default function WelcomeRoute() {
  const t = useT();
  return (
    <Screen>
      <CivicHeading level={1}>{t('auth.welcome')}</CivicHeading>
    </Screen>
  );
}
