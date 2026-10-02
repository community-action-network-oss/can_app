import { router } from 'expo-router';

import type { components } from '../api/schema';
import { Box, CivicButton, CivicText } from '../components/civic';
import { useT } from '../i18n';

export type StageMapData = components['schemas']['StageMapDto'];
export type StageNode = StageMapData['stages'][number];

export const names = (map: StageMapData, ids: string[]) =>
  ids.map((i) => map.stages.find((s) => s.id === i)?.label ?? i).join(', ');

export const openStage = (problemId: string, stageId: string) =>
  // ponytail: the workspace route lands with 12-u18; until then this path has no screen
  router.push(`/problems/${problemId}/stages/${stageId}` as never);

/** The text equivalent of the graph: API order is topological, so keyboard order follows dependencies. */
export function StageList({ map }: { map: StageMapData }) {
  const t = useT();
  return (
    <Box
      className="gap-2"
      role="list"
      accessibilityLabel={t('stagemap.listTitle', { n: map.stages.length })}
    >
      {map.stages.map((s) => (
        <Box
          key={s.id}
          role="listitem"
          className="gap-1 p-3 rounded-md border border-can-border bg-can-surface"
        >
          <CivicText variant="bodyStrong">{`${s.ordinal} ${s.label}`}</CivicText>
          <CivicText variant="label">{`(${s.chip})`}</CivicText>
          {s.current ? <CivicText variant="label">{t('stagemap.current')}</CivicText> : null}
          <CivicText muted>
            {s.dependsOn.length
              ? t('stagemap.after', { names: names(map, s.dependsOn) })
              : t('stagemap.afterNothing')}
          </CivicText>
          {s.state === 'ready' || s.state === 'active' || s.state === 'resolving' ? (
            <CivicButton
              variant="secondary"
              label={t('stagemap.open')}
              accessibilityLabel={`${t('stagemap.open')}: ${s.label}`}
              onPress={() => openStage(map.problemId, s.id)}
            />
          ) : null}
        </Box>
      ))}
    </Box>
  );
}
