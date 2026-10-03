import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  Box,
  CivicButton,
  CivicHeading,
  CivicText,
  StatusMessage,
  TextField,
} from '../../components/civic';
import { useStage, type PostFailure } from '../../contributions/api';
import { useT } from '../../i18n';
import { useSession } from '../../navigation/SessionContext';
import { isList, kindOf, postTransition, type Kind, type Transition } from './api';

// 'someKey' -> 'some key'
const label = (k: string) => k.replace(/([A-Z])/g, ' $1').toLowerCase();

// Stage controls (ST03, ST04, ST07 and their way back). The API says what is allowed; this only draws it.
// Mounted by the stage workspace (12-u18). The server lists nothing for anyone but the steward.
export function StageControls({ stageId }: { stageId: string }) {
  const t = useT();
  const qc = useQueryClient();
  const { status } = useSession();
  const q = useStage(stageId);
  const [open, setOpen] = useState<Kind | null>(null);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState<PostFailure | null>(null);
  const s = q.data;
  if (status !== 'member' || !s) return null;

  const items = s.allowedStageTransitions.flatMap((tr: Transition) => {
    const kind = kindOf(tr, s.state);
    return kind ? [{ kind, tr }] : [];
  });

  const run = async (kind: Kind, tr: Transition) => {
    const lacking = tr.requires.filter((k) => !vals[k]?.trim());
    setMissing(lacking);
    if (lacking.length) return;
    setBusy(true);
    setFail(null);
    const f = await postTransition(kind, stageId, vals);
    setBusy(false);
    if (f) return setFail(f);
    setOpen(null);
    setVals({});
    void qc.invalidateQueries({ queryKey: ['stages'] });
    void qc.invalidateQueries({ queryKey: ['stage-decision', stageId] });
  };

  const message = (): string | undefined => {
    if (!fail || fail.code === 'validation_failed' || fail.code === 'needs_revision')
      return undefined;
    if (fail.offline) return t('common.offline.banner');
    if (fail.code === 'problem_not_active') return t('stage.control.problemNotActive');
    if (fail.status === 403) return t('stage.control.notAllowed');
    if (fail.status === 409) return t('stage.control.conflict');
    return t('common.error.generic');
  };
  const fe = (k: string) => fail?.fieldErrors?.[k] ?? fail?.fieldErrors?.[`/${k}`];

  return (
    <Box className="gap-3" testID="stage-controls">
      <CivicHeading level={2}>{t('stage.control.title')}</CivicHeading>
      <CivicText variant="bodyStrong" testID="stage-chip">
        {s.state === 'resolving' ? t('stage.control.checking') : s.chip}
      </CivicText>
      {s.state === 'resolving' ? (
        <CivicText muted>{t('stage.control.checking.why')}</CivicText>
      ) : null}
      {message() ? <StatusMessage state="error" message={message() as string} /> : null}
      {items.map(({ kind, tr }) => (
        <Box key={kind} className="gap-2">
          <CivicText muted>{t(`stage.control.${kind}.why`)}</CivicText>
          {open === kind ? (
            <>
              {tr.requires.map((k) => (
                <TextField
                  key={k}
                  label={label(k)}
                  accessibilityLabel={label(k)}
                  hint={isList(k) ? t('stage.control.perLine') : undefined}
                  multiline
                  required
                  value={vals[k] ?? ''}
                  error={missing.includes(k) ? t('common.validation.required') : fe(k)}
                  onChangeText={(x) => setVals({ ...vals, [k]: x })}
                />
              ))}
              <CivicButton
                label={t(`stage.control.${kind}`)}
                accessibilityLabel={t(`stage.control.${kind}`)}
                disabled={busy}
                onPress={() => void run(kind, tr)}
              />
              <CivicButton
                variant="secondary"
                label={t('stage.control.cancel')}
                accessibilityLabel={t('stage.control.cancel')}
                onPress={() => setOpen(null)}
              />
            </>
          ) : (
            <CivicButton
              label={t(`stage.control.${kind}`)}
              accessibilityLabel={t(`stage.control.${kind}`)}
              disabled={busy}
              onPress={() => {
                setFail(null);
                if (tr.requires.length) setOpen(kind);
                else void run(kind, tr);
              }}
            />
          )}
        </Box>
      ))}
    </Box>
  );
}
