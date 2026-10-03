import { Box, CivicText } from '../components/civic';
import { useT } from '../i18n';

export const timeOf = (iso: string | Date) =>
  new Date(iso).toLocaleTimeString([], { timeStyle: 'short' });

type Props = { limit: number; remaining: number; resetsAt: string | null; until?: Date | null };

// Plain paragraphs, never colour alone. One polite region: speaks when the numbers change, never ticks.
export function ReplyAllowance({ limit, remaining, resetsAt, until }: Props) {
  const t = useT();
  const left = remaining; // shorthand below: the ICU name is `left`
  const at = until ?? (resetsAt ? new Date(resetsAt) : null);
  return (
    <Box className="gap-1" testID="reply-allowance" accessibilityLiveRegion="polite">
      <CivicText variant="bodyStrong" accessibilityLabel={t('reply.a11y.left', { left, limit })}>
        {t('reply.left', { left, limit })}
      </CivicText>
      {remaining <= 1 && at ? <CivicText>{t('reply.next', { time: timeOf(at) })}</CivicText> : null}
      <CivicText variant="caption">{t('reply.count', { limit })}</CivicText>
    </Box>
  );
}
