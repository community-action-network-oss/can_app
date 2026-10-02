import { Box, CivicHeading, CivicText } from '../../components/civic';
import { useT } from '../../i18n';

// The context profile endpoints (13-u03) are not in the generated client yet. Nothing is confirmed by default.
// ponytail: per-dimension Confirm rows arrive with those endpoints; this row keeps the form unblocked.
export function ContextProfileRows() {
  const t = useT();
  return (
    <Box className="gap-1" testID="context-profile">
      <CivicHeading level={2}>{t('submit.context.title')}</CivicHeading>
      <CivicText variant="caption" muted>
        {t('submit.context.unavailable')}
      </CivicText>
    </Box>
  );
}
