import { Box, CivicText } from '../components/civic';
import type { DraftStatus } from './useDraft';

type Props = {
  status: DraftStatus;
  savedAt: number | null;
  /** Copy comes from the caller's useT(): saved(time) = "Saved on this device at {time}", failed = "This device could not save your draft". */
  labels: { saved: (time: string) => string; failed: string };
};

/** Polite live region. While typing ("saving") it keeps its last text, so it speaks only when a save settles. */
export function SavedIndicator({ status, savedAt, labels }: Props) {
  const text =
    status === 'unsynced'
      ? labels.failed
      : savedAt
        ? labels.saved(new Date(savedAt).toLocaleTimeString([], { timeStyle: 'short' }))
        : '';
  return (
    <Box accessibilityLiveRegion="polite" role="status" testID="saved-indicator">
      {text ? <CivicText variant="caption">{text}</CivicText> : null}
    </Box>
  );
}
