import { usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, View } from 'react-native';

import { sessionEvents } from '../api/session-events';
import { CivicButton, CivicHeading, CivicText } from '../components/civic';
import { useT } from '../i18n';
import { size, space, useTheme } from '../theme';

/**
 * WF-SESSION-1. An overlay, not a route: the screen underneath (and any typed input) is untouched.
 * The Modal traps focus, and Escape or Android back calls onRequestClose.
 */
export function SessionExpiredSheet() {
  const t = useT();
  const { color } = useTheme();
  const router = useRouter();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => sessionEvents.subscribe(() => setOpen(true)), []);
  const close = () => setOpen(false);
  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={close}>
      <View
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' }}
        accessibilityViewIsModal
      >
        <View
          role="dialog"
          accessibilityLiveRegion="assertive"
          style={{
            backgroundColor: color.surface,
            padding: space('4'),
            gap: space('3'),
            minHeight: size.minTarget,
          }}
        >
          <CivicHeading level={2}>{t('session.expired.title')}</CivicHeading>
          <CivicText>{t('session.expired.body')}</CivicText>
          <CivicButton
            label={t('session.expired.signIn')}
            accessibilityLabel={t('session.expired.signIn')}
            onPress={() => {
              close();
              router.push({ pathname: '/sign-in', params: { returnTo: path } });
            }}
          />
          <CivicButton
            variant="secondary"
            label={t('session.expired.notNow')}
            accessibilityLabel={t('session.expired.notNow')}
            onPress={close}
          />
        </View>
      </View>
    </Modal>
  );
}
