import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, type TextInput } from 'react-native';

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

const RESEND_MS = 30_000;

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
  const input = useRef<TextInput>(null);
  // Resend unlocks 30s after a code was sent. The ticking text is NOT a live region; the "sent" line is announced once.
  const [until, setUntil] = useState(() => Date.now() + RESEND_MS);
  const [now, setNow] = useState(Date.now);
  const wait = Math.max(0, Math.ceil((until - now) / 1000));
  useEffect(() => {
    const id = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= until) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [until]);

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
      fail(e); // the typed code stays in the field and keeps focus
      input.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(undefined);
    try {
      await authCall(api.POST('/v1/auth/code', { body: { email } }));
      setInfo(t('auth.code.resent'));
      setCode('');
      setNow(Date.now());
      setUntil(Date.now() + RESEND_MS);
      input.current?.focus();
    } catch (e) {
      fail(e);
    }
  };

  return (
    <Screen>
      <CivicHeading level={1}>{t('auth.code.title')}</CivicHeading>
      <CivicText>{t('auth.code.body')}</CivicText>
      <FormError message={error} />
      {info ? (
        <CivicText accessibilityLiveRegion="polite" role="status">
          {info}
        </CivicText>
      ) : null}
      <TextField
        ref={input}
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
        disabled={wait > 0}
        onPress={() => void resend()}
      />
      {wait > 0 ? (
        <CivicText variant="caption" muted>
          {t('auth.code.resendIn', { seconds: wait })}
        </CivicText>
      ) : null}
    </Screen>
  );
}
