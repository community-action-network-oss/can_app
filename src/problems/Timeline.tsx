import { CivicButton, CivicHeading, CivicText, Box } from '../components/civic';
import { messages, useT, type MessageId } from '../i18n';
import { useProblemEvents } from './useProblem';

// Public history only. Labels are plain words per event type; payloads never reach the client.
export function Timeline({ id }: { id: string }) {
  const t = useT();
  const q = useProblemEvents(id, true);
  const items = q.data?.pages.flatMap((pg) => pg.items) ?? [];
  const date = (s: string) => t('detail.event.on', { date: Date.parse(s) });
  return (
    <Box className="gap-2">
      <CivicHeading level={2}>{t('detail.tab.history')}</CivicHeading>
      {q.isPending ? <CivicText muted>{t('detail.history.loading')}</CivicText> : null}
      {q.isError && !items.length ? <CivicText>{t('detail.history.error')}</CivicText> : null}
      {q.data && !items.length ? <CivicText muted>{t('detail.history.empty')}</CivicText> : null}
      {items.map((e) => {
        const key = `detail.event.${e.type}` as MessageId;
        return (
          <Box key={e.id} className="gap-1 p-3 rounded-md border border-can-border bg-can-surface">
            <CivicText variant="bodyStrong">
              {key in messages ? t(key) : t('detail.event.other')}
            </CivicText>
            <CivicText variant="caption" muted>
              {[date(e.occurredAt), e.actor].filter(Boolean).join(', ')}
            </CivicText>
            {e.reason ? <CivicText>{e.reason}</CivicText> : null}
          </Box>
        );
      })}
      {q.hasNextPage ? (
        <CivicButton
          variant="secondary"
          label={q.isFetchingNextPage ? t('list.more.loading') : t('list.more')}
          accessibilityLabel={t('list.more')}
          onPress={() => void q.fetchNextPage()}
        />
      ) : null}
    </Box>
  );
}
