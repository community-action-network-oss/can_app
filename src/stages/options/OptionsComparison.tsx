import { useState } from 'react';
import { useWindowDimensions } from 'react-native';

import type { components } from '../../api/schema';
import { Box, CivicButton, CivicHeading, CivicText } from '../../components/civic';
import { SchemaForm } from '../../forms/schema/SchemaForm';
import type { Schema, Value } from '../../forms/schema/model';
import { useContentSchema } from '../../forms/schema/useContentSchema';
import { useT, type MessageId } from '../../i18n';

export type OptionsData = components['schemas']['StageOptionsDto'];
type Item = OptionsData['items'][number];

const noop = () => undefined;

// Content is read through the content schema in read-only mode, so no field is named here (D-58).
function ReadContent({ type, content }: { type: string; content: Record<string, unknown> }) {
  const t = useT();
  const q = useContentSchema(type);
  if (q.isPending) return <CivicText muted>{t('common.loading')}</CivicText>;
  if (!q.data) return <CivicText muted>{t('option.read.error')}</CivicText>;
  return (
    <SchemaForm
      readOnly
      schema={q.data.schema as Schema}
      messages={(q.data.messages ?? {}) as Record<string, unknown>}
      value={content as Value}
      onChange={noop}
      onSubmit={noop}
    />
  );
}

function Toggle({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <CivicButton
        variant="secondary"
        label={open ? t('option.read.hide') : label}
        accessibilityLabel={`${open ? t('option.read.hide') : label}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
      />
      {open ? children : null}
    </>
  );
}

function Card({ item, n, problemId, stageId, canAdd, goImprove }: CardProps) {
  const t = useT();
  const title = t('option.n', { n });
  return (
    <Box
      className="gap-2 p-3 rounded-md border-2 border-can-border"
      role="article"
      aria-label={title}
    >
      <CivicHeading level={3}>{title}</CivicHeading>
      <CivicText muted>{t('option.by', { handle: item.authorHandle })}</CivicText>
      {item.pendingReview ? (
        <CivicText variant="bodyStrong">{t('option.awaiting')}</CivicText>
      ) : null}
      {item.forLaterStage ? <CivicText muted>{t('option.later')}</CivicText> : null}
      {item.content ? (
        <Toggle label={t('option.read', { n })}>
          <ReadContent type="stage_option" content={item.content} />
        </Toggle>
      ) : (
        <CivicText>{t('option.withdrawn')}</CivicText>
      )}
      {item.improvements.map((i) => (
        <Box
          key={i.id}
          className="gap-1 ps-3 border-s-2 border-can-border"
          testID={`improvement-${i.id}`}
        >
          <CivicText variant="bodyStrong">
            {t('option.improvement.by', { handle: i.authorHandle })}
          </CivicText>
          {i.pendingReview ? <CivicText>{t('option.awaiting')}</CivicText> : null}
          <Toggle label={t('option.improvement.read')}>
            <ReadContent type="contribution.proposal_improvement" content={i.content} />
          </Toggle>
        </Box>
      ))}
      {canAdd && item.content ? (
        <CivicButton
          variant="secondary"
          label={t('option.improve')}
          accessibilityLabel={`${t('option.improve')}: ${title}`}
          onPress={() => goImprove(problemId, stageId, item.id)}
        />
      ) : null}
    </Box>
  );
}
type CardProps = {
  item: Item;
  n: number;
  problemId: string;
  stageId: string;
  canAdd: boolean;
  goImprove: (problemId: string, stageId: string, optionId: string) => void;
};

const cell = 'flex-1 p-2 border border-can-border';

// WF-STAGE-1 Options. Server order, no scores, no ranking: facts side by side.
export function OptionsComparison(p: {
  data: OptionsData;
  problemId: string;
  stageId: string;
  canAdd: boolean;
  goImprove: (problemId: string, stageId: string, optionId: string) => void;
}) {
  const t = useT();
  const { width } = useWindowDimensions();
  const { items, comparison } = p.data;
  if (!items.length) return <CivicText>{t('stage.option.empty')}</CivicText>;
  const number = (id: string) => items.findIndex((i) => i.id === id) + 1;
  const wide = width >= 640 && !!comparison;
  return (
    <Box className="gap-3" testID="options-comparison">
      <CivicText muted>{t('option.order')}</CivicText>
      {comparison && wide ? (
        <Box role="table" aria-label={t('option.table')} testID="options-table">
          <Box role="row" className="flex-row">
            <Box role="columnheader" className={cell}>
              <CivicText variant="bodyStrong">{t('option.table.field')}</CivicText>
            </Box>
            {comparison.rows[0]?.cells.map((c) => (
              <Box role="columnheader" className={cell} key={c.optionId}>
                <CivicText variant="bodyStrong">
                  {t('option.n', { n: number(c.optionId) })}
                </CivicText>
              </Box>
            ))}
          </Box>
          {comparison.rows.map((r) => (
            <Box role="row" className="flex-row" key={r.field}>
              <Box role="rowheader" className={cell}>
                <CivicText variant="bodyStrong">
                  {t(`option.row.${r.field}` as MessageId)}
                </CivicText>
              </Box>
              {r.cells.map((c) => (
                <Box role="cell" className={cell} key={c.optionId}>
                  <CivicText>{c.value ?? t('option.row.none')}</CivicText>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      ) : null}
      {comparison && !wide
        ? comparison.rows[0]?.cells.map((c) => (
            <Box key={c.optionId} className="gap-1" testID={`stack-${c.optionId}`}>
              <CivicHeading level={3}>{t('option.n', { n: number(c.optionId) })}</CivicHeading>
              {comparison.rows.map((r) => (
                <CivicText key={r.field}>
                  {`${t(`option.row.${r.field}` as MessageId)}: ${r.cells.find((x) => x.optionId === c.optionId)?.value ?? t('option.row.none')}`}
                </CivicText>
              ))}
            </Box>
          ))
        : null}
      {!comparison ? <CivicText muted>{t('option.compare.wait')}</CivicText> : null}
      {items.map((item) => (
        <Card key={item.id} item={item} n={number(item.id)} {...p} />
      ))}
    </Box>
  );
}
