import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

import { ApiError } from '../../api/errors';
import {
  Box,
  ChoiceField,
  CivicButton,
  CivicHeading,
  CivicText,
  Row,
  StatusMessage,
} from '../../components/civic';
import type { Schema, Value } from '../../forms/schema/model';
import { useContentSchema } from '../../forms/schema/useContentSchema';
import { useT, type MessageId } from '../../i18n';
import { StageMap } from '../../stages/StageMap';
import { usePreparation, useServerDraft } from '../usePreparation';
import {
  criteriaSchema,
  CRITERIA_KEY,
  fromTemplate,
  issueLines,
  labelOf,
  moveStage,
  namesOf,
  newStage,
  parallelGroups,
  removeStage,
  toMap,
  type PlanNode,
} from './model';
import { StagePanel } from './StagePanel';
import { useSavePlan, usePlanCheck, useTemplates } from './usePlan';

type Props = { id: string; fieldKey: string; onBack: () => void };
const EDITABLE = ['draft', 'needs_revision', 'in_review'];

/*
 WF-PREP-3 at /me/problems/{id}/stages
 +------------------------------------+
 | Stage plan (optional)              |
 | (o) Start from classic-5  ( ) One stage  ( ) Start blank |
 | [Graph] [List]                     |
 | [Facts]-->[Solutions]-->[Choose]   |   graph (display only)
 | Facts and Funding run at the same time. |
 | 1 Facts      Starts after: nothing [Edit] [Up] [Down] |
 |   (panel: name, starts after boxes, method, criteria)  |
 | ! These stages wait for each other: A, B. Remove one link. |
 | [Add a stage]  [Save plan]  [Back] |
 +------------------------------------+ */
