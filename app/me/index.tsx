import { CivicHeading, Screen } from '../../src/components/civic';
import { useT } from '../../src/i18n';

export default function MyRoute() {
  const t = useT();
  return (
    <Screen>
      <CivicHeading level={1}>{t('nav.me')}</CivicHeading>
    </Screen>
  );
}
