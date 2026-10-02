import { CivicHeading, Screen } from '../../src/components/civic';
import { useT } from '../../src/i18n';

export default function RRoute() {
  const t = useT();
  return (
    <Screen>
      <CivicHeading level={1}>{t('nav.review')}</CivicHeading>
    </Screen>
  );
}
