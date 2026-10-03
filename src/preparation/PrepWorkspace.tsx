import { router } from 'expo-router';
import { useState } from 'react';

import { ApiError } from '../api/errors';
import { Box, CivicButton, CivicHeading, CivicText, StatusMessage } from '../components/civic';
import { PreviewScreen } from '../features/submit/PreviewScreen';
import { useT, type MessageId } from '../i18n';
import { SourcesPart } from './SourcesPart';
import { usePrepActions, usePreparation, useServerDraft, type PrepPart } from './usePreparation';

export type PrepLinks = { facts: string; criteria: string; stages: string; review?: string };
type Props = { id: string; links: PrepLinks; sourcesKey: string };

const EDITABLE = ['draft', 'needs_revision', 'in_review'];
const CHIP: Record<string, MessageId> = {
  draft: 'lifecycle.chip.draft',
  needs_revision: 'lifecycle.chip.needsRevision',
  in_review: 'lifecycle.chip.inReview',
};

/* WF-PREP-1 at /me/problems/{id}
 +------------------------------------+
 | Prepare your problem  [Draft]      |
 | Private. Only you can see this...  |
 | 2 of 4 parts ready                 |
 | 1 Facts and causes   Ready         |
 |   [ Open ]                         |
 | 2 Trusted sources    Not finished  |
 |   links + trust hint, source form  |
 | 3 When it is solved  Ready [ Edit ]|
 | 4 Stages (optional)  Ready [ Edit ]|
 | Before you send, finish: ...       |
 | [Check my draft]                   |
 | [Send to volunteer review]         |
 +------------------------------------+ */
