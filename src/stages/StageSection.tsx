import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { Box, CivicButton, CivicHeading, CivicText, Row } from '../components/civic';
import { useT } from '../i18n';
import { names, StageList, type StageMapData } from './StageList';
import { StageMap } from './StageMap';
import { useStages } from './useStages';

// WF-STAGEMAP-1. Quiet when the plan is unavailable: the rest of the page still stands.
export function StageSection({ problemId }: { problemId: string }) {
  const t = useT();
  const { width } = useWindowDimensions();
  const [pick, setPick] = useState<'graph' | 'list' | null>(null);
  const [soon, setSoon] = useState(false);
  const q = useStages(problemId);
  const map = q.data as StageMapData | undefined;
  if (q.isPending) return <CivicText muted>{t('stagemap.loading')}</CivicText>;
  if (!map || !Array.isArray(map.stages))
    return q.isError ? <CivicText muted>{t('stagemap.error')}</CivicText> : null;

  const view = pick ?? (width < 640 ? 'list' : 'graph');
  const sinks = map.stages.filter((s) => !map.edges.some((e) => e.from === s.id)).map((s) => s.id);
  const chip = map.activeStages
    ? map.activeStages === 1
      ? t('lifecycle.chip.active', { name: map.stages.find((s) => s.current)?.label ?? '' })
      : t('lifecycle.chip.activeMany', { n: map.activeStages })
    : null;
  const toggle = (v: 'graph' | 'list') => (
    <CivicButton
      variant={view === v ? 'primary' : 'secondary'}
      label={t(v === 'graph' ? 'plan.view.graph' : 'plan.view.list')}
      accessibilityLabel={t(v === 'graph' ? 'plan.view.graph' : 'plan.view.list')}
      accessibilityState={{ selected: view === v }}
      onPress={() => setPick(v)}
    />
  );
  return (
    <Box className="gap-2">
      <CivicHeading level={2}>{t('stagemap.title')}</CivicHeading>
      {chip ? <CivicText variant="bodyStrong">{chip}</CivicText> : null}
      {map.stages.length ? (
        <>
          <CivicText muted>{t('stagemap.help')}</CivicText>
          <Row>
            {toggle('graph')}
            {toggle('list')}
          </Row>
          {view === 'graph' ? <StageMap map={map} /> : <StageList map={map} />}
        </>
      ) : (
        <CivicText muted>{t('stagemap.empty')}</CivicText>
      )}
      <CivicText>
        {`${t('stagemap.final')}${sinks.length ? `: ${t('stagemap.finalAfter', { names: names(map, sinks) })}` : ''}`}
      </CivicText>
      {map.finalCriteria.map((c) => (
        <CivicText key={c.ref} muted>{`${c.ref}. ${c.statement}`}</CivicText>
      ))}
      <CivicButton
        variant="secondary"
        label={t('stagemap.change')}
        accessibilityLabel={t('stagemap.change')}
        onPress={() => setSoon(true)}
      />
      {soon ? <CivicText muted>{t('stagemap.change.soon')}</CivicText> : null}
    </Box>
  );
}
