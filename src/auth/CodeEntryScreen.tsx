import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';

import { api } from '../api/client';
import { ApiError } from '../api/errors';
import {
  CivicButton,
  CivicHeading,
  CivicText,
  FormError,
  Screen,
  SubmitButton,
  TextField,
} from '../components/civic';
import { useT } from '../i18n';
import { safeReturnTo } from '../session/returnTo';
import { useSessionActions } from '../session/SessionProvider';
import { authCall, rateLimitMinutes } from './call';
import { clearPending, getPending, setNativeToken } from './pending';

/** Used by sign-up and by sign-in. The address comes from memory (pending.ts), never from the URL. */
export function CodeEntryScreen() {
  const t = useT();
  const { refresh } = useSessionActions();
  const { returnTo } = useLocalSearchParams<{ returnTo?: string }>();
  const [pending] = useState(getPending); // read once; clearPending below must not blank the screen mid-submit
  const [code, setCode] = useState('');
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!pending.email) {
    return (
      <Screen>
        <CivicHeading level={1}>{t('auth.code.title')}</CivicHeading>
        <CivicText>{t('auth.code.noEmail')}</CivicText>
        <CivicButton
          label={t('auth.code.restart')}
          accessibilityLabel={t('auth.code.restart')}
          onPress={() => router.replace('/sign-in')}
        />
      </Screen>
    );
  }
  const email = pending.email;

  const fail = (e: unknown) => {
    const minutes = rateLimitMinutes(e);
    setError(
      minutes
        ? t('auth.rateLimited', { minutes })
        : e instanceof ApiError && e.code === 'invalid_code'
          ? t('auth.code.invalid')
          : e instanceof ApiError && e.kind === 'offline'
            ? t('common.offline.banner')
            : t('common.error.generic'),
    );
  };

  const verify = async () => {
    setBusy(true);
    setError(undefined);
    setInfo(undefined);
    try {
      const r = await authCall(
        api.POST('/v1/auth/verify', {
          body: { email, code: code.trim() },
          // web gets the cookie; native asks for a token and keeps it in memory only
          ...(Platform.OS === 'web' ? {} : { headers: { 'X-CAN-Client': 'native' } }),
        }),
      );
      if (r.token) setNativeToken(r.token);
      const first = pending.flow === 'signup';
      clearPending();
      await refresh();
      router.replace(first ? '/welcome' : safeReturnTo(returnTo));
    } catch (e) {
      fail(e); // the typed code stays in the field
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(undefined);
    try {
      await authCall(api.POST('/v1/auth/code', { body: { email } }));
      setInfo(t('auth.code.resent'));
    } catch (e) {
      fail(e);
    }
  };

  return (
    <Screen>
      <CivicHeading level={1}>{t('auth.code.title')}</CivicHeading>
      <CivicText>{t('auth.code.body')}</CivicText>
      <FormError message={error} />
      {info ? <CivicText>{info}</CivicText> : null}
      <TextField
        label={t('auth.code.label')}
        accessibilityLabel={t('auth.code.label')}
        value={code}
        onChangeText={(v) => {
          setCode(v.replace(/\D/g, '').slice(0, 6));
          setError(undefined);
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
      />
      <SubmitButton
        label={t('auth.code.continue')}
        busy={busy}
        disabled={code.length !== 6}
        onPress={() => void verify()}
      />
      <CivicButton
        variant="secondary"
        label={t('auth.code.resend')}
        accessibilityLabel={t('auth.code.resend')}
        onPress={() => void resend()}
      />
    </Screen>
  );
}
