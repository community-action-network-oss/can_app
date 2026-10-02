import { router } from 'expo-router';

import { Box, CivicButton, CivicHeading, CivicText, Row } from '../components/civic';
import type { components } from '../api/schema';
import { useT } from '../i18n';

export type PublicProblem = components['schemas']['PublicProblemDto'];

// No counts, likes or popularity. The stage label comes from the API; the leading shape keeps colour from being the only signal.
export function ProblemCard({ p }: { p: PublicProblem }) {
  const t = useT();
  const title = p.title || t('list.card.untitled');
  const place = [p.jurisdiction, p.coarseArea].filter(Boolean).join(', ');
  return (
    <Box className="gap-2 p-4 rounded-md border border-can-border bg-can-surface">
      <CivicHeading level={2}>{title}</CivicHeading>
      {p.isSeed ? <CivicText variant="caption">{t('list.card.seed')}</CivicText> : null}
      <Row>
        <CivicText variant="bodyStrong">{`◆ ${p.label}`}</CivicText>
        {p.investigationNeeded ? (
          <CivicText variant="bodyStrong">{`▲ ${t('list.card.needsInvestigation')}`}</CivicText>
        ) : null}
      </Row>
      {place ? <CivicText muted>{place}</CivicText> : null}
      {p.policyVersion ? (
        <CivicText variant="caption" muted>
          {t(p.reopened ? 'list.card.reopened' : 'list.card.decided', { version: p.policyVersion })}
        </CivicText>
      ) : null}
      <CivicButton
        variant="secondary"
        label={t('list.card.open')}
        accessibilityLabel={`${t('list.card.open')}: ${title}`}
        onPress={() => router.push(`/problems/${p.id}` as never)}
      />
    </Box>
  );
}