export function PrepWorkspace({ id, links, sourcesKey }: Props) {
  const t = useT();
  const prep = usePreparation(id);
  const draft = useServerDraft(id);
  const actions = usePrepActions(id, prep.data?.version);
  const [confirm, setConfirm] = useState(false);

  if (!prep.data) {
    const e = prep.error instanceof ApiError ? prep.error : undefined;
    if (!e) return <StatusMessage state="loading" message={t('common.loading')} />;
    const msg: MessageId =
      e.kind === 'offline'
        ? 'common.offline.banner'
        : e.kind === 'not_permitted' || e.kind === 'not_found'
          ? 'prep.notPermitted'
          : e.kind === 'rate_limited'
            ? 'prep.rateLimited'
            : 'detail.error';
    return (
      <StatusMessage
        state="error"
        message={t(msg)}
        action={
          e.kind === 'not_permitted' || e.kind === 'not_found'
            ? undefined
            : {
                label: t('common.error.retry'),
                accessibilityLabel: t('common.error.retry'),
                onPress: () => void prep.refetch(),
              }
        }
      />
    );
  }

  const p = prep.data;
  if (!EDITABLE.includes(p.state))
    return <StatusMessage state="error" message={t('prep.notPermitted')} />;
  const inReview = p.state === 'in_review';
  const parts = [
    { part: p.facts, name: t('prep.part.facts'), edit: links.facts, editLabel: t('prep.open') },
    { part: p.sources, name: t('prep.part.sources') },
    { part: p.criteria, name: t('prep.part.criteria'), edit: links.criteria },
    { part: p.stages, name: t('prep.part.stages'), edit: links.stages },
  ];
  const done = parts.filter((x) => x.part.status === 'ready').length;
  // The stage plan is optional: only the first three gate the send.
  const missing = parts
    .slice(0, 3)
    .filter((x) => x.part.status !== 'ready')
    .map((x) => x.name);
  const sendErr = actions.send.error instanceof ApiError ? actions.send.error : undefined;

  if (confirm && !inReview)
    return (
      <Box className="gap-4" testID="prep-confirm">
        <PreviewScreen id={id} />
        <CivicText>{t('prep.sendReview.masked')}</CivicText>
        {sendErr ? (
          <StatusMessage
            state="error"
            message={
              sendErr.kind === 'validation' ? t('prep.send.refused') : t('common.error.generic')
            }
          />
        ) : null}
        <CivicButton
          label={t('prep.send.confirm')}
          accessibilityLabel={t('prep.send.confirm')}
          disabled={actions.send.isPending}
          onPress={() => actions.send.mutate(undefined, { onSuccess: () => setConfirm(false) })}
        />
        <CivicButton
          variant="secondary"
          label={t('common.back')}
          accessibilityLabel={t('common.back')}
          onPress={() => setConfirm(false)}
        />
      </Box>
    );

  const flagsOf = (part: PrepPart, name: string) =>
    part.flags
      .filter((f) => !f.kept)
      .map((f) => (
        <Box key={f.id} className="gap-1" testID="prep-flag">
          <CivicText>
            {t(f.severity === 'hard' ? 'submit.flags.hard' : 'submit.flags.review', { part: name })}
          </CivicText>
          {f.severity === 'review' ? (
            <CivicButton
              variant="secondary"
              label={t('submit.flags.keep')}
              accessibilityLabel={`${t('submit.flags.keep')}: ${name}`}
              onPress={() => actions.keep.mutate([f.id])}
            />
          ) : null}
        </Box>
      ));

  return (
    <Box className="gap-4" testID="prep-workspace">
      <CivicHeading level={1}>{t('prep.title')}</CivicHeading>
      <CivicText variant="bodyStrong" testID="prep-chip">
        {t(CHIP[p.state] ?? 'lifecycle.chip.draft')}
      </CivicText>
      <CivicText variant="caption" muted>
        {t('prep.private')}
      </CivicText>
      {inReview ? (
        <Box className="gap-1" testID="prep-in-review">
          <CivicText>{t('prep.sendReview.note')}</CivicText>
          <CivicText>{t('prep.review.notLive')}</CivicText>
          {links.review ? (
            <CivicButton
              variant="secondary"
              label={t('vreview.resolve.open')}
              accessibilityLabel={t('vreview.resolve.open')}
              onPress={() => router.push(links.review as never)}
            />
          ) : null}
        </Box>
      ) : null}
      <CivicText testID="prep-progress">
        {t('prep.progress', { done, total: parts.length })}
      </CivicText>
      {parts.map((x, i) => (
        <Box key={x.name} className="gap-2" testID={`prep-part-${i}`}>
          <CivicHeading level={2}>{`${i + 1}. ${x.name}`}</CivicHeading>
          <CivicText variant="bodyStrong">
            {t(x.part.status === 'ready' ? 'prep.part.ready' : 'prep.part.todo')}
          </CivicText>
          {x.part.reason === 'needs_evidence' ? (
            <CivicText variant="caption">{t('prep.needsEvidence')}</CivicText>
          ) : null}
          {Object.entries(x.part.fieldErrors).map(([k, m]) => (
            <CivicText key={k} variant="caption">
              {m}
            </CivicText>
          ))}
          {flagsOf(x.part, x.name)}
          {i === 1 ? (
            <SourcesPart
              fieldKey={sourcesKey}
              schemaVersion={draft.data?.schemaVersion ?? null}
              content={draft.data?.content ?? null}
              actions={actions}
            />
          ) : (
            <CivicButton
              variant="secondary"
              label={x.editLabel ?? t('prep.edit')}
              accessibilityLabel={`${x.editLabel ?? t('prep.edit')}: ${x.name}`}
              onPress={() => router.push(x.edit as never)}
            />
          )}
        </Box>
      ))}
      {!inReview && missing.length ? (
        <CivicText testID="prep-missing">
          {t('prep.sendReview.missing', { parts: missing.join(', ') })}
        </CivicText>
      ) : null}
      <CivicText variant="caption">{t('prep.sendReview.masked')}</CivicText>
      <CivicButton
        variant="secondary"
        label={t('prep.check')}
        accessibilityLabel={t('prep.check')}
        disabled={actions.check.isPending}
        onPress={() => actions.check.mutate()}
      />
      {inReview ? null : (
        <CivicButton
          label={t('prep.sendReview')}
          accessibilityLabel={t('prep.sendReview')}
          disabled={missing.length > 0}
          onPress={() => setConfirm(true)}
        />
      )}
    </Box>
  );
}