export function PlanScreen({ id, fieldKey, onBack }: Props) {
  const t = useT();
  const { width } = useWindowDimensions();
  const prep = usePreparation(id);
  const draft = useServerDraft(id);
  const schemaQ = useContentSchema('problem', {
    version: draft.data?.schemaVersion ?? undefined,
    enabled: !!draft.data,
  });
  const [edit, setEdit] = useState<PlanNode[] | null>(null);
  const [blank, setBlank] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [pick, setPick] = useState<'graph' | 'list' | null>(null);
  const [saved, setSaved] = useState(false);
  const served = (draft.data?.content?.[fieldKey] as PlanNode[] | undefined) ?? [];
  const nodes = edit ?? served;
  const state = prep.data?.state;
  const readOnly = state === 'in_review';
  const started = nodes.length > 0 || blank;
  const templates = useTemplates(!!state && !readOnly && !started);
  const { check, error: checkErr } = usePlanCheck(id, nodes, !!state && !readOnly);
  const save = useSavePlan(id, prep.data?.version);

  const loadErr = [prep, draft, schemaQ].map((q) => q.error).find((e) => e instanceof ApiError);
  if (loadErr instanceof ApiError || (state && !EDITABLE.includes(state))) {
    const kind = loadErr instanceof ApiError ? loadErr.kind : 'not_permitted';
    const msg: MessageId =
      kind === 'offline'
        ? 'common.offline.banner'
        : kind === 'not_permitted' || kind === 'not_found'
          ? 'prep.notPermitted'
          : kind === 'rate_limited'
            ? 'prep.rateLimited'
            : 'detail.error';
    const retry = kind === 'not_permitted' || kind === 'not_found' ? undefined : kind;
    return (
      <StatusMessage
        state="error"
        message={t(msg)}
        action={
          retry
            ? {
                label: t('common.error.retry'),
                accessibilityLabel: t('common.error.retry'),
                onPress: () =>
                  void Promise.all([prep.refetch(), draft.refetch(), schemaQ.refetch()]),
              }
            : undefined
        }
      />
    );
  }
  if (!prep.data || !draft.data || !schemaQ.data)
    return <StatusMessage state="loading" message={t('common.loading')} />;

  const change = (next: PlanNode[]) => {
    setSaved(false);
    setEdit(next);
  };
  const patch = (name: string, p: Partial<PlanNode>) =>
    change(nodes.map((n) => (n.name === name ? { ...n, ...p } : n)));
  const start = (tplId: 'classic-5' | 'one-stage' | 'blank') => {
    if (tplId === 'blank') return setBlank(true);
    const tpl = templates.data?.items.find((x) => x.id === tplId);
    if (tpl) change(fromTemplate(tpl));
  };
  const lines = check ? issueLines(check, nodes, t) : [];
  const fieldMsgs = check ? Object.values(check.fieldErrors) : [];
  const clean = !!check && check.ok && lines.length === 0;
  const doSave = async (list: PlanNode[]) => {
    setSaved(false);
    try {
      await save.mutateAsync(list);
      setSaved(true);
    } catch {
      // the error is shown from save.error
    }
  };
  const saveErr = save.error instanceof ApiError ? save.error : undefined;
  const view = pick ?? (width < 640 ? 'list' : 'graph');
  const groups = parallelGroups(nodes);
  const cSchema = criteriaSchema(schemaQ.data.schema as Schema, fieldKey);
  const sErr = (e?: ApiError): MessageId =>
    e?.kind === 'offline'
      ? 'plan.offline'
      : e?.status === 409
        ? 'plan.locked'
        : 'common.error.generic';

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
    <Box className="gap-4" testID="plan-screen">
      <CivicHeading level={1}>{t('plan.title')}</CivicHeading>
      <CivicText>{t('plan.optional')}</CivicText>
      {readOnly ? <CivicText testID="plan-readonly">{t('plan.readOnly')}</CivicText> : null}

      {!started && !readOnly ? (
        <Box className="gap-2" testID="plan-start">
          <ChoiceField
            label={t('plan.start.title')}
            hint={t('plan.template.help')}
            value={undefined}
            onChange={(v) => start(v as 'classic-5' | 'one-stage' | 'blank')}
            options={[
              { value: 'classic-5', label: t('plan.start.template') },
              { value: 'one-stage', label: t('plan.start.oneStage') },
              { value: 'blank', label: t('plan.start.blank') },
            ]}
          />
          {templates.isError ? <CivicText>{t('common.error.generic')}</CivicText> : null}
        </Box>
      ) : null}

      {started ? (
        <>
          <CivicHeading level={2}>{t('plan.graph.title')}</CivicHeading>
          <CivicText muted>{t('plan.graph.help')}</CivicText>
          <Row>
            {toggle('graph')}
            {toggle('list')}
          </Row>
          {nodes.length > 1 ? (
            <Box className="gap-1" testID="plan-shape">
              {groups.length ? (
                groups.map((g) => (
                  <CivicText key={g.join()}>
                    {t('plan.graph.parallelNames', { names: namesOf(nodes, g) })}
                  </CivicText>
                ))
              ) : (
                <CivicText>{t('plan.graph.serial')}</CivicText>
              )}
            </Box>
          ) : null}
          {view === 'graph' && nodes.length ? (
            <StageMap map={toMap(nodes, id, (n, total) => t('plan.stage.of', { n, total }))} />
          ) : null}
          <Box
            className="gap-3"
            role="list"
            accessibilityLabel={t('plan.list.title', { n: nodes.length })}
          >
            {nodes.map((n, i) => (
              <Box
                key={n.name}
                role="listitem"
                className="gap-2 p-3 rounded-md border border-can-border bg-can-surface"
                testID={`plan-stage-${n.name}`}
              >
                <CivicText variant="bodyStrong">{`${i + 1} ${labelOf(n)}`}</CivicText>
                <CivicText muted>
                  {(n.depends_on ?? []).length
                    ? t('stagemap.after', { names: namesOf(nodes, n.depends_on ?? []) })
                    : t('stagemap.afterNothing')}
                </CivicText>
                {readOnly ? (
                  <CivicText>{n.goal}</CivicText>
                ) : (
                  <Row>
                    <CivicButton
                      variant="secondary"
                      label={sel === n.name ? t('plan.stage.close') : t('prep.edit')}
                      accessibilityLabel={`${sel === n.name ? t('plan.stage.close') : t('prep.edit')}: ${labelOf(n)}`}
                      onPress={() => setSel(sel === n.name ? null : n.name)}
                    />
                    <CivicButton
                      variant="secondary"
                      label={t('plan.stage.moveUp')}
                      accessibilityLabel={`${t('plan.stage.moveUp')}: ${labelOf(n)}`}
                      disabled={i === 0}
                      onPress={() => change(moveStage(nodes, i, -1))}
                    />
                    <CivicButton
                      variant="secondary"
                      label={t('plan.stage.moveDown')}
                      accessibilityLabel={`${t('plan.stage.moveDown')}: ${labelOf(n)}`}
                      disabled={i === nodes.length - 1}
                      onPress={() => change(moveStage(nodes, i, 1))}
                    />
                  </Row>
                )}
                {!readOnly && sel === n.name ? (
                  <StagePanel
                    node={n}
                    all={nodes}
                    schema={cSchema}
                    messages={schemaQ.data.messages}
                    busy={save.isPending}
                    onChange={(p) => patch(n.name, p)}
                    onRemove={() => {
                      setSel(null);
                      change(removeStage(nodes, n.name));
                    }}
                    onSaveCriteria={(items: Value[]) => {
                      const next = nodes.map((x) =>
                        x.name === n.name ? { ...x, [CRITERIA_KEY]: items } : x,
                      );
                      change(next);
                    }}
                  />
                ) : null}
              </Box>
            ))}
          </Box>
        </>
      ) : null}

      {lines.length || fieldMsgs.length ? (
        <Box className="gap-1" testID="plan-issues">
          {[...lines, ...fieldMsgs].map((m) => (
            <CivicText key={m} variant="bodyStrong">{`⚠ ${m}`}</CivicText>
          ))}
        </Box>
      ) : null}
      {checkErr instanceof ApiError && checkErr.kind === 'offline' ? (
        <CivicText testID="plan-offline">{t('plan.offline')}</CivicText>
      ) : null}
      {saveErr ? <CivicText testID="plan-error">{t(sErr(saveErr))}</CivicText> : null}
      {saved ? <CivicText testID="plan-saved">{t('plan.saved')}</CivicText> : null}

      {!readOnly && started ? (
        <Row>
          <CivicButton
            variant="secondary"
            label={t('plan.stage.add')}
            accessibilityLabel={t('plan.stage.add')}
            onPress={() => {
              const s = newStage(nodes, t('plan.stage.newName'));
              change([...nodes, s]);
              setSel(s.name);
            }}
          />
          <CivicButton
            label={t('plan.save')}
            accessibilityLabel={t('plan.save')}
            disabled={!clean || save.isPending}
            onPress={() => void doSave(nodes)}
          />
        </Row>
      ) : null}
      <CivicButton
        variant="secondary"
        label={t('common.back')}
        accessibilityLabel={t('common.back')}
        onPress={onBack}
      />
    </Box>
  );
}
