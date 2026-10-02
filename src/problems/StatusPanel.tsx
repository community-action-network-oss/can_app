import type { components } from '../api/schema';
import { Box, CivicHeading, CivicText } from '../components/civic';
import { useT } from '../i18n';

export type ProblemDetail = components['schemas']['ProblemDetailDto'];

// Everything shown is the API's own wording. `variant` stays open for paused, stuck and closed (plan 05); only the base is built.
export function StatusPanel({ p }: { p: ProblemDetail; variant?: 'base' | (string & {}) }) {
  const t = useT();
  return (
    <Box className="gap-2 p-4 rounded-md border border-can-border bg-can-surface">
      <CivicHeading level={2}>{t('detail.status')}</CivicHeading>
      <CivicText variant="bodyStrong">{`◆ ${p.label}`}</CivicText>
      {p.investigationNeeded ? (
        <CivicText variant="bodyStrong">{`▲ ${t('list.card.needsInvestigation')}`}</CivicText>
      ) : null}
      <CivicText>{p.explanation}</CivicText>
      <CivicText variant="label">{t('detail.neededNext')}</CivicText>
      <CivicText>{p.nextAction}</CivicText>
      {p.pauseReason ? <CivicText>{p.pauseReason}</CivicText> : null}
      {p.resumeCondition ? <CivicText>{p.resumeCondition}</CivicText> : null}
      {p.policyVersion ? (
        <CivicText variant="caption" muted>
          {t(p.reopened ? 'list.card.reopened' : 'list.card.decided', { version: p.policyVersion })}
        </CivicText>
      ) : null}
      {p.transitional ? (
        <CivicText variant="caption" muted>
          {t('detail.transitional')}
        </CivicText>
      ) : null}
    </Box>
  );
}
