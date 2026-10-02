import { router } from 'expo-router';
import { useState } from 'react';

import { ApiError } from '../api/errors';
import {
  CivicButton,
  CivicHeading,
  CivicText,
  ChoiceField,
  Row,
  StatusMessage,
  TextField,
} from '../components/civic';
import { useT } from '../i18n';
import { ProblemCard } from './ProblemCard';
import { useJurisdictions, useProblems, type Filters } from './useProblems';

type Props = { filters: Filters; onFilters: (f: Filters) => void };

// WF-LIST-1 and WF-LIST-2. Filters live in the caller (the URL); the search text applies on press.
export function ProblemList({ filters, onFilters }: Props) {
  const t = useT();
  const [text, setText] = useState(filters.q ?? '');
  const list = useProblems(filters);
  const places = useJurisdictions();
  const set = (patch: Filters) => onFilters({ ...filters, ...patch });

  const items = list.data?.pages.flatMap((pg) => pg.items) ?? [];
  const filtered = !!(filters.q || filters.state || filters.jurisdictionId);
  // The disclosure is only shown while the response itself says engagement is unused.
  const crit = list.data?.pages[0]?.criteria;
  const ordered =
    !crit || (crit.order === 'published_at_desc' && !(crit.usesEngagementSignals as boolean));
  const offline = list.error instanceof ApiError && list.error.kind === 'offline';
  // Stage options come from the labels the API sent, never a hardcoded list.
  const stages = new Map(items.map((i) => [i.state, i.label]));
  if (filters.state && !stages.has(filters.state)) stages.set(filters.state, filters.state);
  const retry = {
    label: t('common.error.retry'),
    accessibilityLabel: t('common.error.retry'),
    onPress: () => void (list.data ? list.fetchNextPage() : list.refetch()),
  };

  return (
    <>
      <CivicHeading level={1}>{t('list.title')}</CivicHeading>
      {ordered ? <CivicText muted>{t('list.order')}</CivicText> : null}

      <ChoiceField
        label={t('list.place')}
        value={filters.jurisdictionId ?? ''}
        onChange={(v) => set({ jurisdictionId: v || undefined })}
        options={[
          { value: '', label: t('list.place.all') },
          ...(places.data ?? []).map((j) => ({ value: j.id, label: j.name })),
        ]}
      />
      <ChoiceField
        label={t('list.stage')}
        value={filters.state ?? ''}
        onChange={(v) => set({ state: v || undefined })}
        options={[
          { value: '', label: t('list.stage.all') },
          ...[...stages].map(([value, label]) => ({ value, label })),
        ]}
      />
      <TextField
        value={text}
        onChangeText={setText}
        accessibilityLabel={t('list.search')}
        placeholder={t('list.search')}
      />
      <Row>
        <CivicButton
          variant="secondary"
          label={t('list.search.go')}
          accessibilityLabel={t('list.search.go')}
          onPress={() => set({ q: text.trim() || undefined })}
        />
        {filtered ? (
          <CivicButton
            variant="secondary"
            label={t('list.clearFilters')}
            accessibilityLabel={t('list.clearFilters')}
            onPress={() => {
              setText('');
              onFilters({});
            }}
          />
        ) : null}
      </Row>

      {offline && items.length ? (
        <StatusMessage state="error" message={t('common.offline.banner')} action={retry} />
      ) : list.isError ? (
        <StatusMessage state="error" message={t('list.error')} action={retry} />
      ) : null}
      {list.isPending ? <StatusMessage state="loading" message={t('list.loading')} /> : null}

      {list.data && items.length === 0 ? (
        <StatusMessage
          state="empty"
          title={t('list.empty.title')}
          message={filtered ? t('list.empty.filtered') : t('list.empty.body')}
        />
      ) : null}

      {items.map((p) => (
        <ProblemCard key={p.id} p={p} />
      ))}

      {list.hasNextPage ? (
        <CivicButton
          variant="secondary"
          label={list.isFetchingNextPage ? t('list.more.loading') : t('list.more')}
          accessibilityLabel={t('list.more')}
          onPress={() => void list.fetchNextPage()}
        />
      ) : null}
      <CivicButton
        label={t('list.report')}
        accessibilityLabel={t('list.report')}
        onPress={() => router.push('/report' as never)}
      />
    </>
  );
}
