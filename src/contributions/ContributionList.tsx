import type { ReactNode } from 'react';
import { Linking } from 'react-native';

import type { components } from '../api/schema';
import { Box, CivicButton, CivicHeading, CivicText, StatusMessage } from '../components/civic';
import { useT, type MessageId } from '../i18n';
import { useContributions } from './api';

type Item = components['schemas']['ContributionDto'];

type Props = {
  problemId: string;
  stageId?: string;
  /** Only contributions to the whole problem (the Overview). */
  problemLevel?: boolean;
  /** Empty until the Guest badge (WF-GUEST-1) and the Impacted only filter (WF-FILTER-1) land. */
  badgeSlot?: (item: Item) => ReactNode;
  filterSlot?: ReactNode;
};

// Grouped by type in first-seen order, items in API order. No counts, likes or sorting controls.
const group = (items: Item[]) => {
  const m = new Map<string, Item[]>();
  for (const i of items) m.set(i.type, [...(m.get(i.type) ?? []), i]);
  return [...m];
};

export function ContributionList({
  problemId,
  stageId,
  problemLevel,
  badgeSlot,
  filterSlot,
}: Props) {
  const t = useT();
  const q = useContributions(problemId, { stageId, problemLevel });
  if (q.isPending) return <StatusMessage state="loading" message={t('contrib.list.loading')} />;
  if (!q.data)
    return (
      <StatusMessage
        state="error"
        message={t('contrib.list.error')}
        action={{
          label: t('common.error.retry'),
          accessibilityLabel: t('common.error.retry'),
          onPress: () => void q.refetch(),
        }}
      />
    );
  const items = q.data.items ?? [];
  return (
    <Box className="gap-3" testID="contribution-list">
      {filterSlot}
      {items.length === 0 ? <CivicText muted>{t('contrib.list.empty')}</CivicText> : null}
      {group(items).map(([type, list]) => {
        const nameId = `contrib.type.${type}` as MessageId;
        return (
          <Box key={type} className="gap-2" testID={`contrib-group-${type}`}>
            <CivicHeading level={3}>{t(nameId)}</CivicHeading>
            {list.map((c) => (
              <Row key={c.id} c={c} badge={badgeSlot?.(c)} />
            ))}
          </Box>
        );
      })}
    </Box>
  );
}

function Row({ c, badge }: { c: Item; badge?: ReactNode }) {
  const t = useT();
  if (c.status === 'tombstoned' || c.tombstonedAt)
    return (
      <Box className="gap-1 p-3 rounded-md border border-can-border" testID="contrib-tombstone">
        <CivicText muted>
          {t('contrib.list.tomb', { date: Date.parse(c.tombstonedAt ?? c.createdAt) })}
        </CivicText>
      </Box>
    );
  // `claim` is the one answer every contribution type shares (contribution.common); per-type fields belong to the schema.
  const claim = typeof c.body?.claim === 'string' ? c.body.claim : null;
  return (
    <Box
      className="gap-1 p-3 rounded-md border border-can-border bg-can-surface"
      testID="contrib-item"
    >
      <CivicText variant="caption" muted>
        {t('contrib.list.by', { handle: c.authorHandle, date: Date.parse(c.createdAt) })}
      </CivicText>
      {badge}
      {c.status === 'pending_review' ? (
        <CivicText variant="bodyStrong">{t('contrib.list.awaiting')}</CivicText>
      ) : null}
      {c.status === 'hidden' ? (
        <CivicText variant="bodyStrong">{t('contrib.list.hidden')}</CivicText>
      ) : null}
      {c.forLaterStage ? (
        <CivicText variant="bodyStrong">{t('contrib.list.later')}</CivicText>
      ) : null}
      {claim ? <CivicText>{claim}</CivicText> : null}
      {c.evidenceRefs.map((e) => (
        <CivicButton
          key={e.url}
          variant="secondary"
          label={t('contrib.list.link', { url: e.url })}
          accessibilityLabel={t('contrib.list.link', { url: e.url })}
          onPress={() => void Linking.openURL(e.url)}
        />
      ))}
    </Box>
  );
}
