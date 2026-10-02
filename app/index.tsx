import { router } from 'expo-router';

import {
  CivicButton,
  CivicHeading,
  CivicText,
  Screen,
  StatusMessage,
} from '../src/components/civic';
import { useT } from '../src/i18n';
import { useHealth } from '../src/hooks/useHealth';

export default function Home() {
  const t = useT();
  const health = useHealth();

  return (
    <Screen>
      <CivicHeading level={1}>{t('common.appName')}</CivicHeading>
      <CivicText>{t('home.purpose')}</CivicText>
      <CivicButton
        label={t('match.title')}
        accessibilityLabel={t('match.title')}
        onPress={() => router.push('/match')}
      />
      <CivicButton
        variant="secondary"
        label={t('home.profile')}
        accessibilityLabel={t('home.profile')}
        onPress={() => router.push('/profile/welcome')}
      />
      <CivicHeading level={2}>{t('home.health.heading')}</CivicHeading>
      {health.isPending ? (
        <StatusMessage state="loading" message={t('home.health.loading')} />
      ) : health.isError ? (
        <StatusMessage
          state="error"
          title={t('common.error.title')}
          message={t('home.health.error')}
          action={{
            label: t('common.error.retry'),
            accessibilityLabel: t('common.error.retry'),
            onPress: () => void health.refetch(),
          }}
        />
      ) : health.data.status === 'ok' ? (
        <StatusMessage state="success" message={t('home.health.ok')} />
      ) : (
        <StatusMessage
          state="error"
          message={t('home.health.degraded', { part: health.data.db === 'down' ? 'db' : 'other' })}
          action={{
            label: t('common.error.retry'),
            accessibilityLabel: t('common.error.retry'),
            onPress: () => void health.refetch(),
          }}
        />
      )}
    </Screen>
  );
}
