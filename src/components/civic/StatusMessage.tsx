import { ActivityIndicator } from 'react-native';

import { useTheme } from '../../theme';
import { Box } from '../ui/box';
import { CivicButton } from './CivicButton';
import { CivicHeading } from './CivicHeading';
import { CivicText } from './CivicText';

type Action = { label: string; accessibilityLabel: string; onPress: () => void };

type Props = {
  state: 'loading' | 'error' | 'empty' | 'success';
  title?: string;
  /** Message body. For loading it doubles as the accessible label. */
  message: string;
  action?: Action;
};

export function StatusMessage({ state, title, message, action }: Props) {
  const { color } = useTheme();
  const urgent = state === 'error';
  return (
    <Box
      // polite for progress and results, assertive only for errors
      accessibilityLiveRegion={urgent ? 'assertive' : 'polite'}
      testID="status-message"
      role={urgent ? 'alert' : 'status'}
      className={`gap-2 p-4 rounded-md border ${urgent ? 'border-can-urgent bg-can-urgent-surface' : 'border-can-border bg-can-surface'}`}
    >
      {state === 'loading' && (
        <ActivityIndicator color={color.primary} accessibilityLabel={message} />
      )}
      {title ? <CivicHeading level={3}>{title}</CivicHeading> : null}
      <CivicText>{message}</CivicText>
      {action ? (
        <CivicButton
          label={action.label}
          accessibilityLabel={action.accessibilityLabel}
          onPress={action.onPress}
          variant="secondary"
        />
      ) : null}
    </Box>
  );
}
