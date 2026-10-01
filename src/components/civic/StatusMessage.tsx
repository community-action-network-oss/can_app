import { ActivityIndicator, View } from 'react-native';

import { radius, space, useTheme } from '../../theme';
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
    <View
      // polite for progress and results, assertive only for errors
      accessibilityLiveRegion={urgent ? 'assertive' : 'polite'}
      testID="status-message"
      role={urgent ? 'alert' : 'status'}
      style={{
        gap: space('2'),
        padding: space('4'),
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: urgent ? color.urgent : color.border,
        backgroundColor: urgent ? color.urgentSurface : color.surface,
      }}
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
    </View>
  );
}
