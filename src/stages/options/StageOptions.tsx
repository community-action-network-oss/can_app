import { router } from 'expo-router';

import { Box, CivicButton, CivicHeading, CivicText, StatusMessage } from '../../components/civic';
import { useT } from '../../i18n';
import { useSession } from '../../navigation/SessionContext';
import { useStageOptions } from './api';
import { OptionsComparison } from './OptionsComparison';

// Mount point for the stage workspace (12-u18). Guests read; members can add.
export function StageOptions({ problemId, stageId }: { problemId: string; stageId: string }) {
  const t = useT();
  const { status } = useSession();
  const q = useStageOptions(stageId);
  const member = status === 'member';
  return (
    <Box className="gap-3" testID="stage-options">
      <CivicHeading level={2}>{t('stage.options')}</CivicHeading>
      {q.data ? (
        <OptionsComparison
          data={q.data}
          problemId={problemId}
          stageId={stageId}
          canAdd={member}
          goImprove={(id, s, improves) =>
            router.push({ pathname: '/problems/[id]/add', params: { id, stageId: s, improves } })
          }
        />
      ) : q.isError ? (
        <StatusMessage
          state="error"
          message={t('option.error')}
          action={{
            label: t('common.error.retry'),
            accessibilityLabel: t('common.error.retry'),
            onPress: () => void q.refetch(),
          }}
        />
      ) : (
        <StatusMessage state="loading" message={t('common.loading')} />
      )}
      {member ? (
        <CivicButton
          label={t('stage.option.add')}
          accessibilityLabel={t('stage.option.add')}
          onPress={() =>
            router.push({
              pathname: '/problems/[id]/stages/[stageId]/option',
              params: { id: problemId, stageId },
            })
          }
        />
      ) : status === 'guest' ? (
        <CivicText muted>{t('contrib.add.signinWhy')}</CivicText>
      ) : null}
    </Box>
  );
}
