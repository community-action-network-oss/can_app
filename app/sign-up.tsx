import { CivicHeading, Screen } from '../src/components/civic';
import { useT } from '../src/i18n';

export default function SignUpRoute() {
  const t = useT();
  return (
    <Screen>
      <CivicHeading level={1}>{t('auth.signUp')}</CivicHeading>
    </Screen>
  );
}
