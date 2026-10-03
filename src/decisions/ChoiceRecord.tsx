import { router } from 'expo-router';

import type { components } from '../api/schema';
import { Box, CivicButton, CivicHeading, CivicText, StatusMessage } from '../components/civic';
import { useStage } from '../contributions/api';
import { useT } from '../i18n';
import { useSession } from '../navigation/SessionContext';
import { LegalFindings } from '../forms/schema/LegalGate';
import { useStageDecision } from './api';
import { optionLabel } from './optionLabel';

type Rec = components['schemas']['DecisionRecordDto'];

const words = (s: string) => s.replace(/_/g, ' ');

/** The legal gate record per layer: a plain label, the corpus version and article ids (LEGAL-CITE-1), never article text. */
function Gate({ gate }: { gate: Rec['legalGate'] }) {
  const t = useT();
  return (
    <Box className="gap-2" testID="legal-gate">
      <CivicHeading level={3}>{t('choice.gate.title')}</CivicHeading>
      <CivicText variant="bodyStrong">
        {t(gate.outcome === 'blocked' ? 'choice.gate.blocked' : 'choice.gate.clear')}
      </CivicText>
      <LegalFindings findings={gate.findings} />
    </Box>
  );
}

// The Choice section of WF-STAGE-1 (WF-DECREC-1 retired by D-72). Mounted by the stage workspace (12-u18).
export function ChoiceRecord({ problemId, stageId }: { problemId: string; stageId: string }) {
  const t = useT();
  const { status } = useSession();
  const stage = useStage(stageId);
  const q = useStageDecision(stageId);
  const live = q.data?.items.find((i) => !i.withdrawn);
  const withdrawn = q.data?.items.find((i) => i.withdrawn);
  const s = stage.data;
  const canRecord =
    status === 'member' &&
    !!s &&
    s.needsChoice &&
    s.state === 'active' &&
    !live &&
    s.allowedStageTransitions.length > 0;

  let body;
  if (q.isError)
    body = (
      <StatusMessage
        state="error"
        message={t('choice.error')}
        action={{
          label: t('common.error.retry'),
          accessibilityLabel: t('common.error.retry'),
          onPress: () => void q.refetch(),
        }}
      />
    );
  else if (!q.data) body = <StatusMessage state="loading" message={t('common.loading')} />;
  else if (!live)
    body = (
      <Box className="gap-2">
        <CivicText>
          {t(
            s && s.state !== 'active' && s.state !== 'blocked'
              ? 'choice.empty.notStarted'
              : 'choice.empty.open',
          )}
        </CivicText>
        {withdrawn ? <CivicText muted>{t('choice.withdrawn')}</CivicText> : null}
      </Box>
    );
  else {
    const ids = s?.choice?.optionIds ?? [];
    const chosen = (s?.options ?? [])
      .map((o, i) => ({ o, i }))
      .filter(({ o }) => ids.includes(o.id))
      .map(({ o, i }) => optionLabel(o, i + 1, t));
    const steps = (s?.choice?.steps ?? []) as Record<string, unknown>[];
    body = (
      <Box className="gap-3" testID="choice-record">
        {chosen.length ? (
          <Box className="gap-1">
            <CivicText variant="bodyStrong">{t('choice.chosen')}</CivicText>
            {chosen.map((c) => (
              <CivicText key={c}>{c}</CivicText>
            ))}
          </Box>
        ) : null}
        {steps.length ? (
          <Box className="gap-1">
            <CivicText variant="bodyStrong">{t('choice.steps')}</CivicText>
            {steps.map((st, i) => (
              <CivicText
                key={i}
              >{`${i + 1}. ${Object.values(st).find((v) => typeof v === 'string') ?? ''}`}</CivicText>
            ))}
          </Box>
        ) : null}
        <CivicText>{t('choice.method', { method: words(live.method) })}</CivicText>
        <CivicText>{t('choice.why', { text: live.rationale })}</CivicText>
        <CivicText>
          {t('decrec.decidedBy', { handle: live.deciderHandle, authority: live.authority })}
        </CivicText>
        {live.dissentNotes?.length ? (
          <Box className="gap-1">
            <CivicText variant="bodyStrong">{t('decrec.dissent')}</CivicText>
            {live.dissentNotes.map((n) => (
              <CivicText key={n}>{n}</CivicText>
            ))}
          </Box>
        ) : null}
        {live.policyVersion ? (
          <Box className="gap-1 p-3 rounded-md border-2 border-can-border" testID="policy-badge">
            <CivicText variant="bodyStrong">
              {t(live.transitional ? 'status.transitional' : 'status.decidedUnder', {
                version: live.policyVersion,
              })}
            </CivicText>
          </Box>
        ) : null}
        {live.transitional ? <CivicText muted>{t('choice.transitional')}</CivicText> : null}
        <Gate gate={live.legalGate} />
      </Box>
    );
  }

  return (
    <Box className="gap-3" testID="choice-section">
      <CivicHeading level={2}>{t('choice.title')}</CivicHeading>
      {body}
      {canRecord ? (
        <CivicButton
          label={t('choice.make')}
          accessibilityLabel={t('choice.make')}
          onPress={() =>
            router.push({
              pathname: '/problems/[id]/stages/[stageId]/choice',
              params: { id: problemId, stageId },
            })
          }
        />
      ) : null}
    </Box>
  );
}
