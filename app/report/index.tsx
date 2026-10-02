import { CivicHeading, Screen } from '../../src/components/civic';
import { useT } from '../../src/i18n';

export default function ReportRoute() {
  const t = useT();
  return (
    <Screen>
      <CivicHeading level={1}>{t('nav.report')}</CivicHeading>
    </Screen>
  );
}
