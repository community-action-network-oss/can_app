import { View } from 'react-native';

import { useT } from '../../i18n';
import { space } from '../../theme';
import { CivicText } from './CivicText';

// Static on purpose (CRISIS-STATIC-1): no network, no state, works offline.
export function EmergencyNotice() {
  const t = useT();
  return (
    <View role="note" style={{ padding: space('3') }}>
      <CivicText variant="caption">{t('emergency.notice')}</CivicText>
    </View>
  );
}
