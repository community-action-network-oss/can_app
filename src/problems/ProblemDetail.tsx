import { router } from 'expo-router';

import { ApiError } from '../api/errors';
import { Box, CivicButton, CivicHeading, CivicText, StatusMessage } from '../components/civic';
import { useT } from '../i18n';
import { StageSection } from '../stages/StageSection';
import { StatusPanel } from './StatusPanel';
import { Timeline } from './Timeline';
import { useProblem } from './useProblem';

const back = (label: string) => (
  <CivicButton
    variant="secondary"
    label={label}
    accessibilityLabel={label}
    onPress={() => router.push('/')}
  />
);

const Block = ({ title, body }: { title: string; body: string | null }) =>
  body ? (
    <Box className="gap-1">
      <CivicHeading level={3}>{title}</CivicHeading>
      <CivicText>{body}</CivicText>
    </Box>
  ) : null;

// WF-DETAIL-1 and WF-DETAIL-2. One h1 per state.
export function ProblemDetail({ id }: { id: string }) {
  const t = useT();
  const q = useProblem(id);
  const p = q.data;
  const retry = {
    label: t('common.error.retry'),
    accessibilityLabel: t('common.error.retry'),
    onPress: () => void q.refetch(),
  };

  if (!p) {
    if (q.isPending) return <StatusMessage state="loading" message={t('detail.loading')} />;
    // Same screen for "never existed" and "private to you": existence is not leaked.
    if (q.error instanceof ApiError && q.error.kind === 'not_found')
      return (
        <>
          <CivicHeading level={1}>{t('detail.notFound.title')}</CivicHeading>
          <CivicText>{t('tombstone.notFound')}</CivicText>
          {back(t('detail.back'))}
        </>
      );
    const offline = q.error instanceof ApiError && q.error.kind === 'offline';
    return (
      <>
        <StatusMessage
          state="error"
          message={t(offline ? 'common.offline.banner' : 'detail.error')}
          action={retry}
        />
        {back(t('detail.back'))}
      </>
    );
  }

  const tomb = p.tombstone;
  if (tomb)
    return (
      <>
        <CivicHeading level={1}>{t('tombstone.title')}</CivicHeading>
        <CivicText>{t('detail.tombstone.on', { date: Date.parse(tomb.tombstonedAt) })}</CivicText>
        {tomb.reason ? <CivicText>{tomb.reason}</CivicText> : null}
        <CivicText muted>{t('detail.tombstone.kept')}</CivicText>
        {back(t('detail.back'))}
      </>
    );

  const place = [p.jurisdiction, p.coarseArea].filter(Boolean).join(', ');
  const offline = q.error instanceof ApiError && q.error.kind === 'offline';
  return (
    <>
      {back(t('detail.back'))}
      {offline ? (
        <StatusMessage state="error" message={t('common.offline.banner')} action={retry} />
      ) : null}
      <CivicHeading level={1}>{p.title || t('list.card.untitled')}</CivicHeading>
      <CivicText muted>
        {p.authorHandle
          ? t('detail.byline', { handle: p.authorHandle, place })
          : p.isSeed
            ? t('detail.bylineSeed', { place })
            : place}
      </CivicText>
      {p.isSeed ? <CivicText variant="caption">{t('detail.seed.explain')}</CivicText> : null}
      <StatusPanel p={p} />
      <StageSection problemId={id} />
      {p.duplicateOf ? <CivicText>{t('detail.duplicate')}</CivicText> : null}
      <CivicHeading level={2}>{t('detail.about')}</CivicHeading>
      <Block title={t('detail.condition')} body={p.condition} />
      <Block title={t('detail.affected')} body={p.affected} />
      <Block title={t('detail.known')} body={p.observed} />
      <Block title={t('detail.uncertain')} body={p.uncertain} />
      <Block title={t('detail.desiredOutcome')} body={p.desiredOutcome} />
      {place ? <CivicText muted>{t('detail.place', { place })}</CivicText> : null}
      {p.reviewCount > 0 ? (
        <CivicText muted>{t('detail.reviewCount', { count: p.reviewCount })}</CivicText>
      ) : null}
      <Timeline id={id} />
    </>
  );
}
