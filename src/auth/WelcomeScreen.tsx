import { router } from 'expo-router';
import { useState } from 'react';

import { api } from '../api/client';
import { ApiError } from '../api/errors';
import { unwrap } from '../api/unwrap';
import { CivicButton, CivicHeading, CivicText, FormError, Screen } from '../components/civic';
import { useT } from '../i18n';
import { useSession } from '../navigation/SessionContext';
import { useSessionActions } from '../session/SessionProvider';

export function WelcomeScreen() {
  const t = useT();
  const session = useSession();
  const { refresh } = useSessionActions();
  const [handle, setHandle] = useState<string>();
  const [used, setUsed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const regenerate = async () => {
    setBusy(true);
    setError(undefined);
    try {
      setHandle((await unwrap(api.POST('/v1/me/handle/regenerate'))).handle);
      setUsed(true);
      await refresh();
    } catch (e) {
      // 403 not_permitted (server) or 409: the one change is already spent
      if (e instanceof ApiError && (e.status === 403 || e.status === 409)) setUsed(true);
      else
        setError(
          e instanceof ApiError && e.kind === 'offline'
            ? t('common.offline.banner')
            : t('common.error.generic'),
        );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <CivicHeading level={1}>{t('onboard.title')}</CivicHeading>
      <CivicText variant="bodyStrong">
        {t('onboard.handle.body', { handle: handle ?? session.handle ?? '' })}
      </CivicText>
      <FormError message={error} />
      {used ? (
        <CivicText>{t('onboard.handle.regenUsed')}</CivicText>
      ) : (
        <>
          <CivicButton
            variant="secondary"
            label={t('onboard.handle.another')}
            accessibilityLabel={t('onboard.handle.another')}
            disabled={busy}
            onPress={() => void regenerate()}
          />
          <CivicText variant="caption" muted>
            {t('onboard.handle.regenNote')}
          </CivicText>
        </>
      )}
      <CivicText>{t('onboard.promise')}</CivicText>
      <CivicButton
        label={t('onboard.continue')}
        accessibilityLabel={t('onboard.continue')}
        onPress={() => router.replace('/')}
      />
      <CivicButton
        variant="secondary"
        label={t('onboard.profile')}
        accessibilityLabel={t('onboard.profile')}
        onPress={() => router.push('/profile/welcome')}
      />
    </Screen>
  );
}
